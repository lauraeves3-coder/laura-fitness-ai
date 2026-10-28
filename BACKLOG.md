# Backlog — FitPulse AI / Laura Fitness AI

Fonte: backlog completo enviado pela usuária em 23/10/2026. Todos os itens são requisitos do produto; não implementar tudo de uma vez.
Auditoria de status: 23/10/2026, branch `audit/nutrition-tests`; atualizado a cada item concluído (ver Histórico de status).

## Como ler

**Status**
- `IMPLEMENTADO E TESTADO` — existe e tem teste automatizado reproduzível em `test/` (`npm test`).
- `IMPLEMENTADO NÃO TESTADO` — existe no código e foi lido na auditoria, mas sem teste automatizado; pode ter defeitos.
- `PARCIAL` — existe só parte do requisito.
- `NÃO IMPLEMENTADO` — não há código para isso.
- `BLOQUEADO` — depende de decisão, autorização, dado externo ou outro item.
- `NÃO AUDITADO` — não verificado.

Nenhum item foi validado contra a API da OpenAI ou o WhatsApp reais (Fase 5 pendente de autorização). "Testado" significa teste local determinístico; os testes com modelo simulado (`test/e2e.test.js`) verificam o fluxo do código quando o modelo chama uma ferramenta, não se o modelo real escolheria essa ferramenta.

**Prioridade** — `P0` estabilizar o existente · `P1` próxima expansão (catálogo, composições, porções, refeição livre) · `P2` novos módulos centrais · `P3` futuro.

**Regra de manutenção** — nova solicitação entra como novo ID; nenhum requisito é apagado; lacunas viram decisão pendente (seção DEC), nunca suposição. Só marcar como testado com teste reproduzível citado.

---

## CONV — Produto e conversa

| ID | Requisito | Prio | Status | Depende de | Arquivos / evidência |
|---|---|---|---|---|---|
| CONV-01 | Assistente persistente e natural em pt-BR via WhatsApp | P0 | PARCIAL | ARQ-05 | `server.js`/`app.js` webhook só texto; `ai.js` + `agent/agent.js` |
| CONV-02 | Entender coloquial, abreviações, erros de digitação, respostas curtas | P1 | PARCIAL | — | erros de digitação: alimentos sem correspondência exata são comparados com o catálogo (1 letra trocada/faltando/sobrando ou invertida; 2 em palavras de 8+ letras; só com candidato único; lista de palavras comuns protegida), correções do mesmo tamanho refazem a busca de nomes compostos ("suco de laranaj") e a descrição salva usa a grafia corrigida; metas aceitam erro na palavra "meta" (só relato de consumo é barrado) e nomes de nutrientes com erro ("protiena", "carboidrto", "gordra"); o agente foi instruído a interpretar erros pela intenção (`test/catalog.test.js`, `test/e2e.test.js`). Restante da conversa depende do modelo |
| CONV-03 | Datas relativas ("ontem", "segunda") em registros e consultas | P1 | IMPLEMENTADO E TESTADO | — | `src/dates.js` (hoje, ontem, anteontem, dias da semana, dd/mm, esta semana/passada, últimos N dias, este mês/passado; sem futuro); relato "ontem no jantar comi…" grava na data e período citados, fora do saldo de hoje, sem duplicar; `test/dates.test.js`, `test/e2e.test.js`. Registro pelo agente (`record_meal`) ainda sem data |
| CONV-04 | Várias intenções numa mesma mensagem | P1 | PARCIAL | ARQ-02 | agente pode chamar várias ferramentas; sem teste |
| CONV-05 | Router para uma ou várias áreas; confirmar, registrar, corrigir, cancelar | P0 | PARCIAL | ARQ-02 | pré-roteamento determinístico em `ai.js processMessage` + ferramentas do agente |
| CONV-06 | Mínimo de perguntas; estimar só quando aceitável; declarar incerteza | P0 | PARCIAL | — | `needs_clarification`, `approximate_quantity`, `confidence` no catálogo (testados) |
| CONV-07 | Distinguir disponível / obrigatório / desejado / excluído / composição excluída / sugerida / escolhida / consumida / correção | P0 | PARCIAL | — | campos em `buildExplicitMealRequestFacts`; eventos em `meal_plan_events`; partes testadas em `test/intent.test.js` |
| CONV-08 | Memória estruturada: perfil, preferências/hábitos, contexto episódico | P1 | PARCIAL | — | tabela `users` (perfil, dislikes, preferências), `meal_plan_events`; sem memória de rotinas, eventos, provas |
| CONV-09 | Pergunta pendente com estado (responder "patinho" após "qual bife?") | P0 | IMPLEMENTADO E TESTADO | — | `resolveGenericFoodAnswer` (`mealIntent.js`), estado em `users.pending_meal_clarification`, `handlePendingMealClarification` (15 min); `test/intent.test.js`, `test/db.test.js`, `test/e2e.test.js` |
| CONV-10 | Áudio: receber, transcrever, interpretar; depois responder em áudio | P2 | PARCIAL | ARQ-05 | áudio do WhatsApp é baixado, transcrito (`gpt-4o-mini-transcribe`, pt) e segue o fluxo de texto; a resposta mostra o que foi entendido; falha ou áudio vazio pedem texto (`test/e2e.test.js`, transcrição simulada). Falta responder em áudio e validar com a OpenAI real (Fase 5) |
| CONV-11 | Notificações, lembretes e proatividade sem excesso | P2 | PARCIAL | — | "me lembre de beber água" (aviso às 10h–20h a cada 2 h, só abaixo do ritmo da meta) e "me mande o resumo do dia às 21h" ativam; "pare os lembretes…" desativa; cada lembrete sai uma vez por horário (`src/reminders.js`, `test/e2e.test.js`). Limite do WhatsApp: fora da janela de 24 h exige template aprovado (não implementado). Faltam lembretes de refeição/treino e preferências de silêncio |
| CONV-12 | Perfil de comunicação: aprender se a pessoa prefere respostas curtas ou detalhadas e manter o tom natural, amigável e sem julgamento (prompt mestre §95) | P2 | IMPLEMENTADO E TESTADO | CONV-08 | src/replyStyle.js + users.reply_style: 'prefiro respostas curtas', 'isso ficou muito longo', 'mais detalhadas', 'volte ao normal' (sem o modelo) guardam a preferência; ela entra nas instruções do agente (não no contexto, que é tratado como dado). Tom natural e sem julgamento nos dois estilos. test/e2e.test.js |

## NUT — Nutrição e registro alimentar

| ID | Requisito | Prio | Status | Depende de | Arquivos / evidência |
|---|---|---|---|---|---|
| NUT-01 | Registro por linguagem natural com alimento, quantidade, unidade e porção | P0 | IMPLEMENTADO E TESTADO | — | `nutritionCatalog.js estimateMealFromText`; `test/catalog.test.js` |
| NUT-02 | Identificar marca/produto, corte e preparo | P1 | PARCIAL | CAT-03, SUP-01 | termos genéricos batata/bife pedem preparo (testado); poucas marcas no catálogo |
| NUT-03 | Pratos compostos, marmita, PF, buffet, combos, rodízio, restaurante, delivery | P1 | PARCIAL | — | prato feito/PF/marmita/quentinha desdobra arroz 150 g, feijão 140 g e salada 50 g (porções estimadas, marcadas como aproximação) mais a proteína citada; sem proteína, pergunta (frango, patinho, ovo, tilápia) e a resposta completa o prato; conteúdo descrito ("marmita de arroz, feijão e frango") vale sozinho. Lanches da TBCA: x-burguer, x-salada, x-frango, misto quente/frio, sanduíche americano (`test/catalog.test.js`, `test/e2e.test.js`). Faltam buffet por quilo, rodízio, x-tudo/x-bacon/x-egg (sem equivalente na TBCA) |
| NUT-04 | kcal, proteínas, carboidratos, gorduras | P0 | IMPLEMENTADO E TESTADO | — | `test/catalog.test.js` |
| NUT-05 | Outros nutrientes (fibras, sódio, açúcares…) | P2 | NÃO IMPLEMENTADO | CAT-08 | catálogo só tem kcal/P/C/G |
| NUT-06 | Medidas caseiras e conversão específica por alimento/densidade | P1 | IMPLEMENTADO E TESTADO | — | `src/householdMeasures.js`: medidas da TBCA para 75 alimentos (colher de sopa/sobremesa/chá/café/servir, cheia ou rasa, concha, escumadeira, xícara, fatia, unidade, lata); vencem a genérica e não contam como aproximação. Ex.: colher de sopa de arroz 20 g, concha de feijão 140 g, fatia de muçarela 20 g, cream cracker 7 g, colher de sopa de azeite 8 g. Sem medida do alimento, vale a genérica marcada como aproximação (`test/catalog.test.js`) |
| NUT-07 | Vários alimentos e várias ocorrências; sem falsos positivos de alias | P0 | IMPLEMENTADO E TESTADO | — | `foodMatching.js`; `test/foodMatching.test.js`, `test/catalog.test.js` |
| NUT-08 | Diferenciar cru/cozido/assado/grelhado/frito | P1 | PARCIAL | CAT-01 | testado para cortes bovinos, frango, tilápia, ovos, batata e mandioca (`test/catalog.test.js`); sem preparo citado vale o padrão do item (DEC-13, decidido); demais alimentos ainda com um preparo só |
| NUT-09 | Perguntar só o dado ausente; não pedir gramas quando a unidade é conhecida | P0 | IMPLEMENTADO E TESTADO | — | `getQuantityQuestions`/`applyQuantityAnswer` (`nutritionCatalog.js`): pergunta só itens de peso/volume sem quantidade, itens por unidade assumem 1 unidade, whey assume 1 scoop (DEC-12); resposta por item, só a quantidade, número solto em gramas, parcial, "padrão"; estado em `pending_meal_clarification` (15 min); `test/e2e.test.js` |
| NUT-10 | Corrigir registro sem duplicar | P0 | IMPLEMENTADO E TESTADO | — | `db.js correctMeal` por ID; correção sem descrição mantém a original (bug do texto fixo "Refeição corrigida" corrigido); `test/db.test.js`, `test/e2e.test.js` via ferramenta `correct_meal` simulada |
| NUT-11 | Excluir registro | P0 | IMPLEMENTADO E TESTADO | — | `db.js deleteMeal` com cópia em `meal_plan_events`, confirmação explícita em 2 passos, cancelamento, isolamento por usuário; `test/db.test.js`, `test/e2e.test.js` |
| NUT-12 | Distinguir consumo de intenção, sugestão e escolha; confirmar antes de salvar | P0 | IMPLEMENTADO E TESTADO | — | ferramentas `choose_meal_option`, `confirm_meal_consumption`; `consumeMealSelection`; escolha não registra, confirmação registra uma vez, confirmação sem escolha não registra (`test/e2e.test.js`) |
| NUT-13 | Evitar registros duplicados | P0 | IMPLEMENTADO E TESTADO | — | reenvio do WhatsApp (`claimWhatsAppMessage`); confirmação dupla de opção (`alreadyConsumed`); mesma descrição + calorias em 10 min (`findRecentDuplicateMeal`), salvo "de novo/outra vez" (`isExplicitRepeatMeal`); `test/db.test.js`, `test/e2e.test.js`, `test/intent.test.js` |
| NUT-14 | Histórico por data/período; consumo diário e semanal | P1 | IMPLEMENTADO E TESTADO | — | `getMealsBetween` + `detectHistoryQuery`/`buildPeriodHistoryReply`: dia (refeições, total, meta atual) e período (por dia, dias com registro, média, meta atual) sem chamar o modelo; `test/e2e.test.js`, `test/db.test.js`. Metas antigas não são guardadas: compara com a meta atual |
| NUT-15 | Saldo de kcal/macros atualizado após registro e correção | P0 | IMPLEMENTADO E TESTADO | — | `getDailySummary`, `calculateNutritionBalance`; saldo após registro, confirmação, correção e exclusão, e resumo via `get_nutrition_state` (`test/e2e.test.js`); saldo de macros não testado isoladamente |
| NUT-16 | Metas personalizadas, ajuste manual, restaurar automáticas | P0 | IMPLEMENTADO E TESTADO | — | `setCustomCalorieTarget`, `restoreAutomaticNutritionTargets` e a proteção contra alteração sem pedido explícito; `test/e2e.test.js` (metas de macros ainda sem teste) |
| NUT-17 | Validar coerência das metas e valores zero/negativos | P0 | IMPLEMENTADO E TESTADO | — | recusa calorias ≤ 0 ou > 10.000 e macros < 0 ou > 1.000 g com mensagem explícita (antes: "Entendi. Como posso te ajudar?"); avisa incompatibilidade calorias × macros sem ajuste silencioso; "meta de proteína para 140 g" passou a ser reconhecida; `test/e2e.test.js`. Limiar de aviso para metas muito baixas: DEC-11 |
| NUT-18 | Plano diário por refeição com orçamento e adaptação ao consumido | P0 | IMPLEMENTADO E TESTADO | — | `buildDailyMealPlan`, `getMealBudget`; tabela `meal_plans`; criação, orçamento ≤ saldo, exigência de meta e de pedido explícito, intenção de seguir (`test/e2e.test.js`). Bug corrigido: criação de plano sempre falhava (variável fora de escopo) |
| NUT-19 | Refeições livres: frequência, dia/período, categorias favoritas | P1 | IMPLEMENTADO E TESTADO | — | colunas `free_meal_*`; `setFreeMealSettings`; `generateFreeMealOptions`; configuração numa frase e passo a passo, recusa, consulta, sugestões que aprendem a categoria, dia da refeição livre (`test/e2e.test.js`). Bugs corrigidos: "1 refeição" no singular e a resposta "2" (sugerida pela pergunta) não eram reconhecidas |
| NUT-20 | Refeições livres com ingredientes, porções e fonte | P1 | PARCIAL | — | 20 de 36 opções têm composição em itens do catálogo (`FREE_MEAL_COMPOSITIONS`): totais, ingredientes com gramas e fonte vêm do catálogo, e a resposta lista as porções (ex.: 2 fatias de muçarela 570→515 kcal; feijoada completa 900→764). As outras 16 (combos BK, combinado japonês, massas cremosas, burrito, nachos…) seguem como estimativa agregada marcada "valores estimados" por falta dos itens no catálogo (`test/desiredFood.test.js`) |
| NUT-21 | Cravings: priorizar o alimento desejado e encaixar no dia | P0 | IMPLEMENTADO E TESTADO | — | `generateDesiredFoodOptions`; `test/desiredFood.test.js` |
| NUT-22 | Fome e saciedade (horário, intensidade, padrões) | P3 | NÃO IMPLEMENTADO | — | — |
| NUT-23 | Restrições alimentares e combinações rejeitadas | P0 | IMPLEMENTADO E TESTADO | — | `mealIntent.js`; `test/intent.test.js` |
| NUT-24 | Validação nutricional ao salvar refeição | P0 | IMPLEMENTADO E TESTADO | — | `validateMealRecord` (`nutrition.js`) em `saveMeal`/`correctMeal` e no `ai.js`; `test/db.test.js` |
| NUT-25 | Peso por unidade correto em itens multiunidade (pão de queijo) | P1 | IMPLEMENTADO E TESTADO | — | porção contável = 1 item (pão de queijo 60 g/2 un. → 30 g/1 un.); pesos por unidade conferidos nas medidas caseiras da TBCA (DEC-01): pizza 120→90 g/fatia, coxinha e empada 100→50 g, pão de hambúrguer 55→70, pão de leite 50→40, iogurte 170/150→100 g/pote, kiwi, laranja, mexerica, mamão, esfiha, cachorro-quente, queijo coalho; sugestões de pizza derivam do catálogo (`test/catalog.test.js`, `test/desiredFood.test.js`). Mantidos por divergirem da unidade inteira: banana prata (TBCA 40 g por pedaço; catálogo 90 g), sorvete (TBCA porção 50 g; catálogo 1 bola 60 g), ovo mexido e clara (TBCA por porção) |
| NUT-26 | "Pizza inteira" e outros inteiros (bolo, pacote) não viram 1 porção | P1 | IMPLEMENTADO E TESTADO | — | Inteiros com tamanho padrão avisado na resposta ('📐 Considerei…'): pizza grande 8 fatias (média 6, broto 4, família 12), bolo 12 fatias, torta 8, pacote de biscoito recheado 130 g / biscoito 200 g, salgadinho 90 g, caixa de bombom 250 g, barra de chocolate 90 g; sabor depois de 'inteira' e plural ('2 pizzas inteiras'). Sem padrão conhecido, pergunta. 'prato' vale para pratos servidos inteiros (feijoada 2 pratos = 600 g) e como resposta ('1 prato'). test/catalog.test.js, test/e2e.test.js |
| NUT-27 | Ajuste do dia em tempo real: refeição maior que o plano recalcula o saldo e adapta as próximas refeições, sem tom moralista (prompt mestre §87) | P1 | IMPLEMENTADO E TESTADO | — | planDayAdjustment (nutrition.js): refeição 20%+ e 120+ kcal acima da sua fatia do dia mostra 'Ajuste do dia' no registro, redistribui o saldo pelas próximas refeições (mesmos pesos do plano), lembra a proteína que falta; meta já batida sugere opções leves; sem tom de culpa. test/e2e.test.js |

## CAT — Catálogo alimentar brasileiro

| ID | Requisito | Prio | Status | Depende de | Arquivos / evidência |
|---|---|---|---|---|---|
| CAT-01 | Expandir catálogo para alimentação real (caseiros, regionais, padaria, doces, bebidas, industrializados) | P1 | PARCIAL | CAT-08 | 395 itens em `nutritionCatalog.js` (267 com código TBCA). Escopo decidido pela usuária (24/10/2026): cobrir a grande maioria do que o brasileiro come, dentro e fora da dieta, não todas as comidas. Teste de cobertura com ~90 alimentos comuns (`test/catalog.test.js`): todos reconhecidos ou com pergunta ("peixe", "atum", "strogonoff", "castanha", "linguiça", "sushi", "crepe", "queijo" perguntam o tipo; "pão" = pão francês). +37 itens da TBCA em 24/10 (margarina, pera, omelete, salsicha, legumes, pudim, pipoca, cerveja, vinho, chá, mingau, caldo verde, galinhada, baião, acarajé, pamonha, canjica, nuggets, churros, panqueca, crepes, paçoca, gelatina…). Sem fonte na TBCA, ficam para o cadastro pela usuária (CAT-09): quibe frito, sopa de legumes, sanduíche natural, wrap, x-tudo |
| CAT-02 | Comida japonesa padrão Brasil (inclui jow/joe, harumaki, combinados, rodízios, molhos) | P1 | PARCIAL | — | subtipos e recheios testados; harumaki (comum e de camarão), kappa maki, shoyu e teriyaki com código TBCA; joe/jow por estimativa de composição (não existe na TBCA); peso por peça segue a medida caseira da TBCA (hossomaki 25→30 g, tempurá 100→70 g por unidade); sugestões de japonesa (`DESIRED_FOODS.japonesa`) agora derivam do catálogo (testado). Faltam combinados, rodízio e tarê |
| CAT-03 | Cortes bovinos e métodos de preparo | P1 | IMPLEMENTADO E TESTADO | — | 16 cortes da TBCA (patinho, alcatra, contrafilé, coxão duro/mole, cupim, filé-mignon, fraldinha, lagarto, maminha, músculo, acém, picanha c/ e s/ gordura, costela, fígado, carne moída, carne-seca) em cru/cozido/grelhado-assado/frito quando a TBCA tem; `test/catalog.test.js`; `docs/fontes-tbca.md` |
| CAT-04 | Fast food por marca e cardápio brasileiro | P1 | PARCIAL | DEC-04 | `BRANDED_FAST_FOOD_CATALOG` (68 itens de marca, maioria "official_menu_item_estimate") |
| CAT-05 | Interpretar marca+produto+tamanho+combo; decompor combos sem duplicar | P1 | PARCIAL | CAT-04 | combos Big Mac, Quarterão e McChicken desdobram lanche + batata média + refrigerante 500 ml a partir da mesma composição da refeição livre (`DISH_EXPANSIONS`, `test/catalog.test.js`). Faltam tamanhos (P/M/G), outras marcas e troca de bebida |
| CAT-06 | Guardar fonte, data, confiança e status de cada dado | P1 | PARCIAL | — | campo `source` em todos; campo `reference` (código TBCA + data de consulta) em 224 itens (todo item `tbca_verified` tem código, testado), listados em `docs/fontes-tbca.md` (gerado por `scripts/gerar-fontes-tbca.mjs`, sincronia testada); demais itens sem data nem status |
| CAT-07 | Sem aliases falsos, duplicatas ou valores incoerentes | P0 | IMPLEMENTADO E TESTADO | — | `test/catalog.test.js` (IDs únicos, alias único, energia × macros) |
| CAT-08 | Catálogo atualizável sem editar código | P1 | IMPLEMENTADO E TESTADO | — | `data/catalogo-extra.json` (ou `FITPULSE_CATALOG_EXTRA`) é somado ao catálogo na inicialização, com validação (id único, macros e energia coerentes, fonte; TBCA exige código); inválidos ficam em `CATALOG_EXTRA_ISSUES`. Formato em `docs/catalogo-extra.md` (`test/catalogExtra.test.js`). O catálogo base segue em JS |
| CAT-09 | Alimento desconhecido: perguntar dados, calcular e cadastrar | P1 | PARCIAL | — | "cadastrar alimento: nome, 100 g tem X kcal, P/C/G" grava em `user_foods` só para a usuária (porção de referência convertida para 100 g, validação do CAT-08) e o registro passa a reconhecê-lo; cadastro incompleto diz o que falta (`src/userFoods.js`, `test/e2e.test.js`). Falta: oferecer o cadastro sozinho quando um alimento não é reconhecido |
| CAT-10 | Validar fontes dos ~200 itens "curated_estimate" | P1 | PARCIAL | DEC-01 | Suínos, aves assadas, soja, japonesa e pizzas (+35): lombo, pernil e bisteca suínos, coxa e asa de frango assadas, peru, frango desfiado, clara de ovo, tofu, edamame, bebida e iogurte de soja, shari, temakis e uramakis de salmão/Philadelphia, hot roll, hossomaki, Califórnia, guioza, yakisoba, tempurá, 12 pizzas (muçarela, calabresa, frango c/ requeijão, portuguesa, quatro queijos, marguerita, napolitana, atum, palmito, pepperoni, presunto, vegetariana); patinho refogado ganhou o código que faltava. Divergências maiores: pizzas +10–25% (ex.: calabresa 258→297 kcal/100 g, pepperoni 267→334), uramaki Califórnia 160→140, tempurá 220→189, iogurte de soja 60→49. Sem equivalente na TBCA (seguem estimativa, 57 itens): 21 sabores de pizza e a pizza genérica, nigiri, uramaki skin/atum, temakis de atum/camarão/kani/shimeji, sunomono, missoshiru (só pó), salada de kani, homus, além dos já listados. Antes — pratos, salgados, doces e bebidas (+33): feijoada, strogonoffs, lasanha, parmegianas, escondidinho, coxinha, pastel, esfirra, empada, cachorro-quente, brigadeiro, beijinho, goiabada, chocolates, sorvete, sucos, refrigerantes, água de coco, milk-shake, tapioca, purê, biscoitos, granola, macarrão, aveia, farinha de mandioca. Sem equivalente na TBCA (seguem estimativa): pão de queijo (só mistura), doce de leite (só diet), café coado (só pó), farofa temperada, polenta frita, cuscuz simples (só c/ manteiga), sorvete de chocolate. Antes: 106 itens revalidados na TBCA em 23/10/2026 (carnes, frango, peixes e frutos do mar, ovos, tubérculos, arroz, feijões, pães, laticínios, frutas, legumes, gorduras, oleaginosas, embutidos); divergências corrigidas (ex.: batata cozida 87→52 kcal, abacate 160→76, cream cheese 342→235, polvo cozido 82→156, bacon frito 541→655, mortadela 310→269, salmão cru/sashimi 208→165). Restam 125 estimativas, maioria preparações (pizzas, salgados, pratos, japonesa), doces e bebidas. Sem equivalente direto na TBCA, mantidos como estimativa: grão-de-bico escorrido, requeijão cremoso industrial, atum em água, linguiça toscana assada |
| CAT-11 | Remover/justificar modelos de refeição repetidos (NC-03) | P1 | IMPLEMENTADO E TESTADO | — | 11 cópias idênticas de whey no lanche removidas; repetições entre períodos (almoço/jantar, lanche/ceia) mantidas por serem intencionais; "Ovos mexidos com pão" passou a usar ovo mexido; teste impede composição repetida no mesmo período (`test/catalog.test.js`) |
| CAT-12 | Validação de modelos que referenciam alimento inexistente | P1 | IMPLEMENTADO E TESTADO | — | `makeMealTemplate` registra id inexistente ou gramagem inválida em `TEMPLATE_ISSUES`; teste exige lista vazia |

## SUP — Suplementos, whey e industrializados

| ID | Requisito | Prio | Status | Depende de | Arquivos / evidência |
|---|---|---|---|---|---|
| SUP-01 | Catálogo de todas as marcas relevantes no Brasil (lista no backlog original) | P2 | PARCIAL | — | whey das marcas mais vendidas (`src/supplements.js`): Dux (concentrado 14 sabores e isolado 11 sabores, tabela por sabor), Growth concentrado, Integralmédica 100% Pure, Max Titanium Top Whey 3W, Probiótica 100% Pure Whey e Optimum Nutrition Gold Standard (rótulo europeu). Faltam outras marcas (Black Skull, Darkness, Essential, Atlhetica…) e outros tipos de suplemento |
| SUP-02 | Categorias (whey tipos, caseína, albumina, creatina, pré/pós, aminoácidos, eletrólitos, géis, barras, bebidas, vitaminas…) | P2 | PARCIAL | SUP-01 | 18 categorias genéricas com valores típicos de rótulo por dose (src/supplements.js, curated_estimate): creatina, caseína, albumina, proteína vegana, hipercalórico, maltodextrina, dextrose, palatinose, gel de carboidrato, BCAA, glutamina, pré-treino, colágeno, ômega 3, barra de proteína, bebida proteica pronta, isotônico e eletrólitos; unidades cápsula/sachê/barra. Faltam marcas/sabores por categoria (SUP-01). test/catalog.test.js |
| SUP-03 | Cada SKU separado com rótulo completo, GTIN, fonte/URL, data, status, confiança | P2 | PARCIAL | SUP-01 | cada produto e sabor é um item com a fonte e a data no campo `reference` (site oficial, 24/10/2026); sabor sem tabela própria no site usa a do sabor de referência e diz isso. Faltam GTIN e status por SKU |
| SUP-04 | Dados por porção e por 100 g/ml; BR vs importado; rótulo antigo/novo | P2 | NÃO IMPLEMENTADO | SUP-03 | — |
| SUP-05 | Entender "tomei whey", marca/sabor, scoop/gramas; perguntar quando preciso | P2 | IMPLEMENTADO E TESTADO | — | "tomei 2 scoops de whey da dux sabor cookies" reconhece marca, tipo (concentrado/isolado) e sabor sem confundir sabor com fruta; scoop/dose/medida = 1 porção do rótulo, dosador = meia porção; sem marca segue o whey genérico (`test/catalog.test.js`) |
| SUP-06 | Cadastro por foto de rótulo e despensa de suplementos do usuário | P3 | NÃO IMPLEMENTADO | VIS-03, DSP-01 | — |

## VIS — Fotos, visão e OCR

| ID | Requisito | Prio | Status | Depende de | Arquivos / evidência |
|---|---|---|---|---|---|
| VIS-01 | Foto de refeição: componentes, porções com incerteza, kcal/macros, confirmar antes de registrar | P2 | PARCIAL | ARQ-05 | foto pelo WhatsApp: o webhook baixa a mídia (Graph API), o modelo lista alimentos e gramas estimadas em JSON (`src/vision.js`), o cálculo usa o catálogo e só registra após "sim"; outra mensagem descarta a leitura; itens fora do catálogo são avisados (`test/e2e.test.js`, modelo e download simulados). Não validado com a OpenAI real (Fase 5) |
| VIS-02 | Não fingir peso exato; perguntar se imagem ruim/sem escala | P2 | PARCIAL | ARQ-05 | instruções pedem estimativa sem falsa precisão e `confidence`; foto sem comida/ruim ou resposta inválida não registra e pede texto; confiança baixa é avisada (`test/e2e.test.js`). Não validado com imagens reais |
| VIS-03 | OCR de rótulo, ingredientes, receita escrita, balança | P2 | NÃO IMPLEMENTADO | VIS-01 | — |
| VIS-04 | Fotos de evolução corporal privadas por data | P3 | NÃO IMPLEMENTADO | CRP-03 | — |

## REC — Receitas

| ID | Requisito | Prio | Status | Depende de | Arquivos / evidência |
|---|---|---|---|---|---|
| REC-01 | Biblioteca com centenas de receitas realmente variadas | P2 | PARCIAL | — | 40 receitas variadas (café, almoço/jantar, lanche, pós-treino, sobremesa; vegetarianas e sem lactose) em src/recipes.js com ingredientes do catálogo. Falta chegar a centenas. |
| REC-02 | Ficha completa por receita (ingredientes, passos, rendimento, macros, tempos, equipamento, tags) | P2 | IMPLEMENTADO E TESTADO | REC-01 | Ficha com tempo, dificuldade, equipamento, rendimento, refeições, tags, ingredientes com medida caseira, modo de preparo numerado e macros por porção. test/e2e.test.js |
| REC-03 | Gerar/adaptar por objetivo, macros, tempo, equipamento, estoque, orçamento | P2 | PARCIAL | REC-01 | Busca considera despensa, saldo do dia, tempo/equipamento e o whey da pessoa: 'tenho whey de morango' pergunta a marca (e/ou sabor), guarda perfil + despensa e sugere receitas que combinam com o sabor (fruta/chocolate/neutro); a ficha usa o whey da marca com macros do rótulo. 'opções com whey' também vira receitas. src/wheyProfile.js; não gera receita nova do zero. |
| REC-04 | Filtros por tempo, dificuldade, equipamento, poucos ingredientes | P2 | IMPLEMENTADO E TESTADO | REC-01 | Filtros por refeição, tempo ('rápida', 'até 15 min'), equipamento (airfryer, forno, micro-ondas, liquidificador, sem fogão), ingrediente, vegetariana/vegana, sem lactose, rica em proteína, low carb, poucos ingredientes. test/e2e.test.js |
| REC-05 | Substituição por função culinária com recálculo | P2 | IMPLEMENTADO E TESTADO | REC-02 | 'troca o requeijão por cottage' ou 'sem leite' (troca pela função culinária) na receita aberta, com macros recalculados. test/e2e.test.js |
| REC-06 | Receitas pessoais, favoritas e recorrentes; registro por porção | P2 | PARCIAL | REC-02 | Favoritas ('favoritar', 'minhas receitas favoritas') e registro por porção ('comi a receita', 'comi 2 porções'). Falta cadastrar receita própria. |
| REC-07 | Um único cálculo nutricional compartilhado (sem motor paralelo) | P2 | IMPLEMENTADO E TESTADO | — | Macros das receitas saem do mesmo catálogo/cálculo do registro de refeições (teste compara receita x registro). test/e2e.test.js |

## DSP — Despensa, compras e orçamento

| ID | Requisito | Prio | Status | Depende de | Arquivos / evidência |
|---|---|---|---|---|---|
| DSP-01 | Inventário com quantidade, unidade, local, validade | P2 | IMPLEMENTADO E TESTADO | — | src/pantry.js + tabela pantry_items: 'comprei 1 kg de frango, 2 dúzias de ovos…' (kg/g/L/ml/dúzia/unidade/pacote/lata…), local (geladeira/freezer/armário) e validade ('vence 30/10', 'vence em 3 dias'); 'minha despensa'/'o que tenho em casa' agrupado por local com alerta de vencimento; 'o que está para vencer'; 'acabou o leite'; refeição registrada dá baixa (g/ml pelo peso, unidades pela porção do catálogo). test/e2e.test.js |
| DSP-02 | Estoque confirmado ≠ alimento mencionado/desejado | P2 | IMPLEMENTADO E TESTADO | DSP-01 | Estoque só entra com verbo de compra/guarda ('comprei', 'coloquei'); 'comprei um açaí e comi' é refeição. A despensa vai no contexto do agente como estoque confirmado, usado em available_foods só quando a pessoa pede sugestão com o que tem em casa. test/e2e.test.js |
| DSP-03 | Receitas com o que há em casa e vencimento | P3 | PARCIAL | DSP-01, REC-03 | 'receita com o que tenho em casa' usa a despensa; falta priorizar o que vence. |
| DSP-04 | Lista de compras a partir do cardápio, descontando estoque | P3 | IMPLEMENTADO E TESTADO | DSP-01 | src/shopping.js: 'lista de compras' (7 dias, 'para N dias', 'do mês') pelo que a pessoa comeu nos últimos 14 dias; 'da receita' (aberta, com trocas e porções) e 'das minhas receitas favoritas'. Cozido → cru para comprar (arroz ×0,4, feijão ×0,45, macarrão ×0,45, carnes ×1,3), unidades para ovo/fruta/pão, arredondado para cima, por categoria, descontando a despensa. test/e2e.test.js |
| DSP-05 | Orçamento semanal/mensal e alternativas econômicas; preços com fonte | P3 | NÃO IMPLEMENTADO | DSP-04 | — |

## HID — Hidratação

| ID | Requisito | Prio | Status | Depende de | Arquivos / evidência |
|---|---|---|---|---|---|
| HID-01 | Meta diária individualizada (estimativa ≠ orientação profissional) | P2 | IMPLEMENTADO E TESTADO | — | meta definida pela usuária ("minha meta de água é 3 litros", ferramenta `set_water_goal`); sem meta, estimativa de 35 ml/kg arredondada a 100 ml, ou 2 L sem peso (`waterGoalFor`, `test/e2e.test.js`). É estimativa geral, não orientação profissional |
| HID-02 | Registrar ml/L, saldo, histórico, correções ("quanto falta?") | P2 | PARCIAL | — | "bebi 500 ml de água", "tomei 2 copos d'água" registram sem o modelo (copo 200 ml, garrafa 500, xícara 150); "quanto de água falta?" mostra total, meta e saldo; "apaga a última água" remove o último registro de hoje; o agente tem `record_water`, `get_water_status` e `set_water_goal` (`test/e2e.test.js`). Falta histórico de água por dia |
| HID-03 | Lembretes e integração com fechamento diário e painel | P3 | NÃO IMPLEMENTADO | CONV-11, ACO-02 | — |

## ESP — Motor esportivo multimodal

| ID | Requisito | Prio | Status | Depende de | Arquivos / evidência |
|---|---|---|---|---|---|
| ESP-01 | Registrar treino realizado (tipo, duração, notas, exercícios) | P1 | IMPLEMENTADO E TESTADO | — | tabelas `workouts`/`exercises`; `saveWorkout`; ferramenta `record_workout`; `test/e2e.test.js` |
| ESP-02 | Motor central com módulos por modalidade (força, corrida, ciclismo, natação, lutas, coletivos…) | P2 | PARCIAL | — | motor de treinos em `src/training/`: corrida (`running.js`), musculação (`strength.js`), ciclismo, natação, caminhada, funcional e HIIT (`endurance.js`), agenda combinada sem conflito (`plan.js`) (`test/training.test.js`). Faltam lutas e esportes coletivos |
| ESP-03 | Perguntas adaptativas por modalidade | P2 | PARCIAL | — | a ferramenta `create_training_plan` devolve só as perguntas que faltam por modalidade (nível/volume, dias, tempo de referência; dias e local da musculação) e junta a resposta da mensagem seguinte com o pedido anterior (`pending_training_request`, 24 h) |
| ESP-04 | Objetivos de longo prazo, provas, prazos e calendário | P2 | IMPLEMENTADO E TESTADO | — | objetivos com prova e data (`training_plans`, `planned_sessions`); plano datado semana a semana; "treino de hoje/amanhã", "treinos da semana" sem o modelo; plano criado de segunda a quinta começa na semana atual, sexta a domingo na segunda seguinte (`test/training.test.js`, `test/e2e.test.js`) |
| ESP-05 | Adaptar treino (sem tempo, cansaço, sono ruim, sem equipamento, sessão perdida, dor) | P2 | IMPLEMENTADO E TESTADO | — | Além de cansaço/dor/falta: 'só tenho 30 min'/'sem tempo' encurta a sessão (corrida pela distância que cabe no tempo, qualidade com metade da parte principal, musculação com os exercícios principais em circuito); 'academia fechada'/'treinar em casa' troca a musculação pela versão com peso do corpo; 'passa o treino de hoje para quinta' remarca (troca de lugar se o dia já tem treino) e avisa treinos fortes em dias seguidos. test/training.test.js |
| ESP-06 | Planejado ≠ realizado; feedback pós-treino | P2 | IMPLEMENTADO E TESTADO | — | treino registrado é ligado à sessão do dia (ou de ontem pendente) e comparado: distância e, em sessões contínuas, pace no alvo; qualidade não compara pace médio (inclui aquecimento); semana mostra feito/pulado/ajustado |
| ESP-07 | Gasto energético estimado do treino (tipo, duração, distância, intensidade, peso), sempre como estimativa e sem repor automaticamente na dieta (prompt mestre antigo, "Gasto energético") | P2 | IMPLEMENTADO E TESTADO | ESP-02 | src/training/energy.js: corrida ~1 kcal/kg/km, caminhada 0,55, demais por MET (ciclismo pela velocidade, musculação, natação, funcional, HIIT, yoga, esportes). Mostrado no registro do treino e na mensagem do Strava como estimativa; não altera a meta. test/training.test.js |

## MUS — Musculação

| ID | Requisito | Prio | Status | Depende de | Arquivos / evidência |
|---|---|---|---|---|---|
| MUS-01 | Séries, repetições e carga por exercício | P1 | IMPLEMENTADO E TESTADO | — | tabela `exercises`; `src/workouts.js` (validação: séries 0–100 inteiras, repetições 0–1000, carga 0–1000 kg, duração 0–1440 min; confirmação com volume); `saveWorkout` em transação; `getWorkoutsBetween`; `test/workouts.test.js`, `test/e2e.test.js`. Bug corrigido: treino registrado respondia "Entendi. Como posso te ajudar?" |
| MUS-02 | Grupo muscular, RPE/RIR, descanso, técnica, equipamento, fadiga | P2 | IMPLEMENTADO E TESTADO | — | Planos com grupo muscular, séries, repetições, descanso, RIR, equipamento e limitações. Treino feito agora registra RPE/RIR por exercício e esforço da sessão (0–10), pela ferramenta ou pelo texto ('rir 3', 'esforço 9/10'); resposta sugere a progressão (RIR 3+ → subir ~5% da carga; falha → manter) e 3 sessões seguidas com esforço 9+ sugerem semana mais leve. test/e2e.test.js |
| MUS-03 | Volume por músculo, progressão e PRs | P2 | IMPLEMENTADO E TESTADO | — | Recordes ('qual meu recorde no supino?', aviso de novo recorde); 'volume por músculo'/'como está minha musculação': séries da semana por grupo (nome do exercício → músculo) com barra e faixa 10–20 séries, grupos sem treino; 'evolução no supino': melhor série por sessão, 1RM estimado (Epley) e tendência %, dica de progressão dupla se estagnar. test/e2e.test.js |
| MUS-04 | Criar/adaptar treinos por objetivo, nível, divisão, equipamento, limitações | P2 | IMPLEMENTADO E TESTADO | — | plano de musculação por objetivo (hipertrofia, força, emagrecimento, condicionamento, saúde, fortalecimento para corrida), nível, dias (divisões corpo inteiro/ABC/superior-inferior/PPL), equipamento e limitações, com progressão dupla; sem repetir exercício na sessão |
| MUS-05 | Reagendar e comparar planejado x realizado | P2 | PARCIAL | — | planejado x realizado e status da semana valem também para musculação; falta reagendar uma sessão para outro dia |

## COR — Corrida

| ID | Requisito | Prio | Status | Depende de | Arquivos / evidência |
|---|---|---|---|---|---|
| COR-01 | Objetivos (começar, 5/10/21/42 km, pace, limiar, retorno, prova) | P2 | IMPLEMENTADO E TESTADO | — | objetivos começar a correr (corrida + caminhada até 30 min), 5/10/21/42 km e condicionamento, com data de prova (termina no dia da prova) e aviso de prazo curto |
| COR-02 | Métricas (distância, tempo, pace/parciais, volume, FC/zonas, elevação, RPE…) | P2 | PARCIAL | — | distância e pace gravados em cada treino (`workouts.distance_km`, `pace_s_per_km`); ritmos de treino calculados de um tempo recente ou do pace confortável (Riegel + zonas). Faltam FC/zonas cardíacas, parciais e elevação |
| COR-03 | Tipos de treino (rodagem, longão, intervalado, fartlek, limiar, strides…) | P2 | IMPLEMENTADO E TESTADO | — | rodagem, longão, regenerativo, fartlek, acelerações, intervalado (800 m / 1 km), limiar e blocos no ritmo de prova, por fase |
| COR-04 | Periodização e planos semanais; adaptar faltas sem progressão agressiva | P2 | IMPLEMENTADO E TESTADO | — | periodização base → construção → específico → polimento; alvo semanal sobe até 10%, recuperação a cada 4 semanas, longão cresce em separado até o teto do objetivo; treinos fortes nunca em dias seguidos; faltas não são compensadas |
| COR-05 | Registro por texto, feedback, recordes; manual ≠ planejado ≠ importado | P2 | PARCIAL | — | "corri 5 km em 30 min" registra com pace e compara com o plano; atividades do Strava entram sozinhas (INT-01) e contam no "progresso da corrida" (km por semana, maior corrida, melhor pace, adesão). Faltam recordes por distância (melhores esforços do Strava) |
| COR-06 | Objetivo por tempo/pace alvo ("fazer 10 km em 50 min", "melhorar meu pace nos 5 km"): ritmos do plano a partir do alvo, checando se é realista para o tempo atual (prompt mestre §58) | P2 | IMPLEMENTADO E TESTADO | COR-01 | Meta de tempo/pace: análise (tempo atual, % de diferença, semanas realistas por nível, marco intermediário se o prazo não comporta), ritmos de qualidade progressivos até a meta, blocos no ritmo da meta, tiros de 400 m, teste de 3 km a cada 4 semanas com recalibração automática ("teste 3 km em 15:30" ou corrida de ~3 km) e teste final. Novos objetivos: voltar a correr e aumentar volume. test/training.test.js |

## INT — Integrações fitness

| ID | Requisito | Prio | Status | Depende de | Arquivos / evidência |
|---|---|---|---|---|---|
| INT-01 | Strava autorizado: importar atividades, normalizar, deduplicar | P3 | IMPLEMENTADO E TESTADO | — | "conectar strava" envia o link OAuth com state assinado (HMAC); `/strava/callback` grava a conexão e recusa state inválido ou sem permissão de atividades; token renovado sozinho; importação a cada 20 min e com "sincronizar strava" (corrida, pedal, natação, caminhada, musculação, funcional) com distância, tempo, pace, elevação e FC; sem duplicar (external_id) e completando registro manual do mesmo dia; atividade cumpre a sessão do plano e avisa no WhatsApp (`src/integrations/strava.js`, `test/strava.test.js`, Strava simulado). Não validado com a conta real (precisa do app no Strava). Sem webhook do Strava: o túnel muda de endereço |
| INT-02 | Arquitetura para Apple Health, Health Connect, Garmin, balanças | P3 | NÃO IMPLEMENTADO | INT-01 | — |

## CRP — Peso, medidas, sono e recuperação

| ID | Requisito | Prio | Status | Depende de | Arquivos / evidência |
|---|---|---|---|---|---|
| CRP-01 | Registrar peso com data e histórico | P1 | IMPLEMENTADO E TESTADO | — | tabela `weights`; `saveWeight` atualiza `users.weight_kg`, recusa peso fora de 20–400 kg e confirma o registro (antes: sem validação e sem confirmação); `test/e2e.test.js` |
| CRP-02 | Atualizar metas automáticas quando o peso muda | P1 | IMPLEMENTADO E TESTADO | — | DEC-07: mudança de 2 kg ou mais em relação ao peso anterior sugere revisar as metas ("restaure minhas metas automáticas"); nada é recalculado sozinho (`test/e2e.test.js`). Corrigido junto: a confirmação mostrava a primeira pesagem do mesmo segundo (`saveWeight` agora devolve a linha inserida) |
| CRP-03 | Medidas/circunferências, gráficos e tendências | P2 | IMPLEMENTADO E TESTADO | — | src/body.js + tabela body_measurements: cintura, abdômen, quadril, peito, braço, antebraço, coxa, panturrilha, pescoço e % de gordura pela conversa (sem o modelo; ignora treino/comida/meta); 'minhas medidas' com variação desde a anterior e a primeira; 'evolução do peso' com mini gráfico, kg/semana e avaliação pelo objetivo. Gráfico em imagem fica para depois. test/e2e.test.js |
| CRP-04 | Fotos privadas de evolução com consentimento | P3 | NÃO IMPLEMENTADO | VIS-04 | — |
| CRP-05 | Sono (horas, qualidade), energia, fadiga; cruzar sem inferir causalidade | P2 | PARCIAL | — | "dormi 7h", "dormi 6 horas e 30 min, mal" registram horas e qualidade em `sleep_logs` sem o modelo; valores fora de 0–16 h são recusados; o resumo do dia mostra o sono (`test/e2e.test.js`). Faltam energia/fadiga e cruzamentos |

## ACO — Check-ins, analytics e reavaliação

| ID | Requisito | Prio | Status | Depende de | Arquivos / evidência |
|---|---|---|---|---|---|
| ACO-01 | Check-in diário opcional | P2 | IMPLEMENTADO E TESTADO | CRP-05, HID-02 | src/checkin.js + tabela daily_checkins: 'check-in' pergunta sono, energia 1–5 e dor; a resposta ('dormi 6h, energia 2, sem dor') registra (sono também em sleep_logs) e ajusta o treino de hoje (dor → descanso; energia ≤2 ou sono <6 h → versão leve; senão mostra o treino). Lembrete opcional 'me lembre do check-in às 7h'. test/e2e.test.js |
| ACO-02 | Fechamento diário (macros, água, treino, passos, sono, metas) | P2 | PARCIAL | — | "resumo do dia" / "como estou hoje?" sai sem chamar o modelo, com calorias, macros, treinos, peso e água do dia (`test/e2e.test.js`). Faltam passos e sono (sem módulo ainda) |
| ACO-03 | Resumo semanal e análise multimodal | P2 | IMPLEMENTADO E TESTADO | — | 'resumo da semana'/'últimos 7 dias': nutrição por dia, outras áreas (treinos, peso, água, sono) e bloco 🧠 Análise: dias dentro da meta (±10%), fim de semana x dias úteis, proteína média x meta, poucos dias registrados, sono < 7 h, água abaixo da meta, peso x objetivo e comparação com o período anterior (kcal médias e treinos). test/e2e.test.js |
| ACO-04 | Detectar metas desatualizadas e sugerir revisão (nunca em silêncio) | P2 | IMPLEMENTADO E TESTADO | ACO-03 | src/goalReview.js: no resumo do dia (no máximo 1×/semana, users.goal_review_at) aponta metas calculadas com peso que mudou 2 kg+ (users.targets_weight_kg), platô ou peso indo contra o objetivo em 3+ semanas, média de 2 semanas 15% acima ou 25% abaixo da meta e plano com 4+ treinos/semana com atividade sedentária/leve. Só sugere; nada é recalculado. test/e2e.test.js |
| ACO-05 | Gamificação (streaks, recordes, conquistas) sem culpa | P3 | NÃO IMPLEMENTADO | ACO-03 | — |

## WEB — Dashboard web

| ID | Requisito | Prio | Status | Depende de | Arquivos / evidência |
|---|---|---|---|---|---|
| WEB-01 | Painel autenticado sincronizado com WhatsApp (hoje/semana/evolução, gráficos com análise) | P3 | PARCIAL | ACO-03 | só API JSON: `/api/user`, `/api/summary`, `/api/history`, `/api/chat`; `index.html` é página estática |
| WEB-02 | Isolamento por usuário, privacidade, controle de acesso | P2 | PARCIAL | DEC-08 | `/api` exige um token único compartilhado (`API_ACCESS_TOKEN`, recusa testada em `test/app.test.js`); sem login por usuário |

## ARQ — Arquitetura e qualidade

| ID | Requisito | Prio | Status | Depende de | Arquivos / evidência |
|---|---|---|---|---|---|
| ARQ-01 | Modularizar em core/agent/router/memory + skills por domínio | P1 | PARCIAL | — | `foodMatching.js`, `mealIntent.js`, `nutrition.js`, `nutritionCatalog.js` separados; `ai.js` ainda tem 4.089 linhas |
| ARQ-02 | Agente central chama uma ou várias skills | P1 | PARCIAL | ARQ-01 | `agent/agent.js` + 16 ferramentas em `agent/tools.js` |
| ARQ-03 | Fluxo mensagem → normalização → router → skill → validação → persistência → memória → resposta | P1 | PARCIAL | ARQ-01 | etapas misturadas em `ai.js processMessage` |
| ARQ-04 | Agendador para lembretes e tarefas proativas | P2 | PARCIAL | — | agendador em `server.js` (a cada 60 s, só com WhatsApp configurado) chama `runReminders`, que calcula os lembretes devidos (função pura `dueReminders`) e registra o envio em `reminder_log` (`test/e2e.test.js`). Sem fila persistente nem tarefas além dos lembretes |
| ARQ-05 | Testes de integração com WhatsApp e OpenAI reais (Fase 5) | P0 | BLOQUEADO | autorização da usuária (créditos) | — |
| ARQ-06 | Testes de `db.js` com banco temporário | P0 | IMPLEMENTADO E TESTADO | — | `FITPULSE_DB_PATH` em `db.js`; `test/db.test.js` usa SQLite temporário |
| ARQ-07 | Testes de `ai.js` ponta a ponta sem API (modelo simulado) | P1 | IMPLEMENTADO E TESTADO | — | `test/e2e.test.js`: `processMessage` real + SQLite temporário + cliente simulado (`internal.apiClient`); cliente OpenAI criado só no primeiro uso (`agent.js`) e chave removida nos testes |
| ARQ-08 | Testes unitários e de regressão do núcleo nutricional | P0 | IMPLEMENTADO E TESTADO | — | 94 testes em `test/` |
| ARQ-09 | Métricas de qualidade (acerto, perguntas desnecessárias, duplicações, custo) | P2 | NÃO IMPLEMENTADO | ARQ-05 | — |
| ARQ-10 | Encoding UTF-8 correto nos arquivos ativos | P0 | IMPLEMENTADO E TESTADO | — | `scripts/fix-mojibake.mjs`; teste ENC-01 |
| ARQ-11 | Limpeza: `aliasMap` não usado e ~40 cópias de backup soltas | P1 | PARCIAL | DEC-10 | `aliasMap` removido (não era usado). Restam 42 cópias de backup soltas (28 em `src/`, 14 na raiz), fora do Git; não foram apagadas porque apagar arquivos da usuária exige a confirmação dela (DEC-10) |

## SEG — Segurança e regras de desenvolvimento

| ID | Requisito | Prio | Status | Depende de | Arquivos / evidência |
|---|---|---|---|---|---|
| SEG-01 | `.env` nunca lido, impresso ou versionado | P0 | IMPLEMENTADO E TESTADO | — | `test/safety.test.js`: `.env`/bancos fora do Git, `.gitignore`, `.env.example` sem valores reais, nenhum token em arquivo versionado, só `server.js` carrega o `.env` |
| SEG-02 | Banco real nunca alterado sem autorização; testes isolados | P0 | IMPLEMENTADO E TESTADO | — | testes de banco só em arquivo temporário (asserção em `test/db.test.js`); hash do `fitness.db` conferido a cada etapa |
| SEG-03 | Assinatura do webhook do WhatsApp validada | P0 | IMPLEMENTADO E TESTADO | — | `app.js` HMAC SHA-256 com `WHATSAPP_APP_SECRET` (sem assinatura, segredo errado, malformada, corpo alterado, sem segredo → 503); `test/app.test.js`. App separado de `server.js` para os testes não lerem `.env` |
| SEG-04 | Não gastar créditos em testes evitáveis | P0 | IMPLEMENTADO E TESTADO | — | `test/safety.test.js`: nenhum teste importa `server.js`; testes que carregam `ai.js`/`app.js` removem a chave e usam banco temporário; cliente OpenAI só sob demanda |
| SEG-05 | Marcar implementado só com teste reproduzível | P0 | IMPLEMENTADO NÃO TESTADO | — | este documento |

---

## DEC — Decisões pendentes

| ID | Decisão | Afeta |
|---|---|---|
| DEC-01 | **Decidido em 23/10/2026:** peso por unidade e medidas caseiras vêm das medidas caseiras da TBCA (página de detalhe do alimento); sem medida na TBCA, mantém-se a estimativa marcada como `curated_estimate` (ex.: fatia de sashimi 25 g, pão de queijo 30 g) | NUT-06, NUT-25, CAT-10 |
| DEC-02 | **Confirmado na TBCA em 23/10/2026:** uramaki de salmão c/ pepino (BRC0985A) tem peça média de 60 g. As páginas de detalhe da TBCA trazem medidas caseiras (peça, fatia, colher), fonte possível para DEC-01 | CAT-02 |
| DEC-03 | Serviço de transcrição de áudio e visão (custo, privacidade) | CONV-10, VIS-01 |
| DEC-04 | Fonte e frequência de atualização dos cardápios de fast food | CAT-04 |
| DEC-05 | Quando iniciar a pesquisa de marcas/sabores de suplementos e quais fontes oficiais usar | SUP-01 |
| DEC-06 | Conta de desenvolvedor Strava e escopo de dados autorizados | INT-01 |
| DEC-07 | **Decidido em 23/10/2026 (autonomia dada pela usuária):** só sugerir revisão quando o peso muda 2 kg ou mais; o recálculo fica com a usuária | CRP-02 |
| DEC-08 | Modelo de autenticação do painel (login por usuário, vínculo com o número do WhatsApp) | WEB-02 |
| DEC-09 | Onde rodar o agendador (processo do servidor, cron externo) e limites de mensagens proativas | ARQ-04, CONV-11 |
| DEC-10 | Se as ~40 cópias de backup soltas podem ser removidas da pasta (estão fora do Git) | ARQ-11 |
| DEC-11 | Avisar (sem bloquear) metas calóricas muito baixas? A partir de qual valor, e com que texto sobre acompanhamento profissional | NUT-17 |
| DEC-12 | Quais itens de peso/volume podem assumir a porção padrão sem perguntar (hoje só o whey, 1 scoop de 30 g); ex.: leite em "tomei leite", azeite | NUT-09 |
| DEC-13 | **Decidido em 23/10/2026:** sem preparo citado, assume o preparo padrão (carnes e frango grelhados, "ovo" = ovo cozido), sem perguntar | NUT-08 |

## Histórico de status

| Data | Mudança |
|---|---|
| 23/10/2026 | Criação do backlog a partir do documento da usuária: 119 requisitos + 10 decisões pendentes (8 implementados e testados, 13 implementados não testados, 31 parciais, 65 não implementados, 2 bloqueados); status auditados no commit `1748948`. Itens IMPLEMENTADO E TESTADO referem-se aos testes de `test/` (94 passando). Detalhes da auditoria nutricional em `AUDITORIA-NUTRICAO.md`. |
| 23/10/2026 | ARQ-06, NUT-24, SEG-02 → IMPLEMENTADO E TESTADO; NUT-11, CONV-09 → IMPLEMENTADO NÃO TESTADO (lógica e banco testados; fluxo em `ai.js` aguarda ARQ-07). Totais: 11 testados, 15 não testados, 29 parciais, 62 não implementados, 2 bloqueados. 108 testes passando. |
| 23/10/2026 | ARQ-07 implementado (`test/e2e.test.js`, modelo simulado). Passam a IMPLEMENTADO E TESTADO: ARQ-07, CONV-09, NUT-10, NUT-11, NUT-16, CRP-01, ESP-01. Bugs encontrados pelos testes e corrigidos: relato com "não comi X, comi Y" era ignorado; correção sem descrição sobrescrevia o nome com "Refeição corrigida". Totais: 18 testados, 9 não testados, 29 parciais, 61 não implementados, 2 bloqueados. 124 testes passando. |
| 23/10/2026 | NUT-13 → IMPLEMENTADO E TESTADO (duplicata = mesma descrição e calorias em 10 min; "de novo" libera). Totais: 19 testados, 9 não testados, 28 parciais, 61 não implementados, 2 bloqueados. 130 testes passando. |
| 23/10/2026 | NUT-12, NUT-15, NUT-18 → IMPLEMENTADO E TESTADO. Bug pré-existente corrigido: o handler `meal_plan` usava `explicitExcludedFoods` fora do escopo e toda criação de plano falhava com ReferenceError (mascarado como "Não consegui concluir essa ação agora"). Varredura com `tsc --checkJs` (TS2304/TS2552) nos 9 arquivos ativos: nenhum outro identificador indefinido. Totais: 22 testados, 6 não testados, 28 parciais, 61 não implementados, 2 bloqueados. 141 testes passando. |
| 23/10/2026 | SEG-03 (app Express separado em `app.js`; webhook testado), NUT-17 (limites e mensagens de recusa; "meta de proteína para 140 g") e NUT-09 (pergunta de quantidade com estado) → IMPLEMENTADO E TESTADO. Novas decisões DEC-11 e DEC-12. Mudança de comportamento: "comi arroz e feijão" agora pergunta as quantidades antes de registrar. Totais: 25 testados, 5 não testados, 26 parciais, 61 não implementados, 2 bloqueados. 161 testes passando. |
| 23/10/2026 | SEG-01, SEG-04 (verificações automáticas em `test/safety.test.js`), CONV-03 (datas relativas) e NUT-14 (histórico por dia e período) → IMPLEMENTADO E TESTADO. Totais: 29 testados, 3 não testados, 25 parciais, 60 não implementados, 2 bloqueados. 186 testes passando. |
| 23/10/2026 | NUT-19 e MUS-01 → IMPLEMENTADO E TESTADO; CRP-01 reforçado. Bugs corrigidos: frequência de refeição livre no singular e resposta numérica não reconhecidas; treino e peso registrados sem confirmação ("Entendi. Como posso te ajudar?"); treino e peso aceitavam valores impossíveis. Totais: 31 testados, 1 não testado (SEG-05, regra de processo), 25 parciais, 60 não implementados, 2 bloqueados. 200 testes passando. |
| 23/10/2026 | Catálogo com fonte TBCA: CAT-03 → IMPLEMENTADO E TESTADO; NUT-08, CAT-06 e CAT-10 avançam (PARCIAL). 24 itens revalidados (5 com divergência relevante corrigida) e 43 novos (preparos de cortes bovinos, frango, tilápia, ovos; cupim, carne-seca, açúcares, mel), cada um com código TBCA. Nova decisão DEC-13. Totais: 32 testados, 1 não testado, 25 parciais, 59 não implementados, 2 bloqueados. 208 testes passando. |
| 23/10/2026 | DEC-13 decidida (manter preparo padrão). CAT-11 e CAT-12 → IMPLEMENTADO E TESTADO. Totais: 34 testados, 1 não testado, 24 parciais, 58 não implementados, 2 bloqueados. 211 testes passando. |
| 23/10/2026 | CAT-10 avança: +56 itens básicos validados na TBCA (arroz, feijões, pães, laticínios, frutas, legumes); 123 itens com código TBCA no total. Testes de contagem passaram a derivar os valores do catálogo. Totais inalterados; 211 testes passando. |
| 23/10/2026 | CAT-10 avança: +26 itens (gorduras, oleaginosas, embutidos, peixes e frutos do mar) e novo item atum em óleo; sashimi passa a usar o salmão cru da TBCA (41 kcal/fatia). 150 itens com código TBCA. Totais inalterados; 213 testes passando. |
| 23/10/2026 | CAT-10 avança: +33 pratos, salgados, doces e bebidas com preparações da TBCA; 183 itens com código TBCA, 92 estimativas restantes. Teste NC-04 ajustado (farinha de mandioca agora é verificada). Totais inalterados; 215 testes passando. |
| 23/10/2026 | CAT-10 avança: +35 itens (suínos e aves assados, soja, comida japonesa, 12 pizzas) com código TBCA; patinho refogado recebe o código que faltava. 218 itens com código TBCA, 57 estimativas restantes sem equivalente na TBCA. Totais inalterados; 217 testes passando. |
| 23/10/2026 | CAT-01: lacuna do "queijo" genérico corrigida ("tapioca com queijo" pergunta o tipo e a resposta curta completa o registro); novo item queijo coalho (TBCA BRC0139G). Totais inalterados; 219 testes passando. |
| 23/10/2026 | CAT-02 avança: harumaki, kappa maki, joe, shoyu e teriyaki; peso por peça conferido nas medidas caseiras da TBCA (DEC-02 confirmado: uramaki 60 g); sugestões de comida japonesa passam a usar os valores do catálogo (hossomaki 41→50 kcal/peça, Califórnia 48→42, tempurá 220→189). Totais inalterados; 222 testes passando. |
| 23/10/2026 | DEC-01 decidida (medidas caseiras da TBCA; sem medida, estimativa marcada). NUT-25 → IMPLEMENTADO E TESTADO; novo item NUT-26 (pizza inteira). Totais: 35 testados, 1 não testado, 24 parciais, 58 não implementados, 2 bloqueados. 225 testes passando. |
| 23/10/2026 | NUT-06 → IMPLEMENTADO E TESTADO (medidas caseiras por alimento da TBCA, cheia/rasa). Totais: 36 testados, 1 não testado, 23 parciais, 58 não implementados, 2 bloqueados. 226 testes passando. |
| 23/10/2026 | NUT-26 → PARCIAL (inteiro pergunta a quantidade). Totais: 36 testados, 1 não testado, 24 parciais, 57 não implementados, 2 bloqueados. 227 testes passando. |
| 23/10/2026 | DEC-07 decidida (sugerir revisão). CRP-02 → IMPLEMENTADO E TESTADO; corrigido `saveWeight` devolvendo a pesagem errada. Totais: 37 testados, 1 não testado, 24 parciais, 56 não implementados, 2 bloqueados. 228 testes passando. |
| 23/10/2026 | ARQ-11 → PARCIAL (`aliasMap` removido; backups aguardam DEC-10). Totais: 37 testados, 1 não testado, 25 parciais, 55 não implementados, 2 bloqueados. 228 testes passando. |
| 23/10/2026 | CAT-08 → IMPLEMENTADO E TESTADO (catálogo extra em JSON validado). Totais: 38 testados, 1 não testado, 25 parciais, 54 não implementados, 2 bloqueados. 231 testes passando. |
| 23/10/2026 | CAT-09 → PARCIAL (cadastro de alimento pela conversa, por usuária). Totais: 38 testados, 1 não testado, 26 parciais, 53 não implementados, 2 bloqueados. 233 testes passando. |
| 23/10/2026 | NUT-20 → PARCIAL (refeições livres com composição no catálogo). Totais: 38 testados, 1 não testado, 27 parciais, 52 não implementados, 2 bloqueados. 234 testes passando. |
| 24/10/2026 | NUT-03 avança (PF/marmita e lanches da TBCA); CAT-05 → PARCIAL (combos McDonald's). Totais: 38 testados, 1 não testado, 28 parciais, 51 não implementados, 2 bloqueados. 238 testes passando. |
| 24/10/2026 | HID-01 → IMPLEMENTADO E TESTADO; HID-02 → PARCIAL (água sem o modelo, meta e saldo). Totais: 39 testados, 1 não testado, 29 parciais, 49 não implementados, 2 bloqueados. 241 testes passando. |
| 24/10/2026 | Peso ("pesei 72,5 kg"), treino simples ("corri 5 km em 30 min", "fiz 40 min de musculação") e resumo do dia passam a sair sem o modelo (economia de API e previsibilidade); resumo inclui água (ACO-02). Totais: 39 testados, 1 não testado, 29 parciais, 49 não implementados, 2 bloqueados. 243 testes passando. |
| 24/10/2026 | Lembretes de água e resumo diário pelo WhatsApp (CONV-11, ARQ-04 → PARCIAL). Totais: 39 testados, 1 não testado, 31 parciais, 47 não implementados, 2 bloqueados. 245 testes passando. |
| 24/10/2026 | Foto de refeição pelo WhatsApp (VIS-01, VIS-02 → PARCIAL; validação real depende da Fase 5). Totais: 39 testados, 1 não testado, 33 parciais, 45 não implementados, 2 bloqueados. 249 testes passando. |
| 24/10/2026 | Áudio pelo WhatsApp transcrito e tratado como texto (CONV-10 → PARCIAL). Totais: 39 testados, 1 não testado, 34 parciais, 44 não implementados, 2 bloqueados. 251 testes passando. |
| 24/10/2026 | Sono (CRP-05), recordes de musculação (MUS-03) e correção de água (HID-02). Totais: 39 testados, 1 não testado, 36 parciais, 42 não implementados, 2 bloqueados. 254 testes passando. |
| 24/10/2026 | CAT-01: cobertura de alimentos comuns (+37 itens TBCA, termos genéricos novos, "pão" = pão francês, "colher de chá" não vira bebida). Totais: 39 testados, 1 não testado, 36 parciais, 42 não implementados, 2 bloqueados. 256 testes passando. |
| 24/10/2026 | ACO-03 → PARCIAL (resumo de período com treinos, peso, água e sono). Totais: 39 testados, 1 não testado, 37 parciais, 41 não implementados, 2 bloqueados. 257 testes passando. |
| 24/10/2026 | Fase 5: "minha neta de calorias…" era recusada; CONV-02 avança (erros de digitação em metas e alimentos). Totais: 39 testados, 1 não testado, 37 parciais, 41 não implementados, 2 bloqueados. 268 testes passando. |
| 24/10/2026 | Treinos personalizados: motor `src/training/` (corrida, musculação e outras modalidades), plano datado com acompanhamento e ajustes, lembrete de treino. ESP-04, ESP-06, MUS-04, COR-01, COR-03, COR-04 → IMPLEMENTADO E TESTADO; ESP-02/03/05, MUS-02/05, COR-02/05 → PARCIAL. Totais: 45 testados, 1 não testado, 44 parciais, 28 não implementados, 2 bloqueados. 284 testes passando. |
| 24/10/2026 | Análise do prompt mestre (FitPulse_AI_Prompt_Mestre.txt): itens sem ID entram como NUT-27, ESP-07, COR-06 e CONV-12. Escopo do catálogo mantido (grande maioria do que se come, não todas as comidas). Totais: 45 testados, 1 não testado, 44 parciais, 32 não implementados, 2 bloqueados. |
| 24/10/2026 | Whey por marca e sabor com rótulos oficiais (SUP-05 → IMPLEMENTADO E TESTADO; SUP-01/03 → PARCIAL). Totais: 46 testados, 1 não testado, 45 parciais, 31 não implementados, 1 bloqueados. 287 testes passando. |
| 24/10/2026 | Strava: conexão, importação automática e ligação com o plano (INT-01 → IMPLEMENTADO E TESTADO, simulado). Totais: 47 testados, 1 não testado, 45 parciais, 30 não implementados, 1 bloqueados. 294 testes passando. |
| 24/10/2026 | COR-06: planos por meta de tempo/pace (ex.: 5 km abaixo de 25 min) com análise de viabilidade, ritmos progressivos, testes e recalibração; objetivos voltar a correr e aumentar volume. Totais: 48 testados, 1 não testado, 45 parciais, 29 não implementados, 1 bloqueados. |
| 25/10/2026 | NUT-27 (ajuste do dia em tempo real) e ESP-07 (gasto estimado do treino). Correções dos testes reais: 'treinos da semana' mostra a próxima quando o plano começa na segunda; teste de 3 km compara com o tempo exato anterior. Totais: 50 testados, 1 não testado, 45 parciais, 27 não implementados, 1 bloqueados. |
| 25/10/2026 | NUT-26: pizza/bolo inteiros com sabor depois de 'inteira', tamanho e pacotes passam a pedir a quantidade em vez de virar 1 porção. Totais: 51 testados, 1 não testado, 44 parciais, 27 não implementados, 1 bloqueados. |
| 25/10/2026 | Testes reais: inteiros passam a usar tamanho padrão avisado (sem perguntar); 'prato' como medida; feijoada, strogonoff, parmegiana, moqueca e churrasco sozinhos perguntam o acompanhamento antes de registrar (NUT-03). Totais: 51 testados, 1 não testado, 44 parciais, 27 não implementados, 1 bloqueados. |
| 25/10/2026 | ACO-04: revisão de metas desatualizadas no resumo do dia. Também: última corrida/treino com km, pace, FC e gasto; histórico do agente com km e pace. Totais: 52 testados, 1 não testado, 44 parciais, 26 não implementados, 1 bloqueados. |
| 25/10/2026 | CRP-03: medidas corporais e tendência do peso; README com os comandos novos. Totais: 53 testados, 1 não testado, 44 parciais, 25 não implementados, 1 bloqueados. |
| 25/10/2026 | ESP-05: adaptação por pouco tempo, sem equipamento e remarcação do treino. Totais: 54 testados, 1 não testado, 43 parciais, 25 não implementados, 1 bloqueados. |
| 25/10/2026 | ACO-01: check-in diário que ajusta o treino do dia, com lembrete opcional. Totais: 55 testados, 1 não testado, 43 parciais, 24 não implementados, 1 bloqueados. |
| 25/10/2026 | CONV-12: preferência de respostas curtas/detalhadas. Totais: 56 testados, 1 não testado, 43 parciais, 23 não implementados, 1 bloqueados. |
| 25/10/2026 | SUP-02 (parcial): categorias de suplementos além do whey. Totais: 56 testados, 1 não testado, 44 parciais, 22 não implementados, 1 bloqueados. |
| 25/10/2026 | MUS-02: RPE/RIR, esforço da sessão, progressão de carga e alerta de fadiga. Totais: 57 testados, 1 não testado, 43 parciais, 22 não implementados, 1 bloqueados. |
| 25/10/2026 | DSP-01/02: despensa com quantidade, local, validade, baixa automática e uso nas sugestões. Totais: 59 testados, 1 não testado, 42 parciais, 21 não implementados, 1 bloqueados. |
| 25/10/2026 | REC: 40 receitas com ficha, filtros, troca de ingrediente, favoritas e registro por porção; despensa nas receitas. Totais: 63 testados, 1 não testado, 46 parciais, 13 não implementados, 1 bloqueados. |
| 25/10/2026 | Whey da pessoa: pergunta marca/sabor, guarda e personaliza receitas pelo sabor (7 receitas novas com whey). Totais: 63 testados, 1 não testado, 46 parciais, 13 não implementados, 1 bloqueados. |
| 28/10/2026 | ACO-03: análise da semana e comparação com a semana anterior. Totais: 64 testados, 1 não testado, 45 parciais, 13 não implementados, 1 bloqueados. |
| 28/10/2026 | DSP-04: lista de compras pelo histórico e pelas receitas, descontando a despensa. Totais: 65 testados, 1 não testado, 45 parciais, 12 não implementados, 1 bloqueados. |
| 28/10/2026 | MUS-03: volume por músculo e evolução por exercício. Totais: 66 testados, 1 não testado, 44 parciais, 12 não implementados, 1 bloqueados. |
