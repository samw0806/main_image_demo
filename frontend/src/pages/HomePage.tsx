import { Link } from "react-router-dom";

const TECH_PATHS = [
  {
    name: "聊天主图编辑",
    mode: "聊天模式",
    inputs: "图片 / 历史素材",
    status: "首期接通",
    description: "通过真实生图链路完成多轮编辑与结果沉淀。",
  },
  {
    name: "PSD / PSB 批量工作流",
    mode: "批量模式",
    inputs: "PSD / PSB",
    status: "并行迁入",
    description: "沿用现有模板解析、替换组、Excel、批处理路径。",
  },
  {
    name: "跨模式素材库",
    mode: "共享能力",
    inputs: "上传 / 生成结果",
    status: "基础可用",
    description: "统一承接上传图、生成图和后续 PSD 素材复用。",
  },
];

export default function HomePage() {
  return (
    <div className="shell shell--compact">
      <header className="shell__header">
        <div>
          <div className="shell__eyebrow">Main Image Studio</div>
          <h1 className="shell__title">主图编辑统一主应用</h1>
          <p className="shell__description">
            用一个纯净、统一的工作台承接聊天编辑、批量模板工作流和素材沉淀，让内部演示聚焦在能力边界与路径差异，而不是界面噪音。
          </p>
        </div>
        <div className="shell__meta">桌面端演示优先 · 前后端统一落地</div>
      </header>

      <main className="home-layout" id="main-content">
        <section className="hero-card">
          <p className="hero-card__kicker">统一入口</p>
          <h2>把聊天编辑、批量模板和素材沉淀放进同一个工作台。</h2>
          <p>
            当前版本优先打通真实聊天生成闭环，并把 PSD/PSB 工作流按既有能力迁入统一壳中。
          </p>
          <div className="hero-card__meta">
            <span>聊天生成演示</span>
            <span>PSD 模板流程</span>
            <span>跨模式素材复用</span>
          </div>
          <div className="hero-card__actions">
            <Link className="btn btn--primary" to="/chat">
              进入聊天模式
            </Link>
            <Link className="btn btn--secondary" to="/batch">
              进入批量模式
            </Link>
          </div>
        </section>

        <section className="mode-grid">
          <article className="mode-card">
            <div className="mode-card__tag">模式 A</div>
            <h3>聊天模式</h3>
            <p>适合快速试图、连续改图和素材复用，首期直接接真实生图能力。</p>
            <ul className="plain-list">
              <li>支持图片上传和历史素材复用</li>
              <li>保留多轮摘要衔接</li>
              <li>结果自动回流素材库</li>
            </ul>
            <Link className="text-link" to="/chat">
              打开聊天工作台
            </Link>
          </article>

          <article className="mode-card">
            <div className="mode-card__tag">模式 B</div>
            <h3>批量模式</h3>
            <p>适合模板化、图层化的结构编辑，面向 PSD/PSB 的解析与批量输出。</p>
            <ul className="plain-list">
              <li>仅接受 PSD / PSB 模板</li>
              <li>复用现有替换组与 Excel 流程</li>
              <li>后续接素材库桥接</li>
            </ul>
            <Link className="text-link" to="/batch">
              查看批量入口
            </Link>
          </article>
        </section>

        <section className="panel panel--summary">
          <div className="panel__header">
            <div>
              <div className="panel__eyebrow">技术路径展板</div>
              <h3>当前主线与集成状态</h3>
            </div>
            <p className="panel__sub">把当前系统能力和边界浓缩成 3 条最值得演示的路径。</p>
          </div>
          <div className="path-list">
            {TECH_PATHS.map((item) => (
              <article className="path-card" key={item.name}>
                <div className="path-card__head">
                  <strong>{item.name}</strong>
                  <span>{item.status}</span>
                </div>
                <p>{item.description}</p>
                <div className="path-card__meta">
                  <span>{item.mode}</span>
                  <span>{item.inputs}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
