// src/components/GlobalSyncManager.jsx
import React from "react";
import useUserDataSync from "../utils/useUserDataSync";

const GlobalSyncManager = () => {
  useUserDataSync(); // ✅ safe now because providers are already mounted
  return null; // doesn't render anything
};

export default GlobalSyncManager;
