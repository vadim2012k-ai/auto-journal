import { STATUS_COLORS, ZONES } from './config.js';
import { zoneStatus } from './status.js';
// Схема "вид снизу": кузов вертикально, нос сверху.
// viewBox подобран так, чтобы удобно ложиться в мобильный экран (портрет).
const VB_W = 320;
const VB_H = 640;
const TIRE_R = 32;
const BRAKE_R = 15;
const BRAKE_GAP = 2;
function zoneFill(car, zoneId) {
    return STATUS_COLORS[zoneStatus(car, zoneId)];
}
/**
 * Колесо = одна большая кликабельная шина (с подписью прямо на ней) +
 * отдельный маленький кружок-бейдж тормозов, касающийся её снаружи —
 * это два явно разных круга, а не вложенные друг в друга, чтобы было
 * понятно, куда именно тапаешь.
 */
function wheelGroup(wheelZone, brakeZone, cx, cy, tireFill, brakeFill, line1, line2, badgeDir) {
    const badgeOffset = TIRE_R + BRAKE_R + BRAKE_GAP;
    const badgeCy = badgeDir === 'below' ? cy + badgeOffset : cy - badgeOffset;
    return `
      <g class="zone" data-zone="${wheelZone}" tabindex="0">
        <circle cx="${cx}" cy="${cy}" r="${TIRE_R}" fill="${tireFill}" fill-opacity="0.8" stroke="#0f172a" stroke-width="1.5"/>
        <text x="${cx}" y="${cy - 6}" text-anchor="middle" class="diagram-wheel-label">
          <tspan x="${cx}">${line1}</tspan>
          <tspan x="${cx}" dy="13">${line2}</tspan>
        </text>
      </g>
      <g class="zone" data-zone="${brakeZone}" tabindex="0">
        <circle cx="${cx}" cy="${badgeCy}" r="${BRAKE_R}" fill="${brakeFill}" fill-opacity="0.9" stroke="#0f172a" stroke-width="1.5"/>
        <text x="${cx}" y="${badgeCy + 4}" text-anchor="middle" class="diagram-badge-icon">🛑</text>
      </g>`;
}
/** Короткий пунктирный "приводной вал" (декоративно, не кликабельно) */
function axleStub(fromX, fromY, toX, toY) {
    return `<line x1="${fromX}" y1="${fromY}" x2="${toX}" y2="${toY}" stroke="#475569" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 8"/>`;
}
function cabinBlock(cabinFill, y, height) {
    const midY = y + height / 2;
    return `
    <g class="zone" data-zone="cabin" tabindex="0">
      <rect x="98" y="${y}" width="124" height="${height}" rx="14" fill="${cabinFill}" fill-opacity="0.85" stroke="#0f172a" stroke-width="1.5"/>
      <text x="160" y="${midY - 7}" text-anchor="middle" class="diagram-label diagram-label-lg">💺 Салон</text>
      <text x="160" y="${midY + 15}" text-anchor="middle" class="diagram-sublabel">салонный фильтр</text>
    </g>`;
}
/**
 * Все пунктирные "валы" схемы — для того типа привода, что выбран.
 * Рисуются ОТДЕЛЬНО и РАНЬШЕ, чем колёса и коробки/редукторы, чтобы те
 * своей заливкой и подписями перекрывали концы линий, а не наоборот.
 */
function drivetrainLines(car) {
    const driveType = car.driveType;
    const rearStubs = `${axleStub(106, 436, 58, 480)}${axleStub(214, 436, 262, 480)}`;
    if (driveType === 'fwd') {
        return `${axleStub(112, 210, 58, 150)}${axleStub(208, 210, 262, 150)}`;
    }
    if (driveType === 'awd') {
        return `
    ${axleStub(112, 272, 58, 150)}${axleStub(208, 272, 262, 150)}
    <line x1="160" y1="302" x2="160" y2="410" stroke="#475569" stroke-width="6" stroke-linecap="round" stroke-dasharray="2 10"/>
    ${rearStubs}`;
    }
    // rwd
    return `
    <line x1="160" y1="262" x2="160" y2="440" stroke="#475569" stroke-width="6" stroke-linecap="round" stroke-dasharray="2 10"/>
    ${rearStubs}`;
}
/**
 * Коробки/зоны трансмиссии (без линий — они уже нарисованы отдельным,
 * более ранним слоем схемы).
 */
function drivetrainBoxes(car, gearboxFill) {
    const driveType = car.driveType;
    const gearboxBox = `
    <g class="zone" data-zone="gearbox" tabindex="0">
      <rect x="112" y="196" width="96" height="66" rx="12" fill="${gearboxFill}" fill-opacity="0.85" stroke="#0f172a" stroke-width="1.5"/>
      <text x="160" y="234" text-anchor="middle" class="diagram-label">⚙️ КПП</text>
    </g>`;
    if (driveType === 'fwd') {
        // Передний привод: коробка передач = трансмиссия целиком, редуктора и
        // карданного вала нет — переднее место освобождается под салон.
        return `${gearboxBox}${cabinBlock(zoneFill(car, 'cabin'), 272, 190)}`;
    }
    if (driveType === 'awd') {
        const transferFill = zoneFill(car, 'transfer_case');
        const diffFill = zoneFill(car, 'diff');
        return `${gearboxBox}
    <!-- Раздаточная коробка -->
    <g class="zone" data-zone="transfer_case" tabindex="0">
      <rect x="108" y="268" width="104" height="34" rx="10" fill="${transferFill}" fill-opacity="0.85" stroke="#0f172a" stroke-width="1.5"/>
      <text x="160" y="290" text-anchor="middle" class="diagram-label">🔀 Раздатка</text>
    </g>
    ${cabinBlock(zoneFill(car, 'cabin'), 310, 90)}
    <!-- Редуктор / задний мост -->
    <g class="zone" data-zone="diff" tabindex="0">
      <rect x="106" y="410" width="108" height="52" rx="12" fill="${diffFill}" fill-opacity="0.85" stroke="#0f172a" stroke-width="1.5"/>
      <text x="160" y="441" text-anchor="middle" class="diagram-label">🔩 Редуктор</text>
    </g>`;
    }
    // rwd (по умолчанию)
    const diffFill = zoneFill(car, 'diff');
    return `${gearboxBox}
    ${cabinBlock(zoneFill(car, 'cabin'), 272, 128)}
    <!-- Редуктор / мост -->
    <g class="zone" data-zone="diff" tabindex="0">
      <rect x="106" y="410" width="108" height="52" rx="12" fill="${diffFill}" fill-opacity="0.85" stroke="#0f172a" stroke-width="1.5"/>
      <text x="160" y="441" text-anchor="middle" class="diagram-label">🔩 Редуктор</text>
    </g>`;
}
export function renderCarDiagram(car) {
    const engineFill = zoneFill(car, 'engine');
    const gearboxFill = zoneFill(car, 'gearbox');
    const coolingFill = zoneFill(car, 'cooling');
    const brakesFrontFill = zoneFill(car, 'brakes_front');
    const brakesRearFill = zoneFill(car, 'brakes_rear');
    const tireFlFill = zoneFill(car, 'wheel_fl');
    const tireFrFill = zoneFill(car, 'wheel_fr');
    const tireRlFill = zoneFill(car, 'wheel_rl');
    const tireRrFill = zoneFill(car, 'wheel_rr');
    return `
  <svg viewBox="0 0 ${VB_W} ${VB_H}" class="car-svg" role="img" aria-label="Схема автомобиля снизу">
    <defs>
      <linearGradient id="bodyGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#1e293b"/>
        <stop offset="1" stop-color="#0f172a"/>
      </linearGradient>
    </defs>

    <!-- Кузов -->
    <rect x="60" y="16" width="200" height="608" rx="46" fill="url(#bodyGrad)" stroke="#334155" stroke-width="2"/>
    <text x="160" y="8" text-anchor="middle" class="diagram-caption">НОС</text>

    <!-- Пунктирные валы привода — рисуются первыми, "под" всеми узлами -->
    ${drivetrainLines(car)}

    <!-- Радиатор / охлаждение -->
    <g class="zone" data-zone="cooling" tabindex="0">
      <rect x="104" y="30" width="112" height="26" rx="6" fill="${coolingFill}" fill-opacity="0.85" stroke="#0f172a" stroke-width="1.5"/>
      <text x="160" y="47" text-anchor="middle" class="diagram-label">Охлаждение</text>
    </g>

    <!-- Двигатель -->
    <g class="zone" data-zone="engine" tabindex="0">
      <rect x="88" y="66" width="144" height="116" rx="14" fill="${engineFill}" fill-opacity="0.85" stroke="#0f172a" stroke-width="1.5"/>
      <text x="160" y="118" text-anchor="middle" class="diagram-label diagram-label-lg">🔧 Двигатель</text>
      <text x="160" y="138" text-anchor="middle" class="diagram-sublabel">
        <tspan x="160">масло · фильтры</tspan>
        <tspan x="160" dy="13">свечи · ГРМ</tspan>
      </text>
    </g>

    <!-- Передняя ось: колёса + тормоза -->
    ${wheelGroup('wheel_fl', 'brakes_front', 58, 150, tireFlFill, brakesFrontFill, 'Переднее', 'левое', 'below')}
    ${wheelGroup('wheel_fr', 'brakes_front', 262, 150, tireFrFill, brakesFrontFill, 'Переднее', 'правое', 'below')}

    ${drivetrainBoxes(car, gearboxFill)}

    <!-- Задняя ось: колёса + тормоза -->
    ${wheelGroup('wheel_rl', 'brakes_rear', 58, 480, tireRlFill, brakesRearFill, 'Заднее', 'левое', 'above')}
    ${wheelGroup('wheel_rr', 'brakes_rear', 262, 480, tireRrFill, brakesRearFill, 'Заднее', 'правое', 'above')}

    <!-- Бензобак (декоративно) -->
    <rect x="130" y="530" width="60" height="70" rx="10" fill="#1e293b" stroke="#334155" stroke-width="1.5"/>
    <text x="160" y="565" text-anchor="middle" class="diagram-sublabel">бак</text>
    <text x="160" y="580" text-anchor="middle" class="diagram-sublabel">${car.tankCapacity ? `${car.tankCapacity} л` : '—'}</text>
  </svg>`;
}
export function zoneLabel(zoneId) {
    return ZONES[zoneId].label;
}
