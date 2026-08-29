/**
 * 利用回数制限の定数（サーバー／クライアント両用・"use client" を付けない）
 *
 * `userPlan.ts` は "use client" モジュールのため、サーバーコンポーネントから
 * 定数を import すると値がクライアント参照プロキシに置き換わり `NaN` 等になる。
 * サーバー側（例: /[locale]/mcp-guide）でも使う定数はここに置く。
 *
 * バックエンドの `backend/src/constants/limits.ts` と必ず同値に保つこと。
 */

/** 無料ログインユーザーの1日の検索上限（通常時） */
export const FREE_DAILY_LIMIT = 3;

/** 未ログイン（ゲスト）ユーザーの1日の検索上限 */
export const GUEST_DAILY_LIMIT = 1;
