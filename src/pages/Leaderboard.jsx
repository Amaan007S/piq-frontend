import React from "react";
import { motion } from "framer-motion";

const medalColors = [
  "from-yellow-400 to-yellow-600",
  "from-gray-400 to-gray-600",
  "from-orange-400 to-orange-600",
];

const Leaderboard = ({ leaderboardData = [] }) => {
  const you = leaderboardData.find(user => user.name.includes("(You)"));
  const yourRank = you ? leaderboardData.indexOf(you) + 1 : null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-10 text-white animate-fade-in">
      <h2 className="text-3xl sm:text-4xl font-bold text-yellow-400 text-center mb-8 sm:mb-10">
        🏆 Leaderboard
      </h2>

      <div className="rounded-2xl overflow-hidden shadow-xl relative">
        <div className="bg-[#1A1A1A] max-h-[600px] overflow-y-auto no-scrollbar">

          {/* Sticky Header */}
          <div className="sticky top-0 z-10 backdrop-blur-md bg-[#1A1A1A]/80">
            <div className="grid grid-cols-4 py-4 sm:py-5 border-b border-gray-700 font-semibold text-yellow-300 text-sm sm:text-base">
              <span className="text-left px-4 sm:px-6">Rank</span>
              <span className="text-left">Name</span>
              <span className="text-center">Score</span>
              <span className="text-center">🔥</span>
            </div>
          </div>

          {/* Leaderboard Rows */}
          {leaderboardData.map((user, index) => {
            const isYou = user.name.includes("(You)");
            const isTopThree = index < 3;
            const medals = ["🥇", "🥈", "🥉"];

            return (
              <motion.div
                key={index}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`grid grid-cols-4 items-center py-3 sm:py-3.5 text-sm sm:text-base rounded-xl mb-2 sm:mb-3 transition
                  ${isTopThree ? `bg-gradient-to-r ${medalColors[index]} text-black font-semibold` : "bg-gray-800 text-white"}
                  ${isYou ? "border border-yellow-400" : ""}
                  hover:scale-[1.005] sm:hover:scale-[1.01] hover:shadow-md hover:shadow-yellow-300/15`}
              >
                <span className="px-4 sm:px-6 text-left font-bold">
                  {isTopThree ? medals[index] : `#${index + 1}`}
                </span>
                <span className={`text-left truncate ${isYou ? "text-yellow-300 font-bold" : ""}`}>
                  {user.name}
                </span>
                <span className="text-center">{user.score}</span>
                <span className="text-center text-lg">🔥 {user.streak}</span>
              </motion.div>
            );
          })}
        </div>

        {/* Sticky "You" Row */}
        {you && (
          <div className="sticky bottom-0 z-10 bg-[#1A1A1A]/90 backdrop-blur-md border-t border-yellow-500 shadow-lg rounded-b-2xl">
            <div className="grid grid-cols-4 items-center py-3 sm:py-3.5 text-sm sm:text-base text-yellow-300 font-bold">
              <span className="px-4 sm:px-6 text-left">#{yourRank}</span>
              <span className="text-left truncate">{you.name}</span>
              <span className="text-center">{you.score}</span>
              <span className="text-center text-lg">🔥 {you.streak}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
