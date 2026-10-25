// ACO-01: check-in diário opcional. "check-in" faz as 3 perguntas; a resposta ("dormi 6h,
// energia 2, sem dor") é registrada e ajusta o treino de hoje: dor → descanso; energia
// baixa ou sono curto → versão leve; tudo bem → mostra o treino. Sem o modelo.
import { saveCheckin, saveSleep } from "./db.js";
import { detectSleepReport } from "./mealIntent.js";
import { adaptTodayTraining, handleTrainingMessage } from "./training/service.js";

const normalize = (text) => String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR").trim();

export function isCheckinRequest(message) {
  return /^(?:(?:fazer|faz|vamos|bora)(?: o| um)? )?check[- ]?in(?: de hoje| diario)?[!.?]*$/.test(normalize(message));
}

export const CHECKIN_QUESTION = [
  "☀️ *Check-in de hoje*",
  "Responda numa mensagem só:",
  "1️⃣ Quantas horas dormiu?",
  "2️⃣ Energia de 1 a 5?",
  "3️⃣ Alguma dor? (onde)",
  "",
  "_Ex.: dormi 7h, energia 4, sem dor_"
].join("\n");

const ENERGY_WORDS = { pessima: 1, pessimo: 1, baixa: 2, baixo: 2, fraca: 2, media: 3, normal: 3, ok: 3, boa: 4, bom: 4, alta: 5, otima: 5, otimo: 5 };

// Resposta do check-in: exige a energia (número 1–5 ou palavra), que é o que distingue
// de um simples "dormi 7h". { sleepHours, energy, pain } ou null.
export function parseCheckinAnswer(message) {
  const text = normalize(message);
  const energyMatch = text.match(/\b(?:energia|disposicao|disposta|disposto)\s*(?:e|eh|esta|ta|de|:|=)?\s*(?:(\d)(?:\s*(?:\/|de)\s*5)?|(pessim[ao]|baix[ao]|fraca|media|normal|ok|bo[am]|alta|otim[ao]))\b/);
  if (!energyMatch) return null;
  const energy = energyMatch[1] ? Number(energyMatch[1]) : ENERGY_WORDS[energyMatch[2]];
  if (!(energy >= 1 && energy <= 5)) return null;
  const sleep = detectSleepReport(message);
  const noPain = /\b(?:sem dor(?:es)?|nenhuma dor|nao (?:tenho|to com|estou com) dor|dor nenhuma|zero dor)\b/.test(text);
  const pain = noPain
    ? null
    : text.match(/\bdor(?:es)?\s+(?:no|na|nos|nas|em|de)\s+([a-z]+(?:\s+(?:direit[oa]|esquerd[oa]))?)/)?.[1]
      || (/\b(?:dor|doendo|doi|machuquei|lesao)\b/.test(text) ? "sim" : null);
  return { sleepHours: sleep?.hours ?? null, sleepQuality: sleep?.quality ?? null, energy, pain };
}

export function handleCheckinMessage(userId, message, today) {
  if (isCheckinRequest(message)) return CHECKIN_QUESTION;
  const answer = parseCheckinAnswer(message);
  if (!answer) return null;
  saveCheckin(userId, { date: today, sleepHours: answer.sleepHours, energy: answer.energy, pain: answer.pain });
  if (answer.sleepHours) saveSleep(userId, answer.sleepHours, answer.sleepQuality);

  const fmtHours = (hours) => `${String(Math.round(hours * 10) / 10).replace(".", ",")} h`;
  const lines = [
    "✅ *Check-in registrado*",
    [answer.sleepHours ? `😴 Sono: ${fmtHours(answer.sleepHours)}` : null, `⚡ Energia: ${answer.energy}/5`, `🩹 Dor: ${answer.pain ? (answer.pain === "sim" ? "sim" : answer.pain) : "nenhuma"}`].filter(Boolean).join(" · "),
    ""
  ];
  const tired = answer.energy <= 2 || (answer.sleepHours !== null && answer.sleepHours < 6);
  if (answer.pain) {
    lines.push(adaptTodayTraining(userId, "dor", today)
      || "🩹 Com dor, pegue leve hoje. Se for forte, durar mais de 2–3 dias ou piorar ao se movimentar, procure um profissional de saúde.");
  } else if (tired) {
    lines.push(adaptTodayTraining(userId, "cansaco", today)
      || "😮‍💨 Dia de energia baixa: priorize se hidratar, comer bem e, se der, dormir mais cedo hoje.");
  } else {
    const training = handleTrainingMessage(userId, "qual meu treino de hoje?", today);
    lines.push(answer.energy >= 4 ? "💪 Energia boa, bora!" : "👍 Tudo certo para seguir o plano.");
    if (training && !/ainda não tem um plano/.test(training)) lines.push("", training);
  }
  return lines.join("\n");
}
