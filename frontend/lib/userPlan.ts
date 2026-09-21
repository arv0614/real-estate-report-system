"use client";

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
// 検索上限の定数は "use client" を持たない ./limits に集約（サーバー側からも import 可能）。
// このモジュール内でも使うため import しつつ、既存の参照経路（`@/lib/userPlan`）を壊さないよう再エクスポートする。
import { FREE_DAILY_LIMIT, GUEST_DAILY_LIMIT } from "./limits";

export { FREE_DAILY_LIMIT, GUEST_DAILY_LIMIT };

export type UserPlan = "free" | "pro";

/**
 * Pro プラン向けホワイトラベル設定（PDFヘッダーの社名・ロゴ差し替え）
 * Firestore の users/{uid} ドキュメントに直接保存される。
 */
export interface WhiteLabelConfig {
  companyName: string;
  companyLogoUrl: string;
}

export const EMPTY_WHITE_LABEL: WhiteLabelConfig = {
  companyName: "",
  companyLogoUrl: "",
};

/** users/{uid} からホワイトラベル設定を取得。未設定なら空文字を返す。 */
export async function getWhiteLabelConfig(uid: string): Promise<WhiteLabelConfig> {
  try {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return EMPTY_WHITE_LABEL;
    const data = snap.data();
    return {
      companyName: typeof data.companyName === "string" ? data.companyName : "",
      companyLogoUrl: typeof data.companyLogoUrl === "string" ? data.companyLogoUrl : "",
    };
  } catch (err) {
    console.error("[userPlan] getWhiteLabelConfig failed:", err);
    return EMPTY_WHITE_LABEL;
  }
}

/**
 * users/{uid} にホワイトラベル設定を書き込む。
 * Firestore ルール上、plan / lemonSqueezy 系以外のフィールドは本人のみ書き込み可能。
 */
export async function saveWhiteLabelConfig(
  uid: string,
  config: WhiteLabelConfig
): Promise<void> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await updateDoc(ref, {
      companyName: config.companyName,
      companyLogoUrl: config.companyLogoUrl,
    });
  } else {
    await setDoc(ref, {
      plan: "free",
      dailySearchCount: 0,
      lastSearchDate: getTodayString(),
      companyName: config.companyName,
      companyLogoUrl: config.companyLogoUrl,
    });
  }
}

/**
 * Freeプラン 検索無制限キャンペーンフラグ
 * true の間、Free ユーザーの回数制限チェックをバイパスする。
 * Firestore への回数記録は継続。
 */
export const IS_FREE_UNLIMITED_CAMPAIGN = true;

const GUEST_SEARCH_KEY = "guest_search_count";
const GUEST_SEARCH_DATE_KEY = "guest_search_date";

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
    const today = getTodayString();
    const savedDate = localStorage.getItem(GUEST_SEARCH_DATE_KEY);
    if (savedDate !== today) return true; // 日付が変わっていたら許可
    const count = parseInt(localStorage.getItem(GUEST_SEARCH_KEY) ?? "0", 10);
    return count < GUEST_DAILY_LIMIT;
  } catch {
    return true; // localStorage 利用不可の場合は検索を許可
  }
}

/** 今日のゲスト検索回数を返す（recordGuestSearch 後に呼ぶと最新値が取れる） */
export function getGuestSearchCountToday(): number {
  try {
    if (typeof window === "undefined") return 0;
    const today = getTodayString();
    const savedDate = localStorage.getItem(GUEST_SEARCH_DATE_KEY);
    if (savedDate !== today) return 0;
    return parseInt(localStorage.getItem(GUEST_SEARCH_KEY) ?? "0", 10);
  } catch {
    return 0;
  }
}

/** 未ログインの検索消費を記録する（失敗しても無視） */
export function recordGuestSearch(): void {
  try {
    if (typeof window !== "undefined") {
      const today = getTodayString();
      const savedDate = localStorage.getItem(GUEST_SEARCH_DATE_KEY);
      const current = savedDate === today
        ? parseInt(localStorage.getItem(GUEST_SEARCH_KEY) ?? "0", 10)
        : 0;
      localStorage.setItem(GUEST_SEARCH_DATE_KEY, today);
      localStorage.setItem(GUEST_SEARCH_KEY, String(current + 1));
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
      await updateDoc(ref, {
        dailySearchCount: newCount,
        lastSearchDate: today,
        totalSearchCount: increment(1),
      });
    } else {
      await setDoc(ref, {
        plan: "free",
        dailySearchCount: newCount,
        lastSearchDate: today,
        totalSearchCount: 1,
      });
    }

    return { allowed: true, usedCount: newCount };
  } catch (err) {
    // Firestore エラー（権限不足など）→ 検索を許可してフォールバック
    console.error("[userPlan] checkAndIncrementFreeSearch failed, allowing search:", err);
    return { allowed: true, usedCount: 0 };
  }
}

/**
 * Pro プラン（回数無制限）ユーザーの検索を記録する。上限チェックは行わない。
 * 当日カウント（dailySearchCount / lastSearchDate）と累積（totalSearchCount）を更新する。
 * マイページ・/admin の利用状況表示のために、無制限でも回数を残す。
 * Firestore エラーは握りつぶす（検索の妨げにしない）。
 */
export async function recordProSearch(uid: string): Promise<number> {
  try {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    const today = getTodayString();

    let count = 0;
    if (snap.exists()) {
      const data = snap.data();
      count = data.lastSearchDate === today ? (data.dailySearchCount ?? 0) : 0;
    }
    const newCount = count + 1;

    if (snap.exists()) {
      await updateDoc(ref, {
        dailySearchCount: newCount,
        lastSearchDate: today,
        totalSearchCount: increment(1),
      });
    } else {
      await setDoc(ref, {
        plan: "free",
        dailySearchCount: newCount,
        lastSearchDate: today,
        totalSearchCount: 1,
      });
    }
    return newCount;
  } catch (err) {
    console.error("[userPlan] recordProSearch failed (ignored):", err);
    return 0;
  }
}

// ============================================================
// AI建築・こだわり条件（lifestylePreferences）
// ============================================================

/** 保存できるこだわり条件タグの上限。UI（TagInput）とバックエンドの zod 制約に合わせる */
export const MAX_LIFESTYLE_TAGS = 12;
/** 1タグあたりの最大文字数 */
export const MAX_LIFESTYLE_TAG_LENGTH = 40;

/** 未知の値を「トリム済み・重複なし・上限内の文字列配列」に正規化する */
function normalizeLifestyleTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const tag = item.trim().slice(0, MAX_LIFESTYLE_TAG_LENGTH);
    if (!tag || result.includes(tag)) continue;
    result.push(tag);
    if (result.length >= MAX_LIFESTYLE_TAGS) break;
  }
  return result;
}

/**
 * users/{uid} の lifestylePreferences（AI建築・こだわり条件）を取得する。
 * 未設定・取得失敗時は空配列を返し、呼び出し元をクラッシュさせない。
 */
export async function getLifestylePreferences(uid: string): Promise<string[]> {
  try {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return [];
    return normalizeLifestyleTags(snap.data().lifestylePreferences);
  } catch (err) {
    console.error("[userPlan] getLifestylePreferences failed:", err);
    return [];
  }
}

/**
 * users/{uid} に lifestylePreferences を書き込む。
 * ドキュメント未作成のユーザーでも保存できるよう、無ければ初期値付きで作成する。
 */
export async function saveLifestylePreferences(
  uid: string,
  tags: string[]
): Promise<void> {
  const lifestylePreferences = normalizeLifestyleTags(tags);
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await updateDoc(ref, { lifestylePreferences });
  } else {
    await setDoc(ref, {
      plan: "free",
      dailySearchCount: 0,
      lastSearchDate: getTodayString(),
      lifestylePreferences,
    });
  }
}
