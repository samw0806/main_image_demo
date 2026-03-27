from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response

from ..services.excel_service import export_excel_template, import_excel_and_validate

router = APIRouter(prefix="/api/psd/templates", tags=["psd-excel"])


@router.get("/{template_id}/excel/export")
def export_excel(template_id: str, filename: str = None):
    try:
        data = export_excel_template(template_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    final_filename = filename or f"{template_id}_mapping.xlsx"
    if not final_filename.endswith(".xlsx"):
        final_filename += ".xlsx"

    import urllib.parse
    encoded_filename = urllib.parse.quote(final_filename)

    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"},
    )


@router.post("/{template_id}/excel/import")
async def import_excel(template_id: str, file: UploadFile = File(...)):
    try:
        data = await file.read()
        result = import_excel_and_validate(template_id, data)
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
