import { useEffect, useRef } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { usePiAuth } from "../contexts/PiAuthContext";
import { useStreak } from "../contexts/StreakContext";
import { usePowerUp } from "../contexts/PowerUpContext";
import { usePiWallet } from "../contexts/PiWalletContext";

const useUserDataSync = () => {
  const { user, authStatus } = usePiAuth();
  const { streak, maxStreak, score } = useStreak?.() || {};
  const { ownedPowerUps } = usePowerUp?.() || {};
  const { piBalance, testnetLinked } = usePiWallet?.() || {};

  // prevent redundant writes
  const lastPushedRef = useRef(null);

  useEffect(() => {
    // only after auth
    if (authStatus !== "success" || !user) return;

    const payload = {
      gameStats: {
        // guard undefined -> keep current numeric shape
        streak: typeof streak === "number" ? streak : 0,
        maxStreak: typeof maxStreak === "number" ? maxStreak : 0,
        score: typeof score === "number" ? score : 0,
      },
      powerUps: ownedPowerUps || {},
      wallet: {
        piBalance: typeof piBalance === "number" ? piBalance : 0,
        testnetLinked: typeof testnetLinked === "boolean" ? testnetLinked : true,
      },
    };

    const payloadStr = JSON.stringify(payload);
    if (payloadStr === lastPushedRef.current) return; // nothing new

    const push = async () => {
      try {
        const userRef = doc(db, "users", user.username);
        // debug: see writes in console
        console.log("[useUserDataSync] updateDoc →", payload);
        await updateDoc(userRef, payload);
        lastPushedRef.current = payloadStr;
      } catch (err) {
        console.error("🔥 Firestore sync error:", err);
      }
    };

    push();
  }, [
    user,
    authStatus,
    streak,
    maxStreak,
    score,
    ownedPowerUps,
    piBalance,
    testnetLinked,
  ]);
};

export default useUserDataSync;
