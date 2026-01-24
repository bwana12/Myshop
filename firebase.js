import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  getFirestore, 
  enableIndexedDbPersistence 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

onst firebaseConfig = {
  apiKey: "AIzaSyDwhyU5BrtjRhy-45rd5oYfzGO8abehUiM",
  authDomain: "shopeasy-14890.firebaseapp.com",
  projectId: "shopeasy-14890",
  storageBucket: "shopeasy-14890.firebasestorage.app",
  messagingSenderId: "45827037951",
  appId: "1:45827037951:web:545d41703780fa51018aca",
  measurementId: "G-BFPV2QQ80S"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

onSnapshot(collection(db, "products"), (snapshot) => {
  snapshot.docs.forEach(doc => {
    console.log(doc.data());
  });
});

// ✅ ENABLE OFFLINE MODE
enableIndexedDbPersistence(db).catch((err) => {
  console.log("Offline persistence error:", err.code);
});

export { db };
