import { useNavigate } from "react-router-dom";
import { usePlatform } from "../platform-context";

export default function LoginPage() {
  const navigate = useNavigate();
  const { signInTrial } = usePlatform();

  function handleTrialSignIn() {
    signInTrial();
    navigate("/app", { replace: true });
  }

  return (
    <div className="shell shell--compact">
      <main className="login-layout" id="main-content">
        <section className="login-panel login-panel--brand">
          <p className="hero-card__kicker">Main Image Studio</p>
          <h1 className="shell__title">统一承接聊天作图、批量出图和素材沉淀。</h1>
          <p className="shell__description">
            当前平台处于免费内部试用阶段，用于业务演示、试运营验证和能力边界确认。
          </p>
          <div className="login-panel__feature-list">
            <div className="login-panel__feature">
              <strong>聊天作图</strong>
              <span>上传图片后即可进入对话式改图流程。</span>
            </div>
            <div className="login-panel__feature">
              <strong>批量作图</strong>
              <span>围绕 PSD / PSB 模板完成结构化批量出图。</span>
            </div>
            <div className="login-panel__feature">
              <strong>统一素材库</strong>
              <span>统一沉淀图片、模板资产和历史生成结果。</span>
            </div>
          </div>
        </section>

        <section className="login-panel login-panel--form">
          <div className="panel__header">
            <div>
              <div className="panel__eyebrow">登录</div>
              <h2>进入内部试运营平台</h2>
            </div>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <input className="input" type="email" placeholder="邮箱" />
            <input className="input" type="password" placeholder="密码" />
            <button className="btn btn--primary" type="button">
              登录
            </button>
            <button className="btn btn--secondary" onClick={handleTrialSignIn} type="button">
              使用内部试用账号进入
            </button>
            <div className="login-panel__helper">
              该入口用于演示与试运营验证，后续会切换为正式订阅体系。
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
