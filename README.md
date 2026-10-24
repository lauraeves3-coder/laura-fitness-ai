# FitPulse AI (Laura Fitness AI)

Assistente pessoal de alimentação, treino e acompanhamento físico pelo WhatsApp, em português do Brasil.

Este projeto está em **uso pessoal de teste**: uma única usuária, antes de abrir para outras pessoas.

## O que já funciona

- **Refeições por texto.** Por exemplo: "comi 2 ovos e um pão francês" ou "almocei um pf de frango".
  - Calorias e macros vêm do catálogo, com fonte TBCA quando houver (`docs/fontes-tbca.md`).
  - Medidas caseiras são convertidas pelo próprio alimento: colher, concha, fatia.
  - Quando falta informação, o app pergunta a quantidade ou o tipo, como em "batata", "bife", "queijo" e "pf".
- **Refeições por foto.** O app estima os alimentos e as porções e só registra depois do "sim".
- **Áudio.** A mensagem de voz é transcrita e tratada como texto.
- **Água.** "bebi 500 ml de água" e "quanto de água falta?". A meta vem da pessoa ou da estimativa de 35 ml/kg.
- **Peso.** "pesei 72,5 kg". Se o peso mudar 2 kg ou mais, o app sugere revisar as metas.
- **Treino.**
  - "corri 5 km em 30 min" e "fiz 40 min de musculação" são registrados direto.
  - Treinos detalhados passam pelo modelo.
- **Metas e resumo.** Metas de calorias e macros; "resumo do dia"; "resumo dos últimos 7 dias".
- **Lembretes.** "me lembre de beber água" e "me mande o resumo do dia às 21h".
- **Alimento próprio.** "cadastrar alimento: bolo da vó, 100 g tem 330 kcal, 5 g de proteína, 50 g de carboidrato e 12 g de gordura".
- **Refeição livre** com sugestões de opções e **plano do dia**.

O backlog completo, com o status de cada item, está em `BACKLOG.md`.

## Como rodar

Requisitos: Node 22 ou mais recente.

```bash
npm install
cp .env.example .env   # depois preencha os valores no .env
npm test               # testes locais: não usam a OpenAI nem o WhatsApp
npm start              # servidor em http://localhost:3000
```

As variáveis estão descritas em `.env.example`:

| Variável | Para quê |
|---|---|
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Conversa, foto e áudio |
| `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | Enviar mensagens e baixar mídias |
| `WHATSAPP_VERIFY_TOKEN` | Verificação do webhook pela Meta |
| `WHATSAPP_APP_SECRET` | Validar a assinatura de cada mensagem recebida |
| `API_ACCESS_TOKEN` | Proteger as rotas `/api/*` |

O banco é um arquivo SQLite (`fitness.db`, ou o caminho em `FITPULSE_DB_PATH`). Faça backup desse arquivo: ele guarda todo o histórico.

## Ligar ao WhatsApp (Meta Cloud API)

1. Crie um app em developers.facebook.com, adicione o produto **WhatsApp** e copie o token e o Phone Number ID.
2. Publique o servidor numa URL HTTPS. Há duas opções:
   - um túnel apontando para `localhost:3000`, como `cloudflared` ou `ngrok`;
   - uma hospedagem com disco persistente para o SQLite.
3. Em **WhatsApp → Configuração**, configure o webhook:
   - URL: `https://SEU-ENDERECO/webhook/whatsapp`;
   - token de verificação: o mesmo valor de `WHATSAPP_VERIFY_TOKEN`;
   - assine o campo **messages**.
4. Mande uma mensagem do seu número para o número do app. Comece com algo como "comi 2 ovos".

Limites da regra do WhatsApp:
- O app só consegue mandar mensagem por conta própria (lembretes, resumo automático) se você tiver falado com ele nas últimas 24 h.
- Fora dessa janela, a Meta exige um template aprovado, que ainda não está implementado.

## Comandos úteis

| Você manda | O app faz |
|---|---|
| "comi arroz, feijão e bife de patinho" | Pergunta as quantidades que faltam e registra |
| foto do prato | Estima e pede confirmação ("sim") |
| "bebi 2 copos de água" | Registra 400 ml |
| "pesei 71 kg" | Registra o peso |
| "corri 5 km em 28 min" | Registra o treino |
| "resumo do dia" / "como estou hoje?" | Mostra calorias, macros, treinos, peso e água |
| "o que comi ontem?" / "resumo da semana" | Mostra o histórico |
| "minha meta de proteína é 140 g" | Define a meta |
| "apaga a última refeição" | Mostra a refeição e pede confirmação antes de apagar |
| "me lembre de beber água" / "pare os lembretes de água" | Liga ou desliga os lembretes |
| "cadastrar alimento: …" | Cria um alimento só seu |

## Estrutura

```text
src/
  server.js            servidor (carrega .env) e agendador de lembretes
  app.js               rotas Express, webhook do WhatsApp, download de mídia
  ai.js                fluxo principal das mensagens
  agent/               agente OpenAI e ferramentas
  nutritionCatalog.js  catálogo de alimentos e cálculo das refeições
  householdMeasures.js medidas caseiras por alimento (TBCA)
  mealIntent.js        detectores de intenção sem modelo
  reminders.js, vision.js, userFoods.js, catalogExtra.js, dates.js, workouts.js, db.js
data/catalogo-extra.json   alimentos extras sem editar código (docs/catalogo-extra.md)
test/                      testes node:test, com banco temporário e modelo simulado
```

## Segurança

- Nunca versione o `.env` nem o `fitness.db`. Os dois já estão no `.gitignore`.
- Os testes usam um banco temporário e nunca chamam a OpenAI.
