import { CATEGORIES, ZONES, WHEEL_ZONE_POSITION } from './config.js';
import { getRecordsForCategory } from './store.js';
import type { Car, CategoryId, ServiceStatus, WheelPosition, ZoneId } from './types.js';

export function categoryStatus(
  car: Car,
  category: CategoryId,
  position?: WheelPosition,
): ServiceStatus {
  const cfg = CATEGORIES[category];
  const records = getRecordsForCategory(car.id, category, position);
  if (records.length === 0) return 'unknown';
  if (!cfg.intervalKm) return 'ok'; // например, шины — интервал не считаем, просто есть данные
  const last = records[0];
  const delta = car.odometer - last.mileage;
  const ratio = delta / cfg.intervalKm;
  if (ratio < 0.8) return 'ok';
  if (ratio < 1) return 'soon';
  return 'overdue';
}

const STATUS_PRIORITY: Record<ServiceStatus, number> = {
  unknown: 0,
  ok: 1,
  soon: 2,
  overdue: 3,
};

export function zoneStatus(car: Car, zoneId: ZoneId): ServiceStatus {
  const zone = ZONES[zoneId];
  const position = WHEEL_ZONE_POSITION[zoneId];
  const statuses = zone.categories.map((c) => categoryStatus(car, c, position));
  const known = statuses.filter((s) => s !== 'unknown');
  if (known.length === 0) return 'unknown';
  return known.reduce((worst, s) =>
    STATUS_PRIORITY[s] > STATUS_PRIORITY[worst] ? s : worst,
  );
}

export function kmLeft(car: Car, category: CategoryId, position?: WheelPosition): number | null {
  const cfg = CATEGORIES[category];
  if (!cfg.intervalKm) return null;
  const records = getRecordsForCategory(car.id, category, position);
  if (records.length === 0) return null;
  return cfg.intervalKm - (car.odometer - records[0].mileage);
}
