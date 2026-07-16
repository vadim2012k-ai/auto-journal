import { STATUS_COLORS, ZONES } from './config.js';
import { zoneStatus } from './status.js';
// Схема "вид снизу": кузов вертикально, нос сверху.
// viewBox подобран так, чтобы удобно ложиться в мобильный экран (портрет).
// По бокам оставлены поля (MARGIN) — туда вынесены подписи колёс, чтобы
// текст лежал на светлом фоне подложки, а не на тёмном кузове.
const MARGIN = 46;
const CAR_W = 320;
const VB_W = CAR_W + MARGIN * 2;
const VB_H = 640;
function zoneFill(car, zoneId) {
    return STATUS_COLORS[zoneStatus(car, zoneId)];
}
function wheelLabel(zoneId, side, cy, line1, line2) {
    const x = side === 'left' ? MARGIN / 2 : VB_W - MARGIN / 2;
    return `
    <g class="zone" data-zone="${zoneId}" tabindex="0">
      <text x="${x}" y="${cy - 4}" text-anchor="middle" class="diagram-wheel-label">
        <tspan x="${x}">${line1}</tspan>
        <tspan x="${x}" dy="11">${line2}</tspan>
      </text>
    </g>`;
}
export function renderCarDiagram(car) {
    const engineFill = zoneFill(car, 'engine');
    const gearboxFill = zoneFill(car, 'gearbox');
    const diffFill = zoneFill(car, 'diff');
    const coolingFill = zoneFill(car, 'cooling');
    const cabinFill = zoneFill(car, 'cabin');
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

    <!-- Подписи колёс — в полях по бокам, на фоне подложки -->
    ${wheelLabel('wheel_fl', 'left', 150, 'Переднее', 'левое')}
    ${wheelLabel('wheel_fr', 'right', 150, 'Переднее', 'правое')}
    ${wheelLabel('wheel_rl', 'left', 480, 'Заднее', 'левое')}
    ${wheelLabel('wheel_rr', 'right', 480, 'Заднее', 'правое')}

    <g transform="translate(${MARGIN}, 0)">
      <!-- Кузов -->
      <rect x="60" y="16" width="200" height="608" rx="46" fill="url(#bodyGrad)" stroke="#334155" stroke-width="2"/>
      <text x="160" y="8" text-anchor="middle" class="diagram-caption">НОС</text>

      <!-- Радиатор / охлаждение -->
      <g class="zone" data-zone="cooling" tabindex="0">
        <rect x="104" y="30" width="112" height="26" rx="6" fill="${coolingFill}" fill-opacity="0.85" stroke="#0f172a" stroke-width="1.5"/>
        <text x="160" y="47" text-anchor="middle" class="diagram-label">Охлаждение</text>
      </g>

      <!-- Двигатель -->
      <g class="zone" data-zone="engine" tabindex="0">
        <rect x="88" y="66" width="144" height="116" rx="14" fill="${engineFill}" fill-opacity="0.85" stroke="#0f172a" stroke-width="1.5"/>
        <text x="160" y="118" text-anchor="middle" class="diagram-label diagram-label-lg">🔧 Двигатель</text>
        <text x="160" y="140" text-anchor="middle" class="diagram-sublabel">масло · фильтры · свечи · ГРМ</text>
      </g>

      <!-- Передняя ось: колёса + тормоза -->
      <g class="zone" data-zone="wheel_fl" tabindex="0">
        <circle cx="58" cy="150" r="34" fill="${tireFlFill}" fill-opacity="0.8" stroke="#0f172a" stroke-width="1.5"/>
      </g>
      <g class="zone" data-zone="brakes_front" tabindex="0">
        <circle cx="58" cy="150" r="15" fill="${brakesFrontFill}" stroke="#0f172a" stroke-width="1.5"/>
      </g>
      <g class="zone" data-zone="wheel_fr" tabindex="0">
        <circle cx="262" cy="150" r="34" fill="${tireFrFill}" fill-opacity="0.8" stroke="#0f172a" stroke-width="1.5"/>
      </g>
      <g class="zone" data-zone="brakes_front" tabindex="0">
        <circle cx="262" cy="150" r="15" fill="${brakesFrontFill}" stroke="#0f172a" stroke-width="1.5"/>
      </g>

      <!-- КПП -->
      <g class="zone" data-zone="gearbox" tabindex="0">
        <rect x="112" y="196" width="96" height="66" rx="12" fill="${gearboxFill}" fill-opacity="0.85" stroke="#0f172a" stroke-width="1.5"/>
        <text x="160" y="234" text-anchor="middle" class="diagram-label">⚙️ КПП</text>
      </g>

      <!-- Салон -->
      <g class="zone" data-zone="cabin" tabindex="0">
        <rect x="98" y="272" width="124" height="128" rx="14" fill="${cabinFill}" fill-opacity="0.85" stroke="#0f172a" stroke-width="1.5"/>
        <text x="160" y="330" text-anchor="middle" class="diagram-label diagram-label-lg">💺 Салон</text>
        <text x="160" y="352" text-anchor="middle" class="diagram-sublabel">салонный фильтр</text>
      </g>

      <!-- Карданный вал / выхлоп (не кликабельно, поверх салона) -->
      <line x1="160" y1="262" x2="160" y2="440" stroke="#475569" stroke-width="6" stroke-linecap="round" stroke-dasharray="2 10"/>

      <!-- Редуктор / мост -->
      <g class="zone" data-zone="diff" tabindex="0">
        <rect x="106" y="410" width="108" height="52" rx="12" fill="${diffFill}" fill-opacity="0.85" stroke="#0f172a" stroke-width="1.5"/>
        <text x="160" y="441" text-anchor="middle" class="diagram-label">🔩 Редуктор</text>
      </g>

      <!-- Задняя ось: колёса + тормоза -->
      <g class="zone" data-zone="wheel_rl" tabindex="0">
        <circle cx="58" cy="480" r="34" fill="${tireRlFill}" fill-opacity="0.8" stroke="#0f172a" stroke-width="1.5"/>
      </g>
      <g class="zone" data-zone="brakes_rear" tabindex="0">
        <circle cx="58" cy="480" r="15" fill="${brakesRearFill}" stroke="#0f172a" stroke-width="1.5"/>
      </g>
      <g class="zone" data-zone="wheel_rr" tabindex="0">
        <circle cx="262" cy="480" r="34" fill="${tireRrFill}" fill-opacity="0.8" stroke="#0f172a" stroke-width="1.5"/>
      </g>
      <g class="zone" data-zone="brakes_rear" tabindex="0">
        <circle cx="262" cy="480" r="15" fill="${brakesRearFill}" stroke="#0f172a" stroke-width="1.5"/>
      </g>

      <!-- Бензобак (декоративно) -->
      <rect x="130" y="530" width="60" height="70" rx="10" fill="#1e293b" stroke="#334155" stroke-width="1.5"/>
      <text x="160" y="570" text-anchor="middle" class="diagram-sublabel">бак</text>
    </g>
  </svg>`;
}
export function zoneLabel(zoneId) {
    return ZONES[zoneId].label;
}
