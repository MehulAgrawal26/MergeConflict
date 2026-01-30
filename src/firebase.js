// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBOVtrFhoogRe91JcTAKphp4km3m04l7BM",
  authDomain: "campuscanteen-cfd49.firebaseapp.com",
  projectId: "campuscanteen-cfd49",
  storageBucket: "campuscanteen-cfd49.firebasestorage.app",
  messagingSenderId: "214313397524",
  appId: "1:214313397524:web:6b9c2525175a8d017a6601"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export database and auth to be used in other files
export const db = getFirestore(app);
export const auth = getAuth(app);