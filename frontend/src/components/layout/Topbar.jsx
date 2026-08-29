import { Bell, ChevronDown } from "lucide-react";

function Topbar() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-ibvap-border bg-ibvap-bg px-6">
      {/* Page context */}
      <div>
        <p className="text-sm font-medium text-white">
          Border Surveillance Command
        </p>
        <p className="text-xs text-ibvap-muted">
          Intelligent Video Analytics Platform
        </p>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-5">
        {/* System status */}
        <div className="hidden items-center gap-2 sm:flex">
          <span className="h-2 w-2 rounded-full bg-ibvap-success" />
          <span className="text-xs text-ibvap-muted">
            System Online
          </span>
        </div>

        {/* Notifications */}
        <button className="relative rounded-lg p-2 text-ibvap-muted transition hover:bg-ibvap-card hover:text-white">
          <Bell size={19} strokeWidth={1.8} />

          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-ibvap-danger" />
        </button>

        {/* User */}
        <button className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-ibvap-card">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ibvap-primary text-xs font-semibold text-white">
            A
          </div>

          <div className="hidden text-left sm:block">
            <p className="text-xs font-medium text-white">
              Administrator
            </p>
            <p className="text-[10px] text-ibvap-muted">
              Admin
            </p>
          </div>

          <ChevronDown size={15} className="text-ibvap-muted" />
        </button>
      </div>
    </header>
  );
}

export default Topbar;