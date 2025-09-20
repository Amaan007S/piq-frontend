// src/contexts/TransactionHistoryContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { usePiAuth } from "./PiAuthContext";
import { db } from "../firebase";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";

const TransactionHistoryContext = createContext();

export const TransactionHistoryProvider = ({ children }) => {
  const { user, authStatus } = usePiAuth();
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    if (authStatus !== "success" || !user) return;

    // ✅ Listen to transactions subcollection in Firestore
    const q = query(
      collection(db, "users", user.username, "transactions"),
      orderBy("timestamp", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const txs = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setTransactions(txs);
      },
      (err) => console.error("Transaction snapshot error:", err)
    );

    return () => unsub();
  }, [user, authStatus]);

  // We no longer need addTransaction here
  // because purchases & deposits already log directly into Firestore
  return (
    <TransactionHistoryContext.Provider value={{ transactions }}>
      {children}
    </TransactionHistoryContext.Provider>
  );
};

export const useTransactionHistory = () => useContext(TransactionHistoryContext);
