// CONV-03: datas relativas em português sobre datas "YYYY-MM-DD" (fuso já resolvido
// pelo chamador: getDailySummary().date é a data de hoje no Brasil). Funções puras.
import { parseQuantity } from "./foodMatching.js";

const WEEKDAYS = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };
const WEEKDAY_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const WORD_COUNT = "\\d+|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|quinze|trinta";

function normalize(value) {
  return String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");
}

function toUtc(date) {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function fromUtc(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date, days) {
  return fromUtc(toUtc(date) + days * 86400000);
}

export function weekdayOf(date) {
  return new Date(toUtc(date)).getUTCDay();
}

export function daysBetween(start, end) {
  return Math.round((toUtc(end) - toUtc(start)) / 86400000);
}

// "22/10" -> "qua 22/10"
export function formatDay(date) {
  const [, month, day] = date.split("-");
  return `${WEEKDAY_SHORT[weekdayOf(date)]} ${day}/${month}`;
}

function mondayOf(date) {
  return addDays(date, -((weekdayOf(date) + 6) % 7));
}

function countFrom(token) {
  const words = { quinze: 15, trinta: 30 };
  return words[token] ?? parseQuantity(token);
}

// Referência a uma data ou período na mensagem, relativa a `today`.
// Retorna { start, end, label, single } ou null. Datas futuras não são aceitas.
export function parseDateReference(message, today) {
  const text = normalize(message);

  const lastDays = text.match(new RegExp(`\\bultim[oa]s\\s+(${WORD_COUNT})\\s+dias\\b`));
  if (lastDays) {
    const count = countFrom(lastDays[1]);
    if (count >= 1 && count <= 366) {
      return { start: addDays(today, -(count - 1)), end: today, label: `últimos ${count} dias`, single: count === 1 };
    }
  }
  if (/\bsemana\s+(?:passada|anterior)\b/.test(text)) {
    const start = addDays(mondayOf(today), -7);
    return { start, end: addDays(start, 6), label: "semana passada", single: false };
  }
  if (/\b(?:(?:esta|essa|nesta|nessa|desta|dessa)\s+semana|da\s+semana|semanal)\b/.test(text)) {
    return { start: mondayOf(today), end: today, label: "esta semana", single: false };
  }
  if (/\bmes\s+(?:passado|anterior)\b/.test(text)) {
    const firstOfThisMonth = `${today.slice(0, 7)}-01`;
    const end = addDays(firstOfThisMonth, -1);
    return { start: `${end.slice(0, 7)}-01`, end, label: "mês passado", single: false };
  }
  if (/\b(?:(?:este|esse|neste|nesse|deste|desse)\s+mes|do\s+mes)\b/.test(text)) {
    return { start: `${today.slice(0, 7)}-01`, end: today, label: "este mês", single: false };
  }
  if (/\banteontem\b/.test(text)) {
    const day = addDays(today, -2);
    return { start: day, end: day, label: "anteontem", single: true };
  }
  if (/\bontem\b/.test(text)) {
    const day = addDays(today, -1);
    return { start: day, end: day, label: "ontem", single: true };
  }
  const weekday = text.match(/\b(domingo|segunda|terca|quarta|quinta|sexta|sabado)(?:[\s-]feira)?(\s+passad[ao])?\b/);
  if (weekday) {
    const back = (weekdayOf(today) - WEEKDAYS[weekday[1]] + 7) % 7;
    const offset = back === 0 && weekday[2] ? 7 : back;
    const day = addDays(today, -offset);
    return { start: day, end: day, label: offset === 0 ? "hoje" : formatDay(day), single: true };
  }
  const explicit = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (explicit) {
    const [, d, m, y] = explicit;
    let year = y ? Number(y.length === 2 ? `20${y}` : y) : Number(today.slice(0, 4));
    let day = `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (!y && day > today) day = `${year - 1}${day.slice(4)}`;
    const valid = !Number.isNaN(toUtc(day)) && fromUtc(toUtc(day)) === day;
    if (valid && day <= today) return { start: day, end: day, label: formatDay(day), single: true };
  }
  if (/\bhoje\b/.test(text)) {
    return { start: today, end: today, label: "hoje", single: true };
  }
  return null;
}

// Data passada (um único dia antes de hoje) citada num relato de refeição:
// "ontem no jantar comi…". Hoje, períodos e datas futuras não contam.
export function parsePastMealDate(message, today) {
  const reference = parseDateReference(message, today);
  return reference?.single && reference.start < today ? reference.start : null;
}
