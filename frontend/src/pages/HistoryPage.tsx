import ActivityFeed from "../components/ActivityFeed";
import PageHeader from "../components/PageHeader";
import { usePlatform } from "../platform-context";

export default function HistoryPage() {
  const { activities } = usePlatform();

  return (
    <div className="shell shell--compact">
      <PageHeader
        description="统一查看聊天作图、批量任务和素材上传活动。"
        title="生成历史"
      />

      <main className="batch-layout" id="main-content">
        <section className="panel panel--summary">
          <div className="panel__header">
            <div>
              <div className="panel__eyebrow">最近活动</div>
              <h2>当前共有 {activities.length} 条记录</h2>
            </div>
          </div>
          <ActivityFeed items={activities} />
        </section>
      </main>
    </div>
  );
}
