import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export default function AdminDashboard() {
  const navigate = useNavigate();

  const actions = [
    {
      title: "Camera Management",
      description: "Manage registered CCTV cameras and their current status.",
      path: "/admin/cameras",
      accent: "blue",
    },
    {
      title: "User Management",
      description: "Manage platform users and their assigned roles.",
      path: "/admin/users",
      accent: "violet",
    },
    {
      title: "System Health",
      description: "Check backend availability and registered camera status.",
      path: "/admin/system-health",
      accent: "emerald",
    },
  ];

  const accentStyles = {
    blue: "bg-blue-500",
    violet: "bg-violet-500",
    emerald: "bg-emerald-500",
  };

  return (
    <div className="min-h-[calc(100vh-77px)] bg-slate-100">
      <style>{`
        @keyframes adminFadeUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .admin-fade-up {
          animation: adminFadeUp 0.45s ease-out both;
        }
      `}</style>

      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-10">

        {/* Header */}
        <div className="admin-fade-up mb-8 border-b border-slate-300 pb-6">


          <h1 className="mt-1 text-3xl font-black tracking-tight text-[#071426]">
            Administrator Dashboard
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Manage the IBVAP platform from a dedicated administrator workspace.
          </p>
        </div>

        {/* Action Cards */}
        <section className="grid gap-5 md:grid-cols-3">
          {actions.map((item, index) => (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              className="admin-fade-up group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl"
              style={{
                animationDelay: `${index * 80}ms`,
              }}
            >
              {/* Animated accent line */}
              <div
                className={`absolute left-0 top-0 h-1 w-0 ${
                  accentStyles[item.accent]
                } transition-all duration-300 group-hover:w-full`}
              />

              <div className="flex items-start justify-between">
                <div>
                  <p
                    className={`text-[10px] font-bold uppercase tracking-[0.2em] ${
                      item.accent === "blue"
                        ? "text-blue-600"
                        : item.accent === "violet"
                        ? "text-violet-600"
                        : "text-emerald-600"
                    }`}
                  >

                  </p>

                  <h2 className="mt-3 text-lg font-black tracking-tight text-[#071426]">
                    {item.title}
                  </h2>
                </div>

                <ArrowRight
                  size={17}
                  className="mt-1 text-slate-300 transition-all duration-300 group-hover:translate-x-1 group-hover:text-[#071426]"
                />
              </div>

              <p className="mt-3 text-sm leading-6 text-slate-500">
                {item.description}
              </p>

              <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 transition-colors group-hover:text-slate-600">
                  Open module
                </span>


              </div>
            </button>
          ))}
        </section>
      </div>
    </div>
  );
}
