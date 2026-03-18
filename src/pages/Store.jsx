import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePowerUp } from "../contexts/PowerUpContext";
import { usePiWallet } from "../contexts/PiWalletContext";
import { toast } from "sonner";
import { AiOutlineCheckCircle } from "react-icons/ai";
import { powerUpsConfig } from "../config/powerUpsConfig";

const Store = () => {
  const navigate = useNavigate();
  const { ownedPowerUps } = usePowerUp();
  const { piBalance, purchasePowerUpWithPi } = usePiWallet();

  const [purchaseQuantities, setPurchaseQuantities] = useState(
    powerUpsConfig.reduce((acc, { name }) => {
      acc[name] = 1;
      return acc;
    }, {})
  );

  const handleIncreaseQuantity = (powerUpName) => {
    setPurchaseQuantities((prev) => ({
      ...prev,
      [powerUpName]: prev[powerUpName] + 1,
    }));
  };

  const handleDecreaseQuantity = (powerUpName) => {
    setPurchaseQuantities((prev) => ({
      ...prev,
      [powerUpName]: Math.max(1, prev[powerUpName] - 1),
    }));
  };

  const handleBuyPowerUp = async (powerUpName, price) => {
    const quantity = purchaseQuantities[powerUpName];
    const totalCost = price * quantity;

    const ok = await purchasePowerUpWithPi({
      name: powerUpName,
      price,
      quantity,
    });
    if (!ok) return;

    toast(
      <div className="flex items-center gap-3">
        <AiOutlineCheckCircle className="text-green-400 text-3xl animate-pulse" />
        <div>
          <p className="font-semibold text-white">Payment Started</p>
          <p className="text-gray-400 text-sm">
            Finish the Pi approval to buy {quantity} {powerUpName}(s) for {totalCost} Pi.
          </p>
        </div>
      </div>,
      {
        duration: 2500,
        position: "top-center",
        style: {
          background: "#1F1F1F",
          border: "1px solid #333",
          color: "white",
          padding: "16px",
          borderRadius: "12px",
        },
      }
    );
  };

  return (
    <div className="flex flex-col items-center p-6 sm:p-8 text-white">
      <div className="w-full max-w-3xl flex justify-between items-center mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-yellow-400">Store</h1>
        <button
          onClick={() => navigate("/wallet")}
          className="text-sm sm:text-base font-semibold text-yellow-300 bg-[#2A2A2A] px-4 py-2 rounded-xl hover:bg-yellow-400 hover:text-black transition"
        >
          My Wallet
        </button>
      </div>

      <div className="mb-6 w-full max-w-3xl">
        <h2 className="text-lg font-semibold text-white">
          Net Pi flow: <span className="text-yellow-400">{piBalance} Pi</span>
        </h2>
      </div>

      <div className="grid gap-6 w-full max-w-3xl">
        {powerUpsConfig.map(({ name, icon, description, price }) => (
          <div
            key={name}
            className="bg-[#1F1F1F] p-6 rounded-2xl shadow-lg hover:shadow-yellow-400/10 transition"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-start gap-4">
                <div className="text-yellow-400">{icon}</div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold">{name}</h2>
                  <p className="text-gray-400 text-sm">{description}</p>
                  <p className="text-sm text-gray-500 mt-1">Owned: {ownedPowerUps[name] || 0}</p>
                </div>
              </div>

              <div className="w-full sm:w-auto flex flex-col sm:flex-row items-end sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <button
                    onClick={() => handleDecreaseQuantity(name)}
                    className="bg-gray-600 hover:bg-gray-500 text-white text-xl w-9 h-9 rounded-full flex items-center justify-center"
                  >
                    -
                  </button>
                  <span className="text-lg font-semibold">{purchaseQuantities[name]}</span>
                  <button
                    onClick={() => handleIncreaseQuantity(name)}
                    className="bg-gray-600 hover:bg-gray-500 text-white text-xl w-9 h-9 rounded-full flex items-center justify-center"
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={() => handleBuyPowerUp(name, price)}
                  className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold px-5 py-2 rounded-xl transition w-full sm:w-auto"
                >
                  Buy with {price} Pi
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => navigate("/quiz")}
        className="mt-10 bg-blue-500 hover:bg-blue-400 text-white px-8 py-4 rounded-2xl text-lg transition"
      >
        Back to Quiz
      </button>
    </div>
  );
};

export default Store;

