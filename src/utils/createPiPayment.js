import ensurePiInit from "./piInit";
import { PI_API_BASE, PI_SANDBOX } from "../config/piPlatform";

const APPROVE_HTTP_URL = `${PI_API_BASE}/approvePayment`;
const COMPLETE_HTTP_URL = `${PI_API_BASE}/completePayment`;
const NOOP = () => {};
const ensureFn = (fn) => (typeof fn === "function" ? fn : NOOP);

async function postJson(url, bodyObj, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyObj),
      signal: controller.signal,
    });

    const rawText = await res.text();
    let parsedBody = null;

    try {
      parsedBody = rawText ? JSON.parse(rawText) : null;
    } catch (err) {
      parsedBody = null;
    }

    return {
      ok: res.ok,
      status: res.status,
      body: parsedBody !== null ? parsedBody : rawText,
      raw: rawText,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function callApproveHttp(paymentId, userId, expectedAmount) {
  const response = await postJson(APPROVE_HTTP_URL, {
    paymentId,
    userId,
    expectedAmount,
  });
  if (!response.ok) {
    const err = new Error(
      response.body?.error || `approvePayment failed with status ${response.status}`
    );
    err.status = response.status;
    err.body = response.body;
    err.raw = response.raw;
    throw err;
  }
  return response.body;
}

async function callCompleteHttp(paymentId, txid) {
  const response = await postJson(COMPLETE_HTTP_URL, { paymentId, txid });
  if (!response.ok) {
    const err = new Error(
      response.body?.error || `completePayment failed with status ${response.status}`
    );
    err.status = response.status;
    err.body = response.body;
    err.raw = response.raw;
    throw err;
  }
  return response.body;
}

const createPiPayment = async (paymentData = {}, callbacks = {}) => {
  if (!window?.Pi) {
    throw new Error("Pi SDK not found (window.Pi undefined).");
  }

  await ensurePiInit({ sandbox: true });

  const safeOnReadyForServerApproval = ensureFn(callbacks.onReadyForServerApproval);
  const safeOnReadyForServerCompletion = ensureFn(callbacks.onReadyForServerCompletion);
  const safeOnCancel = ensureFn(callbacks.onCancel);
  const safeOnError = ensureFn(callbacks.onError);

  const approvedPayments = new Set();
  const completedPayments = new Set();
  const metadata = paymentData.metadata ?? {};

  const onReadyForServerApprovalSync = (paymentId) => {
    if (!paymentId || approvedPayments.has(paymentId)) return;
    approvedPayments.add(paymentId);

    void (async () => {
      try {
        const response = await callApproveHttp(
          paymentId,
          metadata.userId || null,
          Number(paymentData.amount)
        );
        safeOnReadyForServerApproval(paymentId, response);
      } catch (err) {
        approvedPayments.delete(paymentId);
        safeOnError(err instanceof Error ? err : new Error(String(err)));
      }
    })();
  };

  const onReadyForServerCompletionSync = (paymentId, txid) => {
    const completionKey = `${paymentId || ""}:${txid || ""}`;
    if (!paymentId || !txid || completedPayments.has(completionKey)) return;
    completedPayments.add(completionKey);

    void (async () => {
      try {
        const response = await callCompleteHttp(paymentId, txid);
        safeOnReadyForServerCompletion(paymentId, txid, response);
      } catch (err) {
        completedPayments.delete(completionKey);
        safeOnError(err instanceof Error ? err : new Error(String(err)));
      }
    })();
  };

  const paymentPayload = {
    amount: String(paymentData.amount),
    memo: paymentData.memo ?? "",
    metadata: {
      ...metadata,
      sandbox: true,
      frontendSandbox: PI_SANDBOX,
    },
  };

  return window.Pi.createPayment(paymentPayload, {
    onReadyForServerApproval: onReadyForServerApprovalSync,
    onReadyForServerCompletion: onReadyForServerCompletionSync,
    onCancel: () => safeOnCancel(),
    onError: (err) => safeOnError(err instanceof Error ? err : new Error(String(err))),
  });
};

export default createPiPayment;
