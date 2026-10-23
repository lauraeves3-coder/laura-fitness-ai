const MEAL_PERIOD = {
  type: ["string", "null"],
  enum: ["café da manhã", "almoço", "lanche da tarde", "jantar", "ceia", null]
};
const NUMBER_OR_NULL = { type: ["number", "null"] };
const STRING_OR_NULL = { type: ["string", "null"] };
const STRING_ARRAY = { type: "array", items: { type: "string" } };

function defineTool(name, description, properties = {}) {
  return {
    type: "function",
    name,
    description,
    strict: true,
    parameters: {
      type: "object",
      properties,
      required: Object.keys(properties),
      additionalProperties: false
    }
  };
}

function nullableFields(values) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== null));
}

function formatProfileMemory(memory = {}) {
  const profile = memory.profile || {};
  const preferences = memory.preferences || {};
  const fields = [
    ["Nome", profile.name], ["Idade", profile.age_years === null ? null : `${profile.age_years} anos`],
    ["Sexo", profile.sex], ["Altura", profile.height_cm === null ? null : `${profile.height_cm} cm`],
    ["Peso cadastrado", profile.weight_kg === null ? null : `${profile.weight_kg} kg`],
    ["Objetivo", profile.goal], ["Atividade", profile.activity_level],
    ["Preferências alimentares", preferences.dietary_preferences], ["Alimentos rejeitados", preferences.food_dislikes]
  ].filter(([, value]) => value !== null && value !== undefined && value !== "");
  return fields.length
    ? `Dados atuais do perfil:\n${fields.map(([label, value]) => `• ${label}: ${value}`).join("\n")}`
    : "Ainda não há dados de perfil ou preferências cadastrados.";
}

function formatMealHistory(memory = {}) {
  const recent = memory.recent || {};
  const lines = [];
  for (const meal of recent.meals || []) {
    lines.push(`• Refeição (${meal.date}): ${meal.description} — ${meal.calories} kcal, P ${meal.protein_g} g, C ${meal.carbs_g} g, G ${meal.fat_g} g.`);
  }
  for (const workout of recent.workouts || []) {
    lines.push(`• Treino (${workout.date}): ${workout.description}${workout.duration_min ? `, ${workout.duration_min} min` : ""}${workout.notes ? ` — ${workout.notes}` : ""}.`);
  }
  for (const weight of recent.weights || []) {
    lines.push(`• Peso (${weight.date}): ${weight.weight_kg} kg.`);
  }
  for (const event of memory.meal_plan_events || []) {
    const detail = event.details?.option?.name || event.details?.desired_food;
    lines.push(`• Evento do plano (${event.created_at}): ${event.event_type}${event.meal_period ? ` — ${event.meal_period}` : ""}${detail ? ` — ${detail}` : ""}.`);
  }
  return lines.length
    ? `Histórico recente registrado:\n${lines.join("\n")}`
    : "Ainda não há registros recentes no histórico.";
}

export function createAgentToolRegistry({
  executeAction,
  readMemory,
  updateAvailability,
  explicitMealFacts = null
}) {
  const explicitFacts = explicitMealFacts || {};

  const normalizeFactArray = (value) =>
    Array.isArray(value)
      ? value
          .filter(
            (item) =>
              typeof item === "string" &&
              item.trim()
          )
          .map((item) => item.trim())
      : [];

  const mergeUnique = (...values) =>
    [...new Set(
      values
        .flatMap(normalizeFactArray)
        .filter(Boolean)
    )];

  const mergeExplicitMealFacts = (args = {}) => {
    const modelAvailable =
      normalizeFactArray(
        args.available_foods
      );

    const modelRequired =
      normalizeFactArray(
        args.required_foods
      );

    const modelExcluded =
      normalizeFactArray(
        args.explicit_excluded_foods
      );

    const explicitAvailable =
      normalizeFactArray(
        explicitFacts.availableFoods
      );

    const explicitRequired =
      normalizeFactArray(
        explicitFacts.requiredFoods
      );

    const explicitExcluded =
      normalizeFactArray(
        explicitFacts.explicitExcludedFoods
      );

    /*
     * Fato informado explicitamente pelo usuário
     * tem prioridade sobre uma interpretação do modelo.
     *
     * Exemplo:
     * "Tenho whey, mas não quero whey com água."
     *
     * O modelo não pode transformar "whey" em
     * alimento proibido simplesmente porque apareceu
     * depois de "não quero".
     */
    const availableFoods =
      explicitAvailable.length
        ? mergeUnique(
            modelAvailable,
            explicitAvailable
          ).filter(
            (food) =>
              !explicitFacts.explicitUnavailableFoods?.includes(
                food
              )
          )
        : modelAvailable;

    const requiredFoods =
      explicitRequired.length
        ? mergeUnique(
            modelRequired,
            explicitRequired
          )
        : modelRequired;

    /*
     * Um alimento explicitamente disponível não deve
     * ser simultaneamente tratado como excluído,
     * salvo se o próprio usuário também tiver informado
     * explicitamente que não o possui.
     */
    const explicitUnavailable =
      normalizeFactArray(
        explicitFacts.explicitUnavailableFoods
      );

    const excludedFoods =
      mergeUnique(
        modelExcluded,
        explicitExcluded
      ).filter(
        (food) =>
          !availableFoods.includes(food) ||
          explicitUnavailable.includes(food)
      );

    /*
     * Exclusão de composição é preservada separadamente.
     *
     * "não quero whey com água"
     *
     * significa:
     *   whey       -> pode continuar disponível
     *   água       -> não pode compor ESSA combinação
     *
     * Não significa:
     *   whey       -> proibido
     */
    const explicitExcludedCompositions =
      Array.isArray(
        explicitFacts.explicitExcludedCompositions
      )
        ? explicitFacts
            .explicitExcludedCompositions
            .map((composition) => ({
              ingredients: normalizeFactArray(
                composition?.ingredients
              ),
              description:
                typeof composition?.description ===
                "string"
                  ? composition.description
                  : ""
            }))
            .filter(
              (composition) =>
                composition.ingredients.length > 0
            )
        : [];

    const modelExcludedCompositions =
      Array.isArray(
        args.explicit_excluded_compositions
      )
        ? args.explicit_excluded_compositions
        : [];

    const excludedCompositions = [
      ...modelExcludedCompositions,
      ...explicitExcludedCompositions
    ];

    /*
     * Disponibilidade exclusiva só pode ser ativada
     * quando isso foi efetivamente informado pelo usuário.
     *
     * O modelo não deve inventar:
     * "só tenho X e Y"
     * quando o usuário apenas disse
     * "tenho X e Y".
     */
    const onlyAvailableFoods =
      explicitFacts.onlyAvailableFoods === true
        ? true
        : args.only_available_foods === true &&
          explicitFacts.onlyAvailableFoods !== false;

    /*
     * "rápido" é uma restrição explícita.
     *
     * Não permitimos que o modelo transforme uma situação
     * como "vou jantar fora daqui a duas horas" em
     * quick_only=true.
     */
    const quickOnly =
      explicitFacts.quickOnly === true;

    /*
     * Preservação de orçamento pode ser identificada pelo
     * modelo ou pelo extrator determinístico.
     *
     * Importante: isso NÃO implica preparo rápido.
     */
    const preserveBudgetForFuture =
      explicitFacts.preserveBudgetForFuture === true ||
      args.preserve_budget_for_future === true;

    const futureMealPeriod =
      explicitFacts.futureMealPeriod ??
      args.future_meal_period ??
      null;

    const desiredFood =
      explicitFacts.desiredFood ||
      args.desired_food ||
      "";

    const requestedServings =
      explicitFacts.requestedServings ??
      args.requested_servings ??
      null;

    const mealPeriod =
      explicitFacts.mealPeriod ??
      args.meal_period ??
      null;

    const moreOptions =
      explicitFacts.moreOptions === true ||
      args.more_options === true;

    return {
      ...args,

      meal_period:
        mealPeriod,

      desired_food:
        desiredFood,

      requested_servings:
        requestedServings,

      available_foods:
        availableFoods,

      required_foods:
        requiredFoods,

      explicit_excluded_foods:
        excludedFoods,

      explicit_excluded_compositions:
        excludedCompositions,

      only_available_foods:
        onlyAvailableFoods,

      quick_only:
        quickOnly,

      more_options:
        moreOptions,

      preserve_budget_for_future:
        preserveBudgetForFuture,

      future_meal_period:
        futureMealPeriod
    };
  };

  const definitions = [
    defineTool("get_nutrition_state", "Consultar o resumo atual de calorias e macros. Use para responder valores pessoais de hoje.", {}),
    defineTool("get_user_profile", "Consultar perfil e preferências persistentes do usuário.", {}),
    defineTool("get_meal_history", "Consultar refeições e registros recentes do usuário.", {}),
    defineTool("set_food_availability", "Registrar disponibilidade temporária para hoje somente quando o usuário informar explicitamente que tem ou não tem o alimento.", {
      food: { type: "string", enum: ["whey"] },
      available: { type: "boolean" }
    }),
    defineTool("suggest_meals", "Gerar sugestões nutricionais determinísticas. Use quando o usuário pedir o que comer, alternativas, alimento desejado ou preparo rápido.", {
      meal_period: MEAL_PERIOD,
      desired_food: STRING_OR_NULL,
      requested_servings: NUMBER_OR_NULL,
      available_foods: STRING_ARRAY,
      required_foods: STRING_ARRAY,
      explicit_excluded_foods: STRING_ARRAY,
      explicit_excluded_compositions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            ingredients: { type: "array", items: { type: "string" } },
            description: { type: "string" }
          },
          required: ["ingredients", "description"],
          additionalProperties: false
        }
      },
      only_available_foods: { type: "boolean" },
      quick_only: { type: "boolean" },
      more_options: { type: "boolean" },
      preserve_budget_for_future: { type: "boolean" },
      future_meal_period: MEAL_PERIOD
    }),
    defineTool("create_daily_meal_plan", "Criar e persistir um plano alimentar diário, sem registrar consumo.", { current_meal_period: MEAL_PERIOD }),
    defineTool("get_daily_meal_plan", "Consultar o plano alimentar persistido para hoje.", {}),
    defineTool("set_meal_plan_intent", "Registrar se o usuário pretende seguir o plano; isso não registra consumo.", {
      intends_to_follow: { type: "boolean" }
    }),
    defineTool("choose_meal_option", "Registrar escolha de uma opção e retornar sua projeção, sem consumo.", {
      meal_period: MEAL_PERIOD,
      option_index: { type: "integer", minimum: 1 }
    }),
    defineTool("confirm_meal_consumption", "Confirmar o consumo de uma opção previamente escolhida/oferecida. Só use após autorização clara do usuário.", {
      meal_period: MEAL_PERIOD,
      selection_event_id: NUMBER_OR_NULL
    }),
    defineTool("record_meal", "Registrar alimentação que o usuário afirma ter consumido diretamente.", {
      description: { type: "string" },
      calories: { type: "number", minimum: 0 },
      protein_g: { type: "number", minimum: 0 },
      carbs_g: { type: "number", minimum: 0 },
      fat_g: { type: "number", minimum: 0 },
      meal_period: MEAL_PERIOD
    }),
    defineTool("correct_meal", "Corrigir um registro existente pelo ID; não criar uma segunda refeição.", {
      meal_id: { type: "integer", minimum: 1 },
      description: { type: "string" },
      calories: NUMBER_OR_NULL,
      protein_g: NUMBER_OR_NULL,
      carbs_g: NUMBER_OR_NULL,
      fat_g: NUMBER_OR_NULL
    }),
    defineTool("set_calorie_target", "Definir a meta diária personalizada de calorias informada pelo usuário.", {
      calories: { type: "number", minimum: 1 }
    }),
    defineTool("set_macro_targets", "Definir somente as metas de macros informadas pelo usuário; campos nulos permanecem inalterados.", {
      protein_g: NUMBER_OR_NULL,
      carbs_g: NUMBER_OR_NULL,
      fat_g: NUMBER_OR_NULL
    }),
    defineTool("restore_automatic_targets", "Restaurar metas calculadas automaticamente quando o usuário pedir.", {}),
    defineTool("update_user_profile", "Salvar somente dados de perfil informados explicitamente pelo usuário.", {
      name: STRING_OR_NULL,
      age_years: NUMBER_OR_NULL,
      sex: STRING_OR_NULL,
      height_cm: NUMBER_OR_NULL,
      weight_kg: NUMBER_OR_NULL,
      goal: STRING_OR_NULL,
      activity_level: STRING_OR_NULL,
      training_days_per_week: NUMBER_OR_NULL,
      dietary_preferences: STRING_OR_NULL,
      food_dislikes: STRING_OR_NULL
    }),
    defineTool("record_weight", "Registrar um peso informado pelo usuário.", { weight_kg: { type: "number", minimum: 0.1 } }),
    defineTool("record_workout", "Registrar somente um treino que o usuário informou que realizou.", {
      workout_type: { type: "string" },
      duration_min: { type: "number", minimum: 0 },
      notes: { type: "string" },
      exercises: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            sets: { type: "integer", minimum: 0 },
            reps: { type: "integer", minimum: 0 },
            weight_kg: { type: "number", minimum: 0 }
          },
          required: ["name", "sets", "reps", "weight_kg"],
          additionalProperties: false
        }
      }
    })
  ];

  const handlers = {
    get_nutrition_state: () => executeAction("summary", {}),
    get_user_profile: async () => formatProfileMemory(await readMemory("profile")),
    get_meal_history: async () => formatMealHistory(await readMemory("history")),
    set_food_availability: (args) => updateAvailability(args),
    suggest_meals: (args) => {
  const normalized =
    mergeExplicitMealFacts(
      args
    );

  return executeAction(
    "meal_suggestion",
    {
      meal_period:
        normalized.meal_period,

      desired_food:
        normalized.desired_food,

      requested_servings:
        normalized.requested_servings,

      available_foods:
        normalized.available_foods,

      required_foods:
        normalized.required_foods,

      explicit_excluded_foods:
        normalized.explicit_excluded_foods,

      explicit_excluded_compositions:
        normalized.explicit_excluded_compositions,

      only_available_foods:
        normalized.only_available_foods,

      quick_only:
        normalized.quick_only,

      more_options:
        normalized.more_options,

      preserve_budget_for_future:
        normalized.preserve_budget_for_future,

      future_meal_period:
        normalized.future_meal_period
    },
    {
      quick_only:
        normalized.quick_only,

      more_options:
        normalized.more_options
    }
  );
},
    create_daily_meal_plan: (args) => executeAction("meal_plan", { meal_period: args.current_meal_period }),
    get_daily_meal_plan: () => executeAction("meal_plan_get", {}),
    set_meal_plan_intent: (args) => executeAction(args.intends_to_follow ? "meal_plan_intent" : "meal_plan_decline", {}),
    choose_meal_option: (args) => executeAction("meal_choice", { meal_period: args.meal_period, option_index: args.option_index }),
    confirm_meal_consumption: (args) => executeAction("meal_consumed", { meal_period: args.meal_period, selection_event_id: args.selection_event_id }),
    record_meal: (args) => executeAction("meal", args),
    correct_meal: (args) => executeAction("meal_correction", args),
    set_calorie_target: (args) => executeAction("set_calorie_target", { calories: args.calories, mode: "custom" }),
    set_macro_targets: (args) => executeAction("set_macro_targets", nullableFields(args)),
    restore_automatic_targets: () => executeAction("reset_nutrition_targets", {}),
    update_user_profile: (args) => executeAction("profile", nullableFields(args)),
    record_weight: (args) => executeAction("weight", args),
    record_workout: (args) => executeAction("workout", args)
  };

  return { definitions, handlers };
}
