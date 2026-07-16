import type { AppData, Car, MaintenanceRecord, CategoryId, WheelPosition } from './types.js';

const STORAGE_KEY = 'auto-journal-data-v1';

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
  return { cars: [car], activeCarId: car.id, records: [] };
}

let data: AppData = load();

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw) as AppData;
    if (!parsed.cars || parsed.cars.length === 0) return defaultData();
    return parsed;
  } catch {
    return defaultData();
  }
}

function persist(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
      | 'fuelConsumption'
    >
  >,
): void {
  const car = getActiveCar();
  Object.assign(car, patch);
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

export function exportJson(): string {
  return JSON.stringify(data, null, 2);
}

export function importJson(json: string): void {
  const parsed = JSON.parse(json) as AppData;
  if (!parsed.cars || !Array.isArray(parsed.records)) throw new Error('Некорректный файл');
  data = parsed;
  notify();
}

export function resetAll(): void {
  data = defaultData();
  notify();
}
