import { latLngToTile, buildCacheKey, tileToLatLng } from "./tile";

describe("latLngToTile", () => {
  it("葛飾区周辺（zoom=15）のタイル座標を正しく計算する", () => {
    const { x, y, z } = latLngToTile(35.74, 139.86, 15);
    // zoom15での東京東部の期待値（lat=35.74, lng=139.86）
    expect(z).toBe(15);
    expect(x).toBe(29114);
    expect(y).toBe(12896);
  });

  it("zoom=0では常に (0,0) になる", () => {
    const { x, y } = latLngToTile(35.74, 139.86, 0);
    expect(x).toBe(0);
    expect(y).toBe(0);
  });
});

describe("buildCacheKey", () => {
  it("正しい形式のキャッシュキーを生成する", () => {
    const key = buildCacheKey(35.74, 139.86, 15);
    expect(key).toMatch(/^z\d+\/x\d+\/y\d+$/);
    expect(key).toBe("z15/x29114/y12896");
  });

  it("デフォルトzoomは15", () => {
    const key = buildCacheKey(35.74, 139.86);
    expect(key).toContain("z15");
  });
});

describe("tileToLatLng", () => {
  it("タイル座標から緯度経度に変換できる", () => {
    const { lat, lng } = tileToLatLng(29114, 12896, 15);
    // 変換後は元の座標のタイル内に収まるはず（誤差許容）
    expect(lat).toBeCloseTo(35.74, 0);
    expect(lng).toBeCloseTo(139.86, 0);
  });
});
