import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Landing from "../pages/landing";
import Login from "../pages/Login";
import Register from "../pages/Register";

import DashboardLayout from "../layouts/DashboardLayout";

import LiveOverview from "../pages/LiveOverview";
import ThreatAlerts from "../pages/ThreatAlerts";
import Analytics from "../pages/Analytics";
import Reports from "../pages/Reports";


/*
 * ============================================================
 * AUTHENTICATION HELPERS
 * ============================================================
 */

function getAuthenticatedUser() {
  try {
    const token = localStorage.getItem("ibvap_token");
    const storedUser = localStorage.getItem("ibvap_user");

    if (!token || !storedUser) {
      return null;
    }

    return JSON.parse(storedUser);
  } catch (error) {
    console.error("Failed to read authentication data:", error);
    return null;
  }
}


/*
 * ============================================================
 * AUTHENTICATED ROUTE
 * ============================================================
 */

function ProtectedRoute({ children }) {
  const user = getAuthenticatedUser();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}


/*
 * ============================================================
 * ROLE-PROTECTED ROUTE
 * ============================================================
 */

function RoleProtectedRoute({ allowedRoles, children }) {
  const user = getAuthenticatedUser();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    /*
     * User is authenticated but does not have permission
     * to access this page.
     *
     * Redirect them to Live Overview.
     */
    return <Navigate to="/live-overview" replace />;
  }

  return children;
}


/*
 * ============================================================
 * APPLICATION ROUTES
 * ============================================================
 */

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
        ====================================================== */}

        <Route
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >

          {/* =================================================
              LIVE OVERVIEW

              Available to:
              - Administrator
              - Post Commander
              - Security Sentry
          ================================================== */}

          <Route
            path="/live-overview"
            element={
              <RoleProtectedRoute
                allowedRoles={[
                  "administrator",
                  "post_commander",
                  "security_sentry",
                ]}
              >
                <LiveOverview />
              </RoleProtectedRoute>
            }
          />


          {/* =================================================
              THREAT ALERTS

              Available to:
              - Administrator
              - Post Commander
              - Security Sentry
          ================================================== */}

          <Route
            path="/threat-alerts"
            element={
              <RoleProtectedRoute
                allowedRoles={[
                  "administrator",
                  "post_commander",
                  "security_sentry",
                ]}
              >
                <ThreatAlerts />
              </RoleProtectedRoute>
            }
          />


          {/* =================================================
              ANALYTICS

              Available to:
              - Administrator
              - Post Commander
          ================================================== */}

          <Route
            path="/analytics"
            element={
              <RoleProtectedRoute
                allowedRoles={[
                  "administrator",
                  "post_commander",
                ]}
              >
                <Analytics />
              </RoleProtectedRoute>
            }
          />


          {/* =================================================
              REPORTS

              Available to:
              - Administrator
              - Post Commander
          ================================================== */}

          <Route
            path="/reports"
            element={
              <RoleProtectedRoute
                allowedRoles={[
                  "administrator",
                  "post_commander",
                ]}
              >
                <Reports />
              </RoleProtectedRoute>
            }
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