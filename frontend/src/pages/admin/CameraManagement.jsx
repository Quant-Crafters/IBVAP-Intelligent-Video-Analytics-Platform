import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Pencil, Plus, Trash2, X } from "lucide-react";
import { apiRequest } from "../../services/api";

const EMPTY_FORM = {
  name: "",
  stream_url: "",
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
      name: camera.name || "",
      stream_url: camera.stream_url || "",
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
      name: form.name.trim(),
      stream_url: form.stream_url.trim(),
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
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-10">

        <div className="mb-7 flex items-end justify-between border-b border-slate-300 pb-6">
          <div>
            <button
              type="button"
              onClick={() => navigate("/admin")}
              className="mb-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 transition hover:text-[#071426]"
            >
              <ArrowLeft size={14} />
              Administrator Dashboard
            </button>

            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-[#b87800]">
              Administration
            </p>

            <h1 className="mt-1 text-3xl font-black tracking-tight text-[#071426]">
              Camera Management
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Add, update, remove, and check registered CCTV cameras.
            </p>
          </div>

          <div className="hidden text-right sm:block">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Camera Status
            </p>

            <p className="mt-1 text-sm font-semibold text-[#071426]">
              {summary.total} total · {summary.online} online · {summary.offline} offline
            </p>
          </div>
        </div>

        {(errorMessage || successMessage) && (
          <div className="mb-6">
            {errorMessage && (
              <div className="border border-red-200 bg-white px-5 py-4 text-sm text-red-700">
                {errorMessage}
              </div>
            )}

            {successMessage && !errorMessage && (
              <div className="border border-green-200 bg-white px-5 py-4 text-sm text-green-700">
                {successMessage}
              </div>
            )}
          </div>
        )}

        <section className="border border-slate-300 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#b87800]">
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
                className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-[#071426]"
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
                className="w-full border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[#071426] focus:bg-white"
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
                className="w-full border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[#071426] focus:bg-white"
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
                className="w-full border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[#071426] focus:bg-white"
                placeholder="rtsp://..."
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
                className="w-full border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[#071426] focus:bg-white"
              >
                <option value="online">Online</option>
                <option value="offline">Offline</option>
              </select>
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 bg-[#071426] px-5 py-3 text-xs font-black uppercase tracking-wider text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
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

        <section className="mt-6 border border-slate-300 bg-white">
          <div className="border-b border-slate-200 px-6 py-4">
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#b87800]">
              Registered Cameras
            </p>
          </div>

          {loading ? (
            <div className="px-6 py-12 text-center">
              <p className="text-xs font-mono uppercase tracking-wider text-slate-400">
                Loading cameras...
              </p>
            </div>
          ) : cameras.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm font-bold text-slate-600">
                No cameras registered
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Add the first camera using the form above.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {cameras.map((camera) => {
                const online =
                  String(camera.status || "").toLowerCase() === "online";

                return (
                  <div
                    key={camera.id}
                    className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-sm font-black text-[#071426]">
                          {camera.name}
                        </p>

                        <span className="text-[10px] font-mono text-slate-400">
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
                        className={`rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-wider ${
                          online
                            ? "bg-green-50 text-green-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {camera.status || "unknown"}
                      </span>

                      <button
                        type="button"
                        onClick={() => startEdit(camera)}
                        className="inline-flex items-center gap-1.5 border border-slate-300 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:border-[#071426] hover:text-[#071426]"
                      >
                        <Pencil size={13} />
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(camera)}
                        disabled={deletingId === camera.id}
                        className="inline-flex items-center gap-1.5 border border-red-200 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 size={13} />
                        {deletingId === camera.id ? "Removing..." : "Remove"}
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
