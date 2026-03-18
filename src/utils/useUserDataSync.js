import { useEffect, useRef } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { usePiAuth } from "../contexts/PiAuthContext";
import { useStreak } from "../contexts/StreakContext";
import { usePowerUp } from "../contexts/PowerUpContext";

const useUserDataSync = () => {
  const { user, authStatus } = usePiAuth();
  const { streak, maxStreak, score, loaded } = useStreak();
  const { ownedPowerUps } = usePowerUp();

  const lastPushedRef = useRef(null);

  useEffect(() => {
    if (authStatus !== "success" || !user || !loaded) return;
    if (streak === null || maxStreak === null || score === null) return;

    const payload = {
      gameStats: {
        streak,
        maxStreak,
        score,
      },
      powerUps: ownedPowerUps || {},
    };

    const payloadStr = JSON.stringify(payload);
    if (payloadStr === lastPushedRef.current) return;

    const push = async () => {
      try {
        const userRef = doc(db, "users", user.username);
        console.log("[useUserDataSync] updateDoc ->", payload);
        await updateDoc(userRef, payload);
        lastPushedRef.current = payloadStr;
      } catch (err) {
        console.error("Firestore sync error:", err);
      }
    };

    push();
  }, [user, authStatus, loaded, streak, maxStreak, score, ownedPowerUps]);
};

export default useUserDataSync;
