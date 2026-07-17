import type { Car, FuelRecord } from './types.js';

export interface FuelInterval {
  /** Более поздняя заправка, которой заканчивается интервал */
  record: FuelRecord;
  distanceKm: number;
  /** л/100км за этот интервал (метод "от заправки до заправки") */
  consumption: number;
}

function sortedAsc(records: FuelRecord[]): FuelRecord[] {
  return [...records].sort((a, b) => a.mileage - b.mileage || a.createdAt - b.createdAt);
}

/**
 * Расход считается между соседними заправками (по возрастанию пробега):
 * литры этой заправки / пройденное расстояние с прошлой заправки.
 * Предполагается, что бак заправляется "под крышку" каждый раз — это
 * стандартное упрощение бортовых компьютеров.
 */
export function fuelIntervals(records: FuelRecord[]): FuelInterval[] {
  const asc = sortedAsc(records);
  const result: FuelInterval[] = [];
  for (let i = 1; i < asc.length; i++) {
    const prev = asc[i - 1];
    const cur = asc[i];
    const distanceKm = cur.mileage - prev.mileage;
    if (distanceKm <= 0) continue;
    result.push({ record: cur, distanceKm, consumption: (cur.liters / distanceKm) * 100 });
  }
  return result;
}

export function avgConsumption(intervals: FuelInterval[]): number | null {
  if (intervals.length === 0) return null;
  const totalLiters = intervals.reduce((s, i) => s + i.record.liters, 0);
  const totalKm = intervals.reduce((s, i) => s + i.distanceKm, 0);
  if (totalKm <= 0) return null;
  return (totalLiters / totalKm) * 100;
}

function isSameMonth(dateIso: string, ref: Date): boolean {
  const d = new Date(dateIso + 'T00:00:00');
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

export function avgConsumptionThisMonth(intervals: FuelInterval[], now = new Date()): number | null {
  return avgConsumption(intervals.filter((i) => isSameMonth(i.record.date, now)));
}

export function totalCostThisMonth(records: FuelRecord[], now = new Date()): number {
  return records.filter((r) => isSameMonth(r.date, now)).reduce((s, r) => s + r.cost, 0);
}

export function avgCostPerMonth(records: FuelRecord[]): number | null {
  if (records.length === 0) return null;
  const times = records.map((r) => new Date(r.date + 'T00:00:00').getTime());
  const minD = new Date(Math.min(...times));
  const maxD = new Date(Math.max(...times));
  const months = Math.max(
    1,
    (maxD.getFullYear() - minD.getFullYear()) * 12 + (maxD.getMonth() - minD.getMonth()) + 1,
  );
  const totalCost = records.reduce((s, r) => s + r.cost, 0);
  return totalCost / months;
}

export function costPerKm(intervals: FuelInterval[]): number | null {
  if (intervals.length === 0) return null;
  const totalCost = intervals.reduce((s, i) => s + i.record.cost, 0);
  const totalKm = intervals.reduce((s, i) => s + i.distanceKm, 0);
  if (totalKm <= 0) return null;
  return totalCost / totalKm;
}

export function avgPricePerLiter(records: FuelRecord[]): number | null {
  const totalLiters = records.reduce((s, r) => s + r.liters, 0);
  if (totalLiters <= 0) return null;
  const totalCost = records.reduce((s, r) => s + r.cost, 0);
  return totalCost / totalLiters;
}

export interface RangeEstimate {
  remainingLiters: number;
  remainingKm: number;
}

/** Оценка запаса хода — требует указанного объёма бака и хотя бы 2 заправок. */
export function estimateRange(car: Car, records: FuelRecord[], avg: number | null): RangeEstimate | null {
  if (!car.tankCapacity || !avg || avg <= 0 || records.length === 0) return null;
  const asc = sortedAsc(records);
  const last = asc[asc.length - 1];
  const usedSinceLastFill = ((car.odometer - last.mileage) / 100) * avg;
  const remainingLiters = Math.max(0, car.tankCapacity - usedSinceLastFill);
  return { remainingLiters, remainingKm: (remainingLiters / avg) * 100 };
}

export interface TripEstimate {
  liters: number;
  cost: number;
}

export function tripEstimate(
  distanceKm: number,
  avg: number | null,
  pricePerLiter: number | null,
): TripEstimate | null {
  if (!avg || !pricePerLiter || !distanceKm || distanceKm <= 0) return null;
  const liters = (distanceKm / 100) * avg;
  return { liters, cost: liters * pricePerLiter };
}

export interface ConsumptionSpike {
  last: number;
  avgBefore: number;
}

/** Заметный рост расхода: последняя заправка на 15%+ выше среднего по предыдущим */
export function consumptionSpike(intervals: FuelInterval[]): ConsumptionSpike | null {
  if (intervals.length < 2) return null;
  const last = intervals[intervals.length - 1];
  const avgBefore = avgConsumption(intervals.slice(0, -1));
  if (!avgBefore) return null;
  if (last.consumption > avgBefore * 1.15) return { last: last.consumption, avgBefore };
  return null;
}
