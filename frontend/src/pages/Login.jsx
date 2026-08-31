import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";

export default function Login() {
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    username: "",
    password: "",
    remember: false,
  });

  const handleChange = (e) => {
    const {
      name,
      value,
      type,
      checked,
    } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? checked
          : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch(
        "/api/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: formData.username.trim(),
            password: formData.password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Login failed"
        );
      }

      // =====================================================
      // VALIDATE AUTH RESPONSE
      // =====================================================

      if (!data.token || !data.user) {
        throw new Error(
          "Invalid authentication response from server"
        );
      }

      if (!data.user.role) {
        throw new Error(
          "User role was not returned by the server"
        );
      }

      // =====================================================
      // STORE AUTHENTICATION INFORMATION
      // =====================================================

      localStorage.setItem(
        "ibvap_token",
        data.token
      );

      localStorage.setItem(
        "ibvap_user",
        JSON.stringify(data.user)
      );

      console.log(
  "Login successful:",
  data.user
);

// =====================================================
// ENTER APPLICATION
// =====================================================

const role = String(data.user.role)
  .trim()
  .toLowerCase();

if (role === "administrator") {
  navigate("/admin");
} else {
  // Keep Security Sentry and Post Commander
  // exactly on the teammate's existing flow.
  navigate("/live-overview");
}

    } catch (error) {
      console.error(
        "Login error:",
        error
      );

      alert(
        error.message || "Login failed"
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#071426] text-slate-900 flex">

      {/* =====================================================
          LEFT VISUAL PANEL
      ====================================================== */}

      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden">

        <img
          src="/img1.png"
          alt="IBVAP Border Surveillance"
          className="absolute inset-0 h-full w-full object-cover"
        />

        <div className="absolute inset-0 bg-gradient-to-r from-[#071426]/95 via-[#071426]/65 to-[#071426]/25" />

        <div className="absolute inset-0 bg-gradient-to-t from-[#071426]/90 via-transparent to-[#071426]/30" />

        <div className="relative z-10 flex flex-col justify-between w-full p-10 xl:p-14 text-white">

          {/* BRAND */}

          <div>
            <div className="flex items-center gap-3">

              <div className="w-11 h-11 border border-amber-500/60 bg-[#0b192c]/80 flex items-center justify-center">
                <ShieldCheck
                  size={23}
                  className="text-amber-400"
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
          </div>

          {/* MESSAGE */}

          <div className="max-w-xl">

            <div className="inline-flex items-center gap-2 border border-amber-500/40 bg-black/30 backdrop-blur-sm px-3 py-1.5 mb-6">

              <span className="h-2 w-2 rounded-full bg-green-400" />

              <span className="text-[10px] font-mono uppercase tracking-widest text-amber-300">
                Secure Operations Portal
              </span>

            </div>

            <h2 className="text-4xl xl:text-6xl font-black leading-[1.05] tracking-tight">

              Intelligent
              <br />

              surveillance.
              <br />

              <span className="text-amber-500">
                Stronger frontiers.
              </span>

            </h2>

            <p className="mt-6 max-w-lg text-sm xl:text-base leading-relaxed text-slate-200">
              Access the IBVAP surveillance platform for real-time border
              monitoring, AI-assisted event detection, alert review and
              operational intelligence.
            </p>

          </div>

          {/* FOOTER */}

          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
            Government of India • Ministry of Defence
          </div>

        </div>
      </div>

      {/* =====================================================
          RIGHT LOGIN PANEL
      ====================================================== */}

      <div className="flex-1 min-h-screen flex items-center justify-center p-5 sm:p-8 bg-[#f3f5f8]">

        <div className="w-full max-w-md">

          {/* BACK */}

          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-[#0b192c] mb-8 transition-colors"
          >
            <ArrowLeft size={15} />
            Back to website
          </button>

          <div className="bg-white border border-slate-300 shadow-xl">

            {/* HEADER */}

            <div className="bg-[#0b192c] px-6 sm:px-8 py-6 border-b-2 border-amber-500">

              <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-amber-400">
                Official Personnel Authentication
              </p>

              <h2 className="mt-2 text-2xl font-black text-white tracking-tight">
                Officer Login
              </h2>

              <p className="mt-1 text-xs text-slate-400">
                Authenticate to enter the secure IBVAP command environment.
              </p>

            </div>

            {/* FORM */}

            <form
              onSubmit={handleSubmit}
              className="p-6 sm:p-8"
            >

              <div className="space-y-5">

                {/* EMAIL */}

                <div>

                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-2">
                    Email / Username
                  </label>

                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    required
                    autoComplete="username"
                    placeholder="Enter email or username"
                    className="w-full border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b192c] focus:bg-white"
                  />

                </div>

                {/* PASSWORD */}

                <div>

                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-2">
                    Clearance Password
                  </label>

                  <div className="relative">

                    <input
                      type={
                        showPassword
                          ? "text"
                          : "password"
                      }
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      autoComplete="current-password"
                      placeholder="Enter secure password"
                      className="w-full border border-slate-300 bg-slate-50 px-4 py-3 pr-12 text-sm text-slate-900 outline-none transition focus:border-[#0b192c] focus:bg-white"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword(
                          (prev) => !prev
                        )
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0b192c]"
                    >
                      {showPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>

                  </div>

                </div>

                {/* REMEMBER / FORGOT */}

                <div className="flex items-center justify-between text-xs">

                  <label className="flex items-center gap-2 text-slate-600 cursor-pointer">

                    <input
                      type="checkbox"
                      name="remember"
                      checked={formData.remember}
                      onChange={handleChange}
                      className="accent-amber-500"
                    />

                    Remember terminal

                  </label>

                  <button
                    type="button"
                    className="font-bold text-amber-700 hover:underline"
                  >
                    Forgot Key?
                  </button>

                </div>

              </div>

              {/* LOGIN */}

              <button
                type="submit"
                className="mt-7 w-full bg-[#0b192c] hover:bg-slate-800 text-white py-3.5 text-xs font-black uppercase tracking-[0.18em] transition-all active:scale-[0.99]"
              >
                Authenticate & Enter
              </button>

              {/* REGISTER */}

              <div className="mt-6 pt-6 border-t border-slate-200 text-center">

                <p className="text-xs text-slate-500">
                  Need secure access?
                </p>

                <Link
                  to="/register"
                  className="inline-block mt-1 text-xs font-black uppercase tracking-wider text-[#0b192c] hover:text-amber-700 transition-colors"
                >
                  Request Clearance ID
                </Link>

              </div>

            </form>

            {/* FOOTER */}

            <div className="px-6 sm:px-8 py-4 bg-slate-50 border-t border-slate-200 text-center">

              <p className="text-[9px] font-mono uppercase tracking-wider text-slate-500">
                Unauthorized access is strictly prohibited
              </p>

            </div>

          </div>

        </div>
      </div>

    </div>
  );
}