import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Pencil, Plus, Trash2, X } from "lucide-react";
import { apiRequest, cameraAction } from "../../services/api";

const EMPTY_FORM = {
  camera_id: "",
  name: "",
  stream_url: "",
  camera_type: "ip_webcam",
  location: "",
  status: "offline",
};

export default function CameraManagement() {
  const navigate = useNavigate();

  const [cameras, setCameras] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const editing = editingId !== null;

  const loadCameras = async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const data = await apiRequest("/cameras");
      setCameras(Array.isArray(data?.cameras) ? data.cameras : []);
    } catch (error) {
      console.error("Failed to load cameras:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load cameras."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCameras();
  }, []);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const startEdit = (camera) => {
    setSuccessMessage("");
    setErrorMessage("");

    setEditingId(camera.id);
    setForm({
      camera_id: camera.camera_id || "",
      name: camera.name || "",
      stream_url: camera.stream_url || "",
      camera_type: camera.camera_type || "ip_webcam",
      location: camera.location || "",
      status: String(camera.status || "offline").toLowerCase(),
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    const payload = {
      camera_id: form.camera_id.trim(),
      name: form.name.trim(),
      stream_url: form.stream_url.trim(),
      camera_type: form.camera_type,
      location: form.location.trim(),
      status: form.status.toLowerCase(),
    };

    try {
      if (editing) {
        await apiRequest(`/cameras/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });

        setSuccessMessage("Camera updated successfully.");
      } else {
        await apiRequest("/cameras", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        setSuccessMessage("Camera added successfully.");
      }

      resetForm();
      await loadCameras();
    } catch (error) {
      console.error("Camera save error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to save camera."
      );
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (camera, action) => {
    setErrorMessage("");
    try {
      await cameraAction(camera.id, action);
      setSuccessMessage(`Camera ${action} request completed.`);
      await loadCameras();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : `Unable to ${action} camera.`);
    }
  };

  const handleDelete = async (camera) => {
    const confirmed = window.confirm(
      `Remove "${camera.name}" from IBVAP camera management?`
    );

    if (!confirmed) return;

    setDeletingId(camera.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await apiRequest(`/cameras/${camera.id}`, {
        method: "DELETE",
      });

      if (editingId === camera.id) {
        resetForm();
      }

      setSuccessMessage("Camera removed successfully.");
      await loadCameras();
    } catch (error) {
      console.error("Camera delete error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to remove camera."
      );
    } finally {
      setDeletingId(null);
    }
  };

  const summary = useMemo(() => {
    const online = cameras.filter(
      (camera) =>
        String(camera.status || "").toLowerCase() === "online"
    ).length;

    return {
      total: cameras.length,
      online,
      offline: cameras.length - online,
    };
  }, [cameras]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50/40 text-slate-900">
      <style>{`
        @keyframes cameraFadeUp {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes cameraFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes cameraRowIn {
          from {
            opacity: 0;
            transform: translateX(-8px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes cameraPulse {
          0%,
          100% {
            opacity: 1;
            transform: scale(1);
          }

          50% {
            opacity: 0.65;
            transform: scale(1.15);
          }
        }

        .camera-fade-up {
          animation: cameraFadeUp 0.5s ease-out both;
        }

        .camera-fade-in {
          animation: cameraFadeIn 0.4s ease-out both;
        }

        .camera-row-in {
          animation: cameraRowIn 0.45s ease-out both;
        }

        .camera-status-dot {
          animation: cameraPulse 2s ease-in-out infinite;
        }
      `}</style>

      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-10">

        {/* Header */}
        <div
          className="camera-fade-up mb-7 flex items-end justify-between border-b border-slate-200 pb-6"
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
              Camera Management
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Add, update, remove, and check registered CCTV cameras.
            </p>
          </div>

          <div
            className="hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-cyan-50 px-5 py-3 text-right shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md sm:block"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500">
              Camera Status
            </p>

            <p className="mt-1 text-sm font-semibold text-[#071426]">
              {summary.total} total
              <span className="mx-1 text-slate-300">·</span>
              <span className="text-emerald-600">
                {summary.online} online
              </span>
              <span className="mx-1 text-slate-300">·</span>
              <span className="text-red-500">
                {summary.offline} offline
              </span>
            </p>
          </div>
        </div>

        {/* Messages */}
        {(errorMessage || successMessage) && (
          <div className="camera-fade-in mb-6">
            {errorMessage && (
              <div className="rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 via-white to-white px-5 py-4 text-sm text-red-700 shadow-sm">
                {errorMessage}
              </div>
            )}

            {successMessage && !errorMessage && (
              <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-white px-5 py-4 text-sm text-emerald-700 shadow-sm">
                {successMessage}
              </div>
            )}
          </div>
        )}

        {/* Add / Update Camera */}
        <section
          className="camera-fade-up overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-[0_12px_35px_rgba(37,99,235,0.08)] transition-all duration-300 hover:shadow-[0_16px_42px_rgba(37,99,235,0.12)]"
          style={{ animationDelay: "80ms" }}
        >
          <div className="flex items-center justify-between border-b border-blue-100 bg-gradient-to-r from-blue-50 via-white to-cyan-50 px-6 py-4">
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-blue-600">
                {editing ? "Update Camera" : "Add Camera"}
              </p>

              <p className="mt-1 text-sm font-black text-[#071426]">
                Camera Information
              </p>
            </div>

            {editing && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:text-[#071426] hover:shadow-md"
              >
                <X size={14} />
                Cancel Edit
              </button>
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            className="grid gap-5 p-6 md:grid-cols-2"
          >
            <div>
              <label htmlFor="camera-id" className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Camera ID</label>
              <input id="camera-id" name="camera_id" value={form.camera_id} onChange={handleChange} required className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:bg-white" placeholder="gate-01" />
            </div>
            <div>
              <label
                htmlFor="camera-name"
                className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500"
              >
                Camera Name
              </label>

              <input
                id="camera-name"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition-all duration-200 placeholder:text-slate-400 hover:border-blue-200 hover:bg-white focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                placeholder="Camera 01"
              />
            </div>

            <div>
              <label
                htmlFor="camera-location"
                className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500"
              >
                Location
              </label>

              <input
                id="camera-location"
                name="location"
                value={form.location}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition-all duration-200 placeholder:text-slate-400 hover:border-cyan-200 hover:bg-white focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                placeholder="Border Post Alpha"
              />
            </div>

            <div>
              <label
                htmlFor="camera-stream-url"
                className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500"
              >
                Stream URL
              </label>

              <input
                id="camera-stream-url"
                name="stream_url"
                value={form.stream_url}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition-all duration-200 placeholder:text-slate-400 hover:border-violet-200 hover:bg-white focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100"
                placeholder="rtsp://... or 0 for PC webcam"
              />
            </div>

            <div>
              <label
                htmlFor="camera-status"
                className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500"
              >
                Status
              </label>

              <select
                id="camera-status"
                name="status"
                value={form.status}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition-all duration-200 hover:border-emerald-200 hover:bg-white focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
              >
                <option value="online">Online</option>
                <option value="offline">Offline</option>
              </select>
            </div>

            <div>
              <label htmlFor="camera-type" className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Stream Type</label>
              <select id="camera-type" name="camera_type" value={form.camera_type} onChange={handleChange} required className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:bg-white">
                <option value="ip_webcam">IP / HTTP camera</option><option value="rtsp">RTSP camera</option><option value="usb">USB camera</option>
              </select>
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#071426] to-blue-900 px-5 py-3 text-xs font-black uppercase tracking-wider text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:from-[#0b1d35] hover:to-blue-800 hover:shadow-lg disabled:cursor-not-allowed disabled:bg-slate-400 disabled:from-slate-400 disabled:to-slate-400"
              >
                {editing ? (
                  <Pencil size={14} />
                ) : (
                  <Plus size={14} />
                )}

                {saving
                  ? "Saving..."
                  : editing
                    ? "Update Camera"
                    : "Add Camera"}
              </button>
            </div>
          </form>
        </section>

        {/* Registered Cameras */}
        <section
          className="camera-fade-up mt-6 overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-[0_12px_35px_rgba(124,58,237,0.07)] transition-all duration-300 hover:shadow-[0_16px_42px_rgba(124,58,237,0.10)]"
          style={{ animationDelay: "160ms" }}
        >
          <div className="border-b border-violet-100 bg-gradient-to-r from-violet-50 via-white to-blue-50 px-6 py-4">
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-violet-600">
              Registered Cameras
            </p>
          </div>

          {loading ? (
            <div className="camera-fade-in px-6 py-12 text-center">
              <p className="text-xs font-mono uppercase tracking-wider text-slate-400">
                Loading cameras...
              </p>
            </div>
          ) : cameras.length === 0 ? (
            <div className="camera-fade-in px-6 py-12 text-center">
              <p className="text-sm font-bold text-slate-600">
                No cameras registered
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Add the first camera using the form above.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {cameras.map((camera, index) => {
                const online =
                  String(camera.status || "").toLowerCase() === "online";

                return (
                  <div
                    key={camera.id}
                    className="camera-row-in group flex flex-col gap-4 px-6 py-5 transition-all duration-300 hover:bg-gradient-to-r hover:from-blue-50/40 hover:via-white hover:to-violet-50/30 lg:flex-row lg:items-center lg:justify-between"
                    style={{
                      animationDelay: `${index * 70}ms`,
                    }}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-sm font-black text-[#071426] transition-colors duration-200 group-hover:text-blue-700">
                          {camera.name}
                        </p>

                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-mono text-slate-400 transition-colors duration-200 group-hover:bg-slate-200">
                          ID {camera.id}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-slate-500">
                        {camera.location}
                      </p>

                      <p className="mt-1 truncate text-[11px] font-mono text-slate-400 lg:max-w-[480px]">
                        {camera.stream_url}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-wider ring-1 ${
                          online
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                            : "bg-red-50 text-red-700 ring-red-100"
                        }`}
                      >
                        <span
                          className={`camera-status-dot h-1.5 w-1.5 rounded-full ${
                            online ? "bg-emerald-500" : "bg-red-500"
                          }`}
                        />

                        {camera.status || "unknown"}
                      </span>

                      <button
                        type="button"
                        onClick={() => startEdit(camera)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-600 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:shadow-md"
                      >
                        <Pencil size={13} />
                        Edit
                      </button>

                      <button type="button" onClick={() => runAction(camera, "test")} className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-600 shadow-sm hover:bg-blue-50">Test</button>
                      <button type="button" onClick={() => runAction(camera, "start")} className="inline-flex items-center rounded-xl bg-emerald-600 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm hover:bg-emerald-700">Start</button>
                      <button type="button" onClick={() => runAction(camera, "stop")} className="inline-flex items-center rounded-xl border border-amber-200 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-amber-700 shadow-sm hover:bg-amber-50">Stop</button>
                      <button type="button" onClick={() => runAction(camera, "restart")} className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-600 shadow-sm hover:bg-slate-50">Restart</button>

                      <button
                        type="button"
                        onClick={() => handleDelete(camera)}
                        disabled={deletingId === camera.id}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-red-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-red-50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 size={13} />
                        {deletingId === camera.id
                          ? "Removing..."
                          : "Remove"}
                      </button>
                    </div>
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
