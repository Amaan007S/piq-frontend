// src/pages/MyWallet.jsx
import React from "react";
import { usePiWallet } from "../contexts/PiWalletContext";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { FaWallet } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useTransactionHistory } from "../contexts/TransactionHistoryContext";
import { usePiAuth } from "../contexts/PiAuthContext";
import { db } from "../firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

const Wallet = () => {
  const { piBalance, addPi, handleTestnetPayment } = usePiWallet();
  const { transactions } = useTransactionHistory();
  const { user, authStatus, error } = usePiAuth();
  const navigate = useNavigate();

  const clearDevHistory = () => {
    // Just for dev — wipes local + requires Firestore reset
    console.warn("⚠️ In Firestore mode, manual clearing must be done in console.");
    toast.error("Clear History disabled (Firestore mode).");
  };

  const handleRefill = async () => {
    const refillAmount = 5;
    addPi(refillAmount);

    // ✅ Firestore log
    if (user) {
      try {
        const txRef = collection(db, "users", user.username, "transactions");
        await addDoc(txRef, {
          type: "refill",
          detail: "Developer refill",
          amount: refillAmount,
          status: "completed",
          timestamp: serverTimestamp(),
        });
      } catch (err) {
        console.error("Dev refill transaction log error:", err);
      }
    }

    toast.success("Wallet topped up with 5π Pi!", {
      icon: "⚡",
      style: {
        background: "#1F1F1F",
        border: "1px solid #333",
        color: "#fff",
        borderRadius: "12px",
      },
    });
  };

  return (
    <div className="min-h-screen bg-[#121212] text-white px-4 py-10 flex flex-col items-center">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md text-center mb-8"
      >
        <div className="text-yellow-400 text-5xl mb-4">
          <FaWallet />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold">My Pi Wallet</h1>
        <p className="text-gray-400 mt-2 text-sm sm:text-base">
          Manage your Pi balance and top up for power-up purchases.
        </p>
      </motion.div>

      {/* Auth Status */}
      <div className="text-center text-sm text-white mb-6">
        {authStatus === "loading" && <p>🔐 Logging in via Pi...</p>}
        {authStatus === "success" && user && (
          <p className="text-green-400">✅ Logged in as {user.username}</p>
        )}
        {authStatus === "error" && (
          <p className="text-red-400">❌ Login failed: {error.message}</p>
        )}
      </div>

      {/* Pi Balance Card */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-[#1F1F1F] border border-yellow-500 rounded-2xl shadow-lg w-full max-w-md p-6 text-center mb-6"
      >
        <p className="text-lg text-gray-400 mb-1">Your Pi Balance</p>
        <h2 className="text-4xl font-bold text-yellow-400">{piBalance}π</h2>
      </motion.div>

      {/* Actions */}
      <div className="flex flex-col gap-4 w-full max-w-md mb-10">
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={handleRefill}
          className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-2xl font-semibold transition"
        >
          +5π Dev Refill
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => handleTestnetPayment({ amount: 1 })}
          className="bg-yellow-400 hover:bg-yellow-300 text-black px-6 py-3 rounded-2xl font-semibold transition"
        >
          Top Up with Pi Testnet Wallet
        </motion.button>
      </div>

      {/* Transaction History */}
      <div className="w-full max-w-md mb-10">
        <h3 className="text-xl font-semibold text-yellow-300 mb-3 text-center sm:text-left">
          🧾 Transaction History
        </h3>
        <ul className="text-sm bg-[#1C1C1C] rounded-xl p-4 space-y-3 max-h-64 overflow-y-auto">
          {transactions.length === 0 ? (
            <li className="text-gray-500 text-center">No transactions yet.</li>
          ) : (
            transactions.map((tx) => (
              <li key={tx.id} className="flex justify-between items-center">
                <div>
                  <p className="font-semibold">{tx.type}: {tx.detail}</p>
                  <p className="text-xs text-gray-400">
                    {tx.timestamp?.toDate
                      ? tx.timestamp.toDate().toLocaleString()
                      : tx.time || "—"}
                  </p>
                </div>
                <div className="flex flex-col items-end">
                  <span
                    className={`text-sm font-bold ${
                      tx.amount > 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {tx.amount > 0 ? `+${tx.amount}π` : `${tx.amount}π`}
                  </span>
                  {/* ✅ Status Badge */}
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded mt-1 ${
                      tx.status === "completed"
                        ? "bg-green-600 text-white"
                        : tx.status === "pending"
                        ? "bg-yellow-600 text-white"
                        : "bg-red-600 text-white"
                    }`}
                  >
                    {tx.status || "unknown"}
                  </span>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Dev Only - Clear History */}
      {process.env.NODE_ENV !== "production" && (
        <button
          onClick={clearDevHistory}
          className="mb-10 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl text-sm transition"
        >
          🧹 Clear Transaction History (Dev)
        </button>
      )}

      {/* Back Button */}
      <button
        onClick={() => navigate("/store")}
        className="mb-4 bg-blue-500 hover:bg-blue-400 text-white px-8 py-3 rounded-2xl transition"
      >
        ← Back to Store
      </button>
    </div>
  );
};

export default Wallet;
