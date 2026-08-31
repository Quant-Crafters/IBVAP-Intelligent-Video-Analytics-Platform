import { NavLink } from "react-router-dom";
import { useMemo } from "react";

function Topbar() {
  // Get the currently authenticated user from localStorage.
  const user = useMemo(() => {
    try {
      const storedUser = localStorage.getItem("ibvap_user");
      return storedUser ? JSON.parse(storedUser) : null;
    } catch (error) {
      console.error("Failed to read authenticated user:", error);
      return null;
    }
  }, []);

  const role = user?.role || "";

  /*
   * ============================================================
   * ROLE-BASED NAVIGATION
   * ============================================================
   *
   * Administrator:
   * - Home
   * - Live Overview
   * - Analytics
   * - Threat Alerts
   * - Reports
   *
   * Post Commander:
   * - Home
   * - Live Overview
   * - Analytics
   * - Threat Alerts
   * - Reports
   *
   * Security Sentry:
   * - Home
   * - Live Overview
   * - Threat Alerts
   */

  const navItems = useMemo(() => {
    const commonItems = [
      { label: "Home", path: "/" },
      { label: "Live Overview", path: "/live-overview" },
    ];

    switch (role) {
      case "administrator":
        return [
          ...commonItems,
          { label: "Analytics", path: "/analytics" },
          { label: "Threat Alerts", path: "/threat-alerts" },
          { label: "Reports", path: "/reports" },
        ];

      case "post_commander":
        return [
          ...commonItems,
          { label: "Analytics", path: "/analytics" },
          { label: "Threat Alerts", path: "/threat-alerts" },
          { label: "Reports", path: "/reports" },
        ];

      case "security_sentry":
        return [
          ...commonItems,
          { label: "Threat Alerts", path: "/threat-alerts" },
        ];

      default:
        return commonItems;
    }
  }, [role]);

  /*
   * Human-readable role names.
   */
  const roleDisplayNames = {
    administrator: "Administrator",
    post_commander: "Post Commander",
    security_sentry: "Security Sentry",
  };

  const displayRole =
    roleDisplayNames[role] || "Officer";

  /*
   * Display the authenticated user's actual name.
   * No hardcoded username.
   */
  const displayName = user?.name || "Officer";

  /*
   * Generate initials from the authenticated user's name.
   */
  const initials = displayName
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      {/* =====================================================
          GOVERNMENT BAR
      ====================================================== */}

      <div className="bg-[#071426] px-6 py-2 text-center text-xs text-white">
        <span className="mr-4 border-r border-gray-500 pr-4">
          Government of India
        </span>

        <span className="font-semibold text-[#f5a400]">
          Ministry of Defence
        </span>
      </div>

      {/* =====================================================
          MAIN NAVIGATION
      ====================================================== */}

      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex min-h-[72px] items-center justify-between px-8">

          {/* =================================================
              LOGO / BRANDING
          ================================================== */}

          <NavLink
            to="/"
            className="flex flex-col leading-none"
          >
            <span className="text-xl font-bold tracking-tight text-[#071426]">
              INTELLIGENT CCTV
            </span>

            <span className="mt-1 text-[11px] text-[#53657d]">
              Defence Video Analytics & Border Surveillance System
            </span>
          </NavLink>

          {/* =================================================
              ROLE-BASED NAVIGATION
          ================================================== */}

          <nav className="flex items-center gap-7">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `relative py-6 text-sm font-semibold transition-colors ${
                    isActive
                      ? "text-[#071426]"
                      : "text-[#1c2d42] hover:text-[#f5a400]"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {item.label}

                    {isActive && (
                      <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#f5a400]" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* =================================================
              OFFICER PROFILE
          ================================================== */}

          <div className="flex items-center gap-3 border-l border-gray-200 pl-6">

            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#071426] text-sm font-semibold text-white">
              {initials || "O"}
            </div>

            <div className="leading-tight">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#53657d]">
                {displayRole}
              </p>

              <p className="text-sm font-semibold text-[#071426]">
                {displayName}
              </p>
            </div>

            <span className="ml-1 text-xs text-[#53657d]">
              ▼
            </span>

          </div>

        </div>
      </header>
    </>
  );
}

export default Topbar;