// Базовые типы данных приложения.
// Идея: этот файл описывает "доменную модель" так, чтобы её было легко
// перенести в React/бэкенд позже — здесь нет зависимостей от DOM.

export type CategoryId =
  | 'engine_oil'
  | 'oil_filter'
  | 'air_filter'
  | 'cabin_filter'
  | 'spark_plugs'
  | 'timing_belt'
  | 'gearbox_oil'
  | 'diff_oil'
  | 'coolant'
  | 'brake_fluid'
  | 'brake_pads_front'
  | 'brake_pads_rear'
  | 'tires';

export type ZoneId =
  | 'engine'
  | 'gearbox'
  | 'diff'
  | 'cooling'
  | 'cabin'
  | 'brakes_front'
  | 'brakes_rear'
  | 'wheel_fl'
  | 'wheel_fr'
  | 'wheel_rl'
  | 'wheel_rr';

export type WheelPosition = 'FL' | 'FR' | 'RL' | 'RR';

/** Область применения записи о резине: одно колесо, ось или все четыре */
export type TireScope = 'single' | 'front' | 'rear' | 'all';

export type SeasonType = 'summer' | 'winter' | 'all_season';

export type ServiceStatus = 'unknown' | 'ok' | 'soon' | 'overdue';

export interface MaintenanceRecord {
  id: string;
  carId: string;
  category: CategoryId;
  /** Только для category === 'tires' — какое колесо */
  position?: WheelPosition;
  date: string; // YYYY-MM-DD
  mileage: number;
  brand?: string;
  spec?: string;
  /** Только для category === 'tires' — сезонность резины */
  season?: SeasonType;
  cost?: number;
  notes?: string;
  createdAt: number;
}

export interface Car {
  id: string;
  name: string;
  driveType: 'rwd';
  odometer: number;
  createdAt: number;
  /** Характеристики автомобиля — заполняются опционально в настройках */
  brand?: string;
  model?: string;
  engineType?: string;
  /** Литраж двигателя, л */
  engineVolume?: number;
  /** Мощность двигателя, л.с. */
  enginePower?: number;
  /** Объём топливного бака, л — нужен для расчёта запаса хода */
  tankCapacity?: number;
}

/** Запись о заправке: пробег на одометре, сколько литров залито и за сколько */
export interface FuelRecord {
  id: string;
  carId: string;
  date: string; // YYYY-MM-DD
  mileage: number;
  liters: number;
  /** Общая сумма заправки, ₽ */
  cost: number;
  createdAt: number;
}

export interface AppData {
  cars: Car[];
  activeCarId: string | null;
  records: MaintenanceRecord[];
  fuel: FuelRecord[];
}
