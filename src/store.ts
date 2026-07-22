import { ensureFreshSession, fetchAppData, saveAppData } from './supabase.js';
import type { AppData, Car, FuelRecord, MaintenanceRecord, RepairRecord, CategoryId, WheelPosition } from './types.js';

export interface Account {
  id: number;
  email: string;
}

// Локальный кэш — только для мгновенной отрисовки при следующем открытии
// и как подстраховка на случай временной потери сети. Источник истины —
// сервер (Supabase), ключ кэша привязан к реальному id пользователя,
// чтобы разные аккаунты на одном устройстве не путали данные друг друга.
const CACHE_PREFIX = 'auto-journal-cache-v1';

let userId: string | null = null;
let displayId: number | null = null;
let userEmail: string | null = null;

function cacheKey(): string {
  return `${CACHE_PREFIX}-${userId}`;
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
  return { cars: [car], activeCarId: car.id, records: [], fuel: [], repairs: [] };
}

let data: AppData = defaultData();

function normalizeLoaded(parsed: AppData): AppData {
  if (!parsed.cars || parsed.cars.length === 0) return defaultData();
  if (!Array.isArray(parsed.fuel)) parsed.fuel = [];
  if (!Array.isArray(parsed.repairs)) parsed.repairs = [];
  return parsed;
}

function loadCache(): AppData | null {
  try {
    const raw = localStorage.getItem(cacheKey());
    return raw ? normalizeLoaded(JSON.parse(raw) as AppData) : null;
  } catch {
    return null;
  }
}

function saveCache(): void {
  try {
    localStorage.setItem(cacheKey(), JSON.stringify(data));
  } catch {
    // офлайн-кэш недоступен — не критично, сервер всё равно источник истины
  }
}

/**
 * До появления настоящих аккаунтов данные хранились чисто локально
 * (ключи "auto-journal-data-v1" и "auto-journal-data-v1-<старый id>").
 * При первой регистрации нового аккаунта на этом устройстве подхватываем
 * такие данные, чтобы уже накопленная история не потерялась.
 */
function findLegacyLocalData(): AppData | null {
  try {
    const plain = localStorage.getItem('auto-journal-data-v1');
    if (plain) return JSON.parse(plain) as AppData;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('auto-journal-data-v1-')) {
        const raw = localStorage.getItem(key);
        if (raw) return JSON.parse(raw) as AppData;
      }
    }
  } catch {
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
export async function initForAccount(): Promise<boolean> {
  const session = await ensureFreshSession();
  if (!session) return false;
  userId = session.userId;
  userEmail = session.email;

  // Пока грузим с сервера — показываем локальный кэш (если есть), чтобы не мигать пустым экраном.
  const cached = loadCache();
  if (cached) data = cached;

  const remote = await fetchAppData();
  if (remote) {
    data = normalizeLoaded(remote.data as AppData);
    displayId = remote.displayId;
    saveCache();
  } else {
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

export function getAccountInfo(): Account | null {
  if (displayId == null || userEmail == null) return null;
  return { id: displayId, email: userEmail };
}

// Сохранения на сервер идут строго по очереди, одно за другим. Без этого
// два быстрых подряд изменения (например, пробег вручную + сразу запись ТО)
// уходили бы параллельно, и если ответ сети приходил не в том порядке —
// более старое сохранение могло затереть более новое.
let saveQueue: Promise<void> = Promise.resolve();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function saveWithRetry(): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await saveAppData(data);
    if (res.ok) {
      if (displayId == null) displayId = res.displayId;
      return;
    }
    console.error(`Сохранение на сервер не удалось (попытка ${attempt}/3): [${res.status}] ${res.message}`);
    if (attempt < 3) await sleep(attempt * 800);
  }
  // Временная диагностика: три попытки не помогли — показываем явно, а не молчим.
  alert(
    'Не удалось сохранить изменения на сервере после трёх попыток.\n\n' +
      'Данные остались только в этом браузере и могут потеряться. Сфотографируйте это окно и пришлите разработчику.\n\n' +
      'Подробности смотрите в консоли браузера (или пришлите последнюю ошибку из неё).',
  );
}

function persist(): void {
  saveCache();
  saveQueue = saveQueue.then(saveWithRetry);
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
  data.repairs = data.repairs.filter((r) => r.carId !== carId);
  if (data.activeCarId === carId) data.activeCarId = data.cars[0].id;
  notify();
}

export function updateCar(
  patch: Partial<
    Pick<
      Car,
      | 'name'
      | 'odometer'
      | 'vin'
      | 'photo'
      | 'brand'
      | 'model'
      | 'year'
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

export function getRepairsForCar(carId: string): RepairRecord[] {
  return data.repairs
    .filter((r) => r.carId === carId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

export function getRepairRecordById(id: string): RepairRecord | undefined {
  return data.repairs.find((r) => r.id === id);
}

export function addRepairRecord(input: Omit<RepairRecord, 'id' | 'createdAt'>): void {
  const rec: RepairRecord = { ...input, id: uid(), createdAt: Date.now() };
  data.repairs.push(rec);
  const car = data.cars.find((c) => c.id === input.carId);
  if (car && input.mileage > car.odometer) car.odometer = input.mileage;
  notify();
}

export function updateRepairRecord(
  id: string,
  patch: Partial<Pick<RepairRecord, 'title' | 'date' | 'mileage' | 'brand' | 'spec' | 'cost' | 'notes'>>,
): void {
  const rec = data.repairs.find((r) => r.id === id);
  if (!rec) return;
  Object.assign(rec, patch);
  const car = data.cars.find((c) => c.id === rec.carId);
  if (car && rec.mileage > car.odometer) car.odometer = rec.mileage;
  notify();
}

export function deleteRepairRecord(id: string): void {
  data.repairs = data.repairs.filter((r) => r.id !== id);
  notify();
}

export function exportJson(): string {
  return JSON.stringify(data, null, 2);
}

export function importJson(json: string): void {
  const parsed = JSON.parse(json) as AppData;
  if (!parsed.cars || !Array.isArray(parsed.records)) throw new Error('Некорректный файл');
  if (!Array.isArray(parsed.fuel)) parsed.fuel = [];
  if (!Array.isArray(parsed.repairs)) parsed.repairs = [];
  data = parsed;
  notify();
}

export function resetAll(): void {
  data = defaultData();
  notify();
}
