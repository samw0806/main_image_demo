import ActivityFeed from "../components/ActivityFeed";
import PageHeader from "../components/PageHeader";
import ShortcutCard from "../components/ShortcutCard";
import { usePlatform } from "../platform-context";

export default function DashboardPage() {
  const { activities, assets, plan } = usePlatform();
  const latestAssets = assets.slice(0, 3);

  return (
    <div className="shell shell--compact">
      <PageHeader
        title="欢迎回来"
        description="今天可以继续聊天作图或发起批量作图。当前账号仍处于免费内部试用阶段。"
        actions={
          <div className="shell__meta">
            剩余额度 {plan.quotaTotal - plan.quotaUsed} / {plan.quotaTotal}
          </div>
        }
      />

      <main className="dashboard-layout" id="main-content">
        <section className="dashboard-layout__hero">
          <div className="shortcut-grid">
            <ShortcutCard
              ctaLabel="进入聊天作图"
              description="通过自然语言和参考素材持续生成主图。"
              eyebrow="主入口"
              featured
              title="聊天作图"
              to="/app/chat"
            />
            <ShortcutCard
              ctaLabel="进入批量作图"
              description="围绕 PSD / PSB 模板完成结构化批量出图。"
              eyebrow="主入口"
              title="批量作图"
              to="/app/batch"
            />
          </div>
        </section>

        <section className="dashboard-layout__status panel panel--summary">
          <div className="dashboard-status">
            <div>
              <strong>免费内部试用</strong>
              <span>当前仍处于试运营验证阶段</span>
            </div>
            <div>
              <strong>剩余额度</strong>
              <span>
                {plan.quotaTotal - plan.quotaUsed} / {plan.quotaTotal}
              </span>
            </div>
            <div>
              <strong>最近活动</strong>
              <span>{new Date(activities[0]?.at ?? Date.now()).toLocaleString("zh-CN")}</span>
            </div>
          </div>
        </section>

        <section className="dashboard-layout__activity panel">
          <div className="panel__header">
            <div>
              <div className="panel__eyebrow">最近活动</div>
              <h2>最近系统动作</h2>
            </div>
          </div>
          <ActivityFeed items={activities.slice(0, 5)} />
        </section>

        <section className="dashboard-layout__assets panel">
          <div className="panel__header">
            <div>
              <div className="panel__eyebrow">最近素材</div>
              <h2>最近沉淀的资产</h2>
            </div>
          </div>
          <div className="dashboard-asset-grid">
            {latestAssets.map((asset) => (
              <article className="dashboard-asset-card" key={asset.id}>
                <img alt={asset.name} src={asset.previewUrl} />
                <strong>{asset.name}</strong>
                <span>
                  {asset.kind.toUpperCase()} · {new Date(asset.createdAt).toLocaleDateString("zh-CN")}
                </span>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
