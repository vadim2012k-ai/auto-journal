import { CATEGORIES, ZONES, WHEEL_ZONE_POSITION } from './config.js';
import { getRecordsForCategory } from './store.js';
/** Интервал ТО для этой машины: свой (если задан в настройках) или стандартный по умолчанию */
export function effectiveIntervalKm(car, category) {
    return car.customIntervals?.[category] ?? CATEGORIES[category].intervalKm;
}
export function categoryStatus(car, category, position) {
    const records = getRecordsForCategory(car.id, category, position);
    if (records.length === 0)
        return 'unknown';
    const intervalKm = effectiveIntervalKm(car, category);
    if (!intervalKm)
        return 'ok'; // например, шины — интервал не считаем, просто есть данные
    const last = records[0];
    const delta = car.odometer - last.mileage;
    const ratio = delta / intervalKm;
    if (ratio < 0.8)
        return 'ok';
    if (ratio < 1)
        return 'soon';
    return 'overdue';
}
const STATUS_PRIORITY = {
    unknown: 0,
    ok: 1,
    soon: 2,
    overdue: 3,
};
export function zoneStatus(car, zoneId) {
    const zone = ZONES[zoneId];
    const position = WHEEL_ZONE_POSITION[zoneId];
    const statuses = zone.categories.map((c) => categoryStatus(car, c, position));
    const known = statuses.filter((s) => s !== 'unknown');
    if (known.length === 0)
        return 'unknown';
    return known.reduce((worst, s) => STATUS_PRIORITY[s] > STATUS_PRIORITY[worst] ? s : worst);
}
export function kmLeft(car, category, position) {
    const intervalKm = effectiveIntervalKm(car, category);
    if (!intervalKm)
        return null;
    const records = getRecordsForCategory(car.id, category, position);
    if (records.length === 0)
        return null;
    return intervalKm - (car.odometer - records[0].mileage);
}
