export const GA_MEASUREMENT_ID = "G-MF8SLJ81D2";

interface GtagEventParams {
  action: string;
  category: string;
  label?: string;
  value?: number;
}

export function gtagEvent({ action, category, label, value }: GtagEventParams) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", action, {
    event_category: category,
    ...(label !== undefined && { event_label: label }),
    ...(value !== undefined && { value }),
  });
}
