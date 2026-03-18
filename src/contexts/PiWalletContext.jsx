import React, { createContext, useContext, useState, useEffect } from "react";
import { toast } from "sonner";
import { db } from "../firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { usePiAuth } from "./PiAuthContext";
import createPiPayment from "../utils/createPiPayment";
import { PI_API_BASE, PI_SANDBOX } from "../config/piPlatform";

const PiWalletContext = createContext();

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const rawText = await response.text();
  let parsedBody = null;
  try {
    parsedBody = rawText ? JSON.parse(rawText) : null;
  } catch (err) {
    parsedBody = null;
  }

  if (!response.ok) {
    throw new Error(parsedBody?.error || rawText || `Request failed with ${response.status}`);
  }

  return parsedBody;
}

function createRequestId(prefix) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export const PiWalletProvider = ({ children }) => {
  const { user, authStatus, hasPayments, rawAuth } = usePiAuth();
  const [piBalance, setPiBalance] = useState(0);
  const [testnetLinked, setTestnetLinked] = useState(true);
  const [isWalletTopupPending, setIsWalletTopupPending] = useState(false);
  const [isStorePurchasePending, setIsStorePurchasePending] = useState(false);

  useEffect(() => {
    if (authStatus !== "success" || !user) return;

    const userRef = doc(db, "users", user.username);
    const unsub = onSnapshot(
      userRef,
      (snap) => {
        const wallet = snap.data()?.wallet || {};
        setPiBalance(Number(wallet.piBalance || 0));
        setTestnetLinked(Boolean(wallet.testnetLinked ?? true));
      },
      (err) => console.error("Wallet onSnapshot error:", err)
    );

    return () => unsub();
  }, [authStatus, user]);

  const handleTestnetPayment = async ({ amount = 1, memo } = {}) => {
    if (isWalletTopupPending) {
      return false;
    }
    if (!window?.Pi) {
      toast.error("Pi Browser SDK not detected.");
      return false;
    }
    if (authStatus !== "success" || !user) {
      toast.error("Please sign in before starting a payment.");
      return false;
    }
    if (!hasPayments) {
      console.warn("User auth does not include payments scope. rawAuth:", rawAuth);
      toast.error(
        "Payments permission required. Please sign out and sign back in to grant Payments permission."
      );
      return false;
    }

    setIsWalletTopupPending(true);
    try {
      await createPiPayment(
        {
          amount: Number(amount).toString(),
          memo: memo || `Buy ${amount} Pi for PiQ wallet`,
          metadata: {
            app: "PiQ",
            reason: "wallet_topup",
            userId: user.username,
            requestedAmount: Number(amount),
            sandbox: PI_SANDBOX,
          },
        },
        {
          onReadyForServerApproval: () => {
            toast.message(`Preparing ${amount} Pi payment...`);
          },
          onReadyForServerCompletion: (paymentId, txid, response) => {
            const creditedAmount = response?.amount || Number(amount);
            const balance = response?.balance;
            toast.success(
              balance !== undefined
                ? `Received ${creditedAmount} Pi. Wallet balance is now ${balance} Pi.`
                : `Received ${creditedAmount} Pi into your wallet.`
            );
            setIsWalletTopupPending(false);
          },
          onCancel: () => {
            toast.error("Payment cancelled.");
            setIsWalletTopupPending(false);
          },
          onError: (err) => {
            console.error("Wallet payment failed:", err);
            toast.error(err?.message || "Payment failed. Please try again.");
            setIsWalletTopupPending(false);
          },
        }
      );
      return true;
    } catch (err) {
      console.error("createPiPayment startup failed:", err);
      toast.error(err?.message || "Payment initialization failed. Please try again.");
      setIsWalletTopupPending(false);
      return false;
    }
  };

  const purchasePowerUpWithWallet = async ({ name, price, quantity }) => {
    if (isStorePurchasePending) {
      return false;
    }
    if (authStatus !== "success" || !user) {
      toast.error("Please sign in before buying a power-up.");
      return false;
    }

    setIsStorePurchasePending(true);
    try {
      const response = await postJson(`${PI_API_BASE}/purchasePowerup`, {
        userId: user.username,
        powerupType: name,
        price: Number(price) * Number(quantity),
        quantity: Number(quantity),
        requestId: createRequestId("powerup"),
      });

      toast.success(
        `${quantity} ${name} added. Wallet balance is now ${response.balance} Pi.`
      );
      setIsStorePurchasePending(false);
      return true;
    } catch (err) {
      console.error("purchasePowerUpWithWallet failed:", err);
      toast.error(err?.message || "Unable to purchase power-up.");
      setIsStorePurchasePending(false);
      return false;
    }
  };

  return (
    <PiWalletContext.Provider
      value={{
        piBalance,
        handleTestnetPayment,
        purchasePowerUpWithWallet,
        testnetLinked,
        setTestnetLinked,
        isWalletTopupPending,
        isStorePurchasePending,
      }}
    >
      {children}
    </PiWalletContext.Provider>
  );
};

export const usePiWallet = () => useContext(PiWalletContext);
