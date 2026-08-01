import i18n from '../i18n';

const locales: Record<string, string> = { ua: 'uk-UA', en: 'en-US', de: 'de-DE' };

export function formatUah(
  kopecks: number,
  locale = locales[i18n.resolvedLanguage ?? i18n.language] ?? 'uk-UA',
): string {
  return (kopecks / 100).toLocaleString(locale, {
    style: 'currency',
    currency: 'UAH',
    minimumFractionDigits: 2,
  });
}
