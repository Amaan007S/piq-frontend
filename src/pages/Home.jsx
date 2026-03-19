import { Link } from 'react-router-dom';
import React from "react";
import { FaFire, FaStar, FaBolt } from "react-icons/fa";

const Feature = ({ icon, title, desc }) => (
  <div className="bg-[#1A1A1A] p-5 rounded-xl w-full text-center shadow hover:shadow-yellow-500/30 transition">
    <div className="flex justify-center items-center text-2xl text-yellow-400 mb-3">{icon}</div>
    <h3 className="font-semibold text-base text-white">{title}</h3>
    <p className="text-sm text-gray-400 mt-1">{desc}</p>
  </div>
);

const Home = () => {
  return (
    /*
      Mobile: natural scroll, no height lock, no overflow-hidden.
      Pi Browser has a smaller real viewport than 100vh due to browser chrome.
      Locking height + overflow-hidden clips content and prevents scrolling.

      Desktop (sm+): fixed height + overflow-hidden to prevent page scroll
      since all content fits within the viewport at that size.
    */
    <main className="flex flex-col items-center justify-start pt-6 px-4 pb-10 sm:h-[calc(100vh-72px)] sm:overflow-hidden sm:justify-center sm:pt-0 sm:pb-0">
      <div className="w-full max-w-3xl text-center flex flex-col items-center gap-6">

        {/* whitespace-nowrap prevents emoji dropping to new line */}
        <h1 className="font-bold text-yellow-400 leading-tight">
          <span className="whitespace-nowrap text-[1.75rem] sm:text-4xl md:text-5xl">
            Daily Crypto Quiz ⚡
          </span>
        </h1>

        <p className="text-gray-400 text-sm sm:text-lg max-w-xl">
          Challenge your brain every day, earn rewards, climb the leaderboard.
        </p>

        {/* CTA before cards */}
        <Link
          to="/quiz"
          className="inline-block px-8 py-3 rounded-2xl bg-yellow-400 text-black text-lg font-bold shadow hover:bg-yellow-300 transition"
        >
          Start Today's Quiz 🚀
        </Link>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
          <Feature icon={<FaFire />} title="Streaks"     desc="Come back daily and build your streak." />
          <Feature icon={<FaStar />} title="Leaderboard" desc="Compete with others and earn bragging rights." />
          <Feature icon={<FaBolt />} title="Power-Ups"   desc="Use boosters to stay on top, outsmart your opponents." />
        </div>

      </div>
    </main>
  );
};

export default Home;