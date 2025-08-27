// src/contexts/PiWalletContext.jsx
import React, { createContext, useContext, useState } from "react";
import { toast } from "sonner"; // Import toast for notifications

const PiWalletContext = createContext();

export const PiWalletProvider = ({ children }) => {
  const [piBalance, setPiBalance] = useState(10); // 💰 Default: 10 Pi

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
    <PiWalletContext.Provider value={{ piBalance, addPi, deductPi, handleTestnetPayment }}>
      {children}
    </PiWalletContext.Provider>
  );
};

export const usePiWallet = () => useContext(PiWalletContext);