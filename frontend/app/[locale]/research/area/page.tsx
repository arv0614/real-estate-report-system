import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AreaPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const sp = searchParams ? await searchParams : {};

  const urlParams = new URLSearchParams();
  if (typeof sp.lat  === "string") urlParams.set("lat",  sp.lat);
  if (typeof sp.lng  === "string") urlParams.set("lng",  sp.lng);
  if (typeof sp.type === "string") urlParams.set("type", sp.type);
  urlParams.set("action", "area");

  redirect(`/${locale}/research?${urlParams.toString()}`);
}
