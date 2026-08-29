import {
  LayoutDashboard,
  Video,
  ShieldAlert,
  History,
  Camera,
  ScanLine,
  Users,
  Settings,
} from "lucide-react";

const navigation = [
  {
    section: "OVERVIEW",
    items: [
      {
        label: "Dashboard",
        icon: LayoutDashboard,
        path: "/dashboard",
      },
      {
        label: "Live Surveillance",
        icon: Video,
        path: "/live",
      },
      {
        label: "Alerts",
        icon: ShieldAlert,
        path: "/alerts",
      },
      {
        label: "Event History",
        icon: History,
        path: "/events",
      },
    ],
  },
  {
    section: "MANAGEMENT",
    items: [
      {
        label: "Cameras",
        icon: Camera,
        path: "/cameras",
      },
      {
        label: "Virtual Zones",
        icon: ScanLine,
        path: "/zones",
      },
    ],
  },
  {
    section: "ADMINISTRATION",
    items: [
      {
        label: "Users",
        icon: Users,
        path: "/users",
      },
      {
        label: "Settings",
        icon: Settings,
        path: "/settings",
      },
    ],
  },
];

function Sidebar() {
  return (
    <aside className="flex h-screen w-64 flex-col border-r border-ibvap-border bg-ibvap-surface">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-ibvap-border px-5">
        <div>
          <h1 className="text-lg font-bold tracking-wide text-white">
            IBVAP
          </h1>
          <p className="text-[10px] uppercase tracking-wider text-ibvap-muted">
            Border Intelligence
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-5">
        {navigation.map((group) => (
          <div key={group.section} className="mb-6">
            <p className="mb-2 px-3 text-[10px] font-semibold tracking-widest text-ibvap-subtle">
              {group.section}
            </p>

            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;

                return (
                  <button
                    key={item.path}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ibvap-muted transition hover:bg-ibvap-card-hover hover:text-white"
                  >
                    <Icon size={18} strokeWidth={1.8} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* System Status */}
      <div className="border-t border-ibvap-border p-4">
        <div className="flex items-center gap-2 rounded-lg bg-ibvap-card px-3 py-2.5">
          <span className="h-2 w-2 rounded-full bg-ibvap-success" />

          <div>
            <p className="text-xs font-medium text-white">
              System Online
            </p>
            <p className="text-[10px] text-ibvap-muted">
              All services operational
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;