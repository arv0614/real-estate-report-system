import axios from "axios";

// ============================================================
// Open-Meteo Historical Weather API
// 直近の完全な1年（2025-01-01〜2025-12-31）の日次データを取得し、
// 年間日照時間・夏期平均最高気温・冬期平均最低気温のサマリーを返す
// ============================================================

export interface WeatherSummary {
  /** 年間累計日照時間（時間, h） */
  annualSunshineHours: number;
  /** 夏期（7〜8月）の平均最高気温（℃） */
  summerAvgMaxTemp: number;
  /** 冬期（1〜2月）の平均最低気温（℃） */
  winterAvgMinTemp: number;
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

  for (let i = 0; i < times.length; i++) {
    const date = times[i];
    if (!date) continue;
    const month = Number(date.slice(5, 7));
    const max = tMax[i];
    const min = tMin[i];

    if ((month === 7 || month === 8) && typeof max === "number" && Number.isFinite(max)) {
      summerMaxes.push(max);
    }
    if ((month === 1 || month === 2) && typeof min === "number" && Number.isFinite(min)) {
      winterMins.push(min);
    }
  }

  const summary: WeatherSummary = {
    annualSunshineHours: Math.round(annualSunshineHours * 10) / 10,
    summerAvgMaxTemp: Math.round(avg(summerMaxes) * 10) / 10,
    winterAvgMinTemp: Math.round(avg(winterMins) * 10) / 10,
  };

  console.log(
    `[Open-Meteo] (${lat}, ${lng}) sunshine=${summary.annualSunshineHours}h, ` +
    `summerMax=${summary.summerAvgMaxTemp}℃, winterMin=${summary.winterAvgMinTemp}℃`
  );

  return summary;
}
