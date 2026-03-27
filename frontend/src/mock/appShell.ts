export type TrialUser = {
  id: string;
  name: string;
  email: string;
  initials: string;
};

export type TrialSession = {
  user: TrialUser;
};

export type TrialPlan = {
  name: "免费内部试用";
  quotaUsed: number;
  quotaTotal: number;
  resetsAt: string;
};

export type AppActivity = {
  id: string;
  kind: "chat" | "batch" | "upload";
  title: string;
  detail: string;
  at: string;
  status?: "success" | "running" | "failed";
  href?: string;
};

export type UnifiedAsset = {
  id: string;
  name: string;
  kind: "image" | "psd" | "psb";
  source: "upload" | "chat_generated" | "batch_generated" | "template";
  createdAt: string;
  previewUrl: string;
  href?: string;
};

export const trialUser: TrialUser = {
  id: "trial-user-1",
  name: "内部试用账号",
  email: "trial@main-image.studio",
  initials: "MI",
};

export const initialPlan: TrialPlan = {
  name: "免费内部试用",
  quotaUsed: 72,
  quotaTotal: 200,
  resetsAt: "2026-04-01T00:00:00+08:00",
};

export const initialActivities: AppActivity[] = [
  {
    id: "act-chat-1",
    kind: "chat",
    title: "聊天作图已完成一张主图",
    detail: "保留构图并替换商品后返回结果图",
    at: "2026-03-27T10:20:00+08:00",
    status: "success",
    href: "/app/chat",
  },
  {
    id: "act-batch-1",
    kind: "batch",
    title: "批量任务生成中",
    detail: "模板 banner_v4.psd 正在处理 18 行映射数据",
    at: "2026-03-27T09:40:00+08:00",
    status: "running",
    href: "/app/batch/generate",
  },
  {
    id: "act-upload-1",
    kind: "upload",
    title: "新增素材已上传",
    detail: "3 张商品图已加入素材库",
    at: "2026-03-27T08:55:00+08:00",
    status: "success",
    href: "/app/library",
  },
];

export const initialAssets: UnifiedAsset[] = [
  {
    id: "asset-image-1",
    name: "summer-bottle.png",
    kind: "image",
    source: "upload",
    createdAt: "2026-03-27T08:55:00+08:00",
    previewUrl: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80",
    href: "/app/library",
  },
  {
    id: "asset-psd-1",
    name: "banner_v4.psd",
    kind: "psd",
    source: "template",
    createdAt: "2026-03-27T09:12:00+08:00",
    previewUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=80",
    href: "/app/batch/template",
  },
  {
    id: "asset-image-2",
    name: "chat-result-0327.png",
    kind: "image",
    source: "chat_generated",
    createdAt: "2026-03-27T10:20:00+08:00",
    previewUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80",
    href: "/app/chat",
  },
];

