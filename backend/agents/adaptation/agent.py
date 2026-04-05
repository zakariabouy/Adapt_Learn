import re
import logging
import tempfile
import textstat
from pathlib import Path
from typing import List
from shared.models import LearnerModel
import os
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from elevenlabs.client import ElevenLabs
from elevenlabs import save

logger = logging.getLogger(__name__)

_llm = None
_eleven_client = None

def get_llm():
    global _llm
    if _llm is None:
        _llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", google_api_key=os.getenv("GOOGLE_API_KEY"))
    return _llm

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
    """
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

    Original Text:
    {text}

    Tasks:
    1. Use simpler vocabulary and shorter sentences.
    2. Maintain core pedagogical concepts.
    3. Return ONLY the simplified text in Markdown.
    """
    
    try:
        response = await get_llm().ainvoke([HumanMessage(content=prompt)])
        return response.content
    except Exception as e:
        logger.warning("Gemini simplification failed: %s", e)
        return text

async def summarize_text(text: str) -> str:
    """
    Returns a one-sentence summary of the text chunk.
    """
    prompt = f"Summarize the following text in exactly one clear, encouraging sentence for a student:\n\n{text}"
    try:
        response = await get_llm().ainvoke([HumanMessage(content=prompt)])
        return response.content
    except Exception as e:
        logger.warning("Gemini summarization failed: %s", e)
        return text

async def generate_visual_aid(text: str) -> str:
    """
    Generates a simple SVG diagram or illustration representing the text.
    """
    prompt = f"""
    Create a simple, high-contrast SVG illustration that represents the following educational concept:
    "{text}"
    
    Requirements:
    1. Use a clean, modern style with bold lines.
    2. Use accessible colors (high contrast).
    3. The SVG should be responsive (viewBox="0 0 400 400").
    4. Keep it very simple (icons, basic shapes).
    5. Return ONLY the SVG code.
    """
    try:
        response = await get_llm().ainvoke([HumanMessage(content=prompt)])
        content = response.content.strip()
        if "<svg" in content:
            # Extract SVG part if Gemini wraps it in markdown
            if "```" in content:
                content = content.split("<svg")[1].split("</svg>")[0]
                content = "<svg" + content + "</svg>"
            return content
        return ""
    except Exception as e:
        logger.warning("Gemini visual aid generation failed: %s", e)
        return ""

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
        # Generate audio using ElevenLabs
        audio = get_eleven_client().generate(
            text=text,
            voice="Rachel",
            model="eleven_multilingual_v2"
        )
        
        # Save audio to file
        save(audio, file_path)
        return file_path
    except Exception as e:
        logger.warning("ElevenLabs TTS failed for student %s: %s", student_id, e)
        # Return a fallback path or empty string if failed
        return ""
