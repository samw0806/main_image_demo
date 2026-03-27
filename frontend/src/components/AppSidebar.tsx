import { NavLink, useNavigate } from "react-router-dom";
import { usePlatform } from "../platform-context";

const NAV_ITEMS = [
  { to: "/app", label: "Dashboard", end: true },
  { to: "/app/chat", label: "聊天作图" },
  { to: "/app/batch", label: "批量作图" },
  { to: "/app/library", label: "素材库" },
  { to: "/app/history", label: "生成历史" },
];

export default function AppSidebar() {
  const navigate = useNavigate();
  const { plan, session, signOut } = usePlatform();
  const remaining = plan.quotaTotal - plan.quotaUsed;

  function handleSignOut() {
    signOut();
    navigate("/login", { replace: true });
  }

  return (
    <aside className="app-sidebar">
      <div className="app-sidebar__brand">
        <span className="app-sidebar__logo">MI</span>
        <div>
          <strong>Main Image Studio</strong>
          <div className="app-sidebar__meta">Internal Trial</div>
        </div>
      </div>

      <nav className="app-sidebar__nav" aria-label="主导航">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            className={({ isActive }) =>
              isActive ? "app-sidebar__link app-sidebar__link--active" : "app-sidebar__link"
            }
            end={item.end}
            to={item.to}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="app-sidebar__account">
        <div className="app-sidebar__avatar">{session?.user.initials ?? "MI"}</div>
        <div className="app-sidebar__summary">
          <strong>{session?.user.name ?? "内部试用账号"}</strong>
          <span>免费内部试用</span>
          <span>
            剩余 {remaining} / {plan.quotaTotal}
          </span>
        </div>
        <div className="app-sidebar__actions">
          <NavLink className="app-sidebar__link app-sidebar__link--ghost" to="/app/settings">
            设置
          </NavLink>
          <button className="app-sidebar__button" onClick={handleSignOut} type="button">
            退出
          </button>
        </div>
      </div>
    </aside>
  );
}

