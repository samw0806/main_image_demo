import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import (
    CHAT_STORAGE_DIR,
    LIBRARY_DIR,
    PSD_ASSETS_DIR,
    PSD_OUTPUTS_DIR,
    PSD_PREVIEWS_DIR,
    PSD_TEMPLATES_DIR,
    ensure_dirs,
    public_config,
)
from .db import init_db
from .routers import assets, chat, excel, jobs, library, templates

ensure_dirs()
app = FastAPI(title="Main Image Studio", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _configure_runtime_env() -> None:
    runtime_defaults = {
        "NUMBA_CACHE_DIR": "/tmp/numba_cache",
        "XDG_CACHE_HOME": "/tmp/xdg_cache",
        "U2NET_HOME": "/tmp/u2net",
    }
    for env_key, default_path in runtime_defaults.items():
        value = os.environ.setdefault(env_key, default_path)
        Path(value).mkdir(parents=True, exist_ok=True)


@app.on_event("startup")
def startup_event() -> None:
    _configure_runtime_env()
    ensure_dirs()
    init_db()


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/config")
def config():
    return public_config()


app.include_router(chat.router)
app.include_router(library.router)
app.include_router(templates.router)
app.include_router(excel.router)
app.include_router(assets.router)
app.include_router(jobs.router)

app.mount("/files/library", StaticFiles(directory=Path(LIBRARY_DIR)), name="library")
app.mount("/files/chat", StaticFiles(directory=Path(CHAT_STORAGE_DIR)), name="chat")
app.mount("/files/previews", StaticFiles(directory=Path(PSD_PREVIEWS_DIR)), name="previews")
app.mount("/files/assets", StaticFiles(directory=Path(PSD_ASSETS_DIR)), name="assets")
app.mount("/files/templates", StaticFiles(directory=Path(PSD_TEMPLATES_DIR)), name="templates")
app.mount("/files/outputs", StaticFiles(directory=Path(PSD_OUTPUTS_DIR)), name="outputs")
