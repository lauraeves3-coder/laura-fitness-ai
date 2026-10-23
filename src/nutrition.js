import {
  EXPANDED_TEMPLATES,
  estimateMealFromText,
  getMissingMealQuantities,
  generateFreeMealOptions
} from "./nutritionCatalog.js";

const WEIGHTS = {"café da manhã":0.2,almoço:0.3,"lanche da tarde":0.15,jantar:0.25,ceia:0.1};
const ORDER = Object.keys(WEIGHTS);
const TEMPLATES = EXPANDED_TEMPLATES;

const DESIRED_FOODS = {
  pizza: [
    { name: "Pizza de muçarela", foods: ["pizza de muçarela (1 fatia média)"], calories: 285, protein_g: 12, carbs_g: 36, fat_g: 10, serving: "fatia média", availability_foods: ["pizza", "muçarela"], key: "pizza-mucarela" },
    { name: "Pizza de calabresa", foods: ["pizza de calabresa (1 fatia média)"], calories: 310, protein_g: 13, carbs_g: 34, fat_g: 14, serving: "fatia média", availability_foods: ["pizza", "calabresa"], key: "pizza-calabresa" },
    { name: "Pizza de frango com Catupiry", foods: ["pizza de frango com Catupiry (1 fatia média)"], calories: 300, protein_g: 17, carbs_g: 31, fat_g: 12, serving: "fatia média", availability_foods: ["pizza", "frango", "catupiry"], key: "pizza-frango-catupiry" },
    { name: "Pizza de lombo com Catupiry", foods: ["pizza de lombo com Catupiry (1 fatia média)"], calories: 320, protein_g: 17, carbs_g: 30, fat_g: 15, serving: "fatia média", availability_foods: ["pizza", "lombo", "catupiry"], key: "pizza-lombo-catupiry" },
    { name: "Pizza portuguesa", foods: ["pizza portuguesa (1 fatia média)"], calories: 330, protein_g: 17, carbs_g: 32, fat_g: 15, serving: "fatia média", availability_foods: ["pizza", "presunto", "ovo", "calabresa", "cebola"], key: "pizza-portuguesa" },
    { name: "Pizza quatro queijos", foods: ["pizza quatro queijos (1 fatia média)"], calories: 340, protein_g: 16, carbs_g: 31, fat_g: 18, serving: "fatia média", availability_foods: ["pizza", "muçarela", "catupiry", "parmesão", "gorgonzola"], key: "pizza-quatro-queijos" },
    { name: "Pizza marguerita", foods: ["pizza marguerita (1 fatia média)"], calories: 280, protein_g: 11, carbs_g: 35, fat_g: 10, serving: "fatia média", availability_foods: ["pizza", "muçarela", "tomate", "manjericão"], key: "pizza-marguerita" },
    { name: "Pizza napolitana", foods: ["pizza napolitana (1 fatia média)"], calories: 285, protein_g: 12, carbs_g: 34, fat_g: 10, serving: "fatia média", availability_foods: ["pizza", "muçarela", "tomate", "parmesão"], key: "pizza-napolitana" },
    { name: "Pizza de atum", foods: ["pizza de atum (1 fatia média)"], calories: 270, protein_g: 17, carbs_g: 30, fat_g: 9, serving: "fatia média", availability_foods: ["pizza", "atum"], key: "pizza-atum" },
    { name: "Pizza de bacon", foods: ["pizza de bacon (1 fatia média)"], calories: 320, protein_g: 14, carbs_g: 32, fat_g: 14, serving: "fatia média", availability_foods: ["pizza", "bacon"], key: "pizza-bacon" },
    { name: "Pizza de milho com Catupiry", foods: ["pizza de milho com Catupiry (1 fatia média)"], calories: 300, protein_g: 12, carbs_g: 35, fat_g: 12, serving: "fatia média", availability_foods: ["pizza", "milho", "catupiry"], key: "pizza-milho-catupiry" },
    { name: "Pizza de palmito", foods: ["pizza de palmito (1 fatia média)"], calories: 290, protein_g: 12, carbs_g: 33, fat_g: 11, serving: "fatia média", availability_foods: ["pizza", "palmito"], key: "pizza-palmito" },
    { name: "Pizza toscana", foods: ["pizza toscana (1 fatia média)"], calories: 315, protein_g: 14, carbs_g: 33, fat_g: 14, serving: "fatia média", availability_foods: ["pizza", "calabresa", "cebola"], key: "pizza-toscana" },
    { name: "Pizza de pepperoni", foods: ["pizza de pepperoni (1 fatia média)"], calories: 320, protein_g: 14, carbs_g: 31, fat_g: 15, serving: "fatia média", availability_foods: ["pizza", "pepperoni"], key: "pizza-pepperoni" },
    { name: "Pizza de escarola com bacon", foods: ["pizza de escarola com bacon (1 fatia média)"], calories: 315, protein_g: 12, carbs_g: 29, fat_g: 15, serving: "fatia média", availability_foods: ["pizza", "escarola", "bacon"], key: "pizza-escarola-bacon" },
    { name: "Pizza baiana", foods: ["pizza baiana (1 fatia média)"], calories: 320, protein_g: 14, carbs_g: 33, fat_g: 14, serving: "fatia média", availability_foods: ["pizza", "calabresa", "cebola", "pimenta"], key: "pizza-baiana" },
    { name: "Pizza americana", foods: ["pizza americana (1 fatia média)"], calories: 330, protein_g: 15, carbs_g: 32, fat_g: 16, serving: "fatia média", availability_foods: ["pizza", "presunto", "bacon", "ovo", "milho"], key: "pizza-americana" },
    { name: "Pizza de presunto e queijo", foods: ["pizza de presunto e queijo (1 fatia média)"], calories: 300, protein_g: 16, carbs_g: 31, fat_g: 12, serving: "fatia média", availability_foods: ["pizza", "presunto", "muçarela"], key: "pizza-presunto-queijo" },
    { name: "Pizza de Catupiry", foods: ["pizza de Catupiry (1 fatia média)"], calories: 315, protein_g: 12, carbs_g: 34, fat_g: 14, serving: "fatia média", availability_foods: ["pizza", "catupiry"], key: "pizza-catupiry" },
    { name: "Pizza de frango com milho", foods: ["pizza de frango com milho (1 fatia média)"], calories: 290, protein_g: 16, carbs_g: 34, fat_g: 10, serving: "fatia média", availability_foods: ["pizza", "frango", "milho"], key: "pizza-frango-milho" },
    { name: "Pizza de frango com bacon", foods: ["pizza de frango com bacon (1 fatia média)"], calories: 320, protein_g: 17, carbs_g: 30, fat_g: 14, serving: "fatia média", availability_foods: ["pizza", "frango", "bacon"], key: "pizza-frango-bacon" },
    { name: "Pizza de frango com cheddar", foods: ["pizza de frango com cheddar (1 fatia média)"], calories: 320, protein_g: 18, carbs_g: 30, fat_g: 15, serving: "fatia média", availability_foods: ["pizza", "frango", "cheddar"], key: "pizza-frango-cheddar" },
    { name: "Pizza de calabresa com Catupiry", foods: ["pizza de calabresa com Catupiry (1 fatia média)"], calories: 325, protein_g: 14, carbs_g: 32, fat_g: 15, serving: "fatia média", availability_foods: ["pizza", "calabresa", "catupiry"], key: "pizza-calabresa-catupiry" },
    { name: "Pizza de lombo com cheddar", foods: ["pizza de lombo com cheddar (1 fatia média)"], calories: 330, protein_g: 18, carbs_g: 31, fat_g: 16, serving: "fatia média", availability_foods: ["pizza", "lombo", "cheddar"], key: "pizza-lombo-cheddar" },
    { name: "Pizza de strogonoff de carne", foods: ["pizza de strogonoff de carne (1 fatia média)"], calories: 360, protein_g: 19, carbs_g: 34, fat_g: 18, serving: "fatia média", availability_foods: ["pizza", "carne", "creme"], key: "pizza-strogonoff-carne" },
    { name: "Pizza de strogonoff de frango", foods: ["pizza de strogonoff de frango (1 fatia média)"], calories: 350, protein_g: 22, carbs_g: 34, fat_g: 14, serving: "fatia média", availability_foods: ["pizza", "frango", "creme"], key: "pizza-strogonoff-frango" },
    { name: "Pizza parmegiana", foods: ["pizza parmegiana (1 fatia média)"], calories: 335, protein_g: 17, carbs_g: 34, fat_g: 15, serving: "fatia média", availability_foods: ["pizza", "presunto", "parmesão"], key: "pizza-parmegiana" },
    { name: "Pizza de brócolis com bacon e Catupiry", foods: ["pizza de brócolis com bacon e Catupiry (1 fatia média)"], calories: 320, protein_g: 13, carbs_g: 28, fat_g: 17, serving: "fatia média", availability_foods: ["pizza", "brócolis", "bacon", "catupiry"], key: "pizza-brocolis-bacon-catupiry" },
    { name: "Pizza de alho e óleo", foods: ["pizza de alho e óleo (1 fatia média)"], calories: 285, protein_g: 10, carbs_g: 35, fat_g: 11, serving: "fatia média", availability_foods: ["pizza", "alho"], key: "pizza-alho" },
    { name: "Pizza vegetariana", foods: ["pizza vegetariana (1 fatia média)"], calories: 280, protein_g: 11, carbs_g: 35, fat_g: 10, serving: "fatia média", availability_foods: ["pizza", "palmito", "milho", "ervilha", "cebola"], key: "pizza-vegetariana" },
    { name: "Pizza mexicana", foods: ["pizza mexicana (1 fatia média)"], calories: 335, protein_g: 16, carbs_g: 34, fat_g: 16, serving: "fatia média", availability_foods: ["pizza", "presunto", "bacon", "cebola", "pimentão"], key: "pizza-mexicana" },
    { name: "Pizza paulista", foods: ["pizza paulista (1 fatia média)"], calories: 300, protein_g: 14, carbs_g: 34, fat_g: 11, serving: "fatia média", availability_foods: ["pizza", "palmito", "milho", "ervilha"], key: "pizza-paulista" },
    { name: "Pizza moda da casa", foods: ["pizza moda da casa (1 fatia média)"], calories: 350, protein_g: 17, carbs_g: 31, fat_g: 17, serving: "fatia média", availability_foods: ["pizza"], key: "pizza-moda-da-casa" },

    { name: "Pizza doce de banana com canela", foods: ["pizza doce de banana com canela (1 fatia média)"], calories: 320, protein_g: 5, carbs_g: 48, fat_g: 11, serving: "fatia média", availability_foods: ["pizza", "banana", "canela"], key: "pizza-doce-banana-canela" },
    { name: "Pizza doce Romeu e Julieta", foods: ["pizza doce Romeu e Julieta (1 fatia média)"], calories: 340, protein_g: 8, carbs_g: 44, fat_g: 14, serving: "fatia média", availability_foods: ["pizza", "goiabada", "queijo"], key: "pizza-doce-romeu-julieta" },
    { name: "Pizza doce de chocolate com morango", foods: ["pizza doce de chocolate com morango (1 fatia média)"], calories: 360, protein_g: 6, carbs_g: 49, fat_g: 16, serving: "fatia média", availability_foods: ["pizza", "chocolate", "morango"], key: "pizza-doce-chocolate-morango" },
    { name: "Pizza doce de chocolate", foods: ["pizza doce de chocolate (1 fatia média)"], calories: 350, protein_g: 6, carbs_g: 46, fat_g: 17, serving: "fatia média", availability_foods: ["pizza", "chocolate"], key: "pizza-doce-chocolate" },
    { name: "Pizza doce de prestígio", foods: ["pizza doce de prestígio (1 fatia média)"], calories: 370, protein_g: 6, carbs_g: 47, fat_g: 18, serving: "fatia média", availability_foods: ["pizza", "chocolate", "coco"], key: "pizza-doce-prestigio" }
  ],
  hamburger: [
    { name: "Hambúrguer simples", foods: ["pão, carne e salada (1 unidade)"], calories: 430, protein_g: 25, carbs_g: 38, fat_g: 20, serving: "unidade", availability_foods: ["hamburger", "carne"], key: "hamburguer-simples" },
    { name: "Hambúrguer de frango", foods: ["pão, frango e salada (1 unidade)"], calories: 390, protein_g: 29, carbs_g: 40, fat_g: 13, serving: "unidade", availability_foods: ["hamburger", "frango"], key: "hamburguer-frango" },
    { name: "Hambúrguer com queijo", foods: ["pão, carne e queijo (1 unidade)"], calories: 500, protein_g: 29, carbs_g: 40, fat_g: 26, serving: "unidade", availability_foods: ["hamburger", "carne", "queijo"], key: "hamburguer-queijo" }
  ],
  chocolate: [
    { name: "Chocolate amargo", foods: ["chocolate amargo (20 g)"], calories: 120, protein_g: 2, carbs_g: 9, fat_g: 9, serving: "porção de 20 g", availability_foods: ["chocolate"], key: "chocolate-amargo" },
    { name: "Chocolate ao leite", foods: ["chocolate ao leite (20 g)"], calories: 107, protein_g: 1.5, carbs_g: 12, fat_g: 6, serving: "porção de 20 g", availability_foods: ["chocolate"], key: "chocolate-leite" },
    { name: "Chocolate meio amargo", foods: ["chocolate meio amargo (20 g)"], calories: 112, protein_g: 1.5, carbs_g: 10, fat_g: 7, serving: "porção de 20 g", availability_foods: ["chocolate"], key: "chocolate-meio-amargo" }
  ],
  sorvete: [
    { name: "Sorvete de creme", foods: ["sorvete de creme (1 bola)"], calories: 140, protein_g: 2.5, carbs_g: 17, fat_g: 7, serving: "bola", availability_foods: ["sorvete"], key: "sorvete-creme" },
    { name: "Sorvete de fruta", foods: ["sorvete de fruta (1 bola)"], calories: 110, protein_g: 1, carbs_g: 25, fat_g: 1, serving: "bola", availability_foods: ["sorvete"], key: "sorvete-fruta" },
    { name: "Sorvete de chocolate", foods: ["sorvete de chocolate (1 bola)"], calories: 150, protein_g: 3, carbs_g: 19, fat_g: 7, serving: "bola", availability_foods: ["sorvete"], key: "sorvete-chocolate" }
  ],
  sushi: [
    { name: "Sushi de salmão", foods: ["sushi de salmão (4 peças)"], calories: 200, protein_g: 12, carbs_g: 28, fat_g: 4, serving: "porção de 4 peças", availability_foods: ["sushi", "arroz", "peixe"], key: "sushi-salmao" },
    { name: "Sushi de atum", foods: ["sushi de atum (4 peças)"], calories: 180, protein_g: 14, carbs_g: 25, fat_g: 2, serving: "porção de 4 peças", availability_foods: ["sushi", "arroz", "atum"], key: "sushi-atum" },
    { name: "Sushi vegetariano", foods: ["sushi vegetariano (4 peças)"], calories: 165, protein_g: 5, carbs_g: 31, fat_g: 2, serving: "porção de 4 peças", availability_foods: ["sushi", "arroz", "legumes"], key: "sushi-vegetariano" }
  ],
  bolo: [
    { name: "Bolo simples", foods: ["bolo simples (1 fatia)"], calories: 230, protein_g: 4, carbs_g: 35, fat_g: 8, serving: "fatia", availability_foods: ["bolo"], key: "bolo-simples" },
    { name: "Bolo de chocolate", foods: ["bolo de chocolate (1 fatia)"], calories: 310, protein_g: 5, carbs_g: 44, fat_g: 13, serving: "fatia", availability_foods: ["bolo"], key: "bolo-chocolate" },
    { name: "Bolo de cenoura", foods: ["bolo de cenoura (1 fatia)"], calories: 260, protein_g: 4, carbs_g: 40, fat_g: 9, serving: "fatia", availability_foods: ["bolo"], key: "bolo-cenoura" }
  ],
  massa: [
    { name: "Massa ao sugo", foods: ["massa ao sugo (1 prato)"], calories: 380, protein_g: 12, carbs_g: 70, fat_g: 6, serving: "prato", availability_foods: ["massa"], key: "massa-sugo" },
    { name: "Massa com frango", foods: ["massa com frango (1 prato)"], calories: 470, protein_g: 32, carbs_g: 62, fat_g: 9, serving: "prato", availability_foods: ["massa", "frango"], key: "massa-frango" },
    { name: "Massa com molho de queijo", foods: ["massa com molho de queijo (1 prato)"], calories: 520, protein_g: 19, carbs_g: 63, fat_g: 21, serving: "prato", availability_foods: ["massa", "queijo"], key: "massa-queijo" }
  ],
  "batata frita": [
    { name: "Batata frita (porção pequena)", foods: ["batata frita (80 g)"], calories: 250, protein_g: 3, carbs_g: 33, fat_g: 12, serving: "porção de 80 g", availability_foods: ["batata frita"], key: "batata-frita" },
    { name: "Batata assada", foods: ["batata assada (180 g)"], calories: 165, protein_g: 4, carbs_g: 37, fat_g: 0.2, serving: "porção de 180 g", availability_foods: ["batata frita"], key: "batata-assada" },
    { name: "Batata rústica", foods: ["batata rústica (150 g)"], calories: 220, protein_g: 4, carbs_g: 35, fat_g: 7, serving: "porção de 150 g", availability_foods: ["batata frita"], key: "batata-rustica" }
  ],
  japonesa: [
    // Temaki: referência TBCA de 1 unidade média de 90 g.
    { name: "Temaki de salmão com cream cheese", foods: ["temaki de salmão com cream cheese (1 unidade)"], calories: 144, protein_g: 7.8, carbs_g: 19.8, fat_g: 4.5, serving: "unidade", availability_foods: ["temaki"], key: "japonesa-temaki-salmao" },
    // Uramaki TBCA: unidade média de 60 g.
    { name: "Uramaki de salmão com pepino e cream cheese", foods: ["uramaki de salmão com pepino e cream cheese (1 unidade)"], calories: 86, protein_g: 4.0, carbs_g: 12.1, fat_g: 2.8, serving: "peça de 60 g", availability_foods: ["uramaki"], key: "japonesa-uramaki-salmao" },
    // Hot Philadelphia TBCA: 30 g por peça.
    { name: "Hot Philadelphia (Hot Roll)", foods: ["hot philadelphia (1 peça)"], calories: 84, protein_g: 2.7, carbs_g: 9.1, fat_g: 4.4, serving: "peça", availability_foods: ["hot roll"], key: "japonesa-hot-roll" },
    { name: "Nigiri de salmão", foods: ["nigiri de salmão (1 peça)"], calories: 57.8, protein_g: 3.0, carbs_g: 7.7, fat_g: 1.4, serving: "peça", availability_foods: ["nigiri"], key: "japonesa-nigiri" },
    { name: "Sashimi de salmão", foods: ["sashimi de salmão (1 fatia)"], calories: 20.8, protein_g: 2.1, carbs_g: 0, fat_g: 1.3, serving: "fatia", availability_foods: ["sashimi"], key: "japonesa-sashimi" },
    { name: "Yakisoba brasileiro", foods: ["yakisoba (300 g)"], calories: 366, protein_g: 22.4, carbs_g: 54.6, fat_g: 7.8, serving: "300 g", availability_foods: ["yakisoba"], key: "japonesa-yakisoba" },
    { name: "Guioza", foods: ["guioza (1 unidade)"], calories: 134, protein_g: 6.4, carbs_g: 18.6, fat_g: 4.0, serving: "unidade", availability_foods: ["guioza"], key: "japonesa-guioza" },
    { name: "Hossomaki de salmão", foods: ["hossomaki de salmão (1 peça)"], calories: 41, protein_g: 1.8, carbs_g: 6.3, fat_g: 0.8, serving: "peça", availability_foods: ["hossomaki"], key: "japonesa-hossomaki-salmao" },
    { name: "Uramaki Califórnia", foods: ["uramaki califórnia (1 peça)"], calories: 48, protein_g: 1.5, carbs_g: 7.8, fat_g: 1.4, serving: "peça", availability_foods: ["uramaki"], key: "japonesa-uramaki-california" },
    { name: "Uramaki skin", foods: ["uramaki skin (1 peça)"], calories: 63, protein_g: 2.1, carbs_g: 6.9, fat_g: 3.0, serving: "peça", availability_foods: ["uramaki"], key: "japonesa-uramaki-skin" },
    { name: "Uramaki de atum", foods: ["uramaki de atum (1 peça)"], calories: 44, protein_g: 2.3, carbs_g: 6.9, fat_g: 0.9, serving: "peça", availability_foods: ["uramaki"], key: "japonesa-uramaki-atum" },
    { name: "Temaki de atum", foods: ["temaki de atum (1 unidade)"], calories: 140, protein_g: 9.0, carbs_g: 19.8, fat_g: 2.7, serving: "unidade", availability_foods: ["temaki"], key: "japonesa-temaki-atum" },
    { name: "Temaki de camarão", foods: ["temaki de camarão (1 unidade)"], calories: 144, protein_g: 8.1, carbs_g: 21.6, fat_g: 2.7, serving: "unidade", availability_foods: ["temaki"], key: "japonesa-temaki-camarao" },
    { name: "Temaki de kani", foods: ["temaki de kani (1 unidade)"], calories: 140, protein_g: 6.3, carbs_g: 22.5, fat_g: 2.3, serving: "unidade", availability_foods: ["temaki"], key: "japonesa-temaki-kani" },
    { name: "Temaki de shimeji com cream cheese", foods: ["temaki de shimeji com cream cheese (1 unidade)"], calories: 158, protein_g: 5.4, carbs_g: 21.6, fat_g: 5.4, serving: "unidade", availability_foods: ["temaki"], key: "japonesa-temaki-shimeji" },
    { name: "Tempurá de camarão", foods: ["tempurá de camarão (100 g)"], calories: 220, protein_g: 12.0, carbs_g: 17.0, fat_g: 11.0, serving: "100 g", availability_foods: ["tempurá"], key: "japonesa-tempura-camarao" }
  ]
};

export function generateDesiredFoodOptions({
  desiredFood, calorieBudget, macroBudget = {}, macroPriority = null,
  dislikes = [], availableFoods = [], availabilityOnly = false, requestedServings = null,
  preferredComposition = null, recentOptions = [], limit = 3,
  dailyCalorieBudget = calorieBudget, dailyMacroBudget = macroBudget,
  excludeRecentOptions = false
}) {
  const templates = DESIRED_FOODS[desiredFood];
  if (!templates || !Number.isFinite(Number(calorieBudget)) || !Number.isFinite(Number(dailyCalorieBudget))) return null;
  const rejected = dislikes.map(normalizeIngredient);
  const available = availableFoods.map(normalizeIngredient);
  const servings = Number.isFinite(Number(requestedServings)) && requestedServings > 0
    ? Number(requestedServings) : null;
  const allowedTemplates = templates.filter((template) => !rejected.some((item) =>
    normalizeIngredient(template.name).includes(item) || template.foods.some((food) => normalizeIngredient(food).includes(item))
  ));
  const availableMatches = available.length
    ? allowedTemplates.filter((template) => {
        const requiredAvailability = (template.availability_foods || [])
          .map(normalizeIngredient)
          .filter(Boolean);

        if (!requiredAvailability.length) {
          return false;
        }

        /*
         * A composição só pode ser considerada disponível
         * quando TODOS os componentes necessários existem.
         *
         * Ex.:
         *   ["pizza", "frango"]
         *
         * exige:
         *   pizza E frango
         */
        return requiredAvailability.every((ingredient) =>
          available.some((food) =>
            food === ingredient
            || food.includes(ingredient)
            || ingredient.includes(food)
          )
        );
      })
    : [];
  const preferred = preferredComposition
    ? allowedTemplates.filter((template) => template.key === preferredComposition
      && (!availabilityOnly || !available.length || availableMatches.includes(template)))
    : [];
  const candidates = preferred.length
    ? preferred
    : (availableMatches.length
      ? availableMatches
      : (availabilityOnly && available.length ? [] : allowedTemplates));
  const createOption = (template, quantity, isRequested = false) => {
    const portion = formatDesiredServing(template, quantity);
    const option = {
      name: `${template.name} — ${portion}`,
      foods: template.foods.map((food) => food.replace(/\([^)]*\)/, `(${portion})`)),
      calories: Math.round(template.calories * quantity),
      protein_g: Math.round(template.protein_g * quantity * 10) / 10,
      carbs_g: Math.round(template.carbs_g * quantity * 10) / 10,
      fat_g: Math.round(template.fat_g * quantity * 10) / 10,
      composition_key: `${template.key}|servings:${quantity}`,
      protein_source: template.key,
      is_quick: false,
      category: "encaixe do alimento desejado",
      desired_food_option: true,
      requested_servings: isRequested ? quantity : null
    };
    if (!validateMealOption(option, null, {}, {}).valid) return null;

    const mealCalorieOverage = Math.max(0, option.calories - Number(calorieBudget));
    const dailyCalorieOverage = Math.max(0, option.calories - Number(dailyCalorieBudget));
    const macroOverages = {};
    for (const key of ["protein_g", "carbs_g", "fat_g"]) {
      const remaining = n(dailyMacroBudget[key]);
      macroOverages[key] = remaining === null ? 0 : Math.max(0, option[key] - remaining);
    }
    const hasMacroOverage = Object.values(macroOverages).some((amount) => amount > 0.5);
    option.meal_calorie_overage = mealCalorieOverage;
    option.daily_calorie_overage = dailyCalorieOverage;
    option.macro_overages = macroOverages;
    option.is_over_budget = dailyCalorieOverage > 0;
    option.explicit_overage = dailyCalorieOverage > 0 || hasMacroOverage;
    return option;
  };

  const baseOptions = candidates
    .map((template) => createOption(template, 1))
    .filter(Boolean);
  const freshBaseOptions = filterPreviouslyOffered(baseOptions, recentOptions, excludeRecentOptions);
  const selected = selectDiverseOptions(
    freshBaseOptions,
    Math.max(0, Math.floor(limit)),
    recentOptions,
    macroPriority
  );

  const largerServings = servings && servings > 1
    ? servings
    : (desiredFood === "pizza" ? 2 : null);
  if (largerServings && selected.length) {
    const preferred = candidates.find((template) => template.key === preferredComposition);
    const base = selected.find((option) => preferred && option.composition_key.startsWith(`${preferred.key}|`)) || selected[0];
    const template = candidates.find((item) => item.key === base.composition_key.split("|servings:")[0]);
    const larger = template && largerServings > 1 ? createOption(template, largerServings, Boolean(servings)) : null;
    const oneServingFits = base.calories <= Number(dailyCalorieBudget);
    if (larger && !selected.some((option) => option.composition_key === larger.composition_key)
      && (Boolean(servings) || (desiredFood === "pizza" && oneServingFits))) {
      selected.push(larger);
    }
  }

  return selected;
}

function filterPreviouslyOffered(options, recentOptions, excludeRecentOptions) {
  if (!excludeRecentOptions || !options.length) return options;
  const recentKeys = new Set(recentOptions.map((option) => enrichOption(option).composition_key));
  const fresh = options.filter((option) => !recentKeys.has(option.composition_key));
  return fresh.length ? fresh : options;
}

function formatDesiredServing(template, servings) {
  const quantity = Math.round(servings * 10) / 10;
  if (template.key.startsWith("pizza-")) return `${quantity} ${quantity === 1 ? "fatia média" : "fatias médias"}`;
  if (template.key.startsWith("hamburguer-")) return `${quantity} ${quantity === 1 ? "unidade" : "unidades"}`;
  if (template.key.startsWith("chocolate-")) return `${Math.round(quantity * 20)} g`;
  if (template.key.startsWith("sorvete-")) return `${quantity} ${quantity === 1 ? "bola" : "bolas"}`;
  if (template.key.startsWith("sushi-")) return `${Math.round(quantity * 4)} peças`;
  if (template.key.startsWith("bolo-")) return `${quantity} ${quantity === 1 ? "fatia" : "fatias"}`;
  if (template.key.startsWith("massa-")) return `${quantity} ${quantity === 1 ? "prato" : "pratos"}`;
  if (template.key === "batata-frita") return `${Math.round(quantity * 80)} g`;
  if (template.key === "batata-assada") return `${Math.round(quantity * 180)} g`;
  if (template.key === "batata-rustica") return `${Math.round(quantity * 150)} g`;
  if (template.key === "japonesa-temaki-salmao") return `${quantity} ${quantity === 1 ? "unidade" : "unidades"}`;
  if (template.key === "japonesa-uramaki-salmao") return `${quantity} ${quantity === 1 ? "peça de 60 g" : "peças de 60 g"}`;
  if (template.key === "japonesa-hot-roll") return `${quantity} ${quantity === 1 ? "peça" : "peças"}`;
  if (template.key === "japonesa-nigiri") return `${quantity} ${quantity === 1 ? "peça" : "peças"}`;
  if (template.key === "japonesa-sashimi") return `${quantity} ${quantity === 1 ? "fatia" : "fatias"}`;
  if (template.key === "japonesa-yakisoba") return `${Math.round(quantity * 300)} g`;
  if (template.key === "japonesa-guioza") return `${quantity} ${quantity === 1 ? "unidade" : "unidades"}`;
  if (template.key === "japonesa-hossomaki-salmao") return `${quantity} ${quantity === 1 ? "peça" : "peças"}`;
  if (template.key === "japonesa-uramaki-california") return `${quantity} ${quantity === 1 ? "peça" : "peças"}`;
  if (template.key === "japonesa-uramaki-skin") return `${quantity} ${quantity === 1 ? "peça" : "peças"}`;
  if (template.key === "japonesa-uramaki-atum") return `${quantity} ${quantity === 1 ? "peça" : "peças"}`;
  if (template.key === "japonesa-temaki-atum") return `${quantity} ${quantity === 1 ? "unidade" : "unidades"}`;
  if (template.key === "japonesa-temaki-camarao") return `${quantity} ${quantity === 1 ? "unidade" : "unidades"}`;
  if (template.key === "japonesa-temaki-kani") return `${quantity} ${quantity === 1 ? "unidade" : "unidades"}`;
  if (template.key === "japonesa-temaki-shimeji") return `${quantity} ${quantity === 1 ? "unidade" : "unidades"}`;
  if (template.key === "japonesa-tempura-camarao") return `${Math.round(quantity * 100)} g`;
  return `${quantity} porções`;
}
const n = (value) => value === null || value === undefined || value === ""
  ? null
  : (Number.isFinite(Number(value)) ? Number(value) : null);

const assess = (target, consumed) => {
  const normalizedTarget = n(target);
  const normalizedConsumed = n(consumed) ?? 0;
  if (normalizedTarget === null) {
    return { target: null, consumed: normalizedConsumed, remaining: null, status: "sem_meta" };
  }
  const remaining = normalizedTarget - normalizedConsumed;
  return {
    target: normalizedTarget,
    consumed: normalizedConsumed,
    remaining,
    status: remaining > 0.5 ? "falta" : remaining < -0.5 ? "ultrapassada" : "atingida"
  };
};

export function calculateNutritionBalance(targets = {}, consumed = {}, addition = {}) {
  const metrics = {};
  for (const key of ["calories", "protein_g", "carbs_g", "fat_g"]) {
    const targetKey = key === "calories" ? "calorie_target" : key.replace("_g", "_target");
    const consumedValue = n(consumed[key]) ?? 0;
    const additionValue = n(addition[key]) ?? 0;
    metrics[key] = {
      ...assess(targets[targetKey], consumedValue),
      projected_consumed: consumedValue + additionValue,
      projected: assess(targets[targetKey], consumedValue + additionValue)
    };
  }

  const hasMacros = [targets.protein_target, targets.carbs_target, targets.fat_target]
    .every((value) => n(value) !== null);
  const macroCalories = hasMacros
    ? n(targets.protein_target) * 4 + n(targets.carbs_target) * 4 + n(targets.fat_target) * 9
    : null;
  const calorieTarget = n(targets.calorie_target);

  return {
    metrics,
    macro_calorie_total: macroCalories,
    macro_calorie_difference: calorieTarget === null || macroCalories === null
      ? null
      : macroCalories - calorieTarget,
    macros_compatible: calorieTarget === null || macroCalories === null
      ? null
      : Math.abs(macroCalories - calorieTarget) <= Math.max(15, calorieTarget * 0.02)
  };
}

export function analyzeRemainingNutritionBudget(summary = {}) {
  const calorieRemaining = n(summary.calorie_remaining);
  const macroRemaining = {
    protein_g: n(summary.protein_remaining),
    carbs_g: n(summary.carbs_remaining),
    fat_g: n(summary.fat_remaining)
  };
  const hasMacroTargets = Object.values(macroRemaining).every((value) => value !== null);
  const macroNeeds = Object.fromEntries(
    Object.entries(macroRemaining).map(([key, value]) => [
      key,
      value === null ? null : (value > 0 ? value : 0)
    ])
  );
  const macroCaloriesRequired = hasMacroTargets
    ? macroNeeds.protein_g * 4 + macroNeeds.carbs_g * 4 + macroNeeds.fat_g * 9
    : null;
  const incompatible = calorieRemaining === null || macroCaloriesRequired === null
    ? null
    : macroCaloriesRequired > calorieRemaining;

  return {
    calorie_remaining: calorieRemaining,
    macro_remaining: macroRemaining,
    macro_needs: macroNeeds,
    macro_calorie_requirement_kcal: macroCaloriesRequired,
    incompatible,
    priority: incompatible
      ? (macroNeeds.protein_g > 0 ? "protein" : "calories")
      : null
  };
}

export function getMealBudget(summary = {}, period, remainingMeals, {
  preserveBudgetForFuture = false,
  futureMealPeriod = null
} = {}) {
  const left = n(summary.calorie_remaining);
  if (left === null) return { calories: null, later_meals: [] };

  const start = Math.max(0, ORDER.indexOf(period));
  const periods = (Array.isArray(remainingMeals) && remainingMeals.length
    ? remainingMeals
    : ORDER.slice(start))
    .filter((item, index, all) => WEIGHTS[item] && all.indexOf(item) === index);
  const total = periods.reduce((sum, item) => sum + WEIGHTS[item], 0) || WEIGHTS[period] || 0.2;
  const fraction = (WEIGHTS[period] || 0.2) / total;
  const futureReserve = preserveBudgetForFuture && futureMealPeriod && periods.includes(futureMealPeriod)
    && futureMealPeriod !== period
    ? left * (WEIGHTS[futureMealPeriod] || 0) / total
    : null;
  const proportionalCalories = left > 0 ? left * fraction : 0;
  const calories = futureReserve === null
    ? proportionalCalories
    : Math.min(proportionalCalories, Math.max(0, left - futureReserve));
  const macroBudget = {};

  for (const [key, field] of [
    ["protein_g", "protein_remaining"],
    ["carbs_g", "carbs_remaining"],
    ["fat_g", "fat_remaining"]
  ]) {
    const value = n(summary[field]);
    // Keep zero and negative balances visible to validators and projections.
    macroBudget[key] = value === null ? null : value * fraction;
  }

  return {
    calories,
    macro_budget: macroBudget,
    later_meals: periods.filter((item) => item !== period),
    daily_remaining: left,
    future_meal_period: futureMealPeriod && periods.includes(futureMealPeriod) ? futureMealPeriod : null,
    future_meal_reserved_calories: futureReserve
  };
}

function makeOption(t, budget, dislikes, macroBudget = {}, macroPriority = null) {
  const norm = (value) => String(value).toLocaleLowerCase("pt-BR");
  if (budget !== null && budget !== undefined && budget <= 0) return null;
  if (t.foods.some((food) => dislikes.some((item) => norm(food).includes(norm(item))))) return null;

  let scale = budget > 0 ? Math.min(1.25, (budget / t.calories) * 0.92) : 0.75;

  for (const key of ["protein_g", "carbs_g", "fat_g"]) {
    if (macroPriority === "protein" && key !== "protein_g") continue;
    const allowance = n(macroBudget[key]);
    const base = n(t[key]);

    if (allowance !== null) {
      if (allowance <= 0 && base !== null && base > 0) return null;
      if (allowance > 0 && base !== null && base > 0) {
        scale = Math.min(scale, allowance / base);
      }
    }
  }

  // Evita porções fracionadas excessivamente pequenas.
  if (scale < 0.4) return null;

  const foods = t.foods.map((food, index) =>
    `${food} (${scalePortion(t.portions?.[index] || "1 porção", scale)})`
  );

  const option = {
    name: t.name,
    foods,
    calories: Math.round(t.calories * scale),
    protein_g: Math.round(t.protein_g * scale * 10) / 10,
    carbs_g: Math.round(t.carbs_g * scale * 10) / 10,
    fat_g: Math.round(t.fat_g * scale * 10) / 10,
    is_quick: isActuallyQuickOption({ name: t.name, foods: t.foods }, t.is_quick)
  };

  return budget > 0 && option.calories > budget ? null : option;
}

function scalePortion(portion, scale) {
  const match = String(portion).match(/^([\d.,]+)\s*(.*)$/);
  if (!match) return portion;

  const base = Number(match[1].replace(",", "."));
  const unit = match[2];
  const raw = base * scale;
  const amount = /\b(g|ml)\b/.test(unit)
    ? Math.max(5, Math.round(raw / 5) * 5)
    : Math.max(0.5, Math.round(raw * 2) / 2);

  return `${amount} ${unit}`.trim();
}
function normalizeIngredient(value) {
  return String(value || "")
    .replace(/\s*\([^)]*\)/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function inferProteinSource(option) {
  if (option.protein_source) return normalizeIngredient(option.protein_source);
  const ingredients = (option.foods || []).map(normalizeIngredient).join(" ");
  const name = normalizeIngredient(option.name);
  const text = `${name} ${ingredients}`;
  const sources = [
    ["whey", /\bwhey\b/],
    ["frango", /\bfrango\b/],
    ["carne", /\bcarne\b/],
    ["peixe", /\b(peixe|atum|salmao)\b/],
    ["ovos", /\bovos?\b/],
    ["soja", /\b(tofu|soja|edamame)\b/],
    ["laticinios", /\b(iogurte|leite|queijo)\b/],
    ["leguminosas", /\b(lentilha|grao-de-bico|homus|feijao)\b/],
    ["oleaginosas", /\b(amendoim|pasta de amendoim)\b/]
  ];
  return sources.find(([, pattern]) => pattern.test(text))?.[0] || "mista";
}

export function isActuallyQuickOption(option, candidate = null) {
  const explicitlyQuick = candidate ?? option?.is_quick ?? /\b(shake|sandu[ií]che|omelete|ovos mexidos|iogurte|bebida|tapioca)\b/i.test(option?.name || "");
  if (!explicitlyQuick) return false;
  const preparation = normalizeIngredient([option?.name, ...(option?.foods || [])].join(" "));
  return !/\b(?:frango|carne|peixe|salmao|tilapia|arroz|feijao|batata|macarrao|lentilha|grao-de-bico|edamame)\b/.test(preparation);
}

function enrichOption(option) {
  const proteinSource = inferProteinSource(option);
  const compositionKey = option.composition_key || [
    proteinSource,
    ...(option.foods || []).map(normalizeIngredient).sort()
  ].join("|");
  const isQuick = isActuallyQuickOption(
    option,
    option.is_quick ?? /\b(shake|sandu[ií]che|omelete|ovos mexidos|iogurte|bebida|tapioca)\b/i.test(option.name || "")
  );

  return {
    ...option,
    protein_source: proteinSource,
    composition_key: compositionKey,
    is_quick: Boolean(isQuick),
    category: isQuick
      ? "preparo rápido"
      : option.category === "preparo rápido" || !option.category
        ? "refeição completa"
        : option.category
  };
}

const UNCOMMON_GENERIC_FOODS = ["tofu", "tempeh", "edamame", "homus", "bebida de soja", "iogurte de soja", "lentilha", "grão-de-bico"];

function hasKnownFood(available, ingredient) {
  const target = normalizeIngredient(ingredient);
  return available.some((food) => food === target || food.includes(target) || target.includes(food));
}

function optionContainsIngredient(option, ingredient) {
  const needle = normalizeIngredient(ingredient);
  if (!needle) return false;
  const text = normalizeIngredient([option?.name, ...(option?.foods || [])].join(" "));
  return text.includes(needle);
}

function matchesRequiredFoods(option, requiredFoods = []) {
  return requiredFoods.every((ingredient) => optionContainsIngredient(option, ingredient));
}

function matchesExcludedComposition(option, excludedCompositions = []) {
  return excludedCompositions.some((composition) => {
    const ingredients = Array.isArray(composition)
      ? composition
      : composition?.ingredients;
    return Array.isArray(ingredients) && ingredients.length >= 2
      && ingredients.every((ingredient) => optionContainsIngredient(option, ingredient));
  });
}

function allFoodsAvailable(option, availableFoods = []) {
  return (option.foods || []).every((food) => hasKnownFood(
    availableFoods,
    normalizeIngredient(food).split(" (")[0]
  ));
}

function compareOptionDiversity(left, right, selected, recentCompositionKeys, recentProteinSources, macroPriority, recentFoods, availableFoods, preferSmaller) {
  const score = (option) => {
    const selectedSources = new Set(selected.map((item) => item.protein_source));
    const ingredients = (option.foods || []).map(normalizeIngredient);
    const knownCount = availableFoods.length
      ? availableFoods.filter((food) => ingredients.some((ingredient) => ingredient.includes(food) || food.includes(ingredient))).length
      : 0;
    const repeatCount = ingredients.filter((ingredient) => recentFoods.has(ingredient.split(" ")[0])).length;
    return [
      recentCompositionKeys.has(option.composition_key) ? 1 : 0,
      recentProteinSources.has(option.protein_source) ? 1 : 0,
      selectedSources.has(option.protein_source) ? 1 : 0,
      option.is_quick && availableFoods.includes("whey") && option.protein_source === "whey" ? -1 : 0,
      -knownCount,
      repeatCount,
      macroPriority === "protein" ? -option.protein_g : 0,
      preferSmaller ? option.calories : 0
    ];
  };
  const leftScore = score(left);
  const rightScore = score(right);
  for (let index = 0; index < leftScore.length; index++) {
    if (leftScore[index] !== rightScore[index]) return leftScore[index] - rightScore[index];
  }
  return 0;
}

function selectDiverseOptions(options, limit, recentOptions, macroPriority, availableFoods = [], preferSmaller = false) {
  const unique = [...new Map(options.map((option) => [option.composition_key, option])).values()];
  const recent = recentOptions.map(enrichOption);
  const recentCompositionKeys = new Set(recent.map((option) => option.composition_key));
  const recentProteinSources = new Set(recent.map((option) => option.protein_source));
  const recentFoods = new Set(recent.flatMap((option) => (option.foods || []).map((food) => normalizeIngredient(food).split(" ")[0])));
  const selected = [];
  const remaining = [...unique];
  const takeBest = (pool) => {
    if (!pool.length || selected.length >= limit) return;
    pool.sort((left, right) => compareOptionDiversity(
      left,
      right,
      selected,
      recentCompositionKeys,
      recentProteinSources,
      macroPriority,
      recentFoods,
      availableFoods,
      preferSmaller
    ));
    const option = pool[0];
    selected.push(option);
    remaining.splice(remaining.findIndex((item) => item.composition_key === option.composition_key), 1);
  };

  const nonQuick = remaining.filter((option) => !option.is_quick);
  while (selected.length < Math.min(limit - 1, nonQuick.length) && remaining.length) {
    takeBest(nonQuick.filter((option) => remaining.includes(option)));
  }
  takeBest(remaining.filter((option) => option.is_quick));
  while (selected.length < limit && remaining.length) takeBest(remaining);

  return selected;
}

export function generateMealOptions({
  mealPeriod,
  calorieBudget,
  macroBudget = {},
  macroPriority = null,
  dislikes = [],
  availableFoods = [],
  recentOptions = [],
  additionalOptions = [],
  requiredFoods = [],
  excludedCompositions = [],
  onlyAvailableFoods = false,
  preferSmaller = false,
  quickOnly = false,
  excludeRecentOptions = false,
  limit = 3
}) {
  const templates = TEMPLATES[mealPeriod] || TEMPLATES.jantar;
  const rejected = dislikes.flatMap((item) => String(item).split(/[,;\n]/))
    .map((item) => item.trim())
    .filter(Boolean);
  const available = availableFoods.map((food) => normalizeIngredient(food));
  const options = templates
    .filter((template) => !template.foods.some((food) => UNCOMMON_GENERIC_FOODS.some((uncommon) =>
      normalizeIngredient(food).includes(uncommon)
    )) || template.foods.some((food) => UNCOMMON_GENERIC_FOODS.some((uncommon) =>
      normalizeIngredient(food).includes(uncommon) && hasKnownFood(available, uncommon)
    )))
    .filter((template) => (template.requires_available || []).every((required) =>
      available.some((food) => food === normalizeIngredient(required) || food.includes(normalizeIngredient(required)))
    ))
    .filter((template) => matchesRequiredFoods({ name: template.name, foods: template.foods }, requiredFoods))
    .filter((template) => !onlyAvailableFoods || allFoodsAvailable(template, availableFoods))
    .map((template) => makeOption(
      template,
      calorieBudget,
      rejected,
      macroBudget,
      macroPriority
    ))
    .filter(Boolean)
    .map(enrichOption)
    .concat(additionalOptions.map(enrichOption))
    .filter((option) => !option.foods.some((food) => rejected.some((item) =>
      normalizeIngredient(food).includes(normalizeIngredient(item))
    )))
    .filter((option) => matchesRequiredFoods(option, requiredFoods))
    .filter((option) => !onlyAvailableFoods || allFoodsAvailable(option, availableFoods))
    .filter((option) => !matchesExcludedComposition(option, excludedCompositions))
    .filter((option) => validateMealOption(
      option,
      calorieBudget,
      macroBudget,
      { macroPriority }
    ).valid)
    .filter((option) => !option.foods.some((food) => /\bwhey\b/i.test(food)) || available.includes("whey"));

  let optionsForSelection = options;
  if (quickOnly) optionsForSelection = optionsForSelection.filter((option) => option.is_quick);
  optionsForSelection = filterPreviouslyOffered(optionsForSelection, recentOptions, excludeRecentOptions);
  return selectDiverseOptions(
    optionsForSelection,
    Math.max(0, Math.floor(limit)),
    recentOptions,
    macroPriority,
    available,
    preferSmaller
  );
}
export function buildDailyMealPlan({summary,currentPeriod,dislikes=[],availableFoods=[],date,existingPlanId}) {
 const periods=ORDER.slice(Math.max(0,ORDER.indexOf(currentPeriod))),left=n(summary?.calorie_remaining),total=periods.reduce((s,p)=>s+WEIGHTS[p],0)||1;
 const nutritionBudget=analyzeRemainingNutritionBudget(summary);
 const macroPriority=nutritionBudget.priority === "protein" ? "protein" : null;
 const meals=periods.map(period=>{const fraction=WEIGHTS[period]/total,budget=left===null?null:(left>0?left*fraction:0),macroBudget={};for(const [key,field] of [["protein_g","protein_remaining"],["carbs_g","carbs_remaining"],["fat_g","fat_remaining"]]){const value=n(summary?.[field]);macroBudget[key]=value===null?null:value*fraction;}return{period,calorie_budget:budget===null?null:Math.round(budget),macro_budget:macroBudget,options:generateMealOptions({mealPeriod:period,calorieBudget:budget,macroBudget,macroPriority,dislikes,availableFoods})};});
 const valid=left!==null&&meals.every(m=>m.options.length>=3);return{id:existingPlanId||null,date,current_period:currentPeriod,daily_calorie_budget:left,meals,valid,note:valid?null:"Não foi possível montar três opções para todas as refeições dentro dos dados e do saldo disponíveis."};
}
export function validateMealOption(o, budget, macroBudget = {}, options = {}) {
  const vals = ["calories", "protein_g", "carbs_g", "fat_g"].map((key) => n(o?.[key]));

  if (vals.some((value) => value === null || value < 0)) {
    return { valid: false, reason: "invalid_nutrition_values" };
  }

  if (budget !== null && budget !== undefined && vals[0] > budget) {
    return { valid: false, reason: "calorie_budget_exceeded" };
  }

  for (const [index, key] of [[1, "protein_g"], [2, "carbs_g"], [3, "fat_g"]]) {
    if (options.macroPriority === "protein" && key !== "protein_g") continue;

    const allowance = n(macroBudget[key]);
    if (allowance !== null && vals[index] > allowance + 0.5) {
      return { valid: false, reason: key + "_budget_exceeded" };
    }
  }

  const implied = vals[1] * 4 + vals[2] * 4 + vals[3] * 9;
  if (Math.abs(implied - vals[0]) > Math.max(80, vals[0] * 0.35)) {
    return { valid: false, reason: "meal_macros_incompatible" };
  }

  return { valid: true, reason: null, macro_calories: implied };
}

export { estimateMealFromText, getMissingMealQuantities, generateFreeMealOptions };

export function getMealPeriods(){return[...ORDER];}

