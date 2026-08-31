import React, { useCallback, useEffect, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import CameraGrid from "../components/layout/CameraGrid";
import { apiRequest } from "../services/api";

export default function LiveCameraGrid() {
  const navigate = useNavigate();

  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadCameras = useCallback(async () => {
    setErrorMessage("");

    try {
      const data = await apiRequest("/cameras");

      const nextCameras = Array.isArray(data?.cameras)
        ? data.cameras
        : Array.isArray(data)
          ? data
          : [];

      setCameras(nextCameras);
    } catch (error) {
      console.error("Live camera grid error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load camera data."
      );
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

    loadCameras();
  }, [loadCameras, navigate]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadCameras();
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <main className="mx-auto max-w-[1600px] px-5 py-8 lg:px-8">

        <div className="mb-7 flex flex-col gap-4 border-b border-slate-300 pb-6 sm:flex-row sm:items-end sm:justify-between">

          <div>
            <button
              type="button"
              onClick={() => navigate("/admin")}
              className="mb-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 transition hover:text-[#071426]"
            >
              <ArrowLeft size={14} />
              Return to Live Overview
            </button>

            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-[#b87800]">
              Surveillance
            </p>

            <h1 className="mt-1 text-3xl font-black tracking-tight text-[#071426]">
              Live Camera Grid
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Live CCTV feeds from cameras registered in IBVAP.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-600 transition hover:border-[#071426] hover:text-[#071426] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>

        </div>

        {loading ? (
          <div className="flex min-h-[480px] items-center justify-center border border-slate-300 bg-white">
            <p className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Loading cameras...
            </p>
          </div>
        ) : errorMessage ? (
          <div className="flex min-h-[320px] items-center justify-center border border-red-200 bg-white px-6 text-center">
            <div>
              <p className="text-sm font-black text-red-700">
                Camera data unavailable
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                {errorMessage}
              </p>
            </div>
          </div>
        ) : (
          <CameraGrid
            cameras={cameras}
            title="Live CCTV"
            emptyMessage="No cameras have been registered in the backend."
          />
        )}

      </main>
    </div>
  );
}
