import { getPiInitConfig } from "../config/piPlatform";

let cachedInitKey = null;

export default async function ensurePiInit(overrides = {}) {
  if (!window?.Pi || typeof window.Pi.init !== "function") {
    throw new Error("Pi SDK not found on window (window.Pi missing).");
  }

  const baseConfig = { ...getPiInitConfig(), ...overrides };
  const initKey = JSON.stringify(baseConfig);
  if (window.__PI_INIT_DONE && cachedInitKey === initKey) {
    return { ...baseConfig };
  }

  const candidates = [
    baseConfig.version,
    "2.0",
    "1.0",
    "1",
    "v2",
    undefined,
  ].filter((value, index, arr) => arr.indexOf(value) === index);

  for (const version of candidates) {
    try {
      const cfg = version
        ? { ...baseConfig, version }
        : { sandbox: baseConfig.sandbox };
      window.Pi.init(cfg);
      window.__PI_INIT_DONE = true;
      window.__PI_INIT_VERSION = version ?? null;
      cachedInitKey = JSON.stringify({
        version: version ?? null,
        sandbox: baseConfig.sandbox,
      });
      console.log(
        `Pi.init succeeded with version: ${String(version)}, sandbox: ${baseConfig.sandbox}`
      );
      return { version: version ?? null, sandbox: baseConfig.sandbox };
    } catch (err) {
      console.warn(`Pi.init rejected version=${String(version)}:`, err?.message || err);
    }
  }

  throw new Error(
    "Pi.init failed for all attempted version candidates. Check that the Pi SDK script you loaded matches these init options."
  );
}
