import admin from 'firebase-admin';
import 'dotenv/config';

admin.initializeApp({
  credential: admin.credential.cert(process.env.FIREBASE_SERVICE_ACCOUNT_PATH as admin.ServiceAccount),
});

export const firebaseAdmin = admin;
