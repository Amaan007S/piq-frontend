// src/contexts/PiAuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

const PiAuthContext = createContext();

export const usePiAuth = () => {
  const context = useContext(PiAuthContext);
  if (!context) {
    return {
      user: null,
      accessToken: null,
      authStatus: "loading",
      error: null,
    };
  }
  return context;
};

export const PiAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [authStatus, setAuthStatus] = useState("loading"); // "loading" | "success" | "error"
  const [error, setError] = useState(null);

  useEffect(() => {
    const authenticate = async () => {
      try {
        window.Pi.init({ sandbox: true });
        const scopes = ["username"];
        const result = await window.Pi.authenticate(scopes, (payment) => {
          console.log("Incomplete payment found:", payment);
        });

        const piUser = result.user;
        setUser(piUser);
        setAccessToken(result.accessToken);
        setAuthStatus("success");

        // 🔥 Firestore: Create doc if new; patch if existing
        const userRef = doc(db, "users", piUser.username);
        const userSnap = await getDoc(userRef);

        const defaultUserData = {
          username: piUser.username,
          createdAt: new Date().toISOString(),
          profile: {
            avatarUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${piUser.username}`,
            rank: "Rookie",
          },
          gameStats: {
            score: 0,
            streak: 0,
            maxStreak: 0,
            completedQuizzes: 0,
          },
          powerUps: {
            "Extra Time": 0,
            "Skip Question": 0,
            "Second Chance": 0,
          },
          wallet: {
            piBalance: 0,
            testnetLinked: true,
          },
          transactions: [],
          achievements: [],
          settings: {
            sound: true,
            notifications: true,
            theme: "dark",
          },
        };

        if (!userSnap.exists()) {
          // ✅ New user
          await setDoc(userRef, defaultUserData);
          console.log("✅ New user created in Firestore.");
        } else {
          console.log("🔁 Existing user loaded from Firestore.");
          // 🩹 Only backfill missing fields, do NOT overwrite progress
          const data = userSnap.data() || {};
          const patch = {};

          if (!data.username) patch["username"] = piUser.username;
          if (!data.profile?.avatarUrl)
            patch["profile.avatarUrl"] = `https://api.dicebear.com/7.x/identicon/svg?seed=${piUser.username}`;
          if (!data.profile?.rank) patch["profile.rank"] = "Rookie";
          if (!data.gameStats)
            patch["gameStats"] = {
              score: 0,
              streak: 0,
              maxStreak: 0,
              completedQuizzes: 0,
            };
          if (!data.powerUps)
            patch["powerUps"] = {
              "Extra Time": 0,
              "Skip Question": 0,
              "Second Chance": 0,
            };
          if (!data.wallet)
            patch["wallet"] = { piBalance: 0, testnetLinked: true };
          if (!data.transactions) patch["transactions"] = [];
          if (!data.achievements) patch["achievements"] = [];
          if (!data.settings)
            patch["settings"] = { sound: true, notifications: true, theme: "dark" };

          if (Object.keys(patch).length > 0) {
            await updateDoc(userRef, patch);
            console.log("🩹 Backfilled missing fields without overwriting.");
          }
        }
      } catch (err) {
        console.error("Pi auth failed:", err);
        setError(err);
        setAuthStatus("error");
      }
    };

    authenticate();
  }, []);

  return (
    <PiAuthContext.Provider value={{ user, accessToken, authStatus, error }}>
      {children}
    </PiAuthContext.Provider>
  );
};
