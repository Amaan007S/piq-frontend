const {SecretManagerServiceClient} = require("@google-cloud/secret-manager");

const smClient = new SecretManagerServiceClient();
const PROJECT_ID = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT || null;
const SECRET_NAME = process.env.PI_SECRET_NAME || "PI_API_KEY";
const PI_API_BASE = (process.env.PI_API_BASE || "https://api.minepi.com/v2")
  .replace(/\/$/, "");

let cachedApiKey = null;

function maskKey(key) {
  if (!key) return null;
  if (key.length <= 8) return "[present]";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

async function getPiApiKey() {
  if (cachedApiKey) return cachedApiKey;

  if (PROJECT_ID) {
    const name = `projects/${PROJECT_ID}/secrets/${SECRET_NAME}/versions/latest`;
    try {
      const [resp] = await smClient.accessSecretVersion({name});
      const payload = resp?.payload?.data?.toString("utf8")?.trim();
      if (payload) {
        cachedApiKey = payload;
        console.log("[piClient] Loaded PI API key from Secret Manager:", {
          secretName: SECRET_NAME,
          keyPresent: true,
          keyPreview: maskKey(cachedApiKey),
        });
        return cachedApiKey;
      }
    } catch (err) {
      console.warn("[piClient] Secret Manager read failed:", err?.message || err);
    }
  }

  const envKey = process.env.PI_API_KEY || process.env.PI_PRIVATE_KEY || "";
  if (envKey.trim()) {
    cachedApiKey = envKey.trim();
    console.log("[piClient] Loaded PI API key from environment:", {
      keyPresent: true,
      keyPreview: maskKey(cachedApiKey),
      source: process.env.PI_API_KEY ? "PI_API_KEY" : "PI_PRIVATE_KEY",
    });
    return cachedApiKey;
  }

  console.error("[piClient] PI API key missing", {
    secretName: SECRET_NAME,
    hasPiApiKeyEnv: Boolean(process.env.PI_API_KEY),
    hasPiPrivateKeyEnv: Boolean(process.env.PI_PRIVATE_KEY),
    projectIdPresent: Boolean(PROJECT_ID),
  });
  throw new Error("PI API key not found in Secret Manager or environment");
}

async function callPiApi(path, {method, body, apiKey, timeoutMs = 10000}) {
  const key = (apiKey || (await getPiApiKey())).trim();
  const url = `${PI_API_BASE}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    console.log("[piClient] Request ->", {
      method,
      url,
      keyPresent: Boolean(key),
      keyPreview: maskKey(key),
      body: body === undefined ? null : body,
    });

    const requestOptions = {
      method,
      headers: {
        "Authorization": `Key ${key}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    };

    if (body !== undefined) {
      requestOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, requestOptions);
    const rawText = await response.text();
    let parsedBody = null;
    try {
      parsedBody = rawText ? JSON.parse(rawText) : null;
    } catch (parseErr) {
      parsedBody = null;
    }

    console.log("[piClient] Response <-", {
      method,
      url,
      status: response.status,
      ok: response.ok,
      rawBody: rawText,
      body: parsedBody,
    });

    if (!response.ok) {
      const err = new Error(`Pi API ${method} ${path} failed with status ${response.status}`);
      err.status = response.status;
      err.debug = {
        url,
        method,
        rawBody: rawText,
        responseBody: parsedBody !== null ? parsedBody : rawText,
      };
      throw err;
    }

    return parsedBody !== null ? parsedBody : {raw: rawText};
  } finally {
    clearTimeout(timeout);
  }
}

async function approvePayment(paymentId, opts = {}) {
  if (!paymentId) {
    throw new Error("approvePayment: paymentId required");
  }

  return callPiApi(`/payments/${encodeURIComponent(paymentId)}/approve`, {
    method: "POST",
    body: {},
    apiKey: opts.apiKey,
  });
}

async function completePayment(paymentId, txid, opts = {}) {
  if (!paymentId || !txid) {
    throw new Error("completePayment: paymentId and txid required");
  }

  return callPiApi(`/payments/${encodeURIComponent(paymentId)}/complete`, {
    method: "POST",
    body: {txid},
    apiKey: opts.apiKey,
  });
}

async function reconcilePayment(paymentId, opts = {}) {
  if (!paymentId) {
    throw new Error("reconcilePayment: paymentId required");
  }

  return callPiApi(`/payments/${encodeURIComponent(paymentId)}`, {
    method: "GET",
    apiKey: opts.apiKey,
  });
}

module.exports = {
  approvePayment,
  completePayment,
  reconcilePayment,
  getPiApiKey,
};
