// functions/reconcile.js
/* eslint max-len: ["error", { "code": 80 }] */
const admin = require("firebase-admin");
const {schedule} = require("firebase-functions/v2");
const logger = require("firebase-functions/logger");
const piClient = require("./piClient");

admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

/**
 * Scheduled reconciliation job.
 * Runs every 5 minutes and reconciles transactions older
 * than PENDING_AGE_MINUTES.
 */
exports.reconcilePendingPayments = schedule(
    "every 5 minutes",
    async (context) => {
      const PENDING_AGE_MINUTES = 3;
      const now = Date.now();
      const cutoff = new Date(now - PENDING_AGE_MINUTES * 60 * 1000);

      logger.log("[reconcile] started at", new Date(now).toISOString());

      try {
        const q = db
            .collectionGroup("transactions")
            .where("status", "==", "pending")
            .where("timestamp", "<", cutoff);

        const snap = await q.get();
        if (snap.empty) {
          logger.log(
              "[reconcile] no pending transactions to process",
          );
          return;
        }

        logger.log(
            "[reconcile] found %d pending tx(s)",
            snap.size,
        );

        const BATCH_CONCURRENCY = 6;
        const docs = snap.docs;

        for (let i = 0; i < docs.length; i += BATCH_CONCURRENCY) {
          const chunk = docs.slice(i, i + BATCH_CONCURRENCY);

          // eslint-disable-next-line no-await-in-loop
          await Promise.all(
              chunk.map(async (docSnap) => {
                const tx = docSnap.data() || {};
                const docRef = docSnap.ref;
                const parentUserRef = docRef.parent.parent;
                const username = parentUserRef?.id || null;

                const paymentId = tx.paymentId || tx.id || null;
                if (!paymentId) {
                  logger.warn(
                      "[reconcile] missing paymentId, marking failed",
                      {path: docRef.path},
                  );
                  await docRef.update({
                    status: "failed",
                    detail: "missing paymentId on pending tx",
                    updatedAt: FieldValue.serverTimestamp(),
                  });
                  return;
                }

                logger.log(
                    "[reconcile] reconciling",
                    {path: docRef.path, paymentId},
                );

                try {
                  const piStatus =
                await piClient.reconcilePayment(paymentId);

                  if (!piStatus || !piStatus.status) {
                    logger.warn(
                        "[reconcile] invalid piStatus",
                        {piStatus, path: docRef.path},
                    );
                    return;
                  }

                  if (piStatus.status === "completed") {
                    await db.runTransaction(async (txRunner) => {
                      const txDoc = await txRunner.get(docRef);
                      const current = txDoc.data() || {};

                      if (current.status === "completed") {
                        logger.log(
                            "[reconcile] already completed, skipping",
                            {path: docRef.path},
                        );
                        return;
                      }

                      txRunner.update(docRef, {
                        status: "completed",
                        txid:
                      piStatus.txid ||
                      current.txid ||
                      null,
                        paymentId,
                        updatedAt:
                      FieldValue.serverTimestamp(),
                      });

                      if (
                        username &&
                    typeof piStatus.amount === "number"
                      ) {
                        const userRef =
                      db.collection("users").doc(username);

                        const userSnap =
                      await txRunner.get(userRef);

                        if (userSnap.exists) {
                          const uData = userSnap.data() || {};
                          const wallet =
                        uData.wallet || {piBalance: 0};

                          const newBalance =
                        (wallet.piBalance || 0) +
                        piStatus.amount;

                          txRunner.update(userRef, {
                            "wallet.piBalance": newBalance,
                            "wallet.testnetLinked": true,
                          });
                        }
                      }
                    });

                    logger.log(
                        "[reconcile] marked completed",
                        {path: docRef.path, paymentId},
                    );
                  } else if (piStatus.status === "failed") {
                    await docRef.update({
                      status: "failed",
                      detail:
                    piStatus.detail ||
                    "Pi reported failure",
                      updatedAt: FieldValue.serverTimestamp(),
                    });

                    logger.log(
                        "[reconcile] marked failed",
                        {path: docRef.path, paymentId},
                    );
                  } else {
                    await docRef.update({
                      lastCheckedAt:
                    FieldValue.serverTimestamp(),
                    });

                    logger.log(
                        "[reconcile] still pending",
                        {path: docRef.path, paymentId},
                    );
                  }
                } catch (err) {
                  logger.error(
                      "[reconcile] error reconciling",
                      {path: docRef.path, err: String(err)},
                  );
                  try {
                    await docRef.update({
                      reconcileAttempts:
                    FieldValue.increment(1),
                      lastCheckedAt:
                    FieldValue.serverTimestamp(),
                    });
                  } catch (ignore) {
                    logger.warn(
                        "[reconcile] failed to update " +
                    "retry counters",
                        {path: docRef.path},
                    );
                  }
                }
              }),
          );
        }

        logger.log("[reconcile] finished");
      } catch (err) {
        logger.error("[reconcile] top-level error", err);
        throw err;
      }
    },
);
