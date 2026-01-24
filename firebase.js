import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  getFirestore, 
  enableIndexedDbPersistence 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ✅ ENABLE OFFLINE MODE
enableIndexedDbPersistence(db).catch((err) => {
  console.log("Offline persistence error:", err.code);
});

export { db };
