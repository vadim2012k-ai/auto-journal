import {
  addCar,
  addFuelRecord,
  addRecord,
  deleteCar,
  deleteFuelRecord,
  deleteRecord,
  exportJson,
  getActiveCar,
  getAccountInfo,
  getAllCars,
  getFuelRecordById,
  getFuelRecordsForCar,
  getRecordById,
  importJson,
  resetAll,
  setCustomInterval,
  subscribe,
  switchCar,
  updateCar,
  updateFuelRecord,
  updateRecord,
} from './store.js';
import {
  bottomNav,
  renderCarForm,
  renderFuel,
  renderFuelForm,
  renderHome,
  renderJournal,
  renderService,
  renderSettings,
  renderZonePanel,
  renderRecordForm,
  type Route,
  type UiState,
} from './view.js';
import type { CategoryId, DriveType, SeasonType, WheelPosition, ZoneId } from './types.js';
import { formatDigitsWithSpaces, parseSpacedNumber } from './format.js';
import { logout } from './auth.js';

function tireScopePositions(scope: string, base: WheelPosition): WheelPosition[] {
  if (scope === 'front') return ['FL', 'FR'];
  if (scope === 'rear') return ['RL', 'RR'];
  if (scope === 'all') return ['FL', 'FR', 'RL', 'RR'];
  return [base];
}

type FuelField = 'liters' | 'cost' | 'price';

// Порядок полей формы заправки, тронутых пользователем (старые — в начале).
// Сбрасывается при каждом открытии формы заправки.
let fuelTouchOrder: FuelField[] = [];

function onFuelFieldInput(field: FuelField, form: HTMLFormElement): void {
  fuelTouchOrder = fuelTouchOrder.filter((f) => f !== field);
  fuelTouchOrder.push(field);

  const litersEl = form.querySelector<HTMLInputElement>('[data-fuel-field="liters"]');
  const costEl = form.querySelector<HTMLInputElement>('[data-fuel-field="cost"]');
  const priceEl = form.querySelector<HTMLInputElement>('[data-fuel-field="price"]');
  if (!litersEl || !costEl || !priceEl) return;

  const liters = Number(litersEl.value);
  const cost = Number(costEl.value);
  const price = Number(priceEl.value);
  const valid = (n: number) => Number.isFinite(n) && n > 0;

  const allFields: FuelField[] = ['liters', 'cost', 'price'];
  const untouched = allFields.filter((f) => !fuelTouchOrder.includes(f));
  let target: FuelField | null = null;
  if (untouched.length === 1) target = untouched[0];
  else if (fuelTouchOrder.length === 3) target = fuelTouchOrder[0];
  if (!target) return;

  if (target === 'cost' && valid(liters) && valid(price)) {
    costEl.value = (liters * price).toFixed(0);
  } else if (target === 'liters' && valid(cost) && valid(price)) {
    litersEl.value = (cost / price).toFixed(2);
  } else if (target === 'price' && valid(liters) && valid(cost)) {
    priceEl.value = (cost / liters).toFixed(2);
  }
}

const ui: UiState = {
  route: 'home',
  activeZone: null,
  formCategory: null,
  editingRecordId: null,
  journalFilter: null,
  fuelFormOpen: false,
  editingFuelId: null,
  carFormOpen: false,
  intervalsOpen: false,
};

let root: HTMLElement;

export function mountApp(rootEl: HTMLElement): void {
  root = rootEl;
  subscribe(render);
  root.addEventListener('click', onClick);
  root.addEventListener('submit', onSubmit as EventListener);
  root.addEventListener('change', onChange);
  root.addEventListener('input', onInput);
  root.addEventListener('touchstart', onTouchStart, { passive: true });
  root.addEventListener('touchend', onTouchEnd);
  root.addEventListener('focusin', onFocusIn);
  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('pointerup', onPointerUp);
  root.addEventListener('pointercancel', onPointerUp);
  root.addEventListener('pointerleave', onPointerUp, true);
  // 'toggle' не всплывает — слушаем на фазе погружения (capture),
  // чтобы запомнить, открыт ли <details>, и не сбрасывать это при перерисовке.
  root.addEventListener('toggle', onToggle, true);
  render();
}

function onToggle(e: Event): void {
  const target = e.target as HTMLElement;
  if (target.classList.contains('intervals-toggle')) {
    ui.intervalsOpen = (target as HTMLDetailsElement).open;
  }
}

// Подсветка нажатия кнопок/карточек своими силами: мы отключили нативный
// -webkit-tap-highlight-color (убирает уродливую синюю вспышку на тапе),
// но из-за этого на телефоне пропала вообще любая обратная связь при
// нажатии — на компьютере её показывает браузер сам, на тач-устройствах
// нет. Единый JS-обработчик работает одинаково для мыши и пальца.
const PRESSABLE = '.btn, .nav-btn, .car-row, .journal-row, .filter-chip, .icon-btn, .icon-btn-sm, .auth-tab';
let pressedEl: HTMLElement | null = null;

function onPointerDown(e: PointerEvent): void {
  const target = (e.target as HTMLElement).closest<HTMLElement>(PRESSABLE);
  if (target) {
    target.classList.add('pressed');
    pressedEl = target;
  }
}

function onPointerUp(): void {
  if (pressedEl) {
    pressedEl.classList.remove('pressed');
    pressedEl = null;
  }
}

// При фокусе на числовое поле (пробег и т.п.) выделяем всё содержимое —
// иначе новые цифры дописываются к старому значению (например, к "0"),
// а не заменяют его.
function onFocusIn(e: FocusEvent): void {
  const target = e.target as HTMLElement;
  if (target instanceof HTMLInputElement && target.classList.contains('num-spaced')) {
    target.select();
  }
}

let swipeStartX = 0;
let swipeStartY = 0;
let swipeActive = false;

function onTouchStart(e: TouchEvent): void {
  const target = (e.target as HTMLElement).closest('[data-car-swipe]');
  if (!target || e.touches.length !== 1) {
    swipeActive = false;
    return;
  }
  swipeActive = true;
  swipeStartX = e.touches[0].clientX;
  swipeStartY = e.touches[0].clientY;
}

function onTouchEnd(e: TouchEvent): void {
  if (!swipeActive) return;
  swipeActive = false;
  const touch = e.changedTouches[0];
  const dx = touch.clientX - swipeStartX;
  const dy = touch.clientY - swipeStartY;
  if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.4) return;

  const cars = getAllCars();
  if (cars.length < 2) return;
  const idx = cars.findIndex((c) => c.id === getActiveCar().id);
  if (idx === -1) return;
  const nextIdx = dx < 0 ? (idx + 1) % cars.length : (idx - 1 + cars.length) % cars.length;
  switchCar(cars[nextIdx].id);
}

function render(): void {
  const car = getActiveCar();
  let page = '';
  if (ui.route === 'home') page = renderHome(car, getAllCars());
  else if (ui.route === 'journal') page = renderJournal(car, ui.journalFilter);
  else if (ui.route === 'fuel') page = renderFuel(car, getFuelRecordsForCar(car.id));
  else if (ui.route === 'service') page = renderService();
  else {
    const account = getAccountInfo();
    if (!account) {
      // Сессия испорчена/устарела — вместо падения молча возвращаем на экран входа.
      logout();
      location.reload();
      return;
    }
    page = renderSettings(car, getAllCars(), account, ui.intervalsOpen);
  }

  let overlay = '';
  if (ui.formCategory) {
    const editingRecord = ui.editingRecordId ? getRecordById(ui.editingRecordId) : undefined;
    overlay = renderRecordForm(car, ui.formCategory.category, ui.formCategory.position, editingRecord);
  } else if (ui.activeZone) {
    overlay = renderZonePanel(car, ui.activeZone);
  } else if (ui.fuelFormOpen) {
    const editingFuel = ui.editingFuelId ? getFuelRecordById(ui.editingFuelId) : undefined;
    overlay = renderFuelForm(car, editingFuel);
  } else if (ui.carFormOpen) {
    overlay = renderCarForm();
  }

  root.innerHTML = `
    <main class="page">${page}</main>
    ${bottomNav(ui.route)}
    ${overlay}
  `;
}

function onClick(e: MouseEvent): void {
  const target = e.target as HTMLElement;

  const filterBtn = target.closest<HTMLElement>('[data-journal-filter]');
  if (filterBtn) {
    const val = filterBtn.dataset.journalFilter!;
    ui.journalFilter = val === 'all' ? null : val;
    render();
    return;
  }

  const navBtn = target.closest<HTMLElement>('[data-nav]');
  if (navBtn) {
    ui.route = navBtn.dataset.nav as Route;
    ui.activeZone = null;
    ui.formCategory = null;
    ui.editingRecordId = null;
    ui.fuelFormOpen = false;
    ui.editingFuelId = null;
    ui.carFormOpen = false;
    render();
    return;
  }

  const zoneEl = target.closest<HTMLElement>('[data-zone]');
  if (zoneEl && !ui.formCategory) {
    const nextZone = zoneEl.dataset.zone as ZoneId;
    zoneEl.classList.add('zone-tap-pulse');
    window.setTimeout(() => {
      ui.activeZone = nextZone;
      render();
    }, 150);
    return;
  }

  if (target.closest('[data-close-panel]')) {
    ui.activeZone = null;
    render();
    return;
  }

  if (target.closest('[data-close-form]')) {
    ui.formCategory = null;
    ui.editingRecordId = null;
    render();
    return;
  }

  const addBtn = target.closest<HTMLElement>('[data-add-record]');
  if (addBtn) {
    ui.formCategory = {
      category: addBtn.dataset.category as CategoryId,
      position: (addBtn.dataset.position as WheelPosition | undefined) ?? undefined,
    };
    ui.editingRecordId = null;
    render();
    return;
  }

  const editBtn = target.closest<HTMLElement>('[data-edit-record]');
  if (editBtn) {
    const id = editBtn.dataset.id!;
    const rec = getRecordById(id);
    if (rec) {
      ui.formCategory = { category: rec.category, position: rec.position };
      ui.editingRecordId = id;
      render();
    }
    return;
  }

  const delBtn = target.closest<HTMLElement>('[data-delete-record]');
  if (delBtn) {
    const id = delBtn.dataset.id!;
    if (confirm('Удалить эту запись?')) {
      deleteRecord(id);
    }
    return;
  }

  if (target.closest('[data-add-fuel]')) {
    ui.fuelFormOpen = true;
    ui.editingFuelId = null;
    fuelTouchOrder = [];
    render();
    return;
  }

  if (target.closest('[data-close-fuel-form]')) {
    ui.fuelFormOpen = false;
    ui.editingFuelId = null;
    render();
    return;
  }

  const editFuelBtn = target.closest<HTMLElement>('[data-edit-fuel]');
  if (editFuelBtn) {
    ui.editingFuelId = editFuelBtn.dataset.id!;
    ui.fuelFormOpen = true;
    fuelTouchOrder = [];
    render();
    return;
  }

  const delFuelBtn = target.closest<HTMLElement>('[data-delete-fuel]');
  if (delFuelBtn) {
    const id = delFuelBtn.dataset.id!;
    if (confirm('Удалить эту заправку?')) {
      deleteFuelRecord(id);
    }
    return;
  }

  if (target.closest('[data-add-car]')) {
    ui.carFormOpen = true;
    render();
    return;
  }

  if (target.closest('[data-close-car-form]')) {
    ui.carFormOpen = false;
    render();
    return;
  }

  const switchCarBtn = target.closest<HTMLElement>('[data-switch-car]');
  if (switchCarBtn) {
    switchCar(switchCarBtn.dataset.id!);
    return;
  }

  const delCarBtn = target.closest<HTMLElement>('[data-delete-car]');
  if (delCarBtn) {
    const id = delCarBtn.dataset.id!;
    if (confirm('Удалить этот автомобиль вместе со всей его историей обслуживания и заправок? Это необратимо.')) {
      deleteCar(id);
    }
    return;
  }

  if (target.id === 'export-btn') {
    downloadJson();
    return;
  }

  if (target.id === 'reset-btn') {
    if (confirm('Точно удалить все данные из этого браузера? Это необратимо.')) {
      resetAll();
      ui.route = 'home';
    }
    return;
  }

  if (target.id === 'logout-btn') {
    logout();
    location.reload();
    return;
  }
}

function onSubmit(e: SubmitEvent): void {
  const form = e.target as HTMLFormElement;
  if (form.id === 'fuel-form') {
    onSubmitFuel(form, e);
    return;
  }
  if (form.id === 'car-form') {
    e.preventDefault();
    const fd = new FormData(form);
    const name = String(fd.get('name') || '').trim();
    if (name) addCar(name);
    ui.carFormOpen = false;
    render();
    return;
  }
  if (form.id !== 'record-form') return;
  e.preventDefault();
  const car = getActiveCar();
  const fd = new FormData(form);
  const category = form.dataset.category as CategoryId;
  const position = form.dataset.position as WheelPosition | undefined;
  const recordId = form.dataset.recordId;

  const mileage = parseSpacedNumber(String(fd.get('mileage') || ''));
  const cost = fd.get('cost') ? Number(fd.get('cost')) : undefined;
  const seasonRaw = String(fd.get('season') || '');
  const values = {
    date: String(fd.get('date')),
    mileage,
    brand: String(fd.get('brand') || '') || undefined,
    spec: String(fd.get('spec') || '') || undefined,
    season: (seasonRaw || undefined) as SeasonType | undefined,
    cost,
    notes: String(fd.get('notes') || '') || undefined,
  };

  if (recordId) {
    updateRecord(recordId, values);
  } else if (category === 'tires' && position) {
    const scope = String(fd.get('tireScope') || 'single');
    for (const pos of tireScopePositions(scope, position)) {
      addRecord({ carId: car.id, category, position: pos, ...values });
    }
  } else {
    addRecord({ carId: car.id, category, position, ...values });
  }

  ui.formCategory = null;
  ui.editingRecordId = null;
  render();
}

function onSubmitFuel(form: HTMLFormElement, e: SubmitEvent): void {
  e.preventDefault();
  const car = getActiveCar();
  const fd = new FormData(form);
  const recordId = form.dataset.recordId;

  const values = {
    date: String(fd.get('date')),
    mileage: parseSpacedNumber(String(fd.get('mileage') || '')),
    liters: Number(fd.get('liters')),
    cost: Number(fd.get('cost')),
  };

  if (recordId) {
    updateFuelRecord(recordId, values);
  } else {
    addFuelRecord({ carId: car.id, ...values });
  }

  ui.fuelFormOpen = false;
  ui.editingFuelId = null;
  render();
}

function onInput(e: Event): void {
  const target = e.target as HTMLElement;
  if (!(target instanceof HTMLInputElement)) return;

  if (target.id === 'trip-distance-input') {
    const distance = Number(target.value);
    const avg = Number(target.dataset.avgConsumption);
    const price = Number(target.dataset.avgPrice);
    const resultEl = document.getElementById('trip-result');
    if (!resultEl) return;
    if (distance > 0 && avg > 0 && price > 0) {
      const liters = (distance / 100) * avg;
      const cost = liters * price;
      resultEl.textContent = `≈ ${liters.toFixed(1)} л · ≈ ${Math.round(cost)} ₽`;
    } else if (avg > 0 && price > 0) {
      resultEl.textContent = 'Введите расстояние — посчитаю расход и стоимость';
    }
    return;
  }

  const fuelField = target.dataset.fuelField as FuelField | undefined;
  if (fuelField) {
    const form = target.closest<HTMLFormElement>('#fuel-form');
    if (form) onFuelFieldInput(fuelField, form);
    return;
  }

  if (!target.classList.contains('num-spaced')) return;

  const caret = target.selectionStart ?? target.value.length;
  const digitsBeforeCaret = target.value.slice(0, caret).replace(/\D/g, '').length;

  const formatted = formatDigitsWithSpaces(target.value);
  target.value = formatted;

  let pos = 0;
  let seen = 0;
  while (pos < formatted.length && seen < digitsBeforeCaret) {
    if (formatted[pos] !== ' ') seen++;
    pos++;
  }
  target.setSelectionRange(pos, pos);
}

function onChange(e: Event): void {
  const target = e.target as HTMLElement;

  if (target.id === 'odometer-input') {
    const val = parseSpacedNumber((target as HTMLInputElement).value);
    if (!Number.isNaN(val)) updateCar({ odometer: val });
    return;
  }

  if (target.id === 'car-name-input') {
    const val = (target as HTMLInputElement).value.trim();
    if (val) updateCar({ name: val });
    return;
  }

  if (target.id === 'car-brand-input') {
    updateCar({ brand: (target as HTMLInputElement).value.trim() || undefined });
    return;
  }

  if (target.id === 'car-model-input') {
    updateCar({ model: (target as HTMLInputElement).value.trim() || undefined });
    return;
  }

  if (target.id === 'car-engine-type-input') {
    updateCar({ engineType: (target as HTMLInputElement).value.trim() || undefined });
    return;
  }

  if (target.id === 'car-engine-volume-input') {
    const raw = (target as HTMLInputElement).value;
    const val = raw ? Number(raw) : NaN;
    updateCar({ engineVolume: Number.isFinite(val) ? val : undefined });
    return;
  }

  if (target.id === 'car-engine-power-input') {
    const raw = (target as HTMLInputElement).value;
    const val = raw ? Number(raw) : NaN;
    updateCar({ enginePower: Number.isFinite(val) ? val : undefined });
    return;
  }

  if (target.id === 'car-tank-capacity-input') {
    const raw = (target as HTMLInputElement).value;
    const val = raw ? Number(raw) : NaN;
    updateCar({ tankCapacity: Number.isFinite(val) ? val : undefined });
    return;
  }

  if (target.id === 'car-drive-type-input') {
    updateCar({ driveType: (target as HTMLSelectElement).value as DriveType });
    return;
  }

  if (target.classList.contains('interval-input')) {
    const category = (target as HTMLElement).dataset.category as CategoryId;
    const digits = (target as HTMLInputElement).value.replace(/\D/g, '');
    setCustomInterval(category, digits ? Number(digits) : undefined);
    return;
  }

  if (target.id === 'import-input') {
    const input = target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      try {
        importJson(text);
        alert('Данные импортированы');
      } catch {
        alert('Не удалось прочитать файл — проверьте формат.');
      }
    });
  }
}

function downloadJson(): void {
  const blob = new Blob([exportJson()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `auto-journal-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
