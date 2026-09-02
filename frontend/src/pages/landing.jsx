import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  UserCircle,
  LogOut,
  ChevronDown,
  X,
} from "lucide-react";

const customStyles = `
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-fade-in-1 {
    animation: fadeInUp 0.8s ease-out 0.2s both;
  }

  .animate-fade-in-2 {
    animation: fadeInUp 0.8s ease-out 0.4s both;
  }

  .animate-fade-in-3 {
    animation: fadeInUp 0.8s ease-out 0.6s both;
  }

  .animate-fade-in-4 {
    animation: fadeInUp 0.8s ease-out 0.8s both;
  }

  .animate-fade-in-5 {
    animation: fadeInUp 0.8s ease-out 1s both;
  }

  .hide-scrollbar::-webkit-scrollbar {
    display: none;
  }

  .hide-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
`;

export default function Landing() {
  const navigate = useNavigate();

  const [activeNav, setActiveNav] = useState("Home");

  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return Boolean(localStorage.getItem("ibvap_token"));
  });

  const [officerName, setOfficerName] = useState(() => {
    try {
      const storedUser = localStorage.getItem("ibvap_user");

      if (!storedUser) return "";

      const user = JSON.parse(storedUser);

      return user?.name || "";
    } catch {
      return "";
    }
  });

  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const [isHeroesOpen, setIsHeroesOpen] = useState(false);

  /*
   * Hero slider
   */
  const images = ["/img1.png", "/img2.png"];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);

  /*
   * Keep authentication state synchronized if the page changes.
   */
  useEffect(() => {
    const refreshAuthState = () => {
      const token = localStorage.getItem("ibvap_token");
      const storedUser = localStorage.getItem("ibvap_user");

      setIsLoggedIn(Boolean(token));

      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          setOfficerName(user?.name || "");
        } catch {
          setOfficerName("");
        }
      } else {
        setOfficerName("");
      }
    };

    window.addEventListener("storage", refreshAuthState);

    return () => {
      window.removeEventListener("storage", refreshAuthState);
    };
  }, []);

  /*
   * ---------------------------------------------------------
   * NAVIGATION
   * ---------------------------------------------------------
   */

  const handleNavClick = (item) => {
    setActiveNav(item);
    setShowProfileMenu(false);

    const routes = {
      Home: "/",
      "Live Overview": "/live-overview",
      Analytics: "/analytics",
      "Threat Alerts": "/threat-alerts",
      Reports: "/reports",
    };

    if (routes[item]) {
      navigate(routes[item]);
      return;
    }

    // About Us and Contact remain sections of the landing page for now.
    if (item === "About Us") {
      const section = document.getElementById("about");
      section?.scrollIntoView({
        behavior: "smooth",
      });
      return;
    }

    if (item === "Contact") {
      const section = document.getElementById("contact");
      section?.scrollIntoView({
        behavior: "smooth",
      });
    }
  };

  /*
   * ---------------------------------------------------------
   * AUTHENTICATION
   * ---------------------------------------------------------
   */

  const handleLogin = () => {
    setShowProfileMenu(false);
    navigate("/login");
  };

  const handleLogout = () => {
    localStorage.removeItem("ibvap_token");
    localStorage.removeItem("ibvap_user");

    setIsLoggedIn(false);
    setOfficerName("");
    setShowProfileMenu(false);
    setActiveNav("Home");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleRegister = () => {
    navigate("/register");
  };

  /*
   * ---------------------------------------------------------
   * HERO SLIDER
   * ---------------------------------------------------------
   */

  const handleDragStart = (e) => {
    setIsDragging(true);

    const position = e.type.includes("mouse")
      ? e.pageX
      : e.touches[0].clientX;

    setStartX(position);
  };

  const handleDragMove = (e) => {
    if (!isDragging) return;

    const currentX = e.type.includes("mouse")
      ? e.pageX
      : e.touches[0].clientX;

    setDragOffset(currentX - startX);
  };

  const handleDragEnd = () => {
    setIsDragging(false);

    if (dragOffset > 70 && currentIndex > 0) {
      setCurrentIndex((previous) => previous - 1);
    } else if (
      dragOffset < -70 &&
      currentIndex < images.length - 1
    ) {
      setCurrentIndex((previous) => previous + 1);
    }

    setDragOffset(0);
  };

  const nextSlide = () => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex((previous) => previous + 1);
    }
  };

  const prevSlide = () => {
    if (currentIndex > 0) {
      setCurrentIndex((previous) => previous - 1);
    }
  };

  /*
   * ---------------------------------------------------------
   * RENDER
   * ---------------------------------------------------------
   */

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans selection:bg-amber-600 selection:text-white flex flex-col">

      <style>{customStyles}</style>

      {/* =====================================================
          GOVERNMENT BAR
      ====================================================== */}

      <div>

        <div className="h-1.5 w-full bg-gradient-to-r from-[#FF9933] via-white to-[#138808]" />

        <div className="bg-[#0b192c] text-slate-300 text-xs py-2 px-4 sm:px-8 border-b border-slate-800">

          <div className="max-w-7xl mx-auto flex items-center justify-between">

            <div className="flex items-center gap-3 text-[11px] font-medium tracking-wide">

              <span className="text-slate-600">|</span>

              <span>Government of India</span>

              <span className="text-slate-600">|</span>

              <span className="text-amber-500 font-semibold">
                Ministry of Defence
              </span>

            </div>

          </div>

        </div>

        {/* ===================================================
            NAVIGATION
        ==================================================== */}

        <header className="bg-white border-b border-slate-300 sticky top-0 z-40">

          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3.5 flex items-center gap-6">

            {/* BRAND */}

            <button
              type="button"
              onClick={() => handleNavClick("Home")}
              className="flex items-center gap-3.5 cursor-pointer text-left shrink-0"
            >

              <div>

                <h1 className="text-lg sm:text-xl font-black text-[#0b192c] tracking-tight uppercase leading-none">
                  Intelligent CCTV
                </h1>

                <p className="text-[11px] font-medium text-slate-500 tracking-wide mt-0.5">
                  Defence Video Analytics & Border Surveillance System
                </p>

              </div>

            </button>

            {/* NAVIGATION */}

            <nav className="hidden xl:flex items-center gap-1 text-[13px] font-bold text-slate-700 flex-1 justify-center">

              {[
                "Home",
                "Live Overview",
                "Analytics",
                "Threat Alerts",
                "Reports",
                "About Us",
                "Contact",
              ].map((item) => (

                <button
                  key={item}
                  type="button"
                  onClick={() => handleNavClick(item)}
                  className={`px-3.5 py-2 transition-all cursor-pointer ${
                    activeNav === item
                      ? "text-[#0b192c] font-black border-b-2 border-[#0b192c] bg-slate-50"
                      : "hover:text-[#0b192c] hover:bg-slate-100"
                  }`}
                >
                  {item}
                </button>

              ))}

            </nav>

            {/* =================================================
                AUTH AREA
            ================================================== */}

            <div className="ml-auto flex items-center shrink-0">

              {!isLoggedIn ? (

                <button
                  type="button"
                  onClick={handleLogin}
                  className="px-5 py-2.5 bg-[#0b192c] hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider transition-all border border-slate-900 cursor-pointer active:scale-95"
                >
                  Officer Login
                </button>

              ) : (

                <div className="relative flex items-center gap-2">

                  {/* OFFICER NAME */}

                  <button
                    type="button"
                    onClick={() =>
                      setShowProfileMenu((previous) => !previous)
                    }
                    className="group flex items-center gap-2.5 px-3 py-2 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all cursor-pointer"
                  >

                    <div className="w-8 h-8 bg-[#0b192c] text-white flex items-center justify-center">
                      <UserCircle
                        size={18}
                        strokeWidth={1.7}
                      />
                    </div>

                    <div className="hidden sm:block text-left max-w-32">

                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                        Officer
                      </p>

                      <p className="text-xs font-black text-[#0b192c] truncate">
                        {officerName || "Authenticated Officer"}
                      </p>

                    </div>

                    <ChevronDown
                      size={14}
                      className={`text-slate-500 transition-transform ${
                        showProfileMenu ? "rotate-180" : ""
                      }`}
                    />

                  </button>

                  {/* PROFILE DROPDOWN */}

                  {showProfileMenu && (

                    <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-300 shadow-2xl">

                      <div className="px-4 py-4 border-b border-slate-200">

                        <p className="text-[9px] uppercase tracking-[0.18em] font-bold text-slate-400">
                          Authenticated Personnel
                        </p>

                        <p className="mt-1 text-sm font-black text-[#0b192c] truncate">
                          {officerName || "Officer"}
                        </p>

                      </div>

                      <div className="p-2">

                        <button
                          type="button"
                          onClick={handleLogout}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                        >

                          <LogOut size={16} />

                          Logout

                        </button>

                      </div>

                    </div>

                  )}

                </div>

              )}

            </div>

          </div>

        </header>

        {/* =================================================
            HERO
        ================================================== */}

        <section className="relative w-full min-h-[85vh] flex items-center bg-black overflow-hidden">

          {/* IMAGE SLIDER */}

          <div
            className="absolute inset-0 z-0 cursor-grab active:cursor-grabbing"
            onMouseDown={handleDragStart}
            onMouseMove={handleDragMove}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
            onTouchStart={handleDragStart}
            onTouchMove={handleDragMove}
            onTouchEnd={handleDragEnd}
          >

            <div
              className="flex w-full h-full transition-transform duration-500 ease-out"
              style={{
                transform: `translateX(calc(-${
                  currentIndex * 100
                }% + ${dragOffset}px))`,
              }}
            >

              {images.map((src, index) => (

                <div
                  key={index}
                  className="min-w-full h-full flex-shrink-0 bg-black"
                >

                  <img
                    src={src}
                    alt={`Defence Background ${index + 1}`}
                    className="w-full h-full object-cover object-center pointer-events-none select-none"
                    draggable="false"
                  />

                </div>

              ))}

            </div>

            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent pointer-events-none" />

            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

          </div>

          {/* PREVIOUS */}

          {currentIndex > 0 && (

            <button
              type="button"
              onClick={prevSlide}
              className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/90 text-white text-[12px] font-mono font-bold px-3 py-4 border border-slate-500 cursor-pointer z-20 backdrop-blur-sm"
            >
              [ &lt; ]
            </button>

          )}

          {/* NEXT */}

          {currentIndex < images.length - 1 && (

            <button
              type="button"
              onClick={nextSlide}
              className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/90 text-white text-[12px] font-mono font-bold px-3 py-4 border border-slate-500 cursor-pointer z-20 backdrop-blur-sm"
            >
              [ &gt; ]
            </button>

          )}

          {/* SLIDER DOTS */}

          <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-3 z-20">

            {images.map((_, index) => (

              <button
                key={index}
                type="button"
                onClick={() => setCurrentIndex(index)}
                className={`w-3 h-3 transition-all cursor-pointer border border-white/30 shadow-md ${
                  currentIndex === index
                    ? "bg-amber-500 scale-110"
                    : "bg-white/40 hover:bg-white/80"
                }`}
              />

            ))}

          </div>

          {/* HERO CONTENT */}

          <div className="relative z-10 max-w-7xl mx-auto px-8 sm:px-16 w-full py-20 pointer-events-none">

            <div className="max-w-2xl space-y-7 pointer-events-auto">

              <h2 className="animate-fade-in-2 text-4xl sm:text-5xl lg:text-[4rem] font-black text-white tracking-tight leading-[1.1] drop-shadow-2xl">

                Smart Surveillance.
                <br />

                <span className="text-amber-500 drop-shadow-md">
                  Safer Frontiers. Stronger India.
                </span>

              </h2>

              <p className="animate-fade-in-3 text-white text-sm sm:text-lg leading-relaxed font-medium drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] max-w-xl">

                An integrated surveillance platform empowering our defence
                forces with real-time awareness, intelligent insights, and
                operational excellence. Transforms existing CCTV camera
                networks into autonomous, AI-driven perimeter security
                without replacing hardware.

              </p>

              <div className="animate-fade-in-4 bg-black/50 backdrop-blur-md border-l-[3px] border-amber-500 p-5 text-xs sm:text-sm text-slate-200 font-serif leading-relaxed italic shadow-2xl">

                “When lovers of the country turn immolate, it is esteem not
                forfeit. A day for the 40 Men who accepted death while in
                love with their country. We salute our heroes.”

              </div>

              {/* REQUEST CLEARANCE — ONLY BEFORE LOGIN */}

              {!isLoggedIn && (

                <div className="animate-fade-in-5 pt-4">

                  <button
                    type="button"
                    onClick={handleRegister}
                    className="px-8 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600 font-black text-xs uppercase tracking-widest transition-all cursor-pointer shadow-[0_0_20px_rgba(245,158,11,0.3)] active:scale-95"
                  >
                    REQUEST CLEARANCE ID
                  </button>

                </div>

              )}

              {/* LOGGED-IN STATUS */}

              {isLoggedIn && (

                <div className="animate-fade-in-5 pt-4">



                </div>

              )}

            </div>

          </div>

        </section>

        {/* =================================================
            SECURITY PILLARS
        ================================================== */}

        <section className="py-12 bg-white border-b border-slate-300">

          <div className="max-w-7xl mx-auto px-4 sm:px-8">

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

              <div className="group p-6 border border-slate-200 bg-slate-50 hover:bg-[#0b192c] hover:border-[#0b192c] hover:scale-105 hover:shadow-xl transition-all duration-300">

                <div className="text-[10px] font-mono font-bold text-amber-600 group-hover:text-amber-400 mb-2 uppercase tracking-wider">
                  SECTION 01
                </div>

                <h3 className="font-bold text-slate-900 group-hover:text-white text-base mb-2 transition-colors">
                  Integrated Security
                </h3>

                <p className="text-xs text-slate-600 group-hover:text-slate-300 leading-relaxed transition-colors">
                  Unified surveillance across land outposts, wire fences, and
                  high-altitude forward posts for complete situational awareness.
                </p>

              </div>

              <div className="group p-6 border border-slate-200 bg-slate-50 hover:bg-[#0b192c] hover:border-[#0b192c] hover:scale-105 hover:shadow-xl transition-all duration-300">

                <div className="text-[10px] font-mono font-bold text-amber-600 group-hover:text-amber-400 mb-2 uppercase tracking-wider">
                  SECTION 02
                </div>

                <h3 className="font-bold text-slate-900 group-hover:text-white text-base mb-2 transition-colors">
                  Real-time Intelligence
                </h3>

                <p className="text-xs text-slate-600 group-hover:text-slate-300 leading-relaxed transition-colors">
                  AI-powered analytics and real-time monitoring to detect
                  intrusions, assess perimeter threats, and act instantly.
                </p>

              </div>

              <div className="group p-6 border border-slate-200 bg-slate-50 hover:bg-[#0b192c] hover:border-[#0b192c] hover:scale-105 hover:shadow-xl transition-all duration-300">

                <div className="text-[10px] font-mono font-bold text-amber-600 group-hover:text-amber-400 mb-2 uppercase tracking-wider">
                  SECTION 03
                </div>

                <h3 className="font-bold text-slate-900 group-hover:text-white text-base mb-2 transition-colors">
                  Operational Excellence
                </h3>

                <p className="text-xs text-slate-600 group-hover:text-slate-300 leading-relaxed transition-colors">
                  Reliable, scalable, and offline edge-operable software built
                  specifically for critical defence posts.
                </p>

              </div>

              <div className="group p-6 border border-slate-200 bg-slate-50 hover:bg-[#0b192c] hover:border-[#0b192c] hover:scale-105 hover:shadow-xl transition-all duration-300">

                <div className="text-[10px] font-mono font-bold text-amber-600 group-hover:text-amber-400 mb-2 uppercase tracking-wider">
                  SECTION 04
                </div>

                <h3 className="font-bold text-slate-900 group-hover:text-white text-base mb-2 transition-colors">
                  Data Security
                </h3>

                <p className="text-xs text-slate-600 group-hover:text-slate-300 leading-relaxed transition-colors">
                  Multi-tiered officer access control supporting secure
                  surveillance operations and sovereign data protection.
                </p>

              </div>

            </div>

          </div>

        </section>

        {/* =================================================
            HEROES
        ================================================== */}

        <section className="py-12 bg-slate-200 border-b border-slate-300">

          <div className="max-w-7xl mx-auto px-4 sm:px-8 flex justify-center">

            <button
              type="button"
              onClick={() => setIsHeroesOpen(true)}
              className="w-full max-w-3xl bg-[#8b0000] hover:bg-[#6b0000] transition-all duration-300 cursor-pointer text-white p-6 sm:p-8 border-l-[6px] border-amber-500 shadow-xl hover:shadow-2xl hover:-translate-y-1 flex flex-col sm:flex-row items-center sm:justify-between gap-6 text-left"
            >

              <div className="text-center sm:text-left">

                <span className="text-[11px] font-mono text-amber-300 uppercase tracking-widest block mb-2">
                  Tribute
                </span>

                <h4 className="text-xl sm:text-2xl font-bold mb-2">
                  Our Heroes
                </h4>

                <p className="text-sm text-slate-200 max-w-md">
                  Honouring the brave souls defending Indian sovereignty.
                </p>

              </div>

              <span className="inline-flex items-center justify-center px-6 py-3 bg-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider hover:bg-amber-400 transition-colors shadow-md">
                View Gallery [→]
              </span>

            </button>

          </div>

        </section>

      </div>

      {/* =====================================================
          FOOTER
      ====================================================== */}

      <footer className="bg-[#0b192c] text-slate-400 text-xs pt-10 pb-8 border-t-2 border-amber-500">

        <div className="max-w-7xl mx-auto px-4 sm:px-8 space-y-6">

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-slate-800">

            <div>

              <h4 className="text-white font-bold text-sm tracking-wide uppercase">
                Intelligent CCTV Surveillance Platform
              </h4>

              <p className="text-[11px] text-slate-400 font-medium mt-1">
                Government of India | Ministry of Defence
              </p>

            </div>

            <div className="flex flex-wrap gap-6 text-[12px] font-bold text-slate-300">










            </div>

          </div>

          <div className="text-center text-[11px] text-slate-400 font-mono">

            <p>
              © 2026 Intelligent Defence CCTV Surveillance System. All rights reserved.
            </p>

          </div>

        </div>

      </footer>

      {/* =====================================================
          HEROES MODAL
      ====================================================== */}

      {isHeroesOpen && (

        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >

          <div className="relative w-full max-w-3xl bg-slate-50 border-2 border-[#8b0000] shadow-2xl animate-fade-in-1">

            <div className="bg-[#8b0000] text-white p-4 flex justify-between items-center border-b-2 border-amber-500">

              <h3 className="font-bold text-sm tracking-wider uppercase">
                हमारे नायक | ROLL OF HONOUR
              </h3>

              <button
                type="button"
                onClick={() => setIsHeroesOpen(false)}
                className="text-amber-200 hover:text-white cursor-pointer"
                aria-label="Close"
              >
                <X size={18} />
              </button>

            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto hide-scrollbar bg-slate-100">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div className="bg-white border border-slate-300 p-4 flex gap-4 shadow-sm">

                  <div className="w-16 h-20 bg-slate-200 border border-slate-400 shrink-0 flex items-center justify-center text-xs text-slate-500 font-mono">
                    IMAGE
                  </div>

                  <div>
                    <h4 className="font-bold text-[#0b192c] text-sm">
                      Capt. Vikram Batra, PVC
                    </h4>

                    <p className="text-[10px] font-mono text-slate-500 mb-2">
                      13 JAK RIF • Kargil War (1999)
                    </p>

                    <p className="text-xs text-slate-700 leading-relaxed italic">
                      "Yeh Dil Maange More!" Awarded Param Vir Chakra for his
                      supreme sacrifice during Operation Vijay.
                    </p>
                  </div>

                </div>

                <div className="bg-white border border-slate-300 p-4 flex gap-4 shadow-sm">

                  <div className="w-16 h-20 bg-slate-200 border border-slate-400 shrink-0 flex items-center justify-center text-xs text-slate-500 font-mono">
                    IMAGE
                  </div>

                  <div>
                    <h4 className="font-bold text-[#0b192c] text-sm">
                      Maj. Somnath Sharma, PVC
                    </h4>

                    <p className="text-[10px] font-mono text-slate-500 mb-2">
                      4 KUMAON • Battle of Badgam
                    </p>

                    <p className="text-xs text-slate-700 leading-relaxed italic">
                      The first recipient of the Param Vir Chakra for his
                      bravery in the Indo-Pakistani War of 1947.
                    </p>
                  </div>

                </div>

                <div className="bg-white border border-slate-300 p-4 flex gap-4 shadow-sm">

                  <div className="w-16 h-20 bg-slate-200 border border-slate-400 shrink-0 flex items-center justify-center text-xs text-slate-500 font-mono">
                    IMAGE
                  </div>

                  <div>
                    <h4 className="font-bold text-[#0b192c] text-sm">
                      Sub. Joginder Singh, PVC
                    </h4>

                    <p className="text-[10px] font-mono text-slate-500 mb-2">
                      1 SIKH • Sino-Indian War (1962)
                    </p>

                    <p className="text-xs text-slate-700 leading-relaxed italic">
                      Defended his post with unparalleled courage against
                      overwhelming Chinese forces at Bum La.
                    </p>
                  </div>

                </div>

                <div className="bg-white border border-slate-300 p-4 flex gap-4 shadow-sm">

                  <div className="w-16 h-20 bg-slate-200 border border-slate-400 shrink-0 flex items-center justify-center text-xs text-slate-500 font-mono">
                    IMAGE
                  </div>

                  <div>
                    <h4 className="font-bold text-[#0b192c] text-sm">
                      CQMH Abdul Hamid, PVC
                    </h4>

                    <p className="text-[10px] font-mono text-slate-500 mb-2">
                      4 GRENADIERS • Asal Uttar (1965)
                    </p>

                    <p className="text-xs text-slate-700 leading-relaxed italic">
                      Single-handedly destroyed several enemy tanks using a
                      recoilless gun.
                    </p>
                  </div>

                </div>

              </div>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}
