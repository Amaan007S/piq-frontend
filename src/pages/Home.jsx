import { Link } from 'react-router-dom';
import React from "react";
import { FaFire, FaStar, FaBolt } from "react-icons/fa";

const Home = () => {
  return (
    <main className="max-w-3xl mx-auto px-4 text-center mt-6 sm:mt-10">
      <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-yellow-400 leading-tight">
        Daily Crypto Quiz ⚡
      </h1>
      <p className="text-gray-400 mt-4 text-base sm:text-lg">
        Challenge your brain every day, earn rewards, climb the leaderboard.
      </p>

      {/* Feature Cards */}
      <div className="flex flex-col sm:flex-row justify-center items-center sm:space-x-4 mt-10 space-y-4 sm:space-y-0">
        <Feature icon={<FaFire />} title="Streaks" desc="Come back daily and build your streak." />
        <Feature icon={<FaStar />} title="Leaderboard" desc="Compete with others and earn bragging rights." />
        <Feature icon={<FaBolt />} title="Power-Ups" desc="Use boosters to stay on top." />
      </div>

      {/* CTA Button */}
      <Link
        to="/quiz"
        className="inline-block mt-10 px-8 py-3 rounded-2xl bg-yellow-400 text-black text-lg font-bold shadow hover:bg-yellow-300 transition"
      >
        Start Today’s Quiz 🚀
      </Link>
    </main>
  );
};

const Feature = ({ icon, title, desc }) => (
  <div className="bg-[#1A1A1A] p-4 rounded-xl w-full sm:w-40 text-center shadow hover:shadow-yellow-500 transition">
    <div className="flex justify-center items-center text-2xl text-yellow-400 mb-2">{icon}</div>
    <h3 className="font-semibold text-base">{title}</h3>
    <p className="text-sm text-gray-400">{desc}</p>
  </div>
);

export default Home;
