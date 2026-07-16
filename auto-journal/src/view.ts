import { CATEGORIES, JOURNAL_GROUPS, SEASON_LABELS, STATUS_COLORS, STATUS_LABELS, ZONES } from './config.js';
import { renderCarDiagram } from './diagram.js';
import { categoryStatus, kmLeft, zoneStatus } from './status.js';
import { formatDate, formatDigitsWithSpaces, formatKm, todayIso } from './format.js';
import { getAllRecordsForCar, getRecordsForCategory } from './store.js';
import type { Car, CategoryId, MaintenanceRecord, WheelPosition, ZoneId } from './types.js';

export type Route = 'home' | 'journal' | 'service' | 'settings';

export interface UiState {
  route: Route;
  activeZone: ZoneId | null;
  formCategory: { category: CategoryId; position?: WheelPosition } | null;
  editingRecordId: string | null;
  journalFilter: string | null;
}

function statusChip(statusKey: string): string {
  const color = STATUS_COLORS[statusKey];
  const label = STATUS_LABELS[statusKey];
  return `<span class="chip" style="--chip-color:${color}"><span class="chip-dot"></span>${label}</span>`;
}

export function bottomNav(active: Route): string {
  const items: { r: Route; icon: string; label: string }[] = [
    { r: 'home', icon: '🚗', label: 'Гараж' },
    { r: 'journal', icon: '📖', label: 'Журнал' },
    { r: 'service', icon: '📅', label: 'Сервис' },
    { r: 'settings', icon: '⚙️', label: 'Настройки' },
  ];
  return `<nav class="bottom-nav">
    ${items
      .map(
        (it) => `<button class="nav-btn ${it.r === active ? 'nav-btn-active' : ''}" data-nav="${it.r}">
          <span class="nav-icon">${it.icon}</span><span>${it.label}</span>
        </button>`,
      )
      .join('')}
  </nav>`;
}

function legend(): string {
  return `<div class="legend">
    ${(['ok', 'soon', 'overdue', 'unknown'] as const)
      .map((s) => `<span class="legend-item"><i style="background:${STATUS_COLORS[s]}"></i>${STATUS_LABELS[s]}</span>`)
      .join('')}
  </div>`;
}

function recordDetail(r: MaintenanceRecord): string {
  return [
    r.brand ? escapeHtml(r.brand) : '',
    r.spec ? escapeHtml(r.spec) : '',
    r.season ? SEASON_LABELS[r.season] : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

function specsLine(car: Car): string {
  const items = [
    [car.brand, car.model].filter(Boolean).join(' '),
    car.engineType,
    car.engineVolume ? `${car.engineVolume} л` : '',
    car.enginePower ? `${car.enginePower} л.с.` : '',
    car.fuelConsumption ? `${car.fuelConsumption} л/100км` : '',
  ].filter(Boolean) as string[];
  return `<div class="specs-line">${items.map(escapeHtml).join(' · ')}</div>`;
}

export function renderHome(car: Car): string {
  return `
  <header class="topbar">
    <div>
      <div class="topbar-title">${escapeHtml(car.name)}</div>
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

function recordSummary(car: Car, category: CategoryId, position?: WheelPosition): string {
  const records = getRecordsForCategory(car.id, category, position);
  const cfg = CATEGORIES[category];
  const status = categoryStatus(car, category, position);
  if (records.length === 0) {
    return `<div class="item-row">
      <div class="item-main">
        <div class="item-title">${cfg.icon} ${cfg.label}${position ? ` (${position})` : ''}</div>
        <div class="item-sub">Записей ещё нет</div>
      </div>
      ${statusChip(status)}
    </div>`;
  }
  const last = records[0];
  const left = kmLeft(car, category, position);
  const leftText =
    left === null ? '' : left >= 0 ? `осталось ~${formatKm(left)}` : `просрочено на ${formatKm(-left)}`;
  const detail = recordDetail(last);
  return `<div class="item-row">
    <div class="item-main">
      <div class="item-title">${cfg.icon} ${cfg.label}${position ? ` (${position})` : ''}</div>
      <div class="item-sub">${formatDate(last.date)} · ${formatKm(last.mileage)}${detail ? ' · ' + detail : ''} ${leftText ? '· ' + leftText : ''}</div>
    </div>
    ${statusChip(status)}
  </div>`;
}

export function renderZonePanel(car: Car, zoneId: ZoneId): string {
  const zone = ZONES[zoneId];
  const isWheel = zoneId.startsWith('wheel_');
  const position = isWheel ? (zoneId.slice(6).toUpperCase() as WheelPosition) : undefined;

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

function renderHistoryList(car: Car, category: CategoryId, position?: WheelPosition): string {
  const records = getRecordsForCategory(car.id, category, position);
  if (records.length <= 1) return '';
  return `<details class="history-details">
    <summary>История (${records.length})</summary>
    <ul class="history-list">
      ${records
        .map(
          (r) => `<li>
            <span>${formatDate(r.date)} · ${formatKm(r.mileage)}${recordDetail(r) ? ' · ' + recordDetail(r) : ''}</span>
            <span>
              <button class="icon-btn-sm" data-edit-record data-id="${r.id}" aria-label="Редактировать">✏️</button>
              <button class="icon-btn-sm" data-delete-record data-id="${r.id}" aria-label="Удалить">🗑</button>
            </span>
          </li>`,
        )
        .join('')}
    </ul>
  </details>`;
}

function tireScopeField(position?: WheelPosition): string {
  if (!position) return '';
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

function tireSeasonField(record?: MaintenanceRecord): string {
  const current = record?.season ?? '';
  const opt = (value: string, label: string) =>
    `<option value="${value}" ${current === value ? 'selected' : ''}>${label}</option>`;
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

export function renderRecordForm(
  car: Car,
  category: CategoryId,
  position?: WheelPosition,
  record?: MaintenanceRecord,
): string {
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
        <input type="text" name="mileage" class="num-spaced" inputmode="numeric" value="${formatDigitsWithSpaces(String(isEdit ? record.mileage : car.odometer))}" required />
      </label>
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

function journalFilterRow(active: string | null): string {
  const allBtn = `<button class="filter-chip ${!active ? 'filter-chip-active' : ''}" data-journal-filter="all">Все</button>`;
  const groupBtns = JOURNAL_GROUPS.map(
    (g) =>
      `<button class="filter-chip ${active === g.id ? 'filter-chip-active' : ''}" data-journal-filter="${g.id}">${g.icon} ${g.label}</button>`,
  ).join('');
  return `<div class="filter-row">${allBtn}${groupBtns}</div>`;
}

export function renderJournal(car: Car, filter: string | null): string {
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
              <div class="item-main">
                <div class="item-title">${cfg.icon} ${cfg.label}${r.position ? ` (${r.position})` : ''}</div>
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
    ${
      allRecords.length === 0
        ? `<p class="hint">Пока нет ни одной записи. Добавьте первую через схему на вкладке «Гараж».</p>`
        : records.length === 0
          ? `<p class="hint">Нет записей по этому разделу.</p>`
          : rowsHtml
    }
  </div>`;
}

export function renderService(): string {
  return `
  <header class="topbar"><div class="topbar-title">Записаться в сервис</div></header>
  <p class="hint">Здесь появится запись на СТО. Пока раздел пустой — обсудим и добавим функционал позже.</p>
  `;
}

export function renderSettings(car: Car): string {
  return `
  <header class="topbar"><div class="topbar-title">Настройки</div></header>
  <div class="settings-list">
    <label class="settings-field">Название автомобиля
      <input type="text" id="car-name-input" value="${escapeHtml(car.name)}" />
    </label>

    <div class="settings-section">
      <h3>Характеристики автомобиля</h3>
      <label class="settings-field">Марка
        <input type="text" id="car-brand-input" value="${escapeHtml(car.brand ?? '')}" placeholder="напр. Toyota" />
      </label>
      <label class="settings-field">Модель
        <input type="text" id="car-model-input" value="${escapeHtml(car.model ?? '')}" placeholder="напр. Mark II" />
      </label>
      <label class="settings-field">Тип двигателя
        <input type="text" id="car-engine-type-input" value="${escapeHtml(car.engineType ?? '')}" placeholder="напр. рядный 6-цилиндровый, бензин" />
      </label>
      <label class="settings-field">Литраж двигателя, л
        <input type="number" id="car-engine-volume-input" step="0.1" min="0" value="${car.engineVolume ?? ''}" placeholder="напр. 2.5" />
      </label>
      <label class="settings-field">Мощность двигателя, л.с.
        <input type="number" id="car-engine-power-input" min="0" value="${car.enginePower ?? ''}" placeholder="напр. 280" />
      </label>
      <label class="settings-field">Средний расход топлива, л/100км
        <input type="number" id="car-fuel-consumption-input" step="0.1" min="0" value="${car.fuelConsumption ?? ''}" placeholder="напр. 8.5" />
      </label>
      <p class="hint">Привод: задний (RWD)</p>
    </div>

    <div class="settings-section">
      <h3>Данные</h3>
      <p class="hint">Прототип хранит данные локально в этом браузере (localStorage), без сервера. Сделайте резервную копию перед очисткой кэша браузера.</p>
      <button class="btn btn-secondary btn-block" id="export-btn">⬇️ Экспортировать в JSON</button>
      <label class="btn btn-secondary btn-block" for="import-input" style="text-align:center;cursor:pointer;">⬆️ Импортировать из JSON</label>
      <input type="file" id="import-input" accept="application/json" style="display:none" />
      <button class="btn btn-danger btn-block" id="reset-btn">Очистить все данные</button>
    </div>
  </div>`;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
