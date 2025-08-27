import { useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { usePiAuth } from "../contexts/PiAuthContext";
import { useStreak } from "../contexts/StreakContext";
import { usePowerUp } from "../contexts/PowerUpContext";
import { usePiWallet } from "../contexts/PiWalletContext";

const useUserDataSync = () => {
  const { user } = usePiAuth();
  const { streak, maxStreak, score } = useStreak();
  const { ownedPowerUps } = usePowerUp();
  const { piBalance } = usePiWallet();

  useEffect(() => {
    if (!user) return;

    const userRef = doc(db, "users", user.username);

    const syncData = async () => {
      try {
        await updateDoc(userRef, {
          gameStats: {
            streak,
            maxStreak,
            score,
          },
          powerUps: ownedPowerUps,
          wallet: {
            piBalance,
            testnetLinked: true, // You can update this dynamically later
          },
        });
      } catch (err) {
        console.error("🔥 Firestore sync error:", err);
      }
    };

    syncData();
  }, [user, streak, maxStreak, score, ownedPowerUps, piBalance]);
};

export default useUserDataSync;