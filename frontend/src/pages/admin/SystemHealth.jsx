import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { apiRequest, getHealth } from "../../services/api";

const REFRESH_INTERVAL = 10000;

function isOnline(status) {
  return String(status || "").trim().toLowerCase() === "online";
}

function normalizeCameras(payload) {
  if (Array.isArray(payload?.cameras)) return payload.cameras;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
}

export default function SystemHealth() {
  const navigate = useNavigate();

  const [health, setHealth] = useState(null);
  const [cameras, setCameras] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [healthError, setHealthError] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [lastChecked, setLastChecked] = useState(null);

  const loadSystemHealth = useCallback(async () => {
    setHealthError("");
    setCameraError("");

    try {
      const healthPayload = await getHealth();

      setHealth(healthPayload);

      try {
        const cameraPayload = await apiRequest("/cameras");
        setCameras(normalizeCameras(cameraPayload));
      } catch (error) {
        console.error("Camera health error:", error);

        setCameraError(
          error instanceof Error
            ? error.message
            : "Unable to load camera status."
        );

        setCameras([]);
      }

      setLastChecked(new Date());
    } catch (error) {
      console.error("Backend health error:", error);

      setHealth(null);

      setHealthError(
        error instanceof Error
          ? error.message
          : "Unable to check system health."
      );

      setLastChecked(new Date());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("ibvap_token");

    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    loadSystemHealth();

    const interval = window.setInterval(
      loadSystemHealth,
      REFRESH_INTERVAL
    );

    return () => window.clearInterval(interval);
  }, [navigate, loadSystemHealth]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadSystemHealth();
  };

  const onlineCount = useMemo(
    () =>
      cameras.filter((camera) => isOnline(camera?.status)).length,
    [cameras]
  );

  const offlineCount = cameras.length - onlineCount;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-emerald-50/30 text-slate-900">
      <style>{`
        @keyframes healthFadeUp {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes healthFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes healthRowIn {
          from {
            opacity: 0;
            transform: translateX(-8px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes healthPulse {
          0%,
          100% {
            transform: scale(1);
            opacity: 1;
          }

          50% {
            transform: scale(1.15);
            opacity: 0.65;
          }
        }

        .health-fade-up {
          animation: healthFadeUp 0.5s ease-out both;
        }

        .health-fade-in {
          animation: healthFadeIn 0.4s ease-out both;
        }

        .health-row-in {
          animation: healthRowIn 0.45s ease-out both;
        }

        .health-pulse {
          animation: healthPulse 2s ease-in-out infinite;
        }
      `}</style>

      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-10">

        {/* Header */}
        <div
          className="health-fade-up mb-7 flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <button
              type="button"
              onClick={() => navigate("/admin")}
              className="mb-4 inline-flex items-center gap-2 rounded-lg px-1 py-1 text-xs font-bold uppercase tracking-wider text-slate-500 transition-all duration-200 hover:-translate-x-0.5 hover:text-[#071426]"
            >
              <ArrowLeft size={14} />
              Administrator Dashboard
            </button>



            <h1 className="mt-1 text-3xl font-black tracking-tight text-[#071426]">
              System Health
            </h1>



            {lastChecked && (
              <p className="mt-2 text-[10px] font-mono text-slate-400">
                Last checked: {lastChecked.toLocaleTimeString()}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-600 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>

        {/* Backend health */}
        <section
          className="health-fade-up overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-[0_12px_35px_rgba(16,185,129,0.07)] transition-all duration-300 hover:shadow-[0_16px_42px_rgba(16,185,129,0.11)]"
          style={{ animationDelay: "80ms" }}
        >
          <div className="border-b border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-cyan-50 px-6 py-4">
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-emerald-600">
              Backend Service
            </p>
          </div>

          {loading ? (
            <div className="health-fade-in px-6 py-10">
              <p className="text-xs font-mono uppercase tracking-wider text-slate-400">
                Checking backend...
              </p>
            </div>
          ) : healthError ? (
            <div className="health-fade-in bg-gradient-to-r from-red-50 via-white to-white px-6 py-6">
              <p className="text-sm font-black text-red-700">
                Backend unavailable
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                {healthError}
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between px-6 py-6 transition-colors duration-200 hover:bg-emerald-50/30">
              <div className="flex items-center gap-3">


                <div>
                  <p className="text-sm font-black text-[#071426]">
                    {health?.service || "IBVAP backend"}
                  </p>

                  <p className="mt-1 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                    Root health endpoint
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="health-pulse h-2.5 w-2.5 rounded-full bg-emerald-500" />

                <span className="text-xs font-black uppercase tracking-wider text-emerald-700">
                  {health?.status || "ok"}
                </span>
              </div>
            </div>
          )}
        </section>

        {/* CCTV health */}
        <section
          className="health-fade-up mt-6 overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-[0_12px_35px_rgba(37,99,235,0.07)] transition-all duration-300 hover:shadow-[0_16px_42px_rgba(37,99,235,0.11)]"
          style={{ animationDelay: "160ms" }}
        >
          <div className="flex flex-col gap-3 border-b border-blue-100 bg-gradient-to-r from-blue-50 via-white to-violet-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-blue-600">
                CCTV Network
              </p>

              <p className="mt-1 text-sm font-black text-[#071426]">
                Camera Status
              </p>
            </div>

            {!loading && !cameraError && (
              <p className="rounded-full bg-slate-50 px-3 py-1.5 text-xs font-mono text-slate-500">
                {cameras.length} total · {onlineCount} online ·{" "}
                {offlineCount} offline
              </p>
            )}
          </div>

          {loading ? (
            <div className="health-fade-in px-6 py-12 text-center">
              <p className="text-xs font-mono uppercase tracking-wider text-slate-400">
                Checking cameras...
              </p>
            </div>
          ) : cameraError ? (
            <div className="health-fade-in bg-gradient-to-r from-red-50 via-white to-white px-6 py-6">
              <p className="text-sm font-black text-red-700">
                Camera status unavailable
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                {cameraError}
              </p>
            </div>
          ) : cameras.length === 0 ? (
            <div className="health-fade-in px-6 py-12 text-center">
              <p className="text-sm font-bold text-slate-600">
                No cameras registered
              </p>

              <p className="mt-1 text-xs text-slate-400">
                No camera records were returned by the backend.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {cameras.map((camera, index) => {
                const online = isOnline(camera?.status);

                return (
                  <div
                    key={camera.id}
                    className="health-row-in group flex flex-col gap-3 px-6 py-5 transition-all duration-300 hover:bg-gradient-to-r hover:from-blue-50/30 hover:via-white hover:to-emerald-50/30 sm:flex-row sm:items-center sm:justify-between"
                    style={{
                      animationDelay: `${index * 70}ms`,
                    }}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-sm font-black text-[#071426] transition-colors duration-200 group-hover:text-blue-700">
                          {camera?.name ||
                            `Camera ${camera?.id ?? "—"}`}
                        </p>

                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-mono text-slate-400 transition-colors duration-200 group-hover:bg-slate-200">
                          ID {camera?.id ?? "—"}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-slate-500">
                        {camera?.location || "Location unavailable"}
                      </p>
                    </div>

                    <span
                      className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-wider ring-1 ${
                        online
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                          : "bg-red-50 text-red-700 ring-red-100"
                      }`}
                    >
                      <span
                        className={`health-pulse h-1.5 w-1.5 rounded-full ${
                          online ? "bg-emerald-500" : "bg-red-500"
                        }`}
                      />

                      {camera?.status || "unknown"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
