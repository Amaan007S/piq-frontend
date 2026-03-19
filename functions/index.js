const functions = require("firebase-functions");
const functionsV1 = require("firebase-functions/v1");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const {SecretManagerServiceClient} = require("@google-cloud/secret-manager");
const piClient = require("./piClient");

admin.initializeApp();

const smClient = new SecretManagerServiceClient();
const PROJECT_ID = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
const cachedSecrets = {};
const POWER_UP_PRICES = {
  "Extra Time": 1,
  "Skip Question": 3,
  "Second Chance": 2,
};
const MAX_RECONCILE_PER_RUN = 20;
const MAX_RECONCILE_RETRIES = 10;
const PAYMENT_ID_PATTERN = /^[A-Za-z0-9_-]{10,}$/;
const USER_ID_PATTERN = /^[A-Za-z0-9._-]{2,128}$/;
const ADMIN_RETRYABLE_STATUSES = ["needs_reconcile", "failed_permanently"];

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

function parsePositiveAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount;
}

function normalizeTransactionType(data = {}) {
  if (data.type === "credit" || data.type === "deposit") return "credit";
  if (data.type === "debit" || data.type === "purchase") return "debit";
  const amount = Number(data.amount || 0);
  return amount < 0 ? "debit" : "credit";
}

function normalizeTransactionAmount(data = {}) {
  const amount = Math.abs(Number(data.amount || 0));
  return Number.isFinite(amount) ? amount : 0;
}

function getPaymentStatusObject(payment = {}) {
  if (payment?.status && typeof payment.status === "object") return payment.status;
  if (payment?.payment?.status && typeof payment.payment.status === "object") {
    return payment.payment.status;
  }
  return null;
}

function getPaymentAmount(payment = {}) {
  return parsePositiveAmount(payment?.amount ?? payment?.payment?.amount ?? null);
}

function getPaymentTxid(payment = {}) {
  return (
    payment?.txid ||
    payment?.transaction?.txid ||
    payment?.transaction?.txID ||
    payment?.payment?.transaction?.txid ||
    payment?.payment?.transaction?.txID ||
    payment?.transaction?.id ||
    payment?.payment?.transaction?.id ||
    null
  );
}

function isPaymentFullyCompleted(payment = {}) {
  const status = getPaymentStatusObject(payment);
  const transaction = payment?.transaction || payment?.payment?.transaction || null;

  return Boolean(
    status?.developer_approved === true &&
      status?.transaction_verified === true &&
      status?.developer_completed === true &&
      status?.cancelled !== true &&
      status?.user_cancelled !== true &&
      (transaction?.verified !== false)
  );
}

function makeFlowError(message, debug = {}) {
  const err = new Error(message);
  err.debug = debug;
  return err;
}

function validatePaymentId(paymentId) {
  if (typeof paymentId !== "string" || !PAYMENT_ID_PATTERN.test(paymentId)) {
    throw new Error("Invalid paymentId");
  }
}

function validateUserId(userId) {
  if (typeof userId !== "string" || !USER_ID_PATTERN.test(userId)) {
    throw new Error("Invalid userId");
  }
}

function validateTxid(txid) {
  if (typeof txid !== "string" || !txid.trim()) {
    throw new Error("Missing txid");
  }
}

async function assertUserExists(userId) {
  validateUserId(userId);
  const userRef = admin.firestore().collection("users").doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new Error("User not found");
  }
  return userRef;
}

function logFinanceEvent({type, amount, userId, source, paymentId = null}) {
  console.log("[FINANCE EVENT]", {
    type,
    amount,
    userId,
    source,
    paymentId,
  });
}

function formatTopupPlan(amount) {
  const numericAmount = Number(amount || 0);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return null;
  }

  const planValue = Number.isInteger(numericAmount) ? String(numericAmount) : String(numericAmount).replace(/\./g, "_");
  return planValue + "_pi";
}

function makePowerupItemId(powerupType) {
  if (typeof powerupType !== "string" || !powerupType.trim()) {
    return null;
  }
  return powerupType.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function normalizeFinanceMetadata(metadata = {}) {
  return {
    itemId: metadata.itemId || null,
    itemName: metadata.itemName || null,
    category: metadata.category || null,
    plan: metadata.plan || null,
    quantity: Number.isFinite(Number(metadata.quantity)) ? Number(metadata.quantity) : null,
    unitPrice: Number.isFinite(Number(metadata.unitPrice)) ? Number(metadata.unitPrice) : null,
  };
}

function getDateKey(value = null) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  return new Date().toISOString().slice(0, 10);
}

function buildConversionAnalyticsPatch(status) {
  const patch = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (status === "started") {
    patch.totalStarted = admin.firestore.FieldValue.increment(1);
  }
  if (status === "completed") {
    patch.totalCompleted = admin.firestore.FieldValue.increment(1);
  }
  if (status === "failed") {
    patch.totalFailed = admin.firestore.FieldValue.increment(1);
  }

  return patch;
}

function computeConversionRate(counts = {}) {
  const started = Number(counts.totalStarted || 0);
  const completed = Number(counts.totalCompleted || 0);
  if (!started || started < 0) {
    return 0;
  }
  return completed / started;
}

function applyFinanceAnalytics(transaction, financeEntry) {
  const createdDate = getDateKey(financeEntry?.createdDate);
  const metadata = normalizeFinanceMetadata(financeEntry.metadata);
  const amount = Number(financeEntry.amount || 0);
  const userAnalyticsRef = admin.firestore().collection("analytics").doc("users").collection("entries").doc(financeEntry.userId);
  const dailyAnalyticsRef = admin.firestore().collection("analytics").doc("daily").collection("entries").doc(createdDate);

  const userUpdate = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  const dailyUpdate = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (financeEntry.type === "credit") {
    userUpdate.totalTopups = admin.firestore.FieldValue.increment(amount);
    userUpdate.lifetimeValue = admin.firestore.FieldValue.increment(amount);
  }

  if (financeEntry.type === "debit") {
    userUpdate.totalSpent = admin.firestore.FieldValue.increment(amount);
    dailyUpdate.revenue = admin.firestore.FieldValue.increment(amount);
    dailyUpdate.purchases = admin.firestore.FieldValue.increment(1);
  }

  transaction.set(userAnalyticsRef, userUpdate, {merge: true});
  transaction.set(dailyAnalyticsRef, dailyUpdate, {merge: true});

  if (financeEntry.type === "debit" && metadata.itemId) {
    const powerupRef = admin.firestore().collection("analytics").doc("powerups").collection("entries").doc(metadata.itemId);
    transaction.set(powerupRef, {
      itemId: metadata.itemId,
      itemName: metadata.itemName || null,
      category: metadata.category || null,
      totalRevenue: admin.firestore.FieldValue.increment(amount),
      totalPurchases: admin.firestore.FieldValue.increment(1),
      totalQuantitySold: admin.firestore.FieldValue.increment(Number(metadata.quantity || 0)),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
  }
}

async function recordPaymentAttempt(attemptId, attemptData = {}) {
  if (!attemptId || typeof attemptId !== "string") {
    throw new Error("Missing attemptId");
  }

  const createdDate = getDateKey(attemptData.createdDate);
  const attemptRef = admin.firestore().collection("payment_attempts").doc(attemptId);
  const conversionRef = admin.firestore().collection("analytics").doc("conversion").collection("entries").doc("global");
  const dailyAnalyticsRef = admin.firestore().collection("analytics").doc("daily").collection("entries").doc(createdDate);
  const metadata = attemptData.metadata ? normalizeFinanceMetadata(attemptData.metadata) : null;

  await admin.firestore().runTransaction(async (transaction) => {
    const existingSnap = await transaction.get(attemptRef);
    const conversionSnap = await transaction.get(conversionRef);
    const existingData = existingSnap.exists ? (existingSnap.data() || {}) : {};
    const statusHistory = existingData.statusHistory || {};
    const status = attemptData.status || null;
    const hasSeenStatus = Boolean(status && statusHistory[status] === true);

    const payload = {
      userId: attemptData.userId || existingData.userId || null,
      type: attemptData.type || existingData.type || null,
      amount: Number(attemptData.amount || existingData.amount || 0),
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (metadata) {
      payload.metadata = metadata;
    } else if (existingData.metadata) {
      payload.metadata = existingData.metadata;
    }
    if (!existingSnap.exists || !existingData.createdAt || status === "started") {
      payload.createdAt = existingData.createdAt || admin.firestore.FieldValue.serverTimestamp();
    }
    if (attemptData.paymentId || existingData.paymentId) {
      payload.paymentId = attemptData.paymentId || existingData.paymentId;
    }
    if (attemptData.requestId || existingData.requestId) {
      payload.requestId = attemptData.requestId || existingData.requestId;
    }
    if (status) {
      payload.statusHistory = {
        ...statusHistory,
        [status]: true,
      };
    }

    transaction.set(attemptRef, payload, {merge: true});

    if (status && !hasSeenStatus) {
      const conversionPatch = buildConversionAnalyticsPatch(status);
      const dailyPatch = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (status === "started") {
        dailyPatch.newPayments = admin.firestore.FieldValue.increment(1);
      }
      if (status === "failed") {
        dailyPatch.failures = admin.firestore.FieldValue.increment(1);
      }

      const currentCounts = conversionSnap.exists ? (conversionSnap.data() || {}) : {};
      const nextCounts = {
        totalStarted: Number(currentCounts.totalStarted || 0) + (status === "started" ? 1 : 0),
        totalCompleted: Number(currentCounts.totalCompleted || 0) + (status === "completed" ? 1 : 0),
        totalFailed: Number(currentCounts.totalFailed || 0) + (status === "failed" ? 1 : 0),
      };

      transaction.set(conversionRef, {
        ...conversionPatch,
        conversionRate: computeConversionRate(nextCounts),
      }, {merge: true});
      transaction.set(dailyAnalyticsRef, dailyPatch, {merge: true});
    }
  });
}

function getFinanceSummaryUpdate(type, amount) {
  const numericAmount = Number(amount || 0);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error("Invalid finance amount");
  }

  const summaryUpdate = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (type === "credit") {
    summaryUpdate.totalCredit = admin.firestore.FieldValue.increment(numericAmount);
    summaryUpdate.totalTopups = admin.firestore.FieldValue.increment(1);
    return summaryUpdate;
  }

  if (type === "debit") {
    summaryUpdate.totalDebit = admin.firestore.FieldValue.increment(numericAmount);
    summaryUpdate.totalPurchases = admin.firestore.FieldValue.increment(1);
    return summaryUpdate;
  }

  throw new Error("Invalid finance type");
}

function createFinanceLog(transaction, financeEntry) {
  const transactionId = financeEntry?.transactionId;
  if (!transactionId || typeof transactionId !== "string") {
    throw new Error("Missing finance transactionId");
  }

  const createdDate = getDateKey(financeEntry?.createdDate);
  const financeRef = admin.firestore().collection("finance_logs").doc(transactionId);
  const globalSummaryRef = admin.firestore().collection("finance_summary").doc("global");
  const dailySummaryRef = admin.firestore().collection("finance_summary_daily").doc(createdDate);
  const summaryUpdate = getFinanceSummaryUpdate(financeEntry.type, financeEntry.amount);

  transaction.create(financeRef, {
    userId: financeEntry.userId,
    type: financeEntry.type,
    amount: financeEntry.amount,
    source: financeEntry.source,
    paymentId: financeEntry.paymentId || null,
    requestId: financeEntry.requestId || null,
    metadata: normalizeFinanceMetadata(financeEntry.metadata),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  transaction.set(globalSummaryRef, summaryUpdate, {merge: true});
  transaction.set(dailySummaryRef, summaryUpdate, {merge: true});
  applyFinanceAnalytics(transaction, {
    ...financeEntry,
    createdDate,
  });
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

async function assertAdminRequest(req) {
  const expectedKey = process.env.ADMIN_SECRET || null;
  if (!expectedKey) {
    const err = new Error("Admin secret is not configured");
    err.statusCode = 500;
    throw err;
  }

  const providedKey = req.headers["x-admin-key"] || null;

  if (!providedKey || providedKey !== expectedKey) {
    const err = new Error("Forbidden");
    err.statusCode = 403;
    throw err;
  }
}

async function callPiApprove(paymentId) {
  const apiKey = await loadPiApiKey();
  return piClient.approvePayment(paymentId, {apiKey});
}

async function callPiComplete(paymentId, txid) {
  const apiKey = await loadPiApiKey();
  return piClient.completePayment(paymentId, txid, {apiKey});
}

async function fetchPiPayment(paymentId) {
  const apiKey = await loadPiApiKey();
  return piClient.reconcilePayment(paymentId, {apiKey});
}

async function updatePaymentIntent(paymentId, patch = {}) {
  validatePaymentId(paymentId);
  const intentRef = admin.firestore().collection("payment_intents").doc(paymentId);
  await intentRef.set(patch, {merge: true});
}

async function storePaymentIntent(paymentId, userId, expectedAmount) {
  validatePaymentId(paymentId);
  await assertUserExists(userId);

  await updatePaymentIntent(paymentId, {
    userId,
    expectedAmount,
    topupPlan: formatTopupPlan(expectedAmount),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    status: "pending",
    retryCount: 0,
    lastError: null,
    requiresManualReview: false,
    needsReconcile: false,
  });
}

async function markPaymentForReconcile(paymentId, errorMessage, update = {}) {
  await updatePaymentIntent(paymentId, {
    status: "needs_reconcile",
    needsReconcile: true,
    lastFailedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastError: errorMessage || "reconcile required",
    requiresManualReview: false,
    ...update,
  });
}

async function markPaymentCompleted(paymentId, update = {}) {
  await updatePaymentIntent(paymentId, {
    status: "completed",
    needsReconcile: false,
    lastError: null,
    requiresManualReview: false,
    lastReconciledAt: admin.firestore.FieldValue.serverTimestamp(),
    ...update,
  });
}

async function markPaymentFailedPermanently(paymentId, retryCount, lastError) {
  await updatePaymentIntent(paymentId, {
    status: "failed_permanently",
    needsReconcile: false,
    retryCount,
    lastError,
    requiresManualReview: true,
    failedPermanentlyAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function getPaymentIntent(paymentId) {
  validatePaymentId(paymentId);
  const intentRef = admin.firestore().collection("payment_intents").doc(paymentId);
  const intentSnap = await intentRef.get();
  if (!intentSnap.exists) {
    return null;
  }
  return intentSnap.data() || null;
}

async function computeUserBalance(userId) {
  validateUserId(userId);
  const snapshot = await admin
    .firestore()
    .collection("users")
    .doc(userId)
    .collection("transactions")
    .where("status", "==", "completed")
    .get();

  let balance = 0;
  snapshot.forEach((docSnap) => {
    const tx = docSnap.data() || {};
    const amount = normalizeTransactionAmount(tx);
    const type = normalizeTransactionType(tx);
    if (type === "credit") balance += amount;
    if (type === "debit") balance -= amount;
  });

  return balance;
}

async function cacheUserBalance(userId) {
  const balance = await computeUserBalance(userId);
  await admin.firestore().collection("users").doc(userId).set(
    {
      wallet: {
        piBalance: balance,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    },
    {merge: true}
  );
  return balance;
}

async function creditWalletIfMissing(paymentId, payment, intent) {
  validatePaymentId(paymentId);

  const userId = intent?.userId || null;
  const expectedAmount = parsePositiveAmount(intent?.expectedAmount);
  const paidAmount = getPaymentAmount(payment);
  const status = getPaymentStatusObject(payment);
  const txid = getPaymentTxid(payment);
  const topupPlan = intent?.topupPlan || formatTopupPlan(expectedAmount);

  if (!intent || !userId || !expectedAmount) {
    throw makeFlowError("Payment intent not found or invalid", {
      paymentId,
      intent,
      status,
    });
  }

  await assertUserExists(userId);

  const txRef = admin
    .firestore()
    .collection("users")
    .doc(userId)
    .collection("transactions")
    .doc(paymentId);

  const existingTx = await txRef.get();
  if (existingTx.exists) {
    await recordPaymentAttempt(paymentId, {
      userId,
      type: "topup",
      amount: Number(existingTx.data()?.amount || expectedAmount || 0),
      status: "completed",
      paymentId,
      metadata: {
        category: "wallet_topup",
        plan: topupPlan,
      },
    });
    await markPaymentCompleted(paymentId);
    return {
      ok: true,
      duplicate: true,
      amount: Number(existingTx.data()?.amount || 0),
      balance: await cacheUserBalance(userId),
      transaction: existingTx.data() || null,
    };
  }

  console.log("[COMPLETE FLOW]", {
    paymentId,
    txid,
    intentExists: Boolean(intent),
    paidAmount,
    expectedAmount,
    status: JSON.stringify(status, null, 2),
  });

  if (!isPaymentFullyCompleted(payment)) {
    throw makeFlowError("Pi payment not fully completed", {
      paymentId,
      status,
      intent,
      paidAmount,
      expectedAmount,
    });
  }

  if (!paidAmount || !expectedAmount || paidAmount !== expectedAmount) {
    throw makeFlowError("Amount mismatch", {
      paymentId,
      status,
      intent,
      paidAmount,
      expectedAmount,
    });
  }

  const creditResult = await admin.firestore().runTransaction(async (transaction) => {
    const existing = await transaction.get(txRef);
    if (existing.exists) {
      return {
        duplicate: true,
        amount: Number(existing.data()?.amount || paidAmount || 0),
        transaction: existing.data() || null,
      };
    }

    transaction.set(txRef, {
      type: "credit",
      amount: paidAmount,
      source: "pi_payment",
      paymentId,
      txid,
      plan: topupPlan,
      status: "completed",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    createFinanceLog(transaction, {
      transactionId: paymentId,
      userId,
      type: "credit",
      amount: paidAmount,
      source: "wallet_topup",
      paymentId,
      metadata: {
        category: "wallet_topup",
        plan: topupPlan,
      },
    });

    return {
      duplicate: false,
      amount: paidAmount,
      transaction: null,
    };
  });

  const balance = await cacheUserBalance(userId);

  if (creditResult.duplicate) {
    await recordPaymentAttempt(paymentId, {
      userId,
      type: "topup",
      amount: expectedAmount,
      status: "completed",
      paymentId,
      metadata: {
        category: "wallet_topup",
        plan: topupPlan,
      },
    });
    await markPaymentCompleted(paymentId);
    return {
      ok: true,
      duplicate: true,
      amount: creditResult.amount,
      balance,
      transaction: creditResult.transaction,
    };
  }

  logFinanceEvent({
    type: "credit",
    amount: paidAmount,
    userId,
    source: "pi_payment",
    paymentId,
  });

  await recordPaymentAttempt(paymentId, {
    userId,
    type: "topup",
    amount: paidAmount,
    status: "completed",
    paymentId,
    metadata: {
      category: "wallet_topup",
      plan: topupPlan,
    },
  });
  await markPaymentCompleted(paymentId);

  return {
    ok: true,
    duplicate: false,
    amount: paidAmount,
    balance,
  };
}

async function reconcilePayment(paymentId) {
  validatePaymentId(paymentId);
  const intent = await getPaymentIntent(paymentId);
  if (!intent) {
    throw makeFlowError("Payment intent not found", {
      paymentId,
      intent: null,
      status: null,
    });
  }

  const payment = await fetchPiPayment(paymentId);
  return creditWalletIfMissing(paymentId, payment, intent);
}

async function finalizeWalletTopup(paymentId, txid) {
  validatePaymentId(paymentId);
  const intent = await getPaymentIntent(paymentId);
  if (!intent) {
    throw makeFlowError("Payment intent not found or invalid", {
      paymentId,
      intent: null,
      status: null,
    });
  }

  try {
    const payment = await callPiComplete(paymentId, txid);
    return await creditWalletIfMissing(paymentId, payment, intent);
  } catch (err) {
    await markPaymentForReconcile(
      paymentId,
      err?.message || "completePayment failed",
      {
        lastTxid: txid,
      }
    );
    throw err;
  }
}

async function purchasePowerup(userId, powerupType, quantity = 1, clientPrice = null, requestId) {
  validateUserId(userId);
  if (!requestId || typeof requestId !== "string") {
    throw new Error("Missing requestId");
  }
  if (!POWER_UP_PRICES[powerupType]) {
    throw new Error("Invalid powerupType");
  }

  const powerupId = makePowerupItemId(powerupType);
  const safeQuantity = Number(quantity);
  if (!Number.isInteger(safeQuantity) || safeQuantity <= 0) {
    throw new Error("Invalid quantity");
  }

  const unitPrice = POWER_UP_PRICES[powerupType];
  const purchaseMetadata = {
    itemId: powerupId,
    itemName: powerupType,
    category: "powerup",
    quantity: safeQuantity,
    unitPrice,
  };
  const totalPrice = unitPrice * safeQuantity;
  if (!totalPrice || totalPrice <= 0) {
    throw new Error("Invalid price");
  }
  if (clientPrice !== null && Number(clientPrice) !== totalPrice) {
    console.warn("[api] purchasePowerup client price mismatch", {
      userId,
      powerupType,
      clientPrice,
      totalPrice,
    });
  }

  await recordPaymentAttempt(requestId, {
    userId,
    type: "purchase",
    amount: totalPrice,
    status: "started",
    requestId,
    metadata: purchaseMetadata,
  });

  const userRef = await assertUserExists(userId);
  const txCollection = userRef.collection("transactions");
  const purchaseTxRef = txCollection.doc(requestId);

  const result = await admin.firestore().runTransaction(async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) {
      throw new Error("User not found");
    }

    const existingPurchase = await transaction.get(purchaseTxRef);
    const txSnap = await transaction.get(
      txCollection.where("status", "==", "completed")
    );

    let balance = 0;
    txSnap.forEach((docSnap) => {
      const data = docSnap.data() || {};
      const amount = normalizeTransactionAmount(data);
      const type = normalizeTransactionType(data);
      if (type === "credit") balance += amount;
      if (type === "debit") balance -= amount;
    });

    if (existingPurchase.exists) {
      const existingAmount = normalizeTransactionAmount(existingPurchase.data() || {});
      return {
        duplicate: true,
        balance,
        totalPrice: existingAmount || totalPrice,
      };
    }

    if (balance < totalPrice) {
      throw new Error("Insufficient wallet balance");
    }

    const nextBalance = balance - totalPrice;

    transaction.set(purchaseTxRef, {
      type: "debit",
      amount: totalPrice,
      source: "powerup_purchase",
      status: "completed",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      powerupId,
      powerupType,
      powerupName: powerupType,
      unitPrice,
      quantity: safeQuantity,
      requestId,
    });

    createFinanceLog(transaction, {
      transactionId: requestId,
      userId,
      type: "debit",
      amount: totalPrice,
      source: "powerup_purchase",
      requestId,
      metadata: purchaseMetadata,
    });

    transaction.set(
      userRef,
      {
        wallet: {
          piBalance: nextBalance,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        powerUps: {
          [powerupType]: admin.firestore.FieldValue.increment(safeQuantity),
        },
      },
      {merge: true}
    );

    return {duplicate: false, balance: nextBalance, totalPrice};
  });

  const balance = await cacheUserBalance(userId);

  await recordPaymentAttempt(requestId, {
    userId,
    type: "purchase",
    amount: result.totalPrice || totalPrice,
    status: "completed",
    requestId,
    metadata: purchaseMetadata,
  });

  if (!result.duplicate) {
    logFinanceEvent({
      type: "debit",
      amount: result.totalPrice || totalPrice,
      userId,
      source: "powerup_purchase",
      paymentId: requestId,
    });
  }

  return {
    ok: true,
    duplicate: result.duplicate,
    balance,
    totalPrice: result.totalPrice || totalPrice,
    quantity: safeQuantity,
    powerupType,
  };
}

async function adminRetryPayment(paymentId) {
  validatePaymentId(paymentId);
  const intent = await getPaymentIntent(paymentId);
  if (!intent) {
    throw new Error("Payment intent not found");
  }

  if (!ADMIN_RETRYABLE_STATUSES.includes(intent.status)) {
    throw new Error("Payment is not eligible for admin retry");
  }

  console.log("[ADMIN ACTION]", {
    action: "retryPayment",
    paymentId,
    triggeredBy: "admin",
  });

  const result = await reconcilePayment(paymentId);
  await markPaymentCompleted(paymentId, {
    retryCount: 0,
    lastManualRetryAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return result;
}

exports.approvePayment = functions.https.onCall(async (data) => {
  const paymentId = data?.paymentId;
  const userId = data?.userId;
  const expectedAmount = parsePositiveAmount(data?.expectedAmount);

  try {
    validatePaymentId(paymentId);
    validateUserId(userId);
  } catch (err) {
    throw new functions.https.HttpsError("invalid-argument", err.message);
  }

  if (!expectedAmount) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid expectedAmount");
  }

  const topupMetadata = {
    category: "wallet_topup",
    plan: formatTopupPlan(expectedAmount),
  };

  try {
    await recordPaymentAttempt(paymentId, {
      userId,
      type: "topup",
      amount: expectedAmount,
      status: "started",
      paymentId,
      metadata: topupMetadata,
    });
    await storePaymentIntent(paymentId, userId, expectedAmount);
    await callPiApprove(paymentId);
    await recordPaymentAttempt(paymentId, {
      userId,
      type: "topup",
      amount: expectedAmount,
      status: "approved",
      paymentId,
      metadata: topupMetadata,
    });
    return {ok: true};
  } catch (err) {
    await recordPaymentAttempt(paymentId, {
      userId,
      type: "topup",
      amount: expectedAmount,
      status: "failed",
      paymentId,
      metadata: topupMetadata,
    });
    await markPaymentForReconcile(paymentId, err?.message || "approvePayment failed");
    console.error("[callable] approvePayment failed:", {
      paymentId,
      userId,
      expectedAmount,
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

  try {
    validatePaymentId(paymentId);
    validateTxid(txid);
  } catch (err) {
    throw new functions.https.HttpsError("invalid-argument", err.message);
  }

  try {
    const result = await finalizeWalletTopup(paymentId, txid);
    return {ok: true, ...result};
  } catch (err) {
    const intent = await getPaymentIntent(paymentId);
    await recordPaymentAttempt(paymentId, {
      userId: intent?.userId || null,
      type: "topup",
      amount: parsePositiveAmount(intent?.expectedAmount) || 0,
      status: "failed",
      paymentId,
      metadata: {
        category: "wallet_topup",
        plan: intent?.topupPlan || formatTopupPlan(intent?.expectedAmount),
      },
    });
    console.error("[callable] completePayment failed:", {
      paymentId,
      txid,
      message: err?.message || err,
      debug: err?.debug || null,
    });
    throw new functions.https.HttpsError("internal", "completePayment failed", {
      message: err?.message || "unknown error",
      debug: err?.debug || null,
    });
  }
});

exports.reconcilePayment = functions.https.onCall(async (data) => {
  const paymentId = data?.paymentId;

  try {
    validatePaymentId(paymentId);
  } catch (err) {
    throw new functions.https.HttpsError("invalid-argument", err.message);
  }

  try {
    const result = await reconcilePayment(paymentId);
    return {ok: true, ...result};
  } catch (err) {
    const intent = await getPaymentIntent(paymentId);
    await recordPaymentAttempt(paymentId, {
      userId: intent?.userId || null,
      type: "topup",
      amount: parsePositiveAmount(intent?.expectedAmount) || 0,
      status: "failed",
      paymentId,
      metadata: {
        category: "wallet_topup",
        plan: intent?.topupPlan || formatTopupPlan(intent?.expectedAmount),
      },
    });
    await markPaymentForReconcile(paymentId, err?.message || "reconcilePayment failed");
    console.error("[callable] reconcilePayment failed:", {
      paymentId,
      message: err?.message || err,
      debug: err?.debug || null,
    });
    throw new functions.https.HttpsError("internal", "reconcilePayment failed", {
      message: err?.message || "unknown error",
      debug: err?.debug || null,
    });
  }
});

exports.reconcilePendingPayments = functionsV1.pubsub
  .schedule("every 2 minutes")
  .onRun(async () => {
    const intentsSnap = await admin
      .firestore()
      .collection("payment_intents")
      .where("needsReconcile", "==", true)
      .limit(MAX_RECONCILE_PER_RUN)
      .get();

    if (intentsSnap.empty) {
      console.log("[RECONCILE JOB] no pending payment intents");
      return null;
    }

    for (const docSnap of intentsSnap.docs) {
      const paymentId = docSnap.id;
      const data = docSnap.data() || {};
      const retryCount = Number(data.retryCount || 0);

      if (retryCount >= MAX_RECONCILE_RETRIES) {
        const lastError = data.lastError || "Retry limit exceeded";
        await markPaymentFailedPermanently(paymentId, retryCount, lastError);
        console.error("[CRITICAL PAYMENT FAILURE]", {
          paymentId,
          retryCount,
          lastError,
        });
        console.log("[RECONCILE JOB]", {
          paymentId,
          retryCount,
          success: false,
          exhausted: true,
        });
        continue;
      }

      const nextRetryCount = retryCount + 1;
      await updatePaymentIntent(paymentId, {
        retryCount: admin.firestore.FieldValue.increment(1),
        lastRetryAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      try {
        await reconcilePayment(paymentId);
        console.log("[RECONCILE JOB]", {
          paymentId,
          retryCount: nextRetryCount,
          success: true,
        });
      } catch (err) {
        const exhausted = nextRetryCount >= MAX_RECONCILE_RETRIES;
        const lastError = err?.message || "reconcile failed";

        if (exhausted) {
          await markPaymentFailedPermanently(paymentId, nextRetryCount, lastError);
          console.error("[CRITICAL PAYMENT FAILURE]", {
            paymentId,
            retryCount: nextRetryCount,
            lastError,
          });
        } else {
          await markPaymentForReconcile(paymentId, lastError);
        }

        console.log("[RECONCILE JOB]", {
          paymentId,
          retryCount: nextRetryCount,
          success: false,
          exhausted,
        });
      }
    }

    return null;
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

app.get("/", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "PiQ Payment API",
    status: "running",
    timestamp: new Date().toISOString(),
  });
});
app.post("/approvePayment", async (req, res) => {
  console.log("[api] /approvePayment called", {
    time: new Date().toISOString(),
    origin: req.get("origin") || null,
    body: req.body,
  });

  const paymentId = req.body?.paymentId;
  const userId = req.body?.userId;
  const expectedAmount = parsePositiveAmount(req.body?.expectedAmount);

  try {
    validatePaymentId(paymentId);
    validateUserId(userId);
  } catch (err) {
    return res.status(400).json({ok: false, error: err.message});
  }
  if (!expectedAmount) {
    return res.status(400).json({ok: false, error: "Invalid expectedAmount"});
  }

  const topupMetadata = {
    category: "wallet_topup",
    plan: formatTopupPlan(expectedAmount),
  };

  try {
    await recordPaymentAttempt(paymentId, {
      userId,
      type: "topup",
      amount: expectedAmount,
      status: "started",
      paymentId,
      metadata: topupMetadata,
    });
    await storePaymentIntent(paymentId, userId, expectedAmount);
    await callPiApprove(paymentId);
    await recordPaymentAttempt(paymentId, {
      userId,
      type: "topup",
      amount: expectedAmount,
      status: "approved",
      paymentId,
      metadata: topupMetadata,
    });
    return res.status(200).json({ok: true});
  } catch (err) {
    await recordPaymentAttempt(paymentId, {
      userId,
      type: "topup",
      amount: expectedAmount,
      status: "failed",
      paymentId,
      metadata: topupMetadata,
    });
    await markPaymentForReconcile(paymentId, err?.message || "approvePayment failed");
    console.error("[api] approvePayment failed:", {
      paymentId,
      userId,
      expectedAmount,
      message: err?.message || err,
      status: err?.status || null,
      debug: err?.debug || null,
    });
    return res.status(500).json({
      ok: false,
      error: err?.message || "approvePayment failed",
      debug: {status: err?.status || null, details: err?.debug || null},
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

  try {
    validatePaymentId(paymentId);
    validateTxid(txid);
  } catch (err) {
    return res.status(400).json({ok: false, error: err.message, debug: {body: req.body || null}});
  }

  try {
    const result = await finalizeWalletTopup(paymentId, txid);
    return res.status(200).json({ok: true, ...result});
  } catch (err) {
    const intent = await getPaymentIntent(paymentId);
    await recordPaymentAttempt(paymentId, {
      userId: intent?.userId || null,
      type: "topup",
      amount: parsePositiveAmount(intent?.expectedAmount) || 0,
      status: "failed",
      paymentId,
      metadata: {
        category: "wallet_topup",
        plan: intent?.topupPlan || formatTopupPlan(intent?.expectedAmount),
      },
    });
    return res.status(500).json({
      ok: false,
      error: err?.message || "completePayment failed",
      debug: {
        paymentId,
        status: err?.debug?.status || null,
        intent,
      },
    });
  }
});

app.post("/reconcilePayment", async (req, res) => {
  console.log("[api] /reconcilePayment called", {
    time: new Date().toISOString(),
    origin: req.get("origin") || null,
    body: req.body,
  });

  const paymentId = req.body?.paymentId;
  try {
    validatePaymentId(paymentId);
  } catch (err) {
    return res.status(400).json({ok: false, error: err.message});
  }

  try {
    const result = await reconcilePayment(paymentId);
    return res.status(200).json({ok: true, ...result});
  } catch (err) {
    const intent = await getPaymentIntent(paymentId);
    await recordPaymentAttempt(paymentId, {
      userId: intent?.userId || null,
      type: "topup",
      amount: parsePositiveAmount(intent?.expectedAmount) || 0,
      status: "failed",
      paymentId,
      metadata: {
        category: "wallet_topup",
        plan: intent?.topupPlan || formatTopupPlan(intent?.expectedAmount),
      },
    });
    await markPaymentForReconcile(paymentId, err?.message || "reconcilePayment failed");
    return res.status(500).json({
      ok: false,
      error: err?.message || "reconcilePayment failed",
      debug: {
        paymentId,
        status: err?.debug?.status || null,
        intent,
      },
    });
  }
});

app.post("/admin/retryPayment", async (req, res) => {
  try {
    await assertAdminRequest(req);
  } catch (err) {
    return res.status(err?.statusCode || 401).json({ok: false, error: err.message});
  }

  const paymentId = req.body?.paymentId;
  try {
    validatePaymentId(paymentId);
  } catch (err) {
    return res.status(400).json({ok: false, error: err.message});
  }

  const intent = await getPaymentIntent(paymentId);
  if (!intent) {
    return res.status(404).json({ok: false, error: "Payment intent not found"});
  }
  if (!ADMIN_RETRYABLE_STATUSES.includes(intent.status)) {
    return res.status(400).json({ok: false, error: "Payment is not eligible for admin retry"});
  }

  try {
    const result = await adminRetryPayment(paymentId);
    return res.status(200).json({ok: true, ...result});
  } catch (err) {
    await markPaymentForReconcile(paymentId, err?.message || "admin retry failed", {
      requiresManualReview: true,
    });
    return res.status(500).json({
      ok: false,
      error: err?.message || "admin retry failed",
      debug: {paymentId, intent: await getPaymentIntent(paymentId)},
    });
  }
});

app.post("/purchasePowerup", async (req, res) => {
  console.log("[api] /purchasePowerup called", {
    time: new Date().toISOString(),
    origin: req.get("origin") || null,
    body: req.body,
  });

  const userId = req.body?.userId;
  const powerupType = req.body?.powerupType;
  const quantity = req.body?.quantity ?? 1;
  const clientPrice = req.body?.price ?? null;
  const requestId = req.body?.requestId;

  try {
    const result = await purchasePowerup(userId, powerupType, quantity, clientPrice, requestId);
    return res.status(200).json(result);
  } catch (err) {
    const safeQuantity = Number(quantity) || 0;
    const unitPrice = POWER_UP_PRICES[powerupType] || 0;
    await recordPaymentAttempt(requestId || ("purchase_" + Date.now()), {
      userId: typeof userId === "string" ? userId : null,
      type: "purchase",
      amount: unitPrice > 0 && safeQuantity > 0 ? unitPrice * safeQuantity : 0,
      status: "failed",
      requestId: requestId || null,
      metadata: {
        itemId: makePowerupItemId(powerupType),
        itemName: powerupType || null,
        category: "powerup",
        quantity: safeQuantity > 0 ? safeQuantity : null,
        unitPrice: unitPrice > 0 ? unitPrice : null,
      },
    });
    console.error("[api] purchasePowerup failed:", {
      userId,
      powerupType,
      quantity,
      requestId,
      message: err?.message || err,
    });
    return res.status(400).json({ok: false, error: err?.message || "purchasePowerup failed"});
  }
});

exports.api = functions.https.onRequest(app);
exports.computeUserBalance = computeUserBalance;
exports.reconcileWalletPayment = reconcilePayment;
exports.adminRetryWalletPayment = adminRetryPayment;


