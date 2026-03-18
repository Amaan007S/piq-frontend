const parseBoolean = (value, fallback) => {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
};

export const PI_SDK_VERSION = process.env.REACT_APP_PI_SDK_VERSION || "2.0";
export const PI_SANDBOX = parseBoolean(process.env.REACT_APP_PI_SANDBOX, true);
export const PI_API_BASE =
  process.env.REACT_APP_PI_API_BASE || "https://api-6wgc6bpdaq-uc.a.run.app";

export function getPiInitConfig() {
  return {
    version: PI_SDK_VERSION,
    sandbox: true,
  };
}
