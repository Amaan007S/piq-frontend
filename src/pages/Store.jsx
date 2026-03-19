import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { usePowerUp } from "../contexts/PowerUpContext";
import { usePiWallet } from "../contexts/PiWalletContext";
import { toast } from "sonner";
import {
  AiOutlineCheckCircle,
  AiOutlinePlus,
  AiOutlineMinus,
} from "react-icons/ai";
import { powerUpsConfig } from "../config/powerUpsConfig";

const formatPi = (value) =>
  `${Number(value || 0).toFixed(Number.isInteger(Number(value || 0)) ? 0 : 2)} Pi`;

const getBadge = (index) => {
  if (index === 0) return "Popular";
  if (index === 1) return "Best value";
  return null;
};

const getBenefitLine = (name) => {
  switch (name) {
    case "Extra Time":      return "+10 seconds to answer";
    case "Skip Question":   return "Skip instantly, keep streak";
    case "Second Chance":   return "Retry after wrong answer";
    default:                return "Boost your next round";
  }
};

const getCtaLabel = (name, ownedCount) => {
  if (ownedCount === 0) return "Get more";
  return "Purchase";
};

// ─── Quantity Selector ──────────────────────────────────────────────────────
const QuantitySelector = ({ value, onDecrease, onIncrease, disabled }) => (
  <div className="inline-flex items-center gap-2 rounded-full bg-black/20 px-2 py-2">
    <motion.button
      whileTap={{ scale: disabled ? 1 : 0.97 }}
      onClick={onDecrease}
      disabled={disabled}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
      aria-label="Decrease quantity"
    >
      <AiOutlineMinus />
    </motion.button>
    <span className="min-w-[2ch] text-center text-base font-semibold text-white">
      {value}
    </span>
    <motion.button
      whileTap={{ scale: disabled ? 1 : 0.97 }}
      onClick={onIncrease}
      disabled={disabled}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
      aria-label="Increase quantity"
    >
      <AiOutlinePlus />
    </motion.button>
  </div>
);

// ─── Balance Card ────────────────────────────────────────────────────────────
const BalanceCard = ({ balance, onOpenWallet, lowBalanceMessage }) => (
  <motion.section
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35 }}
    className="relative overflow-hidden rounded-[24px] bg-[#1F1F1F] px-5 py-5 shadow-[0_10px_30px_rgba(0,0,0,0.18)]"
  >
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,184,0,0.12),_transparent_42%)]" />
    <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-1.5">
        <p className="text-sm text-zinc-400">Your balance</p>
        <h2 className="text-3xl font-semibold text-white sm:text-4xl">
          {formatPi(balance)}
        </h2>
        <p className="text-sm text-yellow-300">
          {lowBalanceMessage ||
            "Not enough Pi for more power-ups → Add from Wallet"}
        </p>
      </div>

      <div className="w-full sm:w-auto sm:min-w-[180px]">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onOpenWallet}
          className="w-full rounded-2xl border border-white/12 bg-transparent px-4 py-3 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/5"
        >
          Wallet
        </motion.button>
      </div>
    </div>
  </motion.section>
);

// ─── Purchase Modal ──────────────────────────────────────────────────────────
const PurchaseModal = ({
  isOpen, powerUp, quantity, totalCost,
  remainingBalance, isProcessing, onCancel, onConfirm,
}) => (
  <AnimatePresence>
    {isOpen && powerUp ? (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-md rounded-xl bg-[#1F1F1F] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.35)]"
        >
          <div className="space-y-5">
            <div className="space-y-2">
              <h3 className="text-2xl font-semibold text-white">Confirm Purchase</h3>
              <p className="text-sm text-zinc-400">
                Review your order before using Pi from your wallet.
              </p>
            </div>

            <div className="space-y-3 rounded-2xl bg-black/20 p-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-zinc-400">Power-up</span>
                <span className="font-medium text-white">{powerUp.name}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-zinc-400">Quantity</span>
                <span className="font-medium text-white">{quantity}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-zinc-400">Total cost</span>
                <span className="font-medium text-white">{totalCost} Pi</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-zinc-400">Remaining balance</span>
                <span className="font-medium text-white">{remainingBalance} Pi</span>
              </div>
              <p className="text-sm text-yellow-300">
                You'll have {remainingBalance} Pi left
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onCancel}
                disabled={isProcessing}
                className="w-full rounded-xl border border-white/12 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </motion.button>
              <motion.button
                whileTap={{ scale: isProcessing ? 1 : 0.97 }}
                onClick={onConfirm}
                disabled={isProcessing}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FFB800] px-4 py-3 text-sm font-semibold text-black transition hover:bg-[#ffca3d] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isProcessing ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                    Processing...
                  </>
                ) : (
                  "Confirm"
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    ) : null}
  </AnimatePresence>
);

// ─── Power-Up Card ───────────────────────────────────────────────────────────
const PowerUpCard = ({
  powerUp, quantity, ownedCount, totalCost,
  disabled, featured, isPending, isAdded,
  shortage, onIncrease, onDecrease, onBuy, badge,
}) => {
  const { name, icon, description, price } = powerUp;

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      whileHover={{ y: -3, scale: 1.01 }}
      className={`h-full rounded-[24px] p-5 shadow-[0_10px_24px_rgba(0,0,0,0.14)] transition ${
        featured
          // FIX: removed scale-[1.02] — causes horizontal overflow on mobile.
          // Desktop gets the subtle lift via sm:scale-[1.02] only.
          ? "border border-yellow-400/40 bg-[#242424] shadow-[0_12px_30px_rgba(255,184,0,0.08)] sm:scale-[1.02]"
          : "bg-[#1F1F1F]"
      }`}
    >
      <div className="flex h-full flex-col justify-between">
        {/* ── Card Header ── */}
        <div>
          <div className="flex items-start gap-4">
            <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-xl text-[#FFB800]">
              {icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="space-y-2">
                {/* Name + badge + price row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <h2 className="truncate text-xl font-semibold text-white">{name}</h2>
                    {badge ? (
                      <span className="rounded-full bg-yellow-400/90 px-2 py-[2px] text-xs font-medium text-black">
                        {badge}
                      </span>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-base font-semibold text-yellow-400">
                    {price} Pi
                  </span>
                </div>

                <p className="line-clamp-1 text-sm font-medium text-gray-300">
                  {getBenefitLine(name)}
                </p>
                <p className="line-clamp-2 text-sm text-gray-400">{description}</p>

                {ownedCount === 0 ? (
                  <p className="text-sm text-yellow-300">You're out of {name}</p>
                ) : shortage > 0 ? (
                  <p className="text-sm text-yellow-300">You're {shortage} Pi away</p>
                ) : (
                  <p className="text-sm text-zinc-500">Owned: {ownedCount}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/*
          ── Bottom Action Row ──────────────────────────────────────────────
          FIX: On mobile, stack into two rows so nothing overflows.
            Row 1: QuantitySelector  (left-aligned)
            Row 2: "X Pi" label + Buy button  (full width button)
          On sm+ screens, restore the original single-row layout.
        */}
        {/* Single row always — button flex-1 fills remaining space naturally */}
        <div className="mt-4 flex items-center gap-3">
          <QuantitySelector
            value={quantity}
            onDecrease={onDecrease}
            onIncrease={onIncrease}
            disabled={isPending}
          />
          <span className="shrink-0 text-sm text-gray-400">{totalCost} Pi</span>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onBuy}
            className={`flex-1 rounded-2xl px-3 py-3 text-center text-sm font-semibold transition ${
              disabled
                ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                : isAdded
                ? "bg-emerald-500 text-white"
                : "bg-[#FFB800] text-black hover:bg-[#ffca3d]"
            }`}
          >
            {isPending
              ? "Processing..."
              : disabled
              ? `Add ${shortage} Pi`
              : isAdded
              ? "Added"
              : getCtaLabel(name, ownedCount)}
          </motion.button>
        </div>
      </div>
    </motion.article>
  );
};

// ─── Store Page ──────────────────────────────────────────────────────────────
const Store = () => {
  const navigate = useNavigate();
  const { ownedPowerUps } = usePowerUp();
  const { piBalance, purchasePowerUpWithWallet, isStorePurchasePending } = usePiWallet();

  const [purchaseQuantities, setPurchaseQuantities] = useState(
    powerUpsConfig.reduce((acc, { name, price }) => {
      acc[name] = piBalance >= price * 2 ? 2 : 1;
      return acc;
    }, {})
  );
  const [selectedPowerUp, setSelectedPowerUp] = useState(null);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recentlyAdded, setRecentlyAdded] = useState({});

  const featuredPowerUp = useMemo(
    () => powerUpsConfig[1]?.name || powerUpsConfig[0]?.name,
    []
  );
  const cheapestPowerUp = useMemo(
    () => Math.min(...powerUpsConfig.map((p) => Number(p.price || 0))),
    []
  );
  const lowBalanceMessage =
    piBalance > 0 && piBalance < cheapestPowerUp
      ? `You're ${Math.max(0, cheapestPowerUp - piBalance)} Pi away from your next power-up`
      : null;

  useEffect(() => {
    setPurchaseQuantities((prev) => {
      const next = { ...prev };
      let changed = false;
      powerUpsConfig.forEach(({ name, price }) => {
        if ((prev[name] == null || prev[name] === 1) && piBalance >= price * 2) {
          next[name] = 2;
          changed = true;
        }
        if (prev[name] == null) {
          next[name] = 1;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [piBalance]);

  useEffect(() => {
    if (!Object.keys(recentlyAdded).length) return undefined;
    const timers = Object.keys(recentlyAdded).map((name) =>
      setTimeout(() => {
        setRecentlyAdded((prev) => {
          const next = { ...prev };
          delete next[name];
          return next;
        });
      }, 1500)
    );
    return () => timers.forEach(clearTimeout);
  }, [recentlyAdded]);

  const handleIncreaseQuantity = (powerUpName) => {
    if (isStorePurchasePending || isProcessing) return;
    setPurchaseQuantities((prev) => ({ ...prev, [powerUpName]: prev[powerUpName] + 1 }));
  };

  const handleDecreaseQuantity = (powerUpName) => {
    if (isStorePurchasePending || isProcessing) return;
    setPurchaseQuantities((prev) => ({
      ...prev,
      [powerUpName]: Math.max(1, prev[powerUpName] - 1),
    }));
  };

  const handleOpenPurchaseModal = (powerUp) => {
    const quantity = purchaseQuantities[powerUp.name];
    const totalCost = powerUp.price * quantity;
    if (isStorePurchasePending || isProcessing) return;
    if (piBalance < totalCost) {
      navigate("/wallet");
      return;
    }
    setSelectedPowerUp(powerUp);
    setSelectedQuantity(quantity);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isProcessing) return;
    setIsModalOpen(false);
    setSelectedPowerUp(null);
    setSelectedQuantity(1);
  };

  const handleConfirmPurchase = async () => {
    if (!selectedPowerUp || isProcessing || isStorePurchasePending) return;
    setIsProcessing(true);
    const totalCost = selectedPowerUp.price * selectedQuantity;

    const ok = await purchasePowerUpWithWallet({
      name: selectedPowerUp.name,
      price: selectedPowerUp.price,
      quantity: selectedQuantity,
    });

    if (!ok) {
      setIsProcessing(false);
      return;
    }

    setRecentlyAdded((prev) => ({ ...prev, [selectedPowerUp.name]: true }));
    setIsProcessing(false);
    setIsModalOpen(false);

    toast(
      <div className="flex items-center gap-3">
        <AiOutlineCheckCircle className="text-3xl text-green-400" />
        <div className="space-y-1">
          <p className="font-semibold text-white">Power-up unlocked</p>
          <p className="text-sm text-zinc-400">
            Bought {selectedQuantity} {selectedPowerUp.name}(s) for {totalCost} Pi.
          </p>
          <p className="text-sm text-yellow-300">Use it in your next quiz</p>
        </div>
      </div>,
      {
        duration: 2600,
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

    setSelectedPowerUp(null);
    setSelectedQuantity(1);
  };

  const modalTotalCost = selectedPowerUp ? selectedPowerUp.price * selectedQuantity : 0;
  const remainingBalance = Math.max(0, piBalance - modalTotalCost);

  return (
    <>
      <div className="min-h-screen bg-[#0F0F0F] px-4 py-6 text-white sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 lg:gap-8">
          <motion.header
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="flex flex-col gap-2"
          >
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Store
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
              Choose the power-ups that help you stay composed, recover faster,
              and protect your streak.
            </p>
          </motion.header>

          <BalanceCard
            balance={piBalance}
            onOpenWallet={() => navigate("/wallet")}
            lowBalanceMessage={lowBalanceMessage}
          />

          <section className="grid items-stretch gap-4 lg:grid-cols-3 lg:gap-5">
            {powerUpsConfig.map((powerUp, index) => {
              const { name, price } = powerUp;
              const totalCost = price * purchaseQuantities[name];
              const shortage = Math.max(0, totalCost - piBalance);
              const disabled =
                isStorePurchasePending || isProcessing || piBalance < totalCost;

              return (
                <PowerUpCard
                  key={name}
                  powerUp={powerUp}
                  quantity={purchaseQuantities[name]}
                  ownedCount={ownedPowerUps[name] || 0}
                  totalCost={totalCost}
                  disabled={disabled}
                  featured={name === featuredPowerUp}
                  isPending={isStorePurchasePending || isProcessing}
                  isAdded={Boolean(recentlyAdded[name])}
                  shortage={shortage}
                  onIncrease={() => handleIncreaseQuantity(name)}
                  onDecrease={() => handleDecreaseQuantity(name)}
                  onBuy={() => handleOpenPurchaseModal(powerUp)}
                  badge={getBadge(index)}
                />
              );
            })}
          </section>
        </div>
      </div>

      <PurchaseModal
        isOpen={isModalOpen}
        powerUp={selectedPowerUp}
        quantity={selectedQuantity}
        totalCost={modalTotalCost}
        remainingBalance={remainingBalance}
        isProcessing={isProcessing}
        onCancel={handleCloseModal}
        onConfirm={handleConfirmPurchase}
      />
    </>
  );
};

export default Store;