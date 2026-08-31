import React, { useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { ChevronDown, LogOut } from "lucide-react";

function getStoredUser() {
  try {
    const raw = localStorage.getItem("ibvap_user");
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error("Failed to read authenticated user:", error);
    return null;
  }
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);

  const user = useMemo(() => getStoredUser(), []);
  const displayName = user?.name || "Administrator";

  const initials = displayName
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const navItems = [
    { label: "Dashboard", path: "/admin" },
    { label: "Cameras", path: "/admin/cameras" },
    { label: "Live Camera Grid", path: "/admin/live-camera-grid" },
    { label: "Users", path: "/admin/users" },
    { label: "System Health", path: "/admin/system-health" },
  ];

  const handleLogout = () => {
    localStorage.removeItem("ibvap_token");
    localStorage.removeItem("ibvap_user");
    setProfileOpen(false);
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-300 bg-white">
        <div className="mx-auto flex min-h-[76px] max-w-7xl items-center justify-between px-5 sm:px-8">

          {/* BRAND */}
          <NavLink
            to="/admin"
            className="flex flex-col leading-none"
          >
            <span className="text-xl font-bold tracking-tight text-[#071426]">
              INTELLIGENT CCTV
            </span>

            <span className="mt-1 text-[11px] text-[#53657d]">
              Defence Video Analytics & Border Surveillance System
            </span>
          </NavLink>

          {/* DESKTOP NAV */}
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/admin"}
                className={({ isActive }) =>
                  `px-4 py-6 text-xs font-bold uppercase tracking-wider transition ${
                    isActive
                      ? "text-[#071426] border-b-2 border-[#f5a400]"
                      : "text-slate-500 hover:text-[#071426]"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* ADMIN PROFILE */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen((value) => !value)}
              className="flex items-center gap-3"
              aria-expanded={profileOpen}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#071426] text-xs font-bold text-white">
                {initials || "A"}
              </div>

              <div className="hidden text-left sm:block">
                <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
                  Administrator
                </p>

                <p className="text-sm font-semibold text-[#071426]">
                  {displayName}
                </p>
              </div>

              <ChevronDown
                size={14}
                className={`text-slate-400 transition-transform ${
                  profileOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-56 border border-slate-300 bg-white shadow-xl">

                <div className="border-b border-slate-200 px-4 py-4">
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    Signed in as
                  </p>

                  <p className="mt-1 truncate text-sm font-black text-[#071426]">
                    {displayName}
                  </p>
                </div>

                <div className="p-2">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-red-700 hover:bg-red-50"
                  >
                    <LogOut size={15} />
                    Logout
                  </button>
                </div>

              </div>
            )}
          </div>
        </div>

        {/* MOBILE NAV */}
        <div className="border-t border-slate-200 md:hidden">
          <nav className="flex overflow-x-auto px-4">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/admin"}
                className={({ isActive }) =>
                  `whitespace-nowrap px-4 py-3 text-[10px] font-bold uppercase tracking-wider ${
                    isActive
                      ? "border-b-2 border-[#f5a400] text-[#071426]"
                      : "text-slate-500"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
}