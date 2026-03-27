from __future__ import annotations

import base64
import json
import mimetypes
import os
import re
from pathlib import Path
from typing import Iterable

import requests
from PIL import Image, ImageDraw

from ..config import IMAGE_API_BASE_URL, IMAGE_API_KEY, IMAGE_API_MODEL


DEFAULT_MASK_BOX = (650, 280, 742, 490)


def create_masked_image(
    source_path: Path,
    output_path: Path,
    mask_box: tuple[int, int, int, int] = DEFAULT_MASK_BOX,
    mask_color: tuple[int, int, int] = (255, 0, 0),
) -> Path:
    image = Image.open(source_path).convert("RGB")
    draw = ImageDraw.Draw(image)
    x0, y0, x1, y1 = mask_box
    draw.rectangle((x0, y0, x1 - 1, y1 - 1), fill=mask_color)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(output_path)
    return output_path


def encode_image_as_data_url(path: Path) -> str:
    mime_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    payload = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime_type};base64,{payload}"


def build_chat_payload(model: str, prompt: str, image_urls: Iterable[str]) -> dict:
    content = [{"type": "text", "text": prompt}]
    for image_url in image_urls:
        content.append({"type": "image_url", "image_url": {"url": image_url}})
    return {
        "model": model,
        "stream": False,
        "messages": [{"role": "user", "content": content}],
    }


def extract_first_image_url(response_json: dict) -> str:
    content = response_json["choices"][0]["message"]["content"]
    match = re.search(r"https?://[^\s)]+\.(?:png|jpg|jpeg|webp)", content, re.I)
    if not match:
        raise ValueError("No image URL found in response content")
    return match.group(0)


def resize_to_match(source_path: Path, reference_path: Path, output_path: Path) -> Path:
    with Image.open(source_path) as source_image, Image.open(reference_path) as reference_image:
        source = source_image.convert("RGB")
        resized = source.resize(reference_image.size, Image.Resampling.LANCZOS)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    resized.save(output_path)
    return output_path


def write_json(path: Path, payload: dict) -> Path:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def default_prompt(user_prompt: str, previous_summary: str | None) -> str:
    parts = []
    if previous_summary:
        parts.append(f"Previous result summary: {previous_summary}")
    parts.append(user_prompt.strip())
    parts.append(
        "Replace the red masked rectangle area in the first image with the product from the second image. "
        "Keep the final image the same size and clarity as the original image."
    )
    return "\n".join(parts)


def resolve_api_settings() -> tuple[str, str, str]:
    base_url = os.environ.get("IMAGE_API_BASE_URL", IMAGE_API_BASE_URL).rstrip("/")
    api_key = os.environ.get("IMAGE_API_KEY") or IMAGE_API_KEY
    model = os.environ.get("IMAGE_MODEL", IMAGE_API_MODEL)
    if not api_key:
        raise ValueError("Missing IMAGE_API_KEY")
    return base_url, api_key, model


def post_chat_completion(base_url: str, api_key: str, payload: dict) -> dict:
    response = requests.post(
        f"{base_url}/v1/chat/completions",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        json=payload,
        timeout=180,
    )
    response.raise_for_status()
    return response.json()


def download_binary(url: str, destination: Path) -> Path:
    response = requests.get(url, timeout=180)
    response.raise_for_status()
    destination.write_bytes(response.content)
    return destination


def run_generation(
    *,
    prompt: str,
    asset_paths: list[Path],
    session_dir: Path,
    previous_summary: str | None = None,
) -> dict[str, object]:
    if not asset_paths:
        raise ValueError("At least one asset is required")

    session_dir.mkdir(parents=True, exist_ok=True)
    source_path = asset_paths[0]
    reference_path = asset_paths[1] if len(asset_paths) > 1 else asset_paths[0]
    masked_path = create_masked_image(source_path, session_dir / "masked_input.png")
    image_urls = [
        encode_image_as_data_url(masked_path),
        encode_image_as_data_url(reference_path),
    ]
    base_url, api_key, model = resolve_api_settings()
    rewrite_prompt = default_prompt(prompt, previous_summary)
    payload = build_chat_payload(model=model, prompt=rewrite_prompt, image_urls=image_urls)
    response_json = post_chat_completion(base_url, api_key, payload)
    result_url = extract_first_image_url(response_json)
    generated_path = download_binary(result_url, session_dir / "generated.png")
    output_path = resize_to_match(generated_path, source_path, session_dir / "final.png")
    write_json(session_dir / "request.json", payload)
    write_json(session_dir / "response.json", response_json)
    return {
        "output_path": output_path,
        "summary": prompt.strip() or "Generated image",
        "request_payload": payload,
        "result_url": result_url,
    }
