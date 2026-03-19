import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePiWallet } from "../contexts/PiWalletContext";
import { motion } from "framer-motion";
import { FaWallet } from "react-icons/fa";
import { AiOutlineCheckCircle, AiOutlineClockCircle, AiOutlineInbox } from "react-icons/ai";
import { useNavigate } from "react-router-dom";
import { useTransactionHistory } from "../contexts/TransactionHistoryContext";
import { PI_SANDBOX } from "../config/piPlatform";
import { toast } from "sonner";

const PURCHASE_AMOUNTS = [1, 5, 10];

const formatPi = (value) =>
  `${Number(value || 0).toFixed(Number.isInteger(Number(value || 0)) ? 0 : 2)} Pi`;

const getTransactionLabel = (tx) => {
  if (tx.source === "powerup_purchase" || tx.type === "debit") return "Purchase";
  if (tx.source === "pi_payment" || tx.type === "credit") return "Deposit";
  return tx.type === "debit" ? "Purchase" : "Deposit";
};

const getTransactionDetail = (tx) => {
  if (tx.source === "powerup_purchase") {
    const quantity = Number(tx.quantity || 1);
    const name = tx.powerupName || tx.powerupType || tx.requestId || "Power-up";
    return quantity > 1 ? `${name} x${quantity}` : name;
  }
  if (tx.source === "pi_payment") {
    return tx.plan ? `Wallet top-up - ${tx.plan}` : "Wallet top-up";
  }
  return tx.paymentId || tx.requestId || tx.id || "Transaction";
};

const getStatusClasses = (status) => {
  if (status === "completed") return "bg-emerald-500/12 text-green-400";
  if (status === "pending")   return "bg-amber-500/12 text-amber-200";
  if (status === "failed")    return "bg-red-500/12 text-red-300";
  return "bg-zinc-500/12 text-zinc-300";
};

const getTopupDescription = (amount) => {
  if (amount === 1)  return "Quick top-up";
  if (amount === 5)  return "Best for most players";
  if (amount === 10) return "For frequent play";
  return "Quick top-up";
};

// ─── Balance Card ─────────────────────────────────────────────────────────────
const BalanceCard = ({ balance, onAddPi, onGoToStore }) => (
  <motion.section
    initial={{ opacity: 0, y: 14 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35 }}
    className="relative overflow-hidden rounded-[24px] bg-[#1F1F1F] px-4 py-5 shadow-[0_10px_28px_rgba(0,0,0,0.16)] sm:px-5 sm:py-6"
  >
    <div className="relative flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-xl text-[#FFB800]">
          <FaWallet />
        </div>
        <div>
          <p className="text-sm text-zinc-400">Available balance</p>
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">{formatPi(balance)}</h1>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-sm text-zinc-400">Use Pi to unlock power-ups instantly</p>
        <p className="text-xs text-zinc-500">{balance} Pi available</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onAddPi}
          className="w-full rounded-2xl bg-[#FFB800]/90 px-4 py-3 text-sm font-semibold text-black transition hover:bg-[#ffca3d]"
        >
          Add Pi
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onGoToStore}
          className="w-full rounded-2xl border border-white/12 bg-transparent px-4 py-3 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/5"
        >
          Go to Store
        </motion.button>
      </div>
    </div>
  </motion.section>
);

// ─── Top-up Option Card ───────────────────────────────────────────────────────
const TopupOption = ({ amount, recommended, selected, disabled, highlight, onSelect }) => (
  <motion.button
    whileHover={{ y: disabled ? 0 : -2, scale: disabled ? 1 : 1.01 }}
    whileTap={{ scale: disabled ? 1 : 0.97 }}
    onClick={onSelect}
    disabled={disabled}
    className={`relative h-full rounded-[22px] p-4 text-left transition ${
      // FIX 1: Removed scale-[1.02] on selected — causes horizontal overflow on mobile.
      selected
        ? "border border-yellow-400/50 bg-[#242424]"
        : highlight
        ? "border border-yellow-400/40 bg-[#242424]"
        : "bg-[#1F1F1F]"
    } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
  >
    {recommended ? (
      <span className="absolute right-4 top-4 rounded-full bg-yellow-400 px-2 py-[2px] text-xs text-black">
        Best for most players
      </span>
    ) : null}

    <div className="flex h-full flex-col justify-between gap-3">
      <div className="space-y-1">
        <p className="text-xl font-semibold text-white">{amount} Pi</p>
        {/* FIX 2: Removed duplicate getTopupDescription() call that was rendering twice.
            Bottom line now shows a neutral secondary label instead. */}
        <p className="text-sm text-zinc-400">{getTopupDescription(amount)}</p>
      </div>
      <p className="text-xs text-zinc-500">Tap to add</p>
    </div>
  </motion.button>
);

// ─── Transaction Item ─────────────────────────────────────────────────────────
const TransactionItem = ({ tx }) => {
  const signedAmount = tx.type === "debit" ? -Number(tx.amount || 0) : Number(tx.amount || 0);
  const amountText = signedAmount >= 0 ? `+${signedAmount} Pi` : `${signedAmount} Pi`;
  const timeText = tx.createdAt?.toDate
    ? tx.createdAt.toDate().toLocaleString()
    : "Just now";

  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      // FIX 3: Always single-row flex. Removed flex-col default + sm:flex-row.
      // Amount+status was dropping to a disconnected second row on mobile.
      // Left side gets flex-1 min-w-0 to truncate long text. Right side is
      // shrink-0 so it never compresses or wraps regardless of screen width.
      className="flex items-center gap-3 rounded-xl bg-[#1F1F1F] p-3"
    >
      {/* Left: icon + text */}
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div
          className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
            signedAmount >= 0
              ? "bg-emerald-500/10 text-emerald-300"
              : "bg-red-500/10 text-red-300"
          }`}
        >
          {signedAmount >= 0 ? (
            <AiOutlineCheckCircle className="text-lg" />
          ) : (
            <AiOutlineClockCircle className="text-lg" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-base font-semibold text-white">{getTransactionLabel(tx)}</p>
          <p className="truncate text-sm text-zinc-400">{getTransactionDetail(tx)}</p>
          <p className="mt-0.5 text-xs text-zinc-500">{timeText}</p>
        </div>
      </div>

      {/* Right: amount + status — fixed min-w so both lines share the same
          right edge. text-right on amount ensures it aligns to the container
          edge, and the badge sits flush below it. */}
      <div className="flex w-[72px] shrink-0 flex-col items-end gap-1.5">
        <p
          className={`w-full text-right text-sm font-semibold ${
            signedAmount >= 0 ? "text-emerald-300" : "text-red-300"
          }`}
        >
          {amountText}
        </p>
        <span
          className={`w-full rounded-full px-2 py-0.5 text-center text-xs font-medium ${getStatusClasses(tx.status)}`}
        >
          {tx.status || "unknown"}
        </span>
      </div>
    </motion.li>
  );
};

// ─── Wallet Page ──────────────────────────────────────────────────────────────
const Wallet = () => {
  const { piBalance, handleTestnetPayment, isWalletTopupPending } = usePiWallet();
  const { transactions } = useTransactionHistory();
  const navigate = useNavigate();
  const [selectedAmount, setSelectedAmount] = useState(5);
  const previousBalanceRef = useRef(piBalance);

  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => {
      const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : b.createdAt?.seconds || 0;
      return bTime - aTime;
    });
  }, [transactions]);

  useEffect(() => {
    if (piBalance > previousBalanceRef.current) {
      toast(
        <div className="flex flex-col gap-3">
          <div>
            <p className="font-semibold text-white">You're ready to use your Pi</p>
            <p className="text-sm text-zinc-400">
              Your wallet is funded and ready for the next power-up.
            </p>
          </div>
          <button
            onClick={() => navigate("/store")}
            className="rounded-xl bg-[#FFB800] px-4 py-2 text-sm font-semibold text-black"
          >
            Go to Store
          </button>
        </div>,
        {
          duration: 3000,
          position: "top-center",
          style: {
            background: "#1F1F1F",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "white",
            padding: "14px",
            borderRadius: "16px",
            boxShadow: "0 12px 32px rgba(0,0,0,0.22)",
          },
        }
      );
    }
    previousBalanceRef.current = piBalance;
  }, [navigate, piBalance]);

  return (
    <>
      <style>{`
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
      `}</style>
      <div className="min-h-screen bg-[#0F0F0F] px-4 py-6 text-white sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 lg:gap-8">
          <motion.header
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="flex flex-col gap-2"
          >
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              My Wallet
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
              Add Pi when you need it and review your recent wallet activity.
            </p>
          </motion.header>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
            {/* ── Left column ── */}
            <div className="flex flex-col gap-6">
              <BalanceCard
                balance={piBalance}
                onAddPi={() => handleTestnetPayment({ amount: selectedAmount })}
                onGoToStore={() => navigate("/store")}
              />

              {piBalance === 0 && (
                <p className="mt-[-8px] text-sm text-yellow-300">
                  You need Pi to start using power-ups
                </p>
              )}

              <motion.section
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05, duration: 0.35 }}
                className="space-y-4"
              >
                <div>
                  <h2 className="text-2xl font-semibold text-white">Top up</h2>
                  <p className="text-sm text-zinc-400">
                    Choose an amount and add Pi instantly.
                  </p>
                </div>

                <div className="grid items-stretch gap-3 md:grid-cols-3">
                  {PURCHASE_AMOUNTS.map((amount) => (
                    <TopupOption
                      key={amount}
                      amount={amount}
                      recommended={amount === 5}
                      selected={selectedAmount === amount}
                      highlight={amount === 5 && piBalance < 1}
                      disabled={isWalletTopupPending}
                      onSelect={() => {
                        setSelectedAmount(amount);
                        handleTestnetPayment({ amount });
                      }}
                    />
                  ))}
                </div>

                <p className="text-xs text-zinc-500">
                  {PI_SANDBOX ? "Sandbox wallet mode." : "Production wallet mode."}
                </p>
              </motion.section>
            </div>

            {/* ── Right column: Transactions ── */}
            <motion.section
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.35 }}
              className="flex flex-col overflow-hidden rounded-2xl bg-[#1A1A1A] p-4 lg:max-h-[435px]"
            >
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-semibold text-white">Transactions</h2>
                <p className="text-sm text-zinc-400">Deposits and purchases at a glance.</p>
              </div>

              {sortedTransactions.length === 0 ? (
                <div className="mt-4 flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl bg-[#1F1F1F] px-6 py-8 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-2xl text-zinc-500">
                    <AiOutlineInbox />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-white">No transactions yet</h3>
                    <p className="text-sm leading-6 text-zinc-400">
                      Your deposits and purchases will appear here.
                    </p>
                  </div>
                </div>
              ) : (
                <ul className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-2">
                  {sortedTransactions.map((tx) => (
                    <TransactionItem
                      key={
                        tx.id ||
                        tx.paymentId ||
                        tx.requestId ||
                        `${tx.type}-${
                          tx.createdAt?.seconds ||
                          tx.createdAt?.toMillis?.() ||
                          Math.random()
                        }`
                      }
                      tx={tx}
                    />
                  ))}
                </ul>
              )}
            </motion.section>
          </div>
        </div>
      </div>
    </>
  );
};

export default Wallet;