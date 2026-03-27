"use client";

import { useState } from "react";
import { fetchTransactions, calcSummary } from "@/lib/api";
import type { TransactionApiResponse } from "@/types/api";
import { SearchForm } from "@/components/SearchForm";
import { SourceBadge } from "@/components/SourceBadge";
import { SummaryCards } from "@/components/SummaryCards";
import { TransactionTable } from "@/components/TransactionTable";

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TransactionApiResponse | null>(null);

  async function handleSearch(lat: number, lng: number) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await fetchTransactions(lat, lng);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "不明なエラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  const summary = result ? calcSummary(result.data.data) : null;
  const firstRecord = result?.data.data[0];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <span className="text-2xl">🏠</span>
          <div>
            <h1 className="text-xl font-bold text-slate-800 leading-tight">
              不動産価値・リスク診断レポート
            </h1>
            <p className="text-xs text-slate-500">
              国土交通省「不動産情報ライブラリ」データを活用 — β版
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* 入力フォーム */}
        <SearchForm onSearch={handleSearch} loading={loading} />

        {/* エラー */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            ⚠️ {error}
          </div>
        )}

        {/* ローディング */}
        {loading && (
          <div className="rounded-xl border border-slate-200 bg-white py-16 text-center text-slate-500">
            <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="font-medium">データを取得中...</p>
            <p className="text-sm text-slate-400 mt-1">
              初回は国土交通省APIへのリクエストが発生します（数秒かかります）
            </p>
          </div>
        )}

        {/* 結果エリア */}
        {result && summary && (
          <div className="space-y-5">
            {/* ステータスバー */}
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 bg-white rounded-lg border border-slate-200 px-4 py-3">
              <SourceBadge source={result.source} />
              <span className="text-slate-300">|</span>
              {firstRecord && (
                <span>
                  対象エリア:{" "}
                  <strong className="text-slate-800">
                    {firstRecord.prefecture} {firstRecord.municipality}
                  </strong>
                  （市区町村コード: {result.data.cityCode}）
                </span>
              )}
              <span className="text-slate-300">|</span>
              <span>対象年: <strong className="text-slate-800">{result.data.year}年</strong></span>
              {result.expiresAt && (
                <>
                  <span className="text-slate-300">|</span>
                  <span className="text-xs text-slate-400">
                    キャッシュ期限: {new Date(result.expiresAt).toLocaleDateString("ja-JP")}
                  </span>
                </>
              )}
            </div>

            {/* サマリーカード */}
            <SummaryCards summary={summary} />

            {/* データテーブル */}
            <TransactionTable records={result.data.data} />
          </div>
        )}

        {/* 初期状態 */}
        {!result && !loading && !error && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-slate-400">
            <p className="text-4xl mb-3">🗾</p>
            <p className="font-medium text-slate-500">
              緯度・経度を入力して「診断開始」を押してください
            </p>
            <p className="text-sm mt-1">
              国交省データベースから周辺の不動産取引情報を取得します
            </p>
          </div>
        )}
      </main>

      <footer className="mt-8 border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        データソース: 国土交通省「不動産情報ライブラリ」 /
        キャッシュ: Google Cloud Storage (TTL 30日)
      </footer>
    </div>
  );
}
