import { z } from "zod";

const currentYear = new Date().getFullYear();

/** Convert empty string / null / undefined to undefined for optional numeric fields */
const toOptionalNum = (v: unknown) => (!v && v !== 0 ? undefined : v);

export const PropertyInputSchema = z.object({
  address: z
    .string()
    .max(200, "住所が長すぎます")
    .default(""),

  price: z.preprocess(
    toOptionalNum,
    z.coerce
      .number()
      .int("価格は整数（万円）で入力してください")
      .positive("価格を入力してください")
      .max(999_999, "入力値が大きすぎます")
      .optional()
  ),

  area: z.preprocess(
    toOptionalNum,
    z.coerce
      .number()
      .positive("専有面積は0より大きい値で入力してください")
      .max(9999, "入力値が大きすぎます")
      .transform((v) => Math.round(v * 100) / 100)
      .optional()
  ),

  builtYear: z.preprocess(
    toOptionalNum,
    z.coerce
      .number()
      .int("建築年は整数で入力してください")
      .min(1900, "建築年が正しくありません（1900年以降）")
      .max(currentYear, `建築年は${currentYear}年以前で入力してください`)
      .optional()
  ),

  mode: z.enum(["home", "investment"]),

  coordOverride: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .optional(),

  autoFilled: z
    .object({
      price:     z.boolean().optional(),
      area:      z.boolean().optional(),
      builtYear: z.boolean().optional(),
    })
    .optional(),
});

export type PropertyInputValidated = z.output<typeof PropertyInputSchema>;
