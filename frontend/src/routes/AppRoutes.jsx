import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Landing from "../pages/landing";
import Login from "../pages/Login";
import Register from "../pages/Register";

import DashboardLayout from "../layouts/DashboardLayout";

import LiveOverview from "../pages/LiveOverview";
import ThreatAlerts from "../pages/ThreatAlerts";
import Analytics from "../pages/Analytics";
import Reports from "../pages/Reports";

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>

        {/* =====================================================
            PUBLIC WEBSITE
        ====================================================== */}

        <Route
          path="/"
          element={<Landing />}
        />

        {/* =====================================================
            AUTHENTICATION
        ====================================================== */}

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/register"
          element={<Register />}
        />

        {/* =====================================================
            AUTHENTICATED APPLICATION
            DashboardLayout uses <Outlet />
            so application pages MUST be nested routes.
        ====================================================== */}

        <Route
          element={<DashboardLayout />}
        >
          <Route
            path="/live-overview"
            element={<LiveOverview />}
          />

          <Route
            path="/threat-alerts"
            element={<ThreatAlerts />}
          />

          <Route
            path="/analytics"
            element={<Analytics />}
          />

          <Route
            path="/reports"
            element={<Reports />}
          />
        </Route>

        {/* =====================================================
            FALLBACK
        ====================================================== */}

        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />

      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;