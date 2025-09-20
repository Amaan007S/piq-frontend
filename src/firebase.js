// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyAepTxp-PB7zc-NWqxDHH5IAbAwR7TO5Nk",
  authDomain: "chainpiq.firebaseapp.com",
  projectId: "chainpiq",
  storageBucket: "chainpiq.appspot.com",
  messagingSenderId: "169084486673",
  appId: "1:169084486673:web:184f58046460e27cdc5db0",
  measurementId: "G-H58LP9PN4Q"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// export functions (default region). If your functions are deployed to a region like 'us-central1'
// uncomment the region option: getFunctions(app, "us-central1")
const functions = getFunctions(app);

export { db, functions };
