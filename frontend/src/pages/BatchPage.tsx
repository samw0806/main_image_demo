import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function BatchPage() {
  const imageRef = useRef<HTMLInputElement>(null);
  const psdRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [notice, setNotice] = useState("");
  const [selectedFile, setSelectedFile] = useState<string>("");

  const subtitle = useMemo(() => {
    if (!selectedFile) return "当前批量作图仅支持 PSD / PSB 模板工作流。";
    return `已选择模板：${selectedFile}`;
  }, [selectedFile]);

  function handleUnsupportedImage() {
    setNotice("暂不支持，请前往聊天作图。批量作图当前只接受 PSD / PSB 模板。");
  }

  function handlePsdFile(file: File | null) {
    if (!file) return;
    setSelectedFile(file.name);
    navigate("/app/batch/template");
  }

  return (
    <div className="shell shell--compact">
      <header className="shell__header">
        <div>
          <div className="shell__eyebrow">Batch Workflow</div>
          <h1 className="shell__title">批量作图</h1>
          <p className="shell__description">
            围绕 PSD / PSB 模板完成结构化批量出图。普通单图编辑请前往聊天作图。
          </p>
        </div>
        <Link className="btn btn--secondary" to="/app">
          返回 Dashboard
        </Link>
      </header>

      <main className="batch-layout" id="main-content">
        <section className="panel panel--summary">
          <div className="panel__header">
            <div>
              <div className="panel__eyebrow">模板入口</div>
              <h2>上传 PSD / PSB 模板并进入批量流程</h2>
            </div>
            <p className="panel__sub">{subtitle}</p>
          </div>
          <div className="batch-choice-grid">
            <article className="mode-card mode-card--compact mode-card--featured">
              <div className="mode-card__tag">主入口</div>
              <h3>上传 PSD / PSB</h3>
              <p>进入模板解析、替换组配置、Excel 映射和批量生成工作流。</p>
              <button className="btn btn--primary" onClick={() => psdRef.current?.click()}>
                选择模板文件
              </button>
              <input
                ref={psdRef}
                type="file"
                accept=".psd,.psb"
                hidden
                onChange={(event) => handlePsdFile(event.target.files?.[0] ?? null)}
              />
            </article>

            <article className="mode-card mode-card--compact mode-card--muted">
              <div className="mode-card__tag">能力边界</div>
              <h3>普通图片暂不支持</h3>
              <p>单图创作请使用聊天作图。当前批量作图只接受 PSD / PSB 模板。</p>
              <button className="btn btn--secondary" onClick={() => imageRef.current?.click()}>
                尝试上传图片
              </button>
              <input
                ref={imageRef}
                type="file"
                accept="image/*"
                hidden
                onChange={() => handleUnsupportedImage()}
              />
            </article>

            <article className="mode-card mode-card--compact mode-card--bridge">
              <div className="mode-card__tag">辅助入口</div>
              <h3>转到聊天作图</h3>
              <p>如果你当前处理的是普通图片而不是模板，请直接前往聊天作图。</p>
              <Link className="btn btn--secondary" to="/app/chat">
                前往聊天作图
              </Link>
            </article>
          </div>
        </section>

        {notice ? (
          <section className="panel panel--notice panel--warning">
            <strong>当前能力边界</strong>
            <p>{notice}</p>
          </section>
        ) : null}
      </main>
    </div>
  );
}
