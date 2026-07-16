import {
  addRecord,
  deleteRecord,
  exportJson,
  getActiveCar,
  getRecordById,
  importJson,
  resetAll,
  subscribe,
  updateCar,
  updateRecord,
} from './store.js';
import {
  bottomNav,
  renderHome,
  renderJournal,
  renderService,
  renderSettings,
  renderZonePanel,
  renderRecordForm,
  type Route,
  type UiState,
} from './view.js';
import type { CategoryId, SeasonType, WheelPosition, ZoneId } from './types.js';
import { formatDigitsWithSpaces, parseSpacedNumber } from './format.js';

function tireScopePositions(scope: string, base: WheelPosition): WheelPosition[] {
  if (scope === 'front') return ['FL', 'FR'];
  if (scope === 'rear') return ['RL', 'RR'];
  if (scope === 'all') return ['FL', 'FR', 'RL', 'RR'];
  return [base];
}

const ui: UiState = {
  route: 'home',
  activeZone: null,
  formCategory: null,
  editingRecordId: null,
  journalFilter: null,
};

let root: HTMLElement;

export function mountApp(rootEl: HTMLElement): void {
  root = rootEl;
  subscribe(render);
  root.addEventListener('click', onClick);
  root.addEventListener('submit', onSubmit as EventListener);
  root.addEventListener('change', onChange);
  root.addEventListener('input', onInput);
  render();
}

function render(): void {
  const car = getActiveCar();
  let page = '';
  if (ui.route === 'home') page = renderHome(car);
  else if (ui.route === 'journal') page = renderJournal(car, ui.journalFilter);
  else if (ui.route === 'service') page = renderService();
  else page = renderSettings(car);

  let overlay = '';
  if (ui.formCategory) {
    const editingRecord = ui.editingRecordId ? getRecordById(ui.editingRecordId) : undefined;
    overlay = renderRecordForm(car, ui.formCategory.category, ui.formCategory.position, editingRecord);
  } else if (ui.activeZone) {
    overlay = renderZonePanel(car, ui.activeZone);
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
    render();
    return;
  }

  const zoneEl = target.closest<HTMLElement>('[data-zone]');
  if (zoneEl && !ui.formCategory) {
    ui.activeZone = zoneEl.dataset.zone as ZoneId;
    render();
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
}

function onSubmit(e: SubmitEvent): void {
  const form = e.target as HTMLFormElement;
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

function onInput(e: Event): void {
  const target = e.target as HTMLElement;
  if (!(target instanceof HTMLInputElement) || !target.classList.contains('num-spaced')) return;

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

  if (target.id === 'car-fuel-consumption-input') {
    const raw = (target as HTMLInputElement).value;
    const val = raw ? Number(raw) : NaN;
    updateCar({ fuelConsumption: Number.isFinite(val) ? val : undefined });
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
