import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  type Firestore,
} from 'firebase/firestore'
import { firebaseConfig, isFirebaseConfigured } from './config'

let _app: FirebaseApp | null = null
let _auth: Auth | null = null
let _db: Firestore | null = null

function app(): FirebaseApp {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase 尚未設定，請填寫 src/firebase/config.ts')
  }
  if (!_app) _app = initializeApp(firebaseConfig)
  return _app
}

export function auth(): Auth {
  if (!_auth) _auth = getAuth(app())
  return _auth
}

/**
 * Firestore 開啟本機持久化快取：
 * 一邊看 YouTube 回放一邊 key 資料時，網路短暫斷線不會卡住輸入，恢復後自動同步。
 * 這個工具只有一個人、單一分頁在用，所以用 single-tab manager（不需要跨分頁協調）。
 */
export function db(): Firestore {
  if (!_db) {
    _db = initializeFirestore(app(), {
      localCache: persistentLocalCache({ tabManager: persistentSingleTabManager(undefined) }),
    })
  }
  return _db
}

export const googleProvider = new GoogleAuthProvider()
// 每次都讓我選帳號，避免不小心用到錯的 Google 帳號
googleProvider.setCustomParameters({ prompt: 'select_account' })
