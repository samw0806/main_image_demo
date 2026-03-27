import { useMemo, useState } from "react";
import AssetCard from "../components/AssetCard";
import PageHeader from "../components/PageHeader";
import { usePlatform } from "../platform-context";

export default function LibraryPage() {
  const { assets } = usePlatform();
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | "image" | "psd" | "psb">("all");

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      if (kindFilter !== "all" && asset.kind !== kindFilter) return false;
      if (query.trim() && !asset.name.toLowerCase().includes(query.trim().toLowerCase())) return false;
      return true;
    });
  }, [assets, kindFilter, query]);

  const uploadAssets = filteredAssets.filter((asset) => asset.source === "upload" || asset.source === "template");
  const generatedAssets = filteredAssets.filter(
    (asset) => asset.source === "chat_generated" || asset.source === "batch_generated",
  );

  return (
    <div className="shell shell--compact">
      <PageHeader
        description="统一承接图片、PSD / PSB 模板和历史生成结果。"
        title="素材库"
      />

      <main className="batch-layout" id="main-content">
        <section className="panel panel--summary">
          <div className="panel__header">
            <div>
              <div className="panel__eyebrow">筛选</div>
              <h2>当前共有 {filteredAssets.length} 项素材</h2>
            </div>
          </div>
          <div className="library-toolbar">
            <input
              className="input"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索素材名称"
              value={query}
            />
            <div className="library-toolbar__filters">
              {[
                { value: "all", label: "全部" },
                { value: "image", label: "图片" },
                { value: "psd", label: "PSD" },
                { value: "psb", label: "PSB" },
              ].map((option) => (
                <button
                  className={kindFilter === option.value ? "btn btn--primary btn--sm" : "btn btn--secondary btn--sm"}
                  key={option.value}
                  onClick={() => setKindFilter(option.value as typeof kindFilter)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <div className="panel__eyebrow">上传素材</div>
              <h2>模板与上传资产</h2>
            </div>
          </div>
          <div className="asset-grid">
            {uploadAssets.map((asset) => (
              <AssetCard asset={asset} key={asset.id} />
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <div className="panel__eyebrow">历史生成结果</div>
              <h2>最近生成的图片</h2>
            </div>
          </div>
          <div className="asset-grid">
            {generatedAssets.map((asset) => (
              <AssetCard asset={asset} key={asset.id} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
