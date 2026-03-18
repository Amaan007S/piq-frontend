const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const {SecretManagerServiceClient} = require("@google-cloud/secret-manager");
const piClient = require("./piClient");

admin.initializeApp();

const smClient = new SecretManagerServiceClient();
const PROJECT_ID = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
const cachedSecrets = {};

async function getSecretValue(secretName) {
  if (cachedSecrets[secretName]) return cachedSecrets[secretName];

  if (PROJECT_ID) {
    try {
      const name = `projects/${PROJECT_ID}/secrets/${secretName}/versions/latest`;
      const [accessResponse] = await smClient.accessSecretVersion({name});
      const payload = accessResponse?.payload?.data?.toString("utf8")?.trim();
      if (payload) {
        cachedSecrets[secretName] = payload;
        return payload;
      }
    } catch (err) {
      console.warn("[functions] Secret Manager read failed:", {
        secretName,
        message: err?.message || err,
      });
    }
  }

  const envValue = process.env[secretName];
  if (typeof envValue === "string" && envValue.trim()) {
    cachedSecrets[secretName] = envValue.trim();
    return cachedSecrets[secretName];
  }

  return null;
}

function keyPreview(value) {
  if (!value) return null;
  if (value.length <= 8) return "[present]";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

async function loadPiApiKey() {
  const secretName = process.env.PI_SECRET_NAME || "PI_API_KEY";
  const key =
    (await getSecretValue(secretName)) ||
    (await getSecretValue("PI_API_KEY")) ||
    (await getSecretValue("PI_PRIVATE_KEY"));

  console.log("[functions] PI API key lookup:", {
    secretName,
    keyPresent: Boolean(key),
    keyPreview: keyPreview(key),
    projectIdPresent: Boolean(PROJECT_ID),
  });

  if (!key) {
    throw new Error("PI API key is missing");
  }

  return key;
}

async function callPiApprove(paymentId) {
  const apiKey = await loadPiApiKey();
  return piClient.approvePayment(paymentId, {apiKey});
}

async function callPiComplete(paymentId, txid) {
  const apiKey = await loadPiApiKey();
  return piClient.completePayment(paymentId, txid, {apiKey});
}

exports.approvePayment = functions.https.onCall(async (data) => {
  const paymentId = data?.paymentId;
  if (!paymentId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing paymentId");
  }

  try {
    await callPiApprove(paymentId);
    return {ok: true};
  } catch (err) {
    console.error("[callable] approvePayment failed:", {
      paymentId,
      message: err?.message || err,
      status: err?.status || null,
      debug: err?.debug || null,
    });
    throw new functions.https.HttpsError("internal", "approvePayment failed", {
      message: err?.message || "unknown error",
      status: err?.status || null,
      debug: err?.debug || null,
    });
  }
});

exports.completePayment = functions.https.onCall(async (data) => {
  const paymentId = data?.paymentId;
  const txid = data?.txid;
  if (!paymentId || !txid) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing paymentId or txid"
    );
  }

  try {
    await callPiComplete(paymentId, txid);
    return {ok: true};
  } catch (err) {
    console.error("[callable] completePayment failed:", {
      paymentId,
      txid,
      message: err?.message || err,
      status: err?.status || null,
      debug: err?.debug || null,
    });
    throw new functions.https.HttpsError("internal", "completePayment failed", {
      message: err?.message || "unknown error",
      status: err?.status || null,
      debug: err?.debug || null,
    });
  }
});

const app = express();
app.use(cors({origin: true}));
app.options("*", cors({origin: true}));
app.use(express.json());
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return res.status(200).send("");
  }
  return next();
});

app.post("/approvePayment", async (req, res) => {
  console.log("[api] /approvePayment called", {
    time: new Date().toISOString(),
    origin: req.get("origin") || null,
    body: req.body,
  });

  const paymentId = req.body?.paymentId;
  if (!paymentId) {
    return res.status(400).json({
      ok: false,
      error: "Missing paymentId",
      debug: {body: req.body || null},
    });
  }

  try {
    await callPiApprove(paymentId);
    return res.status(200).json({ok: true});
  } catch (err) {
    console.error("[api] approvePayment failed:", {
      paymentId,
      message: err?.message || err,
      status: err?.status || null,
      debug: err?.debug || null,
    });
    return res.status(500).json({
      ok: false,
      error: err?.message || "approvePayment failed",
      debug: {
        status: err?.status || null,
        details: err?.debug || null,
      },
    });
  }
});

app.post("/completePayment", async (req, res) => {
  console.log("[api] /completePayment called", {
    time: new Date().toISOString(),
    origin: req.get("origin") || null,
    body: req.body,
  });

  const paymentId = req.body?.paymentId;
  const txid = req.body?.txid;
  if (!paymentId || !txid) {
    return res.status(400).json({
      ok: false,
      error: "Missing paymentId or txid",
      debug: {body: req.body || null},
    });
  }

  try {
    await callPiComplete(paymentId, txid);
    return res.status(200).json({ok: true});
  } catch (err) {
    console.error("[api] completePayment failed:", {
      paymentId,
      txid,
      message: err?.message || err,
      status: err?.status || null,
      debug: err?.debug || null,
    });
    return res.status(500).json({
      ok: false,
      error: err?.message || "completePayment failed",
      debug: {
        status: err?.status || null,
        details: err?.debug || null,
      },
    });
  }
});

exports.api = functions.https.onRequest(app);
