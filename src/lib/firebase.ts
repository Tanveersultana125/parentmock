// ─────────────────────────────────────────────────────────────────────────────
// FIREBASE STUBBED OUT — this dashboard is a mock/demo build.
//
// No Firebase app is initialised, no API key is read from the env, and no
// network calls go to Google. The original module exported `auth`, `db`,
// `storage`, and `functions`; we keep those names so existing imports compile,
// but each one is `null`. Callers that actually try to talk to Firestore /
// Functions are guarded to bail out and use mock data instead — see
// `useSchoolSettings`, `useInsights`, `useLeaderboard`, `callAI`, and
// `ai-controller`.
// ─────────────────────────────────────────────────────────────────────────────

export const auth: any = null;
export const db: any = null;
export const storage: any = null;
export const functions: any = null;

export default null as any;
