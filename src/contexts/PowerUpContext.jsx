import React, { createContext, useContext, useState, useEffect } from "react";

// Create the context
const PowerUpContext = createContext();

const defaultPowerUps = {
  "Extra Time": 0,
  "Skip Question": 0,
  "Second Chance": 0,
};

export const PowerUpProvider = ({ children }) => {
  const [ownedPowerUps, setOwnedPowerUps] = useState(() => {
    const saved = localStorage.getItem("ownedPowerUps");
    return saved ? JSON.parse(saved) : defaultPowerUps;
  });

  useEffect(() => {
    localStorage.setItem("ownedPowerUps", JSON.stringify(ownedPowerUps));
  }, [ownedPowerUps]);

  const triggerPowerUp = (powerUpName) => {
    if (ownedPowerUps[powerUpName] > 0) {
      setOwnedPowerUps((prev) => ({
        ...prev,
        [powerUpName]: prev[powerUpName] - 1,
      }));
    }
  };

  const buyPowerUp = (powerUpName) => {
    setOwnedPowerUps((prev) => ({
      ...prev,
      [powerUpName]: (prev[powerUpName] || 0) + 1,
    }));
  };

  // ⚡ Developer tool: Reset owned power-ups
  const resetPowerUps = () => {
    setOwnedPowerUps(defaultPowerUps);
    localStorage.setItem("ownedPowerUps", JSON.stringify(defaultPowerUps));
  };

  return (
    <PowerUpContext.Provider value={{ ownedPowerUps, triggerPowerUp, buyPowerUp, resetPowerUps }}>
      {children}
    </PowerUpContext.Provider>
  );
};

// Custom hook to use the PowerUpContext
export const usePowerUp = () => {
  const context = useContext(PowerUpContext);
  if (!context) {
    throw new Error("usePowerUp must be used within a PowerUpProvider");
  }
  return context;
};
