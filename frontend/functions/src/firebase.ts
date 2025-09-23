import * as admin from "firebase-admin";
import type { firestore as AdminFirestore } from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

export const db = admin.firestore();
export const fieldValue = admin.firestore.FieldValue;
export type Firestore = AdminFirestore.Firestore;

