import re
import logging
import tempfile
import hashlib
import base64
import textstat
import httpx
from pathlib import Path
from typing import List
from shared.models import LearnerModel
from shared.guardrails import (
    run_input_guardrails,
    run_output_guardrails,
    check_content_safety,
    filter_unsafe_content,
)
import os
from langchain_core.messages import HumanMessage
from elevenlabs.client import ElevenLabs

from shared.llm import get_rotating_llm

logger = logging.getLogger(__name__)

_eleven_client = None

def get_llm():
    return get_rotating_llm("gemini-2.5-flash")

def get_eleven_client():
    global _eleven_client
    if _eleven_client is None:
        _eleven_client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))
    return _eleven_client

async def chunk_content(text: str, chunk_size: int) -> List[str]:
    """
    Slices the markdown text by natural sentence boundaries up to chunk_size characters.
    """
    # Simple regex for sentence boundaries: . ? ! followed by space or newline
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks = []
    current_chunk = ""
    
    for sentence in sentences:
        if len(current_chunk) + len(sentence) <= chunk_size:
            current_chunk += sentence + " "
        else:
            if current_chunk:
                chunks.append(current_chunk.strip())
            current_chunk = sentence + " "
            
    if current_chunk:
        chunks.append(current_chunk.strip())
        
    return chunks

async def readability_score(text: str) -> float:
    """
    Returns the Flesch-Kincaid grade level score of the text.
    """
    return textstat.flesch_kincaid_grade(text)

async def simplify_text(text: str, profile: LearnerModel) -> str:
    """
    Calls Gemini 1.5 Flash to simplify text based on the student's profile.
    Wrapped with input/output guardrails for safety.
    """
    # ── Input guardrails ──
    input_check = await run_input_guardrails(text, endpoint="adaptation/simplify")
    text = input_check["sanitized_text"]

    # Build a natural-language description of the learner's profile
    tag_descriptions = []
    for tag in profile.learning_tags:
        strength = profile.tag_strength.get(tag, 0.5)
        tag_descriptions.append(f"{tag} (strength {strength:.1f})")
    profile_str = ", ".join(tag_descriptions) if tag_descriptions else "general learner"

    prompt = f"""
    You are an expert in inclusive education. Simplify the following text for a student with this learning profile:
    - Learning style: {profile_str}
    - Preferred modality: {profile.preferred_modality}

    SAFETY: This content is for primary school children (ages 6-12). Do NOT include violence, profanity, or any inappropriate content.

    Original Text:
    {text}

    Tasks:
    1. Use simpler vocabulary and shorter sentences.
    2. Maintain core pedagogical concepts.
    3. Return ONLY the simplified text in Markdown.
    """

    try:
        response = await get_llm().ainvoke([HumanMessage(content=prompt)])
        result = response.content

        # ── Output guardrails ──
        output_check = await run_output_guardrails(result, source_text=text, endpoint="adaptation/simplify")
        return output_check["filtered_text"]
    except Exception as e:
        logger.warning("Gemini simplification failed: %s", e)
        return text

async def summarize_text(text: str) -> str:
    """
    Returns a one-sentence summary of the text chunk.
    """
    input_check = await run_input_guardrails(text, endpoint="adaptation/summarize")
    prompt = f"Summarize the following text in exactly one clear, encouraging sentence for a primary school student:\n\n{input_check['sanitized_text']}"
    try:
        response = await get_llm().ainvoke([HumanMessage(content=prompt)])
        output_check = await run_output_guardrails(response.content, endpoint="adaptation/summarize")
        return output_check["filtered_text"]
    except Exception as e:
        logger.warning("Gemini summarization failed: %s", e)
        return text

_VISUAL_CACHE_DIR = Path(__file__).resolve().parents[2] / "cache" / "visuals"

_PLACEHOLDER_SVG = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img" '
    'aria-label="Illustration unavailable">'
    '<rect width="400" height="400" rx="24" fill="#f1f5f9"/>'
    '<circle cx="200" cy="170" r="64" fill="#cbd5e1"/>'
    '<rect x="110" y="250" width="180" height="20" rx="10" fill="#cbd5e1"/>'
    '<rect x="140" y="285" width="120" height="14" rx="7" fill="#e2e8f0"/>'
    '<text x="200" y="360" text-anchor="middle" font-family="sans-serif" '
    'font-size="18" fill="#64748b">Illustration coming soon</text>'
    '</svg>'
)


def _visual_cache_path(text: str) -> Path:
    digest = hashlib.sha256(text.strip().encode("utf-8")).hexdigest()
    return _VISUAL_CACHE_DIR / f"{digest}.svg"


def _visual_png_cache_path(text: str) -> Path:
    digest = hashlib.sha256(text.strip().encode("utf-8")).hexdigest()
    return _VISUAL_CACHE_DIR / f"{digest}.png"


_HF_IMAGE_MODEL = os.getenv("HF_IMAGE_MODEL", "black-forest-labs/FLUX.1-schnell")
_HF_INFERENCE_URL = f"https://api-inference.huggingface.co/models/{_HF_IMAGE_MODEL}"


def _png_bytes_to_data_url(png: bytes) -> str:
    return "data:image/png;base64," + base64.b64encode(png).decode("ascii")


async def _build_image_prompt(text: str) -> str:
    summary_prompt = (
        "In ONE short English sentence (<20 words) describe a single, concrete, "
        "child-friendly illustration that would help a primary-school student "
        "understand this passage. No text in the image. Passage:\n\n"
        f"{text[:1200]}"
    )
    try:
        resp = await get_llm().ainvoke([HumanMessage(content=summary_prompt)])
        scene = resp.content.strip().replace("\n", " ")
        if scene:
            return (
                f"Children's educational illustration: {scene}. "
                "Flat vector style, bold outlines, bright primary colors, "
                "high contrast, simple shapes, friendly, no text, no letters."
            )
    except Exception as e:
        logger.warning("Image-prompt summarization failed: %s", e)
    return (
        "Children's educational illustration. Flat vector style, bold outlines, "
        "bright primary colors, high contrast, simple shapes, friendly, no text."
    )


async def generate_visual_png(text: str) -> str:
    """
    Generate a PNG illustration via Hugging Face Inference API (FLUX.1-schnell
    by default). Cached on disk by sha256(text). Returns a data: URL string
    ready to drop into an <img src="">. Returns empty string on any failure —
    callers fall back to the SVG path.
    """
    token = os.getenv("HF_API_TOKEN")
    if not token:
        return ""

    cache_path = _visual_png_cache_path(text)
    if cache_path.exists():
        try:
            return _png_bytes_to_data_url(cache_path.read_bytes())
        except OSError as e:
            logger.warning("PNG visual cache read failed (%s); regenerating", e)

    input_check = await run_input_guardrails(text, endpoint="adaptation/visual_png")
    image_prompt = await _build_image_prompt(input_check["sanitized_text"])

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "image/png",
    }
    payload = {"inputs": image_prompt}

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(_HF_INFERENCE_URL, headers=headers, json=payload)
        if r.status_code != 200:
            logger.warning(
                "HF image API %s -> %s: %s",
                _HF_IMAGE_MODEL, r.status_code, r.text[:200],
            )
            return ""
        ctype = r.headers.get("content-type", "")
        if "image" not in ctype:
            logger.warning("HF image API returned non-image content-type: %s", ctype)
            return ""
        try:
            _VISUAL_CACHE_DIR.mkdir(parents=True, exist_ok=True)
            cache_path.write_bytes(r.content)
        except OSError as e:
            logger.warning("PNG visual cache write failed: %s", e)
        return _png_bytes_to_data_url(r.content)
    except Exception as e:
        logger.warning("HF image generation failed: %s", e)
        return ""


async def generate_visual_aid(text: str) -> str:
    """
    Generates a simple SVG diagram or illustration representing the text.
    Cached on disk by sha256(text) so repeat chunk views never re-bill Gemini.
    Returns a friendly placeholder SVG (never empty string) on failure so the
    UI always has something to render.
    """
    cache_path = _visual_cache_path(text)
    if cache_path.exists():
        try:
            return cache_path.read_text(encoding="utf-8")
        except OSError as e:
            logger.warning("Visual cache read failed (%s); regenerating", e)

    input_check = await run_input_guardrails(text, endpoint="adaptation/visual")
    prompt = f"""
    Create a simple, high-contrast SVG illustration that represents the following educational concept for primary school children:
    "{input_check['sanitized_text']}"

    Requirements:
    1. Use a clean, modern style with bold lines.
    2. Use accessible colors (high contrast).
    3. The SVG should be responsive (viewBox="0 0 400 400").
    4. Keep it very simple (icons, basic shapes).
    5. Content MUST be child-appropriate and educational.
    6. Return ONLY the SVG code. No scripts or external references.
    """
    try:
        response = await get_llm().ainvoke([HumanMessage(content=prompt)])
        content = response.content.strip()

        # Guardrail: strip any <script> tags from SVG (XSS prevention)
        content = re.sub(r'<script[^>]*>.*?</script>', '', content, flags=re.DOTALL | re.IGNORECASE)
        content = re.sub(r'\bon\w+\s*=\s*["\'][^"\']*["\']', '', content, flags=re.IGNORECASE)

        if "<svg" in content:
            if "```" in content:
                content = content.split("<svg")[1].split("</svg>")[0]
                content = "<svg" + content + "</svg>"
            try:
                _VISUAL_CACHE_DIR.mkdir(parents=True, exist_ok=True)
                cache_path.write_text(content, encoding="utf-8")
            except OSError as e:
                logger.warning("Visual cache write failed: %s", e)
            return content
        logger.warning("Gemini returned non-SVG content for visual aid; using placeholder")
        return _PLACEHOLDER_SVG
    except Exception as e:
        logger.warning("Gemini visual aid generation failed: %s", e)
        return _PLACEHOLDER_SVG

async def transform_font(profile: LearnerModel) -> dict:
    """
    Returns a CSS style dictionary config depending on the user's profile.
    """
    config = {
        "fontFamily": profile.preferred_font,
        "fontSize": f"{profile.font_size}px",
        "lineHeight": str(profile.line_spacing),
    }
    
    if "slow_reader" in profile.learning_tags or profile.preferred_font == "OpenDyslexic":
        config["fontFamily"] = "OpenDyslexic, sans-serif"
    
    return config

async def tts_convert(text: str, student_id: str) -> str:
    """
    Calls ElevenLabs TTS to generate speech and saves it to a temporary file.
    """
    tmp_dir = Path(tempfile.gettempdir()) / "adaptlearn"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    file_path = str(tmp_dir / f"{student_id}_tts.mp3")
    
    try:
        # Generate audio using ElevenLabs SDK v1+ (text_to_speech.convert returns a byte iterator).
        # "Rachel" voice_id is the stable public-preset ID.
        audio_iter = get_eleven_client().text_to_speech.convert(
            text=text,
            voice_id="21m00Tcm4TlvDq8ikWAM",  # Rachel
            model_id="eleven_multilingual_v2",
            output_format="mp3_44100_128",
        )

        # Concatenate the byte chunks into the output file.
        with open(file_path, "wb") as f:
            for chunk in audio_iter:
                if chunk:
                    f.write(chunk)
        return file_path
    except Exception as e:
        logger.warning("ElevenLabs TTS failed for student %s: %s", student_id, e)
        # Return a fallback path or empty string if failed
        return ""
