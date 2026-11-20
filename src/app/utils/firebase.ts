import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging as getFcm } from "firebase-admin/messaging";
import config from "../config";

// Returns the FCM messaging client, or null when Firebase env vars are
// missing so local development keeps working without push notifications.
export const getMessaging = () => {
  const { projectId, clientEmail, privateKey } = config.firebase;
  if (!projectId || !clientEmail || !privateKey) return null;

  if (!getApps().length) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }

  return getFcm();
};
