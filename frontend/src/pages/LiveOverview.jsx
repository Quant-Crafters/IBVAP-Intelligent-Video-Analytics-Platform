import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Activity,
  AlertTriangle,
  Camera,
  Circle,
  Clock3,
  RefreshCw,
  ShieldCheck,
  Video,
} from "lucide-react";

import {
  getAlerts,
  getCameras,
  getEvents,
} from "../services/api";


/* =========================================================
   STATUS BADGE
========================================================= */

function StatusBadge({ status }) {
  const normalized = String(status || "").toLowerCase();

  const isOnline =
    normalized === "online" ||
    normalized === "active" ||
    normalized === "running";

  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
        isOnline
          ? "border-green-300 bg-green-50 text-green-700"
          : "border-slate-300 bg-slate-50 text-slate-600"
      }`}
    >
      <Circle
        size={7}
        fill="currentColor"
        className={
          isOnline
            ? "text-green-500"
            : "text-slate-400"
        }
      />

      {status || "unknown"}
    </span>
  );
}


/* =========================================================
   SEVERITY BADGE
========================================================= */

function SeverityBadge({ severity }) {
  const value = String(severity || "").toLowerCase();

  const classes = {
    critical:
      "border-red-300 bg-red-50 text-red-700",

    high:
      "border-orange-300 bg-orange-50 text-orange-700",

    medium:
      "border-amber-300 bg-amber-50 text-amber-700",

    low:
      "border-blue-300 bg-blue-50 text-blue-700",
  };

  return (
    <span
      className={`inline-flex border px-2 py-1 text-[10px] font-black uppercase tracking-wider ${
        classes[value] ||
        "border-slate-300 bg-slate-50 text-slate-600"
      }`}
    >
      {severity || "unknown"}
    </span>
  );
}


/* =========================================================
   DATE FORMATTER
========================================================= */

function formatTimestamp(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
}


/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function LiveOverview() {
  const [cameras, setCameras] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [events, setEvents] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");


  /* =======================================================
     LOAD BACKEND DATA
  ======================================================= */

  const loadData = useCallback(async (manual = false) => {
    try {
      if (manual) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      /*
       * Fetch all live overview data in parallel.
       *
       * Backend endpoints:
       * GET /api/cameras
       * GET /api/alerts/
       * GET /api/events
       */

      const [
        cameraData,
        alertData,
        eventData,
      ] = await Promise.all([
        getCameras(),
        getAlerts(),
        getEvents(),
      ]);

      setCameras(
        Array.isArray(cameraData)
          ? cameraData
          : []
      );

      setAlerts(
        Array.isArray(alertData)
          ? alertData
          : []
      );

      setEvents(
        Array.isArray(eventData)
          ? eventData
          : []
      );

    } catch (err) {
      console.error(
        "Live Overview backend error:",
        err
      );

      setError(
        err?.message ||
        "Unable to connect to the IBVAP backend."
      );

    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);


  /* =======================================================
     INITIAL LOAD + AUTO REFRESH
  ======================================================= */

  useEffect(() => {
    loadData();

    /*
     * Refresh live data every 5 seconds.
     */

    const interval = setInterval(() => {
      loadData(false);
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [loadData]);


  /* =======================================================
     ONLINE CAMERAS
  ======================================================= */

  const onlineCameras = useMemo(() => {
    return cameras.filter((camera) => {
      const status = String(
        camera?.status || ""
      ).toLowerCase();

      return (
        status === "online" ||
        status === "active" ||
        status === "running"
      );
    }).length;
  }, [cameras]);


  /* =======================================================
     ACTIVE ALERTS
  ======================================================= */

  const activeAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      return (
        String(alert?.status || "")
          .toLowerCase() === "active"
      );
    });
  }, [alerts]);


  /* =======================================================
     RECENT EVENTS
  ======================================================= */

  const recentEvents = useMemo(() => {
    return [...events]
      .sort((a, b) => {
        const timeA = new Date(
          a?.timestamp
        ).getTime();

        const timeB = new Date(
          b?.timestamp
        ).getTime();

        return timeB - timeA;
      })
      .slice(0, 8);
  }, [events]);


  /* =======================================================
     INITIAL LOADING SCREEN
  ======================================================= */

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-80px)] bg-[#f3f5f8]">

        <div className="flex min-h-[60vh] items-center justify-center">

          <div className="flex items-center gap-3 text-sm font-bold text-slate-600">

            <RefreshCw
              size={18}
              className="animate-spin"
            />

            Loading live surveillance data...

          </div>

        </div>

      </div>
    );
  }


  /* =======================================================
     PAGE
  ======================================================= */

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#f3f5f8] text-slate-900">

      <div className="mx-auto max-w-[1600px] p-5 sm:p-6 lg:p-8">


        {/* =================================================
            HEADER
        ================================================= */}

        <div className="mb-6 flex flex-col justify-between gap-4 border-b border-slate-300 pb-5 md:flex-row md:items-end">

          <div>

            <div className="mb-2 flex items-center gap-2">

              <span className="h-2 w-2 rounded-full bg-green-500" />

              <span className="text-[10px] font-mono font-black uppercase tracking-[0.2em] text-green-700">
                Live Operations
              </span>

            </div>

            <h1 className="text-3xl font-black tracking-tight text-[#0b192c]">
              Live Overview
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Real-time surveillance status from the IBVAP backend.
            </p>

          </div>


          {/* REFRESH BUTTON */}

          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 border border-[#0b192c] bg-[#0b192c] px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >

            <RefreshCw
              size={15}
              className={
                refreshing
                  ? "animate-spin"
                  : ""
              }
            />

            {refreshing
              ? "Refreshing..."
              : "Refresh"}

          </button>

        </div>


        {/* =================================================
            BACKEND ERROR
        ================================================= */}

        {error && (
          <div className="mb-6 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">

            <strong>
              Backend connection error:
            </strong>{" "}

            {error}

          </div>
        )}


        {/* =================================================
            KPI CARDS
        ================================================= */}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">


          {/* TOTAL CAMERAS */}

          <div className="border border-slate-300 bg-white p-5 shadow-sm">

            <div className="flex items-start justify-between">

              <div>

                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Total Cameras
                </p>

                <p className="mt-3 text-3xl font-black text-[#0b192c]">
                  {cameras.length}
                </p>

              </div>

              <div className="border border-slate-200 bg-slate-50 p-2.5">

                <Camera
                  size={20}
                  className="text-[#0b192c]"
                />

              </div>

            </div>

          </div>


          {/* ONLINE CAMERAS */}

          <div className="border border-slate-300 bg-white p-5 shadow-sm">

            <div className="flex items-start justify-between">

              <div>

                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Cameras Online
                </p>

                <p className="mt-3 text-3xl font-black text-green-700">
                  {onlineCameras}
                </p>

              </div>

              <div className="border border-green-200 bg-green-50 p-2.5">

                <Video
                  size={20}
                  className="text-green-700"
                />

              </div>

            </div>

          </div>


          {/* ACTIVE ALERTS */}

          <div className="border border-slate-300 bg-white p-5 shadow-sm">

            <div className="flex items-start justify-between">

              <div>

                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Active Threat Alerts
                </p>

                <p className="mt-3 text-3xl font-black text-red-700">
                  {activeAlerts.length}
                </p>

              </div>

              <div className="border border-red-200 bg-red-50 p-2.5">

                <AlertTriangle
                  size={20}
                  className="text-red-700"
                />

              </div>

            </div>

          </div>


          {/* EVENTS */}

          <div className="border border-slate-300 bg-white p-5 shadow-sm">

            <div className="flex items-start justify-between">

              <div>

                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Recorded Events
                </p>

                <p className="mt-3 text-3xl font-black text-[#0b192c]">
                  {events.length}
                </p>

              </div>

              <div className="border border-slate-200 bg-slate-50 p-2.5">

                <Activity
                  size={20}
                  className="text-[#0b192c]"
                />

              </div>

            </div>

          </div>

        </div>


        {/* =================================================
            CAMERA + ALERTS
        ================================================= */}

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">


          {/* =================================================
              CAMERA NETWORK
          ================================================= */}

          <section className="border border-slate-300 bg-white shadow-sm">

            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">

              <div>

                <h2 className="font-black text-[#0b192c]">
                  Camera Network
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Current camera status reported by the backend.
                </p>

              </div>

              <Camera
                size={18}
                className="text-slate-400"
              />

            </div>


            <div className="divide-y divide-slate-200">

              {cameras.length === 0 ? (

                <div className="px-5 py-10 text-center">

                  <Camera
                    size={30}
                    className="mx-auto text-slate-300"
                  />

                  <p className="mt-3 text-sm font-bold text-slate-700">
                    No cameras registered
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    The backend currently has no camera records.
                  </p>

                </div>

              ) : (

                cameras.map((camera) => (

                  <div
                    key={camera.id}
                    className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >

                    <div>

                      <p className="font-bold text-[#0b192c]">
                        {camera.name ||
                          `Camera #${camera.id}`}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {camera.location ||
                          "Location unavailable"}
                      </p>

                    </div>

                    <StatusBadge
                      status={camera.status}
                    />

                  </div>

                ))

              )}

            </div>

          </section>


          {/* =================================================
              ACTIVE ALERTS
          ================================================= */}

          <section className="border border-slate-300 bg-white shadow-sm">

            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">

              <div>

                <h2 className="font-black text-[#0b192c]">
                  Active Threat Alerts
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Alerts currently marked active.
                </p>

              </div>

              <ShieldCheck
                size={18}
                className="text-slate-400"
              />

            </div>


            <div className="divide-y divide-slate-200">

              {activeAlerts.length === 0 ? (

                <div className="px-5 py-10 text-center">

                  <ShieldCheck
                    size={30}
                    className="mx-auto text-green-600"
                  />

                  <p className="mt-3 text-sm font-bold text-slate-700">
                    No active alerts
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    The backend currently reports no active threats.
                  </p>

                </div>

              ) : (

                activeAlerts
                  .slice(0, 6)
                  .map((alert) => (

                    <div
                      key={alert.id}
                      className="px-5 py-4"
                    >

                      <div className="flex items-start justify-between gap-3">

                        <div>

                          <p className="font-bold text-[#0b192c]">
                            {alert.type ||
                              "Unknown Alert"}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Camera #{alert.camera_id}
                          </p>

                        </div>

                        <SeverityBadge
                          severity={alert.severity}
                        />

                      </div>

                      <div className="mt-3 flex items-center gap-2 text-[10px] font-mono text-slate-500">

                        <Clock3 size={12} />

                        {formatTimestamp(
                          alert.timestamp
                        )}

                      </div>

                    </div>

                  ))

              )}

            </div>

          </section>

        </div>


        {/* =================================================
            RECENT EVENTS
        ================================================= */}

        <section className="mt-6 border border-slate-300 bg-white shadow-sm">

          <div className="border-b border-slate-200 px-5 py-4">

            <h2 className="font-black text-[#0b192c]">
              Recent Events
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Latest events recorded by the IBVAP backend.
            </p>

          </div>


          <div className="overflow-x-auto">

            {recentEvents.length === 0 ? (

              <div className="px-5 py-10 text-center">

                <Activity
                  size={30}
                  className="mx-auto text-slate-300"
                />

                <p className="mt-3 text-sm font-bold text-slate-700">
                  No events recorded
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  The backend currently has no event records.
                </p>

              </div>

            ) : (

              <table className="w-full min-w-[800px]">

                <thead className="bg-slate-50">

                  <tr className="border-b border-slate-200 text-left">

                    <th className="px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Type
                    </th>

                    <th className="px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Camera
                    </th>

                    <th className="px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Severity
                    </th>

                    <th className="px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Message
                    </th>

                    <th className="px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Time
                    </th>

                  </tr>

                </thead>


                <tbody className="divide-y divide-slate-200">

                  {recentEvents.map((event) => (

                    <tr key={event.id}>

                      <td className="px-5 py-4 text-sm font-bold text-[#0b192c]">
                        {event.type ||
                          "Unknown"}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        #{event.camera_id}
                      </td>

                      <td className="px-5 py-4">
                        <SeverityBadge
                          severity={event.severity}
                        />
                      </td>

                      <td className="max-w-sm px-5 py-4 text-sm text-slate-600">
                        {event.message || "—"}
                      </td>

                      <td className="px-5 py-4 text-xs font-mono text-slate-500">
                        {formatTimestamp(
                          event.timestamp
                        )}
                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            )}

          </div>

        </section>

      </div>

    </div>
  );
}