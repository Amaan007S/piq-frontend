import React, { useEffect, useState } from "react";
import { usePiAuth } from "../contexts/PiAuthContext";
import { db } from "../firebase";
import { doc, onSnapshot } from "firebase/firestore";

const Profile = () => {
  const { user, authStatus, error } = usePiAuth();
  const [profileData, setProfileData] = useState(null);

  useEffect(() => {
    if (authStatus !== "success" || !user) return;

    const userRef = doc(db, "users", user.username);
    const unsub = onSnapshot(
      userRef,
      (snap) => {
        if (snap.exists()) {
          setProfileData(snap.data());
        }
      },
      (err) => console.error("Profile snapshot error:", err)
    );

    return () => unsub();
  }, [authStatus, user]);

  if (!profileData) {
    return <p className="text-white">Loading...</p>;
  }

  const { profile, gameStats } = profileData;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 text-white animate-fade-in">
      <h2 className="text-3xl font-bold text-yellow-400 text-center mb-8">
        👤 Your Profile
      </h2>

      <div className="bg-[#1A1A1A] rounded-2xl shadow-lg p-6 flex flex-col md:flex-row items-center gap-6">
        <img
          src={profile?.avatarUrl}
          alt="User Avatar"
          className="w-32 h-32 rounded-full border-4 border-yellow-400"
        />

        <div className="flex-1 text-center md:text-left">
          <h3 className="text-2xl font-bold mb-2">{user.username}</h3>
          <div className="flex flex-wrap justify-center md:justify-start gap-4 text-sm">
            <div className="bg-gray-800 px-4 py-2 rounded-xl">
              🏅 Rank: <span className="font-semibold">{profile?.rank || "Rookie"}</span>
            </div>
            <div className="bg-gray-800 px-4 py-2 rounded-xl">
              ⚡ Current Streak: <span className="font-semibold">{gameStats?.streak ?? 0}</span>
            </div>
            <div className="bg-gray-800 px-4 py-2 rounded-xl">
              🔥 Highest Streak: <span className="font-semibold">{gameStats?.maxStreak ?? 0}</span>
            </div>
            <div className="bg-gray-800 px-4 py-2 rounded-xl">
              🎯 Lifetime Score: <span className="font-semibold">{gameStats?.score ?? 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
