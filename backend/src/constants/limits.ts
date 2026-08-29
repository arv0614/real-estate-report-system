/**
 * 利用回数制限の定数（バックエンド共有）
 *
 * Web版（フロントエンド）の制限は `frontend/lib/userPlan.ts` にクライアント側実装があり、
 * バックエンドとは別ビルドのため値を import で共有できない。**両者は必ず同値に保つこと。**
 */

/** Web版：無料ログインユーザーの 1日あたり検索上限（通常時） */
export const FREE_DAILY_LIMIT = 3;

/** Web版：未ログイン（ゲスト）ユーザーの 1日あたり検索上限 */
export const GUEST_DAILY_LIMIT = 1;

/**
 * MCP 経由（外部LLM連携）の Free プラン 1日あたりツール呼び出し上限。
 * ハードコードせず「Web版上限 × 10」で算出する。Web版の上限を変えれば追随する。
 */
export const MCP_FREE_DAILY_LIMIT = FREE_DAILY_LIMIT * 10;
