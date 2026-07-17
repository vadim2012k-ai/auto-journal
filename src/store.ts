import type { AppData, Car, FuelRecord, MaintenanceRecord, CategoryId, WheelPosition } from './types.js';

// Данные хранятся отдельно на каждый аккаунт (см. auth.ts) — ключ в
// localStorage включает id аккаунта, чтобы разные пользователи одного
// браузера не видели данные друг друга.
const STORAGE_PREFIX = 'auto-journal-data-v1';

let accountId: number | null = null;

function storageKey(): string {
  return accountId != null ? `${STORAGE_PREFIX}-${accountId}` : STORAGE_PREFIX;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function defaultData(): AppData {
  const car: Car = {
    id: uid(),
    name: 'Моя машина',
    driveType: 'rwd',
    odometer: 0,
    createdAt: Date.now(),
  };
  return { cars: [car], activeCarId: car.id, records: [], fuel: [] };
}

let data: AppData = defaultData();

function load(): AppData {
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw) as AppData;
    if (!parsed.cars || parsed.cars.length === 0) return defaultData();
    // Миграция старых сохранений — раздел "Топливо" появился позже.
    if (!Array.isArray(parsed.fuel)) parsed.fuel = [];
    return parsed;
  } catch {
    return defaultData();
  }
}

/** Вызывается один раз при входе/восстановлении сессии — до монтирования приложения. */
export function initForAccount(id: number): void {
  accountId = id;
  data = load();
}

function persist(): void {
  localStorage.setItem(storageKey(), JSON.stringify(data));
}

type Listener = () => void;
const listeners: Listener[] = [];

export function subscribe(fn: Listener): void {
  listeners.push(fn);
}

function notify(): void {
  persist();
  for (const l of listeners) l();
}

export function getData(): AppData {
  return data;
}

export function getActiveCar(): Car {
  const car = data.cars.find((c) => c.id === data.activeCarId);
  if (car) return car;
  // safety net — не должно случаться, но восстановим согласованность
  const fallback = data.cars[0];
  data.activeCarId = fallback.id;
  return fallback;
}

export function getAllCars(): Car[] {
  return data.cars;
}

export function addCar(name: string): void {
  const car: Car = {
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

export function switchCar(carId: string): void {
  if (!data.cars.some((c) => c.id === carId)) return;
  data.activeCarId = carId;
  notify();
}

export function deleteCar(carId: string): void {
  if (data.cars.length <= 1) return; // всегда должен остаться хотя бы один автомобиль
  data.cars = data.cars.filter((c) => c.id !== carId);
  data.records = data.records.filter((r) => r.carId !== carId);
  data.fuel = data.fuel.filter((f) => f.carId !== carId);
  if (data.activeCarId === carId) data.activeCarId = data.cars[0].id;
  notify();
}

export function updateCar(
  patch: Partial<
    Pick<
      Car,
      | 'name'
      | 'odometer'
      | 'brand'
      | 'model'
      | 'engineType'
      | 'engineVolume'
      | 'enginePower'
      | 'tankCapacity'
      | 'driveType'
    >
  >,
): void {
  const car = getActiveCar();
  Object.assign(car, patch);
  notify();
}

/** Задать свой интервал ТО (км) для категории у активной машины; undefined — вернуть по умолчанию */
export function setCustomInterval(category: CategoryId, km: number | undefined): void {
  const car = getActiveCar();
  if (km === undefined) {
    if (car.customIntervals) delete car.customIntervals[category];
  } else {
    if (!car.customIntervals) car.customIntervals = {};
    car.customIntervals[category] = km;
  }
  notify();
}

export function getRecordsForCategory(
  carId: string,
  category: CategoryId,
  position?: WheelPosition,
): MaintenanceRecord[] {
  return data.records
    .filter(
      (r) =>
        r.carId === carId &&
        r.category === category &&
        (position ? r.position === position : true),
    )
    .sort((a, b) => b.mileage - a.mileage || b.createdAt - a.createdAt);
}

export function getAllRecordsForCar(carId: string): MaintenanceRecord[] {
  return data.records
    .filter((r) => r.carId === carId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

export function addRecord(input: Omit<MaintenanceRecord, 'id' | 'createdAt'>): void {
  const rec: MaintenanceRecord = { ...input, id: uid(), createdAt: Date.now() };
  data.records.push(rec);
  // Если пробег в записи больше текущего одометра — подтягиваем одометр.
  const car = data.cars.find((c) => c.id === input.carId);
  if (car && input.mileage > car.odometer) car.odometer = input.mileage;
  notify();
}

export function deleteRecord(id: string): void {
  data.records = data.records.filter((r) => r.id !== id);
  notify();
}

export function getRecordById(id: string): MaintenanceRecord | undefined {
  return data.records.find((r) => r.id === id);
}

export function updateRecord(
  id: string,
  patch: Partial<Pick<MaintenanceRecord, 'date' | 'mileage' | 'brand' | 'spec' | 'season' | 'cost' | 'notes'>>,
): void {
  const rec = data.records.find((r) => r.id === id);
  if (!rec) return;
  Object.assign(rec, patch);
  // Если пробег в записи больше текущего одометра — подтягиваем одометр, как и при добавлении.
  const car = data.cars.find((c) => c.id === rec.carId);
  if (car && rec.mileage > car.odometer) car.odometer = rec.mileage;
  notify();
}

export function getFuelRecordsForCar(carId: string): FuelRecord[] {
  return data.fuel
    .filter((f) => f.carId === carId)
    .sort((a, b) => b.mileage - a.mileage || b.createdAt - a.createdAt);
}

export function getFuelRecordById(id: string): FuelRecord | undefined {
  return data.fuel.find((f) => f.id === id);
}

export function addFuelRecord(input: Omit<FuelRecord, 'id' | 'createdAt'>): void {
  const rec: FuelRecord = { ...input, id: uid(), createdAt: Date.now() };
  data.fuel.push(rec);
  const car = data.cars.find((c) => c.id === input.carId);
  if (car && input.mileage > car.odometer) car.odometer = input.mileage;
  notify();
}

export function updateFuelRecord(
  id: string,
  patch: Partial<Pick<FuelRecord, 'date' | 'mileage' | 'liters' | 'cost'>>,
): void {
  const rec = data.fuel.find((f) => f.id === id);
  if (!rec) return;
  Object.assign(rec, patch);
  const car = data.cars.find((c) => c.id === rec.carId);
  if (car && rec.mileage > car.odometer) car.odometer = rec.mileage;
  notify();
}

export function deleteFuelRecord(id: string): void {
  data.fuel = data.fuel.filter((f) => f.id !== id);
  notify();
}

export function exportJson(): string {
  return JSON.stringify(data, null, 2);
}

export function importJson(json: string): void {
  const parsed = JSON.parse(json) as AppData;
  if (!parsed.cars || !Array.isArray(parsed.records)) throw new Error('Некорректный файл');
  if (!Array.isArray(parsed.fuel)) parsed.fuel = [];
  data = parsed;
  notify();
}

export function resetAll(): void {
  data = defaultData();
  notify();
}
