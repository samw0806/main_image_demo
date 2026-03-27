import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  type ChatMessage,
  type LibraryAsset,
  createChatSession,
  generateChatReply,
  getChatMessages,
  getErrorMessage,
  listLibraryAssets,
  uploadLibraryAssets,
} from "../api";
import { usePlatform } from "../platform-context";

function fileLabel(asset: LibraryAsset) {
  return asset.source_type === "generated" ? "生成结果" : "上传素材";
}

function toUnifiedAsset(asset: LibraryAsset) {
  return {
    id: asset.id,
    name: asset.filename,
    kind: "image" as const,
    source: asset.source_type === "generated" ? ("chat_generated" as const) : ("upload" as const),
    createdAt: asset.created_at,
    previewUrl: asset.file_url,
    href: "/app/library",
  };
}

export default function ChatPage() {
  const { prependActivity, upsertAssets } = usePlatform();
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [assets, setAssets] = useState<LibraryAsset[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<LibraryAsset[]>([]);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<LibraryAsset | null>(null);
  const [psdNoticeOpen, setPsdNoticeOpen] = useState(false);
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

  useEffect(() => {
    async function bootstrap() {
      try {
        const [session, library] = await Promise.all([createChatSession(), listLibraryAssets()]);
        setSessionId(session.id);
        setAssets(library.items);
      } catch (error) {
        setErrorText(getErrorMessage(error));
      }
    }
    void bootstrap();
  }, []);

  async function refreshMessages(nextSessionId: string) {
    const data = await getChatMessages(nextSessionId);
    setMessages(data.items);
  }

  async function refreshAssets() {
    const library = await listLibraryAssets();
    setAssets(library.items);
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    if (list.some((file) => /\.(psd|psb)$/i.test(file.name))) {
      setPsdNoticeOpen(true);
      return;
    }
    try {
      const result = await uploadLibraryAssets(list);
      setSelectedAssets((current) => [...current, ...result.items]);
      upsertAssets(result.items.map(toUnifiedAsset));
      prependActivity({
        id: `upload-${Date.now()}`,
        kind: "upload",
        title: `新增 ${result.items.length} 项上传素材`,
        detail: "聊天作图上传的图片已自动进入素材库。",
        at: new Date().toISOString(),
        status: "success",
        href: "/app/library",
      });
      await refreshAssets();
    } catch (error) {
      setErrorText(getErrorMessage(error));
    }
  }

  async function handleSend() {
    if (!sessionId || (!prompt.trim() && selectedAssets.length === 0)) return;
    setIsGenerating(true);
    setErrorText("");
    try {
      const response = await generateChatReply(
        sessionId,
        prompt.trim(),
        selectedAssets.map((asset) => asset.id),
      );
      setMessages((current) => [...current, response.user, response.assistant]);
      setPrompt("");
      setSelectedAssets(response.assets);
      upsertAssets(response.assets.map(toUnifiedAsset));
      prependActivity({
        id: `chat-${response.assistant.id}`,
        kind: "chat",
        title: "聊天作图已完成一轮生成",
        detail: response.assistant.summary || "系统已返回新的主图结果。",
        at: response.assistant.created_at,
        status: "success",
        href: "/app/chat",
      });
      await refreshMessages(sessionId);
      await refreshAssets();
    } catch (error) {
      setErrorText(getErrorMessage(error));
    } finally {
      setIsGenerating(false);
    }
  }

  function toggleAsset(asset: LibraryAsset) {
    setSelectedAssets((current) => {
      const exists = current.some((item) => item.id === asset.id);
      if (exists) {
        return current.filter((item) => item.id !== asset.id);
      }
      return [...current, asset];
    });
  }

  return (
    <div className="shell shell--compact shell--chat">
      <header className="shell__header">
        <div>
          <div className="shell__eyebrow">Chat Workflow</div>
          <h1 className="shell__title">聊天作图</h1>
          <p className="shell__description">
            通过自然语言和参考素材持续生成主图，上传图片后会自动沉淀到统一素材库中。
          </p>
        </div>
        <div className="shell__actions">
          <button className="btn btn--secondary" onClick={() => setLibraryOpen(true)}>
            打开素材库
          </button>
          <Link className="btn btn--ghost" to="/app">
            返回 Dashboard
          </Link>
        </div>
      </header>

      <main className="chat-layout" id="main-content">
        <section className="chat-stream panel">
          <div className="panel__header">
            <div>
              <div className="panel__eyebrow">会话流</div>
              <h2>{messages.length > 0 ? "当前作图会话" : "开始一段新的聊天作图会话"}</h2>
            </div>
            <p className="panel__sub">
              {lastMessage?.summary
                ? `本轮将基于上一轮摘要继续生成：${lastMessage.summary}`
                : "上传图片并输入要求后，即可触发新的主图生成。"}
            </p>
          </div>

          {errorText ? <div className="error-banner" role="alert">{errorText}</div> : null}

          <div className="message-list">
            {messages.length === 0 ? (
              <div className="empty-card">
                <strong>欢迎进入聊天作图</strong>
                <p>建议先上传底图与参考商品图，再用一句要求描述你想要的主图效果。</p>
                <ul className="empty-card__list">
                  <li>先附加需要参与本轮生成的图片素材</li>
                  <li>再用一句自然语言描述要修改的重点</li>
                  <li>生成结果会自动沉淀到素材库并继续回填到下一轮对话</li>
                </ul>
              </div>
            ) : (
              messages.map((message) => (
                <article className={`message-card message-card--${message.role}`} key={message.id}>
                  <div className="message-card__head">
                    <strong>{message.role === "user" ? "你" : "系统"}</strong>
                    {message.summary ? <span>{message.summary}</span> : null}
                  </div>
                  <p>{message.content}</p>
                  {message.assets.length > 0 ? (
                    <div className="thumb-row">
                      {message.assets.map((asset) => (
                        <button
                          className="thumb-chip"
                          key={asset.id}
                          onClick={() => setPreviewAsset(asset)}
                          type="button"
                        >
                          <img src={asset.file_url} alt={asset.filename} />
                          <span>{asset.filename}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))
            )}

            {isGenerating ? (
              <article className="message-card message-card--assistant">
                <div className="message-card__head">
                  <strong>系统</strong>
                  <span>处理中</span>
                </div>
                <p>正在整理提示词与素材，等待图像结果返回。</p>
              </article>
            ) : null}
          </div>
        </section>

        <section className="composer panel">
          <div className="panel__header">
            <div>
              <div className="panel__eyebrow">输入区</div>
              <h2>提交这一轮作图要求</h2>
            </div>
            <p className="panel__sub">只保留本轮必要信息，让系统更快理解你要改什么。</p>
          </div>

          <div className="selection-strip">
            {selectedAssets.length === 0 ? (
              <span className="muted">尚未附加素材</span>
            ) : (
              selectedAssets.map((asset) => (
                <button
                  className="asset-pill"
                  key={asset.id}
                  onClick={() => toggleAsset(asset)}
                  type="button"
                >
                  <span>{asset.filename}</span>
                  <em>{fileLabel(asset)}</em>
                </button>
              ))
            )}
          </div>

          <div className="composer__label">编辑要求</div>
          <textarea
            className="chat-textarea"
            aria-label="编辑要求"
            placeholder="例如：保留原图构图，把右侧商品换成参考图中的款式，整体更干净。"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />

          <div className="composer__actions">
            <label className="btn btn--secondary">
              上传图片
              <input multiple type="file" accept="image/*" onChange={(event) => handleUpload(event.target.files)} />
            </label>
            <button className="btn btn--secondary" onClick={() => setLibraryOpen(true)}>
              从素材库选择
            </button>
            <button className="btn btn--primary" disabled={isGenerating || (!prompt.trim() && selectedAssets.length === 0)} onClick={handleSend}>
              发送并生成
            </button>
          </div>
        </section>
      </main>

      <aside className={`drawer${libraryOpen ? " drawer--open" : ""}`}>
        <div className="drawer__panel">
          <div className="drawer__header">
            <div>
              <div className="panel__eyebrow">历史素材</div>
              <h3>跨模式共享素材库</h3>
            </div>
            <button className="btn btn--ghost btn--sm" onClick={() => setLibraryOpen(false)}>
              关闭
            </button>
          </div>
          <div className="library-grid">
            {assets.map((asset) => {
              const active = selectedAssets.some((item) => item.id === asset.id);
              return (
                <button
                  className={`library-card${active ? " library-card--active" : ""}`}
                  key={asset.id}
                  onClick={() => toggleAsset(asset)}
                  type="button"
                >
                  <img src={asset.file_url} alt={asset.filename} />
                  <strong>{asset.filename}</strong>
                  <span>{fileLabel(asset)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {previewAsset ? (
        <div className="preview-modal" onClick={() => setPreviewAsset(null)}>
          <div className="preview-modal__card" onClick={(event) => event.stopPropagation()}>
            <img src={previewAsset.file_url} alt={previewAsset.filename} />
            <div className="preview-modal__actions">
              <button className="btn btn--secondary" onClick={() => toggleAsset(previewAsset)}>
                添加到聊天框
              </button>
              <a className="btn btn--secondary" href={previewAsset.file_url} target="_blank" rel="noreferrer">
                保存
              </a>
              <button className="btn btn--ghost" onClick={() => setPreviewAsset(null)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {psdNoticeOpen ? (
        <div className="preview-modal" onClick={() => setPsdNoticeOpen(false)}>
          <div className="preview-modal__card preview-modal__card--notice" onClick={(event) => event.stopPropagation()}>
            <h3>暂不支持该文件类型</h3>
            <p>聊天作图当前只支持普通图片上传。若要处理 PSD / PSB 模板，请前往批量作图。</p>
            <div className="preview-modal__actions">
              <button className="btn btn--secondary" onClick={() => setPsdNoticeOpen(false)}>
                我知道了
              </button>
              <Link className="btn btn--primary" to="/app/batch">
                前往批量作图
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
