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

## Ligar ao Strava (opcional)

Com o Strava conectado, o app importa sozinho, a cada 20 minutos, as atividades que você registra lá: corrida, pedal, natação, caminhada e musculação. Cada atividade traz distância, tempo, pace, elevação e frequência cardíaca, é ligada ao treino do plano e você recebe um aviso no WhatsApp.

1. Em **strava.com/settings/api**, crie um app:
   - nome: FitPulse;
   - categoria: Training;
   - site: qualquer endereço seu;
   - **Authorization Callback Domain**: `localhost` se for autorizar no navegador do próprio PC que roda o servidor, ou o domínio do túnel (ex.: `algo.trycloudflare.com`) se for autorizar pelo celular.
2. Copie o **Client ID** e o **Client Secret** para `STRAVA_CLIENT_ID` e `STRAVA_CLIENT_SECRET` no `.env`.
3. Só se for autorizar pelo celular: defina `PUBLIC_BASE_URL` com o endereço do túnel.
4. Reinicie o servidor e mande **conectar strava** no WhatsApp. Abra o link e autorize o acesso às atividades.

Depois de conectado, o acesso se renova sozinho: o túnel pode mudar de endereço sem desconectar o Strava. Só uma nova conexão exige o domínio certo no app do Strava.

Se você já tiver registrado uma atividade à mão no mesmo dia, a importação completa esse registro em vez de criar outro.

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
| "monta um treino de corrida pra mim" | Pergunta o que falta e cria o plano personalizado |
| "treino de hoje" / "treinos da semana" | Mostra o plano com o que foi feito |
| "corri 6 km em 40 min" | Registra com o pace e compara com o plano |
| "estou cansada" / "pulei o treino" | Ajusta o treino de hoje / marca a falta |
| "como está minha corrida?" | Mostra km por semana, melhor pace e quanto do plano você cumpriu |
| "tomei 2 scoops de whey da dux sabor cookies" | Usa o rótulo da marca e do sabor |
| "conectar strava" / "sincronizar strava" | Liga o Strava / importa agora |
| "monte um treino para fazer 5 km abaixo de 25 min" | Analisa a meta, monta ritmos progressivos e testes de 3 km |
| "teste 3 km em 15:30" | Recalibra os ritmos do plano pelo resultado |
| "qual foi minha última corrida?" | Mostra km, tempo, pace, FC e gasto estimado |
| "comi uma pizza inteira" / "2 pratos de feijoada" | Usa o tamanho padrão e avisa; pergunta o acompanhamento |
| "cintura 78 cm, quadril 98 cm" / "minhas medidas" | Registra medidas e mostra a evolução |
| "evolução do peso" | Mini gráfico, variação por semana e se está no ritmo do objetivo |
| "quais são minhas metas?" | Painel com calorias, macros, água e como foram calculadas |
| "resumo da semana" | Dia a dia, outras áreas e análise (meta, proteína, fim de semana, sono, água, peso, semana anterior) |
| "tenho whey de morango" | Pergunta marca/sabor, guarda na despensa e sugere receitas que combinam |
| "receita rápida com frango" / "receita com o que tenho em casa" | Lista receitas; o número abre a ficha; "comi a receita" registra |
| "comprei 1 kg de frango…" / "minha despensa" | Estoque com validade; baixa sozinha ao registrar refeição |
| "lista de compras" | Pelo que você costuma comer (ou das receitas), descontando a despensa |
| "check-in" | Sono, energia e dor; ajusta o treino do dia |
| "hoje só tenho 30 min" / "academia fechada" / "passa o treino para quinta" | Adapta ou remarca o treino |
| "treinei supino 3x10 com 40 kg, rir 2" | Registra com esforço e sugere a progressão |
| "volume por músculo" / "evolução no supino" | Séries por grupo na semana / progresso da carga |
| "minhas conquistas" | Sequência de registros e conquistas |
| "estou com fome" / "meu padrão de fome" | Lanches que cabem no dia / horário em que a fome mais aparece |
| "prefiro respostas curtas" | Ajusta o estilo das respostas |

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
