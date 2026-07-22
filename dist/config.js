export const CATEGORIES = {
    engine_oil: {
        id: 'engine_oil',
        label: 'Масло двигателя',
        icon: '🛢️',
        intervalKm: 10000,
        intervalMonths: 12,
        brandLabel: 'Марка масла',
        specLabel: 'Вязкость',
        specPlaceholder: 'напр. 5W-30',
    },
    oil_filter: {
        id: 'oil_filter',
        label: 'Масляный фильтр',
        icon: '🧯',
        intervalKm: 10000,
        brandLabel: 'Производитель',
        specLabel: 'Артикул',
        specPlaceholder: 'напр. W712/75',
    },
    air_filter: {
        id: 'air_filter',
        label: 'Воздушный фильтр',
        icon: '💨',
        intervalKm: 15000,
        brandLabel: 'Производитель',
        specLabel: 'Артикул',
        specPlaceholder: '',
    },
    cabin_filter: {
        id: 'cabin_filter',
        label: 'Салонный фильтр',
        icon: '🌬️',
        intervalKm: 15000,
        intervalMonths: 12,
        brandLabel: 'Производитель',
        specLabel: 'Артикул',
        specPlaceholder: '',
    },
    spark_plugs: {
        id: 'spark_plugs',
        label: 'Свечи зажигания',
        icon: '⚡',
        intervalKm: 30000,
        brandLabel: 'Производитель',
        specLabel: 'Тип/калильное число',
        specPlaceholder: '',
    },
    timing_belt: {
        id: 'timing_belt',
        label: 'Ремень/цепь ГРМ',
        icon: '🔗',
        intervalKm: 60000,
        brandLabel: 'Производитель комплекта',
        specLabel: 'Комплект (ремень+ролики+помпа)',
        specPlaceholder: '',
    },
    gearbox_oil: {
        id: 'gearbox_oil',
        label: 'Масло в коробке',
        icon: '⚙️',
        intervalKm: 60000,
        brandLabel: 'Марка масла',
        specLabel: 'Вязкость/спецификация',
        specPlaceholder: 'напр. 75W-90',
    },
    diff_oil: {
        id: 'diff_oil',
        label: 'Масло в редукторе',
        icon: '🔩',
        intervalKm: 60000,
        brandLabel: 'Марка масла',
        specLabel: 'Вязкость/спецификация',
        specPlaceholder: 'напр. 75W-90',
    },
    transfer_case_oil: {
        id: 'transfer_case_oil',
        label: 'Масло в раздатке',
        icon: '🔀',
        intervalKm: 60000,
        brandLabel: 'Марка масла',
        specLabel: 'Вязкость/спецификация',
        specPlaceholder: 'напр. 75W-90',
    },
    coolant: {
        id: 'coolant',
        label: 'Охлаждающая жидкость',
        icon: '❄️',
        intervalKm: 60000,
        intervalMonths: 36,
        brandLabel: 'Марка',
        specLabel: 'Тип (G12, G13...)',
        specPlaceholder: '',
    },
    brake_fluid: {
        id: 'brake_fluid',
        label: 'Тормозная жидкость',
        icon: '🩸',
        intervalKm: 40000,
        intervalMonths: 24,
        brandLabel: 'Марка',
        specLabel: 'Тип (DOT4...)',
        specPlaceholder: '',
    },
    brake_pads_front: {
        id: 'brake_pads_front',
        label: 'Передние колодки',
        icon: '🛑',
        intervalKm: 30000,
        brandLabel: 'Производитель',
        specLabel: 'Артикул/комментарий',
        specPlaceholder: '',
    },
    brake_pads_rear: {
        id: 'brake_pads_rear',
        label: 'Задние колодки',
        icon: '🛑',
        intervalKm: 40000,
        brandLabel: 'Производитель',
        specLabel: 'Артикул/комментарий',
        specPlaceholder: '',
    },
    brake_disc_front: {
        id: 'brake_disc_front',
        label: 'Передние диски',
        icon: '💿',
        intervalKm: 60000,
        brandLabel: 'Производитель',
        specLabel: 'Артикул/комментарий',
        specPlaceholder: '',
    },
    brake_disc_rear: {
        id: 'brake_disc_rear',
        label: 'Задние диски',
        icon: '💿',
        intervalKm: 80000,
        brandLabel: 'Производитель',
        specLabel: 'Артикул/комментарий',
        specPlaceholder: '',
    },
    tires: {
        id: 'tires',
        label: 'Резина',
        icon: '🛞',
        brandLabel: 'Марка/модель шины',
        specLabel: 'Размер шины',
        specPlaceholder: 'напр. 205/55 R16',
        needsPosition: true,
        needsSeason: true,
    },
};
export const SEASON_LABELS = {
    summer: 'Лето',
    winter: 'Зима',
    all_season: 'Всесезонная',
};
export const ZONES = {
    engine: {
        id: 'engine',
        label: 'Двигатель',
        categories: ['engine_oil', 'oil_filter', 'air_filter', 'spark_plugs', 'timing_belt'],
    },
    gearbox: { id: 'gearbox', label: 'Коробка передач', categories: ['gearbox_oil'] },
    diff: { id: 'diff', label: 'Редуктор / задний мост', categories: ['diff_oil'] },
    transfer_case: { id: 'transfer_case', label: 'Раздаточная коробка', categories: ['transfer_case_oil'] },
    cooling: { id: 'cooling', label: 'Система охлаждения', categories: ['coolant'] },
    cabin: { id: 'cabin', label: 'Салон', categories: ['cabin_filter'] },
    brakes_front: {
        id: 'brakes_front',
        label: 'Передние тормоза',
        categories: ['brake_pads_front', 'brake_disc_front', 'brake_fluid'],
    },
    brakes_rear: {
        id: 'brakes_rear',
        label: 'Задние тормоза',
        categories: ['brake_pads_rear', 'brake_disc_rear'],
    },
    wheel_fl: { id: 'wheel_fl', label: 'Шина: перед. левое', categories: ['tires'] },
    wheel_fr: { id: 'wheel_fr', label: 'Шина: перед. правое', categories: ['tires'] },
    wheel_rl: { id: 'wheel_rl', label: 'Шина: задн. левое', categories: ['tires'] },
    wheel_rr: { id: 'wheel_rr', label: 'Шина: задн. правое', categories: ['tires'] },
};
/** Группы для фильтра в журнале — по системам авто, а не по узкой категории */
export const JOURNAL_GROUPS = [
    {
        id: 'engine',
        label: 'Двигатель',
        icon: '🔧',
        categories: ['engine_oil', 'oil_filter', 'air_filter', 'spark_plugs', 'timing_belt'],
    },
    { id: 'gearbox', label: 'КПП', icon: '⚙️', categories: ['gearbox_oil'] },
    { id: 'diff', label: 'Редуктор', icon: '🔩', categories: ['diff_oil'] },
    { id: 'transfer_case', label: 'Раздатка', icon: '🔀', categories: ['transfer_case_oil'] },
    { id: 'cooling', label: 'Охлаждение', icon: '❄️', categories: ['coolant'] },
    { id: 'cabin', label: 'Салон', icon: '💺', categories: ['cabin_filter'] },
    {
        id: 'brakes',
        label: 'Тормоза',
        icon: '🛑',
        categories: ['brake_fluid', 'brake_pads_front', 'brake_pads_rear', 'brake_disc_front', 'brake_disc_rear'],
    },
    { id: 'tires', label: 'Резина', icon: '🛞', categories: ['tires'] },
];
/**
 * Убирает узлы трансмиссии, которых физически нет при данном типе привода
 * (раздатка — только на полном, редуктор — на полном/заднем).
 */
export function categoriesForDriveType(driveType, categories) {
    if (driveType === 'fwd') {
        return categories.filter((c) => c !== 'diff_oil' && c !== 'transfer_case_oil');
    }
    if (driveType === 'rwd') {
        return categories.filter((c) => c !== 'transfer_case_oil');
    }
    return categories;
}
export const WHEEL_ZONE_POSITION = {
    wheel_fl: 'FL',
    wheel_fr: 'FR',
    wheel_rl: 'RL',
    wheel_rr: 'RR',
};
export const STATUS_COLORS = {
    unknown: '#94a3b8',
    ok: '#22c55e',
    soon: '#f59e0b',
    overdue: '#ef4444',
};
export const STATUS_LABELS = {
    unknown: 'Нет данных',
    ok: 'В норме',
    soon: 'Скоро',
    overdue: 'Просрочено',
};
