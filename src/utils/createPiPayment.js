// src/utils/createPiPayment.js
export const createPiPayment = async ({ amount, memo, metadata, onSuccess, onCancel, onError }) => {
    if (!window.Pi) {
      console.error("Pi SDK not found.");
      return;
    }
  
    try {
      const payment = await window.Pi.createPayment({
        amount: amount.toString(),
        memo,      // e.g. "Buying Extra Time power-up"
        metadata,  // e.g. { type: "powerup", name: "Extra Time" },
        callbacks: {
          onReadyForServerApproval: (paymentId) => {
            console.log("Ready for server approval", paymentId);
            // You'd call your backend here to approve (simulated for now)
            onSuccess && onSuccess(paymentId);
          },
          onReadyForServerCompletion: (paymentId, txid) => {
            console.log("Ready to complete:", paymentId, txid);
            // Simulate auto-complete
          },
          onCancel,
          onError,
        },
      });
  
      console.log("Payment created:", payment);
    } catch (error) {
      console.error("Payment creation failed:", error);
      onError && onError(error);
    }
  };
  