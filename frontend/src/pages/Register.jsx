import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Shield,
  RadioTower,
  Settings,
  Eye,
  EyeOff,
  ArrowLeft,
  Check,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

const roles = [
  {
    id: "security_sentry",
    title: "Security / Sentry",
    description:
      "Live camera monitoring, alerts, evidence and alert acknowledgement.",
    icon: Shield,
  },
  {
    id: "post_commander",
    title: "Post Commander",
    description:
      "Border post monitoring, incident history, escalation and restricted zones.",
    icon: RadioTower,
  },
  {
    id: "administrator",
    title: "Administrator",
    description:
      "Camera, user, role, system and platform management.",
    icon: Settings,
  },
];

export default function Register() {
  const navigate = useNavigate();

  const [selectedRole, setSelectedRole] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear old messages while the user edits.
    setErrorMessage("");
    setSuccessMessage("");
  };

  const handleRoleSelect = (roleId) => {
    setSelectedRole(roleId);
    setErrorMessage("");
    setSuccessMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    // Validate role.
    if (!selectedRole) {
      setErrorMessage("Please select an access role.");
      return;
    }

    // Validate password match.
    if (formData.password !== formData.confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    // Backend requires minimum 8 characters.
    if (formData.password.length < 8) {
      setErrorMessage("Password must contain at least 8 characters.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          role: selectedRole,
        }),
      });

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to create the account. Please try again."
        );
      }

      setSuccessMessage(
        "Account created successfully. Redirecting to Officer Login..."
      );

      // Clear sensitive form data before leaving the page.
      setFormData({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
      });

      setSelectedRole("");

      // Give the user a moment to see the success state.
      setTimeout(() => {
        navigate("/login");
      }, 1200);
    } catch (error) {
      console.error("Registration error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to create the account. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#071426] text-slate-900 flex">

      {/* =========================================================
          LEFT VISUAL PANEL
      ========================================================== */}
      <div className="hidden lg:flex lg:w-[48%] relative overflow-hidden">

        <img
          src="/img2.png"
          alt="IBVAP Border Surveillance"
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* Dark overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#071426]/95 via-[#071426]/70 to-[#071426]/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#071426]/95 via-transparent to-[#071426]/30" />

        <div className="relative z-10 flex flex-col justify-between w-full p-10 xl:p-14 text-white">

          {/* BRAND */}
          <div className="flex items-center gap-3">

            <div className="w-11 h-11 border border-amber-500/60 bg-[#0b192c]/80 flex items-center justify-center">
              <Shield
                size={23}
                className="text-amber-400"
                strokeWidth={1.8}
              />
            </div>

            <div>
              <h1 className="font-black tracking-wide text-xl">
                IBVAP
              </h1>

              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-300">
                Intelligent Border Video Analytics Platform
              </p>
            </div>

          </div>

          {/* MESSAGE */}
          <div className="max-w-xl">

            <div className="inline-flex items-center gap-2 border border-amber-500/40 bg-black/30 backdrop-blur-sm px-3 py-1.5 mb-6">

              <span className="h-2 w-2 rounded-full bg-amber-400" />

              <span className="text-[10px] font-mono uppercase tracking-widest text-amber-300">
                Secure Access Request
              </span>

            </div>

            <h2 className="text-4xl xl:text-6xl font-black leading-[1.05] tracking-tight">
              Choose your
              <br />
              <span className="text-amber-500">
                operational role.
              </span>
            </h2>

            <p className="mt-6 max-w-lg text-sm xl:text-base leading-relaxed text-slate-200">
              Request access to the IBVAP platform according to your assigned
              operational responsibility.
            </p>

            <div className="mt-8 border-l-2 border-amber-500 pl-5">

              <p className="text-xs text-slate-300 leading-relaxed">
                Access permissions are role-based and determine which platform
                functions are available after authentication.
              </p>

            </div>

          </div>

          {/* FOOTER */}
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
            Government of India • Ministry of Defence
          </div>

        </div>
      </div>

      {/* =========================================================
          RIGHT PANEL
      ========================================================== */}
      <div className="flex-1 min-h-screen flex items-center justify-center p-5 sm:p-8 bg-[#f3f5f8]">

        <div className="w-full max-w-2xl">

          {/* BACK TO WEBSITE */}
          <button
            type="button"
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-[#0b192c] mb-6 transition-colors"
          >
            <ArrowLeft size={15} />
            Back to website
          </button>

          <div className="bg-white border border-slate-300 shadow-xl">

            {/* =====================================================
                HEADER
            ====================================================== */}
            <div className="bg-[#0b192c] px-6 sm:px-8 py-6 border-b-2 border-amber-500">

              <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-amber-400">
                Secure Access Profile
              </p>

              <h2 className="mt-2 text-2xl font-black text-white tracking-tight">
                Request Clearance ID
              </h2>

              <p className="mt-1 text-xs text-slate-400">
                Select your operational role and provide your account details.
              </p>

            </div>

            {/* =====================================================
                FORM
            ====================================================== */}
            <form
              onSubmit={handleSubmit}
              className="p-6 sm:p-8"
              noValidate
            >

              {/* ===================================================
                  ERROR MESSAGE
              ==================================================== */}
              {errorMessage && (
                <div className="mb-6 flex items-start gap-3 border border-red-200 bg-red-50 px-4 py-3 text-red-800">

                  <AlertCircle
                    size={17}
                    className="mt-0.5 shrink-0"
                  />

                  <p className="text-xs font-semibold leading-relaxed">
                    {errorMessage}
                  </p>

                </div>
              )}

              {/* ===================================================
                  SUCCESS MESSAGE
              ==================================================== */}
              {successMessage && (
                <div className="mb-6 flex items-start gap-3 border border-green-200 bg-green-50 px-4 py-3 text-green-800">

                  <CheckCircle2
                    size={17}
                    className="mt-0.5 shrink-0"
                  />

                  <p className="text-xs font-semibold leading-relaxed">
                    {successMessage}
                  </p>

                </div>
              )}

              {/* ===================================================
                  ROLE SELECTION
              ==================================================== */}
              <div>

                <div className="flex items-end justify-between mb-3">

                  <div>

                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700">
                      Select Access Role
                    </label>

                    <p className="text-[11px] text-slate-500 mt-1">
                      Choose the role assigned to your operational responsibility.
                    </p>

                  </div>

                  {selectedRole && (
                    <span className="text-[10px] font-mono uppercase tracking-wider text-green-700">
                      Role Selected
                    </span>
                  )}

                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

                  {roles.map((role) => {

                    const Icon = role.icon;
                    const isSelected = selectedRole === role.id;

                    return (
                      <button
                        key={role.id}
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleRoleSelect(role.id)}
                        aria-pressed={isSelected}
                        className={`relative text-left p-4 border transition-all ${
                          isSelected
                            ? "border-[#0b192c] bg-[#0b192c] text-white shadow-lg"
                            : "border-slate-300 bg-slate-50 hover:border-[#0b192c] hover:bg-slate-100 text-slate-900"
                        } ${
                          isLoading
                            ? "cursor-not-allowed opacity-60"
                            : "cursor-pointer"
                        }`}
                      >

                        {/* SELECTED CHECK */}
                        {isSelected && (
                          <div className="absolute top-3 right-3">

                            <div className="w-5 h-5 bg-amber-500 text-slate-950 flex items-center justify-center">
                              <Check
                                size={13}
                                strokeWidth={3}
                              />
                            </div>

                          </div>
                        )}

                        <Icon
                          size={22}
                          strokeWidth={1.8}
                          className={
                            isSelected
                              ? "text-amber-400"
                              : "text-[#0b192c]"
                          }
                        />

                        <h3
                          className={`mt-3 text-xs font-black uppercase tracking-wide ${
                            isSelected
                              ? "text-white"
                              : "text-[#0b192c]"
                          }`}
                        >
                          {role.title}
                        </h3>

                        <p
                          className={`mt-2 text-[10px] leading-relaxed ${
                            isSelected
                              ? "text-slate-300"
                              : "text-slate-500"
                          }`}
                        >
                          {role.description}
                        </p>

                      </button>
                    );
                  })}

                </div>

              </div>

              {/* ===================================================
                  ACCOUNT DETAILS
              ==================================================== */}
              <div className="mt-7 pt-6 border-t border-slate-200">

                <div className="space-y-5">

                  {/* FULL NAME */}
                  <div>

                    <label
                      htmlFor="name"
                      className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-2"
                    >
                      Full Name
                    </label>

                    <input
                      id="name"
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      autoComplete="name"
                      disabled={isLoading}
                      placeholder="Enter full name"
                      className="w-full border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b192c] focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                    />

                  </div>

                  {/* EMAIL */}
                  <div>

                    <label
                      htmlFor="email"
                      className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-2"
                    >
                      Official Email
                    </label>

                    <input
                      id="email"
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      autoComplete="email"
                      disabled={isLoading}
                      placeholder="Enter official email"
                      className="w-full border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b192c] focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                    />

                  </div>

                  {/* PASSWORD */}
                  <div>

                    <label
                      htmlFor="password"
                      className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-2"
                    >
                      Password
                    </label>

                    <div className="relative">

                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        required
                        minLength={8}
                        autoComplete="new-password"
                        disabled={isLoading}
                        placeholder="Create secure password"
                        className="w-full border border-slate-300 bg-slate-50 px-4 py-3 pr-12 text-sm text-slate-900 outline-none transition focus:border-[#0b192c] focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                      />

                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() =>
                          setShowPassword((prev) => !prev)
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0b192c] disabled:cursor-not-allowed"
                        aria-label={
                          showPassword
                            ? "Hide password"
                            : "Show password"
                        }
                      >
                        {showPassword ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>

                    </div>

                    <p className="mt-1.5 text-[10px] text-slate-400">
                      Minimum 8 characters.
                    </p>

                  </div>

                  {/* CONFIRM PASSWORD */}
                  <div>

                    <label
                      htmlFor="confirmPassword"
                      className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-2"
                    >
                      Confirm Password
                    </label>

                    <div className="relative">

                      <input
                        id="confirmPassword"
                        type={
                          showConfirmPassword
                            ? "text"
                            : "password"
                        }
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        required
                        autoComplete="new-password"
                        disabled={isLoading}
                        placeholder="Confirm secure password"
                        className="w-full border border-slate-300 bg-slate-50 px-4 py-3 pr-12 text-sm text-slate-900 outline-none transition focus:border-[#0b192c] focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                      />

                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() =>
                          setShowConfirmPassword(
                            (prev) => !prev
                          )
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0b192c] disabled:cursor-not-allowed"
                        aria-label={
                          showConfirmPassword
                            ? "Hide confirm password"
                            : "Show confirm password"
                        }
                      >
                        {showConfirmPassword ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>

                    </div>

                  </div>

                </div>

              </div>

              {/* ===================================================
                  SUBMIT BUTTON
              ==================================================== */}
              <button
                type="submit"
                disabled={isLoading}
                className="mt-7 w-full bg-amber-500 hover:bg-amber-400 text-slate-950 py-3.5 text-xs font-black uppercase tracking-[0.18em] border border-amber-600 transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-amber-500"
              >

                {isLoading ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                    Creating Secure Profile
                  </span>
                ) : (
                  "Submit Access Request"
                )}

              </button>

              {/* ===================================================
                  LOGIN LINK
              ==================================================== */}
              <div className="mt-6 pt-6 border-t border-slate-200 text-center">

                <p className="text-xs text-slate-500">
                  Already have secure access?
                </p>

                <Link
                  to="/login"
                  className="inline-block mt-1 text-xs font-black uppercase tracking-wider text-[#0b192c] hover:text-amber-700 transition-colors"
                >
                  Officer Login
                </Link>

              </div>

            </form>

            {/* =====================================================
                SECURITY FOOTER
            ====================================================== */}
            <div className="px-6 sm:px-8 py-4 bg-slate-50 border-t border-slate-200 text-center">

              <p className="text-[9px] font-mono uppercase tracking-wider text-slate-500">
                Access permissions are controlled through role-based authorization
              </p>

            </div>

          </div>

        </div>
      </div>

    </div>
  );
}