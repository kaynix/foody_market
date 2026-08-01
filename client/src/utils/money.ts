export function formatUah(kopecks: number, locale = 'uk-UA'): string {
  return (kopecks / 100).toLocaleString(locale, {
    style: 'currency',
    currency: 'UAH',
    minimumFractionDigits: 2,
  });
}
