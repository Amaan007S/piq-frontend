// functions/index.js
const axios = require("axios");
const {onCall} = require("firebase-functions/v2/https");

const PI_API_URL = "https://api.minepi.com/v2/payments";

// Approve payment (callable)
// secrets: ["PI_PRIVATE_KEY"] instructs Firebase to inject the secret
exports.approvePayment = onCall(
    {secrets: ["PI_PRIVATE_KEY"]},
    async (req) => {
      const paymentId = req.data?.paymentId;
      const APP_PRIVATE_KEY =
      process.env.PI_PRIVATE_KEY || process.env.SECRET_PI_PRIVATE_KEY;

      if (!paymentId) {
        throw new Error("Missing paymentId");
      }

      if (!APP_PRIVATE_KEY) {
        console.error("PI private key not found in env");
        throw new Error("Server misconfigured");
      }

      try {
        const url = `${PI_API_URL}/${paymentId}/approve`;
        const res = await axios.post(url, {}, {
          headers: {Authorization: `Key ${APP_PRIVATE_KEY}`},
        });
        return {success: true, data: res.data};
      } catch (err) {
        console.error("Approve error:", err.response?.data || err.message);
        throw new Error("Approval failed");
      }
    },
);

// Complete payment (callable)
exports.completePayment = onCall(
    {secrets: ["PI_PRIVATE_KEY"]},
    async (req) => {
      const paymentId = req.data?.paymentId;
      const txid = req.data?.txid;
      const APP_PRIVATE_KEY =
      process.env.PI_PRIVATE_KEY || process.env.SECRET_PI_PRIVATE_KEY;

      if (!paymentId || !txid) {
        throw new Error("Missing paymentId or txid");
      }

      if (!APP_PRIVATE_KEY) {
        console.error("PI private key not found in env");
        throw new Error("Server misconfigured");
      }

      try {
        const url = `${PI_API_URL}/${paymentId}/complete`;
        const res = await axios.post(url, {txid}, {
          headers: {Authorization: `Key ${APP_PRIVATE_KEY}`},
        });
        return {success: true, data: res.data};
      } catch (err) {
        console.error("Complete error:", err.response?.data || err.message);
        throw new Error("Completion failed");
      }
    },
);
