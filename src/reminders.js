// CONV-11 / ARQ-04: lembretes proativos, sem excesso. Água a cada 2 h (10h–20h) só quando
// o consumo está abaixo do ritmo da meta; resumo do dia no horário escolhido. Cada
// lembrete sai no máximo uma vez por dia e horário (chave registrada em reminder_log).

const normalize = (message) => String(message || "").normalize("NFD")
  .replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");

const WATER_HOURS = [10, 12, 14, 16, 18, 20];
const WATER_START_HOUR = 8;
const WATER_END_HOUR = 21;

// Comando de lembrete na conversa: { kind: "water", enabled } | { kind: "summary", time } | null.
export function parseReminderCommand(message) {
  const text = normalize(message);
  const off = /\b(?:par[ae]\w*|desativ\w*|cancel\w*|desligu\w*|tir[ae]\w*|nao quero (?:mais )?(?:os? )?)\b/.test(text);
  if (/\bagua\b/.test(text) && /\b(?:lembr\w*|avis\w*|notific\w*)/.test(text)) {
    return { kind: "water", enabled: !off };
  }
  if (/\bresumo\b/.test(text) && /\b(?:lembr\w*|mand\w*|envi\w*|avis\w*)/.test(text)) {
    if (off) return { kind: "summary", time: null };
    const time = text.match(/\b(?:as|a)?\s*(\d{1,2})(?:\s*(?:h|:)\s*(\d{2})?|\s*horas?)\b/);
    if (!time) return null;
    const hour = Number(time[1]);
    const minute = Number(time[2] || 0);
    if (hour > 23 || minute > 59) return null;
    return { kind: "summary", time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}` };
  }
  return null;
}

export function buildReminderCommandReply(command) {
  const window = "Obs.: pelo WhatsApp, a mensagem só chega se você tiver falado comigo nas últimas 24 h.";
  if (command.kind === "water") {
    return command.enabled
      ? `💧 Lembretes de água ativados: aviso às 10h, 12h, 14h, 16h, 18h e 20h, só quando você estiver abaixo do ritmo da meta. ${window}`
      : "💧 Lembretes de água desativados.";
  }
  return command.time
    ? `📊 Vou mandar o resumo do dia todos os dias às ${command.time}. ${window}`
    : "📊 Resumo diário automático desativado.";
}

// Hora local de São Paulo: { date: "AAAA-MM-DD", hour, minute }.
export function brazilClock(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(now).map(({ type, value }) => [type, value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), minute: Number(parts.minute) };
}

// Lembretes devidos agora. users: [{ id, reminder_water, reminder_summary_time, goalMl,
// waterMl }]; sent(userId, key) diz se já foi enviado. Puro: não envia nem grava nada.
export function dueReminders(users, now, sent) {
  const { date, hour, minute } = brazilClock(now);
  const due = [];
  for (const user of users) {
    if (user.reminder_water && WATER_HOURS.includes(hour)) {
      const key = `water:${date}:${hour}`;
      const expected = user.goalMl * (hour - WATER_START_HOUR) / (WATER_END_HOUR - WATER_START_HOUR);
      if (!sent(user.id, key) && user.waterMl < expected) due.push({ userId: user.id, key, kind: "water" });
    }
    if (user.reminder_summary_time) {
      const [targetHour, targetMinute] = user.reminder_summary_time.split(":").map(Number);
      const key = `summary:${date}`;
      if (hour * 60 + minute >= targetHour * 60 + targetMinute && !sent(user.id, key)) {
        due.push({ userId: user.id, key, kind: "summary" });
      }
    }
  }
  return due;
}

export function buildWaterReminder(waterMl, goalMl) {
  const liters = (ml) => `${(ml / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L`;
  return `💧 Lembrete de água: até agora ${liters(waterMl)} de ${liters(goalMl)}. Que tal um copo agora? Me diga quanto bebeu (ex.: "bebi 300 ml de água").`;
}
