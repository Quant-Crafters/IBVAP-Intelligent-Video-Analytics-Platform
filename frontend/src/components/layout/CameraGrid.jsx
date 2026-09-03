import React, { useMemo, useState } from "react";
import { Camera, Maximize2, VideoOff } from "lucide-react";
import { liveStreamUrl } from "../../services/api";

/*
 * Reusable camera-grid UI.
 *
 * Surfacing live MJPEG feeds via the backend proxy (/api/cameras/:id/live).
 */

function CameraCard({ camera }) {
  const [videoFailed, setVideoFailed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const status = String(camera?.status || "offline").toLowerCase();
  const online =
    status === "online" ||
    status === "active" ||
    status === "running";

  const streamURL = camera?.id ? liveStreamUrl(camera.id) : null;

  const openFullscreen = (event) => {
    event.stopPropagation();
    setFullscreen(true);
  };

  const closeFullscreen = () => {
    setFullscreen(false);
  };

  return (
    <>
      <article className="overflow-hidden border border-slate-300 bg-white shadow-sm">
        <div className="relative aspect-video bg-[#071426]">

          {online && streamURL && !videoFailed ? (
            <img
              src={streamURL}
              alt={camera?.name || `Camera ${camera?.id ?? "—"}`}
              onError={() => setVideoFailed(true)}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
              <VideoOff size={30} className="text-slate-500" />

              <p className="mt-3 text-xs font-black uppercase tracking-wider text-white">
                Live Feed Unavailable
              </p>

              <p className="mt-2 max-w-xs text-[10px] leading-5 text-slate-400">
                {online
                  ? "Live MJPEG stream could not be loaded from backend proxy."
                  : "This camera is currently offline."}
              </p>
            </div>
          )}

          {/* Camera identity */}
          <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between bg-gradient-to-b from-black/80 to-transparent px-4 py-4">
            <div className="min-w-0">
              <p className="truncate text-xs font-black uppercase tracking-wider text-white">
                {camera?.name || `Camera ${camera?.id ?? "—"}`}
              </p>

              <p className="mt-1 truncate text-[9px] font-mono text-slate-300">
                {camera?.location || "Location unavailable"}
              </p>
            </div>

            <span
              className={`flex shrink-0 items-center gap-1.5 text-[9px] font-mono font-bold uppercase tracking-wider ${
                online ? "text-green-300" : "text-red-300"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  online ? "bg-green-400" : "bg-red-400"
                }`}
              />
              {camera?.status || "offline"}
            </span>
          </div>

          <button
            type="button"
            onClick={openFullscreen}
            className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1.5 border border-white/30 bg-black/55 px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-white backdrop-blur-sm hover:bg-black/75"
          >
            <Maximize2 size={13} />
            View
          </button>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-black text-[#0b192c]">
              {camera?.name || `Camera ${camera?.id ?? "—"}`}
            </p>

            <p className="mt-0.5 truncate text-[10px] text-slate-500">
              {camera?.location || "Location unavailable"}
            </p>
          </div>

          <div className="ml-3 flex shrink-0 items-center gap-2 text-[9px] font-mono uppercase tracking-wider text-slate-400">
            <Camera size={13} />
            Camera
          </div>
        </div>
      </article>

      {fullscreen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-5"
          onClick={closeFullscreen}
        >
          <div
            className="relative w-full max-w-6xl overflow-hidden border border-slate-700 bg-[#071426]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent px-5 py-5">
              <div>
                <p className="text-sm font-black uppercase tracking-wider text-white">
                  {camera?.name || `Camera ${camera?.id ?? "—"}`}
                </p>

                <p className="mt-1 text-[10px] font-mono text-slate-300">
                  {camera?.location || "Location unavailable"}
                </p>
              </div>

              <button
                type="button"
                onClick={closeFullscreen}
                className="border border-white/30 bg-black/50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-black/80"
              >
                Close
              </button>
            </div>

            <div className="aspect-video bg-[#071426]">
              {online && streamURL && !videoFailed ? (
                <img
                  src={streamURL}
                  alt={camera?.name || `Camera ${camera?.id ?? "—"}`}
                  onError={() => setVideoFailed(true)}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full items-center justify-center px-8 text-center">
                  <div>
                    <VideoOff
                      size={36}
                      className="mx-auto text-slate-500"
                    />

                    <p className="mt-4 text-sm font-black uppercase tracking-wider text-white">
                      Stream Cannot Be Played
                    </p>

                    <p className="mt-2 text-xs leading-5 text-slate-400">
                      {online
                        ? "Live MJPEG stream unavailable."
                        : "Camera is offline."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function CameraGrid({
  cameras = [],
  title = "Live CCTV",
  emptyMessage = "No cameras registered.",
}) {
  const list = useMemo(
    () => (Array.isArray(cameras) ? cameras : []),
    [cameras]
  );

  return (
    <section>
      <div className="mb-5 flex items-end justify-between gap-4 border-b border-slate-300 pb-4">
        <div>
          <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#b87800]">
            Surveillance
          </p>

          <h2 className="mt-1 text-xl font-black tracking-tight text-[#071426]">
            {title}
          </h2>
        </div>

        <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
          {list.length} camera{list.length === 1 ? "" : "s"}
        </p>
      </div>

      {list.length === 0 ? (
        <div className="border border-slate-300 bg-white px-6 py-12 text-center">
          <Camera size={28} className="mx-auto text-slate-400" />

          <p className="mt-3 text-sm font-bold text-slate-600">
            {emptyMessage}
          </p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {list.map((camera) => (
            <CameraCard
              key={camera.id}
              camera={camera}
            />
          ))}
        </div>
      )}
    </section>
  );
}
