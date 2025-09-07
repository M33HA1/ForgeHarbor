// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBPk4J3j3Auqsmrgq0842sUYJ57mCQ8YSI",
  authDomain: "forgeharbor-81586.firebaseapp.com",
  projectId: "forgeharbor-81586",
  storageBucket: "forgeharbor-81586.firebasestorage.app",
  messagingSenderId: "717600280435",
  appId: "1:717600280435:web:08c73133c5a9b6aa28bf06",
  measurementId: "G-7VT0D8EJ3T"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);