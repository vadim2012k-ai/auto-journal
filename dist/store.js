import { ensureFreshSession, fetchAppData, saveAppData } from './supabase.js';
// Локальный кэш — только для мгновенной отрисовки при следующем открытии
// и как подстраховка на случай временной потери сети. Источник истины —
// сервер (Supabase), ключ кэша привязан к реальному id пользователя,
// чтобы разные аккаунты на одном устройстве не путали данные друг друга.
const CACHE_PREFIX = 'auto-journal-cache-v1';
let userId = null;
let displayId = null;
let userEmail = null;
function cacheKey() {
    return `${CACHE_PREFIX}-${userId}`;
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
function normalizeLoaded(parsed) {
    if (!parsed.cars || parsed.cars.length === 0)
        return defaultData();
    if (!Array.isArray(parsed.fuel))
        parsed.fuel = [];
    return parsed;
}
function loadCache() {
    try {
        const raw = localStorage.getItem(cacheKey());
        return raw ? normalizeLoaded(JSON.parse(raw)) : null;
    }
    catch {
        return null;
    }
}
function saveCache() {
    try {
        localStorage.setItem(cacheKey(), JSON.stringify(data));
    }
    catch {
        // офлайн-кэш недоступен — не критично, сервер всё равно источник истины
    }
}
/**
 * До появления настоящих аккаунтов данные хранились чисто локально
 * (ключи "auto-journal-data-v1" и "auto-journal-data-v1-<старый id>").
 * При первой регистрации нового аккаунта на этом устройстве подхватываем
 * такие данные, чтобы уже накопленная история не потерялась.
 */
function findLegacyLocalData() {
    try {
        const plain = localStorage.getItem('auto-journal-data-v1');
        if (plain)
            return JSON.parse(plain);
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('auto-journal-data-v1-')) {
                const raw = localStorage.getItem(key);
                if (raw)
                    return JSON.parse(raw);
            }
        }
    }
    catch {
        // ignore
    }
    return null;
}
/**
 * Вызывается один раз при входе/восстановлении сессии — до монтирования
 * приложения. Тянет данные с сервера; если это первый вход — создаёт
 * запись на сервере (заодно выдаётся числовой id аккаунта).
 * Возвращает false, если сессия недействительна (нужно перелогиниться).
 */
export async function initForAccount() {
    const session = await ensureFreshSession();
    if (!session)
        return false;
    userId = session.userId;
    userEmail = session.email;
    // Пока грузим с сервера — показываем локальный кэш (если есть), чтобы не мигать пустым экраном.
    const cached = loadCache();
    if (cached)
        data = cached;
    const remote = await fetchAppData();
    if (remote) {
        data = normalizeLoaded(remote.data);
        displayId = remote.displayId;
        saveCache();
    }
    else {
        // Первый вход этого пользователя — создаём запись на сервере.
        // Если на устройстве остались старые локальные данные (до аккаунтов) — переносим их.
        if (!cached) {
            const legacy = findLegacyLocalData();
            data = legacy ? normalizeLoaded(legacy) : defaultData();
        }
        const saved = await saveAppData(data);
        displayId = saved.ok ? saved.displayId : null;
        saveCache();
    }
    return true;
}
export function getAccountInfo() {
    if (displayId == null || userEmail == null)
        return null;
    return { id: displayId, email: userEmail };
}
function persist() {
    saveCache();
    void saveAppData(data).then((res) => {
        if (res.ok && displayId == null)
            displayId = res.displayId;
    });
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
/** Задать свой интервал ТО (км) для категории у активной машины; undefined — вернуть по умолчанию */
export function setCustomInterval(category, km) {
    const car = getActiveCar();
    if (km === undefined) {
        if (car.customIntervals)
            delete car.customIntervals[category];
    }
    else {
        if (!car.customIntervals)
            car.customIntervals = {};
        car.customIntervals[category] = km;
    }
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
