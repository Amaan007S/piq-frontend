import React from "react";
import { usePiWallet } from "../contexts/PiWalletContext";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { FaWallet } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useTransactionHistory } from "../contexts/TransactionHistoryContext";
import { usePiAuth } from "../contexts/PiAuthContext";
import { PI_SANDBOX } from "../config/piPlatform";

const PURCHASE_AMOUNTS = [1, 5, 10];

const Wallet = () => {
  const { piBalance, handleTestnetPayment, isWalletTopupPending } = usePiWallet();
  const { transactions } = useTransactionHistory();
  const { user, authStatus, error } = usePiAuth();
  const navigate = useNavigate();

  const clearDevHistory = () => {
    console.warn("In Firestore mode, manual clearing must be done in console.");
    toast.error("Clear History disabled (Firestore mode).");
  };

  return (
    <div className="min-h-screen bg-[#121212] text-white px-4 py-10 flex flex-col items-center">
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
          Buy Pi credit and review the server-side wallet ledger.
        </p>
      </motion.div>

      <div className="text-center text-sm text-white mb-6">
        {authStatus === "loading" && <p>Logging in via Pi...</p>}
        {authStatus === "success" && user && (
          <p className="text-green-400">Logged in as {user.username}</p>
        )}
        {authStatus === "error" && error && (
          <p className="text-red-400">Login failed: {error.message}</p>
        )}
      </div>

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-[#1F1F1F] border border-yellow-500 rounded-2xl shadow-lg w-full max-w-md p-6 text-center mb-6"
      >
        <p className="text-lg text-gray-400 mb-1">Wallet Balance</p>
        <h2 className="text-4xl font-bold text-yellow-400">{piBalance} Pi</h2>
        <p className="text-xs text-gray-500 mt-3">
          {PI_SANDBOX ? "Sandbox mode is enabled." : "Production mode is enabled."}
        </p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-md mb-10">
        {PURCHASE_AMOUNTS.map((amount) => (
          <motion.button
            key={amount}
            whileTap={{ scale: isWalletTopupPending ? 1 : 0.96 }}
            onClick={() => handleTestnetPayment({ amount })}
            disabled={isWalletTopupPending}
            className="bg-yellow-400 hover:bg-yellow-300 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed text-black px-6 py-3 rounded-2xl font-semibold transition"
          >
            {isWalletTopupPending ? "Processing..." : `Buy ${amount} Pi`}
          </motion.button>
        ))}
      </div>

      <div className="w-full max-w-md mb-10">
        <h3 className="text-xl font-semibold text-yellow-300 mb-3 text-center sm:text-left">
          Wallet Transactions
        </h3>
        <ul className="text-sm bg-[#1C1C1C] rounded-xl p-4 space-y-3 max-h-64 overflow-y-auto">
          {transactions.length === 0 ? (
            <li className="text-gray-500 text-center">No transactions yet.</li>
          ) : (
            transactions.map((tx) => {
              const signedAmount = tx.type === "debit" ? -Number(tx.amount || 0) : Number(tx.amount || 0);
              return (
                <li key={tx.id || tx.paymentId || `${tx.type}-${tx.createdAt?.seconds || tx.createdAt?.toMillis?.() || Math.random()}`} className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold">{tx.type}: {tx.paymentId || tx.id}</p>
                    <p className="text-xs text-gray-400">
                      {tx.createdAt?.toDate
                        ? tx.createdAt.toDate().toLocaleString()
                        : "-"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end">
                    <span
                      className={`text-sm font-bold ${
                        signedAmount >= 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {signedAmount >= 0 ? `+${signedAmount} Pi` : `${signedAmount} Pi`}
                    </span>
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
              );
            })
          )}
        </ul>
      </div>

      {process.env.NODE_ENV !== "production" && (
        <button
          onClick={clearDevHistory}
          className="mb-10 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl text-sm transition"
        >
          Clear Transaction History (Dev)
        </button>
      )}

      <button
        onClick={() => navigate("/store")}
        className="mb-4 bg-blue-500 hover:bg-blue-400 text-white px-8 py-3 rounded-2xl transition"
      >
        Back to Store
      </button>
    </div>
  );
};

export default Wallet;

