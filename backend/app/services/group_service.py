import uuid
from datetime import datetime
from pathlib import Path

from psd_tools import PSDImage

from ..config import PREVIEWS_DIR
from ..db import dump_json, get_conn, load_json
from ..schemas import GroupPreviewPayload, ReplaceGroupsPayload
from .psd_service import build_layer_map, composite_without_layers


def save_groups(template_id: str, payload: ReplaceGroupsPayload) -> dict:
    names = [g.name.strip() for g in payload.groups]
    if len(names) != len(set(names)):
        raise ValueError("替换组名称必须唯一")
    if any(not g.layer_rules for g in payload.groups):
        raise ValueError("替换组不能为空")

    with get_conn() as conn:
        conn.execute("DELETE FROM replace_groups WHERE template_id = ?", (template_id,))
        for group in payload.groups:
            group_id = group.id or uuid.uuid4().hex
            conn.execute(
                """
                INSERT INTO replace_groups (id, template_id, name, region_json, layer_rules_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    group_id,
                    template_id,
                    group.name.strip(),
                    dump_json(group.region),
                    dump_json([rule.model_dump() for rule in group.layer_rules]),
                    datetime.utcnow().isoformat(),
                ),
            )
        conn.commit()

    return {"ok": True, "count": len(payload.groups)}


def list_groups(template_id: str) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT id, name, region_json, layer_rules_json
            FROM replace_groups
            WHERE template_id = ?
            ORDER BY created_at ASC
            """,
            (template_id,),
        ).fetchall()
    return [
        {
            "id": row["id"],
            "name": row["name"],
            "region": load_json(row["region_json"], {}),
            "layer_rules": load_json(row["layer_rules_json"], []),
        }
        for row in rows
    ]


def preview_group_layers(template_id: str, payload: GroupPreviewPayload) -> dict:
    layer_ids: list[str] = []
    seen = set()
    for raw_id in payload.layer_ids:
        layer_id = raw_id.strip()
        if not layer_id or layer_id in seen:
            continue
        seen.add(layer_id)
        layer_ids.append(layer_id)
    if not layer_ids:
        raise ValueError("请至少提供一个有效图层 ID")

    with get_conn() as conn:
        tpl = conn.execute(
            "SELECT file_path FROM templates WHERE id = ?",
            (template_id,),
        ).fetchone()
    if not tpl:
        raise ValueError("模板不存在")

    psd = PSDImage.open(str(Path(tpl["file_path"])))
    layer_map = build_layer_map(psd, template_id)
    preview_image, composite_meta = composite_without_layers(psd, layer_ids, layer_map)

    filename = f"group-preview-{template_id}-{uuid.uuid4().hex}.png"
    preview_path = PREVIEWS_DIR / filename
    preview_path.parent.mkdir(parents=True, exist_ok=True)
    preview_image.save(preview_path)

    unmatched_layer_ids = [layer_id for layer_id in layer_ids if layer_id not in layer_map]
    matched_count = len(layer_ids) - len(unmatched_layer_ids)

    return {
        "preview_url": f"/files/previews/{filename}",
        "requested_count": len(layer_ids),
        "matched_count": matched_count,
        "unmatched_layer_ids": unmatched_layer_ids,
        "composite_meta": composite_meta,
    }
