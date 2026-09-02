import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2, X } from "lucide-react";
import { apiRequest } from "../../services/api";

const EMPTY_FORM = {
  name: "",
  email: "",
  role: "security_sentry",
};

const ROLE_OPTIONS = [
  { value: "security_sentry", label: "Security Sentry" },
  { value: "post_commander", label: "Post Commander" },
  { value: "administrator", label: "Administrator" },
];

function roleLabel(role) {
  const item = ROLE_OPTIONS.find(
    (option) => option.value === role
  );

  return item?.label || role || "Unknown";
}

export default function UserManagement() {
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const editing = editingId !== null;

  const loadUsers = async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const data = await apiRequest("/users");
      setUsers(Array.isArray(data?.users) ? data.users : []);
    } catch (error) {
      console.error("Failed to load users:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load users."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const startEdit = (user) => {
    setErrorMessage("");
    setSuccessMessage("");

    setEditingId(user.id);

    setForm({
      name: user.name || "",
      email: user.email || "",
      role: user.role || "security_sentry",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!editing) {
      /*
       * The current backend does not expose POST /api/users.
       * New accounts are created through the existing auth/register
       * endpoint, so User Management is intentionally update/delete
       * for existing accounts.
       */
      setErrorMessage(
        "New users are registered through the existing registration flow. User Management can update or remove existing accounts."
      );

      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await apiRequest(`/users/${editingId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role,
        }),
      });

      setSuccessMessage("User updated successfully.");
      cancelEdit();
      await loadUsers();
    } catch (error) {
      console.error("User update error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to update user."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user) => {
    const confirmed = window.confirm(
      `Remove "${user.name}" from IBVAP user management?`
    );

    if (!confirmed) return;

    setDeletingId(user.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await apiRequest(`/users/${user.id}`, {
        method: "DELETE",
      });

      if (editingId === user.id) {
        cancelEdit();
      }

      setSuccessMessage("User removed successfully.");
      await loadUsers();
    } catch (error) {
      console.error("User delete error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to remove user."
      );
    } finally {
      setDeletingId(null);
    }
  };

  const summary = useMemo(() => {
    return {
      total: users.length,
      administrators: users.filter(
        (user) => user.role === "administrator"
      ).length,
      commanders: users.filter(
        (user) => user.role === "post_commander"
      ).length,
      sentries: users.filter(
        (user) => user.role === "security_sentry"
      ).length,
    };
  }, [users]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-violet-50/30 text-slate-900">
      <style>{`
        @keyframes userFadeUp {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes userFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes userRowIn {
          from {
            opacity: 0;
            transform: translateX(-8px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes rolePulse {
          0%,
          100% {
            transform: scale(1);
            opacity: 1;
          }

          50% {
            transform: scale(1.08);
            opacity: 0.7;
          }
        }

        .user-fade-up {
          animation: userFadeUp 0.5s ease-out both;
        }

        .user-fade-in {
          animation: userFadeIn 0.4s ease-out both;
        }

        .user-row-in {
          animation: userRowIn 0.45s ease-out both;
        }

        .role-dot {
          animation: rolePulse 2.2s ease-in-out infinite;
        }
      `}</style>

      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-10">

        {/* Header */}
        <div className="user-fade-up mb-7 flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <button
              type="button"
              onClick={() => navigate("/admin")}
              className="mb-4 inline-flex items-center gap-2 rounded-lg px-1 py-1 text-xs font-bold uppercase tracking-wider text-slate-500 transition-all duration-200 hover:-translate-x-0.5 hover:text-[#071426]"
            >
              <ArrowLeft size={14} />
              Administrator Dashboard
            </button>

            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-[#b87800]">
              Administration
            </p>

            <h1 className="mt-1 text-3xl font-black tracking-tight text-[#071426]">
              User Management
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Manage existing IBVAP users and their assigned roles.
            </p>
          </div>

          <div className="hidden rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-blue-50 px-5 py-3 text-right shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md sm:block">
            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-500">
              Accounts
            </p>

            <p className="mt-1 text-sm font-semibold text-[#071426]">
              {summary.total} total
              <span className="mx-1 text-slate-300">·</span>
              <span className="text-violet-600">
                {summary.administrators} admin
              </span>
              <span className="mx-1 text-slate-300">·</span>
              <span className="text-blue-600">
                {summary.commanders} commander
              </span>
              <span className="mx-1 text-slate-300">·</span>
              <span className="text-emerald-600">
                {summary.sentries} sentry
              </span>
            </p>
          </div>
        </div>

        {/* Messages */}
        {(errorMessage || successMessage) && (
          <div className="user-fade-in mb-6">
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

        {/* Existing Account */}
        <section
          className="user-fade-up overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-[0_12px_35px_rgba(124,58,237,0.08)] transition-all duration-300 hover:shadow-[0_16px_42px_rgba(124,58,237,0.12)]"
          style={{ animationDelay: "80ms" }}
        >
          <div className="flex items-center justify-between border-b border-violet-100 bg-gradient-to-r from-violet-50 via-white to-blue-50 px-6 py-4">
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-violet-600">
                {editing ? "Edit User" : "User Roles"}
              </p>

              <p className="mt-1 text-sm font-black text-[#071426]">
                Existing Account
              </p>
            </div>

            {editing && (
              <button
                type="button"
                onClick={cancelEdit}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:text-[#071426] hover:shadow-md"
              >
                <X size={14} />
                Cancel
              </button>
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            className="grid gap-5 p-6 md:grid-cols-2"
          >
            <div>
              <label
                htmlFor="user-name"
                className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500"
              >
                Name
              </label>

              <input
                id="user-name"
                name="name"
                value={form.name}
                onChange={handleChange}
                disabled={!editing}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition-all duration-200 placeholder:text-slate-400 hover:border-violet-200 hover:bg-white focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="User name"
              />
            </div>

            <div>
              <label
                htmlFor="user-email"
                className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500"
              >
                Email
              </label>

              <input
                id="user-email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                disabled={!editing}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition-all duration-200 placeholder:text-slate-400 hover:border-blue-200 hover:bg-white focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="name@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="user-role"
                className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500"
              >
                Role
              </label>

              <select
                id="user-role"
                name="role"
                value={form.role}
                onChange={handleChange}
                disabled={!editing}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition-all duration-200 hover:border-cyan-200 hover:bg-white focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end justify-end">
              {editing && (
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#071426] to-violet-900 px-5 py-3 text-xs font-black uppercase tracking-wider text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:from-[#0b1d35] hover:to-violet-800 hover:shadow-lg disabled:cursor-not-allowed disabled:bg-slate-400 disabled:from-slate-400 disabled:to-slate-400"
                >
                  <Pencil size={14} />
                  {saving ? "Saving..." : "Update User"}
                </button>
              )}
            </div>

            {!editing && (
              <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-violet-50/40 px-4 py-3 text-xs leading-5 text-slate-500 transition-colors duration-200 hover:border-violet-100">
                The current backend creates accounts through the existing
                registration endpoint. This Administrator page therefore
                manages the users already returned by{" "}
                <span className="font-mono text-slate-600">
                  GET /api/users
                </span>
                .
              </div>
            )}
          </form>
        </section>

        {/* Registered Users */}
        <section
          className="user-fade-up mt-6 overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-[0_12px_35px_rgba(37,99,235,0.07)] transition-all duration-300 hover:shadow-[0_16px_42px_rgba(37,99,235,0.10)]"
          style={{ animationDelay: "160ms" }}
        >
          <div className="border-b border-blue-100 bg-gradient-to-r from-blue-50 via-white to-violet-50 px-6 py-4">
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-blue-600">
              Registered Users
            </p>
          </div>

          {loading ? (
            <div className="user-fade-in px-6 py-12 text-center">
              <p className="text-xs font-mono uppercase tracking-wider text-slate-400">
                Loading users...
              </p>
            </div>
          ) : users.length === 0 ? (
            <div className="user-fade-in px-6 py-12 text-center">
              <p className="text-sm font-bold text-slate-600">
                No users returned by the backend
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Existing accounts will appear here when the backend returns them.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {users.map((user, index) => {
                const roleColor =
                  user.role === "administrator"
                    ? "violet"
                    : user.role === "post_commander"
                    ? "blue"
                    : "emerald";

                return (
                  <div
                    key={user.id}
                    className="user-row-in group flex flex-col gap-4 px-6 py-5 transition-all duration-300 hover:bg-gradient-to-r hover:from-blue-50/30 hover:via-white hover:to-violet-50/30 lg:flex-row lg:items-center lg:justify-between"
                    style={{
                      animationDelay: `${index * 70}ms`,
                    }}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-sm font-black text-[#071426] transition-colors duration-200 group-hover:text-blue-700">
                          {user.name}
                        </p>

                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-mono text-slate-400 transition-colors duration-200 group-hover:bg-slate-200">
                          ID {user.id}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-slate-500">
                        {user.email}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-wider ${
                          roleColor === "violet"
                            ? "bg-violet-50 text-violet-700 ring-1 ring-violet-100"
                            : roleColor === "blue"
                            ? "bg-blue-50 text-blue-700 ring-1 ring-blue-100"
                            : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                        }`}
                      >
                        <span
                          className={`role-dot h-1.5 w-1.5 rounded-full ${
                            roleColor === "violet"
                              ? "bg-violet-500"
                              : roleColor === "blue"
                              ? "bg-blue-500"
                              : "bg-emerald-500"
                          }`}
                        />

                        {roleLabel(user.role)}
                      </span>

                      <button
                        type="button"
                        onClick={() => startEdit(user)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-600 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:shadow-md"
                      >
                        <Pencil size={13} />
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(user)}
                        disabled={deletingId === user.id}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-red-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-red-50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 size={13} />
                        {deletingId === user.id
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
