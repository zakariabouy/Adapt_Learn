import re
import textstat
from typing import List
from shared.models import LearnerModel
import os

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
    Mock async function for simplifying text based on the user's reading disability.
    In a real scenario, this would call Claude Haiku.
    """
    # Simulate simplification
    severity_dyslexia = profile.severity.get('dyslexia', 0.0)
    if severity_dyslexia > 0.5:
        # Simplified mock
        return f"[SIMPLIFIED FOR {severity_dyslexia} DYSLEXIA]: {text[:100]}... (AI Summary here)"
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
    Stubbed ElevenLabs TTS call that saves an mp3 file to /tmp/ and returns the path.
    """
    # Mock TTS path
    tmp_dir = "/tmp/adaptlearn"
    os.makedirs(tmp_dir, exist_ok=True)
    file_path = f"{tmp_dir}/{student_id}_tts.mp3"
    
    # In a real call:
    # response = await elevenlabs_client.generate(text=text, voice="Nicole")
    # with open(file_path, 'wb') as f:
    #     f.write(response)
    
    # Writing dummy data for now
    with open(file_path, 'wb') as f:
        f.write(b"MOCK MP3 DATA")
        
    return file_path
