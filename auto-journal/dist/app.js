import { addRecord, deleteRecord, exportJson, getActiveCar, getRecordById, importJson, resetAll, subscribe, updateCar, updateRecord, } from './store.js';
import { bottomNav, renderHome, renderJournal, renderService, renderSettings, renderZonePanel, renderRecordForm, } from './view.js';
import { formatDigitsWithSpaces, parseSpacedNumber } from './format.js';
function tireScopePositions(scope, base) {
    if (scope === 'front')
        return ['FL', 'FR'];
    if (scope === 'rear')
        return ['RL', 'RR'];
    if (scope === 'all')
        return ['FL', 'FR', 'RL', 'RR'];
    return [base];
}
const ui = {
    route: 'home',
    activeZone: null,
    formCategory: null,
    editingRecordId: null,
    journalFilter: null,
};
let root;
export function mountApp(rootEl) {
    root = rootEl;
    subscribe(render);
    root.addEventListener('click', onClick);
    root.addEventListener('submit', onSubmit);
    root.addEventListener('change', onChange);
    root.addEventListener('input', onInput);
    render();
}
function render() {
    const car = getActiveCar();
    let page = '';
    if (ui.route === 'home')
        page = renderHome(car);
    else if (ui.route === 'journal')
        page = renderJournal(car, ui.journalFilter);
    else if (ui.route === 'service')
        page = renderService();
    else
        page = renderSettings(car);
    let overlay = '';
    if (ui.formCategory) {
        const editingRecord = ui.editingRecordId ? getRecordById(ui.editingRecordId) : undefined;
        overlay = renderRecordForm(car, ui.formCategory.category, ui.formCategory.position, editingRecord);
    }
    else if (ui.activeZone) {
        overlay = renderZonePanel(car, ui.activeZone);
    }
    root.innerHTML = `
    <main class="page">${page}</main>
    ${bottomNav(ui.route)}
    ${overlay}
  `;
}
function onClick(e) {
    const target = e.target;
    const filterBtn = target.closest('[data-journal-filter]');
    if (filterBtn) {
        const val = filterBtn.dataset.journalFilter;
        ui.journalFilter = val === 'all' ? null : val;
        render();
        return;
    }
    const navBtn = target.closest('[data-nav]');
    if (navBtn) {
        ui.route = navBtn.dataset.nav;
        ui.activeZone = null;
        ui.formCategory = null;
        ui.editingRecordId = null;
        render();
        return;
    }
    const zoneEl = target.closest('[data-zone]');
    if (zoneEl && !ui.formCategory) {
        ui.activeZone = zoneEl.dataset.zone;
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
    const addBtn = target.closest('[data-add-record]');
    if (addBtn) {
        ui.formCategory = {
            category: addBtn.dataset.category,
            position: addBtn.dataset.position ?? undefined,
        };
        ui.editingRecordId = null;
        render();
        return;
    }
    const editBtn = target.closest('[data-edit-record]');
    if (editBtn) {
        const id = editBtn.dataset.id;
        const rec = getRecordById(id);
        if (rec) {
            ui.formCategory = { category: rec.category, position: rec.position };
            ui.editingRecordId = id;
            render();
        }
        return;
    }
    const delBtn = target.closest('[data-delete-record]');
    if (delBtn) {
        const id = delBtn.dataset.id;
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
function onSubmit(e) {
    const form = e.target;
    if (form.id !== 'record-form')
        return;
    e.preventDefault();
    const car = getActiveCar();
    const fd = new FormData(form);
    const category = form.dataset.category;
    const position = form.dataset.position;
    const recordId = form.dataset.recordId;
    const mileage = parseSpacedNumber(String(fd.get('mileage') || ''));
    const cost = fd.get('cost') ? Number(fd.get('cost')) : undefined;
    const seasonRaw = String(fd.get('season') || '');
    const values = {
        date: String(fd.get('date')),
        mileage,
        brand: String(fd.get('brand') || '') || undefined,
        spec: String(fd.get('spec') || '') || undefined,
        season: (seasonRaw || undefined),
        cost,
        notes: String(fd.get('notes') || '') || undefined,
    };
    if (recordId) {
        updateRecord(recordId, values);
    }
    else if (category === 'tires' && position) {
        const scope = String(fd.get('tireScope') || 'single');
        for (const pos of tireScopePositions(scope, position)) {
            addRecord({ carId: car.id, category, position: pos, ...values });
        }
    }
    else {
        addRecord({ carId: car.id, category, position, ...values });
    }
    ui.formCategory = null;
    ui.editingRecordId = null;
    render();
}
function onInput(e) {
    const target = e.target;
    if (!(target instanceof HTMLInputElement) || !target.classList.contains('num-spaced'))
        return;
    const caret = target.selectionStart ?? target.value.length;
    const digitsBeforeCaret = target.value.slice(0, caret).replace(/\D/g, '').length;
    const formatted = formatDigitsWithSpaces(target.value);
    target.value = formatted;
    let pos = 0;
    let seen = 0;
    while (pos < formatted.length && seen < digitsBeforeCaret) {
        if (formatted[pos] !== ' ')
            seen++;
        pos++;
    }
    target.setSelectionRange(pos, pos);
}
function onChange(e) {
    const target = e.target;
    if (target.id === 'odometer-input') {
        const val = parseSpacedNumber(target.value);
        if (!Number.isNaN(val))
            updateCar({ odometer: val });
        return;
    }
    if (target.id === 'car-name-input') {
        const val = target.value.trim();
        if (val)
            updateCar({ name: val });
        return;
    }
    if (target.id === 'car-brand-input') {
        updateCar({ brand: target.value.trim() || undefined });
        return;
    }
    if (target.id === 'car-model-input') {
        updateCar({ model: target.value.trim() || undefined });
        return;
    }
    if (target.id === 'car-engine-type-input') {
        updateCar({ engineType: target.value.trim() || undefined });
        return;
    }
    if (target.id === 'car-engine-volume-input') {
        const raw = target.value;
        const val = raw ? Number(raw) : NaN;
        updateCar({ engineVolume: Number.isFinite(val) ? val : undefined });
        return;
    }
    if (target.id === 'car-engine-power-input') {
        const raw = target.value;
        const val = raw ? Number(raw) : NaN;
        updateCar({ enginePower: Number.isFinite(val) ? val : undefined });
        return;
    }
    if (target.id === 'car-fuel-consumption-input') {
        const raw = target.value;
        const val = raw ? Number(raw) : NaN;
        updateCar({ fuelConsumption: Number.isFinite(val) ? val : undefined });
        return;
    }
    if (target.id === 'import-input') {
        const input = target;
        const file = input.files?.[0];
        if (!file)
            return;
        file.text().then((text) => {
            try {
                importJson(text);
                alert('Данные импортированы');
            }
            catch {
                alert('Не удалось прочитать файл — проверьте формат.');
            }
        });
    }
}
function downloadJson() {
    const blob = new Blob([exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auto-journal-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}
