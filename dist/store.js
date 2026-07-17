// Данные хранятся отдельно на каждый аккаунт (см. auth.ts) — ключ в
// localStorage включает id аккаунта, чтобы разные пользователи одного
// браузера не видели данные друг друга.
const STORAGE_PREFIX = 'auto-journal-data-v1';
let accountId = null;
function storageKey() {
    return accountId != null ? `${STORAGE_PREFIX}-${accountId}` : STORAGE_PREFIX;
}
function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
function defaultData() {
    const car = {
        id: uid(),
        name: 'Моя машина',
        driveType: 'rwd',
        odometer: 0,
        createdAt: Date.now(),
    };
    return { cars: [car], activeCarId: car.id, records: [], fuel: [] };
}
let data = defaultData();
function load() {
    try {
        const raw = localStorage.getItem(storageKey());
        if (!raw)
            return defaultData();
        const parsed = JSON.parse(raw);
        if (!parsed.cars || parsed.cars.length === 0)
            return defaultData();
        // Миграция старых сохранений — раздел "Топливо" появился позже.
        if (!Array.isArray(parsed.fuel))
            parsed.fuel = [];
        return parsed;
    }
    catch {
        return defaultData();
    }
}
/** Вызывается один раз при входе/восстановлении сессии — до монтирования приложения. */
export function initForAccount(id) {
    accountId = id;
    data = load();
}
function persist() {
    localStorage.setItem(storageKey(), JSON.stringify(data));
}
const listeners = [];
export function subscribe(fn) {
    listeners.push(fn);
}
function notify() {
    persist();
    for (const l of listeners)
        l();
}
export function getData() {
    return data;
}
export function getActiveCar() {
    const car = data.cars.find((c) => c.id === data.activeCarId);
    if (car)
        return car;
    // safety net — не должно случаться, но восстановим согласованность
    const fallback = data.cars[0];
    data.activeCarId = fallback.id;
    return fallback;
}
export function getAllCars() {
    return data.cars;
}
export function addCar(name) {
    const car = {
        id: uid(),
        name,
        driveType: 'rwd',
        odometer: 0,
        createdAt: Date.now(),
    };
    data.cars.push(car);
    data.activeCarId = car.id;
    notify();
}
export function switchCar(carId) {
    if (!data.cars.some((c) => c.id === carId))
        return;
    data.activeCarId = carId;
    notify();
}
export function deleteCar(carId) {
    if (data.cars.length <= 1)
        return; // всегда должен остаться хотя бы один автомобиль
    data.cars = data.cars.filter((c) => c.id !== carId);
    data.records = data.records.filter((r) => r.carId !== carId);
    data.fuel = data.fuel.filter((f) => f.carId !== carId);
    if (data.activeCarId === carId)
        data.activeCarId = data.cars[0].id;
    notify();
}
export function updateCar(patch) {
    const car = getActiveCar();
    Object.assign(car, patch);
    notify();
}
export function getRecordsForCategory(carId, category, position) {
    return data.records
        .filter((r) => r.carId === carId &&
        r.category === category &&
        (position ? r.position === position : true))
        .sort((a, b) => b.mileage - a.mileage || b.createdAt - a.createdAt);
}
export function getAllRecordsForCar(carId) {
    return data.records
        .filter((r) => r.carId === carId)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}
export function addRecord(input) {
    const rec = { ...input, id: uid(), createdAt: Date.now() };
    data.records.push(rec);
    // Если пробег в записи больше текущего одометра — подтягиваем одометр.
    const car = data.cars.find((c) => c.id === input.carId);
    if (car && input.mileage > car.odometer)
        car.odometer = input.mileage;
    notify();
}
export function deleteRecord(id) {
    data.records = data.records.filter((r) => r.id !== id);
    notify();
}
export function getRecordById(id) {
    return data.records.find((r) => r.id === id);
}
export function updateRecord(id, patch) {
    const rec = data.records.find((r) => r.id === id);
    if (!rec)
        return;
    Object.assign(rec, patch);
    // Если пробег в записи больше текущего одометра — подтягиваем одометр, как и при добавлении.
    const car = data.cars.find((c) => c.id === rec.carId);
    if (car && rec.mileage > car.odometer)
        car.odometer = rec.mileage;
    notify();
}
export function getFuelRecordsForCar(carId) {
    return data.fuel
        .filter((f) => f.carId === carId)
        .sort((a, b) => b.mileage - a.mileage || b.createdAt - a.createdAt);
}
export function getFuelRecordById(id) {
    return data.fuel.find((f) => f.id === id);
}
export function addFuelRecord(input) {
    const rec = { ...input, id: uid(), createdAt: Date.now() };
    data.fuel.push(rec);
    const car = data.cars.find((c) => c.id === input.carId);
    if (car && input.mileage > car.odometer)
        car.odometer = input.mileage;
    notify();
}
export function updateFuelRecord(id, patch) {
    const rec = data.fuel.find((f) => f.id === id);
    if (!rec)
        return;
    Object.assign(rec, patch);
    const car = data.cars.find((c) => c.id === rec.carId);
    if (car && rec.mileage > car.odometer)
        car.odometer = rec.mileage;
    notify();
}
export function deleteFuelRecord(id) {
    data.fuel = data.fuel.filter((f) => f.id !== id);
    notify();
}
export function exportJson() {
    return JSON.stringify(data, null, 2);
}
export function importJson(json) {
    const parsed = JSON.parse(json);
    if (!parsed.cars || !Array.isArray(parsed.records))
        throw new Error('Некорректный файл');
    if (!Array.isArray(parsed.fuel))
        parsed.fuel = [];
    data = parsed;
    notify();
}
export function resetAll() {
    data = defaultData();
    notify();
}
