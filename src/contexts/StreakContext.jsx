import React, { createContext, useContext, useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { usePiAuth } from "./PiAuthContext";

const StreakContext = createContext();

export const StreakProvider = ({ children }) => {
  const { user, authStatus } = usePiAuth();
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  // 🔥 Load streaks from Firestore
  useEffect(() => {
    const loadStreaks = async () => {
      if (authStatus !== "success" || !user) return;

      try {
        const userRef = doc(db, "users", user.username);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const data = userSnap.data();
          setStreak(data.gameStats?.streak || 0);
          setMaxStreak(data.gameStats?.maxStreak || 0);
        }
      } catch (err) {
        console.error("Error loading streaks:", err);
      } finally {
        setLoading(false);
      }
    };

    loadStreaks();
  }, [authStatus, user]);

  // ✅ Update streak in Firestore whenever it changes
  const updateStreakInDB = async (newStreak, newMaxStreak) => {
    if (!user) return;
    try {
      const userRef = doc(db, "users", user.username);
      await updateDoc(userRef, {
        "gameStats.streak": newStreak,
        "gameStats.maxStreak": newMaxStreak,
      });
    } catch (err) {
      console.error("Error updating streaks:", err);
    }
  };

  const incrementStreak = () => {
    setStreak((prev) => {
      const updated = prev + 1;
      const newMax = Math.max(updated, maxStreak);
      setMaxStreak(newMax);
      updateStreakInDB(updated, newMax);
      return updated;
    });
  };

  const resetStreak = () => {
    setStreak(0);
    updateStreakInDB(0, maxStreak);
  };

  return (
    <StreakContext.Provider
      value={{
        streak,
        maxStreak,
        incrementStreak,
        resetStreak,
        loading,
        setStreak,      // <-- Add this
        setMaxStreak,   // <-- Add this
      }}
    >
      {children}
    </StreakContext.Provider>
  );
};

// ✅ Safety return to avoid undefined errors
export const useStreak = () => {
  const context = useContext(StreakContext);
  if (!context) {
    throw new Error("useStreak must be used within a StreakProvider");
  }
  return context;
};
