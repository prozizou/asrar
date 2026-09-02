/**
 * Conversion des chiffres latins vers les chiffres arabo-indiens
 * étendus (utilisés en ourdou et en persan : ۰ ۱ ۲ ۳ ۴ ۵ ۶ ۷ ۸ ۹).
 *
 * Ces glyphes diffèrent légèrement des chiffres arabo-indiens
 * "standards" utilisés dans le monde arabophone (٤ ٥ ٦ au lieu de
 * ۴ ۵ ۶) : on garde ici la variante ourdou/persane, demandée
 * explicitement. Volontairement DISTINCT de toEasternArabic()
 * (lib/abjad.js, chiffres arabo-indiens standards ٠-٩) : porté depuis
 * prozizou/Kanzou pour les « Carrés numériques » (app/wafq/carre)
 * uniquement, jamais utilisé ailleurs dans l'app.
 */

export type NumeralSystem = "latin" | "eastern";

const EASTERN_ARABIC_DIGITS = [
  "۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹",
];

export function toEasternDigits<T extends string | number | null>(
  value: T
): T extends null ? null : string {
  if (value === null || value === undefined) {
    return null as T extends null ? null : string;
  }
  return String(value).replace(
    /[0-9]/g,
    (d) => EASTERN_ARABIC_DIGITS[Number(d)]
  ) as T extends null ? null : string;
}

export function formatNumeral(
  value: string | number | null,
  system: NumeralSystem
): string | number | null {
  return system === "eastern" ? toEasternDigits(value) : value;
}
