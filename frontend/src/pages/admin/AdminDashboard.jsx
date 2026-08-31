import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  Camera,
  Users,
  ArrowRight,
} from "lucide-react";

export default function AdminDashboard() {
  const navigate = useNavigate();

  const actions = [
    {
      title: "Camera Management",
      description: "Manage registered CCTV cameras and their current status.",
      icon: Camera,
      path: "/admin/cameras",
    },
    {
      title: "User Management",
      description: "Manage platform users and their assigned roles.",
      icon: Users,
      path: "/admin/users",
    },
    {
      title: "System Health",
      description: "Check backend availability and registered camera status.",
      icon: Activity,
      path: "/admin/system-health",
    },
  ];

  return (
    <div className="min-h-[calc(100vh-77px)] bg-slate-100">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-10">
        <div className="mb-8 border-b border-slate-300 pb-6">
          <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-[#b87800]">
            Administration
          </p>

          <h1 className="mt-1 text-3xl font-black tracking-tight text-[#071426]">
            Administrator Dashboard
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Manage the IBVAP platform from a dedicated administrator workspace.
          </p>
        </div>

        <section className="grid gap-5 md:grid-cols-3">
          {actions.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className="group border border-slate-300 bg-white p-6 text-left transition hover:border-[#071426] hover:shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center bg-slate-100 text-[#071426]">
                    <Icon size={19} />
                  </div>

                  <ArrowRight
                    size={17}
                    className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-[#071426]"
                  />
                </div>

                <h2 className="mt-6 text-lg font-black text-[#071426]">
                  {item.title}
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {item.description}
                </p>
              </button>
            );
          })}
        </section>
      </div>
    </div>
  );
}
