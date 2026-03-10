// src/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDGIIbqeQgSwLi20WJzkdzt1hyCWE4D3QM",
    authDomain: "city-scholar-2fd67.firebaseapp.com",
    projectId: "city-scholar-2fd67",
    storageBucket: "city-scholar-2fd67.firebasestorage.app",
    messagingSenderId: "815981872706",
    appId: "1:815981872706:web:cfeff29aa70e304f8ccfdb",
    measurementId: "G-N6XGVF88HD"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };