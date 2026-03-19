import React, { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import classNames from "classnames";

const navItems = [
  { label: "Home", path: "/" },
  { label: "Quiz", path: "/quiz" },
  { label: "Leaderboard", path: "/leaderboard" },
  { label: "Store", path: "/store" },
  { label: "Wallet", path: "/wallet" },
];

const Layout = ({ children }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isFirstLoad = useRef(true);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname !== "/") {
      localStorage.setItem("lastRoute", location.pathname);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!isFirstLoad.current) return;

    isFirstLoad.current = false;

    const lastRoute = localStorage.getItem("lastRoute");
    const hasValidHash = window.location.hash && window.location.hash !== "#" && window.location.hash !== "#/";

    if (
      !hasValidHash &&
      window.location.pathname === "/" &&
      lastRoute &&
      lastRoute !== "/"
    ) {
      navigate(lastRoute, { replace: true });
    }
  }, [navigate]);

  const navLinkClasses = ({ isActive }) =>
    classNames(
      "block px-4 py-2 text-lg",
      isActive ? "text-yellow-400 font-semibold" : "text-white hover:text-yellow-400"
    );

  return (
    <div className="relative flex min-h-screen flex-col bg-black text-white">
      <nav className="z-20 flex items-center justify-between bg-[#111] p-4">
        <h1
          className="cursor-pointer text-xl font-bold text-yellow-400"
          onClick={() => navigate("/")}
        >
          PiQ
        </h1>

        <div className="hidden items-center space-x-4 sm:flex">
          {navItems.map(({ label, path }) => (
            <NavLink key={path} to={path} className={navLinkClasses} end={path === "/"}>
              {label}
            </NavLink>
          ))}
          <NavLink to="/profile">
            <img
              src="https://api.dicebear.com/7.x/identicon/svg?seed=DrX"
              alt="Profile"
              className="h-10 w-10 rounded-full border-2 border-yellow-400 transition hover:scale-105"
            />
          </NavLink>
        </div>

        <div className="sm:hidden">
          <button onClick={() => setIsMenuOpen(!isMenuOpen)}>
            <svg className="h-6 w-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {isMenuOpen && (
        <div
          className="fixed inset-0 z-10 bg-black/50 backdrop-blur-sm sm:hidden"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      <div
        className={`fixed right-0 top-0 z-10 h-full w-64 transform border-l border-gray-800 bg-[#111] shadow-lg transition-transform duration-300 ease-in-out sm:hidden ${
          isMenuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col space-y-2 p-4 pt-20">
          {navItems.map(({ label, path }) => (
            <NavLink
              key={path}
              to={path}
              className={navLinkClasses}
              end={path === "/"}
              onClick={() => setIsMenuOpen(false)}
            >
              {label}
            </NavLink>
          ))}
          <NavLink to="/profile" onClick={() => setIsMenuOpen(false)} className="flex items-center space-x-2 px-4 pt-4">
            <img
              src="https://api.dicebear.com/7.x/identicon/svg?seed=DrX"
              alt="Profile"
              className="h-10 w-10 rounded-full border-2 border-yellow-400"
            />
            <span className="text-white">Your Profile</span>
          </NavLink>
        </div>
      </div>

      <main className="z-0 flex-1 px-4 py-6">{children}</main>

      <footer className="bg-[#111] p-4 text-center text-sm text-gray-500">
        © 2025 PiQ — Powered by Pi Network
      </footer>
    </div>
  );
};

export default Layout;