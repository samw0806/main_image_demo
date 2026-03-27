from typing import Literal

from pydantic import BaseModel, Field


class LayerNode(BaseModel):
    id: str
    parent_id: str | None = None
    name: str
    x: int
    y: int
    width: int
    height: int
    stack_index: int = 0
    visible: bool
    level: int = 0


class ReplaceLayerRule(BaseModel):
    layer_id: str
    action: Literal["keep", "replace"] = "replace"


class ReplaceGroupIn(BaseModel):
    id: str | None = None
    name: str = Field(min_length=1, max_length=64)
    region: dict
    layer_rules: list[ReplaceLayerRule]


class ReplaceGroupsPayload(BaseModel):
    groups: list[ReplaceGroupIn]


class GroupPreviewPayload(BaseModel):
    layer_ids: list[str] = Field(min_length=1)


class ExcelImportResult(BaseModel):
    rows: list[dict]
    missing_assets: list[str]
    unknown_groups: list[str]


class ChatSessionCreateIn(BaseModel):
    title: str | None = Field(default=None, max_length=100)


class ChatGenerateIn(BaseModel):
    prompt: str = ""
    asset_ids: list[str] = Field(default_factory=list)
