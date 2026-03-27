from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from ..services.library_service import get_asset, list_assets, save_upload

router = APIRouter(prefix="/api/library/assets", tags=["library"])


@router.post("/upload")
async def upload_library_assets(files: list[UploadFile] = File(...)):
    items = []
    for file in files:
        payload = await file.read()
        items.append(save_upload(file.filename or "upload.bin", payload))
    return {"count": len(items), "items": items}


@router.get("")
def get_library_assets():
    return {"items": list_assets()}


@router.get("/{asset_id}")
def get_library_asset(asset_id: str):
    try:
        return get_asset(asset_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{asset_id}/file")
def get_library_asset_file(asset_id: str):
    try:
        asset = get_asset(asset_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return FileResponse(asset["file_path"], media_type=asset["mime_type"], filename=asset["filename"])
