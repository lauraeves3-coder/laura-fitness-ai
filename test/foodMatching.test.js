import { test } from "node:test";
import assert from "node:assert/strict";
import {
  containsFoodTerm, matchFoodTerms, findFoodNames,
  detectDesiredFoodCategory, restrictionBlocksDesiredFood
} from "../src/foodMatching.js";
import { generateMealOptions } from "../src/nutrition.js";

test("palavra inteira, sem acento e sem caixa", () => {
  assert.equal(containsFoodTerm("Tenho um novo whey em casa", "ovo"), false);
  assert.equal(containsFoodTerm("Tenho um novo whey em casa", "asa"), false);
  assert.equal(containsFoodTerm("Comi FEIJÃO", "feijao"), true);
  assert.equal(containsFoodTerm("grão-de-bico cozido", "grao de bico"), true);
});

test("plurais regulares do português", () => {
  for (const [text, term] of [["duas bananas", "banana"], ["2 pães franceses", "pão francês"],
    ["dois atuns", "atum"], ["pastéis", "pastel"], ["3 ovos", "ovo"], ["limões", "limão"]]) {
    assert.ok(containsFoodTerm(text, term), `${term} em ${text}`);
  }
});

test("termo mais longo vence na sobreposição", () => {
  const entries = [{ key: "farofa", terms: ["farofa"] }, { key: "farofa temperada", terms: ["farofa temperada"] }];
  assert.deepEqual(matchFoodTerms("comi farofa temperada", entries).map(({ key }) => key), ["farofa temperada"]);
});

test("alimento composto diferente não gera o alimento base", () => {
  assert.deepEqual(findFoodNames("não gosto de carne de soja nem de pão de queijo", ["carne", "queijo", "pão"]), []);
  assert.deepEqual(findFoodNames("não gosto de carne e queijo", ["carne", "queijo"]), ["carne", "queijo"]);
});

test("AI-07: categoria desejada é o primeiro alimento citado", () => {
  assert.equal(detectDesiredFoodCategory("quero sorvete de chocolate"), "sorvete");
  assert.equal(detectDesiredFoodCategory("quero chocolate amargo"), "chocolate");
  assert.equal(detectDesiredFoodCategory("quero um hambúrguer com batata frita"), "hamburger");
  assert.equal(detectDesiredFoodCategory("quero comida japonesa"), "japonesa");
});

test("AI-01: só o nome da categoria bloqueia a categoria inteira", () => {
  assert.equal(restrictionBlocksDesiredFood("pizza doce", "pizza"), false);
  assert.equal(restrictionBlocksDesiredFood("pizza", "pizza"), true);
  assert.equal(restrictionBlocksDesiredFood("Pizzas", "pizza"), true);
  assert.equal(restrictionBlocksDesiredFood("hambúrguer", "hamburger"), true);
  assert.equal(restrictionBlocksDesiredFood("frango", "pizza"), false);
});

test("só disponível: ingredientes com acento são reconhecidos", () => {
  const options = generateMealOptions({
    mealPeriod: "almoço", calorieBudget: 600, limit: 5,
    availableFoods: ["frango", "arroz", "feijão"], onlyAvailableFoods: true
  });
  assert.ok(options.some((option) => option.name === "Frango, arroz e feijão"));
});

test("EX-05: restrição 'ovo' não remove opções com 'novo'/'polvo' e remove ovos", () => {
  const options = generateMealOptions({ mealPeriod: "café da manhã", calorieBudget: 600, limit: 50, dislikes: ["ovo"] });
  assert.ok(options.every((option) => !option.foods.some((food) => /\bovos?\b/i.test(food))));
});
