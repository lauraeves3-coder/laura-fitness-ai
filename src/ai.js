import {
  ensureUser,
  updateUserProfile,
  calculateAndSaveNutritionTargets,
  setCustomCalorieTarget,
  setCustomMacroTargets,
  restoreAutomaticNutritionTargets,
  saveMeal,
  correctMeal,
  getMeal,
  findRecentDuplicateMeal,
  deleteMeal,
  getPendingMealDeletion,
  getPendingMealClarification,
  setPendingMealClarification,
  clearPendingMealClarification,
  getTodayMeals,
  saveMealPlan,
  getMealPlan,
  updateMealPlanStatus,
  recordMealPlanEvent,
  consumeMealSelection,
  getMealPlanHistory,
  getLatestMealPlanEvent,
  saveWorkout,
  saveWeight,
  getUser,
  getDailySummary,
  getRecentHistory,
  getFreeMealSettings,
  setFreeMealSettings,
  addFreeMealPreference
} from "./db.js";
import {
  calculateNutritionBalance,
  analyzeRemainingNutritionBudget,
  getMealBudget,
  generateMealOptions,
  generateDesiredFoodOptions,
  buildDailyMealPlan,
  validateMealOption,
  validateMealRecord,
  getMealPeriods,
  isActuallyQuickOption,
  estimateMealFromText,
  generateFreeMealOptions
} from "./nutrition.js";
import {
  findFoodNames,
  restrictionBlocksDesiredFood,
  JAPANESE_FILLINGS
} from "./foodMatching.js";
import {
  detectDesiredFood,
  detectRequestedServings,
  detectRequestedGrams,
  detectRequestedJapaneseSubtype,
  detectDesiredComposition,
  normalizeRequestText,
  normalizeToolFoodList,
  detectAmbiguousCompositionExclusion,
  buildMealClarificationQuestion,
  buildCompositionExclusionReply,
  buildAmbiguousCompositionQuestion,
  detectExplicitExcludedCompositions,
  extractExcludedFoods,
  getFoodRestrictions,
  hasDesiredFoodAvailable,
  extractAvailableFoods,
  detectWheyAvailability,
  detectMealDeletionRequest,
  isMealDeletionConfirmation,
  isMealDeletionCancellation,
  resolveGenericFoodAnswer,
  isExplicitRepeatMeal
} from "./mealIntent.js";
import { getQuantityQuestions, applyQuantityAnswer } from "./nutritionCatalog.js";
import { runAgent } from "./agent/agent.js";
import { createAgentToolRegistry } from "./agent/tools.js";

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
    "meal_correction",
    "workout",
    "weight",
    "profile",
    "summary",
    "set_calorie_target",
    "set_macro_targets",
    "reset_nutrition_targets",
    "meal_suggestion",
    "meal_plan",
    "meal_plan_intent",
    "meal_plan_decline",
    "meal_choice",
    "meal_consumed",
    "meal_plan_get",
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
          ),
        meal_period:
          typeof data.meal_period === "string" ? data.meal_period : null,
        plan_id:
          normalizeNumber(data.plan_id, null),
        plan_option_index:
          normalizeNumber(data.plan_option_index, null),
        selection_event_id:
          normalizeNumber(data.selection_event_id, null)
      },
      reply
    };
  }

  if (action === "meal_correction") {
    return {
      action,
      data: {
        meal_id: normalizeNumber(data.meal_id, null),
        // Sem descrição nova, a correção mantém a descrição original da refeição.
        description: data.description ? String(data.description) : null,
        calories: data.calories === null || data.calories === undefined ? null : normalizeNumber(data.calories, null),
        protein_g: data.protein_g === null || data.protein_g === undefined ? null : normalizeNumber(data.protein_g, null),
        carbs_g: data.carbs_g === null || data.carbs_g === undefined ? null : normalizeNumber(data.carbs_g, null),
        fat_g: data.fat_g === null || data.fat_g === undefined ? null : normalizeNumber(data.fat_g, null)
      },
      reply
    };
  }

  if (action === "set_macro_targets") {
    return {
      action,
      data: {
        ...(data.protein_g !== undefined && { protein_g: normalizeNumber(data.protein_g, null) }),
        ...(data.carbs_g !== undefined && { carbs_g: normalizeNumber(data.carbs_g, null) }),
        ...(data.fat_g !== undefined && { fat_g: normalizeNumber(data.fat_g, null) })
      },
      reply
    };
  }

  if (action === "reset_nutrition_targets") {
    return { action, data: {}, reply };
  }

  if (action === "meal_suggestion") {
    return {
      action,
      data: {
        meal_period:
          String(data.meal_period || ""),

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
            : [],
        desired_food: Object.prototype.hasOwnProperty.call(data, "desired_food")
          ? (typeof data.desired_food === "string" ? data.desired_food.trim() : null)
          : undefined,
        requested_servings: data.requested_servings === null || data.requested_servings === undefined
          ? null
          : normalizeNumber(data.requested_servings, null),
        available_foods: Array.isArray(data.available_foods)
          ? data.available_foods.filter((food) => typeof food === "string").map((food) => food.trim())
          : undefined,
        required_foods: Array.isArray(data.required_foods)
          ? data.required_foods.filter((food) => typeof food === "string").map((food) => food.trim())
          : [],
        explicit_excluded_foods: Array.isArray(data.explicit_excluded_foods)
          ? data.explicit_excluded_foods.filter((food) => typeof food === "string").map((food) => food.trim())
          : undefined,
        explicit_excluded_compositions: Array.isArray(data.explicit_excluded_compositions)
          ? data.explicit_excluded_compositions.filter((composition) => composition && typeof composition === "object")
            .map((composition) => ({
              ingredients: Array.isArray(composition.ingredients)
                ? composition.ingredients.filter((food) => typeof food === "string").map((food) => food.trim())
                : [],
              description: typeof composition.description === "string" ? composition.description.trim() : ""
            }))
          : [],
        only_available_foods: data.only_available_foods === true,
        quick_only: typeof data.quick_only === "boolean" ? data.quick_only : undefined,
        more_options: typeof data.more_options === "boolean" ? data.more_options : undefined,
        preserve_budget_for_future: data.preserve_budget_for_future === true,
        future_meal_period: typeof data.future_meal_period === "string" ? data.future_meal_period : null
      },
      reply
    };
  }

  if (["meal_plan", "meal_plan_intent", "meal_plan_decline", "meal_choice", "meal_consumed", "meal_plan_get"].includes(action)) {
    return {
      action,
      data: {
        meal_period: String(data.meal_period || ""),
        option_index: normalizeNumber(data.option_index, null),
        selection_event_id: normalizeNumber(data.selection_event_id, null),
        meal_id: normalizeNumber(data.meal_id, null),
        description: String(data.description || "")
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
   PERÍODO DA REFEIÇÃO
========================================================= */

function getMealPeriod(date = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat(
      "pt-BR",
      {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        hour12: false
      }
    ).format(date)
  );

  if (hour >= 5 && hour < 10) {
    return "café da manhã";
  }

  if (hour >= 10 && hour < 15) {
    return "almoço";
  }

  if (hour >= 15 && hour < 18) {
    return "lanche da tarde";
  }

  if (hour >= 18 && hour < 22) {
    return "jantar";
  }

  return "ceia";
}

function isExplicitSelectionConfirmation(message) {
  const normalized = String(message || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim()
    .replace(/[.!?]+$/g, "");

  const genericConfirmation =
    /^(?:(?:eu\s+)?comi(?:\s+(?:sim|a\s+opcao(?:\s+escolhida|\s+\d+)?|essa(?:\s+opcao)?|isso|ela))?|ja\s+comi|acabei\s+de\s+comer|pode\s+registrar(?:\s+essa(?:\s+opcao)?)?|registra\s+essa(?:\s+opcao)?|registre\s+essa(?:\s+opcao)?|pode\s+marcar(?:\s+como\s+consumida)?|sim,?\s+comi)$/.test(normalized);

  const describedOptionConfirmation =
    /\b(?:eu\s+)?(?:comi|consumi)\b.*\bopcao\s+\d+\b/.test(normalized);

  return genericConfirmation || describedOptionConfirmation;
}

function isExplicitMealReport(message) {
  const text = normalizeRequestText(message);
  if (/[?？]$/.test(text)) return false;
  // Verbos negados ("não comi arroz") não contam; um verbo afirmativo na mesma frase
  // ("..., comi 2 ovos") ainda caracteriza relato. O catálogo ignora os itens negados.
  const affirmative = text.replace(/\b(?:nao|nunca|nem)\s+(?:comi|consumi|bebi|tomei|almocei|jantei|lanchei)\b/g, " ");
  return /\b(?:comi|consumi|bebi|tomei|almocei|jantei|lanchei|cafei)\b/.test(affirmative);
}

function extractExplicitMealNutrition(message) {
  const text = normalizeRequestText(message);
  const number = "([0-9]+(?:[.,][0-9]+)?)";
  const extract = (patterns) => {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return Number(match[1].replace(",", "."));
    }
    return null;
  };

  return {
    calories: extract([
      new RegExp(`${number}\\s*(?:kcal|calorias?)\\b`),
      new RegExp(`\\b(?:kcal|calorias?)\\s*(?:e\\s*)?(?:[:=]|para|em)?\\s*${number}`)
    ]),
    // "proteína para 140 g", "proteína em 140", "proteína: 140" (NUT-17).
    protein_g: extract([
      new RegExp(`${number}\\s*g?\\s*(?:de\\s*)?proteinas?\\b`),
      new RegExp(`\\bproteinas?\\s*(?:[:=]|para|em|de)?\\s*${number}\\s*g?\\b`)
    ]),
    carbs_g: extract([
      new RegExp(`${number}\\s*g?\\s*(?:de\\s*)?carboidratos?\\b`),
      new RegExp(`\\bcarboidratos?\\s*(?:[:=]|para|em|de)?\\s*${number}\\s*g?\\b`)
    ]),
    fat_g: extract([
      new RegExp(`${number}\\s*g?\\s*(?:de\\s*)?gorduras?\\b`),
      new RegExp(`\\bgorduras?\\s*(?:[:=]|para|em|de)?\\s*${number}\\s*g?\\b`)
    ])
  };
}

function hasMatchingExplicitMealNutrition(message, meal) {
  const provided = extractExplicitMealNutrition(message);
  const expected = {
    calories: meal.calories,
    protein_g: meal.protein_g,
    carbs_g: meal.carbs_g,
    fat_g: meal.fat_g
  };

  return Object.entries(expected).every(([key, value]) =>
    provided[key] !== null
    && Number.isFinite(Number(value))
    && Math.abs(provided[key] - Number(value)) <= 0.05
  );
}

function hasMatchingProvidedNutrition(message, meal) {
  const provided = extractExplicitMealNutrition(message);
  return Object.entries(meal).every(([key, value]) =>
    value === null || value === undefined
      ? true
      : provided[key] !== null
        && Number.isFinite(Number(value))
        && Math.abs(provided[key] - Number(value)) <= 0.05
  );
}

function hasExplicitTargetUpdate(message, targets) {
  const text = normalizeRequestText(message);
  if (/[?？]$/.test(text)) return false;
  const hasUpdateIntent = /\b(?:meta|alvo|defina|definir|ajuste|ajustar|altere|alterar|mude|mudar|atualize|atualizar|quero)\b/.test(text);
  if (!hasUpdateIntent) return false;
  const provided = extractExplicitMealNutrition(text);
  return Object.entries(targets).every(([key, value]) => {
    if (value === null || value === undefined) return true;
    return provided[key] !== null
      && Number.isFinite(Number(value))
      && Math.abs(provided[key] - Number(value)) <= 0.05;
  });
}

function isExplicitOptionChoice(message, requestedIndex) {
  const text = normalizeRequestText(message);
  if (/[?？]$/.test(text)) return false;
  const ordinals = { primeira: 1, primeiro: 1, segunda: 2, segundo: 2, terceira: 3, terceiro: 3 };
  const numbered = text.match(/\b(?:opcao|numero)\s*(\d+)\b/);
  const ordinal = Object.entries(ordinals).find(([word]) => new RegExp(`\\b${word}\\b`).test(text));
  const standaloneNumber = text.match(/^\s*([1-3])\s*$/);
  const selectedIndex = Number(numbered?.[1] ?? ordinal?.[1] ?? standaloneNumber?.[1]);
  const languageIsSelection = Boolean(numbered || ordinal || standaloneNumber)
    && /\b(?:escolho|escolhi|fico com|quero|vou de|opcao|numero)\b/.test(text)
    || Boolean(standaloneNumber);
  return languageIsSelection && selectedIndex === Number(requestedIndex);
}

function hasExplicitPlanCreationIntent(message) {
  const text = normalizeRequestText(message);
  return /\bplano\b/.test(text)
    && /\b(?:monte|montar|crie|criar|gere|gerar|planeje|planejar|organize|organizar|elabore|elaborar|quero|pode montar|pode criar)\b/.test(text);
}

function hasExplicitPlanFollowIntent(message, intendsToFollow, pendingPlanDecision = false) {
  const text = normalizeRequestText(message);
  if (intendsToFollow) {
    if (pendingPlanDecision && /^(?:sim|claro|combinado)[.! ]*$/.test(text.trim())) return true;
    return /\b(?:vou|quero|pretendo|decidi)\s+(?:seguir|usar|adotar)\b/.test(text)
      && /\bplano\b/.test(text);
  }
  if (pendingPlanDecision && /^(?:nao|negativo)[.! ]*$/.test(text.trim())) return true;
  return /\b(?:nao vou seguir|nao quero seguir|nao pretendo seguir|desisti do plano)\b/.test(text);
}

function hasExplicitMealCorrectionIntent(message) {
  const text = normalizeRequestText(message);
  return /\b(?:corrija|corrigir|corrigi|corrige|ajuste|ajustar|registrei errado|lancei errado|errei no registro)\b/.test(text)
    && /\b(?:refeicao|consumo|registro|lancamento|comida)\b/.test(text);
}

function hasExplicitProfileUpdateIntent(message) {
  const text = normalizeRequestText(message);
  const requestedUpdate = /\b(?:atualize|atualizar|complete|completar|preencha|preencher|corrija|corrigir|altere|alterar|mude|mudar)\b/.test(text)
    && /\b(?:perfil|dados|peso|altura|idade|objetivo|atividade|preferencias)\b/.test(text);
  const statedFact = /\b(?:meu nome e|tenho \d{1,3} anos|meu peso (?:atual )?(?:e|esta)\b|minha altura (?:e|esta)\b|meu objetivo e\b|minha atividade e\b|prefiro\b|nao gosto de\b|sou (?:vegetariano|vegetariana|vegano|vegana))/.test(text);
  return requestedUpdate || statedFact;
}

/* =========================================================
   CONTEXTO
========================================================= */

function compactMealOption(option) {
  if (!option) return null;
  return {
    name: option.name,
    foods: option.foods,
    calories: option.calories,
    protein_g: option.protein_g,
    carbs_g: option.carbs_g,
    fat_g: option.fat_g,
    is_quick: option.is_quick,
    category: option.category,
    explicit_overage: option.explicit_overage
  };
}

function compactMealPlanHistory(events, date) {
  return events.slice(0, 12).map((event) => {
    let details = null;
    if (event.event_type === "suggestion_offered") {
      details = {
        source: event.details?.source,
        desired_food: event.details?.desired_food,
        options: Array.isArray(event.details?.options)
          ? event.details.options.map(compactMealOption)
          : undefined,
        option: compactMealOption(event.details?.option)
      };
    } else if (event.event_type === "option_chosen") {
      details = {
        source: event.details?.source,
        offer_event_id: event.details?.offer_event_id,
        option: compactMealOption(event.details?.option)
      };
    } else if (event.event_type === "food_availability") {
      details = event.details;
    }
    return {
      id: event.id,
      event_type: event.event_type,
      meal_period: event.meal_period,
      option_index: event.option_index,
      meal_id: event.meal_id,
      plan_id: event.plan_id,
      created_at: event.created_at,
      is_today: String(event.created_at || "").startsWith(date || ""),
      details
    };
  });
}

function buildContext(
  user,
  dailySummary,
  recentHistory,
  todayMeals,
  mealPlan,
  mealPlanHistory,
  freeMealSettings = null
) {
  const profile = {
    name: user?.name ?? null,
    age_years: user?.age_years ?? null,
    sex: user?.sex ?? null,
    height_cm: user?.height_cm ?? null,
    weight_kg: user?.weight_kg ?? null,
    goal: user?.goal ?? null,
    activity_level: user?.activity_level ?? null,
    training_days_per_week: user?.training_days_per_week ?? null,
    calorie_target_mode: user?.calorie_target_mode ?? "automatic",
    macro_target_mode: user?.macro_target_mode ?? "automatic",
    maintenance_calories: user?.maintenance_calories ?? null,
    calorie_deficit_percent: user?.calorie_deficit_percent ?? null
  };

  const preferences = {
    dietary_preferences: user?.dietary_preferences ?? null,
    food_dislikes: user?.food_dislikes ?? null,
    free_meal: freeMealSettings
  };

  const currentTime = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date());

  const planHistory = compactMealPlanHistory(mealPlanHistory, dailySummary?.date);

  return {
    profile,
    preferences,
    current_state: {
      date: dailySummary?.date ?? null,
      nutrition: dailySummary,
      meals_today: todayMeals,
      planning: { current_time: currentTime, current_meal_period: getMealPeriod() }
    },
    availability_today: planHistory
      .filter((event) => event.is_today && event.event_type === "food_availability")
      .map((event) => event.details),
    plan: mealPlan,
    history: {
      recent: recentHistory,
      meal_plan_events: planHistory
    }
  };
}

/* =========================================================
   RESPOSTA PROJETADA DA SUGESTÃO
========================================================= */

function buildMealProjectionReply(
  result,
  summary,
  budgetAnalysis
) {
  const targets = {
    calorie_target: summary?.calorie_target,
    protein_target: summary?.protein_target,
    carbs_target: summary?.carbs_target,
    fat_target: summary?.fat_target
  };

  const consumed = {
    calories: summary?.calories,
    protein_g: summary?.protein_g,
    carbs_g: summary?.carbs_g,
    fat_g: summary?.fat_g
  };

  const projected = calculateNutritionBalance(targets, consumed, result.data);
  const lines = [
    `🍽️ ${result.data.name || result.data.meal || "Sugestão para agora"}`,
    ...(result.data.foods || []).map((food) => `• ${food}`),
    `🔥 Aproximadamente ${Math.round(result.data.calories)} kcal · 🥩 ${Math.round(result.data.protein_g)} g proteína · 🍚 ${Math.round(result.data.carbs_g)} g carboidratos · 🥑 ${Math.round(result.data.fat_g)} g gorduras`,
    "",
    "📊 Projeção da opção escolhida (ainda não registrada como consumo):"
  ];

  const labels = {
    calories: ["🔥 Calorias", "kcal"],
    protein_g: ["🥩 Proteína", "g"],
    carbs_g: ["🍚 Carboidratos", "g"],
    fat_g: ["🥑 Gorduras", "g"]
  };

  for (const [key, [label, unit]] of Object.entries(labels)) {
    const metric = projected.metrics[key].projected;
    if (metric.target === null) continue;
    const remaining = metric.remaining;
    const status = metric.status === "falta"
      ? `faltariam ${Math.round(remaining)} ${unit}`
      : metric.status === "atingida"
        ? "meta atingida"
        : `ultrapassaria em ${Math.round(Math.abs(remaining))} ${unit}`;
    lines.push(`${label}: ${status}`);
    if (result.data.explicit_overage) {
      lines.push(`  Projeção: ${Math.round(metric.projected_consumed)} / ${Math.round(metric.target)} ${unit}`);
    }
  }

  if (projected.macros_compatible === false && !budgetAnalysis?.incompatible) {
    lines.push("ℹ️ As metas atuais de calorias e macros não são matematicamente compatíveis; não é possível atingir todas simultaneamente.");
  }

  if (budgetAnalysis?.incompatible) {
    const remainingCalories = Math.round(budgetAnalysis.calorie_remaining);
    const requiredCalories = Math.round(budgetAnalysis.macro_calorie_requirement_kcal);
    lines.push("");
    lines.push(`⚠️ Restam ${remainingCalories} kcal, mas atingir os macros ainda pendentes exigiria cerca de ${requiredCalories} kcal. Não é possível completar tudo sem ultrapassar a meta calórica.`);
    lines.push(budgetAnalysis.priority === "protein"
      ? "Vou priorizar proteína e manter esta sugestão dentro do limite de calorias; carboidratos e gorduras ficam como metas secundárias."
      : "Vou respeitar o limite de calorias e não tentar aumentar um macro que já atingiu ou ultrapassou a meta.");
  }

  lines.push("\nSe quiser, posso registrar quando você confirmar que comeu.");
  return lines.join("\n");
}

function buildMealSuggestionReply(options, budgetAnalysis) {
  const lines = [];

  if (options.length < 3) {
    lines.push(
      `Encontrei ${options.length} ${options.length === 1 ? "opção válida" : "opções válidas"} para esta refeição. Não vou completar com opções que falhem na validação.`
    );
  } else {
    lines.push("Encontrei três opções válidas para esta refeição:");
  }

  options.forEach((option, index) => {
    const quick = option.is_quick === true;

    lines.push(
      `${quick ? "⚡" : "🍽️"} Opção ${index + 1} — ${quick ? "Preparo rápido" : option.category || "Refeição completa"}`
    );

    lines.push(option.name);

    for (const food of option.foods || []) {
      lines.push(`• ${food}`);
    }

    lines.push(
      `🔥 ${Math.round(option.calories)} kcal · 🥩 ${Math.round(option.protein_g)} g proteína · 🍚 ${Math.round(option.carbs_g)} g carboidratos · 🥑 ${Math.round(option.fat_g)} g gorduras`
    );
  });

  if (budgetAnalysis?.incompatible) {
    lines.push("");

    lines.push(
      `⚠️ Restam ${Math.round(budgetAnalysis.calorie_remaining)} kcal, mas atingir os macros restantes exigiria cerca de ${Math.round(budgetAnalysis.macro_calorie_requirement_kcal)} kcal. Não é possível completar tudo sem ultrapassar a meta calórica.`
    );

    lines.push(
      budgetAnalysis.priority === "protein"
        ? "Priorizei proteína; carboidratos e gorduras são objetivos secundários, e todas as opções respeitam o limite de calorias."
        : "Respeitei o limite de calorias sem tentar aumentar um macro já atingido ou excedido."
    );
  }

  if (options.length) {
    lines.push(
      "\nEscolha uma opção pelo número para ver a projeção. A escolha não registra consumo; confirme depois que comeu para registrar."
    );
  } else {
    lines.push(
      "\nNão encontrei opção válida dentro do orçamento e das restrições atuais; não registrei consumo."
    );
  }

  return lines.join("\n");
}

function normalizeMealPeriod(period, fallback = getMealPeriod()) {
  const value = String(period || "").toLocaleLowerCase("pt-BR");
  const matched = getMealPeriods().find((item) => value.includes(item));
  return matched || fallback;
}



function detectQuickPreparationRequest(message) {
  const text = normalizeRequestText(message);
  const asksForFood = /\b(?:opcao|opcoes|alternativa|alternativas|refeicao|lanche|sugestao|sugestoes|algo|ideia|preparo)\b/.test(text);
  return asksForFood && /\b(?:rapido|rapida|rapidos|rapidas)\b/.test(text);
}

function detectMoreOptionsRequest(message) {
  const text = normalizeRequestText(message);
  return /\b(?:outra|outras|mais|diferente|diferentes)\b.{0,35}\b(?:opcao|opcoes|alternativa|alternativas|sugestao|sugestoes|ideia|ideias)\b/.test(text)
    || /\b(?:opcao|opcoes|alternativa|alternativas|sugestao|sugestoes|ideia|ideias)\b.{0,35}\b(?:diferente|diferentes|outra|outras)\b/.test(text);
}












function buildExplicitMealRequestFacts(message) {
  const availableFoods = normalizeToolFoodList(extractAvailableFoods(message));
  const wheyAvailability = detectWheyAvailability(message);
  if (wheyAvailability === true && !availableFoods.includes("whey")) {
    availableFoods.push("whey");
  }

  const explicitExcludedCompositions = detectExplicitExcludedCompositions(message);

  /*
   * Uma exclusão de composição não transforma seus ingredientes em
   * alimentos proibidos. Ex.: "não quero whey com água" mantém whey
   * disponível e proíbe somente a combinação whey + água.
   */
  const compositionIngredients = new Set(
    explicitExcludedCompositions.flatMap((composition) => composition.ingredients)
  );

  const explicitExcludedFoods = normalizeToolFoodList(
    extractExcludedFoods(message)
  ).filter((food) => !compositionIngredients.has(food));

  const desiredFood = detectDesiredFood(message);
  const requestedServings = detectRequestedServings(
    message,
    desiredFood,
    null
  );

  const text = normalizeRequestText(message);

  const onlyAvailableFoods =
    /\b(?:so\s+tenho|so\s+tem|somente\s+tenho|somente\s+tem|so\s+estou\s+com)\b/.test(text);

  const quickOnly = detectQuickPreparationRequest(message);
  const moreOptions = detectMoreOptionsRequest(message);

  const preserveBudgetForFuture =
    /\b(?:nao\s+quero\s+gastar\s+tudo|nao\s+quero\s+gastar\s+minhas\s+calorias|nao\s+gastar\s+tudo|guardar\s+(?:calorias|parte\s+das\s+calorias)|preservar\s+(?:calorias|parte\s+das\s+calorias)|deixar\s+(?:calorias|parte\s+das\s+calorias)|vou\s+(?:jantar|almocar|almoçar)\s+fora|vou\s+comer\s+fora)\b/.test(text);

  let futureMealPeriod = null;
  if (/\b(?:jantar|vou\s+jantar)\b/.test(text)) {
    futureMealPeriod = "jantar";
  } else if (/\b(?:almo[cç]ar|vou\s+almo[cç]ar)\b/.test(text)) {
    futureMealPeriod = "almoço";
  } else if (/\b(?:ceia|vou\s+fazer\s+uma\s+ceia)\b/.test(text)) {
    futureMealPeriod = "ceia";
  }

  return {
    availableFoods,
    requiredFoods: [],
    explicitExcludedFoods,
    explicitExcludedCompositions,
    onlyAvailableFoods,
    quickOnly,
    moreOptions,
    preserveBudgetForFuture,
    futureMealPeriod,
    desiredFood,
    requestedServings,
    mealPeriod: null
  };
}

function mergeExplicitMealSuggestionData(data, explicitFacts) {
  const modelData = data && typeof data === "object" ? data : {};
  const union = (...lists) => [...new Set(
    lists
      .flatMap((list) => Array.isArray(list) ? normalizeToolFoodList(list) : [])
      .filter(Boolean)
  )];

  const explicitUnavailable = new Set(explicitFacts.explicitExcludedFoods);
  const explicitAvailable = new Set(explicitFacts.availableFoods);

  const availableFoods = union(
    modelData.available_foods,
    explicitFacts.availableFoods
  ).filter((food) => !explicitUnavailable.has(food));

  /*
   * Se o usuário declarou explicitamente que possui um alimento,
   * uma interpretação do modelo não pode transformá-lo em proibido.
   * A única exceção é uma exclusão explícita do próprio usuário.
   */
  const excludedFoods = union(
    modelData.explicit_excluded_foods,
    explicitFacts.explicitExcludedFoods
  ).filter((food) =>
    !explicitAvailable.has(food)
    || explicitUnavailable.has(food)
  );

  const requiredFoods = union(
    modelData.required_foods,
    explicitFacts.requiredFoods
  ).filter((food) => !explicitUnavailable.has(food));

  const excludedCompositions = [
    ...(Array.isArray(modelData.explicit_excluded_compositions)
      ? modelData.explicit_excluded_compositions
      : []),
    ...explicitFacts.explicitExcludedCompositions
  ];

  return {
    ...modelData,
    meal_period: explicitFacts.mealPeriod || modelData.meal_period,
    desired_food: explicitFacts.desiredFood || modelData.desired_food || "",
    requested_servings:
      explicitFacts.requestedServings ?? modelData.requested_servings ?? null,
    available_foods: availableFoods,
    required_foods: requiredFoods,
    explicit_excluded_foods: excludedFoods,
    explicit_excluded_compositions: excludedCompositions,

    /*
     * "Só tenho X e Y" e "quero algo rápido" são restrições
     * determinísticas. O modelo não pode inventá-las nem removê-las.
     */
    only_available_foods: explicitFacts.onlyAvailableFoods === true,

    /*
     * Não pedido explicitamente = não é quick_only.
     */
    quick_only: explicitFacts.quickOnly === true,

    more_options: explicitFacts.moreOptions === true
      || modelData.more_options === true,

    preserve_budget_for_future: explicitFacts.preserveBudgetForFuture === true
      || modelData.preserve_budget_for_future === true,

    future_meal_period:
      explicitFacts.futureMealPeriod || modelData.future_meal_period || null
  };
}

function getStructuredOrLegacyFoods(data, field, message) {
  return Array.isArray(data?.[field])
    ? normalizeToolFoodList(data[field])
    : extractAvailableFoods(message);
}
function explicitlyAcceptsOverage(message) {
  const text = String(message || "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  return /\b(?:mesmo assim|mesmo passando|mesmo ultrapassando|mesmo que (?:passe|ultrapasse)|quero assim mesmo|quero manter a quantidade|aceito (?:o )?excedente|nao me importo|pode passar da meta|quero mesmo que passe)\b/.test(text);
}


function buildDesiredFoodReply(options, desiredFood, budget, budgetAnalysis, { availabilityOnly = false, summary = null } = {}) {
  const names = { pizza: "pizza", hamburger: "hambúrguer", chocolate: "chocolate", sorvete: "sorvete", japonesa: "comida japonesa", bolo: "bolo", massa: "massa", "batata frita": "batata" };
  const lines = [`Vou tentar encaixar ${names[desiredFood] || desiredFood} no orçamento desta refeição.`];
  if (!options.length) {
    if (availabilityOnly) {
      lines.push(`Não encontrei uma composição de ${names[desiredFood] || desiredFood} que use apenas os alimentos informados e caiba no orçamento de aproximadamente ${Math.round(budget)} kcal.`);
      lines.push("Diga se você pode incluir algum ingrediente ou enviar os dados da porção desejada para eu recalcular.");
      return lines.join("\n");
    }
    lines.push(`Não encontrei referência suficiente para uma porção plausível de ${names[desiredFood] || desiredFood} com os alimentos e restrições informados.`);
    lines.push("Se você enviar a porção, ingredientes ou os dados do rótulo/cardápio, calculo o impacto sem inventar valores.");
    return lines.join("\n");
  }
  const availableCalories = Number(budgetAnalysis?.calorie_remaining ?? budget);
  lines.push(`Referência atual: cerca de ${Math.round(availableCalories)} kcal restantes no dia. As porções abaixo são plausíveis; não reduzi a unidade para forçar o encaixe.`);
  options.forEach((option, index) => {
    lines.push(`\n🍽️ Opção ${index + 1} — ${option.name}`);
    for (const food of option.foods) lines.push(`• ${food}`);
    lines.push(`🔥 ${option.calories} kcal · 🥩 ${option.protein_g} g proteína · 🍚 ${option.carbs_g} g carboidratos · 🥑 ${option.fat_g} g gorduras`);
    const dailyOver = Math.round(option.daily_calorie_overage || 0);
    if (dailyOver > 0) lines.push(`⚠️ Excederia o saldo diário em aproximadamente ${dailyOver} kcal.`);
    const excess = option.macro_overages || {};
    const macroLines = [["protein_g", "proteína"], ["carbs_g", "carboidratos"], ["fat_g", "gorduras"]]
      .filter(([key]) => Number(excess[key]) > 0.5)
      .map(([key, label]) => `${label}: +${Math.round(excess[key] * 10) / 10} g sobre o saldo`);
    if (macroLines.length) lines.push(`⚠️ Excedente de macros: ${macroLines.join("; ")}.`);
    if (option.explicit_overage && summary) {
      const projection = calculateNutritionBalance({
        calorie_target: summary.calorie_target,
        protein_target: summary.protein_target,
        carbs_target: summary.carbs_target,
        fat_target: summary.fat_target
      }, {
        calories: summary.calories,
        protein_g: summary.protein_g,
        carbs_g: summary.carbs_g,
        fat_g: summary.fat_g
      }, option);
      const calories = projection.metrics.calories.projected;
      if (calories.target !== null) {
        const status = calories.remaining >= 0
          ? `${Math.round(calories.remaining)} kcal abaixo da meta`
          : `${Math.round(Math.abs(calories.remaining))} kcal acima da meta`;
        lines.push(`📊 Projeção diária: ${Math.round(calories.projected_consumed)} / ${Math.round(calories.target)} kcal (${status}).`);
      }
    }
  });
  if (options.length === 1) {
    lines.push("Esta foi a única composição plausível disponível no catálogo para as restrições atuais.");
  }
  if (budgetAnalysis?.incompatible) {
    lines.push(`\nAs metas pendentes exigiriam aproximadamente ${Math.round(budgetAnalysis.macro_calorie_requirement_kcal)} kcal, acima das ${Math.round(budgetAnalysis.calorie_remaining)} kcal restantes. Mantive calorias como limite e priorizei proteína nas opções compatíveis.`);
  }
  lines.push("\nEscolher uma opção só mostra a projeção. O consumo só será registrado após sua confirmação explícita.");
  return lines.join("\n");
}


function getRecentSuggestedOptions(events) {
  return events
    .filter((event) => event.event_type === "suggestion_offered")
    .slice(0, 5)
    .flatMap((event) => {
      if (Array.isArray(event.details?.options)) return event.details.options;
      return event.details?.option ? [event.details.option] : [];
    });
}


function formatPlanReply(plan) {
  const lines = ["🗓️ Plano alimentar de hoje (opções estimadas):"];
  for (const meal of plan.meals) {
    lines.push(`\n🍽️ ${meal.period} · orçamento aproximado ${meal.calorie_budget ?? "sem meta"} kcal`);
    meal.options.forEach((option, index) => {
      lines.push(`${index + 1}) ${option.name} — ${option.calories} kcal | P ${option.protein_g} g · C ${option.carbs_g} g · G ${option.fat_g} g`);
      lines.push(`   ${option.foods.join(" · ")}`);
    });
  }
  if (plan.note) lines.push(`\n📌 ${plan.note}`);
  lines.push("\nVocê pretende seguir esse plano como referência? Diga sim ou não. Escolher uma opção não registra consumo.");
  return lines.join("\n");
}

/* =========================================================
   SALVAR AÇÃO
========================================================= */

const PENDING_CLARIFICATION_MAX_AGE_MS = 15 * 60000;

// CONV-09: guarda a pergunta de preparo/corte para aceitar a resposta curta depois.
function askMealClarification(userId, message, estimate) {
  setPendingMealClarification(userId, {
    type: "generic_food",
    original_message: message,
    clarifications: estimate.needs_clarification,
    created_at: Date.now()
  });
  return buildMealClarificationQuestion(estimate);
}

// NUT-09: pergunta só a quantidade dos itens de peso/volume sem quantidade.
function askMealQuantities(userId, message, items) {
  setPendingMealClarification(userId, {
    type: "missing_quantity",
    original_message: message,
    items: items.map(({ id, name, default_g, unit }) => ({ id, name, default_g, unit })),
    created_at: Date.now()
  });
  return buildMealQuantityQuestion(items);
}

function buildMealQuantityQuestion(items) {
  return [
    "Para registrar com precisão, quanto foi de:",
    ...items.map(({ name, unit }) => `• ${name.toLocaleLowerCase("pt-BR")} (porção padrão: ${unit})?`),
    "Responda, por exemplo, \"150 g\", \"2 colheres de sopa\" ou \"1 concha\" para cada item, ou \"padrão\" para usar as porções padrão. Ainda não registrei nada."
  ].join("\n");
}

async function handlePendingMealClarification(userId, message, internal) {
  const pending = getPendingMealClarification(userId);
  if (!pending || !["generic_food", "missing_quantity"].includes(pending.type)) return null;

  if (!(Date.now() - Number(pending.created_at) <= PENDING_CLARIFICATION_MAX_AGE_MS)) {
    clearPendingMealClarification(userId);
    return null;
  }

  if (pending.type === "missing_quantity") {
    const answer = applyQuantityAnswer(pending.original_message, pending.items || [], message);
    if (answer) {
      clearPendingMealClarification(userId);
      return processMessage(userId, answer.message, {
        ...internal,
        acceptDefaultQuantities: answer.acceptDefaults
      });
    }
  } else {
    const rewritten = resolveGenericFoodAnswer(pending, message);
    if (rewritten) {
      clearPendingMealClarification(userId);
      return processMessage(userId, rewritten, internal);
    }
  }

  // Resposta curta que não resolve a pergunta: pergunta de novo. Mensagem longa
  // é outro assunto: a pendência é encerrada e o fluxo normal segue.
  const words = normalizeRequestText(message).trim().split(/\s+/).filter(Boolean);
  if (words.length <= 3 && !message.includes("?")) {
    return pending.type === "missing_quantity"
      ? `Não identifiquei a quantidade.\n${buildMealQuantityQuestion(pending.items || [])}`
      : `Não identifiquei a opção.\n${buildMealClarificationQuestion({ needs_clarification: pending.clarifications })}`;
  }
  clearPendingMealClarification(userId);
  return null;
}

function describeMealForReply(meal) {
  return `#${meal.id} — ${meal.description} (${Math.round(meal.calories)} kcal, registrada em ${String(meal.consumed_at).slice(0, 16)})`;
}

// NUT-11: exclusão em dois passos. O pedido só mostra a refeição; a exclusão acontece
// após confirmação explícita em até 15 minutos.
function handleMealDeletion(userId, message, todayMeals) {
  const pending = getPendingMealDeletion(userId);

  if (pending && isMealDeletionConfirmation(message)) {
    const deleted = deleteMeal(userId, pending.details?.meal_id, { requestEventId: pending.id });
    return deleted
      ? `🗑️ Excluí a refeição ${describeMealForReply(deleted)}. O resumo do dia já desconsidera esse registro, e uma cópia ficou no histórico de eventos.`
      : "Não encontrei mais essa refeição; nada foi excluído.";
  }

  if (pending && isMealDeletionCancellation(message)) {
    recordMealPlanEvent(userId, {
      event_type: "meal_deletion_cancelled",
      meal_id: pending.details?.meal_id ?? null,
      details: { request_event_id: pending.id }
    });
    return "Tudo bem, não excluí nada.";
  }

  const request = detectMealDeletionRequest(message);
  if (!request) return null;

  const meal = request.mealId
    ? getMeal(userId, request.mealId)
    : request.last
      ? todayMeals[todayMeals.length - 1] || null
      : null;

  if (!meal) {
    const options = todayMeals.slice(-5).map((item) => `• ${describeMealForReply(item)}`);
    return [
      request.mealId
        ? `Não encontrei a refeição #${request.mealId} no seu histórico.`
        : "Qual refeição você quer excluir? Me diga o número (ex.: \"exclua a refeição #12\").",
      ...(options.length ? ["Refeições de hoje:", ...options] : ["Você não tem refeições registradas hoje."])
    ].join("\n");
  }

  recordMealPlanEvent(userId, {
    event_type: "meal_deletion_requested",
    meal_period: meal.meal_period,
    meal_id: meal.id,
    details: { meal_id: meal.id }
  });
  return `Vou excluir a refeição ${describeMealForReply(meal)}. Para confirmar, responda "sim, excluir". Para manter, responda "não".`;
}

function buildInvalidMealReply(errors, prefix) {
  return `${prefix} porque os dados nutricionais não são válidos: ${errors.join("; ")}. Envie a descrição e os valores corretos (calorias, proteínas, carboidratos e gorduras).`;
}

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

  if (result.action === "meal_correction") {
    return correctMeal(
      userId,
      result.data.meal_id,
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

  if (result.action === "set_macro_targets") {
    const updatedUser = setCustomMacroTargets(userId, result.data);
    return {
      user: updatedUser,
      targets: updatedUser ? {
        daily_calorie_target: updatedUser.daily_calorie_target,
        daily_protein_target: updatedUser.daily_protein_target,
        daily_carbs_target: updatedUser.daily_carbs_target,
        daily_fat_target: updatedUser.daily_fat_target
      } : null
    };
  }

  if (result.action === "reset_nutrition_targets") {
    return restoreAutomaticNutritionTargets(userId);
  }

  return null;
}

/* =========================================================
   RESPOSTA DO RESUMO
========================================================= */

function formatRemainingStatus(remaining, unit) {
  if (remaining > 0.5) return `Faltam ${Math.round(remaining)} ${unit}`;
  if (remaining < -0.5) return `Ultrapassou ${Math.round(Math.abs(remaining))} ${unit}`;
  return "Meta atingida";
}

function classifySummaryIntent(message) {
  const text = String(message || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");

  if (
    /\bcomo esta (?:o )?(?:meu )?(?:dia|resumo)\b/.test(text) ||
    /\bme mostra(?:r)? (?:o )?(?:meu )?resumo\b/.test(text) ||
    /\bresumo (?:completo|do dia|diario)\b/.test(text)
  ) {
    return { type: "full", metrics: [] };
  }

  const metrics = [];
  if (/\b(calorias?|kcal)\b/.test(text)) metrics.push("calories");
  if (/\b(proteinas?|prot)\b/.test(text)) metrics.push("protein_g");
  if (/\b(carboidratos?|carbs?)\b/.test(text)) metrics.push("carbs_g");
  if (/\b(gorduras?|gord)\b/.test(text)) metrics.push("fat_g");

  const asksForValue = /\b(quanto|quantos|quantas|qual|quais|meta|saldo|restante|restantes|sobram|sobra|falta|faltam|ainda|consumi|consumido|tenho)\b/.test(text);
  const asksAboutToday = /\b(hoje|dia|diario|diaria|ainda|restante|restantes|saldo|sobram|sobra|falta|faltam|consumi|consumido|tenho|meta)\b/.test(text);

  return metrics.length && asksForValue && asksAboutToday
    ? { type: "specific", metrics: [...new Set(metrics)] }
    : null;
}

function buildSpecificNutritionSummary(summary, metrics) {
  const definitions = {
    calories: {
      label: "🔥 Calorias",
      consumed: "calories",
      target: "calorie_target",
      remaining: "calorie_remaining",
      unit: "kcal",
      consumedLabel: "consumidas"
    },
    protein_g: {
      label: "🥩 Proteína",
      consumed: "protein_g",
      target: "protein_target",
      remaining: "protein_remaining",
      unit: "g",
      consumedLabel: "consumida"
    },
    carbs_g: {
      label: "🍚 Carboidratos",
      consumed: "carbs_g",
      target: "carbs_target",
      remaining: "carbs_remaining",
      unit: "g",
      consumedLabel: "consumidos"
    },
    fat_g: {
      label: "🥑 Gordura",
      consumed: "fat_g",
      target: "fat_target",
      remaining: "fat_remaining",
      unit: "g",
      consumedLabel: "consumida"
    }
  };
  const lines = ["📊 Seu saldo de hoje:"];

  for (const key of metrics) {
    const definition = definitions[key];
    if (!definition) continue;
    const consumed = summary[definition.consumed] ?? 0;
    const target = summary[definition.target];
    const remaining = summary[definition.remaining];
    const detail = target === null || target === undefined
      ? "meta diária não definida"
      : `meta ${Math.round(target)} ${definition.unit} · ${formatRemainingStatus(remaining, definition.unit)}`;
    lines.push(`${definition.label}: ${Math.round(consumed)} ${definition.unit} ${definition.consumedLabel} · ${detail}`);
  }

  return lines.join("\n");
}

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
      `🎯 ${summary.calorie_target_mode === "custom" ? "Meta calórica personalizada" : "Meta inicial calculada"}: ${Math.round(summary.calorie_target)} kcal`
    );

    lines.push(
      `📌 ${formatRemainingStatus(remaining, "kcal")}`
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
      `📌 ${formatRemainingStatus(remaining, "g")}`
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
      `📌 ${formatRemainingStatus(remaining, "g")}`
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
      `📌 ${formatRemainingStatus(remaining, "g")}`
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
  const lines = [];

  lines.push("👤 Perfil atualizado:");

  if (updatedUser?.name) {
    lines.push(
      `• Nome: ${updatedUser.name}`
    );
  }

  if (updatedUser?.age_years) {
    lines.push(
      `• Idade: ${updatedUser.age_years} anos`
    );
  }

  if (updatedUser?.sex) {
    lines.push(
      `• Sexo: ${updatedUser.sex}`
    );
  }

  if (updatedUser?.height_cm) {
    lines.push(
      `• Altura: ${updatedUser.height_cm} cm`
    );
  }

  if (updatedUser?.weight_kg) {
    lines.push(
      `• Peso: ${updatedUser.weight_kg} kg`
    );
  }

  if (updatedUser?.goal) {
    lines.push(
      `• Objetivo: ${updatedUser.goal}`
    );
  }

  if (updatedUser?.activity_level) {
    lines.push(
      `• Atividade: ${updatedUser.activity_level}`
    );
  }

  if (updatedUser?.training_days_per_week) {
    lines.push(
      `• Treinos por semana: ${updatedUser.training_days_per_week}`
    );
  }

  if (updatedUser?.dietary_preferences) {
    lines.push(
      `• Preferências alimentares: ${updatedUser.dietary_preferences}`
    );
  }

  if (updatedUser?.food_dislikes) {
    lines.push(
      `• Alimentos evitados: ${updatedUser.food_dislikes}`
    );
  }

  if (targets) {
    lines.push("");

    lines.push("🎯 Metas nutricionais:");

    if (targets.daily_calorie_target !== null && targets.daily_calorie_target !== undefined) {
      lines.push(
        `🔥 ${Math.round(targets.daily_calorie_target)} kcal`
      );
    }

    if (targets.daily_protein_target !== null && targets.daily_protein_target !== undefined) {
      lines.push(
        `🥩 ${Math.round(targets.daily_protein_target)} g proteína`
      );
    }

    if (targets.daily_carbs_target !== null && targets.daily_carbs_target !== undefined) {
      lines.push(
        `🍚 ${Math.round(targets.daily_carbs_target)} g carboidratos`
      );
    }

    if (targets.daily_fat_target !== null && targets.daily_fat_target !== undefined) {
      lines.push(
        `🥑 ${Math.round(targets.daily_fat_target)} g gorduras`
      );
    }
  }

  return lines.join("\n");
}
function isHistoryRequest(message) {
  const text = normalizeRequestText(message).trim();

  return /\b(?:historico|historico recente)\b/.test(text)
    || /\b(?:me mostra|me mostre|mostrar|mostre|quero ver|ver)\b.{0,30}\b(?:meu|meus)?\s*(?:historico|registros)\b/.test(text)
    || /\b(?:meus|minhas)\s+(?:registros|refeicoes|treinos|pesagens)\b/.test(text);
}

function formatHistoryDate(value) {
  const raw = String(value || "");

  const match = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/
  );

  if (!match) {
    return raw;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const weekdays = [
    "domingo",
    "segunda-feira",
    "terça-feira",
    "quarta-feira",
    "quinta-feira",
    "sexta-feira",
    "sábado"
  ];

  const weekday = weekdays[
    new Date(year, month - 1, day).getDay()
  ];

  return `📅 ${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${match[3]}/${match[2]} • ${match[4]}:${match[5]}`;
}

function buildHistoryReply(recentHistory) {
  const lines = [
    "📋 Histórico recente"
  ];

  const meals = Array.isArray(recentHistory?.meals)
    ? recentHistory.meals
    : [];

  const workouts = Array.isArray(recentHistory?.workouts)
    ? recentHistory.workouts
    : [];

  const weights = Array.isArray(recentHistory?.weights)
    ? recentHistory.weights
    : [];

  if (meals.length) {
    lines.push("");
    lines.push("🍽️ REFEIÇÕES");

    for (const meal of meals) {
      lines.push("");
      lines.push(`${formatHistoryDate(meal.date)}`);
      lines.push(`${meal.description || "Refeição"}`);
      lines.push(
        `${Math.round(Number(meal.calories) || 0)} kcal`,
        `🥩 Proteínas: ${Number(meal.protein_g) || 0} g`,
        `🍚 Carboidratos: ${Number(meal.carbs_g) || 0} g`,
        `🥑 Gorduras: ${Number(meal.fat_g) || 0} g`
      );
    }
  }

  if (workouts.length) {
    lines.push("");
    lines.push("🏋️ TREINOS");

    for (const workout of workouts) {
      lines.push("");
      lines.push(`${formatHistoryDate(workout.date)}`);
      lines.push(`${workout.description || "Treino"}`);

      const details = [];

      if (Number(workout.duration_min) > 0) {
        details.push(`${Number(workout.duration_min)} min`);
      }

      if (workout.notes) {
        details.push(String(workout.notes).replace(/\.$/, ""));
      }

      if (details.length) {
        lines.push(details.join(" · "));
      }
    }
  }

  if (weights.length) {
    lines.push("");
    lines.push("⚖️ PESO");

    for (const weight of weights) {
      lines.push("");
      lines.push(`${formatHistoryDate(weight.date)}`);
      lines.push(`${Number(weight.weight_kg)} kg`);
    }
  }

  if (!meals.length && !workouts.length && !weights.length) {
    lines.push("");
    lines.push("Ainda não há registros no seu histórico.");
  }

  return lines.join("\n");
}

/* =========================================================
   REFEIÇÃO LIVRE
========================================================= */

function isYesMessage(message) {
  const text = normalizeRequestText(message).trim();
  return /^(?:sim|s|si|claro|com certeza|combinado|pode|quero|tenho|sim claro)[.! ]*$/.test(text);
}

function isNoMessage(message) {
  const text = normalizeRequestText(message).trim();
  return /^(?:nao|n|negativo|nao tenho|nao quero)[.! ]*$/.test(text);
}

function parseFreeMealFrequency(message) {
  const text = normalizeRequestText(message);
  const wordNumbers = {
    uma: 1,
    um: 1,
    duas: 2,
    dois: 2,
    tres: 3,
    quatro: 4,
    cinco: 5,
    seis: 6,
    sete: 7
  };

  const numeric = text.match(/\b([1-7])\b\s*(?:refeicoes?|vezes?)\s*(?:livres?)?\s*(?:por\s+semana|na\s+semana)?/);
  if (numeric) return Number(numeric[1]);

  const written = text.match(/\b(uma|um|duas|dois|tres|quatro|cinco|seis|sete)\b\s*(?:refeicoes?|vezes?)\s*(?:livres?)?\s*(?:por\s+semana|na\s+semana)?/);
  if (written) return wordNumbers[written[1]];

  if (/\b(?:tenho|faco|costumo fazer)\s+(?:uma|um)\s+refeicao\s+livre\b/.test(text)) {
    return 1;
  }

  return null;
}

function parseFreeMealDays(message) {
  const text = normalizeRequestText(message);
  if (/\b(?:qualquer dia|dia variavel|varia|quando der|quando eu quiser)\b/.test(text)) return [];

  const aliases = [
    ["domingo", "domingo"],
    ["segunda-feira", "segunda-feira"],
    ["segunda", "segunda-feira"],
    ["terca-feira", "terça-feira"],
    ["terca", "terça-feira"],
    ["quarta-feira", "quarta-feira"],
    ["quarta", "quarta-feira"],
    ["quinta-feira", "quinta-feira"],
    ["quinta", "quinta-feira"],
    ["sexta-feira", "sexta-feira"],
    ["sexta", "sexta-feira"],
    ["sabado", "sábado"]
  ];

  const result = [];
  for (const [needle, value] of aliases) {
    if (text.includes(needle)) result.push(value);
  }
  return [...new Set(result)];
}

function parseFreeMealPeriod(message) {
  const text = normalizeRequestText(message);
  if (/\bcafe da manha\b/.test(text)) return "café da manhã";
  if (/\balmoco\b/.test(text)) return "almoço";
  if (/\blanche(?: da tarde)?\b/.test(text)) return "lanche da tarde";
  if (/\bjantar\b/.test(text)) return "jantar";
  if (/\bceia\b/.test(text)) return "ceia";
  return null;
}

function isFreeMealRequest(message) {
  const text = normalizeRequestText(message);
  return /\b(?:refeicao livre|refeicao flexivel|refeicao livre da semana|dia livre|free meal)\b/.test(text);
}

function isExplicitFreeMealNegative(message) {
  const text = normalizeRequestText(message);
  return /\b(?:nao|nunca)\b.{0,25}\b(?:tenho|faco|quero|vou fazer)\b.{0,15}\b(?:refeicao livre|dia livre)\b/.test(text)
    || /\b(?:nao|nunca)\b.{0,20}\b(?:refeicao livre|dia livre)\b/.test(text);
}

function isFreeMealSettingsRequest(message) {
  const text = normalizeRequestText(message);
  return /\b(?:quando|qual dia|qual o dia|quantas|quantos)\b.{0,35}\b(?:refeicao livre|refeicoes livres|dia livre)\b/.test(text)
    || /\b(?:minha|meu|minhas|meus)\b.{0,20}\b(?:refeicao livre|refeicoes livres)\b/.test(text);
}

function wantsGenericMealSuggestion(message) {
  const text = normalizeRequestText(message);
  return /\b(?:o que posso comer|oq posso comer|me sugere|sugestao|sugestoes|opcoes|alternativas)\b/.test(text)
    && !/\b(?:nao|nunca)\b/.test(text);
}

function getBrazilWeekday(date = new Date()) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long"
  }).format(date)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function isTodayFreeMeal(settings) {
  if (!settings?.enabled || !Array.isArray(settings.days) || !settings.days.length) return false;
  const today = getBrazilWeekday();
  return settings.days.some((day) => {
    const normalizedDay = normalizeRequestText(day);
    return normalizedDay === today
      || normalizedDay.replace(/-feira/g, "") === today.replace(/-feira/g, "");
  });
}

function formatFreeMealSettings(settings) {
  if (!settings?.enabled) {
    return "No momento, não há refeição livre semanal configurada.";
  }

  const frequency = settings.meals_per_week === 1
    ? "1 refeição livre por semana"
    : `${settings.meals_per_week} refeições livres por semana`;

  const days = Array.isArray(settings.days) && settings.days.length
    ? settings.days.join(", ")
    : "dia flexível";

  const period = settings.period || "período flexível";

  return `🍽️ Sua configuração de refeição livre:\n${frequency}\n📅 ${days}\n🕒 ${period}`;
}

function buildFreeMealSuggestionReply(options, settings, mealBudget) {
  const lines = [
    "🍽️ Sua refeição livre pode ser flexível sem transformar o dia inteiro em um dia livre.",
    Number.isFinite(Number(mealBudget)) && mealBudget > 0
      ? `🔥 Saldo aproximado para esta refeição: ${Math.round(mealBudget)} kcal`
      : null,
    ""
  ].filter(Boolean);

  options.forEach((option, index) => {
    const fit = option.fits_budget === true
      ? "cabe no orçamento atual"
      : option.fits_budget === false
        ? "ultrapassa o orçamento atual"
        : "estimativa";

    lines.push(
      `${index + 1}️⃣ ${option.name}`,
      `≈ ${Math.round(option.calories)} kcal · P ${Math.round(option.protein_g)} g · C ${Math.round(option.carbs_g)} g · G ${Math.round(option.fat_g)} g`,
      `📌 ${fit}`,
      ""
    );
  });

  lines.push(
    "Escolher uma opção não registra consumo. Quando você comer, confirme para eu registrar no histórico."
  );

  return lines.join("\n");
}

function buildFreeMealSetupPrompt(nextStep) {
  if (nextStep === "asked") {
    return "🍽️ Você costuma fazer alguma refeição livre durante a semana? Responda sim ou não.";
  }
  if (nextStep === "asked_frequency") {
    return "Quantas refeições livres você costuma fazer por semana? Pode responder, por exemplo, 1, 2 ou 3.";
  }
  if (nextStep === "asked_day") {
    return "Em qual dia da semana costuma fazer sua refeição livre? Pode dizer um ou mais dias.";
  }
  if (nextStep === "asked_period") {
    return "Em qual refeição ela costuma acontecer: almoço, lanche da tarde, jantar ou ceia?";
  }
  return "";
}

function handleFreeMealConversation({
  userId,
  message,
  user,
  dailySummary,
  currentPeriod,
  settings
}) {
  const text = normalizeRequestText(message).trim();
  const status = settings?.setup_status || "unknown";
  const explicitFreeMeal = isFreeMealRequest(message);

  if (
    status === "unknown" &&
    hasExplicitProfileUpdateIntent(message) &&
    !explicitFreeMeal
  ) {
    return null;
  }

  if (status === "asked") {
    if (isExplicitFreeMealNegative(message) || isNoMessage(message)) {
      setFreeMealSettings(userId, {
        setup_status: "disabled",
        enabled: false,
        meals_per_week: 0,
        days: [],
        period: null
      });
      return "Tudo bem. Não vou considerar refeição livre na sua rotina. Você pode mudar isso depois.";
    }

    if (isYesMessage(message)) {
      setFreeMealSettings(userId, {
        setup_status: "asked_frequency",
        enabled: true
      });
      return buildFreeMealSetupPrompt("asked_frequency");
    }
  }

  if (status === "asked_frequency") {
    const frequency = parseFreeMealFrequency(message);
    if (frequency !== null) {
      const days = parseFreeMealDays(message);
      const period = parseFreeMealPeriod(message);

      if (days.length && period) {
        const saved = setFreeMealSettings(userId, {
          setup_status: "configured",
          enabled: true,
          meals_per_week: frequency,
          days,
          period
        });
        return `${formatFreeMealSettings(saved)}\n\nPerfeito. Quando chegar o dia da sua refeição livre, posso sugerir opções de pizza, lanche, comida japonesa, sobremesa e outras escolhas ajustadas ao seu saldo.`;
      }

      if (days.length) {
        setFreeMealSettings(userId, {
          setup_status: "asked_period",
          enabled: true,
          meals_per_week: frequency,
          days
        });
        return buildFreeMealSetupPrompt("asked_period");
      }

      setFreeMealSettings(userId, {
        setup_status: "asked_day",
        enabled: true,
        meals_per_week: frequency,
        ...(period ? { period } : {})
      });

      return buildFreeMealSetupPrompt("asked_day");
    }
  }

  if (status === "asked_day") {
    const days = parseFreeMealDays(message);
    const frequency = settings.meals_per_week || parseFreeMealFrequency(message) || 1;
    const period = parseFreeMealPeriod(message);

    if (
      days.length ||
      /\b(?:qualquer dia|dia variavel|varia|quando der|quando eu quiser)\b/.test(text)
    ) {
      if (period) {
        const saved = setFreeMealSettings(userId, {
          setup_status: "configured",
          enabled: true,
          meals_per_week: frequency,
          days,
          period
        });
        return `${formatFreeMealSettings(saved)}\n\nPerfeito. Vou levar isso em conta nas próximas sugestões.`;
      }

      setFreeMealSettings(userId, {
        setup_status: "asked_period",
        enabled: true,
        meals_per_week: frequency,
        days
      });
      return buildFreeMealSetupPrompt("asked_period");
    }
  }

  if (status === "asked_period") {
    const period = parseFreeMealPeriod(message);
    const frequency = settings.meals_per_week || 1;

    if (period) {
      const saved = setFreeMealSettings(userId, {
        setup_status: "configured",
        enabled: true,
        meals_per_week: frequency,
        days: settings.days || [],
        period
      });
      return `${formatFreeMealSettings(saved)}\n\nPerfeito. No dia da refeição livre, vou sugerir opções mais próximas do seu saldo e objetivo.`;
    }
  }

  if (status === "unknown" && explicitFreeMeal) {

    if (isExplicitFreeMealNegative(message)) {
      setFreeMealSettings(userId, {
        setup_status: "disabled",
        enabled: false,
        meals_per_week: 0,
        days: [],
        period: null
      });
      return "Tudo bem. Não vou considerar refeição livre na sua rotina. Você pode mudar isso depois.";
    }
    const frequency = parseFreeMealFrequency(message) || null;
    const days = parseFreeMealDays(message);
    const period = parseFreeMealPeriod(message);

    if (frequency && days.length && period) {
      const saved = setFreeMealSettings(userId, {
        setup_status: "configured",
        enabled: true,
        meals_per_week: frequency,
        days,
        period
      });
      return `${formatFreeMealSettings(saved)}\n\nVou usar essa rotina para personalizar suas sugestões.`;
    }

    if (frequency && days.length) {
      setFreeMealSettings(userId, {
        setup_status: "asked_period",
        enabled: true,
        meals_per_week: frequency,
        days
      });
      return buildFreeMealSetupPrompt("asked_period");
    }

    if (frequency) {
      setFreeMealSettings(userId, {
        setup_status: "asked_day",
        enabled: true,
        meals_per_week: frequency
      });
      return buildFreeMealSetupPrompt("asked_day");
    }

    setFreeMealSettings(userId, {
      setup_status: "asked_frequency",
      enabled: true
    });
    return buildFreeMealSetupPrompt("asked_frequency");
  }

  if (settings?.enabled && isFreeMealSettingsRequest(message)) {
    return formatFreeMealSettings(settings);
  }

  if (
    settings?.enabled &&
    (
      explicitFreeMeal ||
      (isTodayFreeMeal(settings) && wantsGenericMealSuggestion(message))
    )
  ) {
    const periods = getMealPeriods();
    const budgetPeriod = settings.period && periods.includes(settings.period)
      ? settings.period
      : periods.includes(currentPeriod)
        ? currentPeriod
        : "jantar";

    const index = periods.indexOf(budgetPeriod);
    const mealBudgetInfo = getMealBudget(
      dailySummary,
      budgetPeriod,
      periods.slice(Math.max(0, index))
    );

    const preferredCategories = [
      ...(Array.isArray(settings.preferences) ? settings.preferences : [])
    ].map((item) => normalizeRequestText(item));

    if (/\bpizza\b/.test(text)) preferredCategories.push("pizza");
    if (/\b(?:hamburguer|lanche|burger|cachorro-quente)\b/.test(text)) preferredCategories.push("lanche");
    if (/\b(?:japonesa|sushi|temaki|sashimi|nigiri|niguiri|hot roll|yakisoba|guioza)\b/.test(text)) preferredCategories.push("japonesa");
    if (/\b(?:sorvete|sobremesa|chocolate|brigadeiro|acai|açaí)\b/.test(text)) preferredCategories.push("sobremesa");

    if (explicitFreeMeal) {
      const learnedCategory = [
        ["pizza", /\bpizza\b/],
        ["lanche", /\b(?:hamburguer|lanche|burger|cachorro-quente)\b/],
        ["japonesa", /\b(?:japonesa|sushi|temaki|sashimi|nigiri|niguiri|hot roll|yakisoba|guioza)\b/],
        ["sobremesa", /\b(?:sorvete|sobremesa|chocolate|brigadeiro|acai|açaí)\b/],
        ["salgado", /\b(?:salgado|coxinha|pastel|esfiha|empada)\b/],
        ["massa", /\b(?:massa|macarr[aã]o|lasanha)\b/],
        ["comida brasileira", /\b(?:feijoada|comida brasileira|parmegiana|escondidinho)\b/]
      ].find(([, pattern]) => pattern.test(text))?.[0] || null;

      if (learnedCategory) {
        addFreeMealPreference(userId, learnedCategory);
      }
    }

    const options = generateFreeMealOptions({
      dailyCalorieTarget: dailySummary.calorie_target,
      dailyCaloriesRemaining: dailySummary.calorie_remaining,
      currentMealBudget: mealBudgetInfo.calories,
      preferences: settings.preferences || [],
      dislikes: getFoodRestrictions(user),
      preferredCategories,
      limit: 5
    });

    recordMealPlanEvent(userId, {
      plan_id: null,
      event_type: "suggestion_offered",
      meal_period: currentPeriod,
      details: {
        options,
        source: "free_meal_suggestion"
      }
    });

    return buildFreeMealSuggestionReply(
      options,
      settings,
      mealBudgetInfo.calories
    );
  }

  return null;
}

/* =========================================================
   PROCESSAR MENSAGEM
========================================================= */

export async function processMessage(
  userId,
  message,
  internal = {}
) {
  ensureUser(userId);

  const user =
    getUser(userId);

  const dailySummary =
    getDailySummary(
      userId
    );

  
  const freeMealSettings =
    getFreeMealSettings(
      userId
    );
const summaryIntent = classifySummaryIntent(message);

  if (
    internal.interpretedAction?.action === "summary" &&
    summaryIntent?.type === "specific"
  ) {
    return buildSpecificNutritionSummary(
      dailySummary,
      summaryIntent.metrics
    );
  }

  if (
    internal.interpretedAction?.action === "summary" &&
    summaryIntent?.type === "full"
  ) {
    return buildSummaryReply(
      dailySummary,
      user
    );
  }

  const recentHistory =
    getRecentHistory(
      userId,
      20
    );

  const todayMeals =
    getTodayMeals(
      userId
    );

  if (!internal.interpretedAction) {
    const deletionReply =
      handleMealDeletion(
        userId,
        message,
        todayMeals
      );

    if (deletionReply) {
      return deletionReply;
    }

    const clarificationReply =
      await handlePendingMealClarification(
        userId,
        message,
        internal
      );

    if (clarificationReply) {
      return clarificationReply;
    }
  }

  const currentPlan =
    getMealPlan(
      userId,
      dailySummary.date
    );

  const mealPlanHistory =
    getMealPlanHistory(
      userId,
      20
    );

  
  if (!internal.interpretedAction) {
    const freeMealReply = handleFreeMealConversation({
      userId,
      message,
      user,
      dailySummary,
      currentPeriod: getMealPeriod(),
      settings: freeMealSettings
    });

    if (freeMealReply) {
      return freeMealReply;
    }

    if (
      isExplicitMealReport(message) &&
      !isExplicitSelectionConfirmation(message) &&
      !hasExplicitMealCorrectionIntent(message)
    ) {
      const estimatedMeal = estimateMealFromText(message);

      if (estimatedMeal?.needs_clarification) {
        return askMealClarification(userId, message, estimatedMeal);
      }

      const quantityQuestions =
        estimatedMeal && !internal.acceptDefaultQuantities
          ? getQuantityQuestions(message)
          : [];

      if (quantityQuestions.length) {
        return askMealQuantities(userId, message, quantityQuestions);
      }

      if (estimatedMeal) {
        return processMessage(
          userId,
          message,
          {
            interpretedAction: {
              action: "meal",
              data: {
                description: estimatedMeal.description,
                calories: estimatedMeal.calories,
                protein_g: estimatedMeal.protein_g,
                carbs_g: estimatedMeal.carbs_g,
                fat_g: estimatedMeal.fat_g,
                meal_period: getMealPeriod()
              }
            }
          }
        );
      }
    }
  }

  const latestSelectionForConfirmation =
    !internal.interpretedAction
      ? mealPlanHistory.find(
          (event) =>
            event.event_type ===
              "option_chosen" &&
            String(
              event.created_at || ""
            ).startsWith(
              dailySummary.date
            )
        )
      : null;

  if (
    !internal.interpretedAction &&
    isExplicitSelectionConfirmation(
      message
    ) &&
    latestSelectionForConfirmation
  ) {
    return processMessage(
      userId,
      message,
      {
        interpretedAction: {
          action: "meal_consumed",
          data: {
            meal_period:
              latestSelectionForConfirmation.meal_period ||
              getMealPeriod(),

            selection_event_id:
              latestSelectionForConfirmation.id
          }
        }
      }
    );
  }const context =
    buildContext(
      user,
      dailySummary,
      recentHistory,
      todayMeals,
      currentPlan,
      mealPlanHistory,
      freeMealSettings
    );

  if (
    !internal.interpretedAction &&
    isHistoryRequest(message)
  ) {
    return buildHistoryReply(
      recentHistory
    );
  }

  /*
   * =======================================================
   * FATOS EXPLÍCITOS DA MENSAGEM
   *
   * A mensagem original é a fonte de verdade para restrições
   * declaradas pelo usuário.
   *
   * O modelo pode interpretar a intenção, mas não pode
   * contradizer fatos explícitos como:
   *
   * "tenho whey"
   * "não tenho whey"
   * "não quero whey com água"
   * "quero algo rápido"
   * "só tenho banana e iogurte"
   *
   * =======================================================
   */

  const explicitMealFacts =
    buildExplicitMealRequestFacts(
      message
    );

  /*
   * Declaracoes de disponibilidade/preferencia nao sao pedidos
   * de sugestao de refeicao.
   *
   * Exemplo:
   * "Tenho whey em casa, mas nao quero tomar com agua."
   *
   * Deve:
   * - manter whey como disponivel;
   * - registrar whey + agua como composicao rejeitada;
   * - nao calcular orcamento calorico;
   * - nao gerar meal_suggestion.
   */
  const hasExplicitFoodPreference =
    explicitMealFacts.availableFoods.length > 0 ||
    explicitMealFacts.explicitExcludedFoods.length > 0 ||
    explicitMealFacts.explicitExcludedCompositions.length > 0;

  const isPreferenceOnlyMessage =
    hasExplicitFoodPreference &&
    explicitMealFacts.quickOnly !== true &&
    explicitMealFacts.moreOptions !== true &&
    !explicitMealFacts.desiredFood &&
    !isExplicitMealReport(message) &&
    !isExplicitSelectionConfirmation(message);

  if (isPreferenceOnlyMessage) {
    const wheyAvailability =
      detectWheyAvailability(message);

    if (wheyAvailability !== null) {
      recordMealPlanEvent(userId, {
        event_type: "food_availability",
        details: {
          food: "whey",
          available: wheyAvailability
        }
      });
    }

    for (const composition of explicitMealFacts.explicitExcludedCompositions) {
      recordMealPlanEvent(userId, {
        event_type: "food_composition_exclusion",
        details: composition
      });
    }

    if (
      explicitMealFacts.explicitExcludedCompositions.length > 0
    ) {
      return buildCompositionExclusionReply(
        explicitMealFacts.explicitExcludedCompositions,
        wheyAvailability
      );
    }

    const ambiguousComposition =
      detectAmbiguousCompositionExclusion(message);

    if (ambiguousComposition) {
      return buildAmbiguousCompositionQuestion(
        ambiguousComposition
      );
    }

    if (wheyAvailability === true) {
      return "Entendi. Vou considerar o whey como disponivel.";
    }

    if (wheyAvailability === false) {
      return "Entendi. Vou considerar que voce nao tem whey disponivel no momento.";
    }

    return "Entendi e vou considerar essa preferencia nas proximas sugestoes.";
  }

  if (!internal.interpretedAction) {
    const registry =
      createAgentToolRegistry({
        executeAction: (
          action,
          data,
          intentFlags = {}
        ) => {
          /*
           * =================================================
           * PROTEÇÕES DE AÇÕES
           * =================================================
           */

          if (
            action === "profile" &&
            !hasExplicitProfileUpdateIntent(
              message
            )
          ) {
            return "Não alterei o perfil porque a mensagem não informou uma atualização explícita.";
          }

          if (
            action === "set_calorie_target" &&
            !hasExplicitTargetUpdate(
              message,
              {
                calories:
                  data.calories
              }
            )
          ) {
            return "Não alterei sua meta: confirme uma nova meta calórica com o valor desejado.";
          }

          if (
            action === "set_macro_targets" &&
            !hasExplicitTargetUpdate(
              message,
              data
            )
          ) {
            return "Não alterei suas metas de macros: informe explicitamente cada macro e o valor desejado.";
          }

          const normalizedMessage =
            normalizeRequestText(
              message
            );

          if (
            action === "reset_nutrition_targets" &&
            (
              !/\b(?:restaure|restaurar|recalcule|recalcular|volte|voltar)\b/.test(
                normalizedMessage
              ) ||
              !/\b(?:meta|metas|calorias|calorica|macros|automaticas?)\b/.test(
                normalizedMessage
              )
            )
          ) {
            return "Só restauro as metas automáticas quando você pedir explicitamente.";
          }

          if (
            action === "meal_plan" &&
            !hasExplicitPlanCreationIntent(
              message
            )
          ) {
            return "Não criei um plano porque não houve um pedido explícito para montar um.";
          }

          const latestPlanEvent =
            currentPlan
              ? mealPlanHistory.find(
                  (event) =>
                    event.plan_id ===
                    currentPlan.id
                )
              : null;

          const pendingPlanDecision =
            currentPlan?.status === "proposed" &&
            latestPlanEvent?.event_type ===
              "plan_proposed";

          if (
            (
              action === "meal_plan_intent" ||
              action === "meal_plan_decline"
            ) &&
            !hasExplicitPlanFollowIntent(
              message,
              action === "meal_plan_intent",
              pendingPlanDecision
            )
          ) {
            return "Não alterei a intenção do plano. Diga explicitamente se pretende segui-lo.";
          }

          if (
            action === "meal_choice" &&
            !isExplicitOptionChoice(
              message,
              data.option_index
            )
          ) {
            return "Diga o número da opção que escolheu. Ainda não registrei nenhuma escolha.";
          }

          if (
            action === "meal_correction" &&
            !hasExplicitMealCorrectionIntent(
              message
            )
          ) {
            return "Só corrijo uma refeição quando você pedir explicitamente uma correção. Não alterei o registro.";
          }

          if (
            action === "meal_correction"
          ) {
            const existing =
              todayMeals.find(
                (meal) =>
                  meal.id ===
                  Number(data.meal_id)
              );

            if (!existing) {
              return "Não encontrei esse registro de refeição hoje; não alterei nenhum dado.";
            }

            if (
              !hasMatchingProvidedNutrition(
                message,
                {
                  calories:
                    data.calories,

                  protein_g:
                    data.protein_g,

                  carbs_g:
                    data.carbs_g,

                  fat_g:
                    data.fat_g
                }
              )
            ) {
              return "Não apliquei a correção porque os valores nutricionais não correspondem aos números informados na mensagem. Envie os valores corretos; mantive o registro como estava.";
            }
          }

          if (
            action === "meal_consumed" &&
            !isExplicitSelectionConfirmation(
              message
            )
          ) {
            return "A escolha só pode ser registrada como consumo após uma confirmação clara de que você comeu. Não registrei nada.";
          }

          if (
            action === "meal" &&
            !isExplicitMealReport(
              message
            )
          ) {
            return "Só registro uma refeição quando você confirmar que já consumiu. Não registrei nada.";
          }

          if (
            action === "meal" &&
            !isExplicitSelectionConfirmation(
              message
            ) &&
            !hasMatchingExplicitMealNutrition(
              message,
              data
            )
          ) {
            const estimatedMeal = estimateMealFromText(message);

            if (!estimatedMeal) {
              return "Para registrar essa refeição diretamente, preciso de uma descrição que eu consiga estimar com segurança ou dos valores informados de calorias, proteínas, carboidratos e gorduras. Não registrei a refeição.";
            }

            if (estimatedMeal.needs_clarification) {
              return askMealClarification(userId, message, estimatedMeal);
            }

            const quantityQuestions =
              internal.acceptDefaultQuantities
                ? []
                : getQuantityQuestions(message);

            if (quantityQuestions.length) {
              return askMealQuantities(userId, message, quantityQuestions);
            }

            data = {
              ...data,
              description: estimatedMeal.description,
              calories: estimatedMeal.calories,
              protein_g: estimatedMeal.protein_g,
              carbs_g: estimatedMeal.carbs_g,
              fat_g: estimatedMeal.fat_g
            };
          }

          return processMessage(
            userId,
            message,
            {
              interpretedAction: {
                action,
                data
              },

              intentFlags
            }
          );
        },

        readMemory: (
          scope
        ) => {
          if (
            scope === "profile"
          ) {
            return {
              profile:
                context.profile,

              preferences:
                context.preferences
            };
          }

          if (
            scope === "history"
          ) {
            return context.history;
          }

          return {
            ok: false,
            error:
              "memory_scope_not_found"
          };
        },

        updateAvailability: ({
          food,
          available
        }) => {
          if (
            food !== "whey" ||
            detectWheyAvailability(
              message
            ) !== available
          ) {
            return {
              ok: false,
              error:
                "availability_not_explicitly_confirmed"
            };
          }

          const event =
            recordMealPlanEvent(
              userId,
              {
                event_type:
                  "food_availability",

                details: {
                  food,
                  available
                }
              }
            );

          return {
            ok: true,
            food,
            available,
            event_id: event.id,
            scope: "today"
          };
        },

        /*
         * Os fatos explícitos são entregues ao registry para
         * que o resultado produzido pelo modelo seja mesclado
         * com as informações determinísticas da mensagem.
         */
        explicitMealFacts
      });

    return runAgent({
      message,
      context,
      registry,
      // Só os testes passam um cliente simulado; em produção é undefined.
      apiClient: internal.apiClient
    });
  }

  const result =
    normalizeAIResult(
      internal.interpretedAction
    );

  /*
   * =======================================================
   * MESCLAGEM DE FATOS EXPLÍCITOS
   *
   * O modelo continua responsável por interpretar a intenção,
   * mas fatos explícitos da mensagem têm precedência.
   * =======================================================
   */

  if (
    result.action === "meal_suggestion"
  ) {
    result.data =
      mergeExplicitMealSuggestionData(
        result.data,
        explicitMealFacts
      );
  }

  /*
   * "quick_only" só pode ser verdadeiro quando:
   *
   * 1. o usuário pediu explicitamente preparo rápido; ou
   * 2. uma ação interna já trouxe esse sinal explicitamente.
   *
   * O modelo não deve transformar uma refeição qualquer em
   * "preparo rápido" por conta própria.
   */
  const structuredQuickOnly =
    typeof result.data?.quick_only === "boolean"
      ? result.data.quick_only
      : internal.intentFlags?.quick_only;

  const quickPreparationRequest =
    explicitMealFacts.quickOnly === true
      ? true
      : structuredQuickOnly === true
        ? true
        : false;

  if (
    quickPreparationRequest
  ) {
    result.action =
      "meal_suggestion";
  }

  const currentPeriod =
    normalizeMealPeriod(
      result.data?.meal_period,
      explicitMealFacts.mealPeriod ||
        getMealPeriod()
    );

  const availableFoods =
    result.action === "meal_suggestion"
      ? getStructuredOrLegacyFoods(
          result.data,
          "available_foods",
          message
        )
      : extractAvailableFoods(
          message
        );

  if (
    result.action === "meal_suggestion"
  ) {
    if (
      dailySummary.calorie_target ===
      null
    ) {
      return "Ainda não tenho uma meta diária de calorias para calcular um orçamento seguro para a sugestão. Complete seu perfil ou informe sua meta.";
    }

    const remainingMealPeriods =
      getMealPeriods().slice(
        getMealPeriods().indexOf(
          currentPeriod
        )
      );

    const preserveBudgetForFuture =
      result.data.preserve_budget_for_future ===
        true;

    const requestedFutureMealPeriod =
      result.data.future_meal_period
        ? normalizeMealPeriod(
            result.data.future_meal_period,
            currentPeriod
          )
        : null;

    const futureMealPeriod =
      requestedFutureMealPeriod !==
        currentPeriod &&
      remainingMealPeriods.includes(
        requestedFutureMealPeriod
      )
        ? requestedFutureMealPeriod
        : null;

    const mealBudget =
      getMealBudget(
        dailySummary,
        currentPeriod,
        remainingMealPeriods,
        {
          preserveBudgetForFuture,
          futureMealPeriod
        }
      );

    const budgetAnalysis =
      analyzeRemainingNutritionBudget(
        dailySummary
      );

    const macroPriority =
      budgetAnalysis.priority ===
      "protein"
        ? "protein"
        : null;

    const plannedMeal =
      currentPlan?.plan?.meals?.find(
        (meal) =>
          meal.period ===
          currentPeriod
      );

    const macroBudget =
      mealBudget.macro_budget;

    const wheyAvailability =
      getLatestMealPlanEvent(
        userId,
        "food_availability",
        null,
        dailySummary.date
      )?.details;

    const explicitExcludedFoods =
      Array.isArray(
        result.data.explicit_excluded_foods
      )
        ? normalizeToolFoodList(
            result.data
              .explicit_excluded_foods
          )
        : explicitMealFacts
            .explicitExcludedFoods;

    const storedExcludedCompositions = mealPlanHistory
      .filter((event) =>
        event.event_type === "food_composition_exclusion" &&
        event.details &&
        Array.isArray(event.details.ingredients)
      )
      .map((event) => event.details);

    const explicitExcludedCompositions = [
      ...(Array.isArray(result.data?.explicit_excluded_compositions)
        ? result.data.explicit_excluded_compositions
        : []),
      ...explicitMealFacts.explicitExcludedCompositions,
      ...storedExcludedCompositions
    ].filter((composition, index, list) => {
      const key = Array.isArray(composition?.ingredients)
        ? composition.ingredients.map(String).sort().join("|")
        : "";

      return key && index === list.findIndex((item) => {
        const otherKey = Array.isArray(item?.ingredients)
          ? item.ingredients.map(String).sort().join("|")
          : "";

        return otherKey === key;
      });
    });

    const requiredFoods =
      normalizeToolFoodList(
        result.data.required_foods
      );

    const explicitOnlyAvailable =
      result.data.only_available_foods ===
      true;

    /*
     * Disponibilidade declarada explicitamente pelo usuário
     * tem precedência sobre uma interpretação incompleta
     * do modelo.
     */
    if (
      explicitMealFacts.availableFoods.includes(
        "whey"
      ) &&
      !availableFoods.includes(
        "whey"
      ) &&
      !explicitExcludedFoods.includes(
        "whey"
      )
    ) {
      availableFoods.push(
        "whey"
      );
    }

    if (
      wheyAvailability?.food ===
        "whey" &&
      wheyAvailability.available ===
        true &&
      !availableFoods.includes(
        "whey"
      ) &&
      !explicitExcludedFoods.includes(
        "whey"
      )
    ) {
      availableFoods.push(
        "whey"
      );
    }

    /*
     * O alimento desejado deve vir da mensagem explícita quando
     * existir. A interpretação do modelo é apenas fallback.
     */
    /*
     * desired_food só pode assumir uma categoria reconhecida
     * pelo catálogo de alimentos desejados.
     *
     * Isso impede que o modelo transforme alimentos comuns,
     * como whey, frango ou arroz, em cravings.
     */
    const desiredFood =
      explicitMealFacts.desiredFood ||
      detectDesiredFood(
        message,
        result.data.desired_food
      );

    if (
      desiredFood
    ) {
      if (
        hasDesiredFoodAvailable(
          message,
          desiredFood
        ) &&
        !availableFoods.includes(
          desiredFood
        )
      ) {
        availableFoods.push(
          desiredFood
        );
      }

      const restrictions = [
        ...getFoodRestrictions(user),
        ...explicitExcludedFoods
      ].map(
        (item) =>
          String(
            item
          ).toLocaleLowerCase(
            "pt-BR"
          )
      );

      if (
        restrictions.some(
          (item) =>
            restrictionBlocksDesiredFood(
              item,
              desiredFood
            )
        )
      ) {
        return `Entendi que você quer ${desiredFood}, mas esse alimento consta como rejeitado/restrito no seu perfil ou nesta conversa. Não vou sugeri-lo. Se a restrição não se aplica mais, atualize sua preferência e tento encaixá-lo.`;
      }

      const desiredOptions =
        generateDesiredFoodOptions({
          desiredFood,

          calorieBudget:
            mealBudget.calories,

          macroBudget,

          macroPriority,

          dailyCalorieBudget:
            budgetAnalysis
              .calorie_remaining,

          dailyMacroBudget: {
            protein_g:
              budgetAnalysis
                .macro_remaining
                .protein_g,

            carbs_g:
              budgetAnalysis
                .macro_remaining
                .carbs_g,

            fat_g:
              budgetAnalysis
                .macro_remaining
                .fat_g
          },

          dislikes:
            restrictions,

          availableFoods,

          availabilityOnly:
            explicitOnlyAvailable,

          requestedServings:
            explicitMealFacts
              .requestedServings ??
            detectRequestedServings(
              message,
              desiredFood,
              result.data
                .requested_servings
            ),

          requestedGrams:
            detectRequestedGrams(
              message
            ),

          japaneseSubtype:
            desiredFood === "japonesa"
              ? detectRequestedJapaneseSubtype(message)
              : null,

          fillings:
            desiredFood === "japonesa"
              ? findFoodNames(message, JAPANESE_FILLINGS)
              : [],

          preferredComposition:
            detectDesiredComposition(
              message,
              desiredFood
            ),

          recentOptions:
            getRecentSuggestedOptions(
              mealPlanHistory
            ),

          excludeRecentOptions:
            explicitMealFacts.moreOptions ===
              true ||
            result.data.more_options ===
              true,

          limit: 3
        });

      if (
        desiredOptions ===
        null
      ) {
        return `Ainda não tenho uma referência nutricional confiável para ${result.data.desired_food || desiredFood}. Envie a porção e os dados do rótulo/cardápio ou os ingredientes para eu calcular o encaixe sem inventar valores.`;
      }

      const offer =
        recordMealPlanEvent(
          userId,
          {
            plan_id:
              currentPlan?.id ??
              null,

            event_type:
              "suggestion_offered",

            meal_period:
              currentPeriod,

            option_index:
              null,

            details: {
              options:
                desiredOptions,

              source:
                "desired_food_suggestion",

              desired_food:
                desiredFood
            }
          }
        );

      const overageIndex =
        desiredOptions.findIndex(
          (option) =>
            option.explicit_overage
        );

      if (
        explicitlyAcceptsOverage(
          message
        ) &&
        overageIndex >= 0
      ) {
        const option =
          desiredOptions[
            overageIndex
          ];

        recordMealPlanEvent(
          userId,
          {
            plan_id:
              currentPlan?.id ??
              null,

            event_type:
              "option_chosen",

            meal_period:
              currentPeriod,

            option_index:
              overageIndex + 1,

            details: {
              option,

              source:
                "desired_food_suggestion",

              offer_event_id:
                offer.id
            }
          }
        );

        return buildMealProjectionReply(
          {
            data:
              option
          },
          dailySummary,
          budgetAnalysis
        );
      }

      return buildDesiredFoodReply(
        desiredOptions,
        desiredFood,
        mealBudget.calories,
        budgetAnalysis,
        {
          availabilityOnly:
            explicitOnlyAvailable,

          summary:
            dailySummary
        }
      );
    }

    const suggestionDislikes = [
      ...getFoodRestrictions(user),
      ...explicitExcludedFoods
    ];

    if (
      wheyAvailability?.food ===
        "whey" &&
      wheyAvailability.available ===
        false &&
      !availableFoods.includes(
        "whey"
      ) &&
      !suggestionDislikes.includes(
        "whey"
      )
    ) {
      suggestionDislikes.push(
        "whey"
      );
    }

    const recentOptions =
      getRecentSuggestedOptions(
        mealPlanHistory
      );

    const recentByCategory =
      quickPreparationRequest
        ? recentOptions.filter(
            (option) =>
              isActuallyQuickOption(
                option
              )
          )
        : recentOptions;

    const options =
      generateMealOptions({
        mealPeriod:
          currentPeriod,

        calorieBudget:
          mealBudget.calories,

        macroBudget,

        macroPriority,

        dislikes:
          suggestionDislikes,

        availableFoods,

        recentOptions:
          recentByCategory,

        additionalOptions:
          budgetAnalysis.incompatible
            ? []
            : (
                plannedMeal?.options ||
                []
              ),

        requiredFoods,

        excludedCompositions:
          explicitExcludedCompositions,

        onlyAvailableFoods:
          explicitOnlyAvailable,

        preferSmaller:
          preserveBudgetForFuture,

        quickOnly:
          quickPreparationRequest,

        excludeRecentOptions:
          explicitMealFacts.moreOptions ===
            true ||
          result.data.more_options ===
            true
            ? true
            : false
      });

    if (
      !options.length
    ) {
      const explanation =
        quickPreparationRequest
          ? "Não encontrei uma opção de preparo rápido que passe pelas validações e restrições atuais. "
          : budgetAnalysis.incompatible
            ? `Restam ${Math.round(budgetAnalysis.calorie_remaining)} kcal no dia, mas os macros restantes exigiriam cerca de ${Math.round(budgetAnalysis.macro_calorie_requirement_kcal)} kcal. ${budgetAnalysis.priority === "protein" ? "Vou manter o limite calórico e priorizar proteína. " : "Vou manter o limite calórico e não aumentar macros já atingidos. "}`
            : mealBudget.calories <
                120
              ? `O orçamento desta refeição é de aproximadamente ${Math.round(mealBudget.calories)} kcal, insuficiente para uma porção prática. `
              : "Com as restrições e o orçamento atuais, ";

      return `${explanation}${buildMealSuggestionReply([], budgetAnalysis)}`;
    }

    recordMealPlanEvent(
      userId,
      {
        plan_id:
          currentPlan?.id ??
          null,

        event_type:
          "suggestion_offered",

        meal_period:
          currentPeriod,

        option_index:
          null,

        details: {
          options,

          source:
            currentPlan
              ? "daily_plan"
              : "meal_suggestion",

          suggestion_context: {
            available_foods:
              availableFoods,

            required_foods:
              requiredFoods,

            explicit_excluded_foods:
              explicitExcludedFoods,

            explicit_excluded_compositions:
              explicitExcludedCompositions,

            only_available_foods:
              explicitOnlyAvailable,

            quick_only:
              quickPreparationRequest,

            preserve_budget_for_future:
              preserveBudgetForFuture,

            future_meal_period:
              futureMealPeriod,

            future_meal_reserved_calories:
              mealBudget
                .future_meal_reserved_calories
          }
        }
      }
    );

    const reply =
      buildMealSuggestionReply(
        options,
        budgetAnalysis
      );

    return preserveBudgetForFuture
      ? `Como você quer preservar parte do orçamento para ${futureMealPeriod || "uma refeição posterior"}, priorizei opções mais moderadas para agora.\n\n${reply}`
      : reply;
  }
  if (result.action === "meal_plan") {
    if (dailySummary.calorie_target === null) {
      return "Para montar um plano distribuído ao longo do dia, preciso primeiro da sua meta diária. Complete seu perfil ou informe sua meta de calorias.";
    }

    const plan = buildDailyMealPlan({
      summary: dailySummary,
      currentPeriod,

      // explicitExcludedFoods só existe no bloco de sugestões; aqui as exclusões
      // vêm dos fatos explícitos da própria mensagem.
      dislikes: [
        ...getFoodRestrictions(user),
        ...explicitMealFacts.explicitExcludedFoods
      ],

      availableFoods,

      date:
        dailySummary.date
    });

    const savedPlan =
      saveMealPlan(
        userId,
        plan
      );

    recordMealPlanEvent(
      userId,
      {
        plan_id:
          savedPlan.id,

        event_type:
          "plan_proposed",

        details: {
          valid:
            plan.valid
        }
      }
    );

    return formatPlanReply(
      plan
    );
  }

  if (
    result.action ===
    "meal_plan_get"
  ) {
    return currentPlan
      ? formatPlanReply(
          currentPlan.plan
        )
      : "Ainda não há um plano alimentar salvo para hoje. Quer que eu monte um agora?";
  }

  if (
    result.action ===
      "meal_plan_intent" ||
    result.action ===
      "meal_plan_decline"
  ) {
    if (!currentPlan) {
      return "Ainda não há um plano salvo para hoje. Quer que eu monte um?";
    }

    const status =
      result.action ===
      "meal_plan_intent"
        ? "intended"
        : "declined";

    updateMealPlanStatus(
      userId,
      dailySummary.date,
      status
    );

    recordMealPlanEvent(
      userId,
      {
        plan_id:
          currentPlan.id,

        event_type:
          status === "intended"
            ? "plan_intended"
            : "plan_declined"
      }
    );

    return status ===
      "intended"
      ? "Combinado! Vou usar o plano como referência. A escolha de uma opção ainda não registra consumo; me confirme quando comer."
      : "Tudo bem — não vou tratar o plano como consumo. Posso montar outro mais adequado à sua rotina ou ao que você tem disponível.";
  }

  if (
    result.action ===
    "meal_choice"
  ) {
    const period =
      normalizeMealPeriod(
        result.data.meal_period,
        currentPeriod
      );

    const meal =
      currentPlan?.plan?.meals?.find(
        (item) =>
          item.period ===
          period
      );

    const optionIndex =
      Number(
        result.data.option_index
      );

    const offer =
      getLatestMealPlanEvent(
        userId,
        "suggestion_offered",
        period,
        dailySummary.date
      );

    const latestPlanProposal =
      currentPlan
        ? mealPlanHistory.find(
            (event) =>
              event.event_type ===
                "plan_proposed" &&
              event.plan_id ===
                currentPlan.id
          )
        : null;

    const useLatestOffer =
      Boolean(
        offer &&
        (
          !meal?.options?.length ||
          !latestPlanProposal ||
          offer.id >
            latestPlanProposal.id
        )
      );

    const suggestedOptions =
      Array.isArray(
        offer?.details?.options
      )
        ? offer.details.options
        : [];

    const suggested =
      useLatestOffer
        ? (
            suggestedOptions[
              optionIndex - 1
            ] ??
            (
              optionIndex === 1
                ? offer?.details?.option ??
                  null
                : null
            )
          )
        : null;

    const option =
      suggested ??
      meal?.options?.[
        optionIndex - 1
      ];

    const mealBudget =
      getMealBudget(
        dailySummary,
        period,
        getMealPeriods().slice(
          getMealPeriods().indexOf(
            period
          )
        )
      );

    const budgetAnalysis =
      analyzeRemainingNutritionBudget(
        dailySummary
      );

    const macroPriority =
      budgetAnalysis.priority ===
      "protein"
        ? "protein"
        : null;

    const calorieBudget =
      mealBudget.calories;

    const macroBudget =
      mealBudget.macro_budget;

    const explicitOverage =
      option?.explicit_overage ===
      true;

    if (
      !option ||
      !validateMealOption(
        option,
        explicitOverage
          ? null
          : calorieBudget,
        explicitOverage
          ? {}
          : macroBudget,
        {
          macroPriority:
            explicitOverage
              ? null
              : macroPriority
        }
      ).valid
    ) {
      return `Não encontrei essa opção em ${period}. Qual número da opção você escolheu?`;
    }

    recordMealPlanEvent(
      userId,
      {
        plan_id:
          currentPlan?.id ??
          null,

        event_type:
          "option_chosen",

        meal_period:
          period,

        option_index:
          optionIndex,

        details: {
          option,

          source:
            suggested
              ? "meal_suggestion"
              : "daily_plan",

          ...(offer && {
            offer_event_id:
              offer.id
          })
        }
      }
    );

    return buildMealProjectionReply(
      {
        data:
          option
      },
      dailySummary,
      budgetAnalysis
    );
  }

  if (
    result.action ===
      "meal_consumed" ||
    (
      result.action ===
        "meal" &&
      isExplicitSelectionConfirmation(
        message
      )
    )
  ) {
    const period =
      normalizeMealPeriod(
        result.data.meal_period,
        currentPeriod
      );

    const currentDayEvents =
      mealPlanHistory.filter(
        (event) =>
          String(
            event.created_at || ""
          ).startsWith(
            dailySummary.date
          ) &&
          (
            !event.meal_period ||
            event.meal_period ===
              period
          )
      );

    const requestedSelection =
      currentDayEvents.find(
        (event) =>
          event.id ===
            result.data
              .selection_event_id &&
          event.event_type ===
            "option_chosen"
      );

    const latestChoice =
      currentDayEvents.find(
        (event) =>
          event.event_type ===
          "option_chosen"
      );

    const latestOffer =
      currentDayEvents.find(
        (event) =>
          event.event_type ===
          "suggestion_offered"
      );

    const selectedEvent =
      requestedSelection ??
      (
        latestChoice &&
        (
          !latestOffer ||
          latestChoice.id >
            latestOffer.id
        )
          ? latestChoice
          : null
      );

    if (
      Array.isArray(
        latestOffer?.details?.options
      ) &&
      latestOffer.details.options
        .length &&
      !selectedEvent
    ) {
      return "Escolha primeiro o número de uma das opções. Não registrei consumo; depois da escolha, confirme quando tiver comido.";
    }

    const consumption =
      consumeMealSelection(
        userId,
        {
          selectionEventId:
            selectedEvent?.id ??
            result.data
              .selection_event_id,

          mealPeriod:
            period,

          date:
            dailySummary.date
        }
      );

    if (!consumption) {
      if (
        result.action ===
        "meal_consumed"
      ) {
        return "Não encontrei uma opção escolhida para registrar. Diga qual refeição você comeu e eu registro o consumo real.";
      }

      return "Não encontrei uma opção escolhida para confirmar como consumida. Se você comeu outra refeição, descreva o que consumiu e eu registro isso separadamente.";
    }

    if (
      consumption.alreadyConsumed
    ) {
      return `Essa opção (${consumption.selection.details.option.name}) já estava registrada como consumida; não registrei novamente.`;
    }

    updateMealPlanStatus(
      userId,
      dailySummary.date,
      "in_progress"
    );

    return `✅ Registrei como consumida: ${consumption.selection.details.option.name} (${consumption.selection.details.option.calories} kcal estimadas). ID da refeição: ${consumption.meal.id}.`;
  }

  if (
    result.action ===
    "meal_correction"
  ) {
    const before =
      todayMeals.find(
        (meal) =>
          meal.id ===
          result.data.meal_id
      );

    if (!before) {
      return "Não consegui identificar com segurança qual refeição de hoje corrigir. Confira o ID no resumo ou me diga a descrição e o horário.";
    }

    result.data = {
      ...result.data,

      description:
        result.data.description ||
        before.description,

      calories:
        result.data.calories ??
        before.calories,

      protein_g:
        result.data.protein_g ??
        before.protein_g,

      carbs_g:
        result.data.carbs_g ??
        before.carbs_g,

      fat_g:
        result.data.fat_g ??
        before.fat_g
    };

    const correctionCheck =
      validateMealRecord(
        result.data
      );

    if (!correctionCheck.valid) {
      return buildInvalidMealReply(
        correctionCheck.errors,
        "Não apliquei a correção"
      );
    }

    const corrected =
      saveAction(
        userId,
        result
      );

    if (!corrected) {
      return "Não encontrei esse registro para corrigir.";
    }

    recordMealPlanEvent(
      userId,
      {
        event_type:
          "meal_corrected",

        meal_period:
          before.meal_period,

        meal_id:
          corrected.id,

        details: {
          before,
          after:
            corrected
        }
      }
    );

    return `✏️ Corrigi a refeição #${corrected.id} sem criar outro registro. O resumo do dia já considera os valores atualizados.`;
  }

  if (
    result.action ===
    "meal"
  ) {
    result.data.meal_period =
      currentPeriod;

    if (
      currentPlan
    ) {
      result.data.plan_id =
        currentPlan.id;
    }

    const mealCheck =
      validateMealRecord(
        result.data
      );

    if (!mealCheck.valid) {
      return buildInvalidMealReply(
        mealCheck.errors,
        "Não registrei a refeição"
      );
    }

    const duplicate =
      !isExplicitRepeatMeal(message) &&
      findRecentDuplicateMeal(
        userId,
        result.data
      );

    if (duplicate) {
      return `Essa refeição já está registrada (${describeMealForReply(duplicate)}), então não gravei de novo. Se você comeu outra vez, diga por exemplo "comi de novo ${duplicate.description.replace(/^\s*comi\s+/i, "")}".`;
    }
  }

  const saved =
    saveAction(
      userId,
      result
    );

  if (
    result.action ===
      "meal" &&
    saved
  ) {
    const choice =
      getLatestMealPlanEvent(
        userId,
        "option_chosen",
        currentPeriod,
        dailySummary.date
      );

    const offer =
      getLatestMealPlanEvent(
        userId,
        "suggestion_offered",
        currentPeriod,
        dailySummary.date
      );

    const chosenName =
      choice?.details?.option?.name ||
      offer?.details?.option?.name;

    const followed =
      chosenName &&
      chosenName.toLocaleLowerCase(
        "pt-BR"
      ) ===
        String(
          saved.description
        ).toLocaleLowerCase(
          "pt-BR"
        );

    if (
      currentPlan ||
      offer
    ) {
      recordMealPlanEvent(
        userId,
        {
          plan_id:
            currentPlan?.id ??
            offer?.plan_id ??
            null,

          event_type:
            currentPlan
              ? (
                  followed
                    ? "plan_followed"
                    : "plan_adapted"
                )
              : (
                  followed
                    ? "suggestion_followed"
                    : "suggestion_not_followed"
                ),

          meal_period:
            currentPeriod,

          option_index:
            followed
              ? (
                  choice?.option_index ??
                  offer?.option_index ??
                  null
                )
              : null,

          meal_id:
            saved.id,

          details: {
            description:
              saved.description
          }
        }
      );

      if (
        currentPlan &&
        !followed
      ) {
        updateMealPlanStatus(
          userId,
          dailySummary.date,
          "adapted"
        );
      }
    }

    return `✅ Registrei: ${saved.description} — ${Math.round(saved.calories)} kcal, ${Number(saved.protein_g)} g de proteína, ${Number(saved.carbs_g)} g de carboidratos e ${Number(saved.fat_g)} g de gorduras. ID da refeição: ${saved.id}.`;
  }

  if (
    result.action ===
      "set_calorie_target" ||
    result.action ===
      "set_macro_targets"
  ) {
    const updated =
      saved?.user;

    if (!updated) {
      return result.action === "set_calorie_target"
        ? "Não alterei sua meta de calorias: o valor precisa ser maior que zero e plausível (até 10.000 kcal por dia). Sua meta anterior continua valendo."
        : "Não alterei suas metas de macros: cada valor precisa ser zero ou positivo e plausível (até 1.000 g por dia). As metas anteriores continuam valendo.";
    }

    const balance =
      calculateNutritionBalance({
        calorie_target:
          updated?.daily_calorie_target,

        protein_target:
          updated?.daily_protein_target,

        carbs_target:
          updated?.daily_carbs_target,

        fat_target:
          updated?.daily_fat_target
      });

    if (
      balance.macros_compatible ===
      false
    ) {
      return `${result.reply || "Meta personalizada salva."}\n\n⚠️ As metas atuais de calorias e macros são matematicamente incompatíveis (${Math.round(balance.macro_calorie_total)} kcal pelos macros para uma meta de ${Math.round(updated.daily_calorie_target)} kcal). Mantive os valores escolhidos sem ajustá-los silenciosamente.`;
    }
  }

  /* -------------------------------------------------------
     Perfil completo
  ------------------------------------------------------- */

  if (
    result.action ===
      "profile" &&
    saved?.targets
  ) {
    let reply = buildProfileReply(
      saved.user,
      saved.targets
    );

    const currentFreeMealSettings =
      getFreeMealSettings(
        userId
      );

    if (currentFreeMealSettings.setup_status === "unknown") {
      setFreeMealSettings(
        userId,
        {
          setup_status: "asked"
        }
      );

      reply += `\n\n${buildFreeMealSetupPrompt("asked")}`;
    }

    return reply;
  }

  if (
    result.action ===
    "reset_nutrition_targets"
  ) {
    if (
      !saved?.targets
    ) {
      return "Ainda faltam dados no perfil para recalcular suas metas. Complete os dados de idade, sexo, altura, peso, objetivo e nível de atividade.";
    }

    return buildProfileReply(
      saved.user,
      saved.targets
    );
  }

  /* -------------------------------------------------------
     Resumo
  ------------------------------------------------------- */

  if (
    result.action ===
    "summary"
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
