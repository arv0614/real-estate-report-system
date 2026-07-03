import { describe, it, expect } from "vitest";
import type { ResearchSessionData } from "@/lib/researchHistory";

// ── ResearchSessionData 後方互換性テスト ──────────────────────────────────────
// Firestore の research_sessions コレクションには P2 以前の mansion/house セッションが
// 存在する。それらは builtYear を持つが propertyType や森林固有フィールドを持たない。
// 逆に、P2 以降の forest セッションは builtYear を持たない。
// 両方が同一の型定義に収まることをコンパイル時 + ランタイムで確認する。

describe("ResearchSessionData backward compatibility", () => {
  it("旧 mansion セッション（builtYear あり / propertyType なし）が型に適合する", () => {
    const legacyMansion: ResearchSessionData = {
      address: "東京都千代田区丸の内1-1",
      lat: 35.6812,
      lng: 139.7671,
      price: 5000,
      area: 70,
      builtYear: 2005,
      mode: "home",
      // propertyType は absent (U9 以前のデータ)
    };
    expect(legacyMansion.builtYear).toBe(2005);
    expect(legacyMansion.propertyType).toBeUndefined();
  });

  it("旧 house セッション（builtYear あり / propertyType=house）が型に適合する", () => {
    const houseSession: ResearchSessionData = {
      address: "大阪府大阪市北区梅田1-1",
      lat: 34.7024,
      lng: 135.4959,
      price: 3500,
      area: 100,
      builtYear: 1998,
      mode: "investment",
      propertyType: "house",
    };
    expect(houseSession.builtYear).toBe(1998);
    expect(houseSession.propertyType).toBe("house");
  });

  it("P2 forest セッション（builtYear なし）が型に適合する", () => {
    const forestSession: ResearchSessionData = {
      address: "長野県松本市梓川1",
      lat: 36.2048,
      lng: 137.9720,
      price: 200,
      area: 5000,
      // builtYear は意味がないので省略
      mode: "home",
      propertyType: "forest",
    };
    expect(forestSession.builtYear).toBeUndefined();
    expect(forestSession.propertyType).toBe("forest");
  });

  it("farmland セッション（builtYear なし）が型に適合する", () => {
    const farmlandSession: ResearchSessionData = {
      address: "北海道上川郡美瑛町1",
      lat: 43.5924,
      lng: 142.4738,
      price: 150,
      area: 10000,
      mode: "investment",
      propertyType: "farmland",
    };
    expect(farmlandSession.builtYear).toBeUndefined();
    expect(farmlandSession.propertyType).toBe("farmland");
  });

  it("Firestore から読み込んだ旧ドキュメント (unknown) を ResearchSessionData にキャストできる", () => {
    // Firestore SDK は doc.data() を型なし object として返す。
    // 旧ドキュメントは builtYear を持つが propertyType は未定義。
    const firestoreDoc: Record<string, unknown> = {
      address: "神奈川県横浜市中区1",
      lat: 35.4437,
      lng: 139.6380,
      price: 4500,
      area: 65,
      builtYear: 2010,
      mode: "home",
    };

    // ランタイムキャスト（実際のアプリと同じ方法）
    const session = firestoreDoc as unknown as ResearchSessionData;

    expect(session.builtYear).toBe(2010);
    expect(session.propertyType).toBeUndefined();
    expect(typeof session.price).toBe("number");
  });

  it("Firestore から読み込んだ P2 forest ドキュメント (builtYear なし) を安全に扱える", () => {
    const firestoreDoc: Record<string, unknown> = {
      address: "岐阜県高山市荘川町1",
      lat: 36.1234,
      lng: 137.0987,
      price: 300,
      area: 8000,
      mode: "home",
      propertyType: "forest",
    };

    const session = firestoreDoc as unknown as ResearchSessionData;

    // builtYear が undefined でも安全にアクセスできる
    const year = session.builtYear ?? null;
    expect(year).toBeNull();
    expect(session.propertyType).toBe("forest");
  });
});
