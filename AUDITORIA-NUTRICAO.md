# Auditoria da nutrição — FitPulse AI

Data: 22/10/2026 · Branch: `audit/nutrition-tests` · Nenhum arquivo de `src/` alterado.

Como reproduzir: `npm test` (node:test, sem API OpenAI, sem `fitness.db`).
Testes marcados `# TODO <ID>` reproduzem um defeito confirmado; ao corrigir, remova o `todo`.
Resultado atual: 71 testes · 54 passando · 17 defeitos ainda reproduzidos · `fitness.db`/WAL com hash idêntico antes e depois.

## Estado do repositório (risco)

- Remoto: `lauraeves3-coder/laura-fitness-ai`, `main` igual a `origin/main` (commit `fa5e25a`).
- **`src/nutrition.js`, `src/nutritionCatalog.js` e `src/agent/` nunca foram commitados**; `ai.js`, `db.js`, `server.js` têm ~4.700 linhas de alterações não commitadas. Todo o trabalho nutricional existe só neste disco/OneDrive.
- `.gitignore` não cobre `fitness-before-test-reset-20261003.db`, `backup-fitpulse/`, `src - Copia/` nem as ~40 cópias `*.before-*.js` — um `git add .` publicaria o banco de backup.
- `gh` (GitHub CLI) não está instalado; o `git fetch` funcionou.

## Defeitos confirmados

| ID | Onde | Defeito | Impacto |
|---|---|---|---|
| ENC-01 | `ai.js` (96 linhas), `agent/agent.js` (50) | UTF-8 duplamente codificado real (bytes `c3 83 c2 a3` = "Ã£"), não é o PowerShell. 6 linhas têm `U+FFFD` (perda irreversível: "⚠️" virou "� ️"). | Respostas ao usuário com "NÃ£o", e **o prompt de sistema enviado à OpenAI está corrompido**. Também quebra lógica (ver EX-01, EX-03, EX-04). |
| EX-01 | `extractExcludedFoods` | Texto não é normalizado; regex usa `nÃ£o`/`nao` → "não quero frango" (com acento) é ignorado. "feijão", "pão", "maçã", "salmão" na lista estão corrompidos. Janela `[^\n]{0,25}` contamina o alimento seguinte ("nao quero frango hoje, quero arroz" rejeita arroz). "sem pão" e "Não gosto de" falham. | Restrições do usuário não são respeitadas. |
| EX-04 | `getFoodRestrictions` | Celíaco → só adiciona `"pÃ£o integral"` (corrompido) e nada de pizza/massa/pão. `includes` por substring: "carne de soja" rejeita carne. | **Risco de saúde**: sugestões com glúten para celíacos. |
| EX-02 | `detectExplicitExcludedCompositions` | Forma contextual pega o **primeiro** alimento da frase: "tenho banana, aveia e leite, mas não quero tomar com água" → banana+água. | Combinação errada bloqueada. |
| EX-03 | `normalizeToolFoodList` | Chave `"salmÃ£o"` corrompida; comparação só por `toLowerCase`, sem acento. | Listas inconsistentes. |
| AI-06 | `ai.js:2734` | Qualquer combinação rejeitada responde "não vou sugerir whey com agua". | Resposta falsa. |
| AI-01 | `ai.js:3327` | `item.includes(desiredFood) \|\| desiredFood.includes(item)`: "pizza doce" no perfil bloqueia toda pizza. O gerador em `nutrition.js` está correto. | Bloqueio indevido. |
| AI-02 | `normalizeDesiredFood` | sushi/temaki/sashimi/… → `japonesa`; as variantes `sushi:` de `detectDesiredComposition`, `DESIRED_FOODS.sushi` e o ramo `desiredFood === "sushi"` em `detectRequestedServings` são **código morto**. "quero 8 peças de sushi" → 8 temakis = **1152 kcal**. | Estimativa muito errada. |
| AI-03 | `detectRequestedServings` | Sem normalizar acento ("três" falha). Números por extenso só para unidades japonesas ("duas fatias de pizza" → null). Gramas só convertem para chocolate e batata ("300 g de yakisoba" → null). | Porções ignoradas. |
| AI-07 | `normalizeDesiredFood` | `includes` + ordem da lista: "pizza doce de chocolate" → chocolate; "macarrão à bolonhesa" → **bolo**; "bolo de chocolate" → chocolate. | Categoria errada. |
| AI-04 | `extractAvailableFoods` | Substring: "novo" → ovo; "pão de queijo" → queijo; "carne de soja" → carne. | Disponibilidade falsa. |
| EX-05 | `nutrition.js` filtros de `dislikes` | Substring: restrição "sal" remove todo salmão. | Opções removidas indevidamente. |
| NC-01 | `findFoodCandidates` | Sem limite de palavra: "novo"→ovo, "casa"→asa (449 kcal em "Tenho um novo whey em casa"). | Alimentos inventados. |
| NC-05 | `chooseOccurrence` | Só a 1ª ocorrência: "uma banana e depois mais uma banana" = 88 kcal. | Consumo subestimado. |
| NC-07 | catálogo + ordenação | Alias `farofa` em dois itens; o ranking ignora `item.name`, então "farofa temperada" empata e escolhe farinha (110 kcal vs 164). | Item errado. |
| NC-02 | `nutrition.js:97` × catálogo | Sashimi: 20,8 kcal/fatia (≈10 g) vs 52 kcal (25 g). | Divergência 2,5×. |
| NC-06 | `extractQuantity` | "uma colher de sopa de azeite" não é reconhecida (cai no padrão 10 g). Fatores globais por utensílio. | Quantidade errada. |
| NC-09 | `extractQuantity` | "1/2 banana" → 180 g (lê o "2"); "meia" ignorado. | Superestimado 4×. |
| NC-10 | `estimateMealFromText` | Negação ignorada ("não comi arroz" registra arroz); "batata" sem preparo → batata frita. | Consumo inventado. |
| NC-11 | catálogo | Plural "pães franceses" e "bife" não reconhecidos; "10 peças de sushi" → nada. | Cobertura. |
| NC-04 | confiança | "temaki de salmão" escolhe silenciosamente `temaki-philadelphia` com confiança `high`. | Confiança enganosa. |

Mantidos como hipóteses/limitações (sem teste ainda): NC-03 (19 grupos de modelos repetidos), NC-08 (refeições livres agregadas), AI-05 (lista fixa de disponibilidade), `makeMealTemplate` filtra componentes silenciosamente, `saveMeal` sem validação. `src/ai.before-workout-fix.js` segue fora do runtime, não tocado.

## Correções aplicadas

- **ENC-01 (resolvido):** `scripts/fix-mojibake.mjs` reparou 191 sequências em `ai.js` e 168 em `agent/agent.js` (prompt de sistema). As 7 linhas com `U+FFFD` foram restauradas manualmente (`⚠️`, `à sua`, `REFEIÇÃO`). Os demais arquivos ativos não tinham ocorrências. Efeito colateral positivo: "não quero frango" e "Não gosto de banana" passaram a ser reconhecidos (EX-01 parcial), "pão integral" para celíacos voltou a ser legível (EX-04 ainda incompleto) e "Salmão" volta a ser normalizado (EX-03 parcial).

- **Etapa 3, matcher único (resolvido: NC-01, NC-05, NC-07, AI-04, AI-07, EX-04, EX-05, AI-01):** novo `src/foodMatching.js` (palavra inteira, sem acento/caixa/hífen, plurais regulares, termo mais longo vence, alimentos compostos distintos como "carne de soja" e "pão de queijo"). Usado por `findFoodCandidates`/`estimateMealFromText` (todas as ocorrências; menções repetidas só somam com quantidade explícita), `extractAvailableFoods`, `getFoodRestrictions` (celíaco agora restringe `GLUTEN_FOODS`, aveia inclusa por contaminação cruzada), `normalizeDesiredFood` (primeiro alimento citado), pré-checagem de restrição (só o nome da categoria bloqueia a categoria) e filtros de `nutrition.js`. Alias `farofa` removido da farinha de mandioca: "farofa" = farofa temperada (164 kcal).
  - Comparação de comportamento antes/depois em 30 mensagens, 30 cenários de sugestão e 24 de alimento desejado: só mudaram ordem dos itens, farofa, deduplicação de disponibilidade/restrições e um bug adicional corrigido — `allFoodsAvailable` comparava "feijão" sem normalizar, então "só tenho frango, arroz e feijão" nunca encontrava o prato.

## Plano de correção (ordem por dependência)

1. **Higiene do repositório** — commitar `nutrition.js`, `nutritionCatalog.js`, `agent/` e os testes; ampliar `.gitignore` para `*.db`, backups e cópias. (Depende de aprovação.)
2. **ENC-01** — reparar o mojibake com script determinístico (latin1→utf8 apenas nas sequências `Ã.`), revisar diff manual das 6 linhas com `U+FFFD`. Desbloqueia EX-01/03/04.
3. **Matcher único** — criar `src/foodMatching.js` com normalização + busca por limite de palavra + alias mais longo primeiro + todas as ocorrências. Usar em `findFoodCandidates`, `extractAvailableFoods`, `extractExcludedFoods`, `getFoodRestrictions`, filtros de `nutrition.js` e `normalizeDesiredFood` (NC-01, NC-05, NC-07, AI-04, AI-07, EX-04, EX-05, AI-01).
4. **Quantidades** — frações/"meia", "colher de sopa", números por extenso com acento, gramas para qualquer categoria (NC-06, NC-09, AI-03).
5. **Comida japonesa** — manter `japonesa` como categoria mas preservar o subtipo (sushi/sashimi/temaki) para composição e porções; "peças" sem tipo → pedir esclarecimento; alinhar sashimi entre módulos com fonte registrada (AI-02, NC-02).
6. **Restrições e respostas** — negativa por cláusula, composição pelo alimento mais próximo, resposta de AI-06 gerada da composição detectada.
7. **Negação/preparo no registro** — "não comi X", "batata" sem preparo → perguntar (NC-10).
8. Mover as funções puras de `ai.js` para módulo importável e trocar `test/helpers/aiPure.js` por import direto.

Só depois: testes pagos mínimos de API e WhatsApp (Fase 5).
