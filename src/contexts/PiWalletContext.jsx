// src/contexts/PiWalletContext.jsx
import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { toast } from "sonner"; 
import { db } from "../firebase"; // adjust path if needed
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { usePiAuth } from "./PiAuthContext"; // adjust path if needed

const PiWalletContext = createContext();

export const PiWalletProvider = ({ children }) => {
  const { user, authStatus } = usePiAuth();

  const [piBalance, setPiBalance] = useState(10); // 💰 Default: 10 Pi
  const [testnetLinked, setTestnetLinked] = useState(true);

  // 🔁 Firestore → App (realtime)
  useEffect(() => {
    if (authStatus !== "success" || !user) return;

    const userRef = doc(db, "users", user.username);
    const unsub = onSnapshot(
      userRef,
      (snap) => {
        const cloudWallet = snap.data()?.wallet;
        if (!cloudWallet) return;

        // Update local state only if changed
        setPiBalance((prev) =>
          prev === cloudWallet.piBalance ? prev : cloudWallet.piBalance
        );
        setTestnetLinked((prev) =>
          prev === cloudWallet.testnetLinked ? prev : cloudWallet.testnetLinked
        );
      },
      (err) => console.error("Wallet onSnapshot error:", err)
    );

    return () => unsub();
  }, [authStatus, user]);

  // ☁️ App → Firestore (sync back)
  const lastPushedRef = useRef(null);
  useEffect(() => {
    const push = async () => {
      if (authStatus !== "success" || !user) return;

      const payload = JSON.stringify({ piBalance, testnetLinked });
      if (payload === lastPushedRef.current) return;

      try {
        const userRef = doc(db, "users", user.username);
        await updateDoc(userRef, { wallet: { piBalance, testnetLinked } });
        lastPushedRef.current = payload;
      } catch (err) {
        console.error("Wallet updateDoc error:", err);
      }
    };

    push();
  }, [piBalance, testnetLinked, authStatus, user]);

  // ---- YOUR EXISTING LOGIC (unchanged) ----
  const addPi = (amount) => {
    setPiBalance((prev) => prev + amount);
  };

  const deductPi = (amount) => {
    if (piBalance >= amount) {
      setPiBalance((prev) => prev - amount);
      return true;
    }
    return false;
  };

  const handleTestnetPayment = async ({ amount = 1, memo = "Top-up PiQ Wallet" }) => {
    if (!window?.Pi) {
      console.error("Pi SDK not found.");
      return;
    }

    try {
      const payment = await window.Pi.createPayment({
        amount: amount.toString(),
        memo,
        metadata: { app: "PiQ", reason: "wallet_topup" },
      });

      // After success
      if (payment.identifier) {
        addPi(Number(amount));
        toast.success(`Received ${amount}π into your PiQ Wallet!`);
      }
    } catch (err) {
      toast.error("Payment failed or cancelled.");
      console.error(err);
    }
  };

  return (
    <PiWalletContext.Provider
      value={{ piBalance, addPi, deductPi, handleTestnetPayment, testnetLinked, setTestnetLinked }}
    >
      {children}
    </PiWalletContext.Provider>
  );
};

export const usePiWallet = () => useContext(PiWalletContext);
