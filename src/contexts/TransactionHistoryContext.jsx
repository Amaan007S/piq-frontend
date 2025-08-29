import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { usePiAuth } from "./PiAuthContext"; // ⬅️ adjust path if needed
import { db } from "../firebase";            // ⬅️ adjust path if needed
import { doc, onSnapshot, updateDoc } from "firebase/firestore";

const TransactionHistoryContext = createContext();

export const TransactionHistoryProvider = ({ children }) => {
  const { user, authStatus } = usePiAuth();

  const [transactions, setTransactions] = useState(() => {
    const saved = localStorage.getItem("piq_transactions");
    return saved ? JSON.parse(saved) : [];
  });

  const addTransaction = (type, detail, amount) => {
    const newTx = {
      id: Date.now(),
      type,
      detail,
      amount,
      time: new Date().toLocaleString(),
    };

    setTransactions((prev) => {
      const updated = [newTx, ...prev];
      localStorage.setItem("piq_transactions", JSON.stringify(updated));
      return updated;
    });
  };

  // 🔁 Firestore → App (realtime)
  useEffect(() => {
    if (authStatus !== "success" || !user) return;

    const userRef = doc(db, "users", user.username);
    const unsub = onSnapshot(
      userRef,
      (snap) => {
        const cloudTx = snap.data()?.transactions;
        if (!cloudTx) return;

        setTransactions((prev) => {
          const prevStr = JSON.stringify(prev);
          const cloudStr = JSON.stringify(cloudTx);
          if (prevStr === cloudStr) return prev; // no change
          localStorage.setItem("piq_transactions", cloudStr);
          return cloudTx;
        });
      },
      (err) => console.error("Transactions onSnapshot error:", err)
    );

    return () => unsub();
  }, [authStatus, user]);

  // ☁️ App → Firestore (sync back, guarded)
  const lastPushedRef = useRef(null);
  useEffect(() => {
    const push = async () => {
      if (authStatus !== "success" || !user) return;

      const payload = JSON.stringify(transactions);
      if (payload === lastPushedRef.current) return; // avoid ping-pong

      try {
        const userRef = doc(db, "users", user.username);
        await updateDoc(userRef, { transactions });
        lastPushedRef.current = payload;
      } catch (err) {
        console.error("Transactions updateDoc error:", err);
      }
    };

    push();
  }, [transactions, authStatus, user]);

  // Optional: sync if localStorage is changed elsewhere (kept as-is)
  useEffect(() => {
    const handleStorage = () => {
      const saved = localStorage.getItem("piq_transactions");
      if (saved) setTransactions(JSON.parse(saved));
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return (
    <TransactionHistoryContext.Provider value={{ transactions, addTransaction }}>
      {children}
    </TransactionHistoryContext.Provider>
  );
};

export const useTransactionHistory = () => useContext(TransactionHistoryContext);
