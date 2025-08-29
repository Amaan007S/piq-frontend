import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { usePiAuth } from "./PiAuthContext"; // ⬅️ adjust path if needed
import { db } from "../firebase";           // ⬅️ adjust path if needed
import { doc, onSnapshot, updateDoc } from "firebase/firestore";

// Create the context
const PowerUpContext = createContext();

const defaultPowerUps = {
  "Extra Time": 0,
  "Skip Question": 0,
  "Second Chance": 0,
};

export const PowerUpProvider = ({ children }) => {
  const { user, authStatus } = usePiAuth();

  // 🔒 keep existing localStorage-first logic
  const [ownedPowerUps, setOwnedPowerUps] = useState(() => {
    const saved = localStorage.getItem("ownedPowerUps");
    return saved ? JSON.parse(saved) : defaultPowerUps;
  });

  // 🔁 keep localStorage persistence
  useEffect(() => {
    localStorage.setItem("ownedPowerUps", JSON.stringify(ownedPowerUps));
  }, [ownedPowerUps]);

  // 🛰️ Firestore → App (realtime)
  useEffect(() => {
    if (authStatus !== "success" || !user) return;

    const userRef = doc(db, "users", user.username);
    const unsub = onSnapshot(
      userRef,
      (snap) => {
        const cloud = snap.data()?.powerUps;
        if (!cloud) return;

        // Merge to ensure any new keys in schema exist
        const merged = { ...defaultPowerUps, ...cloud };

        // Update state only if different to avoid loops
        setOwnedPowerUps((prev) => {
          const a = JSON.stringify(prev);
          const b = JSON.stringify(merged);
          return a === b ? prev : merged;
        });
      },
      (err) => console.error("PowerUps onSnapshot error:", err)
    );

    return () => unsub();
  }, [authStatus, user]);

  // ☁️ App → Firestore (debounced by equality + last push ref)
  const lastPushedRef = useRef(null);
  useEffect(() => {
    const push = async () => {
      if (authStatus !== "success" || !user) return;

      const payload = JSON.stringify(ownedPowerUps);
      if (payload === lastPushedRef.current) return; // avoid redundant writes

      try {
        const userRef = doc(db, "users", user.username);
        await updateDoc(userRef, { powerUps: ownedPowerUps });
        lastPushedRef.current = payload;
      } catch (err) {
        console.error("PowerUps updateDoc error:", err);
      }
    };

    push();
  }, [ownedPowerUps, authStatus, user]);

  // ---- YOUR EXISTING LOGIC (unchanged) ----
  const triggerPowerUp = (powerUpName) => {
    if (ownedPowerUps[powerUpName] > 0) {
      setOwnedPowerUps((prev) => ({
        ...prev,
        [powerUpName]: prev[powerUpName] - 1,
      }));
    }
  };

  const buyPowerUp = (powerUpName) => {
    setOwnedPowerUps((prev) => ({
      ...prev,
      [powerUpName]: (prev[powerUpName] || 0) + 1,
    }));
  };

  // ⚡ Developer tool: Reset owned power-ups
  const resetPowerUps = () => {
    setOwnedPowerUps(defaultPowerUps);
    localStorage.setItem("ownedPowerUps", JSON.stringify(defaultPowerUps));
    // Firestore write will auto-trigger from the effect above
  };

  return (
    <PowerUpContext.Provider
      value={{ ownedPowerUps, triggerPowerUp, buyPowerUp, resetPowerUps }}
    >
      {children}
    </PowerUpContext.Provider>
  );
};

// Custom hook to use the PowerUpContext
export const usePowerUp = () => {
  const context = useContext(PowerUpContext);
  if (!context) {
    throw new Error("usePowerUp must be used within a PowerUpProvider");
  }
  return context;
};
