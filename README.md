# Main Image Studio

主图编辑统一主应用。

这个仓库把两条原本分散的能力收敛到一个项目内：

- 聊天式主图编辑
- PSD / PSB 批量工作流

当前目标不是直接做完整生产系统，而是先提供一个单机可跑、结构清晰、便于继续迭代的统一应用。

## 项目概览

当前应用由两个部分组成：

- `frontend/`
  - `React + Vite + TypeScript`
  - 提供统一首页、聊天模式、批量模式入口、PSD 工作流页面
- `backend/`
  - `FastAPI + SQLite + 本地文件存储`
  - 提供聊天会话、素材库、PSD 工作流、静态文件访问

### 当前已接入的能力

- 聊天模式
  - 支持创建会话
  - 支持上传图片到素材库
  - 支持在聊天中选取素材并发起生成
  - 支持把生成结果自动写回素材库
  - 支持保存上一轮摘要并参与下一轮生成
- PSD / PSB 工作流
  - 支持上传 PSD / PSB 模板
  - 支持读取图层
  - 支持配置替换组
  - 支持 Excel 导入导出
  - 支持批量任务生成与结果导出
- 统一主应用壳
  - 首页集中展示两种模式和技术路径
  - 批量模式与聊天模式通过统一视觉壳承载
  - 素材库作为跨模式共享基础能力

## 目录结构

```text
main_image_project/
├── backend/
│   ├── .env
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── db.py
│   │   ├── routers/
│   │   ├── services/
│   │   └── schemas.py
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── api.ts
│   │   ├── App.tsx
│   │   └── styles.css
│   ├── package.json
│   └── vite.config.ts
├── plan/
├── skills/
├── AGENTS.md
└── README.md
```

## 页面与路由

前端主要路由如下：

- `/`
  - 首页
  - 展示项目定位、模式入口、技术路径
- `/chat`
  - 聊天模式
  - 图片上传、素材选择、发送生成、结果预览
- `/batch`
  - 批量模式入口
  - 输入类型分流与能力边界说明
- `/psd`
  - PSD / PSB 模板上传入口
- `/psd/groups`
  - 替换组配置页
- `/psd/generate`
  - Excel 导入、批量生成、结果导出页

## 后端接口概览

### 公共

- `GET /api/health`
- `GET /api/config`

### 聊天

- `POST /api/chat/sessions`
- `GET /api/chat/sessions`
- `GET /api/chat/sessions/{session_id}`
- `GET /api/chat/sessions/{session_id}/messages`
- `POST /api/chat/sessions/{session_id}/generate`

### 素材库

- `POST /api/library/assets/upload`
- `GET /api/library/assets`
- `GET /api/library/assets/{asset_id}`
- `GET /api/library/assets/{asset_id}/file`

### PSD 工作流

- `POST /api/psd/templates/upload`
- `GET /api/psd/templates/{template_id}/layers`
- `POST /api/psd/templates/{template_id}/groups`
- `GET /api/psd/templates/{template_id}/groups`
- `POST /api/psd/templates/{template_id}/groups/preview`
- `GET /api/psd/templates/{template_id}/excel/export`
- `POST /api/psd/templates/{template_id}/excel/import`
- `POST /api/psd/assets/upload`
- `POST /api/psd/jobs/generate/{template_id}`
- `GET /api/psd/jobs/{job_id}`
- `GET /api/psd/jobs/{job_id}/images`
- `GET /api/psd/jobs/{job_id}/download`
- `POST /api/psd/jobs/{job_id}/export-psd`

## 环境要求

建议环境：

- Python `3.12`
- Node.js `18+`
- npm `9+`

系统依赖说明：

- `onnxruntime` 和 `rembg` 用于抠图链路
- `psd-tools` 用于 PSD / PSB 解析

## 环境变量

后端会自动读取 `backend/.env`，不需要再手动 `source`。

推荐配置如下：

```env
IMAGE_API_KEY=your_api_key
IMAGE_API_BASE_URL=https://your-api-host
IMAGE_MODEL=nano-banana
```

兼容旧字段：

- `IMAGE_API_BASE_URL` 兼容 `BASE_URL`
- `IMAGE_API_KEY` 兼容 `API_KEY`
- `IMAGE_API_KEY` 兼容 `NANO_BANANA`

如果同名系统环境变量存在，系统环境变量优先于 `.env`。

## 完整启动方式

### 1. 启动后端

```bash
cd /home/sam/code/main_image_project/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

后端启动后默认地址：

- `http://127.0.0.1:8000`

### 2. 启动前端

如果你已经安装过依赖：

```bash
cd /home/sam/code/main_image_project/frontend
npm run dev
```

如果你还没有安装依赖：

```bash
cd /home/sam/code/main_image_project/frontend
npm install
npm run dev
```

前端默认地址：

- `http://127.0.0.1:5173`

### 3. 访问应用

打开：

- `http://127.0.0.1:5173`

建议验证顺序：

1. 先进入首页，确认统一入口和模式卡正常显示
2. 进入聊天模式，上传图片并尝试生成
3. 进入批量模式，上传 PSD / PSB 模板

## 开发验证

### 后端测试

```bash
cd /home/sam/code/main_image_project/backend
python3 -m unittest discover -s tests -v
```

### 前端构建

```bash
cd /home/sam/code/main_image_project/frontend
npm run build
```

## 数据与存储

后端运行后会自动创建以下目录：

- `backend/data/`
  - SQLite 数据库
- `backend/storage/library/`
  - 素材库文件
- `backend/storage/chat/`
  - 聊天生成中间文件和结果
- `backend/storage/psd/templates/`
  - PSD / PSB 模板文件
- `backend/storage/psd/previews/`
  - 预览图
- `backend/storage/psd/assets/`
  - 批量模式素材
- `backend/storage/psd/outputs/`
  - 批量导出结果

## 当前限制

- 聊天模式虽然已经接入真实生成链路，但是否能成功生成仍取决于你在 `backend/.env` 中配置的图像接口是否可用
- 前端当前优先保证桌面端体验，没有完整补齐响应式适配
- 前端生产构建目前存在一个较大的主包体积警告，后续可做拆包优化
- PSD 工作流已迁入统一项目，但交互层仍主要沿用原有能力，不是全新重构版本

## 常见问题

### 1. 后端启动了，但聊天生成失败

优先检查：

- `backend/.env` 是否存在
- `IMAGE_API_KEY` 是否正确
- `IMAGE_API_BASE_URL` 是否正确
- 后端日志里是否有外部接口报错

### 2. 前端打不开结果图

优先检查：

- 后端是否还在运行
- 是否能访问 `http://127.0.0.1:8000/api/health`
- 浏览器控制台是否有静态资源 404

### 3. PSD 上传失败

优先检查：

- 文件扩展名是否为 `.psd` 或 `.psb`
- 后端依赖是否安装完整
- 是否存在 `psd-tools` 相关解析错误

## 规划文档

当前仓库中已有的规划文档位于 `plan/`：

- 前端设计方案
- 前端实施计划
- 后端 MVP 方案

这些文档用于保留决策背景；实际代码以当前仓库实现为准。
