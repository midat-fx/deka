/** «1297500» → «1 297 500 ₸». Разделитель тысяч — обычный пробел (не NBSP). */
export function formatTenge(amount: number): string {
  const digits = Math.round(amount)
    .toLocaleString('ru-RU')
    .replace(/[\s  ]/g, ' ');
  return `${digits} ₸`;
}

/** Компактно для подписей: «1,3 млн ₸», «2,6 млрд ₸». */
export function formatTengeShort(amount: number): string {
  if (amount >= 1e9) return `${trimDecimal(amount / 1e9)} млрд ₸`;
  if (amount >= 1e6) return `${trimDecimal(amount / 1e6)} млн ₸`;
  if (amount >= 1e3) return `${trimDecimal(amount / 1e3)} тыс ₸`;
  return `${Math.round(amount)} ₸`;
}

function trimDecimal(n: number): string {
  return n.toFixed(1).replace(/\.0$/, '').replace('.', ',');
}
