import {
  CATEGORIES,
  categoriesForDriveType,
  JOURNAL_GROUPS,
  SEASON_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  ZONES,
} from './config.js';
import { renderCarDiagram } from './diagram.js';
import { categoryStatus, effectiveIntervalKm, kmLeft, zoneStatus } from './status.js';
import { formatDate, formatDigitsWithSpaces, formatKm, formatMoney, todayIso } from './format.js';
import { getAllRecordsForCar, getRecordsForCategory, getRepairsForCar } from './store.js';
import {
  avgConsumption,
  avgConsumptionThisMonth,
  avgCostPerMonth,
  avgPricePerLiter,
  consumptionSpike,
  costPerKm,
  estimateRange,
  fuelIntervals,
  totalCostThisMonth,
} from './fuel.js';
import type { Car, CategoryId, FuelRecord, MaintenanceRecord, RepairRecord, WheelPosition, ZoneId } from './types.js';
import type { Account } from './store.js';

export type Route = 'home' | 'journal' | 'fuel' | 'service' | 'settings';

export interface UiState {
  route: Route;
  activeZone: ZoneId | null;
  formCategory: { category: CategoryId; position?: WheelPosition } | null;
  editingRecordId: string | null;
  journalFilter: string | null;
  fuelFormOpen: boolean;
  editingFuelId: string | null;
  repairFormOpen: boolean;
  editingRepairId: string | null;
  carFormOpen: boolean;
  intervalsOpen: boolean;
  photoFormOpen: boolean;
  graphOpen: boolean;
  graphViewStart: number | null;
  graphViewEnd: number | null;
  graphActiveDate: string | null;
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
    { r: 'fuel', icon: '⛽', label: 'Топливо' },
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
    car.year ? String(car.year) : '',
    car.engineType,
    car.engineVolume ? `${car.engineVolume} л` : '',
    car.enginePower ? `${car.enginePower} л.с.` : '',
  ].filter(Boolean) as string[];
  return `<div class="specs-line">${items.map(escapeHtml).join(' · ')}</div>`;
}

function carAvatar(car: Car, size: 'sm' | 'lg' = 'sm'): string {
  const cls = size === 'lg' ? 'car-avatar car-avatar-lg' : 'car-avatar';
  return `<span class="${cls}">${car.photo ? `<img src="${car.photo}" alt="" />` : '🚗'}</span>`;
}

function carDots(cars: Car[], activeCarId: string): string {
  if (cars.length < 2) return '';
  return `<div class="car-dots">
    ${cars.map((c) => `<span class="car-dot ${c.id === activeCarId ? 'car-dot-active' : ''}"></span>`).join('')}
  </div>`;
}

export function renderHome(car: Car, cars: Car[], ui: UiState): string {
  return `
  <header class="topbar" data-car-swipe>
    <div class="topbar-title-row">
      ${carAvatar(car)}
      <div>
        <div class="topbar-title">${escapeHtml(car.name)}</div>
        ${carDots(cars, car.id)}
      </div>
    </div>
  </header>

  ${specsLine(car)}

  <div class="odometer-card">
    <label for="odometer-input">Текущий пробег</label>
    <div class="odometer-row">
      <input id="odometer-input" class="num-spaced" type="text" inputmode="numeric" value="${formatDigitsWithSpaces(String(car.odometer))}" data-original="${car.odometer}" />
      <span>км</span>
    </div>
    <button type="button" class="btn btn-primary btn-block" id="save-odometer-btn" hidden>Сохранить пробег</button>
    <p class="hint" id="odometer-save-hint"></p>
  </div>

  <div class="diagram-wrap">${renderCarDiagram(car)}</div>
  ${legend()}

  <div class="settings-list">
    <div class="settings-section">
      <button type="button" class="btn btn-secondary btn-block" data-add-repair>🔧 Записать ремонт</button>
      <p class="hint">Для работ, которых нет на схеме — например, ремонт подвески или другая поломка.</p>
    </div>

    ${renderGraphCard(car, ui)}
  </div>
  `;
}

function recordSummary(car: Car, category: CategoryId, position?: WheelPosition): string {
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
  const leftText =
    left === null ? '' : left >= 0 ? `осталось ~${formatKm(left)}` : `просрочено на ${formatKm(-left)}`;
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

function journalFilterRow(active: string | null): string {
  const allBtn = `<button class="filter-chip ${!active ? 'filter-chip-active' : ''}" data-journal-filter="all">Все</button>`;
  const groupBtns = JOURNAL_GROUPS.map(
    (g) =>
      `<button class="filter-chip ${active === g.id ? 'filter-chip-active' : ''}" data-journal-filter="${g.id}">${g.icon} ${g.label}</button>`,
  ).join('');
  const repairBtn = `<button class="filter-chip ${active === 'repairs' ? 'filter-chip-active' : ''}" data-journal-filter="repairs">🔧 Ремонт</button>`;
  return `<div class="filter-row">${allBtn}${groupBtns}${repairBtn}</div>`;
}

interface JournalEntry {
  date: string;
  createdAt: number;
  icon: string;
  title: string;
  sub: string;
  notes?: string;
  id: string;
  kind: 'record' | 'repair';
}

function recordToEntry(r: MaintenanceRecord): JournalEntry {
  const cfg = CATEGORIES[r.category];
  return {
    date: r.date,
    createdAt: r.createdAt,
    icon: cfg.icon,
    title: `${cfg.label}${r.position ? ` (${r.position})` : ''}`,
    sub: `${formatKm(r.mileage)}${recordDetail(r) ? ' · ' + recordDetail(r) : ''}${r.cost ? ' · ' + r.cost + ' ₽' : ''}`,
    notes: r.notes,
    id: r.id,
    kind: 'record',
  };
}

function repairToEntry(r: RepairRecord): JournalEntry {
  return {
    date: r.date,
    createdAt: r.createdAt,
    icon: '🔧',
    title: escapeHtml(r.title),
    sub: `${formatKm(r.mileage)}${repairDetail(r) ? ' · ' + repairDetail(r) : ''}${r.cost ? ' · ' + r.cost + ' ₽' : ''}`,
    notes: r.notes,
    id: r.id,
    kind: 'repair',
  };
}

export function renderJournal(car: Car, filter: string | null): string {
  const allRecords = getAllRecordsForCar(car.id);
  const allRepairs = getRepairsForCar(car.id);
  const hasAny = allRecords.length > 0 || allRepairs.length > 0;
  const activeGroup = filter && filter !== 'repairs' ? JOURNAL_GROUPS.find((g) => g.id === filter) : undefined;

  let entries: JournalEntry[];
  if (filter === 'repairs') {
    entries = allRepairs.map(repairToEntry);
  } else if (activeGroup) {
    entries = allRecords.filter((r) => activeGroup.categories.includes(r.category)).map(recordToEntry);
  } else {
    entries = [...allRecords.map(recordToEntry), ...allRepairs.map(repairToEntry)];
  }
  entries.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

  let lastDate = '';
  const rowsHtml = entries
    .map((e) => {
      const dateHeader = e.date !== lastDate ? `<div class="journal-date-header">${formatDate(e.date)}</div>` : '';
      lastDate = e.date;
      const editAttr = e.kind === 'record' ? 'data-edit-record' : 'data-edit-repair';
      const deleteAttr = e.kind === 'record' ? 'data-delete-record' : 'data-delete-repair';
      return `${dateHeader}<div class="journal-row">
              <span class="icon-badge">${e.icon}</span>
              <div class="item-main">
                <div class="item-title">${e.title}</div>
                <div class="item-sub">${e.sub}</div>
                ${e.notes ? `<div class="item-notes">${escapeHtml(e.notes)}</div>` : ''}
              </div>
              <span>
                <button class="icon-btn-sm" ${editAttr} data-id="${e.id}" aria-label="Редактировать">✏️</button>
                <button class="icon-btn-sm" ${deleteAttr} data-id="${e.id}" aria-label="Удалить">🗑</button>
              </span>
            </div>`;
    })
    .join('');

  return `
  <header class="topbar"><div class="topbar-title">Журнал</div></header>
  ${hasAny ? journalFilterRow(filter) : ''}
  <div class="journal-list">
    ${
      !hasAny
        ? `<p class="hint">Пока нет ни одной записи. Добавьте первую через схему на вкладке «Гараж».</p>`
        : entries.length === 0
          ? `<p class="hint">Нет записей по этому разделу.</p>`
          : rowsHtml
    }
  </div>`;
}

export interface GraphPoint {
  date: string;
  mileage: number;
  categories: CategoryId[];
}

export interface GraphDomain {
  points: GraphPoint[];
  start: number;
  end: number;
}

export const GRAPH_VB_W = 340;
export const GRAPH_VB_H = 200;
export const GRAPH_PAD_L = 50;
export const GRAPH_PAD_R = 12;
export const GRAPH_PAD_T = 14;
export const GRAPH_PAD_B = 26;
export const GRAPH_MIN_SPAN_MS = 30 * 86400000;

function dateMs(date: string): number {
  return new Date(date + 'T00:00:00').getTime();
}

/** Собирает точки графика (одна на дату записи ТО) и полный диапазон времени: от года выпуска (или первой записи) до сегодня. */
export function buildGraphDomain(car: Car, records: MaintenanceRecord[]): GraphDomain {
  const byDate = new Map<string, GraphPoint>();
  for (const r of records) {
    const existing = byDate.get(r.date);
    if (existing) {
      existing.mileage = Math.max(existing.mileage, r.mileage);
      if (!existing.categories.includes(r.category)) existing.categories.push(r.category);
    } else {
      byDate.set(r.date, { date: r.date, mileage: r.mileage, categories: [r.category] });
    }
  }
  const points = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  const now = Date.now();
  const yearStart = car.year ? new Date(car.year, 0, 1).getTime() : now;
  const firstPointMs = points.length ? dateMs(points[0].date) : now;
  const lastPointMs = points.length ? dateMs(points[points.length - 1].date) : 0;
  const start = Math.min(yearStart, firstPointMs);
  const end = Math.max(now, lastPointMs);
  return { points, start: Math.min(start, end - GRAPH_MIN_SPAN_MS), end };
}

function niceNumber(x: number, round: boolean): number {
  if (x <= 0) return 1;
  const exp = Math.floor(Math.log10(x));
  const f = x / Math.pow(10, exp);
  let nf: number;
  if (round) {
    if (f < 1.5) nf = 1;
    else if (f < 3) nf = 2;
    else if (f < 7) nf = 5;
    else nf = 10;
  } else {
    if (f <= 1) nf = 1;
    else if (f <= 2) nf = 2;
    else if (f <= 5) nf = 5;
    else nf = 10;
  }
  return nf * Math.pow(10, exp);
}

function niceAxisStep(rawMax: number, tickCountTarget: number): { max: number; step: number } {
  const safeMax = Math.max(rawMax, 1000);
  const step = niceNumber(safeMax / tickCountTarget, true);
  const max = Math.ceil(safeMax / step) * step;
  return { max, step };
}

const MONTHS_FULL = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
];
const MONTHS_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

function pickStep(candidates: number[], rawStep: number): number {
  for (const c of candidates) if (c >= rawStep) return c;
  return candidates[candidates.length - 1];
}

function buildXTicks(startMs: number, endMs: number): { ms: number; label: string }[] {
  const spanDays = (endMs - startMs) / 86400000;
  const ticks: { ms: number; label: string }[] = [];
  if (spanDays > 500) {
    // Годы читаются коротко ("2019") — можно ставить почаще.
    const targetCount = 7;
    const step = pickStep([1, 2, 3, 5, 10, 20, 50], spanDays / 365 / targetCount);
    const startYear = new Date(startMs).getFullYear();
    const endYear = new Date(endMs).getFullYear();
    const firstTickYear = Math.ceil(startYear / step) * step;
    for (let y = firstTickYear; y <= endYear; y += step) {
      const ms = new Date(y, 0, 1).getTime();
      if (ms >= startMs && ms <= endMs) ticks.push({ ms, label: String(y) });
    }
  } else if (spanDays > 40) {
    // Названия месяцев полные ("сентябрь 26") — меток должно быть меньше, иначе налезут друг на друга.
    const targetCount = 4;
    const step = pickStep([1, 2, 3, 6], spanDays / 30.4 / targetCount);
    let monthIndex = new Date(startMs).getFullYear() * 12 + new Date(startMs).getMonth();
    monthIndex = Math.ceil(monthIndex / step) * step;
    for (; ; monthIndex += step) {
      const y = Math.floor(monthIndex / 12);
      const m = ((monthIndex % 12) + 12) % 12;
      const ms = new Date(y, m, 1).getTime();
      if (ms > endMs) break;
      if (ms >= startMs) ticks.push({ ms, label: `${MONTHS_FULL[m]} ${String(y).slice(-2)}` });
    }
  } else {
    const targetCount = 6;
    const stepDays = pickStep([1, 2, 3, 7, 14], spanDays / targetCount);
    const stepMs = stepDays * 86400000;
    let ms = Math.ceil(startMs / stepMs) * stepMs;
    for (; ms <= endMs; ms += stepMs) {
      const d = new Date(ms);
      ticks.push({ ms, label: `${d.getDate()} ${MONTHS_GENITIVE[d.getMonth()]}` });
    }
  }
  return ticks;
}

function formatKmAxis(n: number): string {
  if (n >= 1000) return `${Math.round(n / 1000)} тыс`;
  return String(Math.round(n));
}

/** Рисует саму SVG-схему графика + подсказку с деталями по выбранной точке. Вызывается отдельно от полной перерисовки страницы — при перетаскивании/зуме перерисовывается только этот кусок. */
export function renderGraphChart(
  car: Car,
  domain: GraphDomain,
  view: { start: number; end: number },
  activeDate: string | null,
): string {
  const plotLeft = GRAPH_PAD_L;
  const plotRight = GRAPH_VB_W - GRAPH_PAD_R;
  const plotTop = GRAPH_PAD_T;
  const plotBottom = GRAPH_VB_H - GRAPH_PAD_B;

  const rawMax = Math.max(car.odometer, ...domain.points.map((p) => p.mileage), 1000) * 1.08;
  const { max: yMax, step: yStep } = niceAxisStep(rawMax, 6);

  const xAt = (ms: number) => plotLeft + ((ms - view.start) / (view.end - view.start)) * (plotRight - plotLeft);
  const yAt = (km: number) => plotBottom - (km / yMax) * (plotBottom - plotTop);

  const todayMs = Date.now();
  const lastPoint = domain.points[domain.points.length - 1];
  const showTodayMarker = !lastPoint || lastPoint.date !== todayIso() || lastPoint.mileage !== car.odometer;

  const seriesForLine = domain.points.map((p) => ({ ms: dateMs(p.date), km: p.mileage }));
  if (showTodayMarker) seriesForLine.push({ ms: todayMs, km: car.odometer });

  const pathD = seriesForLine.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(p.ms).toFixed(1)} ${yAt(p.km).toFixed(1)}`).join(' ');

  const yTicks: number[] = [];
  for (let v = 0; v <= yMax + 1; v += yStep) yTicks.push(v);
  const xTicks = buildXTicks(view.start, view.end);

  const gridHtml = yTicks
    .map((v) => `<line x1="${plotLeft}" y1="${yAt(v).toFixed(1)}" x2="${plotRight}" y2="${yAt(v).toFixed(1)}" class="graph-grid-line" />`)
    .join('');
  const gridVHtml = xTicks
    .map((t) => `<line x1="${xAt(t.ms).toFixed(1)}" y1="${plotTop}" x2="${xAt(t.ms).toFixed(1)}" y2="${plotBottom}" class="graph-grid-line-v" />`)
    .join('');
  const yLabelsHtml = yTicks
    .map((v) => `<text x="${plotLeft - 8}" y="${(yAt(v) + 3.5).toFixed(1)}" class="graph-axis-label" text-anchor="end">${formatKmAxis(v)}</text>`)
    .join('');
  const xLabelsHtml = xTicks
    .map((t) => `<text x="${xAt(t.ms).toFixed(1)}" y="${GRAPH_VB_H - 8}" class="graph-axis-label" text-anchor="middle">${t.label}</text>`)
    .join('');

  const pointsHtml = domain.points
    .map((p) => {
      const active = p.date === activeDate;
      return `<circle cx="${xAt(dateMs(p.date)).toFixed(1)}" cy="${yAt(p.mileage).toFixed(1)}" r="${active ? 6.5 : 4.5}" class="graph-point ${active ? 'graph-point-active' : ''}" data-graph-point data-date="${p.date}" />`;
    })
    .join('');
  const todayPointHtml = showTodayMarker
    ? `<circle cx="${xAt(todayMs).toFixed(1)}" cy="${yAt(car.odometer).toFixed(1)}" r="${activeDate === 'today' ? 6.5 : 4.5}" class="graph-point graph-point-today ${activeDate === 'today' ? 'graph-point-active' : ''}" data-graph-point data-date="today" />`
    : '';

  const active =
    activeDate === 'today'
      ? { date: 'today', mileage: car.odometer, categories: [] as CategoryId[] }
      : domain.points.find((p) => p.date === activeDate);

  const tooltipHtml = active
    ? `<div class="graph-tooltip">
        <div class="graph-tooltip-date">${active.date === 'today' ? '📍 Сегодня' : formatDate(active.date)}</div>
        <div class="graph-tooltip-mileage">${formatKm(active.mileage)}</div>
        ${active.categories.length ? `<div class="graph-tooltip-cats">${active.categories.map((c) => CATEGORIES[c].label).join(', ')}</div>` : active.date === 'today' ? '<div class="graph-tooltip-cats">Текущий пробег</div>' : ''}
      </div>`
    : `<p class="hint graph-tooltip-hint">Нажмите на точку графика, чтобы посмотреть пробег и работы</p>`;

  return `
  <svg viewBox="0 0 ${GRAPH_VB_W} ${GRAPH_VB_H}" class="graph-svg" data-graph-svg>
    <defs><clipPath id="graph-clip"><rect x="${plotLeft}" y="${plotTop}" width="${plotRight - plotLeft}" height="${plotBottom - plotTop}" /></clipPath></defs>
    ${gridHtml}${gridVHtml}
    <line x1="${plotLeft}" y1="${plotBottom}" x2="${plotRight}" y2="${plotBottom}" class="graph-axis-line" />
    <line x1="${plotLeft}" y1="${plotTop}" x2="${plotLeft}" y2="${plotBottom}" class="graph-axis-line" />
    <g clip-path="url(#graph-clip)">
      <path d="${pathD}" class="graph-line" fill="none" />
      ${pointsHtml}
      ${todayPointHtml}
    </g>
    ${yLabelsHtml}${xLabelsHtml}
  </svg>
  ${tooltipHtml}`;
}

/** Сворачиваемая плашка с графиком пробега — встраивается в самый низ страницы «Гараж», закрыта по умолчанию. */
export function renderGraphCard(car: Car, ui: UiState): string {
  const records = getAllRecordsForCar(car.id);
  const domain = buildGraphDomain(car, records);
  const view = {
    start: ui.graphViewStart ?? domain.start,
    end: ui.graphViewEnd ?? domain.end,
  };

  const body =
    domain.points.length === 0
      ? `<p class="hint">Пока нет ни одной записи ТО. Точки на графике появятся, когда вы добавите записи через схему выше.</p>`
      : `
    <div class="graph-controls">
      <button type="button" class="icon-btn" data-graph-zoom-out aria-label="Уменьшить">−</button>
      <button type="button" class="btn-text" data-graph-reset>Сбросить масштаб</button>
      <button type="button" class="icon-btn" data-graph-zoom-in aria-label="Увеличить">+</button>
    </div>
    <div class="graph-chart-host" id="graph-chart-host">
      ${renderGraphChart(car, domain, view, ui.graphActiveDate)}
    </div>`;

  return `
  <div class="settings-section">
    <details class="intervals-toggle graph-toggle" ${ui.graphOpen ? 'open' : ''}>
      <summary>📈 График пробега</summary>
      ${body}
    </details>
  </div>`;
}

function fuelStat(value: string, label: string): string {
  return `<div class="fuel-stat"><div class="fuel-stat-value">${value}</div><div class="fuel-stat-label">${label}</div></div>`;
}

export function renderFuel(car: Car, fuelRecords: FuelRecord[]): string {
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

  const historyHtml =
    sortedDesc.length === 0
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

export function renderFuelForm(car: Car, record?: FuelRecord): string {
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

function repairDetail(r: RepairRecord): string {
  return [r.brand ? escapeHtml(r.brand) : '', r.spec ? escapeHtml(r.spec) : ''].filter(Boolean).join(' · ');
}

export function renderRepairForm(car: Car, record?: RepairRecord): string {
  const isEdit = !!record;
  return `
  <div class="sheet-backdrop" data-close-repair-form></div>
  <div class="sheet">
    <div class="sheet-handle"></div>
    <div class="sheet-header">
      <h2>🔧 ${isEdit ? 'Редактирование ремонта' : 'Новый ремонт'}</h2>
      <button class="icon-btn" data-close-repair-form aria-label="Закрыть">✕</button>
    </div>
    <form class="sheet-body" id="repair-form" ${isEdit ? `data-record-id="${record.id}"` : ''}>
      <label>Что делали
        <input type="text" name="title" placeholder="напр. Замена стойки стабилизатора" value="${isEdit ? escapeHtml(record.title) : ''}" required />
      </label>
      <label>Дата
        <input type="date" name="date" value="${isEdit ? record.date : todayIso()}" required />
      </label>
      <label>Пробег, км
        <input type="text" name="mileage" class="num-spaced mileage-hint-input" inputmode="numeric" value="${formatDigitsWithSpaces(String(isEdit ? record.mileage : car.odometer))}" required />
      </label>
      <p class="hint" data-mileage-hint></p>
      <label>Бренд / производитель
        <input type="text" name="brand" placeholder="необязательно" value="${isEdit ? escapeHtml(record.brand ?? '') : ''}" />
      </label>
      <label>Артикул / спецификация
        <input type="text" name="spec" placeholder="необязательно" value="${isEdit ? escapeHtml(record.spec ?? '') : ''}" />
      </label>
      <label>Стоимость, ₽
        <input type="text" name="cost" class="num-spaced" inputmode="numeric" placeholder="необязательно" value="${isEdit && record.cost != null ? formatDigitsWithSpaces(String(record.cost)) : ''}" />
      </label>
      <label>Заметка
        <textarea name="notes" rows="2" placeholder="необязательно">${isEdit ? escapeHtml(record.notes ?? '') : ''}</textarea>
      </label>
      <button type="submit" class="btn btn-primary btn-block">${isEdit ? 'Сохранить изменения' : 'Сохранить запись'}</button>
    </form>
  </div>`;
}

export function renderPhotoCropForm(rawDataUrl: string): string {
  return `
  <div class="sheet-backdrop" data-close-photo-form></div>
  <div class="sheet">
    <div class="sheet-handle"></div>
    <div class="sheet-header">
      <h2>📷 Фото автомобиля</h2>
      <button class="icon-btn" data-close-photo-form aria-label="Закрыть">✕</button>
    </div>
    <div class="sheet-body">
      <div class="photo-crop-wrap">
        <div class="photo-crop-viewport" id="photo-crop-viewport">
          <img id="photo-crop-img" src="${rawDataUrl}" alt="" draggable="false" />
        </div>
      </div>
      <label class="settings-field">Масштаб
        <input type="range" id="photo-crop-zoom" min="100" max="300" value="100" />
      </label>
      <p class="hint">Перетащите фото пальцем или мышью, чтобы выбрать нужную область, и настройте масштаб.</p>
      <button type="button" class="btn btn-primary btn-block" data-photo-crop-save>Сохранить фото</button>
    </div>
  </div>`;
}

export function renderService(): string {
  return `
  <header class="topbar"><div class="topbar-title">Записаться в сервис</div></header>
  <p class="hint">Здесь появится запись на СТО. Пока раздел пустой — обсудим и добавим функционал позже.</p>
  `;
}

function renderCarSwitcher(cars: Car[], activeCarId: string): string {
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

export function renderCarForm(): string {
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

function renderIntervalsSection(car: Car, open: boolean): string {
  const allWithInterval = (Object.keys(CATEGORIES) as CategoryId[]).filter((id) => CATEGORIES[id].intervalKm);
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

export function renderSettings(car: Car, cars: Car[], account: Account, intervalsOpen: boolean): string {
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
      <h3>Фото автомобиля</h3>
      <div class="photo-avatar-row">
        ${carAvatar(car, 'lg')}
        <div class="photo-avatar-actions">
          <label class="btn btn-secondary btn-block" for="car-photo-input" style="text-align:center;cursor:pointer;">${car.photo ? 'Изменить фото' : 'Загрузить фото'}</label>
          <input type="file" id="car-photo-input" accept="image/*" style="display:none" />
          ${car.photo ? '<button type="button" class="btn btn-secondary btn-block" data-remove-photo>Удалить фото</button>' : ''}
        </div>
      </div>
    </div>

    <div class="settings-section">
      <h3>Характеристики автомобиля</h3>
      <label class="settings-field">VIN автомобиля
        <input type="text" id="car-vin-input" maxlength="17" style="text-transform:uppercase;" value="${escapeHtml(car.vin ?? '')}" placeholder="17 символов, напр. 1HGCM82633A004352" />
      </label>
      <button type="button" class="btn btn-secondary btn-block" id="vin-lookup-btn">🔍 Найти по VIN (база NHTSA)</button>
      <p class="hint" id="vin-lookup-hint"></p>
      <label class="settings-field">Название автомобиля
        <input type="text" id="car-name-input" value="${escapeHtml(car.name)}" />
      </label>
      <label class="settings-field">Марка
        <input type="text" id="car-brand-input" value="${escapeHtml(car.brand ?? '')}" placeholder="напр. Toyota" />
      </label>
      <label class="settings-field">Модель
        <input type="text" id="car-model-input" value="${escapeHtml(car.model ?? '')}" placeholder="напр. Mark II" />
      </label>
      <label class="settings-field">Год выпуска
        <input type="number" id="car-year-input" min="1900" max="2100" value="${car.year ?? ''}" placeholder="напр. 1998" />
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
