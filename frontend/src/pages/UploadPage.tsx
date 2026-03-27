import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import StepNav from "../components/StepNav";
import { useWorkflow } from "../context";
import { usePlatform } from "../platform-context";

export default function UploadPage() {
  const { prependActivity, recordTemplateAsset } = usePlatform();
  const { onUploadTemplate, busy, uploadProgress, errorText, setErrorText } = useWorkflow();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File) {
    if (!file.name.match(/\.(psd|psb)$/i)) {
      setErrorText("请上传 .psd 或 .psb 文件");
      return;
    }
    setErrorText("");
    const template = await onUploadTemplate(file);
    if (!template) return;
    recordTemplateAsset({
      id: `template-${template.id}`,
      name: file.name,
      kind: file.name.toLowerCase().endsWith(".psb") ? "psb" : "psd",
      source: "template",
      createdAt: new Date().toISOString(),
      previewUrl: `http://127.0.0.1:8000${template.preview_url}`,
      href: "/app/batch/template",
    });
    prependActivity({
      id: `batch-template-${template.id}`,
      kind: "batch",
      title: "模板已进入批量作图流程",
      detail: `${file.name} 已上传，可继续配置替换组。`,
      at: new Date().toISOString(),
      status: "success",
      href: "/app/batch/groups",
    });
    navigate("/app/batch/groups");
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  return (
    <div className="workflow-page">
      <StepNav current={0} />
      <div className="page-content">
        {busy && (
          <div className="progress-wrap">
            <div className="progress-bar" style={{ width: `${uploadProgress}%` }} />
          </div>
        )}
        {!!errorText && (
          <div className="workflow-page__body" style={{ paddingBottom: 0 }}>
            <div className="error-banner" role="alert">
              <span>{errorText}</span>
              <button className="btn btn--ghost btn--sm" onClick={() => setErrorText("")}>
                关闭
              </button>
            </div>
          </div>
        )}
        <div className="workflow-page__body" id="main-content">
          <section className="workflow-page__panel">
            <div className="workflow-page__header">
              <div>
                <div className="workflow-page__eyebrow">模板上传</div>
                <h1 className="workflow-page__title">上传 PSD 模板</h1>
                <p className="workflow-page__lead">
                  这是批量工作流的正式入口。当前仅接受 `.psd` 和 `.psb` 模板文件，上传后会继续进入替换组配置步骤。
                </p>
              </div>
            </div>
          </section>

          <div className="upload-page">
            {busy ? (
              <div className="upload-progress" aria-live="polite">
                <div className="upload-progress__label">
                  {uploadProgress < 99
                    ? `正在上传…\u00a0${uploadProgress}%`
                    : "正在解析模板，请稍候…"}
                </div>
                <div className="upload-progress__bar-wrap">
                  <div className="upload-progress__bar" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            ) : (
              <div
                className={`upload-dropzone${dragOver ? " upload-dropzone--drag-over" : ""}`}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    inputRef.current?.click();
                  }
                }}
              >
                <div className="upload-dropzone__icon" aria-hidden="true" />
                <div className="upload-dropzone__text">点击选择文件，或拖拽到此处</div>
                <div className="upload-dropzone__hint">.psd / .psb，文件大小无限制</div>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".psd,.psb"
                  style={{ display: "none" }}
                  onChange={onInputChange}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
