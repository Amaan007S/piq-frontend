import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom"; // Import useNavigate
import classNames from "classnames";

const Layout = ({ children }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate(); // Initialize useNavigate

  const navLinkClasses = ({ isActive }) =>
    classNames(
      "block px-4 py-2 text-lg",
      isActive ? "text-yellow-400 font-semibold" : "text-white hover:text-yellow-400"
    );

  return (
    <div className="min-h-screen bg-black text-white flex flex-col relative">
      {/* Navbar */}
      <nav className="bg-[#111] p-4 flex justify-between items-center z-20">
        {/* PiQ Name */}
        <h1
          className="text-xl font-bold text-yellow-400 cursor-pointer"
          onClick={() => navigate("/")} // Redirect to Home on click
        >
          PiQ
        </h1>

        {/* Desktop Nav */}
        <div className="hidden sm:flex items-center space-x-4">
          <NavLink to="/" className={navLinkClasses}>Home</NavLink>
          <NavLink to="/quiz" className={navLinkClasses}>Quiz</NavLink>
          <NavLink to="/leaderboard" className={navLinkClasses}>Leaderboard</NavLink>
          <NavLink to="/store" className={navLinkClasses}>Store</NavLink>
          <NavLink to="/profile">
            <img
              src="https://api.dicebear.com/7.x/identicon/svg?seed=DrX"
              alt="Profile"
              className="w-10 h-10 rounded-full border-2 border-yellow-400 hover:scale-105 transition"
            />
          </NavLink>
        </div>

        {/* Hamburger Icon - Mobile */}
        <div className="sm:hidden">
          <button onClick={() => setIsMenuOpen(!isMenuOpen)}>
            <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Overlay Background for Mobile Menu */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-10 sm:hidden"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      {/* Slide-in Mobile Menu */}
      <div
        className={`sm:hidden fixed top-0 right-0 h-full w-64 bg-[#111] border-l border-gray-800 shadow-lg z-10 transform transition-transform duration-300 ease-in-out ${
          isMenuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col space-y-2 p-4 pt-20">
          <NavLink to="/" className={navLinkClasses} onClick={() => setIsMenuOpen(false)}>Home</NavLink>
          <NavLink to="/quiz" className={navLinkClasses} onClick={() => setIsMenuOpen(false)}>Quiz</NavLink>
          <NavLink to="/leaderboard" className={navLinkClasses} onClick={() => setIsMenuOpen(false)}>Leaderboard</NavLink>
          <NavLink to="/store" className={navLinkClasses} onClick={() => setIsMenuOpen(false)}>Store</NavLink>
          <NavLink to="/profile" onClick={() => setIsMenuOpen(false)} className="flex items-center space-x-2 px-4 pt-4">
            <img
              src="https://api.dicebear.com/7.x/identicon/svg?seed=DrX"
              alt="Profile"
              className="w-10 h-10 rounded-full border-2 border-yellow-400"
            />
            <span className="text-white">Your Profile</span>
          </NavLink>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 px-4 py-6 z-0">{children}</main>

      {/* Footer */}
      <footer className="bg-[#111] text-center p-4 text-sm text-gray-500">
        © 2025 PiQ — Powered by Pi Network
      </footer>
    </div>
  );
};

export default Layout;