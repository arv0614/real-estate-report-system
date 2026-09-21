/**
 * 外観生成が「間取り図画像を参照画像として受け取る Image-to-Image」になっているかを検証する。
 *
 * Gemini の画像モデルは Imagen の :predict のような専用フィールドではなく、
 * contents[].parts に inlineData(base64) を並べる形で参照画像を受け取る。
 * ここでは SDK をモックして、実際に送られるリクエストの形を確認する。
 */

const generateContentMock = jest.fn();

jest.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: () => ({ generateContent: generateContentMock }),
  })),
}));

jest.mock("../config", () => ({
  config: { gemini: { apiKey: "test-key" } },
}));

import { generateHouseImages } from "./imagenApi";

type Part = { text?: string; inlineData?: { mimeType: string; data: string } };
type Call = { contents: { role: string; parts: Part[] }[] };

/** n 回目の generateContent 呼び出しの parts を返す */
function partsOf(callIndex: number): Part[] {
  const [arg] = generateContentMock.mock.calls[callIndex] as [Call];
  return arg.contents[0].parts;
}

function imageResponse(data: string) {
  return {
    response: {
      candidates: [{ content: { parts: [{ inlineData: { data, mimeType: "image/png" } }] } }],
    },
  };
}

const AREA = { prefecture: "東京都", municipality: "江戸川区" };

describe("generateHouseImages: floor plan first, then exterior with the plan as reference", () => {
  beforeEach(() => {
    generateContentMock.mockReset();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("generates the floor plan first and feeds it to the exterior call as inlineData", async () => {
    generateContentMock
      // Stage1（プロンプト生成）は JSON ではなく素のテキストを返させ、静的フォールバックに倒す
      .mockResolvedValueOnce({ response: { text: () => "not json" } })
      .mockResolvedValueOnce(imageResponse("FLOORPLAN_B64"))
      .mockResolvedValueOnce(imageResponse("EXTERIOR_B64"));

    const result = await generateHouseImages(AREA, ["駐車場2台"]);

    expect(generateContentMock).toHaveBeenCalledTimes(3);

    // 2回目 = 間取り図。参照画像なし（テキストのみ）
    const planParts = partsOf(1);
    expect(planParts.filter((p) => p.inlineData)).toHaveLength(0);
    expect(planParts[0].text).toContain("floor plan");

    // 3回目 = 外観。間取り図の base64 が inlineData として添付されている
    const exteriorParts = partsOf(2);
    const attached = exteriorParts.filter((p) => p.inlineData);
    expect(attached).toHaveLength(1);
    expect(attached[0].inlineData).toEqual({ mimeType: "image/png", data: "FLOORPLAN_B64" });

    // 添付画像の用途（下絵であって図面を模写させない）を指示している
    expect(exteriorParts[0].text).toContain("The attached image is the 2D floor plan");
    expect(exteriorParts[0].text).toContain("photorealistic exterior photograph");

    expect(result.floorPlan.imageBase64).toBe("FLOORPLAN_B64");
    expect(result.exterior.imageBase64).toBe("EXTERIOR_B64");
  });

  it("falls back to a text-only exterior when every model rejects the reference image", async () => {
    generateContentMock
      .mockResolvedValueOnce({ response: { text: () => "not json" } })
      .mockResolvedValueOnce(imageResponse("FLOORPLAN_B64"))
      // 参照画像つきは primary / fallback 両モデルとも失敗させる
      .mockRejectedValueOnce(new Error("reference image rejected"))
      .mockRejectedValueOnce(new Error("reference image rejected"))
      .mockResolvedValueOnce(imageResponse("EXTERIOR_TEXT_ONLY"));

    const result = await generateHouseImages(AREA, []);

    // 最後の呼び出しは参照画像なしで再試行されている
    const lastParts = partsOf(generateContentMock.mock.calls.length - 1);
    expect(lastParts.filter((p) => p.inlineData)).toHaveLength(0);
    expect(result.exterior.imageBase64).toBe("EXTERIOR_TEXT_ONLY");
    expect(result.floorPlan.imageBase64).toBe("FLOORPLAN_B64");
  });
});
