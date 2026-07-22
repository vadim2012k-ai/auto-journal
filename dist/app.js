import { addCar, addFuelRecord, addRecord, addRepairRecord, deleteCar, deleteFuelRecord, deleteRecord, deleteRepairRecord, exportJson, getActiveCar, getAccountInfo, getAllCars, getAllRecordsForCar, getFuelRecordById, getFuelRecordsForCar, getRecordById, getRepairRecordById, importJson, setCustomInterval, subscribe, switchCar, updateCar, updateFuelRecord, updateRecord, updateRepairRecord, } from './store.js';
import { bottomNav, buildGraphDomain, GRAPH_MIN_SPAN_MS, GRAPH_PAD_L, GRAPH_PAD_R, GRAPH_VB_W, renderCarForm, renderFuel, renderFuelForm, renderGraphChart, renderHome, renderJournal, renderPhotoCropForm, renderRepairForm, renderService, renderSettings, renderZonePanel, renderRecordForm, } from './view.js';
import { formatDigitsWithSpaces, formatKm, parseSpacedNumber } from './format.js';
import { logout } from './auth.js';
import { lookupVin } from './vin.js';
function tireScopePositions(scope, base) {
    if (scope === 'front')
        return ['FL', 'FR'];
    if (scope === 'rear')
        return ['RL', 'RR'];
    if (scope === 'all')
        return ['FL', 'FR', 'RL', 'RR'];
    return [base];
}
// Порядок полей формы заправки, тронутых пользователем (старые — в начале).
// Сбрасывается при каждом открытии формы заправки.
let fuelTouchOrder = [];
function onFuelFieldInput(field, form) {
    fuelTouchOrder = fuelTouchOrder.filter((f) => f !== field);
    fuelTouchOrder.push(field);
    const litersEl = form.querySelector('[data-fuel-field="liters"]');
    const costEl = form.querySelector('[data-fuel-field="cost"]');
    const priceEl = form.querySelector('[data-fuel-field="price"]');
    if (!litersEl || !costEl || !priceEl)
        return;
    const liters = Number(litersEl.value);
    const cost = Number(costEl.value);
    const price = Number(priceEl.value);
    const valid = (n) => Number.isFinite(n) && n > 0;
    const allFields = ['liters', 'cost', 'price'];
    const untouched = allFields.filter((f) => !fuelTouchOrder.includes(f));
    let target = null;
    if (untouched.length === 1)
        target = untouched[0];
    else if (fuelTouchOrder.length === 3)
        target = fuelTouchOrder[0];
    if (!target)
        return;
    if (target === 'cost' && valid(liters) && valid(price)) {
        costEl.value = (liters * price).toFixed(0);
    }
    else if (target === 'liters' && valid(cost) && valid(price)) {
        litersEl.value = (cost / price).toFixed(2);
    }
    else if (target === 'price' && valid(liters) && valid(cost)) {
        priceEl.value = (cost / liters).toFixed(2);
    }
}
const ui = {
    route: 'home',
    activeZone: null,
    formCategory: null,
    editingRecordId: null,
    journalFilter: null,
    fuelFormOpen: false,
    editingFuelId: null,
    repairFormOpen: false,
    editingRepairId: null,
    carFormOpen: false,
    intervalsOpen: false,
    photoFormOpen: false,
    graphOpen: false,
    graphViewStart: null,
    graphViewEnd: null,
    graphActiveDate: null,
};
// Перетаскивание/масштаб графика — своё состояние вне ui/render по той же
// причине, что и обрезка фото: двигаем впрямую через DOM на каждый пиксель,
// без полной перерисовки страницы.
let graphDragging = false;
let graphDragStartX = 0;
let graphDragStartViewStart = 0;
let graphDragStartViewEnd = 0;
function currentGraphDomain() {
    const car = getActiveCar();
    return buildGraphDomain(car, getAllRecordsForCar(car.id));
}
function redrawGraph() {
    const host = document.getElementById('graph-chart-host');
    if (!host)
        return;
    const car = getActiveCar();
    const domain = currentGraphDomain();
    const view = { start: ui.graphViewStart ?? domain.start, end: ui.graphViewEnd ?? domain.end };
    host.innerHTML = renderGraphChart(car, domain, view, ui.graphActiveDate);
}
function graphZoomBy(factor, focalMs) {
    const domain = currentGraphDomain();
    const curStart = ui.graphViewStart ?? domain.start;
    const curEnd = ui.graphViewEnd ?? domain.end;
    const curSpan = curEnd - curStart;
    const focal = focalMs ?? (curStart + curEnd) / 2;
    const fullSpan = domain.end - domain.start;
    let newSpan = Math.min(fullSpan, Math.max(GRAPH_MIN_SPAN_MS, curSpan / factor));
    const ratio = curSpan > 0 ? (focal - curStart) / curSpan : 0.5;
    let newStart = focal - ratio * newSpan;
    let newEnd = newStart + newSpan;
    if (newStart < domain.start) {
        newEnd += domain.start - newStart;
        newStart = domain.start;
    }
    if (newEnd > domain.end) {
        newStart -= newEnd - domain.end;
        newEnd = domain.end;
    }
    ui.graphViewStart = Math.max(domain.start, newStart);
    ui.graphViewEnd = Math.min(domain.end, newEnd);
    redrawGraph();
}
// Обрезка фото автомобиля в кружок — своё маленькое состояние вне ui/render,
// т.к. перетаскивание/зум двигают картинку впрямую через DOM на каждый пиксель,
// без полной перерисовки (иначе будет тормозить и сбрасывать жест).
const CROP_VIEWPORT = 260; // px, должно совпадать с .photo-crop-viewport в CSS
const CROP_OUTPUT = 320; // px — сторона итогового квадратного фото
let cropRawDataUrl = null;
let cropBaseScale = 0;
let cropZoomMultiplier = 1;
let cropImgLeft = 0;
let cropImgTop = 0;
let cropImgWidth = 0;
let cropImgHeight = 0;
let cropDragging = false;
let cropDragStartX = 0;
let cropDragStartY = 0;
let cropDragStartLeft = 0;
let cropDragStartTop = 0;
function applyCropZoom() {
    const img = document.getElementById('photo-crop-img');
    if (!img || !img.naturalWidth)
        return;
    const scale = cropBaseScale * cropZoomMultiplier;
    cropImgWidth = img.naturalWidth * scale;
    cropImgHeight = img.naturalHeight * scale;
    cropImgLeft = (CROP_VIEWPORT - cropImgWidth) / 2;
    cropImgTop = (CROP_VIEWPORT - cropImgHeight) / 2;
    img.style.width = `${cropImgWidth}px`;
    img.style.height = `${cropImgHeight}px`;
    img.style.left = `${cropImgLeft}px`;
    img.style.top = `${cropImgTop}px`;
}
function initPhotoCrop() {
    const img = document.getElementById('photo-crop-img');
    if (!img)
        return;
    cropZoomMultiplier = 1;
    const setup = () => {
        if (!img.naturalWidth || !img.naturalHeight)
            return;
        cropBaseScale = Math.max(CROP_VIEWPORT / img.naturalWidth, CROP_VIEWPORT / img.naturalHeight);
        applyCropZoom();
    };
    if (img.complete)
        setup();
    else
        img.onload = setup;
}
let root;
export function mountApp(rootEl) {
    root = rootEl;
    subscribe(render);
    root.addEventListener('click', onClick);
    root.addEventListener('submit', onSubmit);
    root.addEventListener('change', onChange);
    root.addEventListener('input', onInput);
    root.addEventListener('touchstart', onTouchStart, { passive: true });
    root.addEventListener('touchend', onTouchEnd);
    root.addEventListener('focusin', onFocusIn);
    root.addEventListener('pointerdown', onPointerDown);
    root.addEventListener('pointermove', onPointerMove);
    root.addEventListener('pointerup', onPointerUp);
    root.addEventListener('pointercancel', onPointerUp);
    root.addEventListener('pointerleave', onPointerUp, true);
    // 'toggle' не всплывает — слушаем на фазе погружения (capture),
    // чтобы запомнить, открыт ли <details>, и не сбрасывать это при перерисовке.
    root.addEventListener('toggle', onToggle, true);
    root.addEventListener('wheel', onWheel, { passive: false });
    render();
}
function onWheel(e) {
    const host = e.target.closest('#graph-chart-host');
    if (!host)
        return;
    e.preventDefault();
    const domain = currentGraphDomain();
    const view = { start: ui.graphViewStart ?? domain.start, end: ui.graphViewEnd ?? domain.end };
    const rect = host.getBoundingClientRect();
    const xVb = ((e.clientX - rect.left) / rect.width) * GRAPH_VB_W;
    const plotLeft = GRAPH_PAD_L;
    const plotRight = GRAPH_VB_W - GRAPH_PAD_R;
    const t = (xVb - plotLeft) / (plotRight - plotLeft);
    const focalMs = view.start + t * (view.end - view.start);
    graphZoomBy(e.deltaY < 0 ? 1.2 : 1 / 1.2, focalMs);
}
function onToggle(e) {
    const target = e.target;
    if (target.classList.contains('graph-toggle')) {
        ui.graphOpen = target.open;
        return;
    }
    if (target.classList.contains('intervals-toggle')) {
        ui.intervalsOpen = target.open;
    }
}
// Подсветка нажатия кнопок/карточек своими силами: мы отключили нативный
// -webkit-tap-highlight-color (убирает уродливую синюю вспышку на тапе),
// но из-за этого на телефоне пропала вообще любая обратная связь при
// нажатии — на компьютере её показывает браузер сам, на тач-устройствах
// нет. Единый JS-обработчик работает одинаково для мыши и пальца.
const PRESSABLE = '.btn, .nav-btn, .car-row, .journal-row, .filter-chip, .icon-btn, .icon-btn-sm, .auth-tab';
let pressedEl = null;
function onPointerDown(e) {
    const target = e.target.closest(PRESSABLE);
    if (target) {
        target.classList.add('pressed');
        pressedEl = target;
    }
    if (e.target.closest('#photo-crop-viewport')) {
        cropDragging = true;
        cropDragStartX = e.clientX;
        cropDragStartY = e.clientY;
        cropDragStartLeft = cropImgLeft;
        cropDragStartTop = cropImgTop;
    }
    if (e.target.closest('#graph-chart-host')) {
        const domain = currentGraphDomain();
        graphDragging = true;
        graphDragStartX = e.clientX;
        graphDragStartViewStart = ui.graphViewStart ?? domain.start;
        graphDragStartViewEnd = ui.graphViewEnd ?? domain.end;
    }
}
function onPointerMove(e) {
    if (cropDragging) {
        const img = document.getElementById('photo-crop-img');
        if (!img)
            return;
        const minLeft = CROP_VIEWPORT - cropImgWidth;
        const minTop = CROP_VIEWPORT - cropImgHeight;
        cropImgLeft = Math.min(0, Math.max(minLeft, cropDragStartLeft + (e.clientX - cropDragStartX)));
        cropImgTop = Math.min(0, Math.max(minTop, cropDragStartTop + (e.clientY - cropDragStartY)));
        img.style.left = `${cropImgLeft}px`;
        img.style.top = `${cropImgTop}px`;
        return;
    }
    if (graphDragging) {
        const host = document.getElementById('graph-chart-host');
        if (!host)
            return;
        const domain = currentGraphDomain();
        const rect = host.getBoundingClientRect();
        const plotFraction = (GRAPH_VB_W - GRAPH_PAD_L - GRAPH_PAD_R) / GRAPH_VB_W;
        const plotWidthPx = rect.width * plotFraction;
        if (plotWidthPx <= 0)
            return;
        const span = graphDragStartViewEnd - graphDragStartViewStart;
        const dxMs = (-(e.clientX - graphDragStartX) / plotWidthPx) * span;
        let newStart = graphDragStartViewStart + dxMs;
        let newEnd = graphDragStartViewEnd + dxMs;
        if (newStart < domain.start) {
            newEnd += domain.start - newStart;
            newStart = domain.start;
        }
        if (newEnd > domain.end) {
            newStart -= newEnd - domain.end;
            newEnd = domain.end;
        }
        ui.graphViewStart = Math.max(domain.start, newStart);
        ui.graphViewEnd = Math.min(domain.end, newEnd);
        redrawGraph();
    }
}
function onPointerUp() {
    if (pressedEl) {
        pressedEl.classList.remove('pressed');
        pressedEl = null;
    }
    cropDragging = false;
    graphDragging = false;
}
// При фокусе на числовое поле (пробег и т.п.) выделяем всё содержимое —
// иначе новые цифры дописываются к старому значению (например, к "0"),
// а не заменяют его.
function onFocusIn(e) {
    const target = e.target;
    if (target instanceof HTMLInputElement && target.classList.contains('num-spaced')) {
        target.select();
    }
}
let swipeStartX = 0;
let swipeStartY = 0;
let swipeActive = false;
function onTouchStart(e) {
    // Та же защита, что и в onClick, но ещё раньше — на самое первое касание,
    // с максимальным запасом времени до перерисовки от последующего клика.
    const touchTarget = e.target;
    const active = document.activeElement;
    if ((active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) &&
        active !== touchTarget &&
        !touchTarget.contains(active)) {
        active.blur();
    }
    const target = touchTarget.closest('[data-car-swipe]');
    if (!target || e.touches.length !== 1) {
        swipeActive = false;
        return;
    }
    swipeActive = true;
    swipeStartX = e.touches[0].clientX;
    swipeStartY = e.touches[0].clientY;
}
function onTouchEnd(e) {
    if (!swipeActive)
        return;
    swipeActive = false;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - swipeStartX;
    const dy = touch.clientY - swipeStartY;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.4)
        return;
    const cars = getAllCars();
    if (cars.length < 2)
        return;
    const idx = cars.findIndex((c) => c.id === getActiveCar().id);
    if (idx === -1)
        return;
    const nextIdx = dx < 0 ? (idx + 1) % cars.length : (idx - 1 + cars.length) % cars.length;
    switchCar(cars[nextIdx].id);
}
function render() {
    const car = getActiveCar();
    let page = '';
    if (ui.route === 'home')
        page = renderHome(car, getAllCars(), ui);
    else if (ui.route === 'journal')
        page = renderJournal(car, ui.journalFilter);
    else if (ui.route === 'fuel')
        page = renderFuel(car, getFuelRecordsForCar(car.id));
    else if (ui.route === 'service')
        page = renderService();
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
    }
    else if (ui.activeZone) {
        overlay = renderZonePanel(car, ui.activeZone);
    }
    else if (ui.fuelFormOpen) {
        const editingFuel = ui.editingFuelId ? getFuelRecordById(ui.editingFuelId) : undefined;
        overlay = renderFuelForm(car, editingFuel);
    }
    else if (ui.repairFormOpen) {
        const editingRepair = ui.editingRepairId ? getRepairRecordById(ui.editingRepairId) : undefined;
        overlay = renderRepairForm(car, editingRepair);
    }
    else if (ui.photoFormOpen && cropRawDataUrl) {
        overlay = renderPhotoCropForm(cropRawDataUrl);
    }
    else if (ui.carFormOpen) {
        overlay = renderCarForm();
    }
    root.innerHTML = `
    <main class="page">${page}</main>
    ${bottomNav(ui.route)}
    ${overlay}
  `;
    if (ui.photoFormOpen && cropRawDataUrl)
        initPhotoCrop();
}
function onClick(e) {
    const target = e.target;
    // Если сейчас в фокусе поле ввода (например, только что печатали пробег) и
    // клик пришёлся мимо него — принудительно "отпускаем" поле ПЕРЕД обработкой
    // клика. Иначе клик (навигация и т.п.) может перерисовать страницу раньше,
    // чем сработает 'change' у поля, и несохранённый ввод просто пропадёт.
    const active = document.activeElement;
    if ((active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) &&
        active !== target &&
        !target.contains(active)) {
        active.blur();
    }
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
        ui.fuelFormOpen = false;
        ui.editingFuelId = null;
        ui.repairFormOpen = false;
        ui.editingRepairId = null;
        ui.photoFormOpen = false;
        cropRawDataUrl = null;
        ui.carFormOpen = false;
        ui.graphViewStart = null;
        ui.graphViewEnd = null;
        ui.graphActiveDate = null;
        render();
        return;
    }
    const zoneEl = target.closest('[data-zone]');
    if (zoneEl && !ui.formCategory) {
        const nextZone = zoneEl.dataset.zone;
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
    const editFuelBtn = target.closest('[data-edit-fuel]');
    if (editFuelBtn) {
        ui.editingFuelId = editFuelBtn.dataset.id;
        ui.fuelFormOpen = true;
        fuelTouchOrder = [];
        render();
        return;
    }
    const delFuelBtn = target.closest('[data-delete-fuel]');
    if (delFuelBtn) {
        const id = delFuelBtn.dataset.id;
        if (confirm('Удалить эту заправку?')) {
            deleteFuelRecord(id);
        }
        return;
    }
    if (target.closest('[data-add-repair]')) {
        ui.repairFormOpen = true;
        ui.editingRepairId = null;
        render();
        return;
    }
    if (target.closest('[data-close-repair-form]')) {
        ui.repairFormOpen = false;
        ui.editingRepairId = null;
        render();
        return;
    }
    const editRepairBtn = target.closest('[data-edit-repair]');
    if (editRepairBtn) {
        ui.editingRepairId = editRepairBtn.dataset.id;
        ui.repairFormOpen = true;
        render();
        return;
    }
    const delRepairBtn = target.closest('[data-delete-repair]');
    if (delRepairBtn) {
        const id = delRepairBtn.dataset.id;
        if (confirm('Удалить эту запись о ремонте?')) {
            deleteRepairRecord(id);
        }
        return;
    }
    if (target.closest('[data-close-photo-form]')) {
        ui.photoFormOpen = false;
        cropRawDataUrl = null;
        render();
        return;
    }
    if (target.closest('[data-photo-crop-save]')) {
        const img = document.getElementById('photo-crop-img');
        if (img && cropImgWidth && cropImgHeight) {
            const factor = CROP_OUTPUT / CROP_VIEWPORT;
            const canvas = document.createElement('canvas');
            canvas.width = CROP_OUTPUT;
            canvas.height = CROP_OUTPUT;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, cropImgLeft * factor, cropImgTop * factor, cropImgWidth * factor, cropImgHeight * factor);
                updateCar({ photo: canvas.toDataURL('image/jpeg', 0.85) });
            }
        }
        ui.photoFormOpen = false;
        cropRawDataUrl = null;
        render();
        return;
    }
    if (target.closest('[data-remove-photo]')) {
        if (confirm('Удалить фото автомобиля?')) {
            updateCar({ photo: undefined });
        }
        return;
    }
    if (target.closest('[data-graph-zoom-in]')) {
        graphZoomBy(1.6);
        return;
    }
    if (target.closest('[data-graph-zoom-out]')) {
        graphZoomBy(1 / 1.6);
        return;
    }
    if (target.closest('[data-graph-reset]')) {
        ui.graphViewStart = null;
        ui.graphViewEnd = null;
        redrawGraph();
        return;
    }
    const graphPointEl = target.closest('[data-graph-point]');
    if (graphPointEl) {
        const date = graphPointEl.dataset.date;
        ui.graphActiveDate = ui.graphActiveDate === date ? null : date;
        redrawGraph();
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
    const switchCarBtn = target.closest('[data-switch-car]');
    if (switchCarBtn) {
        switchCar(switchCarBtn.dataset.id);
        return;
    }
    const delCarBtn = target.closest('[data-delete-car]');
    if (delCarBtn) {
        const id = delCarBtn.dataset.id;
        if (confirm('Удалить этот автомобиль вместе со всей его историей обслуживания и заправок? Это необратимо.')) {
            deleteCar(id);
        }
        return;
    }
    if (target.id === 'export-btn') {
        downloadJson();
        return;
    }
    if (target.id === 'logout-btn') {
        logout();
        location.reload();
        return;
    }
    if (target.id === 'save-odometer-btn') {
        const input = document.getElementById('odometer-input');
        if (!input)
            return;
        const val = parseSpacedNumber(input.value);
        if (Number.isNaN(val))
            return;
        updateCar({ odometer: val });
        // updateCar уже перерисовал страницу — хватаем СВЕЖИЙ элемент подсказки.
        const hint = document.getElementById('odometer-save-hint');
        if (hint) {
            hint.textContent = '✓ Сохранено';
            setTimeout(() => {
                hint.textContent = '';
            }, 2000);
        }
        return;
    }
    if (target.id === 'vin-lookup-btn') {
        const input = document.getElementById('car-vin-input');
        const hint = document.getElementById('vin-lookup-hint');
        const btn = target;
        if (!input)
            return;
        const vin = input.value.trim().toUpperCase();
        input.value = vin;
        if (hint)
            hint.textContent = 'Ищу в базе NHTSA…';
        btn.disabled = true;
        lookupVin(vin).then((result) => {
            btn.disabled = false;
            if (!result.ok) {
                const hintEl = document.getElementById('vin-lookup-hint');
                if (hintEl)
                    hintEl.textContent = `⚠️ ${result.error}`;
                return;
            }
            const patch = { vin };
            if (result.brand)
                patch.brand = result.brand;
            if (result.model)
                patch.model = result.model;
            if (result.year)
                patch.year = result.year;
            if (result.engineType)
                patch.engineType = result.engineType;
            if (result.engineVolume)
                patch.engineVolume = result.engineVolume;
            if (result.enginePower)
                patch.enginePower = result.enginePower;
            if (result.driveType)
                patch.driveType = result.driveType;
            updateCar(patch);
            // updateCar уже перерисовал страницу — хватаем СВЕЖИЙ элемент подсказки.
            const freshHint = document.getElementById('vin-lookup-hint');
            if (freshHint) {
                const found = [result.brand, result.model, result.year].filter(Boolean).join(' ');
                freshHint.textContent = `✓ Найдено: ${found}`;
                setTimeout(() => {
                    freshHint.textContent = '';
                }, 5000);
            }
        });
        return;
    }
}
function onSubmit(e) {
    const form = e.target;
    if (form.id === 'fuel-form') {
        onSubmitFuel(form, e);
        return;
    }
    if (form.id === 'repair-form') {
        onSubmitRepair(form, e);
        return;
    }
    if (form.id === 'car-form') {
        e.preventDefault();
        const fd = new FormData(form);
        const name = String(fd.get('name') || '').trim();
        if (name)
            addCar(name);
        ui.carFormOpen = false;
        render();
        return;
    }
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
function onSubmitFuel(form, e) {
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
    }
    else {
        addFuelRecord({ carId: car.id, ...values });
    }
    ui.fuelFormOpen = false;
    ui.editingFuelId = null;
    render();
}
function onSubmitRepair(form, e) {
    e.preventDefault();
    const car = getActiveCar();
    const fd = new FormData(form);
    const recordId = form.dataset.recordId;
    const values = {
        title: String(fd.get('title') || '').trim(),
        date: String(fd.get('date')),
        mileage: parseSpacedNumber(String(fd.get('mileage') || '')),
        brand: String(fd.get('brand') || '') || undefined,
        spec: String(fd.get('spec') || '') || undefined,
        cost: fd.get('cost') && String(fd.get('cost')).replace(/\D/g, '') ? parseSpacedNumber(String(fd.get('cost'))) : undefined,
        notes: String(fd.get('notes') || '') || undefined,
    };
    if (recordId) {
        updateRepairRecord(recordId, values);
    }
    else {
        addRepairRecord({ carId: car.id, ...values });
    }
    ui.repairFormOpen = false;
    ui.editingRepairId = null;
    render();
}
function onInput(e) {
    const target = e.target;
    if (!(target instanceof HTMLInputElement))
        return;
    if (target.id === 'photo-crop-zoom') {
        cropZoomMultiplier = Number(target.value) / 100;
        applyCropZoom();
        return;
    }
    if (target.id === 'trip-distance-input') {
        const distance = Number(target.value);
        const avg = Number(target.dataset.avgConsumption);
        const price = Number(target.dataset.avgPrice);
        const resultEl = document.getElementById('trip-result');
        if (!resultEl)
            return;
        if (distance > 0 && avg > 0 && price > 0) {
            const liters = (distance / 100) * avg;
            const cost = liters * price;
            resultEl.textContent = `≈ ${liters.toFixed(1)} л · ≈ ${Math.round(cost)} ₽`;
        }
        else if (avg > 0 && price > 0) {
            resultEl.textContent = 'Введите расстояние — посчитаю расход и стоимость';
        }
        return;
    }
    const fuelField = target.dataset.fuelField;
    if (fuelField) {
        const form = target.closest('#fuel-form');
        if (form)
            onFuelFieldInput(fuelField, form);
        return;
    }
    if (target.classList.contains('mileage-hint-input')) {
        const hintEl = target.closest('form')?.querySelector('[data-mileage-hint]');
        if (hintEl) {
            const mileage = parseSpacedNumber(target.value);
            const current = getActiveCar().odometer;
            if (!mileage) {
                hintEl.textContent = '';
            }
            else if (mileage > current) {
                hintEl.textContent = `↑ Текущий пробег обновится до ${formatKm(mileage)}`;
            }
            else if (mileage < current) {
                hintEl.textContent = `Запись из прошлого — текущий пробег (${formatKm(current)}) не изменится`;
            }
            else {
                hintEl.textContent = '';
            }
        }
    }
    if (target.id === 'odometer-input') {
        const btn = document.getElementById('save-odometer-btn');
        if (btn) {
            const original = Number(target.dataset.original || '0');
            const current = parseSpacedNumber(target.value);
            btn.hidden = current === original;
        }
    }
    if (!target.classList.contains('num-spaced'))
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
    if (target.id === 'car-vin-input') {
        updateCar({ vin: target.value.trim().toUpperCase() || undefined });
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
    if (target.id === 'car-year-input') {
        const raw = target.value;
        const val = raw ? Number(raw) : NaN;
        updateCar({ year: Number.isFinite(val) ? val : undefined });
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
    if (target.id === 'car-tank-capacity-input') {
        const raw = target.value;
        const val = raw ? Number(raw) : NaN;
        updateCar({ tankCapacity: Number.isFinite(val) ? val : undefined });
        return;
    }
    if (target.id === 'car-drive-type-input') {
        updateCar({ driveType: target.value });
        return;
    }
    if (target.classList.contains('interval-input')) {
        const category = target.dataset.category;
        const digits = target.value.replace(/\D/g, '');
        setCustomInterval(category, digits ? Number(digits) : undefined);
        return;
    }
    if (target.id === 'car-photo-input') {
        const input = target;
        const file = input.files?.[0];
        input.value = '';
        if (!file)
            return;
        const reader = new FileReader();
        reader.onload = () => {
            cropRawDataUrl = reader.result;
            ui.photoFormOpen = true;
            render();
        };
        reader.readAsDataURL(file);
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
