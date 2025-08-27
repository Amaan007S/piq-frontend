import { useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { usePiAuth } from "../contexts/PiAuthContext";
import { useStreak } from "../contexts/StreakContext";
import { usePowerUp } from "../contexts/PowerUpContext";
import { usePiWallet } from "../contexts/PiWalletContext";
import { db } from "../firebase";

const useUserDataSync = () => {
  const { user } = usePiAuth();
  const { streak, maxStreak } = useStreak();
  const { ownedPowerUps } = usePowerUp();
  const { piBalance } = usePiWallet();

  useEffect(() => {
    if (!user?.username) return;

    const updateUserData = async () => {
      const userRef = doc(db, "users", user.username);

      try {
        await updateDoc(userRef, {
          "gameStats.streak": streak,
          "gameStats.maxStreak": maxStreak,
          "wallet.piBalance": piBalance,
          powerUps: ownedPowerUps,
        });
        // console.log("User data synced.");
      } catch (error) {
        console.error("Error syncing user data:", error);
      }
    };

    updateUserData();
  }, [user?.username, streak, maxStreak, piBalance, ownedPowerUps]);
};

export default useUserDataSync;
