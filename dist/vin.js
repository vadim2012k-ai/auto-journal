// Расшифровка VIN через открытую базу NHTSA (vPIC) — государственный API
// США, бесплатный, без ключа. База в первую очередь про автомобили,
// продававшиеся в США — для остальных VIN может не найти данные, тогда
// предлагаем заполнить характеристики вручную.
const NHTSA_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/';
function mapDriveType(raw) {
    if (!raw)
        return undefined;
    const s = raw.toLowerCase();
    if (s.includes('4x4') || s.includes('awd') || s.includes('all-wheel') || s.includes('all wheel'))
        return 'awd';
    if (s.includes('4x2') && s.includes('front'))
        return 'fwd';
    if (s.includes('rear') || s.includes('rwd'))
        return 'rwd';
    if (s.includes('front') || s.includes('fwd'))
        return 'fwd';
    return undefined;
}
function buildEngineType(r) {
    const parts = [];
    if (r.EngineCylinders)
        parts.push(`${r.EngineCylinders} цил.`);
    if (r.FuelTypePrimary)
        parts.push(r.FuelTypePrimary);
    return parts.length ? parts.join(', ') : undefined;
}
export async function lookupVin(vin) {
    const cleaned = vin.trim().toUpperCase();
    if (cleaned.length !== 17) {
        return { ok: false, error: 'VIN должен содержать ровно 17 символов' };
    }
    try {
        const res = await fetch(`${NHTSA_URL}${encodeURIComponent(cleaned)}?format=json`);
        if (!res.ok)
            return { ok: false, error: 'База NHTSA сейчас недоступна, попробуйте позже' };
        const json = (await res.json());
        const r = json.Results?.[0];
        if (!r || !r.Make) {
            return { ok: false, error: 'VIN не найден в базе NHTSA — заполните характеристики вручную' };
        }
        return {
            ok: true,
            brand: r.Make || undefined,
            model: r.Model || undefined,
            year: r.ModelYear ? Number(r.ModelYear) : undefined,
            engineType: buildEngineType(r),
            engineVolume: r.DisplacementL ? Math.round(Number(r.DisplacementL) * 10) / 10 : undefined,
            enginePower: r.EngineHP ? Math.round(Number(r.EngineHP)) : undefined,
            driveType: mapDriveType(r.DriveType),
        };
    }
    catch {
        return { ok: false, error: 'Нет соединения с базой NHTSA — проверьте интернет' };
    }
}
