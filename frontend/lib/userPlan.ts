"use client";

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type UserPlan = "free" | "pro";

/** 無料プランの1日の検索上限 */
export const FREE_DAILY_LIMIT = 3;
/** 未ログインの1日の検索上限 */
export const GUEST_DAILY_LIMIT = 1;

const GUEST_SEARCH_KEY = "guest_last_search_date";

/** "YYYY-MM-DD" 形式で今日の日付を返す */
export function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

// ============================================================
// Firestore ユーザードキュメント
// ============================================================

/**
 * ログイン時に users/{uid} ドキュメントを作成する（初回のみ）。
 * Firestore エラー時はコンソールにログだけ出して呼び出し元をクラッシュさせない。
 */
export async function initUserDocument(uid: string): Promise<void> {
  try {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        plan: "free" as UserPlan,
        dailySearchCount: 0,
        lastSearchDate: getTodayString(),
        createdAt: serverTimestamp(),
      });
    }
  } catch (err) {
    // Firestore セキュリティルール未設定などで失敗しても致命的ではない
    console.error("[userPlan] initUserDocument failed:", err);
  }
}

// ============================================================
// 未ログインユーザー（localStorage）
// ============================================================

/**
 * 未ログインユーザーが本日検索可能かどうかを返す。
 * localStorage へのアクセスが禁止されている環境（Firefox プライベート等）では
 * true（許可）を返してサイレントクラッシュを防ぐ。
 */
export function checkGuestSearchAllowed(): boolean {
  try {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(GUEST_SEARCH_KEY) !== getTodayString();
  } catch {
    return true; // localStorage 利用不可の場合は検索を許可
  }
}

/** 未ログインの検索消費を記録する（失敗しても無視） */
export function recordGuestSearch(): void {
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(GUEST_SEARCH_KEY, getTodayString());
    }
  } catch {
    // 書き込み失敗は無視
  }
}

// ============================================================
// 無料ログインユーザー（Firestore）
// ============================================================

/**
 * 無料ユーザーの検索制限をチェックしてカウントをインクリメントする。
 * - allowed: 検索可能か
 * - usedCount: インクリメント後の使用回数
 *
 * Firestore エラー（権限エラー含む）が発生した場合は検索を許可してフォールバック。
 * エラーで検索できなくなるよりも、許可する方が安全側。
 */
export async function checkAndIncrementFreeSearch(
  uid: string
): Promise<{ allowed: boolean; usedCount: number }> {
  try {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    const today = getTodayString();

    let count = 0;
    if (snap.exists()) {
      const data = snap.data();
      // 日付が変わっていたらカウントをリセット
      count = data.lastSearchDate === today ? (data.dailySearchCount ?? 0) : 0;
    }

    if (count >= FREE_DAILY_LIMIT) {
      return { allowed: false, usedCount: count };
    }

    const newCount = count + 1;
    if (snap.exists()) {
      await updateDoc(ref, { dailySearchCount: newCount, lastSearchDate: today });
    } else {
      await setDoc(ref, {
        plan: "free",
        dailySearchCount: newCount,
        lastSearchDate: today,
      });
    }

    return { allowed: true, usedCount: newCount };
  } catch (err) {
    // Firestore エラー（権限不足など）→ 検索を許可してフォールバック
    console.error("[userPlan] checkAndIncrementFreeSearch failed, allowing search:", err);
    return { allowed: true, usedCount: 0 };
  }
}
