import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Quiz from "./pages/Quiz";
import Leaderboard from "./pages/Leaderboard";
import Store from "./pages/Store";
import MyWallet from "./pages/MyWallet";
import Profile from "./pages/Profile";
import leaderboardData from "./data/mockData";

import { PowerUpProvider } from "./contexts/PowerUpContext";
import { StreakProvider } from "./contexts/StreakContext";
import { PiWalletProvider } from "./contexts/PiWalletContext";
import { TransactionHistoryProvider } from "./contexts/TransactionHistoryContext";
import { PiAuthProvider } from "./contexts/PiAuthContext";

import { Toaster } from "sonner";
import React from "react";

import GlobalSyncManager from "./components/GlobalSyncManager"; // ✅ new import

function App() {
  return (
    <TransactionHistoryProvider>
      <PiWalletProvider>
        <StreakProvider>
          <PowerUpProvider>
            <PiAuthProvider>
              <Router>
                {/* ✅ Sync manager is inside all providers */}
                <GlobalSyncManager />

                <Layout>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/quiz" element={<Quiz />} />
                    <Route index element={<Home />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route
                      path="/leaderboard"
                      element={<Leaderboard leaderboardData={leaderboardData} />}
                    />
                    <Route path="/store" element={<Store />} />
                    <Route path="/wallet" element={<MyWallet />} />
                  </Routes>
                </Layout>

                <Toaster
                  position="top-center"
                  theme="dark"
                  expand={true}
                  richColors
                  closeButton
                  toastOptions={{
                    style: {
                      background: "#1F1F1F",
                      color: "#fff",
                      border: "1px solid #333",
                      borderRadius: "12px",
                      padding: "16px",
                      fontSize: "16px",
                    },
                    className: "shadow-lg",
                  }}
                />
              </Router>
            </PiAuthProvider>
          </PowerUpProvider>
        </StreakProvider>
      </PiWalletProvider>
    </TransactionHistoryProvider>
  );
}

export default App;
