"""
Pre-generate SVG visual aids for a content item's adapted chunks so the demo
never has to wait on Gemini. Cached output lands in backend/cache/visuals/
keyed by sha256(chunk_text) — the same key the runtime uses.

Usage (from backend/):
    python -m scripts.prewarm_visuals <content_id> <student_id>

Example:
    python -m scripts.prewarm_visuals 834e19d2-0246-4c70-b4c5-e8792a6fd922 ec84dfb3-009d-4871-91c3-2818b3d824d7
"""

from __future__ import annotations

import asyncio
import json
import sys
from uuid import UUID

import os

from agents.adaptation.agent import (
    generate_visual_aid,
    generate_visual_png,
    _visual_cache_path,
    _visual_png_cache_path,
)
from shared.database import get_pool


async def main(content_id: str, student_id: str) -> int:
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT adapted_text FROM adapted_content "
        "WHERE content_id = $1 AND student_id = $2 "
        "ORDER BY created_at DESC LIMIT 1",
        UUID(content_id), UUID(student_id),
    )
    if not row:
        print(f"No adapted_content for content={content_id} student={student_id}")
        print("Open the lesson once in the student workspace to seed adapted chunks, then re-run.")
        return 1

    chunks = json.loads(row["adapted_text"])
    hf_enabled = bool(os.getenv("HF_API_TOKEN"))
    mode = "HF PNG (FLUX) + SVG fallback" if hf_enabled else "Gemini SVG only"
    print(f"Pre-warming {len(chunks)} chunk(s) [{mode}]...")

    for i, chunk in enumerate(chunks):
        if hf_enabled:
            png_path = _visual_png_cache_path(chunk)
            if png_path.exists():
                print(f"  [{i+1}/{len(chunks)}] PNG cached -> {png_path.name}")
                continue
            data_url = await generate_visual_png(chunk)
            if data_url:
                print(f"  [{i+1}/{len(chunks)}] PNG OK -> {png_path.name}")
                continue
            print(f"  [{i+1}/{len(chunks)}] PNG failed, falling back to SVG")

        svg_path = _visual_cache_path(chunk)
        if svg_path.exists():
            print(f"  [{i+1}/{len(chunks)}] SVG cached -> {svg_path.name}")
            continue
        svg = await generate_visual_aid(chunk)
        marker = "OK" if "<svg" in svg and "Illustration coming soon" not in svg else "PLACEHOLDER"
        print(f"  [{i+1}/{len(chunks)}] SVG {marker} -> {svg_path.name}")
    print("Done.")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(2)
    sys.exit(asyncio.run(main(sys.argv[1], sys.argv[2])))
