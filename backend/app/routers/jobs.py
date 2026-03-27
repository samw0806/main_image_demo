from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from ..services.job_service import (
    build_output_zip,
    create_job,
    export_psd_basic,
    get_job,
    list_output_images,
)

router = APIRouter(prefix="/api/psd/jobs", tags=["psd-jobs"])


@router.post("/generate/{template_id}")
async def generate_job(template_id: str, excel: UploadFile = File(...)):
    try:
        data = await excel.read()
        return create_job(template_id, data)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"任务创建失败: {exc}") from exc


@router.get("/{job_id}")
def get_job_status(job_id: str):
    try:
        return get_job(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{job_id}/download")
def download_outputs(job_id: str):
    try:
        zip_path = build_output_zip(job_id)
        return FileResponse(
            path=zip_path,
            media_type="application/zip",
            filename=f"{job_id}_outputs.zip",
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"打包失败: {exc}") from exc


@router.get("/{job_id}/images")
def list_images(job_id: str):
    try:
        return list_output_images(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{job_id}/images/{filename}")
def get_image(job_id: str, filename: str):
    try:
        job = get_job(job_id)
        file_path = Path(job["output_dir"]) / "png" / filename
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="图片不存在")
        return FileResponse(file_path, media_type="image/png")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"获取图片失败: {exc}") from exc


@router.post("/{job_id}/export-psd")
def export_psd(job_id: str):
    try:
        return export_psd_basic(job_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"PSD 导出失败: {exc}") from exc
