/**
 * ga4_config.js
 *
 * SEO / 広告 / 無料転換レポートが参照する GA4 プロパティの識別子を一箇所に集約する。
 * 参照先は GA4 プロパティ「Mekiki-Research - GA4」:
 *   - プロパティID: 312222045（Data API / Admin API の `properties/312222045`）
 *   - 測定ID:       G-4Y1CLF7J2P
 *
 * 環境変数 GA4_PROPERTY_ID / GA4_MEASUREMENT_ID を設定した場合はそちらが優先される
 * （別プロパティでの検証用）。未設定時に古いプロパティを参照しないよう、既定値を
 * 各スクリプトに直書きせずこのファイルで管理する。
 */

const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID || "312222045";
const GA4_MEASUREMENT_ID = process.env.GA4_MEASUREMENT_ID || "G-4Y1CLF7J2P";

module.exports = { GA4_PROPERTY_ID, GA4_MEASUREMENT_ID };
