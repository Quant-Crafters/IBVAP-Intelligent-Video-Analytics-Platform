import { Outlet } from "react-router-dom";
import Topbar from "../components/layout/Topbar";
import ProtectedRoute from "./ProtectedRoute";

function DashboardLayout() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-ibvap-bg text-ibvap-text">
        <Topbar />

        <main className="min-h-[calc(100vh-80px)]">
          <Outlet />
        </main>
      </div>
    </ProtectedRoute>
  );
}

export default DashboardLayout;