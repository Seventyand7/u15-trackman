/**
 * Firebase 專案設定。
 *
 * 這些值「不是密鑰」，任何人打開網站都看得到，公開在 GitHub repo 是正常且官方建議的做法。
 * 真正的存取控制在 Firestore Security Rules（見專案根目錄 firestore.rules）。
 * 詳見 README 的「安全設計」一節。
 *
 * 請把下面的值換成你自己的 Firebase 專案設定
 * （Firebase Console → 專案設定 → 一般 → 你的應用程式 → SDK 設定與配置 → 設定）。
 */
export const firebaseConfig = {
    apiKey: "AIzaSyD-mm700rCyfAiq6kQ4zlPzEN45hNPMwm0",
    authDomain: "trackman-db.firebaseapp.com",
    projectId: "trackman-db",
    storageBucket: "trackman-db.firebasestorage.app",
    messagingSenderId: "941899398856",
    appId: "1:941899398856:web:3c1add8b7b9001809a6ffd"
  };

/** 設定還沒填的時候，App 會顯示引導畫面而不是一片白畫面加 console 錯誤。 */
export const isFirebaseConfigured = !Object.values(firebaseConfig).some((v) =>
  String(v).includes('REPLACE_ME'),
)
