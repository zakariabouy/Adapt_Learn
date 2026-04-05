import re
import textstat
from typing import List
from shared.models import LearnerModel
import os
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from elevenlabs.client import ElevenLabs
from elevenlabs import save

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
    Calls Gemini 1.5 Flash to simplify text based on the student's profile (disabilities, severity).
    """
    severity_dyslexia = profile.severity.get('dyslexia', 0.0)
    severity_adhd = profile.severity.get('adhd', 0.0)
    
    if severity_dyslexia < 0.3 and severity_adhd < 0.3:
        return text # No simplification needed
        
    prompt = f"""
    You are an expert in inclusive education. Simplify the following text for a student with the following profile:
    - Disabilities: {profile.disabilities}
    - Dyslexia Severity: {severity_dyslexia}
    - ADHD Severity: {severity_adhd}
    
    Original Text:
    {text}
    
    Tasks:
    1. Use simpler vocabulary.
    2. Shorten complex sentences.
    3. Maintain all key pedagogical points.
    4. Return ONLY the simplified text.
    """
    
    try:
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        return response.content
    except Exception as e:
        print(f"Gemini Simplification Error: {e}")
        return text

async def transform_font(profile: LearnerModel) -> dict:
    """
    Returns a CSS style dictionary config depending on the user's profile.
    """
    config = {
        "fontFamily": profile.preferred_font,
        "fontSize": f"{profile.font_size}px",
        "lineHeight": str(profile.line_spacing),
    }
    
    if "dyslexia" in profile.disabilities:
        # Override with Dyslexic friendly font if preferred or required
        config["fontFamily"] = "OpenDyslexic, sans-serif"
    
    return config

async def tts_convert(text: str, student_id: str) -> str:
    """
    Calls ElevenLabs TTS to generate speech and saves it to a temporary file.
    """
    tmp_dir = "/tmp/adaptlearn"
    os.makedirs(tmp_dir, exist_ok=True)
    file_path = f"{tmp_dir}/{student_id}_tts.mp3"
    
    try:
        # Generate audio using ElevenLabs
        audio = eleven_client.generate(
            text=text,
            voice="Rachel",
            model="eleven_multilingual_v2"
        )
        
        # Save audio to file
        save(audio, file_path)
        return file_path
    except Exception as e:
        print(f"ElevenLabs TTS Error: {e}")
        # Return a fallback path or empty string if failed
        return ""
