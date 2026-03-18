// src/contexts/TransactionHistoryContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { usePiAuth } from "./PiAuthContext";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";

const TransactionHistoryContext = createContext();

function normalizeTransaction(docSnap) {
  const data = docSnap.data() || {};
  const rawType = data.type || "credit";
  const type =
    rawType === "deposit" ? "credit" : rawType === "purchase" ? "debit" : rawType;
  const amount = Math.abs(Number(data.amount || 0));
  const createdAt = data.createdAt || data.timestamp || null;
  const source =
    data.source || (rawType === "deposit" ? "pi_payment" : rawType === "purchase" ? "powerup_purchase" : "unknown");

  return {
    id: docSnap.id,
    ...data,
    type,
    amount: Number.isFinite(amount) ? amount : 0,
    source,
    createdAt,
  };
}

function getSortValue(transaction) {
  const candidate = transaction.createdAt;
  if (candidate?.toMillis) return candidate.toMillis();
  if (candidate?.seconds) return candidate.seconds * 1000;
  if (typeof candidate === "string") {
    const parsed = Date.parse(candidate);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export const TransactionHistoryProvider = ({ children }) => {
  const { user, authStatus } = usePiAuth();
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    if (authStatus !== "success" || !user) return;

    const unsub = onSnapshot(
      collection(db, "users", user.username, "transactions"),
      (snap) => {
        const txs = snap.docs
          .map((docSnap) => normalizeTransaction(docSnap))
          .sort((a, b) => getSortValue(b) - getSortValue(a));
        setTransactions(txs);
      },
      (err) => console.error("Transaction snapshot error:", err)
    );

    return () => unsub();
  }, [user, authStatus]);

  return (
    <TransactionHistoryContext.Provider value={{ transactions }}>
      {children}
    </TransactionHistoryContext.Provider>
  );
};

export const useTransactionHistory = () => useContext(TransactionHistoryContext);
