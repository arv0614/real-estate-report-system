/**
 * /[locale]/mcp-guide — 外部AI連携（MCP）セットアップガイド
 * APIキー発行 → Claude Desktop / ChatGPT の設定 → プロンプト例 を解説する。
 */
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getApiBase } from "@/lib/api";
import { FREE_DAILY_LIMIT } from "@/lib/limits";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://mekiki-research.com";

/** MCP 経由・Free プランの1日のツール呼び出し上限（Web版無料上限の10倍） */
const MCP_FREE_DAILY_LIMIT = FREE_DAILY_LIMIT * 10;

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "McpGuide" });
  const path = locale === "ja" ? "/mcp-guide" : `/${locale}/mcp-guide`;
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: `${SITE_URL}${path}` },
  };
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
      <code>{children}</code>
    </pre>
  );
}

export default async function McpGuidePage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "McpGuide" });

  const lp = locale === "ja" ? "" : `/${locale}`;
  const homeHref = lp || "/";
  const profileHref = `${lp}/profile`;

  const sseUrl = `${getApiBase()}/api/mcp/sse`;

  const claudeConfig = `{
  "mcpServers": {
    "mekiki-research": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "${sseUrl}",
        "--header",
        "Authorization: Bearer \${MEKIKI_MCP_KEY}"
      ],
      "env": {
        "MEKIKI_MCP_KEY": "mkr_live_xxxxxxxxxxxxxxxx"
      }
    }
  }
}`;

  const prompts = [t("prompt1"), t("prompt2"), t("prompt3")];

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <div className="mb-6">
          <Link
            href={homeHref}
            className="text-sm text-slate-500 transition-colors hover:text-slate-700"
          >
            {t("backHome")}
          </Link>
        </div>

        <header className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800 sm:text-3xl">{t("title")}</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{t("intro")}</p>
        </header>

        {/* 対応クライアントの案内（Claude / ChatGPT 完全対応、Gemini は待ち） */}
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-900">{t("clientsTitle")}</p>
          <p className="mt-1 text-sm leading-relaxed text-blue-800">{t("clientsBody")}</p>
        </div>

        <div className="space-y-6">
          {/* Step 1: APIキーの発行 */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-800">{t("step1Title")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{t("step1Body")}</p>
            <Link
              href={profileHref}
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              {t("step1Cta")}
            </Link>
          </section>

          {/* 接続情報 */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-800">{t("connTitle")}</h2>
            <dl className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-slate-50 text-sm">
              <div className="px-3 py-2">
                <dt className="text-xs font-medium text-slate-500">{t("connEndpoint")}</dt>
                <dd className="mt-0.5 break-all font-mono text-xs text-slate-700">{sseUrl}</dd>
              </div>
              <div className="px-3 py-2">
                <dt className="text-xs font-medium text-slate-500">{t("connHeader")}</dt>
                <dd className="mt-0.5 break-all font-mono text-xs text-slate-700">
                  Authorization: Bearer &lt;API_KEY&gt;
                </dd>
              </div>
            </dl>
          </section>

          {/* Step 2: Claude Desktop */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-800">{t("step2Title")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{t("step2Body")}</p>
            <p className="mt-3 text-xs font-medium text-slate-500">
              {t("step2ConfigPath")}
            </p>
            <CodeBlock>{claudeConfig}</CodeBlock>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">{t("step2Note")}</p>
          </section>

          {/* Step 3: ChatGPT (GPTs) */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-800">{t("step3Title")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{t("step3Body")}</p>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-slate-600">
              <li>{t("step3li1")}</li>
              <li>{t("step3li2")}</li>
              <li>{t("step3li3")}</li>
              <li>{t("step3li4")}</li>
            </ol>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">{t("step3Note")}</p>
          </section>

          {/* Step 4: プロンプト例 */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-800">{t("step4Title")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{t("step4Body")}</p>
            <ul className="mt-3 space-y-2">
              {prompts.map((p, i) => (
                <li
                  key={i}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                >
                  💬 {p}
                </li>
              ))}
            </ul>
          </section>

          {/* 利用回数の目安 */}
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-6">
            <h2 className="text-lg font-semibold text-amber-900">{t("limitsTitle")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-amber-800">
              {t("limitsBody", { limit: MCP_FREE_DAILY_LIMIT })}
            </p>
          </section>
        </div>

        <div className="mt-8 border-t border-slate-200 pt-6">
          <Link
            href={profileHref}
            className="text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
          >
            {t("footerProfileLink")}
          </Link>
        </div>
      </div>
    </main>
  );
}
