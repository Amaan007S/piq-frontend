import React from "react";
import { usePiAuth } from "../contexts/PiAuthContext";

const Profile = () => {
  const { user, loading, error } = usePiAuth();

  if (loading) return <p className="text-white">Loading...</p>;
  if (error) return <p className="text-red-500">Error: {error.message}</p>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 text-white animate-fade-in">
      <h2 className="text-3xl font-bold text-yellow-400 text-center mb-8">
        👤 Your Profile
      </h2>

      <div className="bg-[#1A1A1A] rounded-2xl shadow-lg p-6 flex flex-col md:flex-row items-center gap-6">
        <img
          src={`https://api.dicebear.com/7.x/identicon/svg?seed=${user.username}`}
          alt="User Avatar"
          className="w-32 h-32 rounded-full border-4 border-yellow-400"
        />

        <div className="flex-1 text-center md:text-left">
          <h3 className="text-2xl font-bold mb-2">{user.username}</h3>
          <div className="flex flex-wrap justify-center md:justify-start gap-4 text-sm">
            <div className="bg-gray-800 px-4 py-2 rounded-xl">
              🏅 Rank: <span className="font-semibold">#4</span>
            </div>
            <div className="bg-gray-800 px-4 py-2 rounded-xl">
              ⚡ Streak: <span className="font-semibold">7 days</span>
            </div>
            <div className="bg-gray-800 px-4 py-2 rounded-xl">
              🎯 Score: <span className="font-semibold">120</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
