import { NavLink } from "react-router-dom";

function Topbar() {
  const navItems = [
    { label: "Home", path: "/" },
    { label: "Live Overview", path: "/live-overview" },
    { label: "Analytics", path: "/analytics" },
    { label: "Threat Alerts", path: "/threat-alerts" },
    { label: "Reports", path: "/reports" },
  ];

  return (
    <>
      {/* Government Bar */}
      <div className="bg-[#071426] px-6 py-2 text-center text-xs text-white">
        <span className="mr-4 border-r border-gray-500 pr-4">
          Government of India
        </span>

        <span className="font-semibold text-[#f5a400]">
          Ministry of Defence
        </span>
      </div>

      {/* Main Navigation */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex min-h-[72px] items-center justify-between px-8">

          {/* Logo / Branding */}
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

          {/* Navigation */}
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

          {/* Officer Profile */}
          <div className="flex items-center gap-3 border-l border-gray-200 pl-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#071426] text-sm font-semibold text-white">
              O
            </div>

            <div className="leading-tight">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#53657d]">
                Officer
              </p>

              <p className="text-sm font-semibold text-[#071426]">
                Sunny
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