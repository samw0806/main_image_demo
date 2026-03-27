import axios from "axios";
import { flushSync } from "react-dom";
import type { ReplaceGroup } from "./types";

const api = axios.create({
  baseURL: "http://127.0.0.1:8000",
  timeout: 1000 * 60 * 10,
});

export type LibraryAsset = {
  id: string;
  filename: string;
  source_type: string;
  session_id: string | null;
  file_path: string;
  mime_type: string;
  created_at: string;
  file_url: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  summary: string | null;
  created_at: string;
  assets: LibraryAsset[];
};

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }
    return error.message || "请求失败";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "未知错误";
}

export async function getPublicConfig() {
  const res = await api.get("/api/config");
  return res.data;
}

export async function createChatSession(title?: string) {
  const res = await api.post("/api/chat/sessions", { title: title || null });
  return res.data as { id: string; title: string; last_summary: string | null };
}

export async function getChatMessages(sessionId: string) {
  const res = await api.get(`/api/chat/sessions/${sessionId}/messages`);
  return res.data as { items: ChatMessage[] };
}

export async function generateChatReply(sessionId: string, prompt: string, assetIds: string[]) {
  const res = await api.post(`/api/chat/sessions/${sessionId}/generate`, {
    prompt,
    asset_ids: assetIds,
  });
  return res.data as {
    user: ChatMessage;
    assistant: ChatMessage;
    assets: LibraryAsset[];
  };
}

export async function uploadLibraryAssets(files: File[]) {
  const fd = new FormData();
  files.forEach((f) => fd.append("files", f));
  const res = await api.post("/api/library/assets/upload", fd);
  return res.data as { count: number; items: LibraryAsset[] };
}

export async function listLibraryAssets() {
  const res = await api.get("/api/library/assets");
  return res.data as { items: LibraryAsset[] };
}

export async function uploadTemplate(file: File, onProgress?: (percent: number) => void) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await api.post("/api/psd/templates/upload", fd, {
    onUploadProgress: (event) => {
      if (!onProgress || !event.total) return;
      const percent = Math.min(99, Math.round((event.loaded / event.total) * 100));
      flushSync(() => onProgress(percent));
    },
  });
  return res.data;
}

export async function getTemplateLayers(templateId: string) {
  const res = await api.get(`/api/psd/templates/${templateId}/layers`);
  return res.data;
}

export async function saveGroups(templateId: string, groups: ReplaceGroup[]) {
  const res = await api.post(`/api/psd/templates/${templateId}/groups`, { groups });
  return res.data;
}

export async function getGroups(templateId: string) {
  const res = await api.get(`/api/psd/templates/${templateId}/groups`);
  return res.data;
}

export type GroupPreviewResponse = {
  preview_url: string;
  requested_count: number;
  matched_count: number;
  unmatched_layer_ids: string[];
  composite_meta: Record<string, unknown>;
};

export async function previewGroup(templateId: string, layerIds: string[]): Promise<GroupPreviewResponse> {
  const res = await api.post(`/api/psd/templates/${templateId}/groups/preview`, {
    layer_ids: layerIds,
  });
  return res.data;
}

export function getExcelExportUrl(templateId: string, filename?: string) {
  const url = `${api.defaults.baseURL}/api/psd/templates/${templateId}/excel/export`;
  if (filename) {
    return `${url}?filename=${encodeURIComponent(filename)}`;
  }
  return url;
}

export async function importExcel(templateId: string, file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await api.post(`/api/psd/templates/${templateId}/excel/import`, fd);
  return res.data;
}

export async function uploadAssets(files: File[]) {
  const fd = new FormData();
  files.forEach((f) => fd.append("files", f));
  const res = await api.post("/api/psd/assets/upload", fd);
  return res.data;
}

export async function createJob(templateId: string, excelFile: File) {
  const fd = new FormData();
  fd.append("excel", excelFile);
  const res = await api.post(`/api/psd/jobs/generate/${templateId}`, fd);
  return res.data;
}

export async function getJob(jobId: string) {
  const res = await api.get(`/api/psd/jobs/${jobId}`);
  return res.data;
}

export function getJobDownloadUrl(jobId: string) {
  return `${api.defaults.baseURL}/api/psd/jobs/${jobId}/download`;
}

export async function exportPsd(jobId: string) {
  const res = await api.post(`/api/psd/jobs/${jobId}/export-psd`);
  return res.data;
}

export async function listJobImages(jobId: string): Promise<string[]> {
  const res = await api.get(`/api/psd/jobs/${jobId}/images`);
  return res.data;
}

export function getJobImageUrl(jobId: string, filename: string) {
  return `${api.defaults.baseURL}/api/psd/jobs/${jobId}/images/${encodeURIComponent(filename)}`;
}
