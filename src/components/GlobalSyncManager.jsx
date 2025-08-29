import React from "react";
import useUserDataSync from "../utils/useUserDataSync";

const GlobalSyncManager = () => {
  useUserDataSync();
  return null;
};

export default GlobalSyncManager;
