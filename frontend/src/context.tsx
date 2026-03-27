import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  createJob,
  exportPsd,
  getErrorMessage,
  getGroups,
  getJob,
  getTemplateLayers,
  importExcel,
  saveGroups,
  uploadAssets,
  uploadTemplate,
} from "./api";
import type {
  EditorState,
  HistoryState,
  JobUiStatus,
  LayerNode,
  ReplaceGroup,
  TemplateData,
} from "./types";

const MAX_HISTORY = 100;

export const EMPTY_EDITOR: EditorState = {
  selectedIds: [],
  selection: null,
  groups: [],
  groupName: "",
};

export function cloneEditor(state: EditorState): EditorState {
  return {
    selectedIds: [...state.selectedIds],
    selection: state.selection ? { ...state.selection } : null,
    groups: state.groups.map((group) => ({
      ...group,
      region: { ...group.region },
      layer_rules: group.layer_rules.map((rule) => ({ ...rule })),
    })),
    groupName: state.groupName,
  };
}

export function isDefaultProductLayer(name: string): boolean {
  const trimmed = name.trim();
  return /^\d+(?:-\d+)*$/.test(trimmed) || trimmed.includes("待替换");
}

type WorkflowContextType = {
  template: TemplateData | null;
  layers: LayerNode[];
  history: HistoryState;
  editor: EditorState;
  busy: boolean;
  uploadProgress: number;
  errorText: string;
  jobId: string;
  jobInfo: any;
  jobUiStatus: JobUiStatus;

  setErrorText: (t: string) => void;
  updateEditor: (updater: (prev: EditorState) => EditorState) => void;
  undo: () => void;
  redo: () => void;
  toggleLayer: (id: string, multi?: boolean) => void;
  removeSelectedLayer: (id: string) => void;
  createGroupFromSelection: () => void;
  deleteGroup: (name: string) => void;

  onUploadTemplate: (file: File) => Promise<TemplateData | null>;
  onSaveGroups: () => Promise<void>;
  onImportExcel: (file: File) => Promise<any>;
  onUploadAssets: (files: FileList | null) => Promise<void>;
  onRunJob: (file: File) => Promise<void>;
  onRefreshJob: () => Promise<void>;
  onExportPsd: () => Promise<void>;
};

const WorkflowContext = createContext<WorkflowContextType | null>(null);

export function WorkflowProvider({ children }: { children: React.ReactNode }) {
  const [template, setTemplate] = useState<TemplateData | null>(null);
  const [layers, setLayers] = useState<LayerNode[]>([]);
  const [history, setHistory] = useState<HistoryState>({
    past: [],
    present: cloneEditor(EMPTY_EDITOR),
    future: [],
  });
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorText, setErrorText] = useState("");
  const [jobId, setJobId] = useState("");
  const [jobInfo, setJobInfo] = useState<any>(null);
  const [jobUiStatus, setJobUiStatus] = useState<JobUiStatus>("idle");
  const pollingTimerRef = useRef<number | null>(null);

  const editor = history.present;

  useEffect(() => {
    return () => {
      if (pollingTimerRef.current !== null) {
        window.clearInterval(pollingTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const ctrlOrCmd = isMac ? event.metaKey : event.ctrlKey;
      if (!ctrlOrCmd) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }
      if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function updateEditor(updater: (prev: EditorState) => EditorState) {
    setHistory((prev) => {
      const next = updater(prev.present);
      const past = [...prev.past, cloneEditor(prev.present)];
      const trimmedPast = past.length > MAX_HISTORY ? past.slice(past.length - MAX_HISTORY) : past;
      return { past: trimmedPast, present: cloneEditor(next), future: [] };
    });
  }

  function undo() {
    setHistory((prev) => {
      if (prev.past.length === 0) return prev;
      const newPast = [...prev.past];
      const previous = newPast.pop()!;
      return {
        past: newPast,
        present: cloneEditor(previous),
        future: [cloneEditor(prev.present), ...prev.future],
      };
    });
  }

  function redo() {
    setHistory((prev) => {
      if (prev.future.length === 0) return prev;
      const [next, ...rest] = prev.future;
      return {
        past: [...prev.past, cloneEditor(prev.present)],
        present: cloneEditor(next),
        future: rest,
      };
    });
  }

  function toggleLayer(id: string, multi = true) {
    updateEditor((prev) => {
      if (!multi) return { ...prev, selectedIds: [id] };
      if (prev.selectedIds.includes(id)) {
        return { ...prev, selectedIds: prev.selectedIds.filter((x) => x !== id) };
      }
      return { ...prev, selectedIds: [...prev.selectedIds, id] };
    });
  }

  function removeSelectedLayer(id: string) {
    updateEditor((prev) => ({
      ...prev,
      selectedIds: prev.selectedIds.filter((x) => x !== id),
    }));
  }

  function createGroupFromSelection() {
    if (!editor.groupName.trim()) {
      setErrorText("请先填写替换组名称");
      return;
    }
    if (editor.selectedIds.length === 0) {
      setErrorText("请先选择至少一个图层");
      return;
    }
    if (editor.groups.some((g) => g.name === editor.groupName.trim())) {
      setErrorText("替换组名称重复");
      return;
    }
    const selectedIdsSorted = [...editor.selectedIds].sort((aId, bId) => {
      const a = layers.find((layer) => layer.id === aId);
      const b = layers.find((layer) => layer.id === bId);
      return (a?.stack_index ?? Number.MAX_SAFE_INTEGER) - (b?.stack_index ?? Number.MAX_SAFE_INTEGER);
    });
    const newGroup: ReplaceGroup = {
      name: editor.groupName.trim(),
      region: editor.selection ?? { x: 0, y: 0, width: 0, height: 0 },
      layer_rules: selectedIdsSorted.map((id) => ({ layer_id: id, action: "replace" as const })),
    };
    updateEditor((prev) => ({
      ...prev,
      groups: [...prev.groups, newGroup],
      groupName: "",
      selectedIds: [],
      selection: null,
    }));
  }

  function deleteGroup(name: string) {
    updateEditor((prev) => ({
      ...prev,
      groups: prev.groups.filter((g) => g.name !== name),
    }));
  }

  async function fetchJobStatus(currentJobId: string) {
    try {
      const status = await getJob(currentJobId);
      setJobInfo(status);
      if (status.status === "completed") {
        setJobUiStatus("completed");
        if (pollingTimerRef.current !== null) {
          window.clearInterval(pollingTimerRef.current);
          pollingTimerRef.current = null;
        }
        return;
      }
      if (status.status === "failed") {
        setJobUiStatus("failed");
        if (pollingTimerRef.current !== null) {
          window.clearInterval(pollingTimerRef.current);
          pollingTimerRef.current = null;
        }
        return;
      }
      setJobUiStatus("generating");
    } catch (error) {
      setJobUiStatus("failed");
      setErrorText(getErrorMessage(error));
      if (pollingTimerRef.current !== null) {
        window.clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    }
  }

  function startJobPolling(currentJobId: string) {
    if (pollingTimerRef.current !== null) window.clearInterval(pollingTimerRef.current);
    pollingTimerRef.current = window.setInterval(() => fetchJobStatus(currentJobId), 2000);
  }

  async function onUploadTemplate(file: File) {
    setBusy(true);
    setErrorText("");
    setUploadProgress(0);
    try {
      const tpl = await uploadTemplate(file, (percent) => setUploadProgress(percent));
      const data = await getTemplateLayers(tpl.template_id);
      const defaultSelectedIds = data.layers
        .filter((layer: LayerNode) => isDefaultProductLayer(layer.name))
        .map((layer: LayerNode) => layer.id);
      setTemplate(data.template);
      setLayers(data.layers);

      const savedGroupsData = await getGroups(tpl.template_id);
      const savedGroups = savedGroupsData.groups || [];

      setHistory({
        past: [],
        present: cloneEditor({ ...EMPTY_EDITOR, selectedIds: defaultSelectedIds, groups: savedGroups }),
        future: [],
      });
      setJobId("");
      setJobInfo(null);
      setJobUiStatus("idle");
      if (pollingTimerRef.current !== null) {
        window.clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
      setUploadProgress(100);
      return data.template as TemplateData;
    } catch (error) {
      setErrorText(getErrorMessage(error));
      setUploadProgress(0);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function onSaveGroups() {
    if (!template) return;
    setBusy(true);
    try {
      await saveGroups(template.id, editor.groups);
    } catch (error) {
      setErrorText(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function onImportExcel(file: File) {
    if (!template) return null;
    try {
      const result = await importExcel(template.id, file);
      return result;
    } catch (error) {
      setErrorText(getErrorMessage(error));
      return null;
    }
  }

  async function onUploadAssets(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      await uploadAssets(Array.from(files));
    } catch (error) {
      setErrorText(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function onRunJob(file: File) {
    if (!template) return;
    setErrorText("");
    setJobUiStatus("generating");
    try {
      const result = await createJob(template.id, file);
      setJobId(result.job_id);
      await fetchJobStatus(result.job_id);
      startJobPolling(result.job_id);
    } catch (error) {
      setJobUiStatus("failed");
      setErrorText(getErrorMessage(error));
    }
  }

  async function onRefreshJob() {
    if (!jobId) return;
    await fetchJobStatus(jobId);
  }

  async function onExportPsd() {
    if (!jobId) return;
    try {
      const result = await exportPsd(jobId);
      window.alert(result.message || "PSD 导出接口已调用");
    } catch (error) {
      setErrorText(getErrorMessage(error));
    }
  }

  return (
    <WorkflowContext.Provider
      value={{
        template,
        layers,
        history,
        editor,
        busy,
        uploadProgress,
        errorText,
        jobId,
        jobInfo,
        jobUiStatus,
        setErrorText,
        updateEditor,
        undo,
        redo,
        toggleLayer,
        removeSelectedLayer,
        createGroupFromSelection,
        deleteGroup,
        onUploadTemplate,
        onSaveGroups,
        onImportExcel,
        onUploadAssets,
        onRunJob,
        onRefreshJob,
        onExportPsd,
      }}
    >
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflow() {
  const ctx = useContext(WorkflowContext);
  if (!ctx) throw new Error("useWorkflow must be used inside WorkflowProvider");
  return ctx;
}
