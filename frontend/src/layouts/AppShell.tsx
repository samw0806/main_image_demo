import { Outlet } from "react-router-dom";
import AppSidebar from "../components/AppSidebar";

export default function AppShell() {
  return (
    <div className="app-shell">
      <AppSidebar />
      <div className="app-shell__content">
        <Outlet />
      </div>
    </div>
  );
}

