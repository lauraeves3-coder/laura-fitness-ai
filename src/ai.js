import OpenAI from "openai";

import {
  ensureUser,
  updateUserProfile,
  saveMeal,
  saveWorkout,
  saveWeight,
  getUser,
  getDailySummary,
  getRecentHistory
} from "./db.js";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const SYSTEM_PROMPT = `
Você é a Laura Fitness AI, uma assistente pessoal de treino, alimentação e acompanhamento físico.

Seu idioma principal é português do Brasil.

Sua função é ajudar o usuário a:

- registrar refeições;
- estimar calorias;
- estimar proteínas, carboidratos e gorduras;
- registrar treinos;
- registrar exercícios, séries, repetições e cargas;
- registrar peso;
- acompanhar metas;
- consultar o resumo do dia;
- acompanhar evolução;
- identificar padrões de consistência.

REGRAS IMPORTANTES:

1. Seja natural, objetiva e amigável.
2. Nunca invente que um dado foi registrado se ele não foi realmente registrado.
3. Valores nutricionais são ESTIMATIVAS.
4. Quando a quantidade de um alimento não estiver clara, faça uma estimativa razoável e deixe claro que é uma estimativa.
5. Não faça diagnóstico médico.
6. Não prescreva medicamentos.
7. Não recomende dietas extremas.
8. Não trate estimativas nutricionais como valores exatos.
9. Se o usuário fornecer dados suficientes para registrar algo, registre.
10. Se faltar informação essencial para registrar uma informação, faça uma pergunta curta.
11. Não peça confirmação desnecessariamente para mensagens simples.
12. Responda sempre em JSON válido.
13. Não coloque markdown fora do JSON.
14. Use números para calorias, proteínas, carboidratos, gorduras, peso, séries, repetições e cargas.

A resposta deve seguir exatamente esta estrutura:

{
  "action": "meal | workout | weight | profile | summary | none",
  "data": {},
  "reply": "mensagem que será enviada ao usuário"
}

TIPOS DE AÇÃO:

meal:
Usado quando o usuário informar que comeu ou bebeu algo.

Formato de data:

{
  "description": "descrição da refeição",
  "calories": 0,
  "protein_g": 0,
  "carbs_g": 0,
  "fat_g": 0
}

workout:
Usado quando o usuário informar que treinou.

Formato:

{
  "workout_type": "tipo do treino",
  "duration_min": 0,
  "notes": "",
  "exercises": [
    {
      "name": "nome do exercício",
      "sets": 0,
      "reps": 0,
      "weight_kg": 0
    }
  ]
}

weight:
Usado quando o usuário informar o peso corporal.

Formato:

{
  "weight_kg": 0
}

profile:
Usado quando o usuário fornecer informações pessoais relacionadas ao acompanhamento fitness.

Formato:

{
  "name": "",
  "height_cm": 0,
  "weight_kg": 0,
  "goal": "",
  "daily_calorie_target": 0,
  "daily_protein_target": 0
}

summary:
Usado quando o usuário perguntar sobre o resumo, progresso ou situação atual.

Formato:

{}

none:
Usado quando não houver nada para registrar.

Formato:

{}

EXEMPLOS:

Usuário:
"Comi 150g de frango e 100g de arroz"

Resposta:

{
  "action": "meal",
  "data": {
    "description": "150g de frango e 100g de arroz",
    "calories": 0,
    "protein_g": 0,
    "carbs_g": 0,
    "fat_g": 0
  },
  "reply": "Registrei sua refeição. Os valores nutricionais são estimativas."
}

Usuário:
"Hoje fiz treino de pernas por 1 hora"

Resposta:

{
  "action": "workout",
  "data": {
    "workout_type": "pernas",
    "duration_min": 60,
    "notes": "",
    "exercises": []
  },
  "reply": "Treino de pernas registrado por 1 hora. 💪"
}

Usuário:
"Me pesei, estou com 67,4 kg"

Resposta:

{
  "action": "weight",
  "data": {
    "weight_kg": 67.4
  },
  "reply": "Peso de 67,4 kg registrado. ⚖️"
}

Usuário:
"Quanto já comi hoje?"

Resposta:

{
  "action": "summary",
  "data": {},
  "reply": "Vou consultar seu resumo de hoje."
}
`;

function cleanJson(text) {
  if (!text) {
    throw new Error("A IA não retornou conteúdo.");
  }

  let cleaned = text.trim();

  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```json/i, "")
      .replace(/^```/i, "")
      .replace(/```$/i, "")
      .trim();
  }

  return cleaned;
}

function parseAIResponse(text) {
  const cleaned = cleanJson(text);

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    console.error("Resposta da IA não era JSON válido:", text);
    throw new Error("A resposta da IA não está em um formato válido.");
  }
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function normalizeAIResult(result) {
  const allowedActions = [
    "meal",
    "workout",
    "weight",
    "profile",
    "summary",
    "none"
  ];

  const action = allowedActions.includes(result?.action)
    ? result.action
    : "none";

  const data = result?.data && typeof result.data === "object"
    ? result.data
    : {};

  const reply =
    typeof result?.reply === "string" && result.reply.trim()
      ? result.reply.trim()
      : "Entendi. Como posso te ajudar?";

  return {
    action,
    data,
    reply
  };
}

function buildContext(userId) {
  const user = getUser(userId);
  const dailySummary = getDailySummary(userId);
  const recentHistory = getRecentHistory(userId, 10);

  return {
    user: user || null,
    today: dailySummary,
    recent_history: recentHistory
  };
}

function saveAction(userId, result) {
  switch (result.action) {
    case "meal": {
      const data = result.data || {};

      saveMeal(userId, {
        description: data.description || "Refeição",
        calories: normalizeNumber(data.calories),
        protein_g: normalizeNumber(data.protein_g),
        carbs_g: normalizeNumber(data.carbs_g),
        fat_g: normalizeNumber(data.fat_g)
      });

      break;
    }

    case "workout": {
      const data = result.data || {};

      saveWorkout(userId, {
        workout_type: data.workout_type || "Treino",
        duration_min: normalizeNumber(data.duration_min),
        notes: data.notes || "",
        exercises: Array.isArray(data.exercises)
          ? data.exercises.map((exercise) => ({
              name: exercise.name || "Exercício",
              sets: normalizeNumber(exercise.sets),
              reps: normalizeNumber(exercise.reps),
              weight_kg: normalizeNumber(exercise.weight_kg)
            }))
          : []
      });

      break;
    }

    case "weight": {
      const weight = normalizeNumber(result.data?.weight_kg);

      if (weight > 0) {
        saveWeight(userId, weight);
      }

      break;
    }

    case "profile": {
      const data = result.data || {};

      updateUserProfile(userId, {
        name: data.name || undefined,
        height_cm:
          data.height_cm !== undefined
            ? normalizeNumber(data.height_cm)
            : undefined,
        weight_kg:
          data.weight_kg !== undefined
            ? normalizeNumber(data.weight_kg)
            : undefined,
        goal: data.goal || undefined,
        daily_calorie_target:
          data.daily_calorie_target !== undefined
            ? normalizeNumber(data.daily_calorie_target)
            : undefined,
        daily_protein_target:
          data.daily_protein_target !== undefined
            ? normalizeNumber(data.daily_protein_target)
            : undefined
      });

      break;
    }

    case "summary":
    case "none":
    default:
      break;
  }
}

function buildSummaryReply(userId) {
  const summary = getDailySummary(userId);
  const user = getUser(userId);

  const calories = Math.round(summary.calories || 0);
  const protein = Math.round(summary.protein_g || 0);
  const carbs = Math.round(summary.carbs_g || 0);
  const fat = Math.round(summary.fat_g || 0);

  const calorieTarget = user?.daily_calorie_target
    ? Math.round(user.daily_calorie_target)
    : null;

  const proteinTarget = user?.daily_protein_target
    ? Math.round(user.daily_protein_target)
    : null;

  const calorieRemaining =
    calorieTarget !== null
      ? Math.max(calorieTarget - calories, 0)
      : null;

  const proteinRemaining =
    proteinTarget !== null
      ? Math.max(proteinTarget - protein, 0)
      : null;

  let reply = `📊 Resumo de hoje

🔥 Calorias: ${calories} kcal
🥩 Proteínas: ${protein} g
🍚 Carboidratos: ${carbs} g
🥑 Gorduras: ${fat} g

🏋️ Treinos: ${summary.workout_count || 0}
⏱️ Tempo de treino: ${Math.round(
    summary.total_duration_min || 0
  )} min`;

  if (calorieTarget !== null) {
    reply += `

🎯 Meta de calorias: ${calorieTarget} kcal
📉 Restam aproximadamente: ${calorieRemaining} kcal`;
  }

  if (proteinTarget !== null) {
    reply += `
🎯 Meta de proteína: ${proteinTarget} g
📉 Restam aproximadamente: ${proteinRemaining} g`;
  }

  if (user?.weight_kg) {
    reply += `

⚖️ Último peso registrado: ${user.weight_kg} kg`;
  }

  return reply;
}

export async function processMessage(userId, message) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY não configurada. Verifique o arquivo .env."
    );
  }

  if (!userId) {
    throw new Error("userId é obrigatório.");
  }

  if (!message || !message.trim()) {
    return "Pode me enviar uma informação sobre sua alimentação, treino ou peso. 😊";
  }

  ensureUser(userId);

  const context = buildContext(userId);

  const userInput = `
CONTEXTO ATUAL DO USUÁRIO:

${JSON.stringify(context, null, 2)}

MENSAGEM DO USUÁRIO:

${message}

Analise a mensagem considerando o contexto.

Se houver informação suficiente para registrar alguma coisa, escolha a ação correspondente.

Se for uma pergunta sobre o resumo do dia, use "summary".

Retorne SOMENTE JSON válido seguindo o formato definido nas instruções.
`;

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5.6",
    instructions: SYSTEM_PROMPT,
    input: userInput
  });

  const result = normalizeAIResult(
    parseAIResponse(response.output_text)
  );

  saveAction(userId, result);

  if (result.action === "summary") {
    return buildSummaryReply(userId);
  }

  return result.reply;
}
