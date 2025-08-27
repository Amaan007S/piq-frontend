import React, { createContext, useContext, useState } from "react";

const StreakContext = createContext();

export const StreakProvider = ({ children }) => {
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);

  const resetStreak = () => setStreak(0);

  return (
    <StreakContext.Provider value={{ streak, setStreak, resetStreak, maxStreak, setMaxStreak }}>
      {children}
    </StreakContext.Provider>
  );
};

export const useStreak = () => useContext(StreakContext);
