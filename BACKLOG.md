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
| CONV-01 | Assistente persistente e natural em pt-BR via WhatsApp | P0 | PARCIAL | ARQ-05 | `server.js` webhook só texto; `ai.js` + `agent/agent.js` |
| CONV-02 | Entender coloquial, abreviações, erros de digitação, respostas curtas | P1 | PARCIAL | — | regras determinísticas em `mealIntent.js`; restante depende do LLM (não testado) |
| CONV-03 | Datas relativas ("ontem", "segunda") em registros e consultas | P1 | NÃO IMPLEMENTADO | NUT-09 | registros usam a hora atual (`getBrazilDateTime` em `db.js`) |
| CONV-04 | Várias intenções numa mesma mensagem | P1 | PARCIAL | ARQ-02 | agente pode chamar várias ferramentas; sem teste |
| CONV-05 | Router para uma ou várias áreas; confirmar, registrar, corrigir, cancelar | P0 | PARCIAL | ARQ-02 | pré-roteamento determinístico em `ai.js processMessage` + ferramentas do agente |
| CONV-06 | Mínimo de perguntas; estimar só quando aceitável; declarar incerteza | P0 | PARCIAL | — | `needs_clarification`, `approximate_quantity`, `confidence` no catálogo (testados) |
| CONV-07 | Distinguir disponível / obrigatório / desejado / excluído / composição excluída / sugerida / escolhida / consumida / correção | P0 | PARCIAL | — | campos em `buildExplicitMealRequestFacts`; eventos em `meal_plan_events`; partes testadas em `test/intent.test.js` |
| CONV-08 | Memória estruturada: perfil, preferências/hábitos, contexto episódico | P1 | PARCIAL | — | tabela `users` (perfil, dislikes, preferências), `meal_plan_events`; sem memória de rotinas, eventos, provas |
| CONV-09 | Pergunta pendente com estado (responder "patinho" após "qual bife?") | P0 | IMPLEMENTADO E TESTADO | — | `resolveGenericFoodAnswer` (`mealIntent.js`), estado em `users.pending_meal_clarification`, `handlePendingMealClarification` (15 min); `test/intent.test.js`, `test/db.test.js`, `test/e2e.test.js` |
| CONV-10 | Áudio: receber, transcrever, interpretar; depois responder em áudio | P2 | NÃO IMPLEMENTADO | DEC-03 | `server.js:352` ignora mensagens que não são texto |
| CONV-11 | Notificações, lembretes e proatividade sem excesso | P2 | NÃO IMPLEMENTADO | ARQ-04 | sem agendador |

## NUT — Nutrição e registro alimentar

| ID | Requisito | Prio | Status | Depende de | Arquivos / evidência |
|---|---|---|---|---|---|
| NUT-01 | Registro por linguagem natural com alimento, quantidade, unidade e porção | P0 | IMPLEMENTADO E TESTADO | — | `nutritionCatalog.js estimateMealFromText`; `test/catalog.test.js` |
| NUT-02 | Identificar marca/produto, corte e preparo | P1 | PARCIAL | CAT-03, SUP-01 | termos genéricos batata/bife pedem preparo (testado); poucas marcas no catálogo |
| NUT-03 | Pratos compostos, marmita, PF, buffet, combos, rodízio, restaurante, delivery | P1 | PARCIAL | CAT-05 | soma de itens citados funciona; sem modelo de prato/combo |
| NUT-04 | kcal, proteínas, carboidratos, gorduras | P0 | IMPLEMENTADO E TESTADO | — | `test/catalog.test.js` |
| NUT-05 | Outros nutrientes (fibras, sódio, açúcares…) | P2 | NÃO IMPLEMENTADO | CAT-08 | catálogo só tem kcal/P/C/G |
| NUT-06 | Medidas caseiras e conversão específica por alimento/densidade | P1 | PARCIAL | DEC-01 | medidas genéricas marcadas como aproximação (testado); sem fator por alimento |
| NUT-07 | Vários alimentos e várias ocorrências; sem falsos positivos de alias | P0 | IMPLEMENTADO E TESTADO | — | `foodMatching.js`; `test/foodMatching.test.js`, `test/catalog.test.js` |
| NUT-08 | Diferenciar cru/cozido/assado/grelhado/frito | P1 | PARCIAL | CAT-01 | depende de existir item por preparo no catálogo |
| NUT-09 | Perguntar só o dado ausente; não pedir gramas quando a unidade é conhecida | P0 | PARCIAL | — | `getMissingMealQuantities` (testado); preparo/corte genérico já tem pergunta com estado (CONV-09); quantidade ausente ainda sem estado |
| NUT-10 | Corrigir registro sem duplicar | P0 | IMPLEMENTADO E TESTADO | — | `db.js correctMeal` por ID; correção sem descrição mantém a original (bug do texto fixo "Refeição corrigida" corrigido); `test/db.test.js`, `test/e2e.test.js` via ferramenta `correct_meal` simulada |
| NUT-11 | Excluir registro | P0 | IMPLEMENTADO E TESTADO | — | `db.js deleteMeal` com cópia em `meal_plan_events`, confirmação explícita em 2 passos, cancelamento, isolamento por usuário; `test/db.test.js`, `test/e2e.test.js` |
| NUT-12 | Distinguir consumo de intenção, sugestão e escolha; confirmar antes de salvar | P0 | IMPLEMENTADO NÃO TESTADO | — | ferramentas `choose_meal_option`, `confirm_meal_consumption`; `consumeMealSelection` |
| NUT-13 | Evitar registros duplicados | P0 | IMPLEMENTADO E TESTADO | — | reenvio do WhatsApp (`claimWhatsAppMessage`); confirmação dupla de opção (`alreadyConsumed`); mesma descrição + calorias em 10 min (`findRecentDuplicateMeal`), salvo "de novo/outra vez" (`isExplicitRepeatMeal`); `test/db.test.js`, `test/e2e.test.js`, `test/intent.test.js` |
| NUT-14 | Histórico por data/período; consumo diário e semanal | P1 | PARCIAL | CONV-03 | `getDailySummary` (dia), `getRecentHistory` (últimos N, sem período); sem semanal |
| NUT-15 | Saldo de kcal/macros atualizado após registro e correção | P0 | IMPLEMENTADO NÃO TESTADO | — | `getDailySummary`, `calculateNutritionBalance`, `analyzeRemainingNutritionBudget` |
| NUT-16 | Metas personalizadas, ajuste manual, restaurar automáticas | P0 | IMPLEMENTADO E TESTADO | — | `setCustomCalorieTarget`, `restoreAutomaticNutritionTargets` e a proteção contra alteração sem pedido explícito; `test/e2e.test.js` (metas de macros ainda sem teste) |
| NUT-17 | Validar coerência das metas e valores zero/negativos | P0 | PARCIAL | — | rejeita negativos; avisa metas incompatíveis (`ai.js`); sem testes |
| NUT-18 | Plano diário por refeição com orçamento e adaptação ao consumido | P0 | IMPLEMENTADO NÃO TESTADO | — | `buildDailyMealPlan`, `getMealBudget`; tabela `meal_plans` |
| NUT-19 | Refeições livres: frequência, dia/período, categorias favoritas | P1 | IMPLEMENTADO NÃO TESTADO | — | colunas `free_meal_*`; `setFreeMealSettings`; `generateFreeMealOptions` |
| NUT-20 | Refeições livres com ingredientes, porções e fonte | P1 | NÃO IMPLEMENTADO | CAT-08 | `FREE_MEAL_OPTIONS` só tem totais (NC-08) |
| NUT-21 | Cravings: priorizar o alimento desejado e encaixar no dia | P0 | IMPLEMENTADO E TESTADO | — | `generateDesiredFoodOptions`; `test/desiredFood.test.js` |
| NUT-22 | Fome e saciedade (horário, intensidade, padrões) | P3 | NÃO IMPLEMENTADO | — | — |
| NUT-23 | Restrições alimentares e combinações rejeitadas | P0 | IMPLEMENTADO E TESTADO | — | `mealIntent.js`; `test/intent.test.js` |
| NUT-24 | Validação nutricional ao salvar refeição | P0 | IMPLEMENTADO E TESTADO | — | `validateMealRecord` (`nutrition.js`) em `saveMeal`/`correctMeal` e no `ai.js`; `test/db.test.js` |
| NUT-25 | Peso por unidade correto em itens multiunidade (pão de queijo) | P1 | NÃO IMPLEMENTADO | DEC-01 | `default_g` representa a porção padrão |

## CAT — Catálogo alimentar brasileiro

| ID | Requisito | Prio | Status | Depende de | Arquivos / evidência |
|---|---|---|---|---|---|
| CAT-01 | Expandir catálogo para alimentação real (caseiros, regionais, padaria, doces, bebidas, industrializados) | P1 | PARCIAL | CAT-08 | 301 itens em `nutritionCatalog.js` |
| CAT-02 | Comida japonesa padrão Brasil (inclui jow/joe, harumaki, combinados, rodízios, molhos) | P1 | PARCIAL | DEC-02 | subtipos e recheios testados; faltam jow, harumaki, combinados, molhos |
| CAT-03 | Cortes bovinos e métodos de preparo | P1 | PARCIAL | — | patinho, alcatra, bife acebolado, rosbife; faltam vários cortes |
| CAT-04 | Fast food por marca e cardápio brasileiro | P1 | PARCIAL | DEC-04 | `BRANDED_FAST_FOOD_CATALOG` (68 itens de marca, maioria "official_menu_item_estimate") |
| CAT-05 | Interpretar marca+produto+tamanho+combo; decompor combos sem duplicar | P1 | NÃO IMPLEMENTADO | CAT-04 | — |
| CAT-06 | Guardar fonte, data, confiança e status de cada dado | P1 | PARCIAL | — | campo `source`; sem data nem status |
| CAT-07 | Sem aliases falsos, duplicatas ou valores incoerentes | P0 | IMPLEMENTADO E TESTADO | — | `test/catalog.test.js` (IDs únicos, alias único, energia × macros) |
| CAT-08 | Catálogo atualizável sem editar código | P1 | NÃO IMPLEMENTADO | ARQ-01 | catálogo está em código JS |
| CAT-09 | Alimento desconhecido: perguntar dados, calcular e cadastrar | P1 | NÃO IMPLEMENTADO | CAT-08 | — |
| CAT-10 | Validar fontes dos ~200 itens "curated_estimate" | P1 | NÃO IMPLEMENTADO | DEC-01 | — |
| CAT-11 | Remover/justificar modelos de refeição repetidos (NC-03) | P1 | NÃO IMPLEMENTADO | — | 19 grupos repetidos em `EXPANDED_TEMPLATES` |
| CAT-12 | Validação de modelos que referenciam alimento inexistente | P1 | PARCIAL | — | teste de integridade em `test/catalog.test.js`; `makeMealTemplate` ainda descarta em silêncio |

## SUP — Suplementos, whey e industrializados

| ID | Requisito | Prio | Status | Depende de | Arquivos / evidência |
|---|---|---|---|---|---|
| SUP-01 | Catálogo de todas as marcas relevantes no Brasil (lista no backlog original) | P2 | BLOQUEADO | DEC-05 | pesquisa adiada por decisão da usuária; hoje há 1 whey genérico |
| SUP-02 | Categorias (whey tipos, caseína, albumina, creatina, pré/pós, aminoácidos, eletrólitos, géis, barras, bebidas, vitaminas…) | P2 | NÃO IMPLEMENTADO | SUP-01 | — |
| SUP-03 | Cada SKU separado com rótulo completo, GTIN, fonte/URL, data, status, confiança | P2 | NÃO IMPLEMENTADO | SUP-01, CAT-08 | — |
| SUP-04 | Dados por porção e por 100 g/ml; BR vs importado; rótulo antigo/novo | P2 | NÃO IMPLEMENTADO | SUP-03 | — |
| SUP-05 | Entender "tomei whey", marca/sabor, scoop/gramas; perguntar quando preciso | P2 | PARCIAL | SUP-03 | "whey" genérico 30 g; detecção de disponibilidade em `mealIntent.js` |
| SUP-06 | Cadastro por foto de rótulo e despensa de suplementos do usuário | P3 | NÃO IMPLEMENTADO | VIS-03, DSP-01 | — |

## VIS — Fotos, visão e OCR

| ID | Requisito | Prio | Status | Depende de | Arquivos / evidência |
|---|---|---|---|---|---|
| VIS-01 | Foto de refeição: componentes, porções com incerteza, kcal/macros, confirmar antes de registrar | P2 | NÃO IMPLEMENTADO | CONV-10, DEC-03 | `server.js` ignora imagens |
| VIS-02 | Não fingir peso exato; perguntar se imagem ruim/sem escala | P2 | NÃO IMPLEMENTADO | VIS-01 | — |
| VIS-03 | OCR de rótulo, ingredientes, receita escrita, balança | P2 | NÃO IMPLEMENTADO | VIS-01 | — |
| VIS-04 | Fotos de evolução corporal privadas por data | P3 | NÃO IMPLEMENTADO | CRP-03 | — |

## REC — Receitas

| ID | Requisito | Prio | Status | Depende de | Arquivos / evidência |
|---|---|---|---|---|---|
| REC-01 | Biblioteca com centenas de receitas realmente variadas | P2 | NÃO IMPLEMENTADO | CAT-08 | — |
| REC-02 | Ficha completa por receita (ingredientes, passos, rendimento, macros, tempos, equipamento, tags) | P2 | NÃO IMPLEMENTADO | REC-01 | — |
| REC-03 | Gerar/adaptar por objetivo, macros, tempo, equipamento, estoque, orçamento | P2 | NÃO IMPLEMENTADO | REC-01, DSP-01 | — |
| REC-04 | Filtros por tempo, dificuldade, equipamento, poucos ingredientes | P2 | NÃO IMPLEMENTADO | REC-02 | — |
| REC-05 | Substituição por função culinária com recálculo | P2 | NÃO IMPLEMENTADO | REC-02 | — |
| REC-06 | Receitas pessoais, favoritas e recorrentes; registro por porção | P2 | NÃO IMPLEMENTADO | REC-02 | — |
| REC-07 | Um único cálculo nutricional compartilhado (sem motor paralelo) | P2 | NÃO IMPLEMENTADO | ARQ-01 | — |

## DSP — Despensa, compras e orçamento

| ID | Requisito | Prio | Status | Depende de | Arquivos / evidência |
|---|---|---|---|---|---|
| DSP-01 | Inventário com quantidade, unidade, local, validade | P2 | NÃO IMPLEMENTADO | — | só disponibilidade temporária de alimentos (`set_food_availability`) |
| DSP-02 | Estoque confirmado ≠ alimento mencionado/desejado | P2 | PARCIAL | DSP-01 | disponível/desejado já são distintos na conversa |
| DSP-03 | Receitas com o que há em casa e vencimento | P3 | NÃO IMPLEMENTADO | DSP-01, REC-03 | — |
| DSP-04 | Lista de compras a partir do cardápio, descontando estoque | P3 | NÃO IMPLEMENTADO | DSP-01 | — |
| DSP-05 | Orçamento semanal/mensal e alternativas econômicas; preços com fonte | P3 | NÃO IMPLEMENTADO | DSP-04 | — |

## HID — Hidratação

| ID | Requisito | Prio | Status | Depende de | Arquivos / evidência |
|---|---|---|---|---|---|
| HID-01 | Meta diária individualizada (estimativa ≠ orientação profissional) | P2 | NÃO IMPLEMENTADO | — | sem tabela de água |
| HID-02 | Registrar ml/L, saldo, histórico, correções ("quanto falta?") | P2 | NÃO IMPLEMENTADO | HID-01 | — |
| HID-03 | Lembretes e integração com fechamento diário e painel | P3 | NÃO IMPLEMENTADO | CONV-11, ACO-02 | — |

## ESP — Motor esportivo multimodal

| ID | Requisito | Prio | Status | Depende de | Arquivos / evidência |
|---|---|---|---|---|---|
| ESP-01 | Registrar treino realizado (tipo, duração, notas, exercícios) | P1 | IMPLEMENTADO E TESTADO | — | tabelas `workouts`/`exercises`; `saveWorkout`; ferramenta `record_workout`; `test/e2e.test.js` |
| ESP-02 | Motor central com módulos por modalidade (força, corrida, ciclismo, natação, lutas, coletivos…) | P2 | NÃO IMPLEMENTADO | ARQ-01 | `workout_type` é texto livre |
| ESP-03 | Perguntas adaptativas por modalidade | P2 | NÃO IMPLEMENTADO | ESP-02 | — |
| ESP-04 | Objetivos de longo prazo, provas, prazos e calendário | P2 | NÃO IMPLEMENTADO | ESP-02 | — |
| ESP-05 | Adaptar treino (sem tempo, cansaço, sono ruim, sem equipamento, sessão perdida, dor) | P2 | NÃO IMPLEMENTADO | ESP-04 | — |
| ESP-06 | Planejado ≠ realizado; feedback pós-treino | P2 | NÃO IMPLEMENTADO | ESP-04 | — |

## MUS — Musculação

| ID | Requisito | Prio | Status | Depende de | Arquivos / evidência |
|---|---|---|---|---|---|
| MUS-01 | Séries, repetições e carga por exercício | P1 | IMPLEMENTADO NÃO TESTADO | ESP-01 | tabela `exercises` (name, sets, reps, weight_kg) |
| MUS-02 | Grupo muscular, RPE/RIR, descanso, técnica, equipamento, fadiga | P2 | NÃO IMPLEMENTADO | MUS-01 | — |
| MUS-03 | Volume por músculo, progressão e PRs | P2 | NÃO IMPLEMENTADO | MUS-02 | — |
| MUS-04 | Criar/adaptar treinos por objetivo, nível, divisão, equipamento, limitações | P2 | NÃO IMPLEMENTADO | MUS-02 | — |
| MUS-05 | Reagendar e comparar planejado x realizado | P2 | NÃO IMPLEMENTADO | ESP-06 | — |

## COR — Corrida

| ID | Requisito | Prio | Status | Depende de | Arquivos / evidência |
|---|---|---|---|---|---|
| COR-01 | Objetivos (começar, 5/10/21/42 km, pace, limiar, retorno, prova) | P2 | NÃO IMPLEMENTADO | ESP-04 | — |
| COR-02 | Métricas (distância, tempo, pace/parciais, volume, FC/zonas, elevação, RPE…) | P2 | NÃO IMPLEMENTADO | ESP-02 | — |
| COR-03 | Tipos de treino (rodagem, longão, intervalado, fartlek, limiar, strides…) | P2 | NÃO IMPLEMENTADO | COR-02 | — |
| COR-04 | Periodização e planos semanais; adaptar faltas sem progressão agressiva | P2 | NÃO IMPLEMENTADO | COR-03 | — |
| COR-05 | Registro por texto, feedback, recordes; manual ≠ planejado ≠ importado | P2 | NÃO IMPLEMENTADO | COR-02, INT-01 | — |

## INT — Integrações fitness

| ID | Requisito | Prio | Status | Depende de | Arquivos / evidência |
|---|---|---|---|---|---|
| INT-01 | Strava autorizado: importar atividades, normalizar, deduplicar | P3 | NÃO IMPLEMENTADO | ESP-02, DEC-06 | — |
| INT-02 | Arquitetura para Apple Health, Health Connect, Garmin, balanças | P3 | NÃO IMPLEMENTADO | INT-01 | — |

## CRP — Peso, medidas, sono e recuperação

| ID | Requisito | Prio | Status | Depende de | Arquivos / evidência |
|---|---|---|---|---|---|
| CRP-01 | Registrar peso com data e histórico | P1 | IMPLEMENTADO E TESTADO | — | tabela `weights`; `saveWeight` atualiza `users.weight_kg`; `test/e2e.test.js` |
| CRP-02 | Atualizar metas automáticas quando o peso muda | P1 | NÃO IMPLEMENTADO | DEC-07 | `saveWeight` não recalcula metas |
| CRP-03 | Medidas/circunferências, gráficos e tendências | P2 | NÃO IMPLEMENTADO | — | — |
| CRP-04 | Fotos privadas de evolução com consentimento | P3 | NÃO IMPLEMENTADO | VIS-04 | — |
| CRP-05 | Sono (horas, qualidade), energia, fadiga; cruzar sem inferir causalidade | P2 | NÃO IMPLEMENTADO | — | — |

## ACO — Check-ins, analytics e reavaliação

| ID | Requisito | Prio | Status | Depende de | Arquivos / evidência |
|---|---|---|---|---|---|
| ACO-01 | Check-in diário opcional | P2 | NÃO IMPLEMENTADO | CRP-05, HID-02 | — |
| ACO-02 | Fechamento diário (macros, água, treino, passos, sono, metas) | P2 | PARCIAL | HID-02, CRP-05 | resumo nutricional do dia existe (`get_nutrition_state`) |
| ACO-03 | Resumo semanal e análise multimodal | P2 | NÃO IMPLEMENTADO | NUT-14 | — |
| ACO-04 | Detectar metas desatualizadas e sugerir revisão (nunca em silêncio) | P2 | NÃO IMPLEMENTADO | ACO-03 | — |
| ACO-05 | Gamificação (streaks, recordes, conquistas) sem culpa | P3 | NÃO IMPLEMENTADO | ACO-03 | — |

## WEB — Dashboard web

| ID | Requisito | Prio | Status | Depende de | Arquivos / evidência |
|---|---|---|---|---|---|
| WEB-01 | Painel autenticado sincronizado com WhatsApp (hoje/semana/evolução, gráficos com análise) | P3 | PARCIAL | ACO-03 | só API JSON: `/api/user`, `/api/summary`, `/api/history`, `/api/chat`; `index.html` é página estática |
| WEB-02 | Isolamento por usuário, privacidade, controle de acesso | P2 | PARCIAL | DEC-08 | `/api` exige um token único compartilhado (`API_ACCESS_TOKEN`); sem login por usuário |

## ARQ — Arquitetura e qualidade

| ID | Requisito | Prio | Status | Depende de | Arquivos / evidência |
|---|---|---|---|---|---|
| ARQ-01 | Modularizar em core/agent/router/memory + skills por domínio | P1 | PARCIAL | — | `foodMatching.js`, `mealIntent.js`, `nutrition.js`, `nutritionCatalog.js` separados; `ai.js` ainda tem 4.089 linhas |
| ARQ-02 | Agente central chama uma ou várias skills | P1 | PARCIAL | ARQ-01 | `agent/agent.js` + 16 ferramentas em `agent/tools.js` |
| ARQ-03 | Fluxo mensagem → normalização → router → skill → validação → persistência → memória → resposta | P1 | PARCIAL | ARQ-01 | etapas misturadas em `ai.js processMessage` |
| ARQ-04 | Agendador para lembretes e tarefas proativas | P2 | NÃO IMPLEMENTADO | DEC-09 | — |
| ARQ-05 | Testes de integração com WhatsApp e OpenAI reais (Fase 5) | P0 | BLOQUEADO | autorização da usuária (créditos) | — |
| ARQ-06 | Testes de `db.js` com banco temporário | P0 | IMPLEMENTADO E TESTADO | — | `FITPULSE_DB_PATH` em `db.js`; `test/db.test.js` usa SQLite temporário |
| ARQ-07 | Testes de `ai.js` ponta a ponta sem API (modelo simulado) | P1 | IMPLEMENTADO E TESTADO | — | `test/e2e.test.js`: `processMessage` real + SQLite temporário + cliente simulado (`internal.apiClient`); cliente OpenAI criado só no primeiro uso (`agent.js`) e chave removida nos testes |
| ARQ-08 | Testes unitários e de regressão do núcleo nutricional | P0 | IMPLEMENTADO E TESTADO | — | 94 testes em `test/` |
| ARQ-09 | Métricas de qualidade (acerto, perguntas desnecessárias, duplicações, custo) | P2 | NÃO IMPLEMENTADO | ARQ-05 | — |
| ARQ-10 | Encoding UTF-8 correto nos arquivos ativos | P0 | IMPLEMENTADO E TESTADO | — | `scripts/fix-mojibake.mjs`; teste ENC-01 |
| ARQ-11 | Limpeza: `aliasMap` não usado e ~40 cópias de backup soltas | P1 | NÃO IMPLEMENTADO | DEC-10 | backups fora do Git (ignorados) |

## SEG — Segurança e regras de desenvolvimento

| ID | Requisito | Prio | Status | Depende de | Arquivos / evidência |
|---|---|---|---|---|---|
| SEG-01 | `.env` nunca lido, impresso ou versionado | P0 | IMPLEMENTADO NÃO TESTADO | — | `.gitignore`; regra de processo |
| SEG-02 | Banco real nunca alterado sem autorização; testes isolados | P0 | IMPLEMENTADO E TESTADO | — | testes de banco só em arquivo temporário (asserção em `test/db.test.js`); hash do `fitness.db` conferido a cada etapa |
| SEG-03 | Assinatura do webhook do WhatsApp validada | P0 | IMPLEMENTADO NÃO TESTADO | — | `server.js` HMAC SHA-256 com `WHATSAPP_APP_SECRET` |
| SEG-04 | Não gastar créditos em testes evitáveis | P0 | IMPLEMENTADO NÃO TESTADO | — | regra de processo; suíte local sem API |
| SEG-05 | Marcar implementado só com teste reproduzível | P0 | IMPLEMENTADO NÃO TESTADO | — | este documento |

---

## DEC — Decisões pendentes

| ID | Decisão | Afeta |
|---|---|---|
| DEC-01 | Quais fontes aceitar para pesos por unidade e densidades (TBCA, rótulo, IBGE/POF?) e o que fazer quando não houver fonte oficial (ex.: fatia de sashimi 25 g) | NUT-06, NUT-25, CAT-10 |
| DEC-02 | Gramagem do uramaki de salmão (60 g/peça hoje) — confirmar na TBCA | CAT-02 |
| DEC-03 | Serviço de transcrição de áudio e visão (custo, privacidade) | CONV-10, VIS-01 |
| DEC-04 | Fonte e frequência de atualização dos cardápios de fast food | CAT-04 |
| DEC-05 | Quando iniciar a pesquisa de marcas/sabores de suplementos e quais fontes oficiais usar | SUP-01 |
| DEC-06 | Conta de desenvolvedor Strava e escopo de dados autorizados | INT-01 |
| DEC-07 | Recalcular metas automaticamente ao registrar peso, ou só sugerir revisão | CRP-02 |
| DEC-08 | Modelo de autenticação do painel (login por usuário, vínculo com o número do WhatsApp) | WEB-02 |
| DEC-09 | Onde rodar o agendador (processo do servidor, cron externo) e limites de mensagens proativas | ARQ-04, CONV-11 |
| DEC-10 | Se as ~40 cópias de backup soltas podem ser removidas da pasta (estão fora do Git) | ARQ-11 |

## Histórico de status

| Data | Mudança |
|---|---|
| 23/10/2026 | Criação do backlog a partir do documento da usuária: 119 requisitos + 10 decisões pendentes (8 implementados e testados, 13 implementados não testados, 31 parciais, 65 não implementados, 2 bloqueados); status auditados no commit `1748948`. Itens IMPLEMENTADO E TESTADO referem-se aos testes de `test/` (94 passando). Detalhes da auditoria nutricional em `AUDITORIA-NUTRICAO.md`. |
| 23/10/2026 | ARQ-06, NUT-24, SEG-02 → IMPLEMENTADO E TESTADO; NUT-11, CONV-09 → IMPLEMENTADO NÃO TESTADO (lógica e banco testados; fluxo em `ai.js` aguarda ARQ-07). Totais: 11 testados, 15 não testados, 29 parciais, 62 não implementados, 2 bloqueados. 108 testes passando. |
| 23/10/2026 | ARQ-07 implementado (`test/e2e.test.js`, modelo simulado). Passam a IMPLEMENTADO E TESTADO: ARQ-07, CONV-09, NUT-10, NUT-11, NUT-16, CRP-01, ESP-01. Bugs encontrados pelos testes e corrigidos: relato com "não comi X, comi Y" era ignorado; correção sem descrição sobrescrevia o nome com "Refeição corrigida". Totais: 18 testados, 9 não testados, 29 parciais, 61 não implementados, 2 bloqueados. 124 testes passando. |
| 23/10/2026 | NUT-13 → IMPLEMENTADO E TESTADO (duplicata = mesma descrição e calorias em 10 min; "de novo" libera). Totais: 19 testados, 9 não testados, 28 parciais, 61 não implementados, 2 bloqueados. 130 testes passando. |
