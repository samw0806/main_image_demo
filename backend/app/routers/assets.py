from fastapi import APIRouter, File, UploadFile

from ..services.asset_service import list_assets, save_asset

router = APIRouter(prefix="/api/psd/assets", tags=["psd-assets"])


@router.post("/upload")
async def upload_assets(files: list[UploadFile] = File(...)):
    saved = []
    for file in files:
        data = await file.read()
        saved.append(save_asset(file.filename or "unknown.png", data))
    return {"count": len(saved), "items": saved}


@router.get("")
def get_assets():
    return {"items": list_assets()}
