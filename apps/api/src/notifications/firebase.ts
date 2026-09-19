import * as admin from 'firebase-admin';

let app: admin.app.App | null = null;
let initialized = false;

export function isFirebaseConfigured(): boolean {
  return Boolean(process.env.FCM_SERVICE_ACCOUNT_JSON?.trim());
}

/** Lazy singleton — firebase-admin is only initialised when a service account is configured. */
export function getFirebaseApp(): admin.app.App {
  if (app) return app;
  if (!isFirebaseConfigured()) throw new Error('FCM_SERVICE_ACCOUNT_JSON is not set');
  if (!initialized) {
    const serviceAccount = JSON.parse(process.env.FCM_SERVICE_ACCOUNT_JSON as string) as admin.ServiceAccount;
    app = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    initialized = true;
  }
   
  return app!;
}

export function getFirebaseAuth(): admin.auth.Auth {
  return getFirebaseApp().auth();
}

export function getFirebaseMessaging(): admin.messaging.Messaging {
  return getFirebaseApp().messaging();
}
