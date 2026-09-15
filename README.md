# 迎風飛翔 U15 硬式棒球聯賽 — Trackman 數據庫

看 YouTube 直播回放 → 手動 key 進畫面上的 Trackman 數據 → 自動算出單場最佳與各隊季前三名 → 一鍵輸出 PNG 圖卡。

私人工具，單人使用，桌機優先。

---

## 目前進度

| 階段 | 內容 | 狀態 |
|---|---|---|
| 1 | 專案骨架、Firebase 連線、Google 登入與白名單、Security Rules、GitHub Actions 部署 | ✅ 完成 |
| 2 | `ranking.ts`、球員合併邏輯與完整單元測試 | ✅ 完成 |
| 3 | 設定頁、記錄頁 | ✅ 完成 |
| 4 | 圖卡輸出頁 ← 到這裡就能開始每週使用 | 待做 |
| 5 | 季排名頁、CSV | 待做 |
| 6 | 資料管理頁 | 待做 |

---

## 技術

Vite 6 + React 18 + TypeScript · Tailwind CSS 3 · Firebase v11 modular SDK（Auth + Firestore，開啟 persistentLocalCache）· React Router（HashRouter）· Vitest · GitHub Actions → GitHub Pages

> Node 版本：本機是 v20.9.0，所以選 Vite 6 而不是 Vite 7（Vite 7 需要 Node 20.19+）。CI 也固定用 Node 20。

---

## 本機開發

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 單元測試
npm run typecheck  # 型別檢查
npm run build      # 產生 dist/
```

Firebase 設定還沒填的時候，網站會顯示引導畫面而不是白畫面。

---

## 初次設定（這些要你手動做一次）

### 1. 建立 Firebase 專案
1. 打開 <https://console.firebase.google.com/> → **新增專案**。
2. 專案名稱隨意（例如 `u15-trackman`）。Google Analytics 可以關掉，用不到。

### 2. 啟用 Google 登入
1. 左側 **Authentication** → **開始使用**。
2. **Sign-in method** 分頁 → 選 **Google** → 開啟 **啟用** → 選一個支援電子郵件 → **儲存**。

### 3. 加入授權網域（部署後登入才不會失敗）
1. **Authentication** → **Settings** 分頁 → **Authorized domains**。
2. 按 **新增網域**，加入 `<你的GitHub帳號>.github.io`（例如 `hank.github.io`，**只填網域，不要帶 `/repo` 路徑**）。
3. `localhost` 預設就在清單裡，本機開發不用另外加。

> 漏掉這步的症狀：部署後按登入，跳出 `auth/unauthorized-domain` 錯誤。網站會直接把這個提示顯示出來。

### 4. 建立 Firestore
1. 左側 **Firestore Database** → **建立資料庫**。
2. 位置選 **asia-east1（台灣）** 或 `asia-northeast1`，建好之後**不能改**。
3. 模式選哪個都可以，因為下一步會用 `firestore.rules` 整個覆蓋掉。

### 5. 取得 config 並填進程式
1. **專案設定（齒輪）** → **一般** → 最下方 **你的應用程式** → 點 `</>`（網頁）圖示新增應用程式。
2. 註冊名稱隨意，**不用**勾 Firebase Hosting。
3. 複製出現的 `firebaseConfig` 物件。
4. 打開 [`src/firebase/config.ts`](src/firebase/config.ts)，把 `REPLACE_ME` 全部換成你的值。

### 6. 部署 Security Rules

**做法 A：Console 貼上（最快，不用裝東西）**
1. **Firestore Database** → **規則** 分頁。
2. 把 [`firestore.rules`](firestore.rules) 的內容整段貼上去，蓋掉原本的。
3. 按 **發布**。

**做法 B：用 Firebase CLI（之後改規則比較方便）**
```bash
npm install -g firebase-tools
firebase login
firebase use --add          # 選你剛建立的專案，alias 填 default
firebase deploy --only firestore:rules
```
（`firebase use --add` 會產生 `.firebaserc`，裡面有專案 ID。這個檔案已經在 `.gitignore` 裡，不會進 repo。）

> ⚠️ **每次改 `firestore.rules` 都要重新部署**，改檔案本身不會生效。

### 7. 推上 GitHub 並開啟 Pages
```bash
git init
git add -A
git commit -m "U15 Trackman 數據庫：階段一"
git branch -M main
git remote add origin https://github.com/<你的帳號>/<repo名稱>.git
git push -u origin main
```
1. 到 GitHub repo → **Settings** → **Pages**。
2. **Source** 選 **GitHub Actions**（不是 "Deploy from a branch"）。
3. 回到 **Actions** 分頁看 workflow 跑完，網址會是 `https://<你的帳號>.github.io/<repo名稱>/`。

> `vite.config.ts` 的 `base` 會由 GitHub Actions 自動用 repo 名稱帶入（`BASE_PATH` 環境變數），**不需要手動改**。改 repo 名稱也會自動跟著變。

### 8. 確認白名單
[`src/auth/allowlist.ts`](src/auth/allowlist.ts) 裡已經填了 `xhk1997@gmail.com`。
如果之後要換帳號，**這裡和 `firestore.rules` 兩邊都要改**，而且 rules 改完要重新部署。

---

## 安全設計

### 威脅模型
- **repo 是公開的**，任何人都看得到原始碼。
- **`src/firebase/config.ts` 是公開的**，`apiKey`、`projectId` 這些值任何人打開網站按 F12 就看得到。

這是正常的。Firebase 的 `apiKey` **不是密鑰**，它只是「這個請求要送到哪個 Firebase 專案」的識別字串，官方文件明講可以公開。它不授權任何事情，只負責定址。

所以真正要問的問題不是「怎麼把 config 藏起來」（做不到，也沒必要），而是「陌生人拿著這份 config 能做什麼」。

### 存取控制
兩道關卡，但只有一道是真的：

| | 在哪執行 | 擋得住誰 | 作用 |
|---|---|---|---|
| 前端白名單 `allowlist.ts` | 使用者的瀏覽器 | **擋不住任何人** | 只是 UX |
| Firestore Security Rules | Google 伺服器 | **所有人** | 真正的防線 |

**前端白名單只是 UX。** 它的用途是：如果不小心用錯的 Google 帳號登入，會看到「無權限」四個字並自動登出，而不是進到一個到處噴權限錯誤的破畫面。任何人都可以打開 DevTools 改掉瀏覽器裡的 JS 跳過它——然後就會發現，跳過之後什麼資料也讀不到、寫不進去，因為資料根本不在瀏覽器手上。

**Security Rules 才是真正的防線。** 它在 Google 的伺服器上執行，使用者改不到、繞不過：

```
allow read, write: if request.auth != null
  && request.auth.token.email == "xhk1997@gmail.com"
  && request.auth.token.email_verified == true;
```

三個條件缺一不可：
- `request.auth != null` — 一定要經過 Firebase Authentication 登入。
- `email == "xhk1997@gmail.com"` — email 來自 Google 簽發並由 Firebase 驗章的 ID token，**不是**前端送上來的字串，偽造不了。
- `email_verified == true` — Google 帳號本來就是已驗證的，這條是為了擋掉未來萬一啟用了其他登入方式（例如 email/password）所帶來的偽冒風險。

結果：陌生人用這份公開 config 去連你的 Firestore，唯一能做的就是拿自己的 Google 帳號登入，然後每一筆讀寫都被伺服器拒絕。

### 還要注意的
- **Rules 檔案改了要部署才算數。** 見上面第 6 步。
- **Authentication 那邊不用白名單。** 任何人都可以在你的專案「登入成功」（拿到一個 auth token），這是 Firebase 的設計。資料授權完全由 Rules 負責，不是由「誰能登入」負責。
- **不要在 repo 裡放 service account 金鑰。** 那種 JSON 才是真的密鑰，它會繞過所有 Rules。這個專案完全用不到。
- 本機的 Firestore 離線快取存在瀏覽器裡（IndexedDB）。用公用電腦的話記得登出。

---

## 專案結構

```
.github/workflows/deploy.yml   GitHub Actions：測試 → build → 部署 Pages
firestore.rules                Security Rules（要另外部署，見上）
firebase.json                  給 firebase CLI 用
vite.config.ts                 base 由 BASE_PATH 帶入
vitest.config.ts               單元測試（純函式，node 環境）
src/
  firebase/config.ts           Firebase 專案設定 ← 你要填這個
  firebase/app.ts              app / auth / db 初始化（含離線快取）
  auth/allowlist.ts            前端白名單（只是 UX）
  auth/AuthProvider.tsx        登入狀態機：loading / signed-out / allowed / denied
  components/                  AppShell、登入頁、無權限頁、設定引導頁
  pages/                       五個分頁
  lib/                         純邏輯：ranking / players / format / validation
  state/SeasonProvider.tsx     目前球季的全部資料（訂閱 Firestore，排名在前端算）
  firebase/repo.ts             唯一直接碰 Firestore 的地方
  types/                       資料模型型別
```
