function Dashboard() {
  return (
    <div>
      <div className="mb-6">
        <p className="text-sm text-ibvap-muted">
          Overview
        </p>

        <h1 className="mt-1 text-2xl font-semibold text-white">
          Dashboard
        </h1>

        <p className="mt-1 text-sm text-ibvap-muted">
          Border surveillance and security overview
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          "Total Cameras",
          "Online Cameras",
          "Active Alerts",
          "Critical Alerts",
        ].map((title) => (
          <div
            key={title}
            className="rounded-xl border border-ibvap-border bg-ibvap-card p-5"
          >
            <p className="text-sm text-ibvap-muted">
              {title}
            </p>

            <p className="mt-3 text-3xl font-semibold text-white">
              —
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;