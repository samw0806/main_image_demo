export type LayerNode = {
  id: string;
  parent_id: string | null;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  stack_index: number;
  visible: boolean;
  level: number;
};

export type TemplateData = {
  id: string;
  name: string;
  width: number;
  height: number;
  preview_url: string;
};

export type ReplaceLayerRule = {
  layer_id: string;
  action: "keep" | "replace";
};

export type ReplaceGroup = {
  id?: string;
  name: string;
  region: { x: number; y: number; width: number; height: number };
  layer_rules: ReplaceLayerRule[];
};

export type SelectionBox = { x: number; y: number; width: number; height: number } | null;

export type EditorState = {
  selectedIds: string[];
  selection: SelectionBox;
  groups: ReplaceGroup[];
  groupName: string;
};

export type HistoryState = {
  past: EditorState[];
  present: EditorState;
  future: EditorState[];
};

export type JobUiStatus = "idle" | "generating" | "completed" | "failed";
