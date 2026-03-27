import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import StepNav from "../components/StepNav";
import { useWorkflow } from "../context";

type Thumb = { name: string; url: string };
type ExcelCheck = {
  rows?: any[];
  missing_assets?: string[];
  unknown_groups?: string[];
};

export default function AssetsPage() {
  const navigate = useNavigate();
  const { template, onUploadAssets, onImportExcel, errorText, setErrorText, busy } = useWorkflow();

  const [thumbs, setThumbs] = useState<Thumb[]>([]);
  const [assetsDragOver, setAssetsDragOver] = useState(false);
  const [assetsUploaded, setAssetsUploaded] = useState(false);
  const [excelCheck, setExcelCheck] = useState<ExcelCheck | null>(null);
  const [excelDragOver, setExcelDragOver] = useState(false);

  const assetsInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  if (!template) {
    navigate("/psd");
    return null;
  }

  async function handleAssetsFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const newThumbs = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .map((f) => ({ name: f.name, url: URL.createObjectURL(f) }));
    setThumbs((prev) => [...prev, ...newThumbs]);
    await onUploadAssets(files);
    setAssetsUploaded(true);
  }

  async function handleExcelFile(file: File) {
    const result = await onImportExcel(file);
    if (result) setExcelCheck(result);
  }

  const missingCount = excelCheck?.missing_assets?.length ?? 0;
  const unknownCount = excelCheck?.unknown_groups?.length ?? 0;
  const checkOk = excelCheck && missingCount === 0 && unknownCount === 0;

  return (
    <>
      <StepNav current={2} />
      <div className="page-content">
        {!!errorText && (
          <div className="error-banner">
            <span>{errorText}</span>
            <button className="btn btn--ghost btn--sm" onClick={() => setErrorText("")}>✕</button>
          </div>
        )}

        <div className="assets-page">
          <div className="assets-page__row">
            {/* Left: upload assets */}
            <div className="assets-section">
              <div className="assets-section__title">商品图上传</div>
              <div className="assets-section__sub">支持多选图片，上传后自动抠图处理</div>

              <div
                className={`assets-dropzone${assetsDragOver ? " assets-dropzone--drag-over" : ""}`}
                onClick={() => assetsInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setAssetsDragOver(true); }}
                onDragLeave={() => setAssetsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setAssetsDragOver(false);
                  handleAssetsFiles(e.dataTransfer.files);
                }}
              >
                <div className="assets-dropzone__text">
                  {assetsUploaded ? "继续添加图片" : "点击或拖拽上传商品图"}
                </div>
                <div className="assets-dropzone__hint">支持 jpg / png / webp，可多选</div>
                <input
                  ref={assetsInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => handleAssetsFiles(e.target.files)}
                />
              </div>

              {thumbs.length > 0 && (
                <div className="assets-thumb-grid">
                  {thumbs.map((t, i) => (
                    <div key={i} className="assets-thumb">
                      <img src={t.url} alt={t.name} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Excel check */}
            <div className="excel-section">
              <div className="assets-section__title">导入映射 Excel 校验</div>
              <div className="assets-section__sub">
                先下载 Excel 模板（上一步），填写商品映射后导入校验
              </div>

              <div
                className={`assets-dropzone${excelDragOver ? " assets-dropzone--drag-over" : ""}`}
                onClick={() => excelInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setExcelDragOver(true); }}
                onDragLeave={() => setExcelDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setExcelDragOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleExcelFile(file);
                }}
              >
                <div className="assets-dropzone__text">点击或拖拽上传已填写的 Excel</div>
                <div className="assets-dropzone__hint">.xlsx 格式</div>
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

              {excelCheck && (
                <div className="excel-check">
                  <div className="excel-check__row">
                    <span className="excel-check__label">数据行数</span>
                    <span>{excelCheck.rows?.length ?? 0}</span>
                  </div>
                  <div className="excel-check__row">
                    <span className="excel-check__label">缺失素材</span>
                    <span className={missingCount > 0 ? "excel-check__warn" : "excel-check__ok"}>
                      {missingCount > 0
                        ? excelCheck.missing_assets!.join("、")
                        : "无"}
                    </span>
                  </div>
                  <div className="excel-check__row">
                    <span className="excel-check__label">未知替换组</span>
                    <span className={unknownCount > 0 ? "excel-check__warn" : "excel-check__ok"}>
                      {unknownCount > 0
                        ? excelCheck.unknown_groups!.join("、")
                        : "无"}
                    </span>
                  </div>
                  {checkOk && (
                    <div style={{ marginTop: "8px", color: "#060", fontSize: "12px", fontWeight: 600 }}>
                      ✓ 校验通过，可以继续
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="assets-page__footer">
            {!assetsUploaded && (
              <span style={{ fontSize: "12px", color: "#aaa" }}>请先上传商品图</span>
            )}
            <button
              className="btn btn--primary"
              onClick={() => navigate("/psd/generate")}
              disabled={!assetsUploaded}
            >
              下一步 →
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
