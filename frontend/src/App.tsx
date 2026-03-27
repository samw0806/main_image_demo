import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { WorkflowProvider, useWorkflow } from "./context";
import AppShell from "./layouts/AppShell";
import { PlatformProvider, usePlatform } from "./platform-context";
import BatchPage from "./pages/BatchPage";
import ChatPage from "./pages/ChatPage";
import DashboardPage from "./pages/DashboardPage";
import GeneratePage from "./pages/GeneratePage";
import GroupEditPage from "./pages/GroupEditPage";
import HistoryPage from "./pages/HistoryPage";
import LibraryPage from "./pages/LibraryPage";
import LoginPage from "./pages/LoginPage";
import SettingsPage from "./pages/SettingsPage";
import UploadPage from "./pages/UploadPage";

function GuardedPsdRoute({ children }: { children: React.ReactNode }) {
  const { template } = useWorkflow();
  if (!template) {
    return <Navigate to="/app/batch/template" replace />;
  }
  return <>{children}</>;
}

function ProtectedAppShell() {
  const { session } = usePlatform();
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return <AppShell />;
}

function LoginRedirect() {
  const { session } = usePlatform();
  return <Navigate to={session ? "/app" : "/login"} replace />;
}

export default function App() {
  return (
    <WorkflowProvider>
      <PlatformProvider>
        <BrowserRouter>
          <a className="skip-link" href="#main-content">
            跳转到主要内容
          </a>
          <Routes>
            <Route path="/" element={<LoginRedirect />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/app" element={<ProtectedAppShell />}>
              <Route index element={<DashboardPage />} />
              <Route path="chat" element={<ChatPage />} />
              <Route path="batch" element={<BatchPage />} />
              <Route path="library" element={<LibraryPage />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="batch/template" element={<UploadPage />} />
              <Route
                path="batch/groups"
                element={
                  <GuardedPsdRoute>
                    <GroupEditPage />
                  </GuardedPsdRoute>
                }
              />
              <Route
                path="batch/generate"
                element={
                  <GuardedPsdRoute>
                    <GeneratePage />
                  </GuardedPsdRoute>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </PlatformProvider>
    </WorkflowProvider>
  );
}
