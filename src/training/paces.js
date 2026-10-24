// COR-02: ritmos de corrida. Funções puras.
// Os ritmos de treino derivam do pace de 5 km (equivalência de provas pela fórmula de
// Riegel, expoente 1,06; zonas proporcionais ao estilo de Jack Daniels). São estimativas
// para orientar o esforço, não prescrição médica.

// "25:30", "25min", "1h05", "1:05:30", "25 minutos e 30 segundos" → segundos.
export function parseDuration(text) {
  const value = String(text || "").toLocaleLowerCase("pt-BR").trim();
  const clock = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (clock) {
    const [, a, b, c] = clock.map(Number);
    return c === undefined || Number.isNaN(c) ? a * 60 + b : a * 3600 + b * 60 + c;
  }
  const hours = Number(value.match(/(\d+(?:[.,]\d+)?)\s*h/)?.[1]?.replace(",", ".") || 0);
  const minutes = Number(value.match(/(\d+(?:[.,]\d+)?)\s*(?:min|m\b|minutos?)/)?.[1]?.replace(",", ".") || 0);
  const seconds = Number(value.match(/(\d+)\s*(?:s\b|seg|segundos?)/)?.[1] || 0);
  const afterHours = value.match(/\d+\s*h\s*(\d{1,2})\b/)?.[1];
  const total = hours * 3600 + (minutes || Number(afterHours || 0)) * 60 + seconds;
  return total > 0 ? Math.round(total) : null;
}

// 330 → "5:30"
export function formatPace(secondsPerKm) {
  if (!(secondsPerKm > 0)) return null;
  const rounded = Math.round(secondsPerKm);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}

// 1830 → "30:30"; 5430 → "1:30:30"
export function formatDuration(seconds) {
  const total = Math.round(Number(seconds) || 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

export function paceOf(distanceKm, durationSeconds) {
  return distanceKm > 0 && durationSeconds > 0 ? durationSeconds / distanceKm : null;
}

// Tempo previsto em outra distância (Riegel).
export function predictTime(timeSeconds, fromKm, toKm) {
  return timeSeconds * (toKm / fromKm) ** 1.06;
}

// Ritmos de treino (s/km) a partir do tempo de 5 km. Faixas [rápido, lento].
export function trainingPaces(fiveKSeconds) {
  if (!(fiveKSeconds > 0)) return null;
  const p5 = fiveKSeconds / 5;
  const at = (factor) => Math.round(p5 * factor);
  return {
    five_k: at(1),
    ten_k: Math.round(predictTime(fiveKSeconds, 5, 10) / 10),
    half: Math.round(predictTime(fiveKSeconds, 5, 21.0975) / 21.0975),
    marathon: Math.round(predictTime(fiveKSeconds, 5, 42.195) / 42.195),
    interval: [at(0.97), at(1.0)],
    threshold: [at(1.06), at(1.09)],
    easy: [at(1.22), at(1.32)],
    long: [at(1.22), at(1.3)],
    recovery: [at(1.32), at(1.42)],
    strides: at(0.9)
  };
}

// Tempo de 5 km a partir de outra referência (prova, treino forte ou pace confortável).
// easyPaceSeconds: pace em que a pessoa corre conversando ≈ 1,27 × pace de 5 km.
export function fiveKFromReference({ distanceKm, timeSeconds, easyPaceSeconds } = {}) {
  if (distanceKm > 0 && timeSeconds > 0) return Math.round(predictTime(timeSeconds, distanceKm, 5));
  if (easyPaceSeconds > 0) return Math.round((easyPaceSeconds / 1.27) * 5);
  return null;
}

export function paceRange([fast, slow]) {
  return `${formatPace(fast)}–${formatPace(slow)}/km`;
}
