/**
 * 前端白名單。
 *
 * ⚠️ 這只是「使用者體驗」：讓不該進來的人看到明確的提示，而不是一堆權限錯誤。
 * 它擋不住有心人（任何人都能改自己瀏覽器裡的 JS）。
 * 真正的防線是 Firestore Security Rules，那是在 Google 伺服器端執行的。
 */
export const ALLOWED_EMAILS = ['xhk1997@gmail.com'] as const

export function isAllowed(email: string | null | undefined, emailVerified: boolean): boolean {
  if (!email || !emailVerified) return false
  const normalized = email.trim().toLowerCase()
  return ALLOWED_EMAILS.some((allowed) => allowed.toLowerCase() === normalized)
}
