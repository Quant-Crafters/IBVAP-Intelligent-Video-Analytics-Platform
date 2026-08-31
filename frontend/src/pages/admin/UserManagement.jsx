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
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-10">

        <div className="mb-7 flex flex-col gap-4 border-b border-slate-300 pb-6 sm:flex-row sm:items-end sm:justify-between">
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
              User Management
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Manage existing IBVAP users and their assigned roles.
            </p>
          </div>

          <div className="hidden text-right sm:block">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Accounts
            </p>

            <p className="mt-1 text-sm font-semibold text-[#071426]">
              {summary.total} total · {summary.administrators} admin ·{" "}
              {summary.commanders} commander · {summary.sentries} sentry
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
                className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-[#071426]"
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
                className="w-full border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[#071426] focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
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
                className="w-full border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[#071426] focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
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
                className="w-full border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[#071426] focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
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
                  className="inline-flex items-center gap-2 bg-[#071426] px-5 py-3 text-xs font-black uppercase tracking-wider text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  <Pencil size={14} />
                  {saving ? "Saving..." : "Update User"}
                </button>
              )}
            </div>

            {!editing && (
              <div className="md:col-span-2 border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
                The current backend creates accounts through the existing
                registration endpoint. This Administrator page therefore
                manages the users already returned by <span className="font-mono">GET /api/users</span>.
              </div>
            )}
          </form>
        </section>

        <section className="mt-6 border border-slate-300 bg-white">
          <div className="border-b border-slate-200 px-6 py-4">
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#b87800]">
              Registered Users
            </p>
          </div>

          {loading ? (
            <div className="px-6 py-12 text-center">
              <p className="text-xs font-mono uppercase tracking-wider text-slate-400">
                Loading users...
              </p>
            </div>
          ) : users.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm font-bold text-slate-600">
                No users returned by the backend
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Existing accounts will appear here when the backend returns them.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-sm font-black text-[#071426]">
                        {user.name}
                      </p>

                      <span className="text-[10px] font-mono text-slate-400">
                        ID {user.id}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-slate-500">
                      {user.email}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-slate-700">
                      {roleLabel(user.role)}
                    </span>

                    <button
                      type="button"
                      onClick={() => startEdit(user)}
                      className="inline-flex items-center gap-1.5 border border-slate-300 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:border-[#071426] hover:text-[#071426]"
                    >
                      <Pencil size={13} />
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(user)}
                      disabled={deletingId === user.id}
                      className="inline-flex items-center gap-1.5 border border-red-200 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 size={13} />
                      {deletingId === user.id ? "Removing..." : "Remove"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
