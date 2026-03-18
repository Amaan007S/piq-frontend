import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { db } from "../firebase";
import {
  doc,
  onSnapshot,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp,
  increment,
  orderBy,
  query,
} from "firebase/firestore";
import { usePiAuth } from "./PiAuthContext";
import createPiPayment from "../utils/createPiPayment";
import { PI_SANDBOX } from "../config/piPlatform";

const PiWalletContext = createContext();

export const PiWalletProvider = ({ children }) => {
  const { user, authStatus, hasPayments, rawAuth } = usePiAuth();

  const [piBalance, setPiBalance] = useState(0);
  const [testnetLinked, setTestnetLinked] = useState(true);
  const [walletReady, setWalletReady] = useState(false);

  useEffect(() => {
    if (authStatus !== "success" || !user) return;

    const userRef = doc(db, "users", user.username);
    const txQuery = query(
      collection(db, "users", user.username, "transactions"),
      orderBy("timestamp", "desc")
    );

    const unsubUser = onSnapshot(
      userRef,
      (snap) => {
        const cloudWallet = snap.data()?.wallet;
        setTestnetLinked(Boolean(cloudWallet?.testnetLinked ?? true));
      },
      (err) => console.error("Wallet profile onSnapshot error:", err)
    );

    const unsubTransactions = onSnapshot(
      txQuery,
      (snap) => {
        let nextBalance = 0;
        snap.forEach((transactionDoc) => {
          const tx = transactionDoc.data() || {};
          if (tx.status !== "completed") return;
          nextBalance += Number(tx.amount || 0);
        });
        setPiBalance(nextBalance);
        setWalletReady(true);
      },
      (err) => console.error("Wallet transactions onSnapshot error:", err)
    );

    return () => {
      unsubUser();
      unsubTransactions();
    };
  }, [authStatus, user]);

  const lastPushedRef = useRef(null);
  useEffect(() => {
    const push = async () => {
      if (authStatus !== "success" || !user || !walletReady) return;
      const payload = JSON.stringify({ piBalance, testnetLinked });
      if (payload === lastPushedRef.current) return;
      try {
        const userRef = doc(db, "users", user.username);
        await updateDoc(userRef, { wallet: { piBalance, testnetLinked } });
        lastPushedRef.current = payload;
      } catch (err) {
        console.error("Wallet updateDoc error:", err);
      }
    };
    push();
  }, [piBalance, testnetLinked, authStatus, user, walletReady]);

  const handleTestnetPayment = async ({ amount = 1, memo = "Top-up PiQ Wallet" } = {}) => {
    if (!window?.Pi) {
      console.error("Pi SDK not found.");
      toast.error("Pi Browser SDK not detected.");
      return false;
    }
    if (authStatus !== "success" || !user) {
      console.error("User not authenticated yet.");
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

    const txCollectionRef = collection(db, "users", user.username, "transactions");
    let pendingDocRef = null;

    try {
      const pendingDoc = await addDoc(txCollectionRef, {
        id: null,
        paymentId: null,
        type: "deposit",
        detail: `Top-up ${amount} Pi`,
        amount: Number(amount),
        status: "pending",
        timestamp: serverTimestamp(),
      });
      pendingDocRef = { id: pendingDoc.id };
      await updateDoc(pendingDoc, { id: pendingDoc.id });

      const paymentObj = await createPiPayment(
        {
          amount: Number(amount).toString(),
          memo,
          metadata: { app: "PiQ", reason: "wallet_topup", sandbox: PI_SANDBOX },
        },
        {
          onReadyForServerApproval: async (paymentId) => {
            const txRef = doc(db, "users", user.username, "transactions", pendingDocRef.id);
            await updateDoc(txRef, {
              paymentId: paymentId || null,
              timestamp: serverTimestamp(),
            });
          },
          onReadyForServerCompletion: async (paymentId, txid) => {
            try {
              const txRef = doc(db, "users", user.username, "transactions", pendingDocRef.id);
              await updateDoc(txRef, {
                paymentId: paymentId || null,
                txid: txid || null,
                status: "completed",
                timestamp: serverTimestamp(),
              });
              toast.success(`Received ${amount} Pi into your net app flow.`);
            } catch (err) {
              console.error("Error handling onReadyForServerCompletion:", err);
              toast.error("Payment completed server-side but failed to update locally.");
            }
          },
          onCancel: async () => {
            try {
              const txRef = doc(db, "users", user.username, "transactions", pendingDocRef.id);
              await updateDoc(txRef, {
                status: "failed",
                detail: "User cancelled payment",
                timestamp: serverTimestamp(),
              });
            } catch (err) {
              console.error("Failed to mark pending tx as failed:", err);
            }
            toast.error("Payment cancelled.");
          },
          onError: async (err) => {
            console.error("Payment flow error:", err);
            try {
              const txRef = doc(db, "users", user.username, "transactions", pendingDocRef.id);
              await updateDoc(txRef, {
                status: "failed",
                detail: `Payment error: ${err?.message || "unknown"}`,
                timestamp: serverTimestamp(),
              });
            } catch (updateErr) {
              console.error("Failed to update pending tx on error:", updateErr);
            }
            toast.error(err?.message || "Payment failed. Please try again.");
          },
        }
      );

      const paymentId = paymentObj?.identifier || paymentObj?.id || null;
      if (paymentId) {
        const txRef = doc(db, "users", user.username, "transactions", pendingDocRef.id);
        await updateDoc(txRef, { paymentId, timestamp: serverTimestamp() });
      }
      return true;
    } catch (err) {
      console.error("createPiPayment startup failed:", err);
      if (pendingDocRef?.id) {
        const txRef = doc(db, "users", user.username, "transactions", pendingDocRef.id);
        try {
          await updateDoc(txRef, {
            status: "failed",
            detail: `Payment initialization failed: ${err?.message || "unknown"}`,
            timestamp: serverTimestamp(),
          });
        } catch (updateErr) {
          console.error("Failed to mark deposit as failed:", updateErr);
        }
      }
      toast.error(err?.message || "Payment initialization failed. Please try again.");
      return false;
    }
  };

  const purchasePowerUpWithPi = async ({ name, price, quantity }) => {
    if (!window?.Pi) {
      toast.error("Pi Browser SDK not detected.");
      return false;
    }
    if (authStatus !== "success" || !user) {
      toast.error("Please sign in before buying a power-up.");
      return false;
    }
    if (!hasPayments) {
      toast.error(
        "Payments permission required. Please sign out and sign back in to grant it."
      );
      return false;
    }

    const totalCost = Number(price) * Number(quantity);
    const txCollectionRef = collection(db, "users", user.username, "transactions");
    let pendingDocRef = null;

    try {
      pendingDocRef = await addDoc(txCollectionRef, {
        type: "purchase",
        productType: "power_up",
        productName: name,
        quantity,
        detail: `${name} x${quantity}`,
        amount: -totalCost,
        status: "pending",
        timestamp: serverTimestamp(),
      });

      const paymentObj = await createPiPayment(
        {
          amount: totalCost.toString(),
          memo: `Buy ${quantity} ${name}`,
          metadata: {
            app: "PiQ",
            reason: "power_up_purchase",
            itemName: name,
            quantity,
            sandbox: PI_SANDBOX,
          },
        },
        {
          onReadyForServerApproval: async (paymentId) => {
            const txRef = doc(db, "users", user.username, "transactions", pendingDocRef.id);
            await updateDoc(txRef, {
              id: pendingDocRef.id,
              paymentId: paymentId || null,
              timestamp: serverTimestamp(),
            });
          },
          onReadyForServerCompletion: async (paymentId, txid) => {
            const txRef = doc(db, "users", user.username, "transactions", pendingDocRef.id);
            const userRef = doc(db, "users", user.username);
            await updateDoc(txRef, {
              id: pendingDocRef.id,
              paymentId: paymentId || null,
              txid: txid || null,
              status: "completed",
              timestamp: serverTimestamp(),
            });
            await updateDoc(userRef, {
              [`powerUps.${name}`]: increment(quantity),
            });
            toast.success(`${quantity} ${name} added after Pi payment completion.`);
          },
          onCancel: async () => {
            const txRef = doc(db, "users", user.username, "transactions", pendingDocRef.id);
            await updateDoc(txRef, {
              status: "failed",
              detail: `Cancelled purchase for ${name}`,
              timestamp: serverTimestamp(),
            });
            toast.error("Purchase cancelled.");
          },
          onError: async (err) => {
            const txRef = doc(db, "users", user.username, "transactions", pendingDocRef.id);
            await updateDoc(txRef, {
              status: "failed",
              detail: `Payment error: ${err?.message || "unknown"}`,
              timestamp: serverTimestamp(),
            });
            toast.error(err?.message || "Purchase payment failed.");
          },
        }
      );

      const paymentId = paymentObj?.identifier || paymentObj?.id || null;
      if (paymentId) {
        const txRef = doc(db, "users", user.username, "transactions", pendingDocRef.id);
        await updateDoc(txRef, { paymentId, timestamp: serverTimestamp() });
      }
      return true;
    } catch (err) {
      console.error("purchasePowerUpWithPi failed:", err);
      if (pendingDocRef?.id) {
        const txRef = doc(db, "users", user.username, "transactions", pendingDocRef.id);
        try {
          await updateDoc(txRef, {
            status: "failed",
            detail: `Payment initialization failed: ${err?.message || "unknown"}`,
            timestamp: serverTimestamp(),
          });
        } catch (updateErr) {
          console.error("Failed to mark purchase as failed:", updateErr);
        }
      }
      toast.error("Payment initialization failed. Please try again.");
      return false;
    }
  };

  return (
    <PiWalletContext.Provider
      value={{
        piBalance,
        handleTestnetPayment,
        purchasePowerUpWithPi,
        testnetLinked,
        setTestnetLinked,
      }}
    >
      {children}
    </PiWalletContext.Provider>
  );
};

export const usePiWallet = () => useContext(PiWalletContext);
