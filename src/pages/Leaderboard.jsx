import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "../firebase";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { usePiAuth } from "../contexts/PiAuthContext";
import mockData from "../data/mockData";
import { ChevronDown } from "lucide-react";

const medalColors = [
  "from-yellow-400 to-yellow-600",
  "from-gray-400 to-gray-600",
  "from-orange-400 to-orange-600",
];

const MODES = [
  { id: "lifetime", label: "Lifetime Score" },
  { id: "streak", label: "Current Streak" },
];

// ✅ Animated number for smooth transitions
const AnimatedNumber = ({ value, className = "" }) => {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    if (start === end) {
      setDisplay(end);
      return;
    }

    let duration = 800;
    let stepTime = Math.abs(Math.floor(duration / (end - start || 1)));
    let current = start;

    const timer = setInterval(() => {
      current += 1;
      setDisplay(current);
      if (current >= end) clearInterval(timer);
    }, stepTime);

    return () => clearInterval(timer);
  }, [value]);

  return <span className={className}>{display}</span>;
};

const Leaderboard = () => {
  const { user } = usePiAuth();
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [mode, setMode] = useState("lifetime");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    let q;
    if (mode === "lifetime") {
      q = query(collection(db, "users"), orderBy("gameStats.score", "desc"), limit(50));
    } else if (mode === "streak") {
      q = query(collection(db, "users"), orderBy("gameStats.streak", "desc"), limit(50));
    }

    const unsub = onSnapshot(q, (snapshot) => {
      const firestoreUsers = snapshot.docs.map((doc) => {
        const u = doc.data();
        return {
          id: doc.id,
          name: u.username,
          score: u.gameStats?.score ?? 0,
          streak: u.gameStats?.streak ?? 0,
          isMock: false,
        };
      });

      let combined = [...firestoreUsers];

      if (combined.length < 10) {
        const filler = mockData.slice(0, 10 - combined.length).map((m, i) => ({
          id: `mock-${i}`,
          name: m.name,
          score: m.score,
          streak: m.streak,
          isMock: true,
        }));
        combined = [...combined, ...filler];
      }

      if (mode === "lifetime") {
        combined.sort((a, b) => b.score - a.score);
      } else if (mode === "streak") {
        combined.sort((a, b) => b.streak - a.streak);
      }

      setLeaderboardData(combined);
    });

    return () => unsub();
  }, [mode]);

  const you = leaderboardData.find((u) => u.name === user?.username);
  const yourRank = you ? leaderboardData.indexOf(you) + 1 : null;

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-10 text-white animate-fade-in font-sans">
      {/* Header + Dropdown */}
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 sm:mb-8">
        <h2 className="text-2xl sm:text-4xl font-extrabold text-yellow-400 text-center sm:text-left tracking-tight">
          🏆 Leaderboard
        </h2>

        <div className="relative mt-4 sm:mt-0 w-48">
          <button
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="w-full flex items-center justify-between bg-[#1A1A1A] border border-yellow-500 px-4 py-2 rounded-xl shadow-md text-yellow-300 font-medium hover:bg-[#2A2A2A] transition"
          >
            {MODES.find((m) => m.id === mode)?.label}
            <ChevronDown
              className={`w-5 h-5 ml-2 transition-transform ${
                dropdownOpen ? "rotate-180" : "rotate-0"
              }`}
            />
          </button>

          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.2 }}
                className="absolute w-full mt-2 bg-[#1A1A1A] border border-yellow-500 rounded-xl shadow-lg overflow-hidden z-20"
              >
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setMode(m.id);
                      setDropdownOpen(false);
                    }}
                    className={`w-full px-4 py-2 text-left hover:bg-yellow-500 hover:text-black transition ${
                      mode === m.id ? "bg-yellow-500 text-black font-semibold" : "text-yellow-300"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Profile Card */}
      {you && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6 sm:mb-8 relative bg-[#121212]/80 backdrop-blur-lg border border-yellow-500/40 rounded-2xl shadow-xl p-5 sm:p-7 flex flex-col sm:flex-row items-center justify-between gap-6"
        >
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-yellow-400 to-yellow-600 text-black font-extrabold rounded-xl px-4 py-2 shadow-lg">
              #{yourRank}
            </div>
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              {you.name} (You)
            </h3>
          </div>

          <div className="flex gap-4 sm:gap-6 text-sm sm:text-base font-semibold">
            <div className="px-5 py-3 rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 shadow-inner">
              🎯 Score:{" "}
              <span className="text-yellow-400 font-extrabold">
                <AnimatedNumber value={you.score} />
              </span>
            </div>
            <div className="px-5 py-3 rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 shadow-inner">
              🔥 Streak:{" "}
              <span className="text-yellow-400 font-extrabold">
                <AnimatedNumber value={you.streak} />
              </span>
            </div>
          </div>

          <div className="absolute inset-0 rounded-2xl border border-yellow-500/10 pointer-events-none" />
        </motion.div>
      )}

      {/* Leaderboard Table */}
      <div className="rounded-2xl overflow-hidden shadow-xl relative">
        <div className="bg-[#1A1A1A] max-h-[70vh] sm:max-h-[600px] overflow-y-auto no-scrollbar">
          <div className="sticky top-0 z-10 backdrop-blur-md bg-[#1A1A1A]/90">
            <div className="grid grid-cols-4 py-3 sm:py-5 border-b border-gray-700 font-semibold text-yellow-300 text-xs sm:text-base">
              <span className="text-left px-3 sm:px-6">Rank</span>
              <span className="text-left">Name</span>
              <span className="text-center">Score</span>
              <span className="text-center">🔥</span>
            </div>
          </div>

          {leaderboardData.map((u, index) => {
            const isYou = u.name === user?.username;
            const isTopThree = index < 3;
            const medals = ["🥇", "🥈", "🥉"];

            return (
              <motion.div
                key={u.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className={`grid grid-cols-4 items-center py-2.5 sm:py-3.5 text-xs sm:text-base rounded-xl mb-2 sm:mb-3 transition
                  ${isTopThree ? `bg-gradient-to-r ${medalColors[index]} font-extrabold` : "bg-gray-800 text-white"}
                  ${isYou ? "border border-yellow-400" : ""}
                  ${u.isMock ? "opacity-70 italic" : ""}
                  hover:scale-[1.005] sm:hover:scale-[1.01] hover:shadow-md hover:shadow-yellow-300/15`}
              >
                <span className="px-3 sm:px-6 text-left font-bold">
                  {isTopThree ? medals[index] : `#${index + 1}`}
                </span>
                <span
                  className={`truncate ${
                    isTopThree ? "text-black" : "text-white"
                  } ${
                    isYou
                      ? isTopThree
                        ? "text-black font-extrabold"
                        : "text-yellow-300 font-extrabold"
                      : ""
                  }`}
                >
                  {isYou ? `${u.name} (You)` : u.name}
                </span>
                <span
                  className={`text-center ${
                    isTopThree ? "text-black" : "text-white"
                  }`}
                >
                  <AnimatedNumber value={u.score} />
                </span>
                <span
                  className={`text-center text-lg ${
                    isTopThree ? "text-black" : "text-white"
                  }`}
                >
                  🔥 <AnimatedNumber value={u.streak} />
                </span>
              </motion.div>
            );
          })}
        </div>

        {you && (
          <div className="sticky bottom-0 z-10 bg-[#1A1A1A]/95 backdrop-blur-md border-t border-yellow-500 shadow-lg rounded-b-2xl">
            <div className="grid grid-cols-4 items-center py-2.5 sm:py-3.5 text-xs sm:text-base text-yellow-300 font-extrabold">
              <span className="px-3 sm:px-6 text-left">#{yourRank}</span>
              <span className="truncate">{you.name} (You)</span>
              <span className="text-center">
                <AnimatedNumber value={you.score} />
              </span>
              <span className="text-center text-lg">
                🔥 <AnimatedNumber value={you.streak} />
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
