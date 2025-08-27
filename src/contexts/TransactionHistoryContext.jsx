import React, { createContext, useContext, useState, useEffect } from "react";

const TransactionHistoryContext = createContext();

export const TransactionHistoryProvider = ({ children }) => {
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

  // Optional: sync if localStorage is changed elsewhere
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
