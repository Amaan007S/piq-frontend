import React, { createContext, useContext, useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

const PiAuthContext = createContext();

export const usePiAuth = () => {
  const context = useContext(PiAuthContext);
  // Fallback to prevent destructuring undefined
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

        // 🔥 Firestore: Create user doc if missing, otherwise update schema if outdated
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
          // ✅ New user → create doc
          await setDoc(userRef, defaultUserData);
          console.log("✅ New user created in Firestore.");
        } else {
          // ✅ Existing user → merge in case schema changed (future proof)
          await updateDoc(userRef, {
            ...defaultUserData,
            username: piUser.username, // ensure username stays synced
          });
          console.log("🔁 Existing user loaded from Firestore.");
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