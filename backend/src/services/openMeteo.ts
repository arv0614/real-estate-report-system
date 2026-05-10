import axios from "axios";

// ============================================================
// Open-Meteo Historical Weather API
// 直近の完全な1年（2025-01-01〜2025-12-31）の日次データを取得し、
// 年間日照時間・夏期平均最高気温・冬期平均最低気温のサマリーを返す
// ============================================================

export interface WeatherMonthly {
  /** 月（1〜12） */
  month: number;
  /** 当該月の日次最高気温の平均（℃, 小数1桁） */
  avgMaxTemp: number;
  /** 当該月の日次最低気温の平均（℃, 小数1桁） */
  avgMinTemp: number;
  /** 当該月の累計日照時間（h, 小数1桁） */
  sunshineHours: number;
}

export interface WeatherSummary {
  /** 年間累計日照時間（時間, h） */
  annualSunshineHours: number;
  /** 夏期（7〜8月）の平均最高気温（℃） */
  summerAvgMaxTemp: number;
  /** 冬期（1〜2月）の平均最低気温（℃） */
  winterAvgMinTemp: number;
  /** 月別の気温・日照時間（1月〜12月） */
  monthly: WeatherMonthly[];
}

interface OpenMeteoResponse {
  daily?: {
    time?: string[];
    temperature_2m_max?: Array<number | null>;
    temperature_2m_min?: Array<number | null>;
    sunshine_duration?: Array<number | null>;
  };
}

const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";
const START_DATE = "2025-01-01";
const END_DATE = "2025-12-31";

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * 指定座標の Open-Meteo Historical Weather を取得し、
 * 年間サマリーを算出して返す。失敗時は呼び出し側で null として扱う。
 */
export async function fetchWeatherSummary(
  lat: number,
  lng: number
): Promise<WeatherSummary> {
  const response = await axios.get<OpenMeteoResponse>(ARCHIVE_URL, {
    params: {
      latitude: lat,
      longitude: lng,
      start_date: START_DATE,
      end_date: END_DATE,
      daily: "temperature_2m_max,temperature_2m_min,sunshine_duration",
      timezone: "Asia/Tokyo",
    },
    timeout: 15000,
  });

  const daily = response.data.daily;
  if (!daily || !daily.time || daily.time.length === 0) {
    throw new Error("Open-Meteo response missing daily data");
  }

  const times = daily.time;
  const tMax = daily.temperature_2m_max ?? [];
  const tMin = daily.temperature_2m_min ?? [];
  const sun = daily.sunshine_duration ?? [];

  // 年間日照時間（秒 → 時間）
  const sunshineSecondsTotal = sun.reduce<number>(
    (acc, v) => acc + (typeof v === "number" && Number.isFinite(v) ? v : 0),
    0
  );
  const annualSunshineHours = sunshineSecondsTotal / 3600;

  // 夏期（7・8月）の最高気温平均
  const summerMaxes: number[] = [];
  // 冬期（1・2月）の最低気温平均
  const winterMins: number[] = [];

  // 月別バケット（1〜12月）
  const monthlyMax: number[][] = Array.from({ length: 12 }, () => []);
  const monthlyMin: number[][] = Array.from({ length: 12 }, () => []);
  const monthlySun: number[] = Array.from({ length: 12 }, () => 0);

  for (let i = 0; i < times.length; i++) {
    const date = times[i];
    if (!date) continue;
    const month = Number(date.slice(5, 7));
    if (month < 1 || month > 12) continue;
    const idx = month - 1;
    const max = tMax[i];
    const min = tMin[i];
    const sec = sun[i];

    if (typeof max === "number" && Number.isFinite(max)) {
      monthlyMax[idx].push(max);
      if (month === 7 || month === 8) summerMaxes.push(max);
    }
    if (typeof min === "number" && Number.isFinite(min)) {
      monthlyMin[idx].push(min);
      if (month === 1 || month === 2) winterMins.push(min);
    }
    if (typeof sec === "number" && Number.isFinite(sec)) {
      monthlySun[idx] += sec;
    }
  }

  const round1 = (v: number) => Math.round(v * 10) / 10;
  const monthly: WeatherMonthly[] = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    avgMaxTemp: round1(avg(monthlyMax[i])),
    avgMinTemp: round1(avg(monthlyMin[i])),
    sunshineHours: round1(monthlySun[i] / 3600),
  }));

  const summary: WeatherSummary = {
    annualSunshineHours: round1(annualSunshineHours),
    summerAvgMaxTemp: round1(avg(summerMaxes)),
    winterAvgMinTemp: round1(avg(winterMins)),
    monthly,
  };

  console.log(
    `[Open-Meteo] (${lat}, ${lng}) sunshine=${summary.annualSunshineHours}h, ` +
    `summerMax=${summary.summerAvgMaxTemp}℃, winterMin=${summary.winterAvgMinTemp}℃, ` +
    `monthly=${monthly.length} pts`
  );

  return summary;
}
