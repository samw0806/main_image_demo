import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Layer, Rect, Stage, Image as KonvaImage } from "react-konva";
import { useNavigate } from "react-router-dom";
import StepNav from "../components/StepNav";
import { isDefaultProductLayer, useWorkflow } from "../context";
import { getErrorMessage, getExcelExportUrl, previewGroup, type GroupPreviewResponse } from "../api";
import type { LayerNode, ReplaceGroup } from "../types";

type DragSelection = { x1: number; y1: number; x2: number; y2: number } | null;

function isFullyContained(
  sel: { x: number; y: number; width: number; height: number },
  layer: LayerNode,
) {
  return (
    layer.x >= sel.x &&
    layer.y >= sel.y &&
    layer.x + layer.width <= sel.x + sel.width &&
    layer.y + layer.height <= sel.y + sel.height
  );
}

function useImage(url: string | null) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useMemo(() => {
    if (!url) { setImg(null); return; }
    const i = new window.Image();
    i.crossOrigin = "anonymous";
    i.src = url;
    i.onload = () => setImg(i);
  }, [url]);
  return img;
}

type MobileTab = "layers" | "workspace";

export default function GroupEditPage() {
  const navigate = useNavigate();
  const {
    template, layers, editor, history,
    updateEditor, undo, redo,
    toggleLayer, removeSelectedLayer,
    deleteGroup,
    onSaveGroups, busy, errorText, setErrorText,
  } = useWorkflow();

  const [search, setSearch] = useState("");
  const [onlyProduct, setOnlyProduct] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [hoveredLayerId, setHoveredLayerId] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [dragSelection, setDragSelection] = useState<DragSelection>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("layers");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [groupPreview, setGroupPreview] = useState<GroupPreviewResponse | null>(null);
  const [groupPreviewImageUrl, setGroupPreviewImageUrl] = useState<string>("");
  const [pendingGroup, setPendingGroup] = useState<ReplaceGroup | null>(null);

  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 500 });

  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({ w: entry.contentRect.width, h: entry.contentRect.height });
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const templateImageUrl = useMemo(
    () => (template ? `http://127.0.0.1:8000${template.preview_url}` : ""),
    [template],
  );
  const preview = useImage(templateImageUrl || null);

  const fitScale = useMemo(() => {
    if (!template) return 1;
    return Math.min(
      (containerSize.w - 16) / template.width,
      (containerSize.h - 16) / template.height,
      1,
    );
  }, [template, containerSize]);

  const stageWidth = template ? Math.round(template.width * fitScale) : containerSize.w;
  const stageHeight = template ? Math.round(template.height * fitScale) : containerSize.h;

  const filteredLayers = useMemo(() => {
    let list = layers;
    if (onlyProduct) list = list.filter((l) => isDefaultProductLayer(l.name));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((l) => l.name.toLowerCase().includes(q));
    }
    return list;
  }, [layers, onlyProduct, search]);

  const selectedLayers = useMemo(
    () => layers.filter((l) => editor.selectedIds.includes(l.id)),
    [layers, editor.selectedIds],
  );

  function toggleGroupExpanded(name: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const handleCanvasMouseDown = useCallback(
    (e: any) => {
      const p = e.target.getStage()?.getPointerPosition();
      if (!p) return;
      setIsSelecting(true);
      setDragSelection({
        x1: p.x / fitScale,
        y1: p.y / fitScale,
        x2: p.x / fitScale,
        y2: p.y / fitScale,
      });
    },
    [fitScale],
  );

  const handleCanvasMouseMove = useCallback(
    (e: any) => {
      if (!isSelecting || !dragSelection) return;
      const p = e.target.getStage()?.getPointerPosition();
      if (!p) return;
      setDragSelection({ ...dragSelection, x2: p.x / fitScale, y2: p.y / fitScale });
    },
    [isSelecting, dragSelection, fitScale],
  );

  const handleCanvasMouseUp = useCallback(
    (e: any) => {
      setIsSelecting(false);
      if (!dragSelection) return;
      const finalSelection = {
        x: Math.min(dragSelection.x1, dragSelection.x2),
        y: Math.min(dragSelection.y1, dragSelection.y2),
        width: Math.abs(dragSelection.x2 - dragSelection.x1),
        height: Math.abs(dragSelection.y2 - dragSelection.y1),
      };
      const hits = layers.filter((l) => isFullyContained(finalSelection, l)).map((l) => l.id);
      const additive = !!(e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey);
      updateEditor((prev) => ({
        ...prev,
        selection: finalSelection,
        selectedIds: additive ? Array.from(new Set([...prev.selectedIds, ...hits])) : hits,
      }));
      setDragSelection(null);
    },
    [dragSelection, layers, updateEditor],
  );

  async function handleSave() {
    await onSaveGroups();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  }

  function buildGroupFromSelection(): ReplaceGroup | null {
    const groupName = editor.groupName.trim();
    if (!groupName) {
      setErrorText("请先填写替换组名称");
      return null;
    }
    if (editor.selectedIds.length === 0) {
      setErrorText("请先选择至少一个图层");
      return null;
    }
    if (editor.groups.some((g) => g.name === groupName)) {
      setErrorText("替换组名称重复");
      return null;
    }
    const selectedIdsSorted = [...editor.selectedIds].sort((aId, bId) => {
      const a = layers.find((layer) => layer.id === aId);
      const b = layers.find((layer) => layer.id === bId);
      return (a?.stack_index ?? Number.MAX_SAFE_INTEGER) - (b?.stack_index ?? Number.MAX_SAFE_INTEGER);
    });
    return {
      name: groupName,
      region: editor.selection ?? { x: 0, y: 0, width: 0, height: 0 },
      layer_rules: selectedIdsSorted.map((id) => ({ layer_id: id, action: "replace" as const })),
    };
  }

  async function handleCreateWithPreview() {
    if (!template) return;
    const nextGroup = buildGroupFromSelection();
    if (!nextGroup) return;

    setPreviewBusy(true);
    setErrorText("");
    try {
      const response = await previewGroup(
        template.id,
        nextGroup.layer_rules.map((rule) => rule.layer_id),
      );
      setPendingGroup(nextGroup);
      setGroupPreview(response);
      setGroupPreviewImageUrl(`http://127.0.0.1:8000${response.preview_url}?t=${Date.now()}`);
    } catch (error) {
      setErrorText(getErrorMessage(error));
    } finally {
      setPreviewBusy(false);
    }
  }

  function handleCancelPreview() {
    setPendingGroup(null);
    setGroupPreview(null);
    setGroupPreviewImageUrl("");
  }

  function handleConfirmGroup() {
    if (!pendingGroup) return;
    updateEditor((prev) => ({
      ...prev,
      groups: [...prev.groups, pendingGroup],
      groupName: "",
      selectedIds: [],
      selection: null,
    }));
    handleCancelPreview();
  }

  useEffect(() => {
    if (!groupPreview) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Enter") {
        e.preventDefault();
        handleConfirmGroup();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancelPreview();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [groupPreview, pendingGroup]);

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFilename, setExportFilename] = useState("");

  function handleNext() {
    if (editor.groups.length > 0) {
      onSaveGroups().then(() => {
        setExportFilename(`${template?.name || "template"}_数据填写表.xlsx`);
        setShowExportModal(true);
      });
    } else {
      setErrorText("请先创建并保存替换组");
    }
  }

  function confirmExportAndNext() {
    // 触发下载
    const url = getExcelExportUrl(template!.id, exportFilename);
    const link = document.createElement("a");
    link.href = url;
    // 强制下载
    link.setAttribute("download", exportFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setShowExportModal(false);
    navigate("/app/batch/generate");
  }

  if (!template) {
    navigate("/app/batch/template");
    return null;
  }

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  return (
    <div className="workflow-page">
      <StepNav current={1} />
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
                <div className="workflow-page__eyebrow">替换组配置</div>
                <h1 className="workflow-page__title">配置图层替换组</h1>
                <p className="workflow-page__lead">
                  从左侧图层列表与中部画布中选择需要替换的区域，在右侧创建可复用的替换组，并在进入下一步前完成保存。
                </p>
              </div>
            </div>
          </section>

          <div className="group-page">
          {/* Mobile: toggle layer panel */}
          <div className="mobile-tabs">
            <button
              className={`mobile-tab${mobileTab === "layers" ? " mobile-tab--active" : ""}`}
              onClick={() => setMobileTab(mobileTab === "layers" ? "workspace" : "layers")}
            >
              {mobileTab === "layers" ? "隐藏图层列表" : "显示图层列表"}
            </button>
          </div>

          <div className="group-page__body">
            {/* LEFT: layer browser */}
            <aside className={`layer-panel${mobileTab === "workspace" ? " tab-hidden" : ""}`}>
              <div className="layer-panel__header">
                <input
                  className="input"
                  placeholder="搜索图层..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <label className="layer-panel__filter">
                  <input
                    type="checkbox"
                    checked={onlyProduct}
                    onChange={(e) => setOnlyProduct(e.target.checked)}
                  />
                  仅显示商品图层
                </label>
              </div>
              <div className="layer-panel__list">
                {filteredLayers.map((l) => (
                  <label
                    key={l.id}
                  className={`layer-row${editor.selectedIds.includes(l.id) ? " layer-row--selected" : ""}${hoveredLayerId === l.id ? " layer-row--highlighted" : ""}`}
                  style={{ paddingLeft: `${12 + l.level * 12}px` }}
                  onMouseEnter={() => setHoveredLayerId(l.id)}
                  onMouseLeave={() => setHoveredLayerId(null)}
                  tabIndex={0}
                >
                    <input
                      type="checkbox"
                      checked={editor.selectedIds.includes(l.id)}
                      onChange={() => toggleLayer(l.id, true)}
                    />
                    <span className="layer-row__name">{l.name}</span>
                  </label>
                ))}
                {filteredLayers.length === 0 && (
                  <div style={{ padding: "12px", fontSize: "12px", color: "#aaa" }}>
                    无匹配图层
                  </div>
                )}
              </div>
            </aside>

            {/* CENTER: canvas */}
            <section className="canvas-panel" ref={canvasContainerRef}>
              <div className="canvas-panel__stage" style={{ width: "100%", height: "100%" }}>
                {template ? (
                  <Stage
                    width={stageWidth}
                    height={stageHeight}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                  >
                    <Layer>
                      {preview && (
                        <KonvaImage
                          image={preview}
                          width={template.width * fitScale}
                          height={template.height * fitScale}
                        />
                      )}
                      {layers.map((l) => {
                        const isSelected = editor.selectedIds.includes(l.id);
                        const isHovered = hoveredLayerId === l.id;
                        return (
                          <Rect
                            key={l.id}
                            x={l.x * fitScale}
                            y={l.y * fitScale}
                            width={Math.max(1, l.width * fitScale)}
                            height={Math.max(1, l.height * fitScale)}
                            stroke={isSelected ? "#000" : isHovered ? "#555" : "rgba(0,0,0,0.15)"}
                            strokeWidth={isSelected ? 2 : isHovered ? 1.5 : 1}
                            dash={isHovered && !isSelected ? [4, 3] : undefined}
                          />
                        );
                      })}
                      {dragSelection && (
                        <Rect
                          x={Math.min(dragSelection.x1, dragSelection.x2) * fitScale}
                          y={Math.min(dragSelection.y1, dragSelection.y2) * fitScale}
                          width={Math.abs(dragSelection.x2 - dragSelection.x1) * fitScale}
                          height={Math.abs(dragSelection.y2 - dragSelection.y1) * fitScale}
                          stroke="#333"
                          dash={[6, 4]}
                          strokeWidth={1.5}
                        />
                      )}
                    </Layer>
                  </Stage>
                ) : (
                  <div className="canvas-placeholder">请先上传 PSD/PSB 模板</div>
                )}
              </div>
            </section>

            {/* RIGHT: workspace — always visible */}
            <aside className="work-panel">
              {/* Undo/redo */}
              <div className="work-panel__section" style={{ display: "flex", gap: "6px" }}>
                <button className="btn btn--ghost btn--sm" onClick={undo} disabled={!canUndo}>
                  撤销
                </button>
                <button className="btn btn--ghost btn--sm" onClick={redo} disabled={!canRedo}>
                  重做
                </button>
              </div>

              {/* Selected layers chips */}
              <div className="work-panel__section">
                <div className="work-panel__section-title">
                  已选图层 {selectedLayers.length > 0 ? `(${selectedLayers.length})` : ""}
                </div>
                <div className="chips-wrap" style={{ marginTop: "6px" }}>
                  {selectedLayers.length === 0 ? (
                    <span className="chips-empty">在画布框选或左侧勾选图层</span>
                  ) : (
                    selectedLayers.map((layer) => (
                      <span key={layer.id} className="chip">
                        <span className="chip__name">{layer.name}</span>
                        <span
                          className="chip__remove"
                          onClick={() => removeSelectedLayer(layer.id)}
                        >
                          ×
                        </span>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Create group */}
              <div className="work-panel__section">
                <div className="work-panel__section-title">创建替换组</div>
                <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                  <input
                    className="input"
                    placeholder="替换组名称"
                    value={editor.groupName}
                    onChange={(e) =>
                      updateEditor((prev) => ({ ...prev, groupName: e.target.value }))
                    }
                    onKeyDown={(e) => e.key === "Enter" && handleCreateWithPreview()}
                  />
                  <button
                    className="btn btn--primary btn--sm"
                    style={{ flexShrink: 0 }}
                    onClick={handleCreateWithPreview}
                    disabled={!editor.groupName.trim() || editor.selectedIds.length === 0 || previewBusy}
                  >
                    {previewBusy ? "预览中..." : "创建并预览"}
                  </button>
                </div>
              </div>

              {/* Group list */}
              <div className="work-panel__groups">
                <div className="work-panel__section-title" style={{ marginBottom: "8px" }}>
                  替换组 {editor.groups.length > 0 ? `(${editor.groups.length})` : ""}
                </div>
                {editor.groups.length === 0 && (
                  <div style={{ fontSize: "12px", color: "#bbb" }}>暂无替换组</div>
                )}
                {editor.groups.map((g) => {
                  const isOpen = expandedGroups.has(g.name);
                  const layerNames = g.layer_rules
                    .map((r) => layers.find((l) => l.id === r.layer_id)?.name ?? r.layer_id)
                    .filter(Boolean);
                  return (
                    <div key={g.name} className="group-card">
                      <div
                        className="group-card__header"
                        onClick={() => toggleGroupExpanded(g.name)}
                      >
                        <span className={`group-card__arrow${isOpen ? " group-card__arrow--open" : ""}`}>
                          ▶
                        </span>
                        <span className="group-card__name">{g.name}</span>
                        <span className="group-card__count">{g.layer_rules.length} 层</span>
                        <button
                          className="btn btn--danger btn--xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteGroup(g.name);
                          }}
                        >
                          删除
                        </button>
                      </div>
                      {isOpen && (
                        <div className="group-card__body">
                          <ul className="group-card__layer-list">
                            {layerNames.map((name, i) => (
                              <li key={i}>{name}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}

                {editor.groups.length > 0 && (
                  <button
                    className="btn btn--secondary btn--sm"
                    style={{ marginTop: "10px", width: "100%" }}
                    onClick={handleSave}
                    disabled={busy}
                  >
                    {saveSuccess ? "✓ 已保存" : "保存所有替换组"}
                  </button>
                )}
              </div>
            </aside>
          </div>

          {/* Footer */}
          <div className="group-page__footer">
            <a
              className="btn btn--secondary"
              href={getExcelExportUrl(template.id)}
              target="_blank"
              rel="noreferrer"
            >
              导出 Excel 模板
            </a>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {editor.groups.length === 0 && (
                <span style={{ fontSize: "12px", color: "#aaa" }}>请先创建并保存替换组</span>
              )}
              <button
                className="btn btn--primary"
                onClick={handleNext}
                disabled={editor.groups.length === 0}
              >
                下一步
              </button>
            </div>
          </div>
        </div>
        </div>
      </div>

      {groupPreview && (
        <div className="group-preview-modal">
          <div className="group-preview-modal__dialog">
            <div className="group-preview-modal__header">
              <div className="group-preview-modal__title">
                确认替换组“{pendingGroup?.name}”
              </div>
              <div className="group-preview-modal__subtitle">
                左侧是原图，右侧是隐藏所选图层后的预览。确认无误后再创建该组。
              </div>
            </div>

            <div className="group-preview-modal__compare">
              <div className="group-preview-modal__pane">
                <div className="group-preview-modal__label">原图</div>
                <img src={templateImageUrl} alt="原图预览" />
              </div>
              <div className="group-preview-modal__pane">
                <div className="group-preview-modal__label">去除所选图层后</div>
                <img src={groupPreviewImageUrl} alt="替换组预览" />
              </div>
            </div>

            <div className="group-preview-modal__meta">
              已命中图层 {groupPreview.matched_count}/{groupPreview.requested_count}
              {groupPreview.unmatched_layer_ids.length > 0 && (
                <span>
                  ，未命中：
                  {groupPreview.unmatched_layer_ids
                    .map((id) => layers.find((l) => l.id === id)?.name || id)
                    .join(", ")}
                </span>
              )}
            </div>

            <div className="group-preview-modal__actions">
              <button className="btn btn--secondary" onClick={handleCancelPreview}>
                返回重选图层
              </button>
              <button
                className="btn btn--primary"
                onClick={handleConfirmGroup}
                disabled={groupPreview.matched_count === 0}
              >
                确认这个组
              </button>
            </div>
          </div>
        </div>
      )}

      {showExportModal && (
        <div className="group-preview-modal">
          <div className="group-preview-modal__dialog" style={{ width: "420px" }}>
            <div className="group-preview-modal__header">
              <div className="group-preview-modal__title">导出数据填写表</div>
              <div className="group-preview-modal__subtitle" style={{ marginTop: "8px", lineHeight: "1.6" }}>
                Excel 是连接下一步的关键。请下载模板并在 Excel 中<strong>直接插入图片</strong>，完成后在下一步上传。
              </div>
            </div>

            <div style={{ padding: "12px 0" }}>
              <label style={{ fontSize: "12px", color: "#888", display: "block", marginBottom: "8px" }}>
                建议保存的文件名：
              </label>
              <input
                className="input"
                value={exportFilename}
                onChange={(e) => setExportFilename(e.target.value)}
                placeholder="文件名..."
                autoFocus
              />
            </div>

            <div className="group-preview-modal__actions" style={{ marginTop: "8px" }}>
              <button className="btn btn--secondary" onClick={() => setShowExportModal(false)}>
                取消
              </button>
              <button className="btn btn--primary" onClick={confirmExportAndNext}>
                导出并前往下一步
              </button>
            </div>
          </div>
        </div>
      )}

      {previewBusy && (
        <div className="modal-overlay" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div style={{
            background: "#fff",
            padding: "24px 32px",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontSize: "14px"
          }}>
            <div style={{
              width: "20px",
              height: "20px",
              border: "2px solid #ddd",
              borderTopColor: "#111",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite"
            }} />
            正在生成预览...
          </div>
        </div>
      )}
    </div>
  );
}
