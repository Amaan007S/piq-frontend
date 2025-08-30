import React, { createContext, useContext, useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { usePiAuth } from "./PiAuthContext";

const StreakContext = createContext();

export const StreakProvider = ({ children }) => {
  const { user, authStatus } = usePiAuth();
  const [streak, setStreak] = useState(null);
  const [maxStreak, setMaxStreak] = useState(null);
  const [score, setScore] = useState(null); // lifetime score
  const [loaded, setLoaded] = useState(false);

  // 🔥 Load stats from Firestore on login
  useEffect(() => {
    const loadStats = async () => {
      if (authStatus !== "success" || !user) return;

      try {
        const userRef = doc(db, "users", user.username);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const data = userSnap.data();
          setStreak(data.gameStats?.streak ?? 0);
          setMaxStreak(data.gameStats?.maxStreak ?? 0);
          setScore(data.gameStats?.score ?? 0);
        }
      } catch (err) {
        console.error("Error loading stats:", err);
      } finally {
        setLoaded(true);
      }
    };

    loadStats();
  }, [authStatus, user]);

  // ✅ Only update local state; Firestore handled by useUserDataSync
  const incrementStreak = () => {
    setStreak((prev) => {
      const updated = (prev ?? 0) + 1;
      setMaxStreak((prevMax) => Math.max(prevMax ?? 0, updated));
      return updated;
    });
  };

  const resetStreak = () => {
    setStreak(0);
  };

  const addScore = (points) => {
    setScore((prev) => (prev ?? 0) + points);
  };

  return (
    <StreakContext.Provider
      value={{
        streak,
        maxStreak,
        score,
        addScore,
        incrementStreak,
        resetStreak,
        setStreak,
        setMaxStreak,
        setScore,
        loaded,
      }}
    >
      {children}
    </StreakContext.Provider>
  );
};

export const useStreak = () => {
  const context = useContext(StreakContext);
  if (!context) {
    throw new Error("useStreak must be used within a StreakProvider");
  }
  return context;
};
