import { CATEGORIES, categoriesForDriveType, JOURNAL_GROUPS, SEASON_LABELS, STATUS_COLORS, STATUS_LABELS, ZONES, } from './config.js';
import { renderCarDiagram } from './diagram.js';
import { categoryStatus, effectiveIntervalKm, kmLeft } from './status.js';
import { formatDate, formatDigitsWithSpaces, formatKm, formatMoney, todayIso } from './format.js';
import { getAllRecordsForCar, getRecordsForCategory } from './store.js';
import { avgConsumption, avgConsumptionThisMonth, avgCostPerMonth, avgPricePerLiter, consumptionSpike, costPerKm, estimateRange, fuelIntervals, totalCostThisMonth, } from './fuel.js';
function statusChip(statusKey) {
    const color = STATUS_COLORS[statusKey];
    const label = STATUS_LABELS[statusKey];
    return `<span class="chip" style="--chip-color:${color}"><span class="chip-dot"></span>${label}</span>`;
}
export function bottomNav(active) {
    const items = [
        { r: 'home', icon: '🚗', label: 'Гараж' },
        { r: 'journal', icon: '📖', label: 'Журнал' },
        { r: 'fuel', icon: '⛽', label: 'Топливо' },
        { r: 'service', icon: '📅', label: 'Сервис' },
        { r: 'settings', icon: '⚙️', label: 'Настройки' },
    ];
    return `<nav class="bottom-nav">
    ${items
        .map((it) => `<button class="nav-btn ${it.r === active ? 'nav-btn-active' : ''}" data-nav="${it.r}">
          <span class="nav-icon">${it.icon}</span><span>${it.label}</span>
        </button>`)
        .join('')}
  </nav>`;
}
function legend() {
    return `<div class="legend">
    ${['ok', 'soon', 'overdue', 'unknown']
        .map((s) => `<span class="legend-item"><i style="background:${STATUS_COLORS[s]}"></i>${STATUS_LABELS[s]}</span>`)
        .join('')}
  </div>`;
}
function recordDetail(r) {
    return [
        r.brand ? escapeHtml(r.brand) : '',
        r.spec ? escapeHtml(r.spec) : '',
        r.season ? SEASON_LABELS[r.season] : '',
    ]
        .filter(Boolean)
        .join(' · ');
}
function specsLine(car) {
    const items = [
        [car.brand, car.model].filter(Boolean).join(' '),
        car.engineType,
        car.engineVolume ? `${car.engineVolume} л` : '',
        car.enginePower ? `${car.enginePower} л.с.` : '',
    ].filter(Boolean);
    return `<div class="specs-line">${items.map(escapeHtml).join(' · ')}</div>`;
}
function carDots(cars, activeCarId) {
    if (cars.length < 2)
        return '';
    return `<div class="car-dots">
    ${cars.map((c) => `<span class="car-dot ${c.id === activeCarId ? 'car-dot-active' : ''}"></span>`).join('')}
  </div>`;
}
export function renderHome(car, cars) {
    return `
  <header class="topbar" data-car-swipe>
    <div>
      <div class="topbar-title">${escapeHtml(car.name)}</div>
      ${carDots(cars, car.id)}
    </div>
  </header>

  ${specsLine(car)}

  <div class="odometer-card">
    <label for="odometer-input">Текущий пробег</label>
    <div class="odometer-row">
      <input id="odometer-input" class="num-spaced" type="text" inputmode="numeric" value="${formatDigitsWithSpaces(String(car.odometer))}" />
      <span>км</span>
    </div>
  </div>

  <div class="diagram-wrap">${renderCarDiagram(car)}</div>
  ${legend()}

  <p class="hint">Нажмите на узел на схеме, чтобы посмотреть историю и добавить запись.</p>
  `;
}
function recordSummary(car, category, position) {
    const records = getRecordsForCategory(car.id, category, position);
    const cfg = CATEGORIES[category];
    const status = categoryStatus(car, category, position);
    if (records.length === 0) {
        return `<div class="item-row">
      <span class="icon-badge">${cfg.icon}</span>
      <div class="item-main">
        <div class="item-title">${cfg.label}${position ? ` (${position})` : ''}</div>
        <div class="item-sub">Записей ещё нет</div>
      </div>
      ${statusChip(status)}
    </div>`;
    }
    const last = records[0];
    const left = kmLeft(car, category, position);
    const leftText = left === null ? '' : left >= 0 ? `осталось ~${formatKm(left)}` : `просрочено на ${formatKm(-left)}`;
    const detail = recordDetail(last);
    return `<div class="item-row">
    <span class="icon-badge">${cfg.icon}</span>
    <div class="item-main">
      <div class="item-title">${cfg.label}${position ? ` (${position})` : ''}</div>
      <div class="item-sub">${formatDate(last.date)} · ${formatKm(last.mileage)}${detail ? ' · ' + detail : ''} ${leftText ? '· ' + leftText : ''}</div>
    </div>
    ${statusChip(status)}
  </div>`;
}
export function renderZonePanel(car, zoneId) {
    const zone = ZONES[zoneId];
    const isWheel = zoneId.startsWith('wheel_');
    const position = isWheel ? zoneId.slice(6).toUpperCase() : undefined;
    const itemsHtml = zone.categories
        .map((cat) => {
        const cfg = CATEGORIES[cat];
        const pos = cfg.needsPosition ? position : undefined;
        return `
      <div class="zone-item">
        ${recordSummary(car, cat, pos)}
        <button class="btn btn-secondary btn-block" data-add-record data-category="${cat}" ${pos ? `data-position="${pos}"` : ''}>+ Добавить запись</button>
        ${renderHistoryList(car, cat, pos)}
      </div>`;
    })
        .join('<hr class="zone-sep"/>');
    return `
  <div class="sheet-backdrop" data-close-panel></div>
  <div class="sheet">
    <div class="sheet-handle"></div>
    <div class="sheet-header">
      <h2>${zone.label}${position ? ` · ${position}` : ''}</h2>
      <button class="icon-btn" data-close-panel aria-label="Закрыть">✕</button>
    </div>
    <div class="sheet-body">
      ${itemsHtml}
    </div>
  </div>`;
}
function renderHistoryList(car, category, position) {
    const records = getRecordsForCategory(car.id, category, position);
    if (records.length <= 1)
        return '';
    return `<details class="history-details">
    <summary>История (${records.length})</summary>
    <ul class="history-list">
      ${records
        .map((r) => `<li>
            <span>${formatDate(r.date)} · ${formatKm(r.mileage)}${recordDetail(r) ? ' · ' + recordDetail(r) : ''}</span>
            <span>
              <button class="icon-btn-sm" data-edit-record data-id="${r.id}" aria-label="Редактировать">✏️</button>
              <button class="icon-btn-sm" data-delete-record data-id="${r.id}" aria-label="Удалить">🗑</button>
            </span>
          </li>`)
        .join('')}
    </ul>
  </details>`;
}
function tireScopeField(position) {
    if (!position)
        return '';
    const isFront = position === 'FL' || position === 'FR';
    const axleValue = isFront ? 'front' : 'rear';
    const axleLabel = isFront ? 'перед' : 'зад';
    const pairPositions = isFront ? 'FL + FR' : 'RL + RR';
    return `
      <label>Куда записать
        <select name="tireScope">
          <option value="single">Только это колесо (${position})</option>
          <option value="${axleValue}">Пара — ${axleLabel} (${pairPositions})</option>
          <option value="all">Все четыре колеса</option>
        </select>
      </label>`;
}
function tireSeasonField(record) {
    const current = record?.season ?? '';
    const opt = (value, label) => `<option value="${value}" ${current === value ? 'selected' : ''}>${label}</option>`;
    return `
      <label>Сезонность
        <select name="season">
          ${opt('', 'Не указано')}
          ${opt('summer', 'Лето')}
          ${opt('winter', 'Зима')}
          ${opt('all_season', 'Всесезонная')}
        </select>
      </label>`;
}
export function renderRecordForm(car, category, position, record) {
    const cfg = CATEGORIES[category];
    const isEdit = !!record;
    return `
  <div class="sheet-backdrop" data-close-form></div>
  <div class="sheet">
    <div class="sheet-handle"></div>
    <div class="sheet-header">
      <h2>${isEdit ? 'Редактирование · ' : ''}${cfg.icon} ${cfg.label}${position ? ` · ${position}` : ''}</h2>
      <button class="icon-btn" data-close-form aria-label="Закрыть">✕</button>
    </div>
    <form class="sheet-body" id="record-form" data-category="${category}" ${position ? `data-position="${position}"` : ''} ${isEdit ? `data-record-id="${record.id}"` : ''}>
      ${category === 'tires' && !isEdit ? tireScopeField(position) : ''}
      <label>Дата
        <input type="date" name="date" value="${isEdit ? record.date : todayIso()}" required />
      </label>
      <label>Пробег, км
        <input type="text" name="mileage" class="num-spaced mileage-hint-input" inputmode="numeric" value="${formatDigitsWithSpaces(String(isEdit ? record.mileage : car.odometer))}" required />
      </label>
      <p class="hint" data-mileage-hint></p>
      <label>${cfg.brandLabel}
        <input type="text" name="brand" placeholder="необязательно" value="${isEdit ? escapeHtml(record.brand ?? '') : ''}" />
      </label>
      <label>${cfg.specLabel}
        <input type="text" name="spec" placeholder="${cfg.specPlaceholder}" value="${isEdit ? escapeHtml(record.spec ?? '') : ''}" />
      </label>
      ${cfg.needsSeason ? tireSeasonField(record) : ''}
      <label>Стоимость, ₽
        <input type="number" name="cost" inputmode="numeric" min="0" placeholder="необязательно" value="${isEdit && record.cost != null ? record.cost : ''}" />
      </label>
      <label>Заметка
        <textarea name="notes" rows="2" placeholder="необязательно">${isEdit ? escapeHtml(record.notes ?? '') : ''}</textarea>
      </label>
      <button type="submit" class="btn btn-primary btn-block">${isEdit ? 'Сохранить изменения' : 'Сохранить запись'}</button>
    </form>
  </div>`;
}
function journalFilterRow(active) {
    const allBtn = `<button class="filter-chip ${!active ? 'filter-chip-active' : ''}" data-journal-filter="all">Все</button>`;
    const groupBtns = JOURNAL_GROUPS.map((g) => `<button class="filter-chip ${active === g.id ? 'filter-chip-active' : ''}" data-journal-filter="${g.id}">${g.icon} ${g.label}</button>`).join('');
    return `<div class="filter-row">${allBtn}${groupBtns}</div>`;
}
export function renderJournal(car, filter) {
    const allRecords = getAllRecordsForCar(car.id);
    const activeGroup = filter ? JOURNAL_GROUPS.find((g) => g.id === filter) : undefined;
    const records = activeGroup ? allRecords.filter((r) => activeGroup.categories.includes(r.category)) : allRecords;
    let lastDate = '';
    const rowsHtml = records
        .map((r) => {
        const cfg = CATEGORIES[r.category];
        const dateHeader = r.date !== lastDate ? `<div class="journal-date-header">${formatDate(r.date)}</div>` : '';
        lastDate = r.date;
        return `${dateHeader}<div class="journal-row">
              <span class="icon-badge">${cfg.icon}</span>
              <div class="item-main">
                <div class="item-title">${cfg.label}${r.position ? ` (${r.position})` : ''}</div>
                <div class="item-sub">${formatKm(r.mileage)}${recordDetail(r) ? ' · ' + recordDetail(r) : ''}${r.cost ? ' · ' + r.cost + ' ₽' : ''}</div>
                ${r.notes ? `<div class="item-notes">${escapeHtml(r.notes)}</div>` : ''}
              </div>
              <span>
                <button class="icon-btn-sm" data-edit-record data-id="${r.id}" aria-label="Редактировать">✏️</button>
                <button class="icon-btn-sm" data-delete-record data-id="${r.id}" aria-label="Удалить">🗑</button>
              </span>
            </div>`;
    })
        .join('');
    return `
  <header class="topbar"><div class="topbar-title">Журнал</div></header>
  ${allRecords.length === 0 ? '' : journalFilterRow(filter)}
  <div class="journal-list">
    ${allRecords.length === 0
        ? `<p class="hint">Пока нет ни одной записи. Добавьте первую через схему на вкладке «Гараж».</p>`
        : records.length === 0
            ? `<p class="hint">Нет записей по этому разделу.</p>`
            : rowsHtml}
  </div>`;
}
function fuelStat(value, label) {
    return `<div class="fuel-stat"><div class="fuel-stat-value">${value}</div><div class="fuel-stat-label">${label}</div></div>`;
}
export function renderFuel(car, fuelRecords) {
    const intervals = fuelIntervals(fuelRecords);
    const allTimeAvg = avgConsumption(intervals);
    const monthAvg = avgConsumptionThisMonth(intervals);
    const monthCost = totalCostThisMonth(fuelRecords);
    const perMonthCost = avgCostPerMonth(fuelRecords);
    const perKm = costPerKm(intervals);
    const avgPrice = avgPricePerLiter(fuelRecords);
    const range = estimateRange(car, fuelRecords, allTimeAvg);
    const spike = consumptionSpike(intervals);
    const sortedDesc = [...fuelRecords].sort((a, b) => b.mileage - a.mileage || b.createdAt - a.createdAt);
    const intervalByRecordId = new Map(intervals.map((i) => [i.record.id, i]));
    const statsHtml = `<div class="fuel-stats-grid">
    ${fuelStat(allTimeAvg ? `${allTimeAvg.toFixed(1)}` : '—', 'л/100км, всего')}
    ${fuelStat(monthAvg ? `${monthAvg.toFixed(1)}` : '—', 'л/100км, за месяц')}
    ${fuelStat(formatMoney(monthCost), 'потрачено в этом месяце')}
    ${fuelStat(perMonthCost ? formatMoney(perMonthCost) : '—', 'в среднем в месяц')}
    ${fuelStat(perKm ? `${perKm.toFixed(2)} ₽` : '—', 'стоимость 1 км')}
    ${fuelStat(range ? `~${formatKm(range.remainingKm)}` : '—', car.tankCapacity ? 'запас хода' : 'запас хода (укажите бак в настройках)')}
  </div>`;
    const alertHtml = spike
        ? `<div class="fuel-alert">⚠️ Расход вырос: последняя заправка — ${spike.last.toFixed(1)} л/100км, обычно ~${spike.avgBefore.toFixed(1)} л/100км</div>`
        : '';
    const tripHtml = `<div class="odometer-card">
    <label for="trip-distance-input">Поездка в другой город — расход и стоимость</label>
    <div class="odometer-row">
      <input id="trip-distance-input" type="number" inputmode="numeric" min="0" placeholder="расстояние, км"
        data-avg-consumption="${allTimeAvg ?? ''}" data-avg-price="${avgPrice ?? ''}" />
      <span>км</span>
    </div>
    <p class="hint" id="trip-result">${allTimeAvg && avgPrice ? 'Введите расстояние — посчитаю расход и стоимость' : 'Нужно минимум 2 заправки для расчёта'}</p>
  </div>`;
    const historyHtml = sortedDesc.length === 0
        ? `<p class="hint">Пока нет ни одной заправки. Добавьте первую кнопкой выше.</p>`
        : `<div class="journal-list">
    ${sortedDesc
            .map((r) => {
            const interval = intervalByRecordId.get(r.id);
            const pricePerLiter = r.liters > 0 ? r.cost / r.liters : 0;
            return `<div class="journal-row">
              <span class="icon-badge">⛽</span>
              <div class="item-main">
                <div class="item-title">Заправка</div>
                <div class="item-sub">${formatDate(r.date)} · ${formatKm(r.mileage)} · ${r.liters.toFixed(1)} л · ${formatMoney(r.cost)} (${pricePerLiter.toFixed(1)} ₽/л)${interval ? ' · ' + interval.consumption.toFixed(1) + ' л/100км' : ''}</div>
              </div>
              <span>
                <button class="icon-btn-sm" data-edit-fuel data-id="${r.id}" aria-label="Редактировать">✏️</button>
                <button class="icon-btn-sm" data-delete-fuel data-id="${r.id}" aria-label="Удалить">🗑</button>
              </span>
            </div>`;
        })
            .join('')}
  </div>`;
    return `
  <header class="topbar"><div class="topbar-title">Топливо</div></header>
  ${statsHtml}
  ${alertHtml}
  <button class="btn btn-primary btn-block" data-add-fuel>+ Добавить заправку</button>
  ${tripHtml}
  ${historyHtml}
  `;
}
export function renderFuelForm(car, record) {
    const isEdit = !!record;
    const pricePerLiter = isEdit && record.liters > 0 ? (record.cost / record.liters).toFixed(2) : '';
    return `
  <div class="sheet-backdrop" data-close-fuel-form></div>
  <div class="sheet">
    <div class="sheet-handle"></div>
    <div class="sheet-header">
      <h2>⛽ ${isEdit ? 'Редактирование заправки' : 'Новая заправка'}</h2>
      <button class="icon-btn" data-close-fuel-form aria-label="Закрыть">✕</button>
    </div>
    <form class="sheet-body" id="fuel-form" ${isEdit ? `data-record-id="${record.id}"` : ''}>
      <label>Дата
        <input type="date" name="date" value="${isEdit ? record.date : todayIso()}" required />
      </label>
      <label>Пробег на одометре, км
        <input type="text" name="mileage" class="num-spaced mileage-hint-input" inputmode="numeric" value="${formatDigitsWithSpaces(String(isEdit ? record.mileage : car.odometer))}" required />
      </label>
      <p class="hint" data-mileage-hint></p>
      <label>Залито литров
        <input type="number" name="liters" class="fuel-calc-field" data-fuel-field="liters" step="0.01" min="0" inputmode="decimal" value="${isEdit ? record.liters : ''}" placeholder="напр. 38.5" required />
      </label>
      <label>Стоимость заправки, ₽
        <input type="number" name="cost" class="fuel-calc-field" data-fuel-field="cost" step="1" min="0" inputmode="numeric" value="${isEdit ? record.cost : ''}" placeholder="напр. 2300" required />
      </label>
      <label>Цена за литр, ₽/л
        <input type="number" name="pricePerLiter" class="fuel-calc-field" data-fuel-field="price" step="0.01" min="0" inputmode="decimal" value="${pricePerLiter}" placeholder="напр. 59.7" required />
      </label>
      <p class="hint">Заполните любые два поля из трёх — третье посчитается само.</p>
      <button type="submit" class="btn btn-primary btn-block">${isEdit ? 'Сохранить изменения' : 'Сохранить заправку'}</button>
    </form>
  </div>`;
}
export function renderService() {
    return `
  <header class="topbar"><div class="topbar-title">Записаться в сервис</div></header>
  <p class="hint">Здесь появится запись на СТО. Пока раздел пустой — обсудим и добавим функционал позже.</p>
  `;
}
function renderCarSwitcher(cars, activeCarId) {
    const rows = cars
        .map((c) => {
        const isActive = c.id === activeCarId;
        const subtitle = [c.brand, c.model].filter(Boolean).join(' ');
        return `<div class="car-row ${isActive ? 'car-row-active' : ''}" ${isActive ? '' : `data-switch-car data-id="${c.id}"`}>
        <div class="item-main">
          <div class="item-title">${isActive ? '✓ ' : ''}${escapeHtml(c.name)}</div>
          ${subtitle ? `<div class="item-sub">${escapeHtml(subtitle)}</div>` : ''}
        </div>
        ${cars.length > 1 ? `<button class="icon-btn-sm" data-delete-car data-id="${c.id}" aria-label="Удалить автомобиль">🗑</button>` : ''}
      </div>`;
    })
        .join('');
    return `
    <div class="settings-section">
      <h3>Мои автомобили</h3>
      <div class="car-list">${rows}</div>
      <button class="btn btn-secondary btn-block" data-add-car>+ Добавить автомобиль</button>
      <p class="hint">Название и характеристики ниже относятся к выбранному (отмеченному ✓) автомобилю. Переключайтесь, нажимая на другой автомобиль в списке.</p>
    </div>`;
}
export function renderCarForm() {
    return `
  <div class="sheet-backdrop" data-close-car-form></div>
  <div class="sheet">
    <div class="sheet-handle"></div>
    <div class="sheet-header">
      <h2>🚗 Новый автомобиль</h2>
      <button class="icon-btn" data-close-car-form aria-label="Закрыть">✕</button>
    </div>
    <form class="sheet-body" id="car-form">
      <label>Название автомобиля
        <input type="text" name="name" placeholder="напр. Toyota Mark II" required />
      </label>
      <p class="hint">Остальные характеристики и историю обслуживания можно будет заполнить после создания.</p>
      <button type="submit" class="btn btn-primary btn-block">Добавить</button>
    </form>
  </div>`;
}
function renderIntervalsSection(car, open) {
    const allWithInterval = Object.keys(CATEGORIES).filter((id) => CATEGORIES[id].intervalKm);
    const categories = categoriesForDriveType(car.driveType, allWithInterval);
    const rows = categories
        .map((id) => {
        const cfg = CATEGORIES[id];
        const isCustom = car.customIntervals?.[id] !== undefined;
        const value = effectiveIntervalKm(car, id);
        return `<label class="settings-field">${cfg.icon} ${cfg.label}, км${isCustom ? ' · своё значение' : ''}
        <input type="text" inputmode="numeric" class="num-spaced interval-input" data-category="${id}" value="${formatDigitsWithSpaces(String(value ?? ''))}" placeholder="по умолчанию ${formatDigitsWithSpaces(String(cfg.intervalKm))}" />
      </label>`;
    })
        .join('');
    return `
    <div class="settings-section">
      <details class="intervals-toggle" ${open ? 'open' : ''}>
        <summary>Периодичность ТО</summary>
        <p class="hint">По умолчанию используются стандартные интервалы. Если ваша машина (например, турбо) требует более частой замены — задайте свой пробег, он заменит стандартный только для этой машины. Очистите поле, чтобы вернуть значение по умолчанию.</p>
        ${rows}
      </details>
    </div>`;
}
export function renderSettings(car, cars, account, intervalsOpen) {
    return `
  <header class="topbar"><div class="topbar-title">Настройки</div></header>
  <div class="settings-list">
    <div class="settings-section">
      <h3>Мой аккаунт</h3>
      <p class="hint">ID: ${account.id}<br/>Email: ${escapeHtml(account.email)}</p>
      <button class="btn btn-secondary btn-block" id="logout-btn">Выйти из аккаунта</button>
    </div>

    ${renderCarSwitcher(cars, car.id)}

    <div class="settings-section">
      <h3>Характеристики автомобиля</h3>
      <label class="settings-field">Название автомобиля
        <input type="text" id="car-name-input" value="${escapeHtml(car.name)}" />
      </label>
      <label class="settings-field">Марка
        <input type="text" id="car-brand-input" value="${escapeHtml(car.brand ?? '')}" placeholder="напр. Toyota" />
      </label>
      <label class="settings-field">Модель
        <input type="text" id="car-model-input" value="${escapeHtml(car.model ?? '')}" placeholder="напр. Mark II" />
      </label>
      <label class="settings-field">Тип двигателя
        <input type="text" id="car-engine-type-input" value="${escapeHtml(car.engineType ?? '')}" placeholder="напр. рядный 6-цилиндровый, бензин" />
      </label>
      <label class="settings-field">Объём двигателя, л
        <input type="number" id="car-engine-volume-input" step="0.1" min="0" value="${car.engineVolume ?? ''}" placeholder="напр. 2.5" />
      </label>
      <label class="settings-field">Мощность двигателя, л.с.
        <input type="number" id="car-engine-power-input" min="0" value="${car.enginePower ?? ''}" placeholder="напр. 280" />
      </label>
      <label class="settings-field">Объём топливного бака, л
        <input type="number" id="car-tank-capacity-input" step="1" min="0" value="${car.tankCapacity ?? ''}" placeholder="напр. 55" />
      </label>
      <label class="settings-field">Привод
        <select id="car-drive-type-input">
          <option value="fwd" ${car.driveType === 'fwd' ? 'selected' : ''}>Передний (FWD)</option>
          <option value="rwd" ${car.driveType === 'rwd' ? 'selected' : ''}>Задний (RWD)</option>
          <option value="awd" ${car.driveType === 'awd' ? 'selected' : ''}>Полный (AWD)</option>
        </select>
      </label>
      <p class="hint">Тип привода меняет схему на «Гараже»: при полном приводе появляется раздаточная коробка, при переднем — нет отдельного заднего редуктора.</p>
    </div>

    ${renderIntervalsSection(car, intervalsOpen)}

    <div class="settings-section">
      <h3>Данные</h3>
      <p class="hint">Данные хранятся на сервере и доступны с любого устройства после входа в этот аккаунт. Экспорт полезен для резервной копии или переноса.</p>
      <button class="btn btn-secondary btn-block" id="export-btn">⬇️ Экспортировать в JSON</button>
      <label class="btn btn-secondary btn-block" for="import-input" style="text-align:center;cursor:pointer;">⬆️ Импортировать из JSON</label>
      <input type="file" id="import-input" accept="application/json" style="display:none" />
      <button class="btn btn-danger btn-block" id="reset-btn">Очистить все данные</button>
    </div>
  </div>`;
}
export function escapeHtml(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
