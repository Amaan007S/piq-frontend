// src/contexts/PiAuthContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { db } from "../firebase";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import ensurePiInit from "../utils/piInit";
import { PI_SANDBOX } from "../config/piPlatform";

const PiAuthContext = createContext();

export const usePiAuth = () => {
  const context = useContext(PiAuthContext);
  if (!context) {
    return {
      user: null,
      accessToken: null,
      authStatus: "loading",
      error: null,
      rawAuth: null,
      hasPayments: false,
      signOut: async () => {},
    };
  }
  return context;
};

export const PiAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [authStatus, setAuthStatus] = useState("loading");
  const [error, setError] = useState(null);

  const [rawAuth, setRawAuth] = useState(null);
  const [hasPayments, setHasPayments] = useState(false);

  const signOut = useCallback(async () => {
    try {
      if (window?.Pi && typeof window.Pi.logout === "function") {
        try {
          await window.Pi.logout();
          console.log("Called window.Pi.logout()");
        } catch (e) {
          console.warn("window.Pi.logout() threw:", e);
        }
      }
    } catch (e) {
      console.warn("signOut: Pi SDK not available:", e);
    } finally {
      setUser(null);
      setAccessToken(null);
      setAuthStatus("loading");
      setError(null);
      setRawAuth(null);
      setHasPayments(false);
      window.location.reload();
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const authenticate = async () => {
      try {
        await ensurePiInit({ sandbox: PI_SANDBOX });

        const scopes = ["payments", "username"];

        function onIncompletePaymentFound(payment) {
          console.log("Incomplete payment found (Pi SDK):", payment);
        }

        const result = await window.Pi.authenticate(scopes, onIncompletePaymentFound);

        if (cancelled) return;

        setRawAuth(result);
        console.log("Pi.authenticate result:", result);

        try {
          const hasScope =
            (result && (result.scopes || result.grantedScopes || result.permissions)) || null;

          let found = false;
          if (hasScope) {
            const shape = JSON.stringify(hasScope).toLowerCase();
            found = shape.includes("payments");
          } else {
            found = JSON.stringify(result || "").toLowerCase().includes('"payments"');
          }

          setHasPayments(Boolean(found));
          if (!found) {
            console.warn("Pi.authenticate did not return payments scope (debug):", result);
          } else {
            console.log("Payments scope detected in authenticate result.");
          }
        } catch (e) {
          console.warn("Failed to inspect Pi.authenticate result for payments scope:", e);
          setHasPayments(false);
        }

        const piUser = result?.user ?? null;
        setUser(piUser);
        setAccessToken(result?.accessToken ?? null);
        setAuthStatus("success");

        if (piUser?.username) {
          try {
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
                weeklyScore: 0,
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
              await setDoc(userRef, defaultUserData);
              console.log("New user created in Firestore.");
            } else {
              const data = userSnap.data() || {};
              const patch = {};
              if (!data.username) patch.username = piUser.username;
              if (!data.profile?.avatarUrl) {
                patch["profile.avatarUrl"] =
                  `https://api.dicebear.com/7.x/identicon/svg?seed=${piUser.username}`;
              }
              if (!data.profile?.rank) patch["profile.rank"] = "Rookie";
              if (!data.gameStats) {
                patch.gameStats = {
                  score: 0,
                  streak: 0,
                  maxStreak: 0,
                  completedQuizzes: 0,
                };
              }
              if (!data.powerUps) {
                patch.powerUps = {
                  "Extra Time": 0,
                  "Skip Question": 0,
                  "Second Chance": 0,
                };
              }
              if (!data.wallet) patch.wallet = { piBalance: 0, testnetLinked: true };
              if (!data.transactions) patch.transactions = [];
              if (!data.achievements) patch.achievements = [];
              if (!data.settings) {
                patch.settings = { sound: true, notifications: true, theme: "dark" };
              }

              if (Object.keys(patch).length > 0) {
                await updateDoc(userRef, patch);
                console.log("Backfilled missing fields without overwriting.");
              }
            }
          } catch (fireErr) {
            console.error("Firestore user creation/backfill failed:", fireErr);
          }
        } else {
          console.warn("Pi.authenticate returned no username; skipping Firestore user creation.");
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Pi auth failed:", err);
          setError(err);
          setAuthStatus("error");
          setRawAuth(null);
          setHasPayments(false);
        }
      }
    };

    authenticate();

    return () => {
      cancelled = true;
    };
  }, [signOut]);

  return (
    <PiAuthContext.Provider
      value={{
        user,
        accessToken,
        authStatus,
        error,
        rawAuth,
        hasPayments,
        signOut,
      }}
    >
      {children}
    </PiAuthContext.Provider>
  );
};
