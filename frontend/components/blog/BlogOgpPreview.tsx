import { getTranslations } from "next-intl/server";

interface Props {
  title: string;
  description: string;
  imageUrl: string;
  pageUrl: string;
}

// Twitter/Facebook の summary_large_image 風カード。記事末尾でシェア時の見栄えを
// プレビューする UI。Server Component で完結する (クリック動作なし)。
export default async function BlogOgpPreview({ title, description, imageUrl, pageUrl }: Props) {
  const t = await getTranslations("Blog");
  let host = "mekiki-research.com";
  try {
    host = new URL(pageUrl).host;
  } catch {
    // pageUrl が空など想定外: デフォルトドメインのまま
  }

  return (
    <section className="mt-12 border-t border-slate-200 pt-8">
      <h2 className="text-base font-bold text-slate-800 mb-1">{t("ogPreviewTitle")}</h2>
      <p className="text-xs text-slate-500 mb-4">{t("ogPreviewHint")}</p>

      <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={title}
          width={1200}
          height={630}
          loading="lazy"
          decoding="async"
          className="block w-full aspect-[1200/630] object-cover bg-slate-100"
        />
        <div className="px-4 py-3 border-t border-slate-200">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">{host}</p>
          <p className="mt-1 text-sm font-semibold text-slate-900 line-clamp-2 leading-snug">
            {title}
          </p>
          <p className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </section>
  );
}
