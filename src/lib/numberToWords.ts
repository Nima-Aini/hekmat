/**
 * Convert numbers to formal Persian words for invoices and financial receipts
 */

const units = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
const teens = ["ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"];
const tens = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
const hundreds = ["", "یکصد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];
const thousands = ["", "هزار", "میلیون", "میلیارد", "تریلیون"];

function convertThreeDigit(num: number): string {
  const parts: string[] = [];
  const h = Math.floor(num / 100);
  const t = Math.floor((num % 100) / 10);
  const u = num % 10;

  if (h > 0) parts.push(hundreds[h]);

  if (t === 1) {
    parts.push(teens[u]);
  } else {
    if (t > 1) parts.push(tens[t]);
    if (u > 0) parts.push(units[u]);
  }

  return parts.join(" و ");
}

export function numberToPersianWords(num: number | string | null | undefined, unit: string = "تومان"): string {
  const val = Math.floor(Math.abs(Number(num) || 0));
  if (val === 0) return `صفر ${unit}`.trim();

  const numStr = val.toString();
  const chunks: number[] = [];

  for (let i = numStr.length; i > 0; i -= 3) {
    chunks.push(parseInt(numStr.substring(Math.max(0, i - 3), i), 10));
  }

  const words: string[] = [];
  for (let i = chunks.length - 1; i >= 0; i--) {
    const chunk = chunks[i];
    if (chunk > 0) {
      const chunkWord = convertThreeDigit(chunk);
      const suffix = thousands[i];
      words.push(suffix ? `${chunkWord} ${suffix}` : chunkWord);
    }
  }

  const result = words.join(" و ");
  return unit ? `${result} ${unit}` : result;
}
