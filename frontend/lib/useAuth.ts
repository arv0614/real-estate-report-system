"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import { onSnapshot, doc } from "firebase/firestore";
import { auth, db } from "./firebase";
import type { UserPlan } from "./userPlan";
import { initUserDocument } from "./userPlan";

export interface AuthState {
  user: User | null;
  loading: boolean;
  /** ユーザープラン。未ログイン=null, Firestoreロード中=null, ロード後="free"|"pro" */
  plan: UserPlan | null;
  /** plan が Firestore からまだ届いていない間 true */
  planLoading: boolean;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<UserPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);

  // Auth 状態の監視
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(false);
      if (!u) {
        setPlan(null);
        setPlanLoading(false);
        return;
      }
      // 初回ログイン時にユーザードキュメントを作成
      await initUserDocument(u.uid).catch((e) =>
        console.error("[useAuth] initUserDocument failed:", e)
      );
    });
    return unsubAuth;
  }, []);

  // Firestore のプランをリアルタイムで購読
  useEffect(() => {
    if (!user) {
      setPlan(null);
      setPlanLoading(false);
      return;
    }
    setPlanLoading(true);
    const ref = doc(db, "users", user.uid);
    const unsubDoc = onSnapshot(
      ref,
      (snap) => {
        setPlan(snap.exists() ? ((snap.data().plan as UserPlan) ?? "free") : "free");
        setPlanLoading(false);
      },
      (err) => {
        console.error("[useAuth] plan snapshot error:", err);
        setPlan("free"); // フォールバック
        setPlanLoading(false);
      }
    );
    return unsubDoc;
  }, [user?.uid]);

  return { user, loading, plan, planLoading };
}
