// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore"; 
import { getAuth } from "firebase/auth"; 
import { collection } from "firebase/firestore"; 
import { doc } from "firebase/firestore";
import { getDocs } from "firebase/firestore";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAAz9jIREUXZ4LXUKiuK53-5if-FqMS3aY",
  authDomain: "csce-4095---it-capstone-i.firebaseapp.com",
  databaseURL: "https://csce-4095---it-capstone-i-default-rtdb.firebaseio.com",
  projectId: "csce-4095---it-capstone-i",
  storageBucket: "csce-4095---it-capstone-i.firebasestorage.app",
  messagingSenderId: "65302418562",
  appId: "1:65302418562:web:e01e275aeebde458d3909b",
  measurementId: "G-GZP12BQ6LQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth, collection, doc, getDocs};