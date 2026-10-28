// COR-02: zonas de frequência cardíaca pela idade. FC máxima estimada (Tanaka: 208 −
// 0,7 × idade) e 5 zonas em % da FC máxima. É estimativa; um teste de esforço é mais exato.
const ZONES = [
  [1, 0.5, 0.6, "recuperação"],
  [2, 0.6, 0.7, "base aeróbica"],
  [3, 0.7, 0.8, "moderado"],
  [4, 0.8, 0.9, "limiar"],
  [5, 0.9, 1.0, "máximo"]
];

export function maxHeartRate(age) {
  const years = Number(age);
  return years >= 10 && years <= 100 ? Math.round(208 - 0.7 * years) : null;
}

export function heartRateZones(age) {
  const max = maxHeartRate(age);
  if (!max) return null;
  return ZONES.map(([zone, low, high, label]) => ({ zone, label, from: Math.round(max * low), to: Math.round(max * high) }));
}

export function zoneOf(heartRate, age) {
  const zones = heartRateZones(age);
  const hr = Number(heartRate);
  if (!zones || !(hr > 0)) return null;
  return [...zones].reverse().find((zone) => hr >= zone.from) || { ...zones[0], zone: 1 };
}

// "151 bpm (Z3 · moderado)".
export function describeHeartRate(heartRate, age) {
  const zone = zoneOf(heartRate, age);
  return zone ? `${Math.round(heartRate)} bpm (Z${zone.zone} · ${zone.label})` : `${Math.round(heartRate)} bpm`;
}

export function buildZonesReply(age) {
  const zones = heartRateZones(age);
  if (!zones) return "❤️ Para calcular suas zonas preciso da sua idade. Me diga, por exemplo: *tenho 30 anos*.";
  return [
    `❤️ *Suas zonas de frequência cardíaca* (FC máx. estimada: ${maxHeartRate(age)} bpm)`,
    "",
    ...zones.map((zone) => `• *Z${zone.zone}* ${zone.label}: ${zone.from}–${zone.to} bpm`),
    "",
    "_Rodagens leves e longões: Z2. Limiar: Z4. Tiros curtos: Z5._",
    "_Estimativa pela idade; um teste de esforço dá zonas mais precisas._"
  ].join("\n");
}

export function isZonesQuery(message) {
  const text = String(message || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");
  return /\b(?:minhas zonas|zonas de (?:frequencia|fc|batimento)|zonas cardiacas|minha fc max|frequencia cardiaca maxima)\b/.test(text);
}
