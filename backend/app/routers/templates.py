from fastapi import APIRouter, File, HTTPException, UploadFile
import asyncio
import traceback
from functools import partial

from ..schemas import GroupPreviewPayload, ReplaceGroupsPayload
from ..services.group_service import list_groups, preview_group_layers, save_groups
from ..services.psd_service import get_layers, import_template

router = APIRouter(prefix="/api/psd/templates", tags=["psd-templates"])


@router.post("/upload")
async def upload_template(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="文件名为空")
    ext = file.filename.lower().split(".")[-1]
    if ext not in {"psd", "psb"}:
        raise HTTPException(status_code=400, detail="仅支持 psd/psb")
    try:
        data = await file.read()
        if not data:
            raise HTTPException(status_code=400, detail="上传文件为空")
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, partial(import_template, data, file.filename))
    except HTTPException:
        raise
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"模板解析失败: {type(exc).__name__}: {exc}") from exc


@router.get("/{template_id}/layers")
def get_template_layers(template_id: str):
    try:
        return get_layers(template_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{template_id}/groups")
def save_template_groups(template_id: str, payload: ReplaceGroupsPayload):
    try:
        return save_groups(template_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{template_id}/groups/preview")
def preview_template_group(template_id: str, payload: GroupPreviewPayload):
    try:
        return preview_group_layers(template_id, payload)
    except ValueError as exc:
        detail = str(exc)
        if detail == "模板不存在":
            raise HTTPException(status_code=404, detail=detail) from exc
        raise HTTPException(status_code=400, detail=detail) from exc


@router.get("/{template_id}/groups")
def get_template_groups(template_id: str):
    return {"groups": list_groups(template_id)}
