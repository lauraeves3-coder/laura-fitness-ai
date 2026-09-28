import OpenAI from "openai";

import {
  ensureUser,
  updateUserProfile,
  calculateAndSaveNutritionTargets,
  setCustomCalorieTarget,
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

/* =========================================================
   INSTRUÇÕES DA IA
========================================================= */

const SYSTEM_PROMPT = `
Você é o FitPulse AI, uma assistente pessoal de treino,
alimentação e acompanhamento físico.

Seu idioma principal é português do Brasil.

Você ajuda o usuário a:

- configurar seu perfil;
- acompanhar peso;
- registrar refeições;
- estimar calorias;
- estimar proteínas, carboidratos e gorduras;
- acompanhar metas nutricionais;
- registrar treinos;
- registrar exercícios, séries, repetições e cargas;
- consultar o resumo do dia;
- acompanhar evolução;
- criar planos alimentares personalizados;
- criar planos de treino personalizados;
- adaptar alimentação e treino conforme a evolução do usuário.

=========================================================
PRINCÍPIO CENTRAL DO FITPULSE
=========================================================

O FitPulse não deve funcionar apenas como uma calculadora.

Ele deve funcionar como um sistema de acompanhamento.

Sempre diferencie:

1. gasto energético de manutenção estimado;
2. meta nutricional inicial;
3. evolução real do usuário;
4. possíveis ajustes futuros.

Uma meta calculada pelo sistema é uma ESTIMATIVA INICIAL.

Nunca diga que o usuário "precisa obrigatoriamente"
comer determinada quantidade de calorias.

Prefira expressões como:

- "meta inicial estimada";
- "estimativa inicial";
- "gasto de manutenção estimado";
- "para iniciar o acompanhamento";
- "podemos acompanhar sua evolução";
- "a meta poderá ser revista conforme seus resultados".

O objetivo é que o FitPulse acompanhe o usuário ao longo do tempo,
e não trate um cálculo inicial como uma verdade absoluta.

=========================================================
REGRAS GERAIS
=========================================================

=========================================================
LINGUAGEM INFORMAL E ABREVIAÇÕES
=========================================================

O usuário pode escrever de forma informal, com erros de digitação,
sem acentos, abreviações ou linguagem típica de WhatsApp.

Entenda abreviações comuns pelo contexto.

Exemplos:

"oq" = "o que"
"o q" = "o que"
"pq" = "por que" ou "porque", dependendo do contexto
"porq" = "porque"
"q" = "que"
"vc" = "você"
"vcs" = "vocês"
"tb" = "também"
"tbm" = "também"
"tmb" = "também"
"n" = "não"
"nao" = "não"
"hj" = "hoje"
"amanha" = "amanhã"
"tmr" = "amanhã", quando o contexto indicar
"agr" = "agora"
"dps" = "depois"
"mt" = "muito"
"mto" = "muito"
"qto" = "quanto"
"qnt" = "quanto ou quantidade", conforme o contexto
"qnts" = "quantos"
"pra" = "para"
"p/" = "para"
"pro" = "para o"
"pros" = "para os"
"blz" = "beleza"
"vlw" = "valeu"
"obg" = "obrigado"
"obgda" = "obrigada"
"msg" = "mensagem"
"info" = "informação"

Também reconheça abreviações comuns relacionadas à alimentação e
fitness, como:

"prot" = "proteína"
"prote" = "proteína"
"carb" = "carboidrato"
"carbs" = "carboidratos"
"gord" = "gordura"
"gords" = "gorduras"
"cal" = "calorias"
"kcal" = "calorias"
"ref" = "refeição"
"treino" = "treino"
"treinei" = "treinei"
"muscul" = "musculação"
"cardio" = "cardio"

Entenda também unidades comuns:

"kg" = quilogramas
"g" = gramas
"mg" = miligramas
"ml" = mililitros
"l" = litros
"min" = minutos
"hr" = hora
"hrs" = horas

Não corrija o usuário desnecessariamente.

Não diga "você quis dizer..." quando a intenção estiver clara.

Entenda a mensagem informalmente e responda de forma natural.

Se uma abreviação tiver mais de um significado possível e o contexto
não permitir identificar a intenção com segurança, faça uma pergunta
curta para confirmar.

=========================================================
PADRÃO VISUAL DAS RESPOSTAS
=========================================================

As respostas destinadas ao WhatsApp devem ser fáceis de ler.

Use emojis naturalmente como marcadores visuais.

Principais referências:

🔥 calorias e energia
🥩 proteínas
🍚 carboidratos
🥑 gorduras
🍽️ alimentação e refeições
💧 hidratação
⚖️ peso
🏋️ treino
🏃 corrida e cardio
📊 resumo e análise
🎯 metas
📌 observações importantes
✅ confirmações
📈 evolução e progresso
⏱️ duração e tempo
💡 sugestões

Não coloque emoji em todas as frases.

Use emojis para organizar a informação e facilitar a leitura.

Em sugestões de refeições, use emojis nos principais alimentos
ou categorias quando isso melhorar a visualização.

Exemplo:

🍽️ Uma opção para o almoço:

🍗 Frango
🍚 Arroz
🫘 Feijão
🥗 Salada

🔥 Aproximadamente 500 kcal
🥩 Aproximadamente 40 g de proteína

Não use emojis aleatórios ou excessivos.

Mantenha a comunicação natural, amigável e profissional.
1. Seja natural, objetiva, amigável e clara.

2. Nunca invente que algo foi registrado se não foi realmente
registrado pelo sistema.

3. Valores nutricionais são ESTIMATIVAS.

4. Quando a quantidade de um alimento não estiver clara,
faça uma estimativa razoável e deixe claro que é uma estimativa.

5. Não faça diagnóstico médico.

6. Não prescreva medicamentos.

7. Não recomende dietas extremas.

8. Não trate calorias ou macros como valores médicos exatos.

9. Se o usuário fornecer dados suficientes para registrar algo,
registre.

10. Se faltar informação essencial, faça uma pergunta curta.

11. Não faça perguntas desnecessárias.

12. Sempre responda em JSON válido.

13. Não coloque markdown fora do JSON.

14. Use números para calorias, proteínas, carboidratos,
gorduras, peso, séries, repetições e cargas.

15. Quando houver uma unidade claramente incompatível com o dado
informado, não invente uma interpretação. Use o contexto para
detectar a possível intenção, mas peça confirmação curta se
houver dúvida.

16. Quando o usuário perguntar sobre suas calorias ou metas,
use os valores calculados pelo sistema quando eles estiverem
disponíveis no contexto.

17. Nunca substitua silenciosamente uma meta calculada pelo sistema
por um número inventado pela IA.

18. Se houver gasto de manutenção e meta de calorias disponíveis,
explique a diferença entre eles quando isso for relevante.

19. Uma meta de emagrecimento deve ser apresentada como ponto
de partida para acompanhamento, não como prescrição médica.

20. Se o usuário perguntar se uma meta está adequada, explique que
a adequação individual depende também da evolução real, adesão,
desempenho nos treinos, fome, recuperação e outros fatores.

21. Não prometa determinado resultado de perda de peso.

22. O FitPulse deve incentivar acompanhamento consistente de peso,
alimentação e treinamento.

=========================================================
PERFIL DO USUÁRIO
=========================================================

O perfil pode conter:

- nome;
- idade;
- sexo;
- altura;
- peso;
- objetivo;
- nível de atividade;
- dias de treino por semana;
- preferências alimentares;
- alimentos que não gosta.

Também podem existir:

- gasto energético de manutenção estimado;
- percentual de déficit inicial;
- meta diária de calorias;
- meta diária de proteínas;
- meta diária de carboidratos;
- meta diária de gorduras.

Os campos importantes para calcular as metas nutricionais são:

- idade;
- sexo;
- altura;
- peso;
- objetivo;
- nível de atividade.

Se esses dados ainda não estiverem completos, peça apenas
os dados que estiverem faltando.

Não precisa perguntar tudo novamente se o usuário já informou
alguma informação anteriormente.

=========================================================
OBJETIVOS
=========================================================

O usuário pode ter objetivos como:

- emagrecimento;
- perda de gordura;
- manutenção;
- hipertrofia;
- ganho de massa;
- fortalecimento;
- resistência;
- corrida;
- performance.

Use o objetivo informado pelo usuário para interpretar
suas necessidades e personalizar futuras sugestões.

=========================================================
NÍVEL DE ATIVIDADE
=========================================================

Os níveis podem ser:

- sedentário;
- leve;
- moderado;
- alto;
- muito alto.

Se o usuário não souber o nível, faça uma pergunta simples
sobre sua rotina de atividade.

=========================================================
CÁLCULO NUTRICIONAL
=========================================================

Quando o perfil tiver dados suficientes, o sistema calculará
automaticamente uma estimativa de:

- gasto energético de manutenção;
- calorias diárias;
- proteínas;
- carboidratos;
- gorduras.

O gasto de manutenção representa uma estimativa das calorias
necessárias para manter o peso nas condições consideradas pelo
cálculo.

A meta diária representa a estratégia inicial definida pelo
sistema de acordo com o objetivo informado.

Exemplo conceitual:

Manutenção estimada: 3.100 kcal
Meta inicial de emagrecimento: 2.650 kcal

Não diga:

"Você precisa comer 2.650 kcal."

Prefira:

"Sua manutenção foi estimada em aproximadamente 3.100 kcal/dia.
Para iniciar o acompanhamento do objetivo de emagrecimento,
sua meta inicial foi estimada em 2.650 kcal/dia."

Esses valores são estimativas para acompanhamento fitness
e não substituem avaliação individual de nutricionista.

=========================================================
ACOMPANHAMENTO
=========================================================

O FitPulse deve considerar que a meta inicial poderá ser
reavaliada no futuro.

Quando houver histórico suficiente de peso, alimentação e treinos,
o sistema poderá analisar tendências e ajudar a identificar
se a estratégia está produzindo a evolução esperada.

Não faça ajustes automáticos extremos.

Não faça alterações importantes apenas com base em uma medição
isolada.

Prefira analisar tendências ao longo do tempo.

=========================================================
AÇÕES
=========================================================

A resposta deve seguir exatamente:

{
  "action": "meal | workout | weight | profile | summary | set_calorie_target | meal_suggestion | none",
  "data": {},
  "reply": "mensagem para o usuário"
}
=========================================================
META CALÓRICA PERSONALIZADA
=========================================================

Use "set_calorie_target" quando o usuário pedir para
definir, alterar ou testar uma meta diária específica
de calorias.

Exemplos:

"quero colocar minha meta em 1700 kcal"
"quero testar 1700 calorias"
"muda minha meta para 2200 kcal"
"quero uma meta de 2000 kcal"
"posso fazer minha meta ser 1700?"

Formato:

{
  "action": "set_calorie_target",
  "data": {
    "calories": 1700,
    "mode": "custom"
  },
  "reply": "🎯 Beleza! Vou considerar 1700 kcal como sua meta diária personalizada."
}

IMPORTANTE:
- Extraia o número de calorias informado pelo usuário.
- Não confunda pedido para ALTERAR a meta com pergunta
  sobre qual é a meta atual.
- Não use "summary" quando o usuário estiver pedindo
  explicitamente para alterar a meta.
- A meta personalizada deve ser tratada como uma escolha
  do usuário e não como uma nova estimativa automática.
- Quando o usuário pedir para voltar à meta calculada
  automaticamente, não use "set_calorie_target".
  Nesse caso, informe que a meta automática precisa ser
  restaurada pelo sistema.

=========================================================
SUGESTÃO DE REFEIÇÃO
=========================================================

Use "meal_suggestion" quando o usuário perguntar o que
pode comer, o que deveria comer ou pedir uma sugestão
para atingir melhor suas metas nutricionais.

Exemplos:

"oq posso comer agora?"
"o que posso comer agora pra bater minhas metas?"
"me sugere uma refeição"
"o que falta comer hoje?"
"me dá uma ideia de jantar"
"o que eu posso comer pra completar minha proteína?"

Nesses casos, use o current_context para considerar:

- calorias consumidas no dia;
- calorias restantes;
- proteína consumida e restante;
- carboidratos consumidos e restantes;
- gorduras consumidas e restantes;
- objetivo do usuário;
- preferências alimentares;
- alimentos que o usuário não gosta;
- refeições já registradas no dia.

Priorize sugestões que façam sentido para os nutrientes
que ainda faltam.

Por exemplo, se a proteína restante estiver alta e a
gordura restante estiver baixa, priorize alimentos com
boa quantidade de proteína e menor quantidade de gordura.
- Antes de sugerir uma refeição, compare as calorias
  restantes com as calorias necessárias para atingir os
  macros restantes.

- Se os macros restantes não puderem ser atingidos dentro
  das calorias restantes, não tente completar todos eles.

- Nesse caso, priorize os nutrientes mais relevantes para
  o contexto e informe de forma simples que não é possível
  atingir todos os macros sem ultrapassar a meta calórica.

- Nunca recomende ultrapassar deliberadamente a meta
  calórica apenas para completar um macro.

- Não trate os macros restantes como metas obrigatórias
  quando eles forem incompatíveis com as calorias restantes.
Formato:

{
  "action": "meal_suggestion",
  "data": {
    "calories": 0,
    "protein_g": 0,
    "carbs_g": 0,
    "fat_g": 0,
    "meal": "descrição da refeição",
    "foods": [
      "alimento 1",
      "alimento 2",
      "alimento 3"
    ]
  },
  "reply": "🍽️ Uma opção para agora é..."
}

IMPORTANTE:
- Não registre a sugestão como uma refeição consumida.
- "meal_suggestion" apenas sugere uma refeição.
- Só use "meal" quando o usuário estiver informando
  que realmente comeu algo.
- A sugestão deve considerar o saldo nutricional atual.
- Não precisa tentar preencher exatamente 100% das metas
  em uma única refeição.
- Evite sugestões incompatíveis com as preferências
  e alimentos que o usuário informou não gostar.

=========================================================
PROFILE
=========================================================

Use "profile" quando o usuário fornecer informações pessoais
relacionadas ao perfil fitness.

Formato:

{
  "action": "profile",
  "data": {
    "name": "",
    "age_years": 0,
    "sex": "",
    "height_cm": 0,
    "weight_kg": 0,
    "goal": "",
    "activity_level": "",
    "training_days_per_week": 0,
    "dietary_preferences": "",
    "food_dislikes": ""
  },
  "reply": ""
}

Não preencha campos que o usuário não informou.

Se o usuário informar apenas parte do perfil, registre apenas
essa parte.

Se o perfil ficar completo, informe que as metas nutricionais
foram calculadas.

=========================================================
MEAL
=========================================================

Use quando o usuário informar que comeu ou bebeu algo.

Formato:

{
  "action": "meal",
  "data": {
    "description": "",
    "calories": 0,
    "protein_g": 0,
    "carbs_g": 0,
    "fat_g": 0
  },
  "reply": ""
}

=========================================================
WORKOUT
=========================================================

Use quando o usuário informar que treinou.

Formato:

{
  "action": "workout",
  "data": {
    "workout_type": "",
    "duration_min": 0,
    "notes": "",
    "exercises": [
      {
        "name": "",
        "sets": 0,
        "reps": 0,
        "weight_kg": 0
      }
    ]
  },
  "reply": ""
}

=========================================================
WEIGHT
=========================================================

Use quando o usuário informar seu peso.

Formato:

{
  "action": "weight",
  "data": {
    "weight_kg": 0
  },
  "reply": ""
}

=========================================================
SUMMARY
=========================================================

Use quando o usuário perguntar sobre seu dia,
suas calorias, macros, treino ou metas.

Formato:

{
  "action": "summary",
  "data": {},
  "reply": ""
}

=========================================================
NONE
=========================================================

Use "none" para conversas que não exigem registro.

=========================================================
EXEMPLOS
=========================================================

"Tenho 25 anos, 1,72m e peso 67kg."

=> profile.

"Sou mulher e quero emagrecer."

=> profile.

"Treino 4 vezes por semana e faço musculação."

=> profile.

"Comi 150g de frango e 100g de arroz."

=> meal.

"Hoje fiz treino de pernas por uma hora."

=> workout.

"Me pesei, estou com 67,4kg."

=> weight.

"Quanto já comi hoje?"

=> summary.

"Qual é minha meta de calorias?"

=> summary.

"Quantas calorias eu gasto por dia?"

=> summary.

"Por que minha meta é 2650 calorias?"

=> summary.

=========================================================
IMPORTANTE
=========================================================

Se o usuário estiver configurando o perfil, não transforme
informações do perfil em refeição ou treino.

Se o usuário informar várias informações do perfil na mesma
mensagem, registre todas elas.

Se o usuário já tiver informações salvas, use o contexto
fornecido pelo sistema para não perguntar novamente.

Se o usuário perguntar sobre uma meta já calculada, use os dados
reais do contexto.

Nunca invente o gasto de manutenção se ele não estiver disponível.

Nunca invente percentual de déficit se ele não estiver disponível.

Quando os dados estiverem disponíveis, explique-os de forma simples.
`;

/* =========================================================
   JSON
========================================================= */

function cleanJson(text) {
  if (!text) {
    throw new Error("Resposta vazia da IA.");
  }

  let cleaned = text.trim();

  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?/i, "")
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
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (
      firstBrace !== -1 &&
      lastBrace !== -1 &&
      lastBrace > firstBrace
    ) {
      return JSON.parse(
        cleaned.slice(firstBrace, lastBrace + 1)
      );
    }

    throw error;
  }
}

/* =========================================================
   NORMALIZAÇÃO
========================================================= */
function normalizeNumber(
  value,
  fallback = 0
) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return number;
}

function normalizeAIResult(result) {
  const allowedActions = [
    "meal",
    "workout",
    "weight",
    "profile",
    "summary",
    "set_calorie_target",
    "meal_suggestion",
    "none"
  ];

  const action =
    allowedActions.includes(
      result?.action
    )
      ? result.action
      : "none";

  const data =
    result?.data &&
    typeof result.data === "object"
      ? result.data
      : {};

  const reply =
    typeof result?.reply === "string"
      ? result.reply.trim()
      : "";

  if (action === "meal") {
    return {
      action,
      data: {
        description:
          String(
            data.description ||
            "Refeição"
          ),

        calories:
          normalizeNumber(
            data.calories
          ),

        protein_g:
          normalizeNumber(
            data.protein_g
          ),

        carbs_g:
          normalizeNumber(
            data.carbs_g
          ),

        fat_g:
          normalizeNumber(
            data.fat_g
          )
      },
      reply
    };
  }

  if (action === "meal_suggestion") {
    return {
      action,
      data: {
        calories:
          normalizeNumber(
            data.calories
          ),

        protein_g:
          normalizeNumber(
            data.protein_g
          ),

        carbs_g:
          normalizeNumber(
            data.carbs_g
          ),

        fat_g:
          normalizeNumber(
            data.fat_g
          ),

        meal:
          String(
            data.meal ||
            ""
          ),

        foods:
          Array.isArray(
            data.foods
          )
            ? data.foods.map(
                (food) =>
                  String(food)
              )
            : []
      },
      reply
    };
  }

  if (action === "set_calorie_target") {
    return {
      action,
      data: {
        calories:
          normalizeNumber(
            data.calories
          ),

        mode:
          String(
            data.mode ||
            "custom"
          )
      },
      reply
    };
  }

  if (action === "workout") {
    return {
      action,
      data: {
        workout_type:
          String(
            data.workout_type ||
            "Treino"
          ),

        duration_min:
          normalizeNumber(
            data.duration_min
          ),

        notes:
          String(
            data.notes || ""
          ),

        exercises:
          Array.isArray(
            data.exercises
          )
            ? data.exercises.map(
                (exercise) => ({
                  name:
                    String(
                      exercise?.name ||
                      "Exercício"
                    ),

                  sets:
                    normalizeNumber(
                      exercise?.sets
                    ),

                  reps:
                    normalizeNumber(
                      exercise?.reps
                    ),

                  weight_kg:
                    normalizeNumber(
                      exercise?.weight_kg
                    )
                })
              )
            : []
      },
      reply
    };
  }

  if (action === "weight") {
    return {
      action,
      data: {
        weight_kg:
          normalizeNumber(
            data.weight_kg
          )
      },
      reply
    };
  }

  if (action === "profile") {
    return {
      action,
      data: {
        ...(data.name !== undefined && {
          name:
            String(data.name)
        }),

        ...(data.age_years !== undefined && {
          age_years:
            normalizeNumber(
              data.age_years
            )
        }),

        ...(data.sex !== undefined && {
          sex:
            String(data.sex)
        }),

        ...(data.height_cm !== undefined && {
          height_cm:
            normalizeNumber(
              data.height_cm
            )
        }),

        ...(data.weight_kg !== undefined && {
          weight_kg:
            normalizeNumber(
              data.weight_kg
            )
        }),

        ...(data.goal !== undefined && {
          goal:
            String(data.goal)
        }),

        ...(data.activity_level !== undefined && {
          activity_level:
            String(data.activity_level)
        }),

        ...(data.training_days_per_week !== undefined && {
          training_days_per_week:
            normalizeNumber(
              data.training_days_per_week
            )
        }),

        ...(data.dietary_preferences !== undefined && {
          dietary_preferences:
            String(
              data.dietary_preferences
            )
        }),

        ...(data.food_dislikes !== undefined && {
          food_dislikes:
            String(
              data.food_dislikes
            )
        })
      },
      reply
    };
  }

  return {
    action,
    data,
    reply
  };
}
/* =========================================================
   CONTEXTO
========================================================= */

function buildContext(
  user,
  dailySummary,
  recentHistory
) {
  return {
    profile: {
      name:
        user?.name ?? null,

      age_years:
        user?.age_years ?? null,

      sex:
        user?.sex ?? null,

      height_cm:
        user?.height_cm ?? null,

      weight_kg:
        user?.weight_kg ?? null,

      goal:
        user?.goal ?? null,

      activity_level:
        user?.activity_level ?? null,

      training_days_per_week:
        user?.training_days_per_week ?? null,

      dietary_preferences:
        user?.dietary_preferences ?? null,

      food_dislikes:
        user?.food_dislikes ?? null,

      daily_calorie_target:
        user?.daily_calorie_target ?? null,

      daily_protein_target:
        user?.daily_protein_target ?? null,

      daily_carbs_target:
        user?.daily_carbs_target ?? null,

      daily_fat_target:
        user?.daily_fat_target ?? null,

      maintenance_calories:
        user?.maintenance_calories ?? null,

      calorie_deficit_percent:
        user?.calorie_deficit_percent ?? null
    },

    daily_summary:
      dailySummary,

    recent_history:
      recentHistory
  };
}

/* =========================================================
   SALVAR AÇÃO
========================================================= */

function saveAction(
  userId,
  result
) {
  if (result.action === "meal") {
    return saveMeal(
      userId,
      result.data
    );
  }

  if (result.action === "workout") {
    return saveWorkout(
      userId,
      result.data
    );
  }

  if (result.action === "weight") {
    return saveWeight(
      userId,
      result.data.weight_kg
    );
  }

  if (result.action === "profile") {
    const updatedUser =
      updateUserProfile(
        userId,
        result.data
      );

    const requiredFields = [
      "age_years",
      "sex",
      "height_cm",
      "weight_kg",
      "goal",
      "activity_level"
    ];

    const profileComplete =
      requiredFields.every(
        (field) =>
          updatedUser?.[field] !== null &&
          updatedUser?.[field] !== undefined &&
          updatedUser?.[field] !== ""
      );

    if (profileComplete) {
      const nutrition =
        calculateAndSaveNutritionTargets(
          userId
        );

      return {
        user:
          nutrition?.user ||
          updatedUser,

        targets:
          nutrition?.targets ||
          null
      };
    }

    return {
      user:
        updatedUser,

      targets:
        null
    };
  }
  if (result.action === "set_calorie_target") {
    const updatedUser =
      setCustomCalorieTarget(
        userId,
        result.data.calories
      );

    return {
      user:
        updatedUser,

      targets: {
        daily_calorie_target:
          updatedUser?.daily_calorie_target ?? null,

        daily_protein_target:
          updatedUser?.daily_protein_target ?? null,

        daily_carbs_target:
          updatedUser?.daily_carbs_target ?? null,

        daily_fat_target:
          updatedUser?.daily_fat_target ?? null
      }
    };
  }

  return null;
}

/* =========================================================
   RESPOSTA DO RESUMO
========================================================= */

function buildSummaryReply(
  summary,
  user
) {
  const lines = [];

  lines.push(
    `📊 Resumo de hoje (${summary.date})`
  );

  lines.push("");

  lines.push(
    `🔥 Calorias: ${Math.round(summary.calories)} kcal`
  );

  lines.push(
    `🥩 Proteínas: ${Math.round(summary.protein_g)} g`
  );

  lines.push(
    `🍚 Carboidratos: ${Math.round(summary.carbs_g)} g`
  );

  lines.push(
    `🥑 Gorduras: ${Math.round(summary.fat_g)} g`
  );

  lines.push("");

  lines.push(
    `🏋️ Treinos: ${summary.workout_count}`
  );

  lines.push(
    `⏱️ Tempo treinado: ${Math.round(summary.total_duration_min)} min`
  );

  /* =======================================================
     MANUTENÇÃO E META
  ======================================================= */

  if (
    summary.maintenance_calories
  ) {
    lines.push("");

    lines.push(
      `🔥 Manutenção estimada: ${Math.round(summary.maintenance_calories)} kcal`
    );
  }

  if (
    summary.calorie_target
  ) {
    const remaining =
      summary.calorie_target -
      summary.calories;

    lines.push("");

    lines.push(
      `🎯 Meta inicial: ${Math.round(summary.calorie_target)} kcal`
    );

    lines.push(
      `📌 Restante estimado: ${Math.round(Math.max(remaining, 0))} kcal`
    );
  }

  if (
    summary.calorie_deficit_percent
  ) {
    lines.push(
      `📉 Déficit inicial considerado: ${summary.calorie_deficit_percent}%`
    );
  }

  if (
    summary.protein_target
  ) {
    const remaining =
      summary.protein_target -
      summary.protein_g;

    lines.push("");

    lines.push(
      `🥩 Meta de proteína: ${Math.round(summary.protein_target)} g`
    );

    lines.push(
      `📌 Restante: ${Math.round(Math.max(remaining, 0))} g`
    );
  }

 if (
    summary.carbs_target
  ) {
    const remaining =
      summary.carbs_target -
      summary.carbs_g;

    lines.push(
      `🍚 Meta de carboidratos: ${Math.round(summary.carbs_target)} g`
    );

    lines.push(
      `📌 Restante: ${Math.round(Math.max(remaining, 0))} g`
    );
  }

 if (
    summary.fat_target
  ) {
    const remaining =
      summary.fat_target -
      summary.fat_g;

    lines.push(
      `🥑 Meta de gorduras: ${Math.round(summary.fat_target)} g`
    );

    lines.push(
      `📌 Restante: ${Math.round(Math.max(remaining, 0))} g`
    );
  }

  if (
    user?.weight_kg
  ) {
    lines.push("");

    lines.push(
      `⚖️ Peso atual: ${user.weight_kg} kg`
    );
  }

  return lines.join("\n");
}

/* =========================================================
   RESPOSTA DO PERFIL COMPLETO
========================================================= */

function buildProfileReply(
  updatedUser,
  targets
) {
  const sex =
    String(
      updatedUser?.sex || ""
    )
      .toLowerCase()
      .trim();

  const sexLabel =
    [
      "female",
      "feminino",
      "mulher",
      "f"
    ].includes(sex)
      ? "Mulher"
      : "Homem";

  const goalLabel =
    updatedUser?.goal ||
    "não informado";

  const activityLabel =
    updatedUser?.activity_level ||
    "não informado";

  const trainingDays =
    updatedUser?.training_days_per_week;

  const trainingText =
    trainingDays
      ? `${trainingDays}x por semana`
      : "não informado";

  const height =
    Number(
      updatedUser?.height_cm || 0
    );

  const heightText =
    height > 0
      ? `${(height / 100)
          .toFixed(2)
          .replace(".", ",")} m`
      : "não informado";

  const maintenance =
    Number(
      targets?.maintenance_calories || 0
    );

  const calories =
    Number(
      targets?.daily_calorie_target || 0
    );

  const deficit =
    Number(
      targets?.calorie_deficit_percent || 0
    );

  const lines = [
    "✅ *Perfil atualizado!*",
    "",
    `👤 Sexo: ${sexLabel}`,
    `🎂 Idade: ${updatedUser.age_years} anos`,
    `📏 Altura: ${heightText}`,
    `⚖️ Peso: ${updatedUser.weight_kg} kg`,
    `🏃 Treinos: ${trainingText}`,
    `🔥 Atividade: ${activityLabel}`,
    `🎯 Objetivo: ${goalLabel}`,
    "",
    "📊 *Estimativa nutricional inicial*",
    ""
  ];

  if (maintenance > 0) {
    lines.push(
      `🔥 Manutenção estimada: *${Math.round(maintenance)} kcal/dia*`
    );
  }

  if (calories > 0) {
    lines.push(
      `🎯 Meta inicial: *${Math.round(calories)} kcal/dia*`
    );
  }

  if (deficit > 0) {
    lines.push(
      `📉 Déficit inicial considerado: *${deficit}%*`
    );
  }

  lines.push("");

  lines.push(
    `🥩 Proteínas: *${targets.daily_protein_target} g*`
  );

  lines.push(
    `🍚 Carboidratos: *${targets.daily_carbs_target} g*`
  );

  lines.push(
    `🥑 Gorduras: *${targets.daily_fat_target} g*`
  );

  lines.push("");

  lines.push(
    "📌 *Importante:* esses valores são uma estimativa inicial para acompanhamento fitness."
  );

  lines.push(
    "📈 Conforme você registrar peso, alimentação e treinos, o FitPulse poderá acompanhar sua evolução e ajudar a avaliar a necessidade de ajustes."
  );

  return lines.join("\n");
}

/* =========================================================
   PROCESSAR MENSAGEM
========================================================= */

export async function processMessage(
  userId,
  message
) {
  ensureUser(userId);

  const user =
    getUser(userId);

  const dailySummary =
    getDailySummary(
      userId
    );

  const recentHistory =
    getRecentHistory(
      userId,
      20
    );

  const context =
    buildContext(
      user,
      dailySummary,
      recentHistory
    );

  const response =
    await client.responses.create({
      model:
        process.env.OPENAI_MODEL ||
        "gpt-5.6",

      instructions:
        SYSTEM_PROMPT,

      input:
        JSON.stringify({
          user_message:
            message,

          current_context:
            context
        })
    });

  const raw =
    response.output_text;

  const parsed =
    parseAIResponse(raw);

  const result =
    normalizeAIResult(
      parsed
    );

  const saved =
    saveAction(
      userId,
      result
    );

  /* -------------------------------------------------------
     Perfil completo
  ------------------------------------------------------- */

  if (
    result.action === "profile" &&
    saved?.targets
  ) {
    return buildProfileReply(
      saved.user,
      saved.targets
    );
  }

  /* -------------------------------------------------------
     Resumo
  ------------------------------------------------------- */

  if (
    result.action === "summary"
  ) {
    const updatedSummary =
      getDailySummary(
        userId
      );

    const updatedUser =
      getUser(
        userId
      );

    return buildSummaryReply(
      updatedSummary,
      updatedUser
    );
  }

  /* -------------------------------------------------------
     Resposta normal
  ------------------------------------------------------- */

  return (
    result.reply ||
    "Entendi. Como posso te ajudar?"
  );
}