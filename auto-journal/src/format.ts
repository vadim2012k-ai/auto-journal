export function formatKm(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(Math.round(n)) + ' км';
}

/** Разбивает цифры пробелами по тысячам для отображения в редактируемом поле, напр. "123456" -> "123 456" */
export function formatDigitsWithSpaces(digits: string): string {
  return digits.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Обратное к formatDigitsWithSpaces — убирает пробелы и разбирает число */
export function parseSpacedNumber(s: string): number {
  return Number(s.replace(/\D/g, ''));
}

export function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
