// src/utils/useUserDataSync.js
import { useEffect, useRef } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { usePiAuth } from "../contexts/PiAuthContext";
import { useStreak } from "../contexts/StreakContext";
import { usePowerUp } from "../contexts/PowerUpContext";
import { usePiWallet } from "../contexts/PiWalletContext";

const useUserDataSync = () => {
  const { user, authStatus } = usePiAuth();
  const { streak, maxStreak, score, loaded } = useStreak(); // ✅ include score here
  const { ownedPowerUps } = usePowerUp();
  const { piBalance, testnetLinked } = usePiWallet();

  const lastPushedRef = useRef(null);

  useEffect(() => {
    if (authStatus !== "success" || !user || !loaded) return;

    // If any are still null, don't push yet
    if (streak === null || maxStreak === null || score === null) return;

    const payload = {
      gameStats: {
        streak,
        maxStreak,
        score, // ✅ handled same as streak
      },
      powerUps: ownedPowerUps || {},
      wallet: {
        piBalance: typeof piBalance === "number" ? piBalance : 0,
        testnetLinked: typeof testnetLinked === "boolean" ? testnetLinked : true,
      },
    };

    const payloadStr = JSON.stringify(payload);
    if (payloadStr === lastPushedRef.current) return;

    const push = async () => {
      try {
        const userRef = doc(db, "users", user.username);
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
    loaded,
    streak,
    maxStreak,
    score, // ✅ included
    ownedPowerUps,
    piBalance,
    testnetLinked,
  ]);
};

export default useUserDataSync;
