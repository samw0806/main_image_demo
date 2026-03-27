from fastapi import APIRouter, HTTPException

from ..schemas import ChatGenerateIn, ChatSessionCreateIn
from ..services.chat_service import create_session, generate_reply, get_session, list_messages, list_sessions

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("/sessions")
def create_chat_session(payload: ChatSessionCreateIn):
    return create_session(payload.title)


@router.get("/sessions")
def get_chat_sessions():
    return {"items": list_sessions()}


@router.get("/sessions/{session_id}")
def get_chat_session(session_id: str):
    try:
        return get_session(session_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/sessions/{session_id}/messages")
def get_chat_messages(session_id: str):
    try:
        return {"items": list_messages(session_id)}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/sessions/{session_id}/generate")
def generate_chat_reply(session_id: str, payload: ChatGenerateIn):
    try:
        return generate_reply(session_id, prompt=payload.prompt, asset_ids=payload.asset_ids)
    except ValueError as exc:
        detail = str(exc)
        status_code = 404 if detail == "会话不存在" else 400
        raise HTTPException(status_code=status_code, detail=detail) from exc
