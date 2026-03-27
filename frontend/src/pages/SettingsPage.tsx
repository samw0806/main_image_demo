import { usePlatform } from "../platform-context";

export default function SettingsPage() {
  const { plan, session } = usePlatform();

  return (
    <div className="shell shell--compact">
      <header className="shell__header">
        <div>
          <div className="shell__eyebrow">Settings</div>
          <h1 className="shell__title">账户设置</h1>
          <p className="shell__description">查看当前试运营账号资料、套餐状态与额度信息。</p>
        </div>
      </header>

      <main className="batch-layout" id="main-content">
        <section className="panel panel--summary">
          <div className="panel__header">
            <div>
              <div className="panel__eyebrow">当前账号</div>
              <h2>{session?.user.name ?? "未登录"}</h2>
            </div>
            <p className="panel__sub">
              {plan.name} · 已用 {plan.quotaUsed} / {plan.quotaTotal}
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
