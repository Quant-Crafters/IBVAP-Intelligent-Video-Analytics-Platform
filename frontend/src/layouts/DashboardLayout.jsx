import { Outlet } from "react-router-dom";
import Topbar from "../components/layout/Topbar";

function DashboardLayout() {
  return (
    <div className="min-h-screen bg-ibvap-bg text-ibvap-text">
      <Topbar />

      <main className="min-h-[calc(100vh-80px)]">
        <Outlet />
      </main>
    </div>
  );
}

export default DashboardLayout;