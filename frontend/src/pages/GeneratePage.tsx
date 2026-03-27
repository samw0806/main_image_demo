import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import StepNav from "../components/StepNav";
import { useWorkflow } from "../context";
import { getJobDownloadUrl, getJobImageUrl, listJobImages } from "../api";
import { usePlatform } from "../platform-context";

export default function GeneratePage() {
  const navigate = useNavigate();
  const { prependActivity, recordGeneratedAssets } = usePlatform();
  const {
    template, jobUiStatus, jobInfo, jobId,
    onRunJob, onExportPsd, onRefreshJob,
    errorText, setErrorText,
  } = useWorkflow();

  const [excelDragOver, setExcelDragOver] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  if (!template) {
    navigate("/app/batch/template");
    return null;
  }

  useEffect(() => {
    if (jobUiStatus === "completed" && jobId) {
      listJobImages(jobId)
        .then((names) => {
          setImages(names);
          recordGeneratedAssets(
            names.map((name) => ({
              id: `batch-generated-${jobId}-${name}`,
              name,
              kind: "image",
              source: "batch_generated",
              createdAt: new Date().toISOString(),
              previewUrl: getJobImageUrl(jobId, name),
              href: "/app/batch/generate",
            })),
          );
          prependActivity({
            id: `batch-job-${jobId}`,
            kind: "batch",
            title: "批量作图已完成",
            detail: `当前任务已生成 ${names.length} 张结果图。`,
            at: new Date().toISOString(),
            status: "success",
            href: "/app/history",
          });
        })
        .catch(() => {});
    }
  }, [jobUiStatus, jobId, prependActivity, recordGeneratedAssets]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightbox(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function handleExcelFile(file: File) {
    await onRunJob(file);
  }

  const progress = jobInfo ? Math.round((jobInfo.progress ?? 0) * 100) : 0;
  const logs: string[] = jobInfo?.logs ?? [];

  const isGenerating = jobUiStatus === "generating";
  const isDone = jobUiStatus === "completed";
  const isFailed = jobUiStatus === "failed";
  const isIdle = jobUiStatus === "idle";

  return (
    <div className="workflow-page">
      <StepNav current={2} />
      <div className="page-content">
        {!!errorText && (
          <div className="workflow-page__body" style={{ paddingBottom: 0 }}>
            <div className="error-banner" role="alert">
              <span>{errorText}</span>
              <button className="btn btn--ghost btn--sm" onClick={() => setErrorText("")}>关闭</button>
            </div>
          </div>
        )}

        <div className="workflow-page__body" id="main-content">
          <section className="workflow-page__panel">
            <div className="workflow-page__header">
              <div>
                <div className="workflow-page__eyebrow">生成导出</div>
                <h1 className="workflow-page__title">生成主图</h1>
                <p className="workflow-page__lead">
                  上传已经填写商品映射的 Excel 文件，查看生成进度并在完成后统一下载结果与导出 PSD。
                </p>
              </div>
            </div>
          </section>

          <div className="generate-page">
            {(isIdle || isGenerating || isFailed) && (
              <div className="generate-page__upload">
                {(isIdle || isFailed) && (
                  <div
                    className={`upload-dropzone${excelDragOver ? " upload-dropzone--drag-over" : ""}`}
                    style={{ maxWidth: 480 }}
                    onClick={() => excelInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setExcelDragOver(true); }}
                    onDragLeave={() => setExcelDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setExcelDragOver(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleExcelFile(file);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        excelInputRef.current?.click();
                      }
                    }}
                  >
                    <div className="upload-dropzone__icon" aria-hidden="true" />
                    <div className="upload-dropzone__text">
                      {isFailed ? "重新上传 Excel 并生成" : "点击或拖拽上传 Excel"}
                    </div>
                    <div className="upload-dropzone__hint">.xlsx 格式，包含商品映射数据</div>
                    <input
                      ref={excelInputRef}
                      type="file"
                      accept=".xlsx"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleExcelFile(file);
                        e.target.value = "";
                      }}
                    />
                  </div>
                )}

                {isGenerating && (
                  <div className="generate-page__progress" aria-live="polite">
                    <div className="gen-progress__label">
                      <span>正在生成…</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="gen-progress__bar-wrap">
                      <div className="gen-progress__bar" style={{ width: `${progress}%` }} />
                    </div>
                    {logs.length > 0 && (
                      <div className="gen-progress__logs">
                        {logs.slice(-10).map((log, i) => (
                          <div key={i}>{log}</div>
                        ))}
                      </div>
                    )}
                    <button className="btn btn--ghost btn--sm" onClick={onRefreshJob}>
                      手动刷新
                    </button>
                  </div>
                )}
              </div>
            )}

            {isDone && (
              <div className="generate-page__results">
                <div className="generate-page__results-header">
                  <div className="generate-page__results-title">
                    生成完成，共 {images.length} 张图片
                  </div>
                  <div className="generate-page__results-actions">
                    <button className="btn btn--secondary btn--sm" onClick={onExportPsd}>
                      导出 PSD
                    </button>
                    <a
                      className="btn btn--primary btn--sm"
                      href={getJobDownloadUrl(jobId)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      下载 PNG 压缩包
                    </a>
                  </div>
                </div>

                <div className="png-grid">
                  {images.map((name) => {
                    const url = getJobImageUrl(jobId, name);
                    return (
                      <div
                        key={name}
                        className="png-thumb"
                        onClick={() => setLightbox(url)}
                        title={name}
                      >
                        <img src={url} alt={name} loading="lazy" />
                      </div>
                    );
                  })}
                  {images.length === 0 && (
                    <div className="png-grid__empty" style={{ gridColumn: "1/-1", padding: "20px 0" }}>
                      暂无图片，请确认任务已完成
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <button className="lightbox__close" onClick={() => setLightbox(null)}>✕</button>
          <img
            className="lightbox__img"
            src={lightbox}
            alt=""
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
