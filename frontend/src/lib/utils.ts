import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

const MONEY_FORMATTER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return MONEY_FORMATTER.format(0);
  return MONEY_FORMATTER.format(parsed);
}
