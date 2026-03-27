import type { UnifiedAsset } from "../mock/appShell";

type AssetCardProps = {
  asset: UnifiedAsset;
};

const KIND_LABEL: Record<UnifiedAsset["kind"], string> = {
  image: "图片",
  psd: "PSD",
  psb: "PSB",
};

const SOURCE_LABEL: Record<UnifiedAsset["source"], string> = {
  upload: "上传素材",
  chat_generated: "聊天生成",
  batch_generated: "批量结果",
  template: "模板资产",
};

export default function AssetCard({ asset }: AssetCardProps) {
  return (
    <article className="asset-card">
      <img alt={asset.name} className="asset-card__preview" src={asset.previewUrl} />
      <div className="asset-card__body">
        <div className="asset-card__tags">
          <span>{KIND_LABEL[asset.kind]}</span>
          <span>{SOURCE_LABEL[asset.source]}</span>
        </div>
        <strong>{asset.name}</strong>
        <time dateTime={asset.createdAt}>{new Date(asset.createdAt).toLocaleString("zh-CN")}</time>
      </div>
    </article>
  );
}

