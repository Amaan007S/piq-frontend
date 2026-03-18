const admin = require("firebase-admin");

admin.initializeApp();

function normalizeType(data) {
  if (data.type === "deposit") return "credit";
  if (data.type === "purchase") return "debit";
  if (data.type === "credit" || data.type === "debit") return data.type;
  return Number(data.amount || 0) < 0 ? "debit" : "credit";
}

function normalizeAmount(data) {
  const amount = Math.abs(Number(data.amount || 0));
  return Number.isFinite(amount) ? amount : 0;
}

function normalizeSource(data, type) {
  if (data.source) return data.source;
  if (type === "debit") return "powerup_purchase";
  return "pi_payment";
}

async function migrate() {
  const usersSnap = await admin.firestore().collection("users").get();
  console.log(`Migrating transactions for ${usersSnap.size} users...`);

  for (const userDoc of usersSnap.docs) {
    const txSnap = await userDoc.ref.collection("transactions").get();
    for (const txDoc of txSnap.docs) {
      const data = txDoc.data() || {};
      const type = normalizeType(data);
      const createdAt = data.createdAt || data.timestamp || admin.firestore.FieldValue.serverTimestamp();
      const nextData = {
        type,
        amount: normalizeAmount(data),
        source: normalizeSource(data, type),
        status: data.status || "completed",
        createdAt,
      };

      if (data.paymentId) nextData.paymentId = data.paymentId;
      if (data.txid) nextData.txid = data.txid;
      if (data.powerupType) nextData.powerupType = data.powerupType;
      if (data.quantity) nextData.quantity = data.quantity;

      await txDoc.ref.set(nextData, {merge: true});
      console.log(`Migrated ${userDoc.id}/${txDoc.id}`);
    }
  }

  console.log("Transaction migration complete.");
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
