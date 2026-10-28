// REC-01..07: receitas na conversa. Ingredientes apontam para o catálogo de alimentos, então
// kcal e macros saem do MESMO cálculo das refeições (REC-07). Busca com filtros (refeição,
// tempo, equipamento, ingrediente, vegetariano, sem lactose, proteína, despensa e saldo do
// dia), ficha completa, troca de ingrediente por função culinária, favoritas e registro por
// porção. Sem o modelo.
import { FOOD_CATALOG, findFoodCandidates } from "./nutritionCatalog.js";
import { getPantry, getUser, saveMeal, setRecipeState } from "./db.js";
import { flavorGroup, getWheyProfile } from "./wheyProfile.js";
import { addDays as addDaysIso } from "./dates.js";
import { excludedTerms, violatesRestrictions } from "./restrictions.js";

// [id, nome, refeições, minutos, dificuldade, equipamentos, ingredientes [catálogoId|null, g, texto], passos]
const RECIPES = [
  ["ovos-mexidos-tomate", "Ovos mexidos com tomate e pão integral", ["cafe"], 10, "fácil", ["fogão"],
    [["ovo-mexido", 100, "2 ovos"], ["tomate", 50, "½ tomate picado"], ["pao-integral", 50, "2 fatias de pão integral"], [null, 0, "sal e orégano a gosto"]],
    ["Bata os ovos com sal.", "Refogue o tomate por 1 min numa frigideira antiaderente.", "Junte os ovos e mexa em fogo baixo até firmar.", "Sirva com o pão."]],
  ["panqueca-banana-aveia", "Panqueca de banana com aveia", ["cafe", "lanche"], 10, "fácil", ["fogão"],
    [["banana-prata", 90, "1 banana amassada"], ["ovo-inteiro", 100, "2 ovos"], ["aveia-em-flocos", 30, "3 colheres de sopa de aveia"], [null, 0, "canela a gosto"]],
    ["Amasse a banana e misture com os ovos e a aveia.", "Despeje em frigideira antiaderente untada, em fogo baixo.", "Vire quando dourar embaixo (2–3 min cada lado)."]],
  ["tapioca-frango-requeijao", "Tapioca de frango com requeijão", ["cafe", "lanche", "jantar"], 10, "fácil", ["fogão"],
    [["tapioca-pronta", 60, "3 colheres de sopa de goma"], ["frango-desfiado", 60, "3 colheres de frango desfiado"], ["requeijao-cremoso", 20, "1 colher de requeijão"]],
    ["Espalhe a goma na frigideira quente, sem óleo.", "Quando soltar, recheie com o frango e o requeijão.", "Dobre e sirva."]],
  ["crepioca-queijo", "Crepioca de queijo", ["cafe", "lanche"], 10, "fácil", ["fogão"],
    [["ovo-inteiro", 100, "2 ovos"], ["tapioca-pronta", 30, "2 colheres de sopa de goma"], ["queijo-minas-frescal", 30, "1 fatia de queijo minas"]],
    ["Bata os ovos com a goma.", "Despeje na frigideira antiaderente e tampe por 2 min.", "Recheie com o queijo, dobre e sirva."]],
  ["overnight-oats", "Overnight oats de morango", ["cafe"], 5, "fácil", ["sem fogão"],
    [["aveia-em-flocos", 40, "4 colheres de sopa de aveia"], ["iogurte-natural-integral", 170, "1 pote de iogurte natural"], ["chia", 10, "1 colher de chia"], ["morango", 80, "5 morangos"], ["mel", 10, "1 colher de chá de mel"]],
    ["Misture aveia, iogurte e chia num pote.", "Cubra com os morangos e o mel.", "Deixe na geladeira de um dia para o outro."]],
  ["iogurte-granola-frutas", "Iogurte grego com granola e banana", ["cafe", "lanche", "sobremesa"], 3, "fácil", ["sem fogão"],
    [["iogurte-grego-natural", 120, "1 pote de iogurte grego"], ["granola-tradicional", 30, "3 colheres de granola"], ["banana-prata", 45, "½ banana"], ["mel", 5, "1 fio de mel"]],
    ["Coloque o iogurte numa tigela.", "Cubra com a banana em rodelas, a granola e o mel."]],
  ["vitamina-proteica", "Vitamina proteica de banana", ["cafe", "pos-treino", "lanche"], 5, "fácil", ["liquidificador"],
    [["leite-desnatado", 250, "1 copo de leite desnatado"], ["banana-prata", 90, "1 banana"], ["whey", 30, "1 scoop de whey"], ["aveia-em-flocos", 20, "2 colheres de aveia"]],
    ["Bata tudo no liquidificador com gelo a gosto."], ["fruta", "neutro", "chocolate"]],
  ["cuscuz-com-ovo", "Cuscuz com ovos", ["cafe", "jantar"], 15, "fácil", ["fogão"],
    [["cuscuz-de-milho-cozido", 120, "1 prato raso de cuscuz"], ["ovo-inteiro", 100, "2 ovos"], ["manteiga", 5, "1 ponta de faca de manteiga"]],
    ["Hidrate a farinha de milho com água e sal e cozinhe na cuscuzeira por 10 min.", "Cozinhe ou frite os ovos com pouco óleo.", "Sirva o cuscuz com a manteiga e os ovos."]],
  ["pao-ovo-queijo", "Pão francês com ovo mexido e muçarela", ["cafe", "lanche"], 10, "fácil", ["fogão"],
    [["pao-frances", 50, "1 pão francês"], ["ovo-mexido", 100, "2 ovos"], ["muçarela", 20, "1 fatia de muçarela"]],
    ["Faça os ovos mexidos.", "Recheie o pão com os ovos e o queijo."]],
  ["mingau-aveia-banana", "Mingau de aveia com banana", ["cafe", "jantar"], 10, "fácil", ["fogão"],
    [["leite-desnatado", 200, "1 copo de leite"], ["aveia-em-flocos", 30, "3 colheres de aveia"], ["banana-prata", 90, "1 banana"], [null, 0, "canela a gosto"]],
    ["Aqueça o leite com a aveia mexendo até engrossar (5 min).", "Sirva com a banana e canela."]],
  ["pf-frango", "Frango grelhado com arroz, feijão e salada", ["almoco", "jantar"], 30, "fácil", ["fogão"],
    [["peito-de-frango-grelhado", 130, "1 filé de frango"], ["arroz-branco-cozido", 120, "4 colheres de arroz"], ["feijao-carioca-cozido", 100, "1 concha de feijão"], ["folhas-salada", 60, "1 prato de folhas"], ["tomate", 50, "½ tomate"], ["azeite", 5, "1 colher de chá de azeite"]],
    ["Tempere o frango com sal, alho e limão.", "Grelhe 4–5 min de cada lado.", "Monte o prato com arroz, feijão e a salada temperada com o azeite."]],
  ["frango-batata-doce-brocolis", "Frango com batata-doce e brócolis", ["almoco", "jantar", "pos-treino"], 30, "fácil", ["airfryer", "forno", "fogão"],
    [["peito-de-frango-grelhado", 150, "1 filé grande de frango"], ["batata-doce-cozida", 150, "1 batata-doce média"], ["brocolis-cozido", 100, "1 xícara de brócolis"], ["azeite", 5, "1 colher de chá de azeite"]],
    ["Cozinhe ou asse a batata-doce em cubos (airfryer 200 °C por 20 min).", "Grelhe o frango temperado.", "Cozinhe o brócolis no vapor por 5 min e regue com o azeite."]],
  ["carne-moida-abobrinha", "Carne moída com abobrinha e arroz integral", ["almoco", "jantar"], 25, "fácil", ["fogão"],
    [["carne-moida-bovina", 130, "130 g de patinho moído"], ["abobrinha-cozida", 100, "½ abobrinha em cubos"], ["molho-de-tomate", 40, "2 colheres de molho de tomate"], ["arroz-integral-cozido", 100, "3 colheres de arroz integral"]],
    ["Refogue a carne com cebola e alho até secar.", "Junte a abobrinha e o molho; cozinhe 8 min.", "Sirva com o arroz."]],
  ["escondidinho-frango-batata-doce", "Escondidinho fit de frango com batata-doce", ["almoco", "jantar"], 40, "média", ["forno", "fogão"],
    [["frango-desfiado", 120, "1 xícara de frango desfiado"], ["batata-doce-cozida", 150, "1 batata-doce amassada"], ["requeijao-cremoso", 20, "1 colher de requeijão"], ["parmesao", 10, "1 colher de parmesão"]],
    ["Amasse a batata-doce cozida com sal.", "Num refratário, faça uma camada de frango temperado e cubra com o purê.", "Espalhe o requeijão e o parmesão e gratine 15 min a 200 °C."]],
  ["strogonoff-fit-frango", "Strogonoff fit de frango", ["almoco", "jantar"], 25, "fácil", ["fogão"],
    [["peito-de-frango-cozido", 130, "130 g de frango em cubos"], ["iogurte-natural-integral", 80, "½ pote de iogurte natural (no lugar do creme de leite)"], ["molho-de-tomate", 30, "2 colheres de molho de tomate"], ["cogumelo", 50, "½ xícara de cogumelos"], ["arroz-branco-cozido", 100, "3 colheres de arroz"]],
    ["Doure o frango com cebola.", "Junte o cogumelo e o molho de tomate; cozinhe 5 min.", "Desligue o fogo e misture o iogurte.", "Sirva com o arroz."]],
  ["salmao-abobora", "Salmão com purê de abóbora e salada", ["almoco", "jantar"], 25, "média", ["fogão"],
    [["salmao-grelhado", 130, "1 posta de salmão"], ["abobora-cozida", 150, "1 xícara de abóbora"], ["folhas-salada", 60, "1 prato de folhas"], ["azeite", 5, "1 colher de chá de azeite"]],
    ["Cozinhe a abóbora e amasse com sal.", "Grelhe o salmão com a pele para baixo por 5 min e vire por mais 3.", "Sirva com a salada temperada no azeite."]],
  ["tilapia-airfryer-legumes", "Tilápia na airfryer com legumes", ["almoco", "jantar"], 20, "fácil", ["airfryer"],
    [["tilapia-grelhada", 150, "1 filé de tilápia"], ["legumes-cozidos", 150, "1 xícara de legumes"], ["arroz-integral-cozido", 100, "3 colheres de arroz integral"], ["azeite", 5, "1 colher de chá de azeite"]],
    ["Tempere a tilápia com limão, sal e páprica.", "Airfryer a 200 °C por 12 min.", "Sirva com os legumes no vapor, o arroz e o azeite."]],
  ["omelete-forno-legumes", "Omelete de forno com legumes", ["almoco", "jantar", "cafe"], 25, "fácil", ["forno"],
    [["ovo-inteiro", 150, "3 ovos"], ["legumes-refogados", 100, "1 xícara de legumes picados"], ["muçarela", 20, "1 fatia de muçarela"]],
    ["Bata os ovos com sal e misture os legumes.", "Coloque em forma untada, cubra com o queijo.", "Asse a 200 °C por 20 min."]],
  ["macarrao-atum", "Macarrão integral com atum", ["almoco", "jantar"], 20, "fácil", ["fogão"],
    [["macarrao-cozido", 160, "1 prato de macarrão cozido"], ["atum-enlatado-agua", 80, "1 lata pequena de atum em água"], ["molho-de-tomate", 60, "3 colheres de molho de tomate"], ["azeite", 5, "1 colher de chá de azeite"]],
    ["Cozinhe o macarrão.", "Aqueça o molho com o atum escorrido.", "Misture ao macarrão e finalize com o azeite."]],
  ["macarrao-bolonhesa", "Macarrão à bolonhesa", ["almoco", "jantar"], 25, "fácil", ["fogão"],
    [["macarrao-cozido", 160, "1 prato de macarrão cozido"], ["carne-moida-bovina", 100, "100 g de carne moída"], ["molho-de-tomate", 80, "4 colheres de molho de tomate"], ["parmesao", 10, "1 colher de parmesão"]],
    ["Refogue a carne com cebola e alho.", "Junte o molho e cozinhe 10 min.", "Sirva sobre o macarrão com o parmesão."]],
  ["arroz-feijao-bife", "Arroz, feijão, bife e salada", ["almoco", "jantar"], 25, "fácil", ["fogão"],
    [["patinho-grelhado", 120, "1 bife de patinho"], ["arroz-branco-cozido", 120, "4 colheres de arroz"], ["feijao-carioca-cozido", 100, "1 concha de feijão"], ["folhas-salada", 60, "1 prato de folhas"], ["tomate", 50, "½ tomate"]],
    ["Tempere o bife e grelhe em frigideira bem quente, 2–3 min de cada lado.", "Monte o prato com arroz, feijão e salada."]],
  ["lentilha-arroz-ovo", "Lentilha com arroz integral e ovo", ["almoco", "jantar"], 30, "fácil", ["fogão"],
    [["lentilha-cozida", 120, "1 concha de lentilha"], ["arroz-integral-cozido", 100, "3 colheres de arroz integral"], ["ovo-inteiro", 100, "2 ovos cozidos"], ["cenoura-cozida", 50, "½ cenoura"]],
    ["Cozinhe a lentilha com louro e sal (15 min na pressão ou 25 na panela).", "Cozinhe os ovos por 10 min.", "Sirva com o arroz e a cenoura."]],
  ["grao-de-bico-tofu", "Grão-de-bico com tofu e legumes", ["almoco", "jantar"], 25, "fácil", ["fogão"],
    [["grao-de-bico-cozido", 120, "1 xícara de grão-de-bico"], ["tofu", 100, "100 g de tofu em cubos"], ["legumes-refogados", 100, "1 xícara de legumes"], ["arroz-integral-cozido", 100, "3 colheres de arroz integral"], ["azeite", 5, "1 colher de chá de azeite"]],
    ["Doure o tofu no azeite.", "Junte o grão-de-bico cozido e os legumes com cúrcuma e alho.", "Sirva com o arroz."]],
  ["carne-panela-mandioca", "Carne de panela com mandioca", ["almoco", "jantar"], 60, "média", ["panela de pressão"],
    [["musculo-cozido", 130, "130 g de músculo"], ["mandioca-cozida", 150, "1 pedaço de mandioca"], ["cenoura-cozida", 60, "½ cenoura"]],
    ["Doure o músculo em cubos com cebola e alho.", "Cubra com água e cozinhe 35 min na pressão.", "Junte a mandioca e a cenoura e cozinhe mais 10 min."]],
  ["wrap-frango", "Wrap de frango", ["almoco", "jantar", "lanche"], 10, "fácil", ["sem fogão"],
    [["pao-sirio", 60, "1 pão sírio"], ["frango-desfiado", 80, "4 colheres de frango desfiado"], ["requeijao-cremoso", 20, "1 colher de requeijão"], ["folhas-salada", 30, "folhas a gosto"], ["tomate", 40, "rodelas de tomate"]],
    ["Espalhe o requeijão no pão.", "Recheie com frango, folhas e tomate.", "Enrole e aqueça na frigideira se quiser."]],
  ["salada-grao-atum", "Salada de grão-de-bico com atum", ["almoco", "jantar"], 10, "fácil", ["sem fogão"],
    [["grao-de-bico-cozido", 100, "1 xícara de grão-de-bico"], ["atum-enlatado-agua", 80, "1 lata pequena de atum"], ["tomate", 60, "1 tomate pequeno"], ["pepino", 60, "½ pepino"], ["cebola", 20, "cebola roxa a gosto"], ["azeite", 5, "1 colher de chá de azeite"]],
    ["Pique os vegetais.", "Misture com o grão-de-bico e o atum.", "Tempere com azeite, limão e sal."]],
  ["sanduiche-natural-frango", "Sanduíche natural de frango", ["lanche", "jantar"], 10, "fácil", ["sem fogão"],
    [["pao-integral", 50, "2 fatias de pão integral"], ["frango-desfiado", 80, "4 colheres de frango desfiado"], ["cenoura-crua", 30, "cenoura ralada"], ["requeijao-cremoso", 20, "1 colher de requeijão"], ["folhas-salada", 20, "alface"]],
    ["Misture o frango com o requeijão e a cenoura.", "Recheie o pão com a pasta e a alface."]],
  ["hamburguer-caseiro", "Hambúrguer caseiro de patinho", ["almoco", "jantar"], 20, "fácil", ["fogão", "airfryer"],
    [["carne-moida-bovina", 130, "130 g de patinho moído"], ["pao-de-hamburguer", 70, "1 pão de hambúrguer"], ["queijo-prato", 20, "1 fatia de queijo"], ["tomate", 40, "rodelas de tomate"], ["folhas-salada", 20, "alface"]],
    ["Tempere a carne com sal e pimenta e modele o hambúrguer.", "Grelhe 4 min de cada lado (ou airfryer 200 °C por 10 min).", "Monte com o queijo, tomate e alface."]],
  ["cuscuz-carne-seca", "Cuscuz com carne seca", ["almoco", "jantar", "cafe"], 25, "média", ["fogão"],
    [["cuscuz-de-milho-cozido", 150, "1 prato de cuscuz"], ["carne-seca-cozida", 60, "60 g de carne seca desfiada"], ["cebola", 20, "½ cebola"], ["manteiga", 5, "1 colher de chá de manteiga"]],
    ["Dessalgue e desfie a carne seca cozida.", "Refogue com a cebola na manteiga.", "Sirva sobre o cuscuz."]],
  ["sopa-legumes-frango", "Sopa de legumes com frango", ["jantar", "almoco"], 35, "fácil", ["fogão"],
    [["frango-desfiado", 100, "1 xícara de frango desfiado"], ["legumes-cozidos", 200, "2 xícaras de legumes"], ["batata-cozida", 100, "1 batata pequena"]],
    ["Refogue cebola e alho, junte os legumes e a batata picados.", "Cubra com água e cozinhe 20 min.", "Junte o frango e cozinhe mais 5 min."]],
  ["abobrinha-recheada", "Abobrinha recheada com carne moída", ["almoco", "jantar"], 35, "média", ["forno", "fogão"],
    [["abobrinha-cozida", 200, "1 abobrinha grande"], ["carne-moida-bovina", 100, "100 g de carne moída"], ["molho-de-tomate", 40, "2 colheres de molho de tomate"], ["muçarela", 20, "1 fatia de muçarela"]],
    ["Corte a abobrinha ao meio e retire o miolo.", "Refogue a carne com o miolo e o molho.", "Recheie, cubra com o queijo e asse 20 min a 200 °C."]],
  ["panqueca-whey", "Panqueca de whey", ["pos-treino", "lanche", "cafe"], 10, "fácil", ["fogão"],
    [["whey", 30, "1 scoop de whey"], ["ovo-inteiro", 50, "1 ovo"], ["banana-prata", 45, "½ banana"], ["aveia-em-flocos", 20, "2 colheres de aveia"]],
    ["Misture tudo até formar uma massa.", "Doure em frigideira antiaderente, 2 min de cada lado."], ["fruta", "neutro", "chocolate"]],
  ["pao-pasta-amendoim-banana", "Pão integral com pasta de amendoim e banana", ["lanche", "pre-treino", "cafe"], 3, "fácil", ["sem fogão"],
    [["pao-integral", 50, "2 fatias de pão integral"], ["pasta-de-amendoim", 15, "1 colher de pasta de amendoim"], ["banana-prata", 45, "½ banana"]],
    ["Espalhe a pasta no pão e cubra com a banana em rodelas."]],
  ["ovos-cozidos-fruta", "Ovos cozidos com maçã", ["lanche"], 12, "fácil", ["fogão"],
    [["ovo-inteiro", 100, "2 ovos"], ["maca", 130, "1 maçã"]],
    ["Cozinhe os ovos por 10 min em água fervente.", "Sirva com a maçã."]],
  ["smoothie-acai-proteico", "Smoothie de açaí proteico", ["pos-treino", "lanche"], 5, "fácil", ["liquidificador"],
    [["acai-polpa-sem-xarope", 100, "1 polpa de açaí"], ["banana-prata", 90, "1 banana"], ["whey", 30, "1 scoop de whey"], ["leite-desnatado", 100, "½ copo de leite"]],
    ["Bata tudo no liquidificador até ficar cremoso."], ["fruta", "neutro", "chocolate"]],
  ["shake-proteico-frutas", "Shake proteico de frutas", ["pos-treino", "lanche", "cafe"], 5, "fácil", ["liquidificador"],
    [["whey", 30, "1 scoop de whey"], ["leite-desnatado", 250, "1 copo de leite desnatado"], ["morango", 100, "7 morangos (ou outra fruta)"]],
    ["Bata tudo no liquidificador com gelo."], ["fruta", "neutro"]],
  ["mousse-proteica", "Mousse proteica de iogurte", ["sobremesa", "lanche"], 5, "fácil", ["sem fogão"],
    [["iogurte-grego-natural", 120, "1 pote de iogurte grego"], ["whey", 30, "1 scoop de whey"]],
    ["Misture o whey ao iogurte até ficar liso.", "Leve à geladeira por 20 min."], ["fruta", "neutro", "chocolate"]],
  ["brownie-caneca-proteico", "Brownie de caneca proteico", ["sobremesa", "lanche"], 5, "fácil", ["micro-ondas"],
    [["whey", 30, "1 scoop de whey"], ["ovo-inteiro", 50, "1 ovo"], ["banana-prata", 45, "½ banana amassada"], ["aveia-em-flocos", 15, "1½ colher de aveia"], ["chocolate-meio-amargo", 10, "1 quadradinho de chocolate meio amargo picado"]],
    ["Misture tudo numa caneca.", "Micro-ondas por 1 min e 30 s.", "Espere 2 min antes de comer."], ["chocolate", "neutro"]],
  ["overnight-oats-proteico", "Overnight oats proteico", ["cafe", "lanche"], 5, "fácil", ["sem fogão"],
    [["aveia-em-flocos", 40, "4 colheres de aveia"], ["iogurte-natural-integral", 120, "1 pote pequeno de iogurte natural"], ["whey", 15, "½ scoop de whey"], ["chia", 10, "1 colher de chia"], ["banana-prata", 45, "½ banana"]],
    ["Misture aveia, iogurte, whey e chia num pote.", "Cubra com a banana e deixe na geladeira de um dia para o outro."], ["fruta", "neutro", "chocolate"]],
  ["picole-proteico", "Picolé proteico de iogurte e fruta", ["sobremesa", "lanche"], 5, "fácil", ["sem fogão"],
    [["iogurte-natural-integral", 100, "1 pote pequeno de iogurte natural"], ["whey", 30, "1 scoop de whey"], ["morango", 80, "5 morangos picados"]],
    ["Misture o iogurte com o whey e a fruta.", "Coloque em forminhas de picolé e congele por 4 h."], ["fruta", "neutro"]],
  ["iogurte-proteico-granola", "Iogurte proteico com granola", ["cafe", "lanche", "pos-treino"], 3, "fácil", ["sem fogão"],
    [["iogurte-grego-natural", 120, "1 pote de iogurte grego"], ["whey", 15, "½ scoop de whey"], ["granola-tradicional", 20, "2 colheres de granola"]],
    ["Misture o whey no iogurte.", "Cubra com a granola."], ["fruta", "neutro", "chocolate"]],
  ["torrada-cottage-tomate", "Torrada com cottage e tomate", ["lanche", "cafe"], 3, "fácil", ["sem fogão"],
    [["torrada-integral", 30, "3 torradas integrais"], ["cottage", 60, "2 colheres de cottage"], ["tomate", 50, "rodelas de tomate"]],
    ["Espalhe o cottage nas torradas.", "Cubra com tomate, sal e orégano."]],
  ["mousse-iogurte-maracuja", "Mousse de iogurte com maracujá", ["sobremesa", "lanche"], 5, "fácil", ["sem fogão"],
    [["iogurte-grego-natural", 120, "1 pote de iogurte grego"], ["maracuja-polpa", 40, "polpa de ½ maracujá"], ["mel", 10, "1 colher de chá de mel"]],
    ["Misture o iogurte com o mel.", "Cubra com a polpa do maracujá e leve à geladeira por 30 min."]],
  ["banana-assada-amendoim", "Banana assada com canela e pasta de amendoim", ["sobremesa", "lanche"], 10, "fácil", ["airfryer", "forno"],
    [["banana-prata", 90, "1 banana"], ["pasta-de-amendoim", 10, "1 colher de chá de pasta de amendoim"], [null, 0, "canela a gosto"]],
    ["Corte a banana ao meio no comprimento e polvilhe canela.", "Airfryer a 180 °C por 8 min.", "Sirva com a pasta de amendoim."]],
  ["morango-chocolate", "Morangos com chocolate meio amargo", ["sobremesa"], 5, "fácil", ["micro-ondas"],
    [["morango", 150, "10 morangos"], ["chocolate-meio-amargo", 20, "2 quadradinhos de chocolate meio amargo"]],
    ["Derreta o chocolate no micro-ondas em intervalos de 20 s.", "Mergulhe os morangos e deixe firmar na geladeira."]],
  ["pudim-chia-manga", "Pudim de chia com manga", ["sobremesa", "cafe", "lanche"], 5, "fácil", ["sem fogão"],
    [["chia", 20, "2 colheres de chia"], ["bebida-de-soja", 200, "1 copo de bebida de soja"], ["mel", 10, "1 colher de chá de mel"], ["manga", 80, "½ manga em cubos"]],
    ["Misture a chia com a bebida de soja e o mel.", "Deixe na geladeira por 4 h (ou de um dia para o outro).", "Cubra com a manga."]],
  // REC-01: segunda leva (regionais, versões leves, vegetarianas/veganas, lanches e doces).
  ["crepioca-frango", "Crepioca de frango", ["cafe", "lanche", "jantar"], 10, "fácil", ["fogão"],
    [["ovo-inteiro", 100, "2 ovos"], ["tapioca-pronta", 30, "2 colheres de goma"], ["frango-desfiado", 60, "3 colheres de frango desfiado"]],
    ["Bata os ovos com a goma.", "Despeje na frigideira, recheie com o frango, dobre e doure dos dois lados."]],
  ["cuscuz-com-frango", "Cuscuz com frango desfiado", ["cafe", "jantar"], 15, "fácil", ["fogão"],
    [["cuscuz-de-milho-cozido", 120, "1 prato raso de cuscuz"], ["frango-desfiado", 80, "4 colheres de frango"], ["tomate", 40, "tomate picado"]],
    ["Cozinhe o cuscuz no vapor.", "Refogue o frango com o tomate e sirva por cima."]],
  ["iogurte-mamao-chia", "Iogurte com mamão e chia", ["cafe", "lanche"], 3, "fácil", ["sem fogão"],
    [["iogurte-natural-integral", 170, "1 pote de iogurte natural"], ["mamao", 170, "1 fatia de mamão"], ["chia", 10, "1 colher de chia"]],
    ["Pique o mamão e misture com o iogurte e a chia."]],
  ["vitamina-morango", "Vitamina de morango com aveia", ["cafe", "lanche"], 5, "fácil", ["liquidificador"],
    [["leite-desnatado", 250, "1 copo de leite desnatado"], ["morango", 100, "7 morangos"], ["aveia-em-flocos", 20, "2 colheres de aveia"]],
    ["Bata tudo no liquidificador com gelo."]],
  ["sanduiche-atum", "Sanduíche de atum", ["lanche", "jantar"], 5, "fácil", ["sem fogão"],
    [["pao-integral", 50, "2 fatias de pão integral"], ["atum-enlatado-agua", 60, "½ lata de atum"], ["requeijao-cremoso", 15, "1 colher de requeijão"], ["folhas-salada", 20, "alface"]],
    ["Misture o atum com o requeijão.", "Recheie o pão com a pasta e a alface."]],
  ["ovos-batata-doce", "Ovos mexidos com batata-doce", ["cafe", "pos-treino"], 15, "fácil", ["fogão", "micro-ondas"],
    [["ovo-mexido", 100, "2 ovos"], ["batata-doce-cozida", 100, "1 batata-doce pequena"]],
    ["Cozinhe a batata-doce (micro-ondas 5 min, furada com garfo).", "Faça os ovos mexidos e sirva juntos."]],
  ["frango-xadrez", "Frango xadrez fit", ["almoco", "jantar"], 25, "média", ["fogão"],
    [["peito-de-frango-grelhado", 130, "130 g de frango em cubos"], ["pimentao", 60, "½ pimentão"], ["cebola", 40, "½ cebola"], ["shoyu", 15, "1 colher de shoyu"], ["arroz-branco-cozido", 100, "3 colheres de arroz"]],
    ["Doure o frango em cubos.", "Junte pimentão e cebola em pedaços e o shoyu; salteie 5 min.", "Sirva com arroz."]],
  ["arroz-brocolis-frango", "Arroz com brócolis e frango", ["almoco", "jantar"], 20, "fácil", ["fogão"],
    [["arroz-branco-cozido", 120, "4 colheres de arroz"], ["brocolis-cozido", 80, "1 xícara de brócolis"], ["peito-de-frango-grelhado", 120, "1 filé de frango"], ["azeite", 5, "1 colher de chá de azeite"]],
    ["Refogue o brócolis no azeite com alho e misture ao arroz.", "Sirva com o frango grelhado."]],
  ["tilapia-molho-tomate", "Tilápia ao molho de tomate", ["almoco", "jantar"], 25, "fácil", ["fogão"],
    [["tilapia-cozida", 150, "1 filé de tilápia"], ["molho-de-tomate", 80, "4 colheres de molho"], ["cebola", 30, "cebola fatiada"], ["arroz-branco-cozido", 100, "3 colheres de arroz"]],
    ["Refogue a cebola, junte o molho.", "Cozinhe a tilápia no molho por 10 min.", "Sirva com arroz."]],
  ["salmao-batata-doce", "Salmão com batata-doce assada", ["almoco", "jantar"], 30, "fácil", ["forno", "airfryer"],
    [["salmao-grelhado", 130, "1 posta de salmão"], ["batata-doce-cozida", 150, "1 batata-doce média"], ["folhas-salada", 50, "salada"]],
    ["Asse a batata-doce em cubos (airfryer 200 °C, 20 min).", "Grelhe o salmão.", "Sirva com a salada."]],
  ["picadinho-legumes", "Picadinho de carne com legumes", ["almoco", "jantar"], 30, "média", ["fogão"],
    [["patinho-refogado", 130, "130 g de patinho em cubos"], ["legumes-cozidos", 120, "1 xícara de legumes"], ["arroz-branco-cozido", 100, "3 colheres de arroz"]],
    ["Doure a carne em cubos com cebola e alho.", "Junte os legumes e um pouco de água; cozinhe 15 min.", "Sirva com arroz."]],
  ["frango-quiabo", "Frango com quiabo", ["almoco", "jantar"], 35, "média", ["fogão"],
    [["coxa-de-frango-cozida", 150, "2 coxas de frango"], ["quiabo-cozido", 100, "1 xícara de quiabo"], ["arroz-branco-cozido", 100, "3 colheres de arroz"]],
    ["Doure o frango e cozinhe com água até ficar macio.", "Junte o quiabo em rodelas e cozinhe 10 min.", "Sirva com arroz."]],
  ["tropeiro-fit", "Feijão tropeiro fit", ["almoco", "jantar"], 25, "média", ["fogão"],
    [["feijao-carioca-cozido", 150, "1 concha grande de feijão (sem caldo)"], ["ovo-mexido", 50, "1 ovo"], ["couve-refogada", 60, "couve refogada"], ["farinha-de-mandioca", 20, "2 colheres de farinha"]],
    ["Refogue o feijão escorrido com alho.", "Junte o ovo mexido, a couve e a farinha aos poucos."]],
  ["baiao-de-dois-fit", "Baião de dois", ["almoco", "jantar"], 30, "média", ["fogão"],
    [["arroz-branco-cozido", 100, "3 colheres de arroz"], ["feijao-carioca-cozido", 80, "½ concha de feijão"], ["queijo-coalho", 40, "1 fatia de queijo coalho em cubos"], ["cebola", 20, "cebola picada"]],
    ["Refogue a cebola, junte arroz e feijão.", "Misture o queijo coalho no fim."]],
  ["moqueca-peixe", "Moqueca fit de peixe", ["almoco", "jantar"], 30, "média", ["fogão"],
    [["tilapia-cozida", 150, "1 filé de tilápia"], ["tomate", 80, "1 tomate"], ["pimentao", 40, "½ pimentão"], ["cebola", 40, "½ cebola"], ["azeite", 5, "1 colher de chá de azeite"], ["arroz-branco-cozido", 100, "3 colheres de arroz"]],
    ["Monte camadas de cebola, tomate, pimentão e peixe na panela com azeite.", "Tampe e cozinhe 15 min em fogo baixo.", "Sirva com arroz."]],
  ["lasanha-abobrinha", "Lasanha de abobrinha", ["almoco", "jantar"], 45, "média", ["forno"],
    [["abobrinha-cozida", 200, "1 abobrinha em fatias finas"], ["carne-moida-bovina", 100, "100 g de carne moída"], ["molho-de-tomate", 80, "4 colheres de molho"], ["muçarela", 30, "1 fatia e meia de muçarela"]],
    ["Refogue a carne com o molho.", "Monte camadas de abobrinha, carne e queijo.", "Asse 25 min a 200 °C."]],
  ["risoto-frango", "Risoto fit de frango", ["almoco", "jantar"], 30, "média", ["fogão"],
    [["arroz-branco-cozido", 130, "arroz cozido"], ["frango-desfiado", 90, "frango desfiado"], ["cogumelo", 50, "cogumelos"], ["parmesao", 10, "1 colher de parmesão"]],
    ["Refogue os cogumelos, junte o arroz e um pouco de caldo.", "Misture o frango e finalize com parmesão."]],
  ["poke-salmao", "Poke de salmão", ["almoco", "jantar"], 15, "fácil", ["sem fogão"],
    [["arroz-japones-cozido", 120, "arroz japonês"], ["salmao-cru", 100, "100 g de salmão em cubos"], ["pepino", 60, "pepino"], ["manga", 60, "manga em cubos"], ["shoyu", 10, "shoyu"]],
    ["Monte a tigela com o arroz por baixo.", "Cubra com salmão, pepino e manga; regue com shoyu."]],
  ["yakisoba-fit", "Yakisoba fit de frango", ["almoco", "jantar"], 25, "média", ["fogão"],
    [["macarrao-cozido", 120, "macarrão cozido"], ["peito-de-frango-grelhado", 100, "frango em tiras"], ["legumes-refogados", 120, "legumes"], ["shoyu", 15, "shoyu"]],
    ["Salteie o frango e os legumes.", "Junte o macarrão e o shoyu e misture."]],
  ["strogonoff-carne-fit", "Strogonoff fit de carne", ["almoco", "jantar"], 25, "fácil", ["fogão"],
    [["patinho-refogado", 130, "130 g de patinho em tiras"], ["iogurte-natural-integral", 80, "½ pote de iogurte"], ["cogumelo", 50, "cogumelos"], ["molho-de-tomate", 30, "2 colheres de molho"], ["arroz-branco-cozido", 100, "3 colheres de arroz"]],
    ["Doure a carne, junte cogumelos e molho.", "Desligue e misture o iogurte.", "Sirva com arroz."]],
  ["carne-panela-batata", "Carne de panela com batata", ["almoco", "jantar"], 60, "média", ["panela de pressão"],
    [["acem-cozido", 130, "130 g de acém"], ["batata-cozida", 150, "1 batata média"], ["cenoura-cozida", 60, "½ cenoura"]],
    ["Doure a carne e cozinhe na pressão por 35 min.", "Junte batata e cenoura e cozinhe mais 10 min."]],
  ["sobrecoxa-mandioca", "Sobrecoxa assada com mandioca", ["almoco", "jantar"], 50, "fácil", ["forno", "airfryer"],
    [["sobrecoxa-de-frango-assada", 120, "1 sobrecoxa"], ["mandioca-cozida", 150, "1 pedaço de mandioca"], ["folhas-salada", 60, "salada"]],
    ["Tempere e asse a sobrecoxa (airfryer 200 °C, 25 min).", "Sirva com mandioca cozida e salada."]],
  ["salada-completa-frango", "Salada completa com frango", ["almoco", "jantar"], 15, "fácil", ["fogão"],
    [["folhas-salada", 100, "1 prato de folhas"], ["peito-de-frango-grelhado", 120, "1 filé de frango"], ["tomate", 60, "1 tomate"], ["ovo-inteiro", 50, "1 ovo cozido"], ["azeite", 10, "1 colher de azeite"]],
    ["Grelhe o frango.", "Monte a salada com tomate e ovo e regue com azeite e limão."]],
  ["tofu-legumes", "Tofu grelhado com legumes", ["almoco", "jantar"], 20, "fácil", ["fogão"],
    [["tofu", 150, "150 g de tofu"], ["legumes-refogados", 150, "legumes"], ["arroz-integral-cozido", 100, "3 colheres de arroz integral"], ["shoyu", 10, "shoyu"]],
    ["Doure o tofu em fatias.", "Salteie os legumes com shoyu e sirva com arroz."]],
  ["lentilha-legumes", "Lentilha com legumes", ["almoco", "jantar"], 30, "fácil", ["fogão", "panela de pressão"],
    [["lentilha-cozida", 150, "1 concha grande de lentilha"], ["cenoura-cozida", 60, "cenoura"], ["abobora-cozida", 80, "abóbora"], ["arroz-integral-cozido", 100, "arroz integral"]],
    ["Cozinhe a lentilha com cenoura e abóbora em cubos.", "Sirva com arroz integral."]],
  ["grao-de-bico-curry", "Grão-de-bico ao curry", ["almoco", "jantar"], 25, "fácil", ["fogão"],
    [["grao-de-bico-cozido", 150, "1 xícara de grão-de-bico"], ["tomate", 80, "1 tomate"], ["cebola", 40, "½ cebola"], ["arroz-branco-cozido", 100, "arroz"], [null, 0, "curry e cúrcuma a gosto"]],
    ["Refogue cebola e tomate com curry.", "Junte o grão-de-bico e cozinhe 10 min.", "Sirva com arroz."]],
  ["banana-aveia-microondas", "Banana com aveia no micro-ondas", ["cafe", "lanche", "pre-treino"], 3, "fácil", ["micro-ondas"],
    [["banana-prata", 90, "1 banana"], ["aveia-em-flocos", 20, "2 colheres de aveia"], [null, 0, "canela"]],
    ["Amasse a banana com a aveia e a canela.", "Micro-ondas por 1 min."]],
  ["sorvete-banana", "Sorvete de banana com pasta de amendoim", ["sobremesa", "lanche"], 5, "fácil", ["liquidificador"],
    [["banana-prata", 180, "2 bananas congeladas"], ["pasta-de-amendoim", 15, "1 colher de pasta de amendoim"]],
    ["Bata as bananas congeladas até ficar cremoso.", "Misture a pasta de amendoim e sirva."]],
  ["gelatina-iogurte", "Gelatina com iogurte grego", ["sobremesa", "lanche"], 3, "fácil", ["sem fogão"],
    [["gelatina", 120, "1 porção de gelatina pronta"], ["iogurte-grego-natural", 100, "1 pote pequeno de iogurte grego"]],
    ["Coloque a gelatina em pedaços num copo e cubra com o iogurte."]],
  ["pipoca-panela", "Pipoca de panela", ["lanche"], 10, "fácil", ["fogão"],
    [["pipoca", 25, "2 colheres de milho de pipoca"], ["azeite", 5, "1 colher de chá de azeite"]],
    ["Aqueça o azeite com o milho na panela tampada até parar de estourar.", "Tempere com sal."]],
  ["homus-cenoura", "Homus com palitos de cenoura", ["lanche"], 5, "fácil", ["sem fogão"],
    [["homus", 50, "2 colheres de homus"], ["cenoura-crua", 100, "1 cenoura em palitos"]],
    ["Corte a cenoura em palitos e sirva com o homus."]],
  ["castanhas-fruta", "Mix de castanhas com uva", ["lanche"], 2, "fácil", ["sem fogão"],
    [["castanha-de-caju", 20, "1 punhado de castanha de caju"], ["uva", 100, "1 cacho pequeno de uva"]],
    ["Sirva juntos — prático para levar."]],
  ["acai-fit", "Açaí fit na tigela", ["lanche", "sobremesa"], 5, "fácil", ["liquidificador"],
    [["acai-polpa-sem-xarope", 100, "1 polpa de açaí"], ["banana-prata", 90, "1 banana"], ["granola-tradicional", 20, "2 colheres de granola"]],
    ["Bata o açaí com metade da banana.", "Cubra com a outra metade e a granola."]],
  ["maca-assada", "Maçã assada com canela", ["sobremesa"], 15, "fácil", ["forno", "airfryer", "micro-ondas"],
    [["maca", 130, "1 maçã"], ["mel", 5, "1 fio de mel"], [null, 0, "canela"]],
    ["Corte a maçã ao meio, polvilhe canela.", "Asse até amaciar (airfryer 180 °C, 12 min) e finalize com mel."]],
  ["mousse-chocolate-abacate", "Mousse de chocolate com abacate", ["sobremesa"], 10, "fácil", ["liquidificador", "micro-ondas"],
    [["abacate", 100, "½ abacate"], ["chocolate-meio-amargo", 20, "2 quadradinhos de chocolate meio amargo derretido"], ["mel", 10, "1 colher de chá de mel"]],
    ["Bata o abacate com o chocolate derretido e o mel.", "Leve à geladeira por 30 min."]]
].map(([id, name, meals, minutes, difficulty, equipment, ingredients, steps, whey = null]) => ({ id, name, meals, minutes, difficulty, equipment, ingredients, steps, whey }));

// Receita com whey usa o whey da pessoa: item da marca/sabor (macros do rótulo) e o nome.
export function personalizeWhey(ingredients, profile) {
  if (!profile) return ingredients;
  const food = byId(profile.food_id);
  if (!food) return ingredients;
  const label = ["whey", profile.brand, profile.flavor].filter(Boolean).join(" ");
  return ingredients.map((entry) => {
    if (entry[0] !== "whey") return entry;
    const scoops = entry[1] / 30;
    const grams = Math.round(food.default_g * scoops);
    return [food.id, grams, `${scoops === 1 ? "1 scoop" : scoops === 0.5 ? "½ scoop" : `${scoops} scoops`} do seu ${label} (${grams} g)`];
  });
}

const MEAL_LABEL = { cafe: "café da manhã", almoco: "almoço", jantar: "jantar", lanche: "lanche", sobremesa: "sobremesa", "pos-treino": "pós-treino", "pre-treino": "pré-treino" };
const MEAT = /frango|patinho|carne|musculo|bife|bovin|hamburguer|salmao|tilapia|atum|peixe|camarao|bacon|presunto|peru|calabresa|linguica|lombo|pernil/;
const DAIRY = /leite-|iogurte|queijo|muçarela|parmesao|cottage|requeijao|creme-de-leite|manteiga|whey/;
// REC-05: trocas por função culinária (mesmo papel na receita).
const SUBSTITUTES = {
  "requeijao-cremoso": ["cottage", "cremosidade"], "creme-de-leite": ["iogurte-natural-integral", "cremosidade"],
  "iogurte-natural-integral": ["iogurte-de-soja", "cremosidade"], "iogurte-grego-natural": ["iogurte-de-soja", "cremosidade"],
  "leite-desnatado": ["bebida-de-soja", "líquido"], "leite-integral": ["bebida-de-soja", "líquido"],
  "muçarela": ["queijo-minas-frescal", "queijo que derrete"], "queijo-prato": ["queijo-minas-frescal", "queijo"],
  "manteiga": ["azeite", "gordura"], "mel": ["banana-prata", "doçura"], "arroz-branco-cozido": ["arroz-integral-cozido", "carboidrato"],
  "macarrao-cozido": ["abobrinha-cozida", "base (low carb)"], "pao-frances": ["pao-integral", "pão"], "pao-integral": ["tapioca-pronta", "pão"],
  "peito-de-frango-grelhado": ["tofu", "proteína"], "frango-desfiado": ["atum-enlatado-agua", "proteína"], "carne-moida-bovina": ["frango-desfiado", "proteína"],
  "batata-doce-cozida": ["mandioca-cozida", "carboidrato"], "whey": ["iogurte-grego-natural", "proteína"]
};

const byId = (id) => FOOD_CATALOG.find((food) => food.id === id);
const normalize = (text) => String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR").trim();
// Nome + apelidos do alimento, para casar "frango" com qualquer preparo de frango.
const foodText = (food) => (food ? normalize(`${food.name} ${(food.aliases || []).join(" ")}`) : "");
const fmt = (value) => Math.round(value).toLocaleString("pt-BR");

// REC-07: mesmos valores do catálogo usados no registro de refeições.
export function recipeNutrition(recipe) {
  const totals = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  for (const [id, grams] of recipe.ingredients) {
    const food = id && byId(id);
    if (!food || !grams) continue;
    totals.calories += food.kcal * grams / 100;
    totals.protein_g += food.protein * grams / 100;
    totals.carbs_g += food.carbs * grams / 100;
    totals.fat_g += food.fat * grams / 100;
  }
  return Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, Math.round(value * 10) / 10]));
}

export function recipeTags(recipe) {
  const ids = recipe.ingredients.map(([id]) => id).filter(Boolean);
  const nutrition = recipeNutrition(recipe);
  return [
    nutrition.protein_g >= 25 ? "rica em proteína" : null,
    nutrition.carbs_g <= 20 ? "low carb" : null,
    ids.some((id) => MEAT.test(id)) ? null : "vegetariana",
    ids.some((id) => DAIRY.test(id)) ? null : "sem lactose",
    ids.length <= 3 ? "poucos ingredientes" : null,
    recipe.minutes <= 10 ? "rápida" : null
  ].filter(Boolean);
}

export function getRecipe(id) {
  return RECIPES.find((recipe) => recipe.id === id) || null;
}

export function allRecipes() {
  return RECIPES;
}

// Filtros a partir do pedido. null quando a mensagem não fala de receita.
export function parseRecipeQuery(message) {
  const text = normalize(message);
  // "opções/ideias com whey" também são receitas (o plano de refeições não monta preparo com whey).
  const wheyIdeas = /\bwhey\b/.test(text) && /\b(?:opcoes|opcao|ideias?|sugest\w*|sugir\w*|o que (?:posso|da pra) fazer)\b/.test(text);
  if ((!/\breceitas?\b/.test(text) && !wheyIdeas) || /\b(?:minhas receitas favoritas|receitas favoritas|comi a receita|favoritar|salvar (?:a|essa) receita)\b/.test(text)) return null;
  const filters = { meal: null, maxMinutes: null, equipment: null, foods: [], tags: [], pantry: false, fitBudget: false };
  for (const [key, pattern] of [["cafe", /cafe da manha|desjejum/], ["almoco", /almoco/], ["jantar", /janta/], ["lanche", /lanche/], ["sobremesa", /sobremesa|doce/], ["pos-treino", /pos[- ]?treino/], ["pre-treino", /pre[- ]?treino/]]) {
    if (pattern.test(text)) { filters.meal = key; break; }
  }
  const minutes = text.match(/\b(?:ate|em|de|menos de)\s*(\d{1,3})\s*min/);
  if (minutes) filters.maxMinutes = Number(minutes[1]);
  else if (/\b(?:rapida|rapidinha|rapido|pratica|facil e rapida)\b/.test(text)) filters.maxMinutes = 15;
  for (const [equipment, pattern] of [["airfryer", /air ?fryer|fritadeira/], ["forno", /\bforno\b/], ["micro-ondas", /micro ?ondas/], ["liquidificador", /liquidificador/], ["sem fogão", /sem (?:fogao|cozinhar)|sem ir ao fogo/]]) {
    if (pattern.test(text)) filters.equipment = equipment;
  }
  if (/vegetarian|sem carne/.test(text)) filters.tags.push("vegetariana");
  if (/vegan/.test(text)) filters.tags.push("vegetariana", "sem lactose");
  if (/sem lactose/.test(text)) filters.tags.push("sem lactose");
  if (/proteic|proteina|proteína/.test(text)) filters.tags.push("rica em proteína");
  if (/low ?carb|pouco carbo/.test(text)) filters.tags.push("low carb");
  if (/poucos ingredientes|simples/.test(text)) filters.tags.push("poucos ingredientes");
  if (/(?:o que|com o que) (?:eu )?tenho|despensa|geladeira|em casa/.test(text)) filters.pantry = true;
  // DSP-03: "receita com o que vai vencer".
  if (/\b(?:vai vencer|vence(?:ndo)?|vencimento|antes de estragar|esta para vencer)\b/.test(text)) { filters.pantry = true; filters.expiring = true; }
  if (/saldo|caiba|cabe na (?:minha )?meta|minha meta|meus macros/.test(text)) filters.fitBudget = true;
  // Ingrediente pedido ("com frango", "de atum"): guarda a palavra do alimento, que casa
  // com qualquer preparo dele nas receitas (frango grelhado, desfiado…).
  const withFoods = text.match(/\b(?:com|de)\s+([a-z ]+?)(?:\s+(?:para|pro|pra|no|na|em|ate|que|sem)\b|[?.!,]|$)/g) || [];
  for (const chunk of withFoods) {
    const words = chunk.replace(/^(?:com|de)\s+/, "").split(/\s+/)
      .filter((word) => word.length >= 3 && !/^(?:cafe|manha|almoco|jantar|janta|lanche|sobremesa|doce|treino|pos|pre|rapida|rapido|facil|airfryer|forno|proteina|proteica|lactose|carbo|carboidrato|ingredientes)$/.test(word));
    const candidates = findFoodCandidates(chunk.replace(/^(?:com|de)\s+/, ""));
    for (const word of words) {
      const known = candidates.length
        ? candidates.some((food) => foodText(food).includes(word))
        : !/^(?:que|tenho|casa|minha|meu|para|receita)$/.test(word) && FOOD_CATALOG.some((food) => foodText(food).split(/\s+/).includes(word));
      if (known) filters.foods.push(word.replace(/s$/, ""));
    }
  }
  filters.foods = [...new Set(filters.foods)];
  filters.tags = [...new Set(filters.tags)];
  return filters;
}

// Pontua e devolve até `limit` receitas. Ingrediente pedido é obrigatório; despensa e
// saldo do dia ordenam. pantryNames: nomes dos itens da despensa ("Frango", "Ovos").
export function searchRecipes(filters, { pantryNames = [], expiringNames = [], budgetKcal = null, limit = 5, wheyGroup = null, minPantry = 2, excluded = [] } = {}) {
  const firstWord = (name) => normalize(name).split(/\s+/)[0].replace(/s$/, "");
  const pantryWords = pantryNames.map(firstWord).filter((word) => word.length >= 3);
  const expiringWords = expiringNames.map(firstWord).filter((word) => word.length >= 3);
  return RECIPES
    .map((recipe) => {
      const ids = recipe.ingredients.map(([id]) => id).filter(Boolean);
      const texts = ids.map((id) => foodText(byId(id)));
      const tags = recipeTags(recipe);
      const nutrition = recipeNutrition(recipe);
      if (filters.meal && !recipe.meals.includes(filters.meal)) return null;
      if (filters.maxMinutes && recipe.minutes > filters.maxMinutes) return null;
      if (filters.equipment && !recipe.equipment.includes(filters.equipment)) return null;
      if (filters.tags.some((tag) => !tags.includes(tag))) return null;
      if (recipe.whey && wheyGroup && !recipe.whey.includes(wheyGroup)) return null;
      // CONV-08: restrições do perfil (vegetariana, sem lactose, sem porco…).
      if (excluded.length && recipe.ingredients.some(([id, , label]) => violatesRestrictions(`${foodText(byId(id))} ${label}`, excluded))) return null;
      if (filters.foods.length && !filters.foods.every((word) => texts.some((text) => text.includes(word)))) return null;
      const fromPantry = texts.filter((text) => pantryWords.some((word) => text.includes(word)));
      // DSP-03: o que vence em até 3 dias pesa mais (e é obrigatório em "o que vai vencer").
      const expiring = expiringWords.filter((word) => texts.some((text) => text.includes(word)));
      if (filters.expiring && !expiring.length) return null;
      if (filters.pantry && !filters.expiring && pantryWords.length && fromPantry.length < Math.min(expiring.length ? 1 : minPantry, ids.length)) return null;
      if (filters.fitBudget && budgetKcal != null && nutrition.calories > budgetKcal) return null;
      const score = fromPantry.length * 3 + expiring.length * 5 + (tags.includes("rica em proteína") ? 1 : 0) - recipe.minutes / 60;
      const expiringLabels = expiringNames.filter((name) => expiring.includes(firstWord(name)));
      return { recipe, nutrition, tags, fromPantry, expiring: expiringLabels, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

const nutritionLine = (nutrition, servings = 1) =>
  `🔥 ${fmt(nutrition.calories * servings)} kcal · 🥩 P ${fmt(nutrition.protein_g * servings)} g · 🍚 C ${fmt(nutrition.carbs_g * servings)} g · 🥑 G ${fmt(nutrition.fat_g * servings)} g`;

export function buildRecipeList(results, filters) {
  if (!results.length) {
    return "🍳 Não encontrei receita com esses filtros. Tente tirar um (ex.: tempo ou ingrediente) ou peça *receitas de almoço*, *receita rápida com frango* ou *receita com o que tenho em casa*.";
  }
  const title = filters.pantry ? "🍳 *Receitas com o que você tem em casa*" : "🍳 *Receitas para você*";
  return [
    title,
    "",
    // Uma receita por bloco, com linha em branco entre elas.
    ...results.flatMap(({ recipe, nutrition, fromPantry, expiring = [] }, index) => [
      `*${index + 1}. ${recipe.name}*`,
      `⏱️ ${recipe.minutes} min · 🔥 ${fmt(nutrition.calories)} kcal · 🥩 ${fmt(nutrition.protein_g)} g de proteína${fromPantry.length && filters.pantry ? `\n🧺 Usa ${fromPantry.length} ${fromPantry.length === 1 ? "item" : "itens"} da sua despensa` : ""}${expiring.length ? `\n⏰ Usa o que vence logo: ${expiring.join(", ").toLocaleLowerCase("pt-BR")}` : ""}`,
      ""
    ]),
    "👉 Mande o *número* para ver a receita completa."
  ].join("\n");
}

function swapHint(ingredients) {
  const swappable = ingredients.find(([id]) => id && SUBSTITUTES[id] && byId(SUBSTITUTES[id][0]));
  const example = swappable
    ? `*trocar ${byId(swappable[0]).name.toLocaleLowerCase("pt-BR")} por ${byId(SUBSTITUTES[swappable[0]][0]).name.toLocaleLowerCase("pt-BR")}*, `
    : "";
  return `_Comeu? Mande *comi a receita* (ou *comi 2 porções*). Também dá para ${example}*favoritar*._`;
}

export function buildRecipeCard(recipe, { ingredients = recipe.ingredients, note = null } = {}) {
  const shown = { ...recipe, ingredients };
  const nutrition = recipeNutrition(shown);
  return [
    `🍳 *${recipe.name}*`,
    `⏱️ ${recipe.minutes} min · ${recipe.difficulty} · ${recipe.equipment.join(", ")} · rende 1 porção`,
    `🏷️ ${[...recipe.meals.map((meal) => MEAL_LABEL[meal]), ...recipeTags(shown)].join(" · ")}`,
    note,
    "",
    "*Ingredientes*",
    ...ingredients.map(([, , label]) => `• ${label}`),
    "",
    "*Modo de preparo*",
    ...recipe.steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    `*Por porção:* ${nutritionLine(nutrition)}`,
    "",
    swapHint(ingredients)
  ].filter((line) => line !== null).join("\n");
}

// REC-05: troca de ingrediente na receita aberta. "troca o requeijão por cottage",
// "sem leite" (usa a troca pela função culinária).
function swapIngredient(ingredients, message) {
  const text = normalize(message);
  const swap = text.match(/\b(?:troca\w*|substitu\w*|muda\w*)\s+(?:o |a |os |as )?(.+?)\s+por\s+(.+)$/);
  const without = text.match(/\b(?:sem|tira\w*)\s+(?:o |a |os |as )?([a-z ]+?)(?:\s+na receita)?$/);
  if (!swap && !without) return null;
  const fromIds = findFoodCandidates(swap ? swap[1] : without[1]).map((food) => food.id);
  const index = ingredients.findIndex(([id]) => id && (fromIds.includes(id) || fromIds.some((from) => from.split("-")[0] === id.split("-")[0])));
  if (index < 0) return { error: "Esse ingrediente não está nesta receita." };
  const [oldId, grams] = ingredients[index];
  const replacement = swap ? findFoodCandidates(swap[2])[0] : byId(SUBSTITUTES[oldId]?.[0]);
  if (!replacement) return { error: swap ? "Não encontrei o ingrediente novo no catálogo." : "Não tenho uma troca boa para esse ingrediente; diga por qual quer trocar." };
  const updated = ingredients.map((entry, position) => position === index ? [replacement.id, grams, `${grams} g de ${replacement.name.toLocaleLowerCase("pt-BR")} (no lugar de ${byId(oldId)?.name.toLocaleLowerCase("pt-BR") || "original"})`] : entry);
  const role = SUBSTITUTES[oldId]?.[1];
  return { ingredients: updated, note: `🔁 Troquei ${byId(oldId)?.name.toLocaleLowerCase("pt-BR")} por ${replacement.name.toLocaleLowerCase("pt-BR")}${role ? ` (mesma função: ${role})` : ""}. Macros recalculados.` };
}

export function handleRecipeMessage(userId, message, { today, budgetKcal = null, mealPeriod = null } = {}) {
  const text = normalize(message).replace(/[?!.]+$/, "");
  const user = getUser(userId) || {};
  const state = user.recipe_state ? JSON.parse(user.recipe_state) : {};
  const recent = (minutes) => state.at && Date.now() - state.at <= minutes * 60 * 1000;
  const save = (changes) => setRecipeState(userId, JSON.stringify({ ...state, ...changes, at: Date.now() }));
  const open = state.open && getRecipe(state.open);

  // Número da lista mostrada há pouco.
  const pick = text.match(/^(?:a |receita |numero |n[o°] ?)?([1-5])$/);
  if (pick && state.list?.length && recent(30)) {
    const recipe = getRecipe(state.list[Number(pick[1]) - 1]);
    if (!recipe) return null;
    const personal = recipe.whey ? personalizeWhey(recipe.ingredients, getWheyProfile(userId)) : null;
    save({ open: recipe.id, ingredients: personal });
    return buildRecipeCard(recipe, personal ? { ingredients: personal } : {});
  }
  if (/\b(?:minhas receitas favoritas|receitas favoritas|minhas favoritas)\b/.test(text)) {
    const favorites = (state.favorites || []).map(getRecipe).filter(Boolean);
    if (!favorites.length) return "⭐ Você ainda não tem receitas favoritas. Abra uma receita e mande *favoritar*.";
    save({ list: favorites.map((recipe) => recipe.id) });
    return ["⭐ *Suas receitas favoritas*", "", ...favorites.flatMap((recipe, index) => [`*${index + 1}. ${recipe.name}*`, `⏱️ ${recipe.minutes} min · 🔥 ${fmt(recipeNutrition(recipe).calories)} kcal`, ""]), "👉 Mande o *número* para ver a receita."].join("\n");
  }
  if (open && recent(180)) {
    if (/^(?:favoritar|favorita|salvar (?:a |essa )?receita|salva (?:a |essa )?receita|adicionar (?:as|aos) favoritos)\b/.test(text)) {
      save({ favorites: [...new Set([...(state.favorites || []), open.id])] });
      return `⭐ *${open.name}* salva nas favoritas. Peça *minhas receitas favoritas* quando quiser.`;
    }
    const ate = text.match(/^(?:comi|almocei|jantei|lanchei|fiz e comi)\s+(?:a receita|essa receita|(\d+(?:[.,]5)?|uma|duas|meia)\s+porc(?:ao|oes)(?: da receita)?)$/);
    if (ate) {
      const servings = { uma: 1, duas: 2, meia: 0.5 }[ate[1]] ?? (ate[1] ? Number(ate[1].replace(",", ".")) : 1);
      const ingredients = state.ingredients || open.ingredients;
      const nutrition = recipeNutrition({ ...open, ingredients });
      const saved = saveMeal(userId, {
        description: `Receita: ${open.name}${servings !== 1 ? ` (${String(servings).replace(".", ",")} porções)` : ""}`,
        calories: nutrition.calories * servings, protein_g: nutrition.protein_g * servings, carbs_g: nutrition.carbs_g * servings, fat_g: nutrition.fat_g * servings,
        meal_period: mealPeriod
      });
      if (!saved) return "Não consegui registrar a receita. Nada foi gravado.";
      return [`✅ *Refeição registrada* · #${saved.id}`, `🍽️ ${open.name}${servings !== 1 ? ` · ${String(servings).replace(".", ",")} porções` : ""}`, "", nutritionLine(nutrition, servings)].join("\n");
    }
    const swapped = /\b(?:troca\w*|substitu\w*|muda\w*)\b.+\bpor\b|^(?:sem|tira\w*)\s/.test(text) ? swapIngredient(state.ingredients || open.ingredients, message) : null;
    if (swapped?.error) return swapped.error;
    if (swapped) {
      save({ ingredients: swapped.ingredients });
      return buildRecipeCard(open, { ingredients: swapped.ingredients, note: swapped.note });
    }
  }
  // "receita de strogonoff fit" pelo nome.
  const byName = text.match(/\breceita (?:de|do|da)\s+(.+)$/);
  if (byName) {
    const wanted = byName[1].replace(/\b(?:fit|saudavel|caseir[oa])\b/g, "").trim();
    const matches = wanted.length >= 4 ? RECIPES.filter((item) => normalize(item.name).includes(wanted)) : [];
    const recipe = matches.length === 1 ? matches[0] : null;
    if (recipe) {
      const personal = recipe.whey ? personalizeWhey(recipe.ingredients, getWheyProfile(userId)) : null;
      save({ open: recipe.id, ingredients: personal });
      return buildRecipeCard(recipe, personal ? { ingredients: personal } : {});
    }
  }
  const filters = parseRecipeQuery(message);
  if (!filters) return null;
  if (!filters.meal && mealPeriod && !filters.foods.length && !filters.pantry) {
    filters.meal = { "café da manhã": "cafe", almoço: "almoco", "lanche da tarde": "lanche", jantar: "jantar", ceia: "lanche" }[mealPeriod] || null;
  }
  const pantryItems = filters.pantry ? getPantry(userId) : [];
  const pantryNames = pantryItems.map((item) => item.name);
  const expiringNames = pantryItems
    .filter((item) => item.expires_on && today && item.expires_on >= today && item.expires_on <= addDaysIso(today, 3))
    .map((item) => item.name);
  if (filters.expiring && pantryItems.length && !expiringNames.length) {
    return "⏰ Nada da sua despensa vence nos próximos 3 dias. 👍 Peça *receita com o que tenho em casa* para ver tudo.";
  }
  if (filters.pantry && !pantryNames.length) {
    return "🧺 Sua despensa está vazia. Me conte o que comprou (ex.: *comprei 1 kg de frango e 12 ovos*) que eu sugiro receitas com isso.";
  }
  const whey = getWheyProfile(userId);
  const flavorInText = /\bwhey\b/.test(text) && text.match(/\bwhey\b.*?\b(?:de|sabor)\s+([a-z ]+)$/)?.[1];
  const wheyGroup = flavorInText ? flavorGroup(flavorInText.trim()) : whey?.group || null;
  const searchOptions = { pantryNames, expiringNames, budgetKcal: filters.fitBudget ? budgetKcal : null, wheyGroup, excluded: excludedTerms(user) };
  let results = searchRecipes(filters, searchOptions);
  // Despensa pequena: nenhuma receita usa 2 itens; aceita as que usam 1.
  if (!results.length && filters.pantry) results = searchRecipes(filters, { ...searchOptions, minPantry: 1 });
  save({ list: results.map(({ recipe }) => recipe.id) });
  return buildRecipeList(results, filters);
}
