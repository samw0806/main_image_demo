import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"
STORAGE_DIR = BASE_DIR / "storage"
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "app.db"

LIBRARY_DIR = STORAGE_DIR / "library"
CHAT_STORAGE_DIR = STORAGE_DIR / "chat"
PSD_STORAGE_DIR = STORAGE_DIR / "psd"
PSD_TEMPLATES_DIR = PSD_STORAGE_DIR / "templates"
PSD_PREVIEWS_DIR = PSD_STORAGE_DIR / "previews"
PSD_ASSETS_DIR = PSD_STORAGE_DIR / "assets"
PSD_OUTPUTS_DIR = PSD_STORAGE_DIR / "outputs"

# Backward-compatible aliases for migrated PSD modules.
TEMPLATES_DIR = PSD_TEMPLATES_DIR
PREVIEWS_DIR = PSD_PREVIEWS_DIR
ASSETS_DIR = PSD_ASSETS_DIR
OUTPUTS_DIR = PSD_OUTPUTS_DIR


def _load_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip("'\"")
    return values


_env_values = _load_env_file(ENV_PATH)

IMAGE_API_BASE_URL = (
    os.environ.get("IMAGE_API_BASE_URL")
    or _env_values.get("IMAGE_API_BASE_URL")
    or _env_values.get("BASE_URL")
    or "https://ai.t8star.cn"
).rstrip("/")
IMAGE_API_MODEL = os.environ.get("IMAGE_MODEL") or _env_values.get("IMAGE_MODEL") or "nano-banana"
IMAGE_API_KEY = (
    os.environ.get("IMAGE_API_KEY")
    or _env_values.get("IMAGE_API_KEY")
    or os.environ.get("API_KEY")
    or _env_values.get("API_KEY")
    or os.environ.get("NANO_BANANA")
    or _env_values.get("NANO_BANANA")
    or ""
)


def ensure_dirs() -> None:
    for path in [
        STORAGE_DIR,
        DATA_DIR,
        LIBRARY_DIR,
        CHAT_STORAGE_DIR,
        PSD_STORAGE_DIR,
        PSD_TEMPLATES_DIR,
        PSD_PREVIEWS_DIR,
        PSD_ASSETS_DIR,
        PSD_OUTPUTS_DIR,
    ]:
        path.mkdir(parents=True, exist_ok=True)


def public_config() -> dict[str, object]:
    return {
        "image_model": IMAGE_API_MODEL,
        "chat_supports_stream": False,
        "ui_mode": "desktop-first",
        "psd_workflow_enabled": True,
    }
