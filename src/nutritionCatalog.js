/*
  FITPULSE AI — CATÁLOGO NUTRICIONAL BRASILEIRO
  Camada de dados separada da lógica de geração/validação.

  Valores base por 100 g ou por porção explícita.
  O catálogo é curado para alimentos/preparações comuns no Brasil.
  Fontes:
  - TBCA/USP para referências verificadas e preparações brasileiras específicas.
  - Rótulos oficiais de fabricantes quando a marca é explicitamente indicada.
  - Valores estimativos curados para itens sem referência específica no catálogo.
*/

import { matchFoodTerms, parseQuantity, QUANTITY_PATTERN } from "./foodMatching.js";

const F = (
  id, name, aliases, kcal, protein, carbs, fat,
  default_g, unit = "porção", source = "curated_estimate"
) => ({
  id, name, aliases, kcal, protein, carbs, fat, default_g, unit, source
});

export const FOOD_CATALOG = [
  F("whey", "Whey protein", ["whey", "whey protein", "proteína em pó", "proteina em po"], 410, 80.0, 7.0, 6.0, 30, "30 g", "label_dependent_estimate"),
  // =========================================================
  // CEREAIS / PÃES / MASSAS
  // =========================================================
  F("arroz-branco-cozido", "Arroz branco cozido", ["arroz", "arroz branco"], 130, 2.7, 28.2, 0.3, 100, "100 g", "tbca_aligned"),
  F("arroz-integral-cozido", "Arroz integral cozido", ["arroz integral"], 123, 2.6, 25.8, 1.0, 100, "100 g", "tbca_aligned"),
  F("arroz-japones-cozido", "Arroz japonês para sushi", ["arroz para sushi", "arroz sushi", "shari"], 150, 2.5, 33.0, 0.3, 100, "100 g", "curated_estimate"),
  F("arroz-a-grega", "Arroz à grega", ["arroz a grega"], 150, 3.0, 29.5, 2.0, 100, "100 g", "curated_estimate"),
  F("arroz-com-alho-e-oleo", "Arroz com alho e óleo", ["arroz com alho", "arroz com óleo"], 150, 2.5, 27.5, 3.2, 100, "100 g", "tbca_aligned"),
  F("feijao-carioca-cozido", "Feijão carioca cozido", ["feijão", "feijao", "feijão carioca"], 76, 4.8, 13.6, 0.5, 100, "100 g", "tbca_aligned"),
  F("feijao-preto-cozido", "Feijão preto cozido", ["feijão preto"], 77, 4.5, 14.0, 0.5, 100, "100 g", "tbca_aligned"),
  F("lentilha-cozida", "Lentilha cozida", ["lentilha"], 116, 9.0, 20.1, 0.4, 100, "100 g", "tbca_aligned"),
  F("grao-de-bico-cozido", "Grão-de-bico cozido", ["grão-de-bico", "grao de bico"], 164, 8.9, 27.4, 2.6, 100, "100 g", "tbca_aligned"),
  F("ervilha-cozida", "Ervilha cozida", ["ervilha"], 84, 5.4, 15.6, 0.4, 100, "100 g", "curated_estimate"),
  F("milho-cozido", "Milho cozido", ["milho"], 96, 3.4, 21.0, 1.5, 100, "100 g", "curated_estimate"),
  F("aveia-em-flocos", "Aveia em flocos", ["aveia", "flocos de aveia"], 389, 16.9, 66.3, 6.9, 40, "40 g", "tbca_aligned"),
  F("granola-tradicional", "Granola tradicional", ["granola"], 450, 10.0, 65.0, 16.0, 30, "30 g", "curated_estimate"),
  F("farinha-de-aveia", "Farinha de aveia", ["farinha de aveia"], 404, 14.0, 66.0, 9.0, 30, "30 g", "curated_estimate"),
  F("farinha-de-mandioca", "Farinha de mandioca", ["farinha de mandioca"], 365, 1.4, 87.0, 0.5, 30, "30 g", "tbca_aligned"),
  F("farofa-pronta", "Farofa temperada", ["farofa"], 410, 5.5, 60.0, 16.0, 40, "40 g", "curated_estimate"),
  F("cuscuz-de-milho-cozido", "Cuscuz de milho cozido", ["cuscuz", "cuscuz paulista"], 112, 2.2, 25.0, 0.7, 100, "100 g", "tbca_aligned"),
  F("tapioca-pronta", "Tapioca pronta", ["tapioca", "massa de tapioca"], 230, 0.2, 57.0, 0.0, 60, "60 g", "curated_estimate"),
  F("macarrao-cozido", "Macarrão cozido", ["macarrão", "macarrao", "massa"], 158, 5.8, 30.9, 0.9, 160, "160 g", "tbca_aligned"),
  F("macarrao-instantaneo", "Macarrão instantâneo preparado", ["miojo", "macarrão instantâneo", "miojo preparado"], 450, 8.5, 62.0, 18.0, 80, "80 g", "curated_estimate"),
  F("pao-frances", "Pão francês", ["pão francês", "pao frances", "pão de sal", "cacetinho"], 300, 8.0, 58.0, 3.2, 50, "1 unidade", "tbca_aligned"),
  F("pao-forma", "Pão de forma tradicional", ["pão de forma", "pao de forma", "pão branco fatiado"], 256, 9.0, 49.0, 3.2, 25, "1 fatia", "curated_estimate"),
  F("pao-integral", "Pão integral", ["pão integral", "pao integral"], 250, 10.0, 43.0, 4.0, 25, "1 fatia", "curated_estimate"),
  F("pao-de-leite", "Pão de leite", ["pão de leite", "pao de leite"], 300, 9.0, 52.0, 6.0, 50, "1 unidade", "curated_estimate"),
  F("pao-de-hamburguer", "Pão de hambúrguer", ["pão de hambúrguer", "pao de hamburguer", "bun"], 280, 9.0, 50.0, 5.0, 55, "1 unidade", "curated_estimate"),
  F("pao-sirio", "Pão sírio", ["pão sírio", "pao sirio", "pita"], 275, 9.0, 56.0, 1.5, 60, "1 unidade", "curated_estimate"),
  F("torrada-integral", "Torrada integral", ["torrada integral"], 380, 12.0, 67.0, 6.0, 30, "30 g", "curated_estimate"),
  F("biscoito-cream-cracker", "Biscoito cream cracker", ["cream cracker", "agua e sal", "biscoito salgado"], 430, 10.0, 70.0, 13.0, 30, "30 g", "tbca_aligned"),
  F("biscoito-maizena", "Biscoito maisena", ["maisena", "biscoito maisena", "bolacha maisena"], 430, 7.0, 75.0, 13.0, 30, "30 g", "tbca_aligned"),
  F("biscoito-recheado-chocolate", "Biscoito recheado de chocolate", ["biscoito recheado", "bolacha recheada"], 480, 6.0, 70.0, 20.0, 30, "30 g", "curated_estimate"),

  // =========================================================
  // CARNES — CORTES E PREPAROS
  // =========================================================
  F("patinho-grelhado", "Patinho grelhado", ["patinho", "bife de patinho"], 212, 34.2, 0.0, 8.0, 150, "150 g", "tbca_verified"),
  F("patinho-refogado", "Patinho refogado", ["patinho refogado", "carne moída de patinho"], 165, 27.9, 0.0, 5.6, 130, "130 g", "tbca_verified"),
  F("bife-acebolado", "Bife acebolado", ["bife acebolado", "bife com cebola", "bife acebolado com cebola"], 230, 29.0, 2.5, 10.5, 150, "150 g", "curated_estimate"),
  F("musculo-cozido", "Músculo bovino cozido", ["músculo", "musculo"], 216, 31.2, 0.0, 9.9, 150, "150 g", "tbca_verified"),
  F("acem-cozido", "Acém bovino cozido", ["acém", "acem"], 190, 27.0, 0.0, 8.0, 150, "150 g", "curated_estimate"),
  F("coxao-mole-grelhado", "Coxão mole grelhado", ["coxão mole", "coxao mole"], 190, 31.0, 0.0, 7.0, 150, "150 g", "curated_estimate"),
  F("coxao-duro-cozido", "Coxão duro cozido", ["coxão duro", "coxao duro"], 195, 29.0, 0.0, 8.0, 150, "150 g", "curated_estimate"),
  F("lagarto-cozido", "Lagarto cozido", ["lagarto bovino", "lagarto"], 185, 30.0, 0.0, 6.5, 150, "150 g", "curated_estimate"),
  F("alcatra-grelhada", "Alcatra grelhada", ["alcatra"], 210, 31.0, 0.0, 9.0, 150, "150 g", "curated_estimate"),
  F("contrafile-grelhado", "Contrafilé grelhado", ["contrafilé", "contrafile"], 250, 30.0, 0.0, 14.0, 150, "150 g", "curated_estimate"),
  F("file-mignon-grelhado", "Filé-mignon grelhado", ["filé mignon", "file mignon"], 220, 32.0, 0.0, 9.0, 150, "150 g", "curated_estimate"),
  F("maminha-grelhada", "Maminha grelhada", ["maminha"], 230, 29.0, 0.0, 12.0, 150, "150 g", "curated_estimate"),
  F("fraldinha-grelhada", "Fraldinha grelhada", ["fraldinha"], 240, 28.0, 0.0, 14.0, 150, "150 g", "curated_estimate"),
  F("picanha-grelhada", "Picanha grelhada", ["picanha"], 280, 27.0, 0.0, 19.0, 150, "150 g", "curated_estimate"),
  F("costela-bovina-assada", "Costela bovina assada", ["costela bovina", "costela"], 370, 24.0, 0.0, 30.0, 120, "120 g", "curated_estimate"),
  F("carne-moida-bovina", "Carne moída bovina", ["carne moída", "carne moida"], 220, 26.0, 0.0, 13.0, 130, "130 g", "curated_estimate"),
  F("fiiambre-bovino", "Rosbife bovino", ["rosbife"], 190, 30.0, 0.0, 7.0, 100, "100 g", "curated_estimate"),
  F("figado-bovino-grelhado", "Fígado bovino grelhado", ["fígado", "figado"], 175, 26.0, 4.0, 5.0, 100, "100 g", "curated_estimate"),

  // =========================================================
  // AVES / PORCO
  // =========================================================
  F("peito-de-frango-grelhado", "Peito de frango grelhado", ["frango", "peito de frango", "frango grelhado"], 165, 31.0, 0.0, 3.6, 150, "150 g", "tbca_aligned"),
  F("frango-desfiado", "Frango desfiado", ["frango desfiado"], 165, 31.0, 0.0, 3.6, 120, "120 g", "curated_estimate"),
  F("coxa-de-frango-assada", "Coxa de frango assada", ["coxa de frango", "coxa"], 215, 26.0, 0.0, 11.0, 120, "120 g", "curated_estimate"),
  F("sobrecoxa-de-frango-assada", "Sobrecoxa de frango assada", ["sobrecoxa", "sobrecoxa de frango"], 230, 25.0, 0.0, 14.0, 120, "120 g", "curated_estimate"),
  F("asa-de-frango-assada", "Asa de frango assada", ["asa de frango", "asa"], 254, 23.0, 0.0, 17.0, 100, "100 g", "curated_estimate"),
  F("frango-empanado-assado", "Frango empanado assado", ["frango empanado"], 220, 23.0, 17.0, 7.0, 120, "120 g", "curated_estimate"),
  F("peru-assado", "Peito de peru assado", ["peru assado", "peito de peru assado"], 150, 29.0, 0.0, 3.0, 120, "120 g", "curated_estimate"),
  F("lombo-suino-assado", "Lombo suíno assado", ["lombo suíno", "lombo suino", "lombo"], 205, 29.0, 0.0, 9.0, 150, "150 g", "curated_estimate"),
  F("pernil-suino-assado", "Pernil suíno assado", ["pernil", "pernil suíno"], 245, 27.0, 0.0, 15.0, 150, "150 g", "curated_estimate"),
  F("bisteca-suina-grelhada", "Bisteca suína grelhada", ["bisteca suína", "bisteca suina", "bisteca"], 250, 27.0, 0.0, 16.0, 150, "150 g", "curated_estimate"),
  F("bacon-frito", "Bacon frito", ["bacon"], 541, 37.0, 1.4, 42.0, 30, "30 g", "curated_estimate"),
  F("calabresa-grelhada", "Linguiça calabresa grelhada", ["calabresa", "linguiça calabresa"], 330, 14.0, 2.0, 29.0, 80, "80 g", "curated_estimate"),
  F("linguica-toscana-assada", "Linguiça toscana assada", ["linguiça toscana", "linguica toscana"], 320, 15.0, 2.0, 28.0, 100, "100 g", "curated_estimate"),
  F("presunto-cozido", "Presunto cozido", ["presunto"], 120, 18.0, 1.5, 5.0, 60, "60 g", "curated_estimate"),
  F("peito-de-peru-fatiado", "Peito de peru fatiado", ["peito de peru", "peito de peru frio"], 110, 18.0, 3.0, 3.0, 60, "60 g", "curated_estimate"),
  F("mortadela", "Mortadela", ["mortadela"], 310, 11.0, 2.0, 28.0, 50, "50 g", "curated_estimate"),
  F("salame", "Salame", ["salame"], 410, 20.0, 2.0, 35.0, 40, "40 g", "curated_estimate"),

  // =========================================================
  // PEIXES / FRUTOS DO MAR
  // =========================================================
  F("salmao-grelhado", "Salmão grelhado", ["salmão", "salmao", "salmão grelhado"], 206, 22.1, 0.0, 12.4, 150, "150 g", "curated_estimate"),
  F("salmao-cru", "Salmão cru", ["salmão cru", "salmao cru"], 208, 20.5, 0.0, 13.4, 100, "100 g", "curated_estimate"),
  F("tilapia-grelhada", "Tilápia grelhada", ["tilápia", "tilapia"], 128, 26.0, 0.0, 2.7, 150, "150 g", "curated_estimate"),
  F("atum-fresco-grelhado", "Atum fresco grelhado", ["atum fresco"], 184, 29.9, 0.0, 6.3, 150, "150 g", "curated_estimate"),
  F("atum-enlatado-agua", "Atum em água", ["atum em água", "atum enlatado", "atum natural"], 116, 25.5, 0.0, 0.8, 120, "120 g", "curated_estimate"),
  F("sardinha-assada", "Sardinha assada", ["sardinha"], 208, 24.6, 0.0, 11.5, 120, "120 g", "curated_estimate"),
  F("bacalhau-cozido", "Bacalhau cozido", ["bacalhau"], 105, 23.0, 0.0, 0.9, 150, "150 g", "curated_estimate"),
  F("merluza-grelhada", "Merluza grelhada", ["merluza"], 120, 24.0, 0.0, 2.5, 150, "150 g", "curated_estimate"),
  F("pescada-grelhada", "Pescada grelhada", ["pescada"], 120, 24.0, 0.0, 2.5, 150, "150 g", "curated_estimate"),
  F("camarao-cozido", "Camarão cozido", ["camarão", "camarao"], 99, 24.0, 0.2, 0.3, 120, "120 g", "curated_estimate"),
  F("polvo-cozido", "Polvo cozido", ["polvo"], 82, 15.6, 2.2, 1.0, 120, "120 g", "curated_estimate"),

  // =========================================================
  // OVOS / LATICÍNIOS
  // =========================================================
  F("ovo-inteiro", "Ovo inteiro", ["ovo", "ovos"], 143, 12.6, 0.7, 9.5, 50, "1 unidade", "curated_estimate"),
  F("clara-de-ovo", "Clara de ovo", ["clara", "claras"], 52, 10.9, 0.7, 0.2, 33, "1 unidade", "curated_estimate"),
  F("queijo-minas-frescal", "Queijo minas frescal", ["queijo minas", "minas frescal"], 264, 17.4, 3.0, 20.8, 40, "40 g", "curated_estimate"),
  F("muçarela", "Queijo muçarela", ["muçarela", "mucarela", "mussarela"], 300, 22.0, 2.0, 22.0, 30, "30 g", "curated_estimate"),
  F("parmesao", "Queijo parmesão", ["parmesão", "parmesao"], 392, 35.8, 3.2, 25.0, 15, "15 g", "curated_estimate"),
  F("queijo-prato", "Queijo prato", ["queijo prato"], 360, 22.0, 1.5, 29.0, 30, "30 g", "curated_estimate"),
  F("cottage", "Queijo cottage", ["cottage"], 98, 11.1, 3.4, 4.3, 60, "60 g", "curated_estimate"),
  F("requeijao-cremoso", "Requeijão cremoso", ["requeijão", "requeijao"], 260, 9.0, 4.0, 23.0, 30, "30 g", "curated_estimate"),
  F("cream-cheese", "Cream cheese", ["cream cheese", "creamcheese"], 342, 6.2, 4.1, 34.0, 30, "30 g", "curated_estimate"),
  F("catupiry", "Catupiry / requeijão culinário", ["Catupiry", "catupiry"], 250, 8.0, 4.0, 23.0, 30, "30 g", "curated_estimate"),
  F("iogurte-natural-integral", "Iogurte natural integral", ["iogurte", "iogurte natural"], 61, 3.5, 4.7, 3.3, 170, "1 pote", "curated_estimate"),
  F("iogurte-grego-natural", "Iogurte grego natural", ["iogurte grego", "grego"], 95, 8.5, 6.0, 4.0, 150, "1 pote", "curated_estimate"),
  F("leite-integral", "Leite integral", ["leite integral", "leite"], 61, 3.2, 4.8, 3.3, 200, "200 ml", "curated_estimate"),
  F("leite-desnatado", "Leite desnatado", ["leite desnatado"], 35, 3.4, 5.0, 0.2, 200, "200 ml", "curated_estimate"),
  F("creme-de-leite", "Creme de leite", ["creme de leite"], 194, 2.1, 3.0, 19.0, 50, "50 g", "curated_estimate"),
  F("leite-condensado", "Leite condensado", ["leite condensado"], 321, 7.7, 54.0, 8.7, 20, "20 g", "curated_estimate"),

  // =========================================================
  // VEGETAIS / TUBÉRCULOS
  // =========================================================
  F("batata-cozida", "Batata inglesa cozida", ["batata cozida", "batata inglesa cozida", "batata inglesa"], 87, 1.9, 20.1, 0.1, 180, "180 g", "tbca_aligned"),
  F("batata-assada", "Batata assada", ["batata assada"], 93, 2.5, 21.0, 0.1, 180, "180 g", "curated_estimate"),
  F("batata-frita", "Batata frita", ["batata frita", "fritas"], 312, 3.4, 41.0, 15.0, 100, "100 g", "curated_estimate"),
  F("batata-doce-cozida", "Batata-doce cozida", ["batata-doce", "batata doce"], 76, 1.4, 18.2, 0.1, 150, "150 g", "curated_estimate"),
  F("mandioca-cozida", "Mandioca cozida", ["mandioca", "aipim", "macaxeira"], 125, 1.0, 30.0, 0.3, 150, "150 g", "tbca_aligned"),
  F("mandioquinha-cozida", "Mandioquinha cozida", ["mandioquinha", "batata-baroa"], 80, 0.9, 18.0, 0.2, 150, "150 g", "curated_estimate"),
  F("inhame-cozido", "Inhame cozido", ["inhame"], 116, 1.5, 27.5, 0.1, 150, "150 g", "curated_estimate"),
  F("cenoura-cozida", "Cenoura cozida", ["cenoura"], 35, 0.8, 8.2, 0.2, 100, "100 g", "curated_estimate"),
  F("brocolis-cozido", "Brócolis cozido", ["brócolis", "brocolis"], 35, 2.4, 7.2, 0.4, 100, "100 g", "curated_estimate"),
  F("couve-flor-cozida", "Couve-flor cozida", ["couve-flor", "couve flor"], 25, 1.9, 5.0, 0.3, 100, "100 g", "curated_estimate"),
  F("abobrinha-cozida", "Abobrinha cozida", ["abobrinha"], 20, 1.2, 3.5, 0.3, 100, "100 g", "curated_estimate"),
  F("abobora-cozida", "Abóbora cozida", ["abóbora", "abobora", "cabotiá", "cabotia"], 48, 1.4, 10.8, 0.4, 100, "100 g", "curated_estimate"),
  F("tomate", "Tomate", ["tomate"], 18, 0.9, 3.9, 0.2, 100, "100 g", "curated_estimate"),
  F("folhas-salada", "Salada de folhas", ["salada", "alface", "folhas verdes"], 18, 1.2, 3.0, 0.2, 100, "100 g", "curated_estimate"),
  F("pepino", "Pepino", ["pepino"], 15, 0.7, 3.6, 0.1, 100, "100 g", "curated_estimate"),
  F("cebola", "Cebola", ["cebola"], 40, 1.1, 9.3, 0.1, 50, "50 g", "curated_estimate"),
  F("palmito", "Palmito", ["palmito"], 29, 2.5, 5.6, 0.3, 100, "100 g", "curated_estimate"),
  F("cogumelo", "Cogumelo", ["cogumelo", "champignon"], 25, 3.0, 4.0, 0.3, 100, "100 g", "curated_estimate"),
  F("shimeji-refogado", "Shimeji refogado", ["shimeji"], 65, 3.0, 5.0, 3.5, 100, "100 g", "curated_estimate"),

  // =========================================================
  // LEGUMINOSAS / SOJA
  // =========================================================
  F("tofu", "Tofu", ["tofu"], 76, 8.0, 1.9, 4.8, 120, "120 g", "tbca_aligned"),
  F("edamame", "Edamame cozido", ["edamame"], 122, 11.9, 9.9, 5.2, 120, "120 g", "curated_estimate"),
  F("homus", "Homus", ["homus", "hommus"], 166, 7.9, 14.3, 9.6, 50, "50 g", "curated_estimate"),
  F("bebida-de-soja", "Bebida de soja", ["bebida de soja", "leite de soja"], 42, 3.0, 4.0, 1.8, 200, "200 ml", "curated_estimate"),
  F("iogurte-de-soja", "Iogurte de soja", ["iogurte de soja"], 60, 3.5, 6.0, 2.5, 170, "1 pote", "curated_estimate"),

  // =========================================================
  // FRUTAS
  // =========================================================
  F("banana-prata", "Banana prata", ["banana", "banana prata"], 98, 1.3, 26.0, 0.1, 90, "1 unidade média", "curated_estimate"),
  F("maca", "Maçã", ["maçã", "maca"], 52, 0.3, 14.0, 0.2, 130, "1 unidade", "curated_estimate"),
  F("mamao", "Mamão", ["mamão", "mamao"], 43, 0.5, 10.0, 0.3, 150, "1 porção", "curated_estimate"),
  F("laranja", "Laranja", ["laranja"], 47, 0.9, 11.8, 0.1, 130, "1 unidade", "curated_estimate"),
  F("mexerica", "Mexerica", ["mexerica", "tangerina"], 53, 0.8, 13.3, 0.3, 130, "1 unidade", "curated_estimate"),
  F("abacaxi", "Abacaxi", ["abacaxi"], 50, 0.5, 13.1, 0.1, 100, "100 g", "tbca_aligned"),
  F("manga", "Manga", ["manga"], 60, 0.8, 15.0, 0.4, 100, "100 g", "curated_estimate"),
  F("morango", "Morango", ["morango"], 32, 0.7, 7.7, 0.3, 150, "150 g", "curated_estimate"),
  F("uva", "Uva", ["uva"], 69, 0.7, 18.1, 0.2, 120, "1 cacho pequeno", "curated_estimate"),
  F("melancia", "Melancia", ["melancia"], 30, 0.6, 7.6, 0.2, 200, "200 g", "curated_estimate"),
  F("melao", "Melão", ["melão", "melao"], 34, 0.8, 8.2, 0.2, 200, "200 g", "curated_estimate"),
  F("kiwi", "Kiwi", ["kiwi"], 61, 1.1, 14.7, 0.5, 75, "1 unidade", "curated_estimate"),
  F("goiaba", "Goiaba", ["goiaba"], 54, 1.1, 13.0, 0.4, 100, "100 g", "curated_estimate"),
  F("maracuja-polpa", "Maracujá (polpa)", ["maracujá", "maracuja"], 68, 2.0, 13.4, 0.7, 100, "100 g", "curated_estimate"),
  F("acai-polpa-sem-xarope", "Açaí polpa sem xarope", ["açaí", "acai", "polpa de açaí"], 60, 1.0, 6.0, 4.0, 100, "100 g", "curated_estimate"),
  F("abacate", "Abacate", ["abacate"], 160, 2.0, 8.5, 14.7, 70, "70 g", "curated_estimate"),

  // =========================================================
  // GORDURAS / CASTANHAS / PASTAS
  // =========================================================
  F("azeite", "Azeite de oliva", ["azeite", "azeite de oliva"], 884, 0.0, 0.0, 100.0, 10, "10 g", "curated_estimate"),
  F("oleo-soja", "Óleo de soja", ["óleo", "oleo", "óleo de soja"], 884, 0.0, 0.0, 100.0, 10, "10 g", "curated_estimate"),
  F("manteiga", "Manteiga", ["manteiga"], 717, 0.9, 0.1, 81.1, 10, "10 g", "curated_estimate"),
  F("pasta-de-amendoim", "Pasta de amendoim", ["pasta de amendoim", "paçoca cremosa"], 588, 25.0, 20.0, 50.0, 15, "15 g", "curated_estimate"),
  F("amendoim", "Amendoim torrado", ["amendoim"], 567, 25.8, 16.1, 49.2, 20, "20 g", "curated_estimate"),
  F("castanha-de-caju", "Castanha-de-caju", ["castanha de caju", "castanha-de-caju"], 553, 18.2, 30.2, 43.9, 20, "20 g", "curated_estimate"),
  F("castanha-do-para", "Castanha-do-pará", ["castanha do pará", "castanha-do-para"], 659, 14.3, 11.7, 67.1, 15, "15 g", "curated_estimate"),
  F("nozes", "Nozes", ["nozes"], 654, 15.2, 13.7, 65.2, 20, "20 g", "curated_estimate"),
  F("chia", "Semente de chia", ["chia"], 486, 16.5, 42.1, 30.7, 15, "15 g", "curated_estimate"),
  F("linhaça", "Linhaça", ["linhaça", "linhaca"], 534, 18.3, 28.9, 42.2, 15, "15 g", "curated_estimate"),

  // =========================================================
  // DOCES / ULTRAPROCESSADOS / REFEIÇÃO LIVRE
  // =========================================================
  F("nutella", "Nutella", ["nutella", "creme de avelã"], 542, 6.3, 58.0, 31.0, 20, "20 g", "official_brand"),
  F("brigadeiro", "Brigadeiro", ["brigadeiro"], 325, 5.0, 52.0, 11.0, 25, "1 unidade", "curated_estimate"),
  F("beijinho", "Beijinho", ["beijinho"], 360, 4.5, 55.0, 14.0, 25, "1 unidade", "curated_estimate"),
  F("doce-de-leite", "Doce de leite", ["doce de leite"], 315, 5.5, 57.0, 7.0, 30, "30 g", "curated_estimate"),
  F("goiabada", "Goiabada", ["goiabada"], 300, 0.8, 75.0, 0.2, 30, "30 g", "curated_estimate"),
  F("chocolate-ao-leite", "Chocolate ao leite", ["chocolate ao leite", "chocolate"], 535, 7.5, 58.0, 30.0, 20, "20 g", "curated_estimate"),
  F("chocolate-meio-amargo", "Chocolate meio amargo", ["chocolate meio amargo"], 560, 7.5, 50.0, 36.0, 20, "20 g", "curated_estimate"),
  F("pizza-generica", "Pizza (sabor não informado)", ["pizza"], 250, 11.0, 30.0, 10.5, 120, "1 fatia média", "curated_estimate"),
  F("pizza-mucarela-direta", "Pizza de muçarela", ["pizza de muçarela", "pizza de mucarela", "pizza de mussarela"], 237.5, 10.0, 30.0, 8.3, 120, "1 fatia média", "curated_estimate"),
  F("pizza-calabresa-direta", "Pizza de calabresa", ["pizza de calabresa"], 258.3, 10.8, 28.3, 11.7, 120, "1 fatia média", "curated_estimate"),
  F("pizza-frango-catupiry-direta", "Pizza de frango com Catupiry", ["pizza de frango com catupiry", "pizza de frango c catupiry"], 250.0, 14.2, 25.8, 10.0, 120, "1 fatia média", "curated_estimate"),
  F("pizza-lombo-catupiry-direta", "Pizza de lombo com Catupiry", ["pizza de lombo com catupiry"], 266.7, 14.2, 25.0, 12.5, 120, "1 fatia média", "curated_estimate"),
  F("pizza-portuguesa-direta", "Pizza portuguesa", ["pizza portuguesa"], 275.0, 14.2, 26.7, 12.5, 120, "1 fatia média", "curated_estimate"),
  F("pizza-quatro-queijos-direta", "Pizza quatro queijos", ["pizza quatro queijos", "pizza de quatro queijos"], 283.3, 13.3, 25.8, 15.0, 120, "1 fatia média", "curated_estimate"),
  F("pizza-marguerita-direta", "Pizza marguerita", ["pizza marguerita", "pizza de marguerita"], 233.3, 9.2, 29.2, 8.3, 120, "1 fatia média", "curated_estimate"),
  F("pizza-napolitana-direta", "Pizza napolitana", ["pizza napolitana", "pizza de napolitana"], 237.5, 10.0, 28.3, 8.3, 120, "1 fatia média", "curated_estimate"),
  F("pizza-atum-direta", "Pizza de atum", ["pizza de atum"], 225.0, 14.2, 25.0, 7.5, 120, "1 fatia média", "curated_estimate"),
  F("pizza-bacon-direta", "Pizza de bacon", ["pizza de bacon"], 266.7, 11.7, 26.7, 11.7, 120, "1 fatia média", "curated_estimate"),
  F("pizza-milho-catupiry-direta", "Pizza de milho com Catupiry", ["pizza de milho com catupiry"], 250.0, 10.0, 29.2, 10.0, 120, "1 fatia média", "curated_estimate"),
  F("pizza-palmito-direta", "Pizza de palmito", ["pizza de palmito"], 241.7, 10.0, 27.5, 9.2, 120, "1 fatia média", "curated_estimate"),
  F("pizza-toscana-direta", "Pizza toscana", ["pizza toscana"], 262.5, 11.7, 27.5, 11.7, 120, "1 fatia média", "curated_estimate"),
  F("pizza-pepperoni-direta", "Pizza de pepperoni", ["pizza de pepperoni"], 266.7, 11.7, 25.8, 12.5, 120, "1 fatia média", "curated_estimate"),
  F("pizza-escarola-bacon-direta", "Pizza de escarola com bacon", ["pizza de escarola com bacon"], 262.5, 10.0, 24.2, 12.5, 120, "1 fatia média", "curated_estimate"),
  F("pizza-baiana-direta", "Pizza baiana", ["pizza baiana"], 266.7, 11.7, 27.5, 11.7, 120, "1 fatia média", "curated_estimate"),
  F("pizza-americana-direta", "Pizza americana", ["pizza americana"], 275.0, 12.5, 26.7, 13.3, 120, "1 fatia média", "curated_estimate"),
  F("pizza-presunto-queijo-direta", "Pizza de presunto e queijo", ["pizza de presunto e queijo"], 250.0, 13.3, 25.8, 10.0, 120, "1 fatia média", "curated_estimate"),
  F("pizza-frango-milho-direta", "Pizza de frango com milho", ["pizza de frango com milho"], 241.7, 13.3, 28.3, 8.3, 120, "1 fatia média", "curated_estimate"),
  F("pizza-frango-bacon-direta", "Pizza de frango com bacon", ["pizza de frango com bacon"], 266.7, 14.2, 25.0, 11.7, 120, "1 fatia média", "curated_estimate"),
  F("pizza-frango-cheddar-direta", "Pizza de frango com cheddar", ["pizza de frango com cheddar"], 266.7, 15.0, 25.0, 12.5, 120, "1 fatia média", "curated_estimate"),
  F("pizza-calabresa-catupiry-direta", "Pizza de calabresa com Catupiry", ["pizza de calabresa com catupiry"], 270.8, 11.7, 26.7, 12.5, 120, "1 fatia média", "curated_estimate"),
  F("pizza-lombo-cheddar-direta", "Pizza de lombo com cheddar", ["pizza de lombo com cheddar"], 275.0, 15.0, 25.8, 13.3, 120, "1 fatia média", "curated_estimate"),
  F("pizza-strogonoff-carne-direta", "Pizza de strogonoff de carne", ["pizza de strogonoff de carne"], 300.0, 15.8, 28.3, 15.0, 120, "1 fatia média", "curated_estimate"),
  F("pizza-strogonoff-frango-direta", "Pizza de strogonoff de frango", ["pizza de strogonoff de frango"], 291.7, 18.3, 28.3, 11.7, 120, "1 fatia média", "curated_estimate"),
  F("pizza-parmegiana-direta", "Pizza parmegiana", ["pizza parmegiana"], 279.2, 14.2, 28.3, 12.5, 120, "1 fatia média", "curated_estimate"),
  F("pizza-brocolis-bacon-catupiry-direta", "Pizza de brócolis com bacon e Catupiry", ["pizza de brócolis com bacon e catupiry"], 266.7, 10.8, 23.3, 14.2, 120, "1 fatia média", "curated_estimate"),
  F("pizza-alho-direta", "Pizza de alho e óleo", ["pizza de alho e óleo", "pizza de alho e oleo"], 237.5, 8.3, 29.2, 9.2, 120, "1 fatia média", "curated_estimate"),
  F("pizza-vegetariana-direta", "Pizza vegetariana", ["pizza vegetariana"], 233.3, 9.2, 29.2, 8.3, 120, "1 fatia média", "curated_estimate"),
  F("pizza-mexicana-direta", "Pizza mexicana", ["pizza mexicana"], 279.2, 13.3, 28.3, 13.3, 120, "1 fatia média", "curated_estimate"),
  F("pizza-paulista-direta", "Pizza paulista", ["pizza paulista"], 250.0, 11.7, 28.3, 9.2, 120, "1 fatia média", "curated_estimate"),
  F("pizza-moda-da-casa-direta", "Pizza moda da casa", ["pizza moda da casa"], 291.7, 14.2, 25.8, 14.2, 120, "1 fatia média", "curated_estimate"),
  F("sorvete-creme", "Sorvete de creme", ["sorvete de creme", "sorvete"], 140, 2.5, 17.0, 7.0, 60, "1 bola", "curated_estimate"),
  F("sorvete-chocolate", "Sorvete de chocolate", ["sorvete de chocolate"], 150, 3.0, 19.0, 7.0, 60, "1 bola", "curated_estimate"),
  F("acai-com-granola", "Açaí com granola", ["açaí com granola", "acai com granola"], 170, 3.0, 27.0, 6.0, 200, "200 g", "curated_estimate"),
  F("pao-de-queijo", "Pão de queijo", ["pão de queijo", "pao de queijo"], 340, 7.5, 44.0, 14.0, 60, "2 unidades pequenas", "curated_estimate"),
  F("coxinha-frango", "Coxinha de frango", ["coxinha", "coxinha de frango"], 300, 11.0, 25.0, 17.0, 100, "1 unidade", "curated_estimate"),
  F("pastel-carne", "Pastel de carne", ["pastel de carne", "pastel"], 320, 12.0, 31.0, 16.0, 100, "1 unidade", "curated_estimate"),
  F("esfiha-carne", "Esfiha de carne", ["esfiha", "esfiha de carne"], 220, 9.0, 26.0, 9.0, 80, "1 unidade", "curated_estimate"),
  F("empada-frango", "Empada de frango", ["empada", "empada de frango"], 310, 10.0, 27.0, 18.0, 100, "1 unidade", "curated_estimate"),
  F("hamburguer-artesanal", "Hambúrguer artesanal", ["hambúrguer artesanal", "hamburguer artesanal", "hamburguer"], 280, 20.0, 4.0, 20.0, 120, "120 g de carne", "curated_estimate"),
  F("cachorro-quente", "Cachorro-quente", ["cachorro-quente", "cachorro quente", "hot dog"], 320, 12.0, 33.0, 15.0, 180, "1 unidade", "curated_estimate"),
  F("lasanha-carne", "Lasanha à bolonhesa", ["lasanha", "lasanha de carne", "lasanha bolonhesa"], 170, 8.5, 16.0, 8.0, 300, "300 g", "curated_estimate"),
  F("strogonoff-frango", "Strogonoff de frango", ["strogonoff de frango", "strogonoff frango"], 170, 14.0, 6.0, 10.0, 250, "250 g", "curated_estimate"),
  F("strogonoff-carne", "Strogonoff de carne", ["strogonoff de carne", "strogonoff carne"], 190, 14.0, 6.0, 12.0, 250, "250 g", "curated_estimate"),
  F("feijoada", "Feijoada", ["feijoada"], 160, 10.0, 13.0, 8.0, 300, "300 g", "curated_estimate"),
  F("escondidinho-carne", "Escondidinho de carne", ["escondidinho", "escondidinho de carne"], 165, 8.5, 17.0, 7.0, 300, "300 g", "curated_estimate"),
  F("parmegiana-frango", "Frango à parmegiana", ["frango à parmegiana", "frango a parmegiana"], 205, 18.0, 9.0, 11.0, 250, "250 g", "curated_estimate"),
  F("parmegiana-carne", "Bife à parmegiana", ["bife à parmegiana", "bife a parmegiana"], 230, 19.0, 10.0, 13.0, 250, "250 g", "curated_estimate"),

  // =========================================================
  // COMIDA JAPONESA CONSUMIDA NO BRASIL
  // =========================================================
  F("temaki-philadelphia", "Temaki de salmão com cream cheese", ["temakis de salmão com cream cheese", "temaki de salmão com cream cheese", "temakis de salmão", "temaki de salmão", "temaki salmão", "temaki philadelphia", "temakis", "temaki"], 161, 8.69, 22.0, 4.99, 90, "1 unidade", "tbca_verified"),
  F("temaki-philadelphia-sem-shoyu", "Temaki de salmão com cream cheese sem shoyu", ["temaki sem shoyu"], 165, 8.69, 21.5, 4.99, 90, "1 unidade", "tbca_verified"),
  F("hot-roll-philadelphia", "Hot Philadelphia (Hot Roll)", ["hot philadelphia", "hot roll", "hotroll", "hot filadélfia"], 282, 9.06, 30.4, 14.5, 30, "1 peça de 30 g", "tbca_verified"),
  F("uramaki-salmao-pepino", "Uramaki de salmão com pepino e cream cheese", ["uramaki de salmão com pepino", "uramaki salmão", "uramaki salmao", "uramaki philadelphia", "uramakis", "uramaki"], 144, 6.72, 20.2, 4.67, 60, "1 unidade de 60 g", "tbca_verified"),
  // Sashimi: kcal por 100 g iguais ao USDA FoodData Central 175167 (salmão do Atlântico de
  // cativeiro, cru: 208 kcal). Fatia de 25 g é estimativa curada sem fonte oficial
  // (TBCA sem registro de sashimi em 10/2026). Também usado pelo gerador em nutrition.js.
  F("sashimi-salmao", "Sashimi de salmão", ["sashimi salmão", "sashimi salmao", "sashimi"], 208, 20.5, 0.0, 13.4, 25, "1 fatia", "curated_estimate"),
  F("nigiri-salmao", "Nigiri de salmão", ["niguiris de salmão", "nigiris de salmão", "nigiri de salmão", "niguiri de salmão", "nigiri salmão", "niguiri salmao", "niguiris", "nigiris", "nigiri", "niguiri"], 165, 8.5, 22.0, 4.0, 35, "1 peça", "curated_estimate"),
  F("hossomaki-salmao", "Hossomaki de salmão", ["hossomaki de salmão", "hossomaki salmão", "hossomaki salmao", "hosomaki"], 165, 7.0, 25.0, 3.0, 25, "1 peça", "curated_estimate"),
  F("uramaki-california", "Uramaki Califórnia", ["california", "uramaki california"], 160, 5.0, 26.0, 4.5, 30, "1 peça", "curated_estimate"),
  F("uramaki-skin", "Uramaki skin", ["skin", "uramaki skin"], 210, 7.0, 23.0, 10.0, 30, "1 peça", "curated_estimate"),
  F("uramaki-atum", "Uramaki de atum", ["uramaki atum", "uramaki de atum"], 145, 7.5, 23.0, 3.0, 30, "1 peça", "curated_estimate"),
  F("temaki-atum", "Temaki de atum", ["temaki atum", "temaki de atum"], 155, 10.0, 22.0, 3.0, 90, "1 unidade", "curated_estimate"),
  F("temaki-camarao", "Temaki de camarão", ["temaki camarão", "temaki camarao"], 160, 9.0, 24.0, 3.0, 90, "1 unidade", "curated_estimate"),
  F("temaki-kani", "Temaki de kani", ["temaki kani"], 155, 7.0, 25.0, 2.5, 90, "1 unidade", "curated_estimate"),
  F("temaki-shimeji", "Temaki de shimeji com cream cheese", ["temaki shimeji"], 175, 6.0, 24.0, 6.0, 90, "1 unidade", "curated_estimate"),
  F("guioza-caseiro", "Guioza", ["guioza", "gyoza"], 224, 10.7, 31.0, 6.7, 60, "1 unidade", "tbca_verified"),
  F("yakisoba-brasileiro", "Yakisoba brasileiro", ["yakisoba", "yakissoba"], 122, 7.48, 18.2, 2.6, 120, "120 g", "tbca_verified"),
  F("sunomono", "Sunomono", ["sunomono"], 35, 0.8, 7.0, 0.2, 100, "100 g", "curated_estimate"),
  F("missoshiru", "Missoshiru", ["missoshiru", "miso soup", "sopa missô"], 40, 3.0, 5.0, 1.0, 250, "250 ml", "curated_estimate"),
  F("tempura-camarao", "Tempurá de camarão", ["tempura", "tempurá de camarão", "tempura camarao"], 220, 12.0, 17.0, 11.0, 100, "100 g", "curated_estimate"),
  F("salada-kani", "Salada de kani", ["salada de kani", "kani salad"], 125, 5.5, 8.0, 8.0, 150, "150 g", "curated_estimate"),

  // =========================================================
  // FRITURAS / ACOMPANHAMENTOS
  // =========================================================
  F("batata-rustica", "Batata rústica", ["batata rústica", "batata rustica"], 147, 2.5, 25.0, 4.5, 150, "150 g", "curated_estimate"),
  F("arroz-temperado", "Arroz temperado", ["arroz temperado"], 145, 2.5, 28.0, 2.2, 100, "100 g", "curated_estimate"),
  F("pure-de-batata", "Purê de batata", ["purê", "pure de batata", "purê de batata"], 110, 2.2, 17.0, 3.5, 180, "180 g", "curated_estimate"),
  F("polenta-frita", "Polenta frita", ["polenta frita", "polenta"], 230, 3.0, 33.0, 10.0, 120, "120 g", "curated_estimate"),
  F("mandioca-frita", "Mandioca frita", ["mandioca frita", "aipim frito"], 300, 2.0, 45.0, 13.0, 120, "120 g", "curated_estimate"),

  // =========================================================
  // BEBIDAS
  // =========================================================
  F("cafe-sem-acucar", "Café sem açúcar", ["café", "cafe", "café preto"], 2, 0.1, 0.0, 0.0, 150, "150 ml", "curated_estimate"),
  F("cafe-com-acucar", "Café com açúcar", ["café com açúcar", "cafe com acucar"], 40, 0.1, 10.0, 0.0, 150, "150 ml", "curated_estimate"),
  F("suco-de-laranja", "Suco de laranja", ["suco de laranja", "suco laranja"], 45, 0.7, 10.4, 0.2, 250, "250 ml", "curated_estimate"),
  F("suco-de-uva", "Suco de uva", ["suco de uva", "suco uva"], 60, 0.2, 14.0, 0.1, 250, "250 ml", "curated_estimate"),
  F("refrigerante-cola", "Refrigerante de cola", ["coca-cola", "coca", "refrigerante cola", "refrigerante"], 42, 0.0, 10.6, 0.0, 350, "350 ml", "curated_estimate"),
  F("refrigerante-zero", "Refrigerante zero", ["coca zero", "refrigerante zero", "zero"], 0, 0.0, 0.0, 0.0, 350, "350 ml", "curated_estimate"),
  F("agua-de-coco", "Água de coco", ["água de coco", "agua de coco"], 19, 0.7, 3.7, 0.2, 300, "300 ml", "curated_estimate"),
  F("milk-shake-chocolate", "Milk-shake de chocolate", ["milk shake", "milk-shake", "milkshake"], 120, 4.0, 18.0, 4.0, 400, "400 ml", "curated_estimate"),
];


// =========================================================
// FAST FOOD POR MARCA — ITENS MAIS CONHECIDOS NO BRASIL
//
// A marca e o nome comercial são mantidos para reconhecimento de linguagem.
// Os macros abaixo são estimativas operacionais quando a tabela nutricional
// oficial atual da marca não está disponível diretamente neste módulo.
// =========================================================
const BRAND_FAST_FOOD = (brand, id, name, aliases, kcal, protein, carbs, fat, default_g, unit = "1 unidade", source = "official_menu_item_estimate") => {
  // Os valores recebidos aqui são da porção/unidade inteira. O catálogo base
  // trabalha com densidade por 100 g, então normalizamos para manter o motor
  // de quantidades consistente.
  const portionGrams = Number(default_g) > 0 ? Number(default_g) : 100;
  const factor = 100 / portionGrams;
  return {
    ...F(id, name, aliases, kcal * factor, protein * factor, carbs * factor, fat * factor, portionGrams, unit, source),
    brand,
    product_type: "fast_food_item"
  };
};

const BRANDED_FAST_FOOD_CATALOG = [
  // ---------------------------------------------------------
  // McDONALD'S
  // ---------------------------------------------------------
  BRAND_FAST_FOOD("McDonald's", "mcd-big-mac", "McDonald's Big Mac", ["big mac", "bigmac", "mc big mac", "big mac do mc"], 510, 26, 42, 26, 220),
  BRAND_FAST_FOOD("McDonald's", "mcd-quarterao-queijo", "McDonald's Quarterão com Queijo", ["quarterão com queijo", "quarterao com queijo", "quarterao", "quarterão", "mc quarterao"], 540, 31, 43, 29, 210),
  BRAND_FAST_FOOD("McDonald's", "mcd-cheddar-mcmelt", "McDonald's Cheddar McMelt", ["cheddar mcmelt", "cheddar mcmelt do mc", "mcmelt"], 525, 27, 45, 27, 180),
  BRAND_FAST_FOOD("McDonald's", "mcd-mcchicken", "McDonald's McChicken", ["mcchicken", "mc chicken"], 430, 17, 45, 21, 175),
  BRAND_FAST_FOOD("McDonald's", "mcd-mcchicken-bacon", "McDonald's McChicken Bacon", ["mcchicken bacon", "mc chicken bacon"], 500, 21, 45, 27, 200),
  BRAND_FAST_FOOD("McDonald's", "mcd-mcnifico-bacon", "McDonald's McNífico Bacon", ["mcnifico bacon", "mcnífico bacon", "mcnífico", "mcnifico"], 650, 38, 46, 37, 260),
  BRAND_FAST_FOOD("McDonald's", "mcd-mccrispy-deluxe", "McDonald's McCrispy Chicken Deluxe", ["mccrispy chicken deluxe", "mccrispy deluxe", "mccrispy"], 620, 31, 58, 32, 230),
  BRAND_FAST_FOOD("McDonald's", "mcd-cheeseburger", "McDonald's Cheeseburger", ["mc cheeseburger", "cheeseburger do mc", "cheeseburger mcdonalds"], 310, 16, 32, 13, 120),
  BRAND_FAST_FOOD("McDonald's", "mcd-mcnuggets-4", "McDonald's Chicken McNuggets — 4 unidades", ["chicken mcnuggets 4", "mcnuggets 4", "4 nuggets do mc", "4 mcnuggets"], 175, 10, 11, 10, 64, "4 unidades"),
  BRAND_FAST_FOOD("McDonald's", "mcd-mcnuggets-6", "McDonald's Chicken McNuggets — 6 unidades", ["chicken mcnuggets 6", "mcnuggets 6", "6 nuggets do mc", "6 mcnuggets"], 260, 14, 17, 15, 96, "6 unidades"),
  BRAND_FAST_FOOD("McDonald's", "mcd-mcnuggets-10", "McDonald's Chicken McNuggets — 10 unidades", ["chicken mcnuggets 10", "mcnuggets 10", "10 nuggets do mc", "10 mcnuggets"], 430, 24, 28, 25, 160, "10 unidades"),
  BRAND_FAST_FOOD("McDonald's", "mcd-fritas-p", "McDonald's McFritas Pequena", ["mcfritas pequena", "batata pequena do mc", "fritas pequena do mc", "batata p do mc"], 220, 3, 29, 10, 70, "1 porção"),
  BRAND_FAST_FOOD("McDonald's", "mcd-fritas-m", "McDonald's McFritas Média", ["mcfritas média", "mcfritas media", "batata média do mc", "batata media do mc", "fritas média do mc", "fritas media do mc"], 340, 4, 44, 16, 110, "1 porção"),
  BRAND_FAST_FOOD("McDonald's", "mcd-fritas-g", "McDonald's McFritas Grande", ["mcfritas grande", "batata grande do mc", "fritas grande do mc"], 430, 5, 57, 20, 150, "1 porção"),
  BRAND_FAST_FOOD("McDonald's", "mcd-sundae-chocolate", "McDonald's Sundae de Chocolate", ["sundae chocolate do mc", "sundae do mc", "sundae chocolate mc"], 290, 6, 46, 9, 170, "1 unidade"),
  BRAND_FAST_FOOD("McDonald's", "mcd-top-sundae", "McDonald's Top Sundae", ["top sundae", "top sundae do mc"], 360, 6, 57, 12, 200, "1 unidade"),

  // ---------------------------------------------------------
  // BURGER KING
  // Valores de referência para itens Whopper baseados na tabela
  // nutricional publicada pela rede; os demais permanecem estimativos.
  // ---------------------------------------------------------
  BRAND_FAST_FOOD("Burger King", "bk-whopper", "Burger King Whopper", ["whopper", "whopper do bk"], 717, 32, 47, 44, 325, "1 unidade", "official_nutrition_table"),
  BRAND_FAST_FOOD("Burger King", "bk-whopper-duplo", "Burger King Whopper Duplo", ["whopper duplo", "whopper duplo do bk"], 962, 50, 47, 62, 405, "1 unidade", "official_nutrition_table"),
  BRAND_FAST_FOOD("Burger King", "bk-whopper-furioso", "Burger King Whopper Furioso", ["whopper furioso", "furioso do bk"], 941, 38, 69, 56, 366, "1 unidade", "official_nutrition_table"),
  BRAND_FAST_FOOD("Burger King", "bk-whopper-jr", "Burger King Whopper Jr.", ["whopper jr", "whopper junior", "whopper jr do bk"], 388, 17, 29, 23, 179, "1 unidade", "official_nutrition_table"),
  BRAND_FAST_FOOD("Burger King", "bk-whopper-bbq-bacon", "Burger King Whopper Barbecue Bacon", ["whopper barbecue bacon", "whopper bbq bacon", "whopper bacon do bk"], 767, 35, 49, 47, 335, "1 unidade", "official_nutrition_table"),
  BRAND_FAST_FOOD("Burger King", "bk-whopper-rodeio", "Burger King Whopper Rodeio", ["whopper rodeio", "whopper rodeio do bk"], 901, 34, 70, 53, 352, "1 unidade", "official_nutrition_table"),
  BRAND_FAST_FOOD("Burger King", "bk-big-king", "Burger King Big King", ["big king", "big king do bk"], 530, 26, 37, 30, 190),
  BRAND_FAST_FOOD("Burger King", "bk-stacker-duplo-bacon", "Burger King Stacker Duplo Bacon", ["stacker duplo bacon", "stacker bacon", "duplo bacon do bk"], 760, 42, 40, 49, 260),
  BRAND_FAST_FOOD("Burger King", "bk-bk-chicken-crispy", "Burger King BK Chicken Crispy", ["bk chicken crispy", "chicken crispy do bk", "bk chicken"], 610, 28, 55, 31, 220),
  BRAND_FAST_FOOD("Burger King", "bk-cheeseburger", "Burger King Cheeseburger", ["cheeseburger do bk", "cheeseburger burger king"], 300, 15, 28, 15, 115),
  BRAND_FAST_FOOD("Burger King", "bk-bk-chicken-6", "Burger King BK Chicken — 6 unidades", ["bk chicken 6", "6 bk chicken", "6 franguinhos do bk"], 223, 14, 20, 10, 63, "6 unidades", "official_nutrition_table"),
  BRAND_FAST_FOOD("Burger King", "bk-bk-chicken-10", "Burger King BK Chicken — 10 unidades", ["bk chicken 10", "10 bk chicken", "10 franguinhos do bk"], 373, 17, 33, 15, 186, "10 unidades", "official_nutrition_table"),

  // ---------------------------------------------------------
  // KFC — principais itens conhecidos no Brasil
  // ---------------------------------------------------------
  BRAND_FAST_FOOD("KFC", "kfc-kentucky-chicken-sandwich", "KFC Kentucky Chicken Sandwich", ["kentucky chicken sandwich", "chicken sandwich kfc", "sanduiche de frango kfc"], 480, 26, 42, 23, 200),
  BRAND_FAST_FOOD("KFC", "kfc-gran-bbq-bacon", "KFC Gran BBQ Bacon", ["gran bbq bacon", "gran bbq bacon kfc"], 720, 35, 52, 40, 280),
  BRAND_FAST_FOOD("KFC", "kfc-cheddar-melt", "KFC Cheddar Melt", ["cheddar melt kfc", "cheddar melt"], 580, 29, 48, 31, 230),
  BRAND_FAST_FOOD("KFC", "kfc-double-crunch", "KFC Double Crunch", ["double crunch kfc", "double crunch"], 610, 31, 50, 34, 220),
  BRAND_FAST_FOOD("KFC", "kfc-double-crunch-bacon", "KFC Double Crunch Bacon", ["double crunch bacon kfc", "double crunch bacon"], 700, 35, 51, 41, 250),
  BRAND_FAST_FOOD("KFC", "kfc-crunch-salad", "KFC Crunch Salad", ["crunch salad kfc", "crunch salad"], 520, 29, 39, 27, 220),
  BRAND_FAST_FOOD("KFC", "kfc-tira-frango", "KFC Tiras de Frango", ["tira de frango kfc", "tiras de frango kfc", "tiras kfc"], 110, 8, 7, 6, 35, "1 tira"),
  BRAND_FAST_FOOD("KFC", "kfc-pedaco-frango", "KFC Pedaço de Frango Frito", ["pedaço de frango kfc", "pedaco de frango kfc", "pedaços de frango kfc", "pedacos de frango kfc", "pedaço de frango do kfc", "pedaco de frango do kfc", "pedaços de frango do kfc", "pedacos de frango do kfc", "frango do kfc", "frango frito do kfc"], 206, 12.3, 8.7, 13.6, 60, "1 pedaço (~60 g)"),
  BRAND_FAST_FOOD("KFC", "kfc-balde-6-tiras", "KFC Balde com 6 Tiras", ["balde 6 tiras kfc", "6 tiras kfc", "mini balde 6 tiras"], 660, 48, 42, 32, 210, "1 balde"),
  BRAND_FAST_FOOD("KFC", "kfc-balde-8-tiras", "KFC Balde com 8 Tiras", ["balde 8 tiras kfc", "8 tiras kfc"], 880, 64, 56, 43, 280, "1 balde"),

  // ---------------------------------------------------------
  // POPEYES
  // ---------------------------------------------------------
  BRAND_FAST_FOOD("Popeyes", "popeyes-the-sandwich", "Popeyes The Sandwich", ["the sandwich popeyes", "the sandwich do popeyes", "the sandwich", "popeyes sandwich", "sanduiche popeyes"], 620, 30, 53, 34, 220),
  BRAND_FAST_FOOD("Popeyes", "popeyes-barbecue-bacon", "Popeyes Barbecue Bacon", ["barbecue bacon popeyes", "bbq bacon popeyes"], 700, 31, 53, 40, 230),
  BRAND_FAST_FOOD("Popeyes", "popeyes-cebola-bacon", "Popeyes Cebola Bacon Frango", ["cebola bacon frango popeyes", "cebola bacon popeyes"], 710, 33, 52, 39, 235),
  BRAND_FAST_FOOD("Popeyes", "popeyes-parmegiana", "Popeyes Parmegiana", ["parmegiana popeyes"], 670, 34, 56, 33, 240),
  BRAND_FAST_FOOD("Popeyes", "popeyes-tiras-6", "Popeyes Balde de 6 Tiras", ["balde de tiras popeyes", "6 tiras popeyes", "balde popeyes tiras 6"], 700, 48, 52, 31, 230, "1 balde"),
  BRAND_FAST_FOOD("Popeyes", "popeyes-pedacos-5", "Popeyes Balde de 5 Pedaços", ["balde 5 pedaços popeyes", "balde 5 pedacos popeyes", "5 pedaços popeyes"], 900, 55, 38, 55, 310, "1 balde"),
  BRAND_FAST_FOOD("Popeyes", "popeyes-batata-cajun", "Popeyes Batata Frita Cajun", ["batata cajun popeyes", "fritas cajun popeyes"], 360, 5, 46, 17, 130, "1 porção"),

  // ---------------------------------------------------------
  // BOB'S
  // ---------------------------------------------------------
  BRAND_FAST_FOOD("Bob's", "bobs-big-bob-picanha-costela", "Bob's Big Bob Picanha e Costela", ["big bob picanha e costela", "big bob picanha", "big bob do bobs"], 930, 55, 47, 60, 420),
  BRAND_FAST_FOOD("Bob's", "bobs-double-cheese-picanha-costela", "Bob's Double Cheese Picanha e Costela", ["double cheese picanha e costela", "double cheese do bobs", "double cheese bobs"], 980, 62, 48, 63, 430),
  BRAND_FAST_FOOD("Bob's", "bobs-cheddar-australiano", "Bob's Cheddar Australiano Picanha e Costela", ["cheddar australiano picanha e costela", "cheddar australiano bobs", "cheddar australiano"], 970, 52, 55, 63, 410),
  BRAND_FAST_FOOD("Bob's", "bobs-hamburguer-cheddar", "Bob's Hambúrguer com Cheddar", ["hamburguer com cheddar do bobs", "cheddar bobs", "hamburguer bobs"], 560, 26, 38, 33, 210),
  BRAND_FAST_FOOD("Bob's", "bobs-milk-shake-chocolate", "Bob's Milk Shake de Chocolate", ["milk shake chocolate bobs", "milkshake chocolate bobs", "milk shake do bobs"], 320, 7, 52, 10, 300, "300 ml"),
  BRAND_FAST_FOOD("Bob's", "bobs-milk-shake-crocante", "Bob's Milk Shake Crocante", ["milk shake crocante bobs", "milkshake crocante bobs"], 216, 5, 30, 8, 300, "300 ml", "official_brand_menu"),
  BRAND_FAST_FOOD("Bob's", "bobs-sundae-chocolate", "Bob's Sundae de Chocolate", ["sundae chocolate bobs", "sundae do bobs"], 230, 5, 33, 8, 170),

  // ---------------------------------------------------------
  // HABIB'S
  // ---------------------------------------------------------
  BRAND_FAST_FOOD("Habib's", "habibs-bibsfihas-carne", "Habib's Bib'sfiha de Carne", ["bib'sfiha de carne", "bibsfihas de carne", "esfiha de carne habibs", "esfiha de carne do habibs", "esfiha de carne do habib's", "esfihas de carne do habibs", "esfihas de carne do habib's", "esfihas de carne habibs", "esfiha habibs"], 105, 5, 11, 4, 45, "1 unidade"),
  BRAND_FAST_FOOD("Habib's", "habibs-bibsfihas-queijo", "Habib's Bib'sfiha de Queijo", ["bib'sfiha de queijo", "bibsfihas de queijo", "esfiha de queijo habibs"], 125, 5, 11, 6, 45, "1 unidade"),
  BRAND_FAST_FOOD("Habib's", "habibs-bibsfihas-frango", "Habib's Bib'sfiha de Frango", ["bib'sfiha de frango", "bibsfihas de frango", "esfiha de frango habibs"], 115, 6, 11, 5, 45, "1 unidade"),
  BRAND_FAST_FOOD("Habib's", "habibs-beirute-super-burger", "Habib's Beirute Super Burger", ["beirute super burger", "super burger habibs", "beirute habibs burger"], 850, 42, 61, 45, 420),
  BRAND_FAST_FOOD("Habib's", "habibs-beirute-frango-crocante", "Habib's Beirute de Frango Crocante", ["beirute de frango crocante", "beirute frango habibs"], 760, 38, 63, 35, 400),
  BRAND_FAST_FOOD("Habib's", "habibs-beirute-kafta", "Habib's Beirute de Kafta", ["beirute de kafta", "beirute kafta habibs"], 810, 40, 59, 40, 400),
  BRAND_FAST_FOOD("Habib's", "habibs-genius-cheddar-bacon", "Habib's Genius Cheddar e Bacon", ["genius cheddar e bacon", "genius bacon habibs", "genius cheddar bacon"], 520, 25, 40, 29, 230),
  BRAND_FAST_FOOD("Habib's", "habibs-pastel-carne", "Habib's Pastel de Carne", ["pastel de carne habibs", "pastel habibs"], 290, 11, 27, 16, 100),
  BRAND_FAST_FOOD("Habib's", "habibs-esfiha-folhada-chocolate", "Habib's Esfiha Folhada de Chocolate", ["esfiha folhada de chocolate habibs", "esfiha folhada chocolate habibs"], 230, 3, 28, 12, 70),
  BRAND_FAST_FOOD("Habib's", "habibs-milkshake-chocolate", "Habib's Milkshake de Chocolate", ["milkshake de chocolate habibs", "milk shake chocolate habibs", "milkshake habibs"], 300, 7, 40, 11, 300, "300 ml"),

  // ---------------------------------------------------------
  // SUBWAY — itens clássicos, tratados como estimativas até a
  // integração de tabela nutricional atual da rede.
  // ---------------------------------------------------------
  BRAND_FAST_FOOD("Subway", "subway-bmt-15cm", "Subway B.M.T. Italiano — 15 cm", ["subway bmt", "bmt italiano subway", "bmt 15 cm", "subway bmt 15cm"], 430, 21, 47, 19, 240, "1 sanduíche"),
  BRAND_FAST_FOOD("Subway", "subway-frango-teriyaki-15cm", "Subway Frango Teriyaki — 15 cm", ["frango teriyaki subway", "teriyaki subway", "subway teriyaki 15cm"], 370, 25, 53, 8, 240, "1 sanduíche"),
  BRAND_FAST_FOOD("Subway", "subway-steak-queijo-15cm", "Subway Steak & Queijo — 15 cm", ["steak queijo subway", "steak & queijo subway", "steak cheese subway", "subway steak 15cm"], 420, 25, 43, 16, 240, "1 sanduíche"),
  BRAND_FAST_FOOD("Subway", "subway-frango-15cm", "Subway Frango — 15 cm", ["frango subway", "subway frango 15cm"], 360, 25, 45, 10, 230, "1 sanduíche"),
  BRAND_FAST_FOOD("Subway", "subway-italiano-15cm", "Subway Italiano — 15 cm", ["italiano subway", "subway italiano 15cm"], 450, 19, 47, 21, 230, "1 sanduíche"),
  BRAND_FAST_FOOD("Subway", "subway-cookie-chocolate-chip", "Subway Cookie Chocolate Chip", ["cookie chocolate chip subway", "cookie subway", "cookie subway chocolate"], 210, 2, 29, 10, 45, "1 unidade")
];

FOOD_CATALOG.push(...BRANDED_FAST_FOOD_CATALOG);


function makeMealTemplate(name, components, isQuick = false, category = "refeição completa") {
  const resolved = components
    .map(([id, grams]) => ({ item: FOOD_CATALOG.find((food) => food.id === id), grams }))
    .filter((entry) => entry.item && Number(entry.grams) > 0);

  const totals = resolved.reduce((acc, { item, grams }) => {
    const factor = grams / 100;
    acc.calories += item.kcal * factor;
    acc.protein_g += item.protein * factor;
    acc.carbs_g += item.carbs * factor;
    acc.fat_g += item.fat * factor;
    return acc;
  }, { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });

  return {
    name,
    foods: resolved.map(({ item }) => item.name),
    portions: resolved.map(({ grams }) => `${Math.round(grams)} g`),
    calories: Math.round(totals.calories),
    protein_g: Math.round(totals.protein_g * 10) / 10,
    carbs_g: Math.round(totals.carbs_g * 10) / 10,
    fat_g: Math.round(totals.fat_g * 10) / 10,
    is_quick: isQuick,
    category
  };
}

const commonBreakfast = [
  makeMealTemplate("Ovos, pão de forma e banana", [["ovo-inteiro", 100], ["pao-forma", 50], ["banana-prata", 90]], true),
  makeMealTemplate("Iogurte, aveia e banana", [["iogurte-natural-integral", 170], ["aveia-em-flocos", 40], ["banana-prata", 90]], true),
  makeMealTemplate("Tapioca com ovo e queijo minas", [["tapioca-pronta", 60], ["ovo-inteiro", 50], ["queijo-minas-frescal", 40]], true),
  makeMealTemplate("Cuscuz com ovos", [["cuscuz-de-milho-cozido", 150], ["ovo-inteiro", 100]], true),
  makeMealTemplate("Pão integral com cottage e fruta", [["pao-integral", 50], ["cottage", 80], ["maca", 130]], true),
  makeMealTemplate("Whey, banana e aveia", [["whey", 30], ["banana-prata", 90], ["aveia-em-flocos", 20]], true),
  makeMealTemplate("Whey com leite e banana", [["whey", 30], ["leite-integral", 200], ["banana-prata", 90]], true),
  makeMealTemplate("Pão de forma com ovos e queijo", [["pao-forma", 50], ["ovo-inteiro", 100], ["muçarela", 30]], true),
  makeMealTemplate("Pão francês com ovos", [["pao-frances", 50], ["ovo-inteiro", 100]], true),
  makeMealTemplate("Tapioca com frango e queijo", [["tapioca-pronta", 60], ["frango-desfiado", 80], ["queijo-minas-frescal", 30]], true),
  makeMealTemplate("Iogurte grego, morango e aveia", [["iogurte-grego-natural", 150], ["morango", 150], ["aveia-em-flocos", 30]], true),
  makeMealTemplate("Omelete de claras com pão integral", [["clara-de-ovo", 100], ["ovo-inteiro", 50], ["pao-integral", 50]], true)
];

const commonLunch = [
  makeMealTemplate("Frango, arroz e feijão", [["peito-de-frango-grelhado", 150], ["arroz-branco-cozido", 120], ["feijao-carioca-cozido", 100]]),
  makeMealTemplate("Patinho, arroz e feijão", [["patinho-grelhado", 150], ["arroz-branco-cozido", 120], ["feijao-carioca-cozido", 100]]),
  makeMealTemplate("Músculo, arroz e feijão", [["musculo-cozido", 150], ["arroz-branco-cozido", 120], ["feijao-carioca-cozido", 100]]),
  makeMealTemplate("Coxão mole, arroz e feijão", [["coxao-mole-grelhado", 150], ["arroz-branco-cozido", 120], ["feijao-carioca-cozido", 100]]),
  makeMealTemplate("Acém, arroz e feijão", [["acem-cozido", 150], ["arroz-branco-cozido", 120], ["feijao-preto-cozido", 100]]),
  makeMealTemplate("Frango, batata-doce e brócolis", [["peito-de-frango-grelhado", 150], ["batata-doce-cozida", 180], ["brocolis-cozido", 100]]),
  makeMealTemplate("Tilápia, arroz e legumes", [["tilapia-grelhada", 160], ["arroz-branco-cozido", 120], ["cenoura-cozida", 80], ["brocolis-cozido", 80]]),
  makeMealTemplate("Salmão, arroz e brócolis", [["salmao-grelhado", 150], ["arroz-branco-cozido", 120], ["brocolis-cozido", 100]]),
  makeMealTemplate("Lombo suíno, arroz e feijão", [["lombo-suino-assado", 150], ["arroz-branco-cozido", 120], ["feijao-carioca-cozido", 80]]),
  makeMealTemplate("Carne moída, arroz e feijão", [["carne-moida-bovina", 130], ["arroz-branco-cozido", 120], ["feijao-carioca-cozido", 80]]),
  makeMealTemplate("Patinho moído, purê e salada", [["patinho-refogado", 130], ["pure-de-batata", 180], ["folhas-salada", 100]], false),
  makeMealTemplate("Macarrão com frango e molho de tomate", [["macarrao-cozido", 180], ["frango-desfiado", 120], ["tomate", 60]]),
  makeMealTemplate("Macarrão com patinho", [["macarrao-cozido", 180], ["patinho-refogado", 120], ["tomate", 60]]),
  makeMealTemplate("Bacalhau, batata e salada", [["bacalhau-cozido", 150], ["batata-cozida", 180], ["folhas-salada", 100]]),
  makeMealTemplate("Sardinha, arroz e feijão", [["sardinha-assada", 120], ["arroz-branco-cozido", 120], ["feijao-carioca-cozido", 100]]),
  makeMealTemplate("Peito de frango, mandioca e salada", [["peito-de-frango-grelhado", 150], ["mandioca-cozida", 150], ["folhas-salada", 100]]),
  makeMealTemplate("Bife de alcatra, arroz e feijão", [["alcatra-grelhada", 150], ["arroz-branco-cozido", 120], ["feijao-carioca-cozido", 100]]),
  makeMealTemplate("Frango, cuscuz e feijão", [["peito-de-frango-grelhado", 150], ["cuscuz-de-milho-cozido", 150], ["feijao-carioca-cozido", 80]]),
  makeMealTemplate("Patinho, mandioca e legumes", [["patinho-grelhado", 150], ["mandioca-cozida", 150], ["cenoura-cozida", 100]]),
  makeMealTemplate("Lentilha, arroz e ovo", [["lentilha-cozida", 160], ["arroz-branco-cozido", 100], ["ovo-inteiro", 100]])
];

const commonSnack = [
  makeMealTemplate("Iogurte com banana", [["iogurte-natural-integral", 170], ["banana-prata", 90]], true, "preparo rápido"),
  makeMealTemplate("Iogurte grego com morango", [["iogurte-grego-natural", 150], ["morango", 150]], true, "preparo rápido"),
  makeMealTemplate("Pão integral com peito de peru", [["pao-integral", 50], ["peito-de-peru-fatiado", 60]], true, "preparo rápido"),
  makeMealTemplate("Pão integral com cottage e tomate", [["pao-integral", 50], ["cottage", 60], ["tomate", 50]], true, "preparo rápido"),
  makeMealTemplate("Whey com água", [["whey", 30]], true, "preparo rápido"),
  makeMealTemplate("Whey com leite", [["whey", 30], ["leite-integral", 200]], true, "preparo rápido"),
  makeMealTemplate("Whey com banana", [["whey", 30], ["banana-prata", 90]], true, "preparo rápido"),
  makeMealTemplate("Whey com banana e aveia", [["whey", 30], ["banana-prata", 90], ["aveia-em-flocos", 20]], true, "preparo rápido"),
  makeMealTemplate("Whey com morango", [["whey", 30], ["morango", 150]], true, "preparo rápido"),
  makeMealTemplate("Whey com morango e iogurte", [["whey", 30], ["morango", 150], ["iogurte-natural-integral", 170]], true, "preparo rápido"),
  makeMealTemplate("Whey com pasta de amendoim", [["whey", 30], ["pasta-de-amendoim", 15]], true, "preparo rápido"),
  makeMealTemplate("Whey com banana e pasta de amendoim", [["whey", 30], ["banana-prata", 90], ["pasta-de-amendoim", 15]], true, "preparo rápido"),
  makeMealTemplate("Whey com leite e aveia", [["whey", 30], ["leite-integral", 200], ["aveia-em-flocos", 20]], true, "preparo rápido"),
  makeMealTemplate("Whey com morango e aveia", [["whey", 30], ["morango", 150], ["aveia-em-flocos", 20]], true, "preparo rápido"),
  makeMealTemplate("Whey com banana, leite e aveia", [["whey", 30], ["banana-prata", 90], ["leite-integral", 200], ["aveia-em-flocos", 20]], true, "preparo rápido"),
  makeMealTemplate("Whey com banana, morango e iogurte", [["whey", 30], ["banana-prata", 90], ["morango", 100], ["iogurte-natural-integral", 170]], true, "preparo rápido"),
  makeMealTemplate("Whey com banana", [["whey", 30], ["banana-prata", 90]], true, "preparo rápido"),
  makeMealTemplate("Whey com banana e aveia", [["whey", 30], ["banana-prata", 90], ["aveia-em-flocos", 20]], true, "preparo rápido"),
  makeMealTemplate("Whey com morango", [["whey", 30], ["morango", 150]], true, "preparo rápido"),
  makeMealTemplate("Whey com morango e iogurte", [["whey", 30], ["morango", 150], ["iogurte-natural-integral", 170]], true, "preparo rápido"),
  makeMealTemplate("Whey com banana e iogurte", [["whey", 30], ["banana-prata", 90], ["iogurte-natural-integral", 170]], true, "preparo rápido"),
  makeMealTemplate("Whey com pasta de amendoim", [["whey", 30], ["pasta-de-amendoim", 15]], true, "preparo rápido"),
  makeMealTemplate("Whey com banana e pasta de amendoim", [["whey", 30], ["banana-prata", 90], ["pasta-de-amendoim", 15]], true, "preparo rápido"),
  makeMealTemplate("Whey com leite e aveia", [["whey", 30], ["leite-integral", 200], ["aveia-em-flocos", 20]], true, "preparo rápido"),
  makeMealTemplate("Whey com morango e aveia", [["whey", 30], ["morango", 150], ["aveia-em-flocos", 20]], true, "preparo rápido"),
  makeMealTemplate("Whey com banana, leite e aveia", [["whey", 30], ["banana-prata", 90], ["leite-integral", 200], ["aveia-em-flocos", 20]], true, "preparo rápido"),
  makeMealTemplate("Whey com banana, morango e iogurte", [["whey", 30], ["banana-prata", 90], ["morango", 100], ["iogurte-natural-integral", 170]], true, "preparo rápido"),
  makeMealTemplate("Ovos mexidos com pão", [["ovo-inteiro", 100], ["pao-integral", 25]], true, "preparo rápido"),
  makeMealTemplate("Tapioca com cottage", [["tapioca-pronta", 60], ["cottage", 60]], true, "preparo rápido"),
  makeMealTemplate("Pão francês com queijo minas", [["pao-frances", 50], ["queijo-minas-frescal", 40]], true, "preparo rápido"),
  makeMealTemplate("Banana com pasta de amendoim", [["banana-prata", 90], ["pasta-de-amendoim", 15]], true, "preparo rápido"),
  makeMealTemplate("Maçã com pasta de amendoim", [["maca", 130], ["pasta-de-amendoim", 15]], true, "preparo rápido"),
  makeMealTemplate("Cottage com fruta", [["cottage", 100], ["maca", 130]], true, "preparo rápido"),
  makeMealTemplate("Edamame com fruta", [["edamame", 120], ["maca", 130]], true, "preparo rápido")
];

const commonDinner = [
  makeMealTemplate("Frango, arroz e legumes", [["peito-de-frango-grelhado", 150], ["arroz-branco-cozido", 100], ["brocolis-cozido", 100]]),
  makeMealTemplate("Patinho, batata e salada", [["patinho-grelhado", 150], ["batata-cozida", 180], ["folhas-salada", 100]]),
  makeMealTemplate("Tilápia, arroz e legumes", [["tilapia-grelhada", 160], ["arroz-branco-cozido", 100], ["cenoura-cozida", 100]]),
  makeMealTemplate("Salmão, arroz e salada", [["salmao-grelhado", 150], ["arroz-branco-cozido", 100], ["folhas-salada", 100]]),
  makeMealTemplate("Músculo, purê e legumes", [["musculo-cozido", 150], ["pure-de-batata", 180], ["brocolis-cozido", 100]]),
  makeMealTemplate("Frango, mandioca e salada", [["peito-de-frango-grelhado", 150], ["mandioca-cozida", 150], ["folhas-salada", 100]]),
  makeMealTemplate("Omelete, arroz e salada", [["ovo-inteiro", 150], ["arroz-branco-cozido", 100], ["folhas-salada", 100]], true),
  makeMealTemplate("Lombo suíno, arroz e legumes", [["lombo-suino-assado", 150], ["arroz-branco-cozido", 100], ["brocolis-cozido", 100]]),
  makeMealTemplate("Carne moída, arroz e legumes", [["carne-moida-bovina", 130], ["arroz-branco-cozido", 100], ["cenoura-cozida", 100]]),
  makeMealTemplate("Frango, batata-doce e brócolis", [["peito-de-frango-grelhado", 150], ["batata-doce-cozida", 180], ["brocolis-cozido", 100]]),
  makeMealTemplate("Bacalhau com batata e salada", [["bacalhau-cozido", 150], ["batata-cozida", 180], ["folhas-salada", 100]]),
  makeMealTemplate("Macarrão com frango", [["macarrao-cozido", 180], ["frango-desfiado", 120], ["tomate", 60]])
];

const commonCeia = [
  makeMealTemplate("Iogurte natural e morango", [["iogurte-natural-integral", 170], ["morango", 150]], true, "preparo rápido"),
  makeMealTemplate("Iogurte e banana", [["iogurte-natural-integral", 170], ["banana-prata", 90]], true, "preparo rápido"),
  makeMealTemplate("Leite e banana", [["leite-integral", 200], ["banana-prata", 90]], true, "preparo rápido"),
  makeMealTemplate("Whey com água", [["whey", 30]], true, "preparo rápido"),
  makeMealTemplate("Whey com leite", [["whey", 30], ["leite-integral", 200]], true, "preparo rápido"),
  makeMealTemplate("Ovos e pão integral", [["ovo-inteiro", 100], ["pao-integral", 25]], true, "preparo rápido"),
  makeMealTemplate("Cottage com maçã", [["cottage", 100], ["maca", 130]], true, "preparo rápido"),
  makeMealTemplate("Iogurte grego com chia", [["iogurte-grego-natural", 150], ["chia", 10]], true, "preparo rápido")
];

export const EXPANDED_TEMPLATES = {
  "café da manhã": commonBreakfast,
  almoço: commonLunch,
  "lanche da tarde": commonSnack,
  jantar: commonDinner,
  ceia: commonCeia
};

const aliasMap = new Map();
for (const item of FOOD_CATALOG) {
  for (const alias of [item.name, ...(item.aliases || [])]) {
    const normalized = normalizeText(alias);
    if (normalized) aliasMap.set(normalized, item);
  }
}

export function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim();
}

// Termos genéricos que não definem preparo ou corte. Um nome mais específico na mesma
// posição vence ("batata frita", "bife acebolado"); sozinhos, pedem esclarecimento em
// vez de escolher silenciosamente uma das opções.
const GENERIC_FOOD_TERMS = [
  { term: "batata", options: ["batata-cozida", "batata-assada", "batata-frita", "batata-rustica"] },
  { term: "bife", options: ["patinho-grelhado", "alcatra-grelhada", "bife-acebolado"] }
];

let catalogEntries = null;
let catalogById = null;

// Ocorrências de alimentos do catálogo em um texto já normalizado, por palavra inteira,
// sem sobreposição (o nome mais longo vence) e em ordem de posição. Ocorrências de
// termos genéricos vêm com `generic` em vez de `item`.
function findFoodOccurrences(text) {
  if (!catalogEntries) {
    catalogEntries = [
      ...FOOD_CATALOG.map((item) => ({ key: item.id, terms: [item.name, ...(item.aliases || [])] })),
      ...GENERIC_FOOD_TERMS.map(({ term }) => ({ key: `generic:${term}`, terms: [term] }))
    ];
    catalogById = new Map(FOOD_CATALOG.map((item) => [item.id, item]));
  }
  return matchFoodTerms(text, catalogEntries, { normalized: true })
    .map((occurrence) => occurrence.key.startsWith("generic:")
      ? { ...occurrence, generic: GENERIC_FOOD_TERMS.find(({ term }) => `generic:${term}` === occurrence.key) }
      : { ...occurrence, item: catalogById.get(occurrence.key) });
}

// Trechos negados: "não comi X", "nem bebi Y" até o fim da frase ou a próxima afirmação
// ("não comi arroz, comi batata"); "sem X" cobre só o alimento logo em seguida.
function findNegatedRanges(text) {
  const ranges = [];
  const negation = /\b(?:nao|nem)\s+(?:comi|bebi|tomei|almocei|jantei|lanchei|consumi|comemos)\b/g;
  const affirmation = /[.;!?\n]|(?<!\b(?:nao|nem)\s)\b(?:comi|bebi|tomei|almocei|jantei|lanchei|consumi|mas|so|apenas|somente)\b/;
  for (const match of text.matchAll(negation)) {
    const start = match.index + match[0].length;
    const end = text.slice(start).search(affirmation);
    ranges.push([start, end >= 0 ? start + end : text.length]);
  }
  for (const match of text.matchAll(/\bsem\s+(?:o\s+|a\s+)?/g)) {
    ranges.push([match.index + match[0].length, match.index + match[0].length + 1]);
  }
  return ranges;
}

function isNegated(occurrence, ranges) {
  return ranges.some(([start, end]) => occurrence.index >= start && occurrence.index < end);
}

export function findFoodCandidates(message) {
  const seen = new Set();
  return findFoodOccurrences(normalizeText(message))
    .filter(({ item }) => item)
    .map(({ item }) => item)
    .filter((item) => !seen.has(item.id) && seen.add(item.id));
}

// Medidas caseiras genéricas (volume aproximado convertido 1:1 em gramas).
// São aproximações: a densidade e o utensílio mudam o peso real.
const HOUSEHOLD_MEASURES = [
  [/^colher(?:es)? (?:de )?sopa$|^c\.? ?(?:de )?sopa$|^cs$/, 15, "colher de sopa"],
  [/^colher(?:es)? (?:de )?sobremesa$/, 10, "colher de sobremesa"],
  [/^colher(?:es)? (?:de )?cha$/, 5, "colher de chá"],
  [/^colher(?:es)?$/, 15, "colher"],
  [/^conchas?$/, 100, "concha"],
  [/^xicaras?$/, 150, "xícara"],
  [/^copos?$/, 200, "copo"],
  [/^latas?$/, 350, "lata"],
  [/^garrafas?$/, 500, "garrafa"]
];

const UNIT_PATTERN = [
  "kg", "quilos?", "gramas?", "gr", "g",
  "ml", "mililitros?", "litros?", "l",
  "colher(?:es)?\\s+(?:de\\s+)?(?:sopa|cha|sobremesa)", "c\\.?\\s*(?:de\\s+)?sopa", "colher(?:es)?", "cs",
  "conchas?", "xicaras?", "copos?", "latas?", "garrafas?",
  "fatias?", "unidades?", "unid\\.?", "ovos?", "pecas?", "porcoes", "porcao", "pedacos?", "bolas?", "bifes?"
].join("|");

function unitToGrams(amount, unit, item) {
  const u = normalizeText(unit).replace(/\s+/g, " ");
  if (/^(?:g|gr|gramas?)$/.test(u)) return { grams: amount, measure: null };
  if (/^(?:kg|quilos?)$/.test(u)) return { grams: amount * 1000, measure: null };
  if (/^(?:ml|mililitros?)$/.test(u)) return { grams: amount, measure: null };
  if (/^(?:l|litros?)$/.test(u)) return { grams: amount * 1000, measure: null };
  for (const [pattern, grams, label] of HOUSEHOLD_MEASURES) {
    if (pattern.test(u)) return { grams: amount * grams, measure: label };
  }
  return { grams: amount * item.default_g, measure: null };
}

// Quantidade de uma menção de alimento: { grams, measure } ou null.
// measure indica medida caseira genérica (aproximação), quando usada.
function extractQuantityDetails(text, item, fromIndex = 0, { endIndex = null } = {}) {
  const normalizedText = normalizeText(text);
  const before = normalizedText.slice(Math.max(0, fromIndex - 120), fromIndex);
  const itemAliases = [item.name, ...(item.aliases || [])]
    .map(normalizeText)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  const matchedAlias = itemAliases.find((alias) => normalizedText.startsWith(alias, fromIndex)) || "";
  const afterStart = endIndex ?? fromIndex + matchedAlias.length;
  const after = normalizedText.slice(afterStart, afterStart + 120);

  const withUnitBefore = before.match(new RegExp(`(${QUANTITY_PATTERN})\\s*(${UNIT_PATTERN})(?![a-z])\\s*(?:de|do|da)?\\s*$`));
  const withUnitAfter = after.match(new RegExp(`^\\s*(${QUANTITY_PATTERN})\\s*(${UNIT_PATTERN})(?![a-z])`));
  for (const match of [withUnitBefore, withUnitAfter]) {
    const amount = match && parseQuantity(match[1]);
    if (amount) return unitToGrams(amount, match[2], item);
  }

  // Contagem direta antes/depois do alimento: "2 bananas", "meia banana", "1/2 mamão".
  const directBefore = before.match(new RegExp(`(${QUANTITY_PATTERN})\\s*$`));
  const directAfter = after.match(new RegExp(`^\\s*(${QUANTITY_PATTERN})(?![a-z0-9])`));
  for (const match of [directBefore, directAfter]) {
    const amount = match && parseQuantity(match[1]);
    if (amount) return { grams: amount * item.default_g, measure: null };
  }

  return null;
}

function extractQuantity(text, item, fromIndex = 0, { allowDefault = true, endIndex = null } = {}) {
  const details = extractQuantityDetails(text, item, fromIndex, { endIndex });
  if (details?.grams > 0) return details.grams;
  return allowDefault ? item.default_g : null;
}

// Agrupa as ocorrências por alimento. A primeira menção vale mesmo sem quantidade;
// menções seguintes só somam quando trazem quantidade explícita
// ("uma banana e depois mais duas bananas" = 3; "comi arroz, o arroz estava frio" = 1).
// Também separa alimentos negados ("não comi arroz") e termos genéricos que precisam de
// esclarecimento ("batata", "bife"); nenhum dos dois entra na contagem.
function groupOccurrencesByFood(text) {
  const groups = new Map();
  const negated = [];
  const clarifications = [];
  const negatedRanges = findNegatedRanges(text);
  for (const occurrence of findFoodOccurrences(text)) {
    if (isNegated(occurrence, negatedRanges)) {
      negated.push(occurrence.item?.name || occurrence.generic.term);
      continue;
    }
    if (occurrence.generic) {
      if (!clarifications.some(({ term }) => term === occurrence.generic.term)) {
        clarifications.push({
          term: occurrence.generic.term,
          options: occurrence.generic.options
            .map((id) => catalogById.get(id))
            .filter(Boolean)
            .map(({ id, name }) => ({ id, name }))
        });
      }
      continue;
    }
    const details = extractQuantityDetails(text, occurrence.item, occurrence.index, { endIndex: occurrence.end });
    const group = groups.get(occurrence.item.id) || { item: occurrence.item, position: occurrence.index, mentions: [] };
    group.mentions.push({
      ...occurrence,
      explicitGrams: details?.grams > 0 ? details.grams : null,
      measure: details?.measure || null
    });
    groups.set(occurrence.item.id, group);
  }
  return { groups: [...groups.values()], negated: [...new Set(negated)], clarifications };
}

export function getMissingMealQuantities(message) {
  const text = normalizeText(message);
  return groupOccurrencesByFood(text).groups
    .filter(({ mentions }) => !mentions.some((mention) => mention.explicitGrams))
    .map(({ item, position }) => ({
      id: item.id,
      name: item.name,
      aliases: item.aliases || [],
      default_g: item.default_g,
      unit: item.unit,
      position
    }));
}

export function estimateMealFromText(message, options = {}) {
  const text = normalizeText(message);
  const { groups, negated, clarifications } = groupOccurrencesByFood(text);
  if (!groups.length && !clarifications.length) return null;

  if (options.requireExplicitQuantities) {
    const missing = getMissingMealQuantities(message);
    if (missing.length) return null;
  }

  const quantityOverrides = options.quantityOverrides || {};
  const matched = [];

  for (const { item, mentions } of groups) {
    const override = Number(quantityOverrides[item.id]);
    const householdMeasures = Number.isFinite(override) && override > 0
      ? []
      : [...new Set(mentions.map((mention) => mention.measure).filter(Boolean))];
    const grams = Number.isFinite(override) && override > 0
      ? override
      : mentions.reduce((total, mention, index) =>
        total + (mention.explicitGrams ?? (index === 0 ? item.default_g : 0)), 0);
    if (!(grams > 0)) continue;

    const factor = grams / 100;
    matched.push({
      id: item.id,
      name: item.name,
      grams,
      calories: item.kcal * factor,
      protein_g: item.protein * factor,
      carbs_g: item.carbs * factor,
      fat_g: item.fat * factor,
      source: item.source,
      ...(householdMeasures.length ? { household_measures: householdMeasures, approximate_quantity: true } : {})
    });
  }

  if (!matched.length && !clarifications.length) return null;

  const totals = matched.reduce((acc, item) => {
    acc.calories += item.calories;
    acc.protein_g += item.protein_g;
    acc.carbs_g += item.carbs_g;
    acc.fat_g += item.fat_g;
    return acc;
  }, { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });

  // Medida caseira genérica é aproximação de peso: impede confiança alta.
  const allHighConfidence = matched.every((item) =>
    (item.source === "tbca_verified" || item.source === "official_brand") && !item.approximate_quantity
  );
  const confidence = allHighConfidence
    ? "high"
    : matched.length >= 2
      ? "moderate"
      : "estimate";

  return {
    description: String(message || "").trim(),
    calories: Math.round(totals.calories),
    protein_g: Math.round(totals.protein_g * 10) / 10,
    carbs_g: Math.round(totals.carbs_g * 10) / 10,
    fat_g: Math.round(totals.fat_g * 10) / 10,
    estimated: true,
    confidence,
    matched_items: matched,
    // Quem registra a refeição não deve gravar enquanto houver esclarecimento pendente.
    ...(clarifications.length ? { needs_clarification: clarifications } : {}),
    ...(negated.length ? { negated_items: negated } : {})
  };
}

// =========================================================
// REFEIÇÃO LIVRE
// =========================================================

const FREE_MEAL_OPTIONS = [
  // PIZZA — refeição livre clássica
  { key: "pizza-mucarela-2", name: "2 fatias de pizza de muçarela", category: "pizza", calories: 570, protein_g: 24, carbs_g: 72, fat_g: 20 },
  { key: "pizza-calabresa-2", name: "2 fatias de pizza de calabresa", category: "pizza", calories: 620, protein_g: 26, carbs_g: 68, fat_g: 28 },
  { key: "pizza-frango-cat-2", name: "2 fatias de pizza de frango com Catupiry", category: "pizza", calories: 600, protein_g: 34, carbs_g: 62, fat_g: 24 },
  { key: "pizza-portuguesa-2", name: "2 fatias de pizza portuguesa", category: "pizza", calories: 660, protein_g: 34, carbs_g: 64, fat_g: 30 },
  { key: "pizza-quatro-queijos-2", name: "2 fatias de pizza quatro queijos", category: "pizza", calories: 680, protein_g: 32, carbs_g: 62, fat_g: 36 },
  { key: "pizza-pepperoni-2", name: "2 fatias de pizza de pepperoni", category: "pizza", calories: 640, protein_g: 28, carbs_g: 62, fat_g: 30 },
  { key: "pizza-frango-bacon-2", name: "2 fatias de pizza de frango com bacon", category: "pizza", calories: 640, protein_g: 34, carbs_g: 60, fat_g: 28 },
  { key: "pizza-moda-casa-2", name: "2 fatias de pizza moda da casa", category: "pizza", calories: 700, protein_g: 34, carbs_g: 64, fat_g: 34 },

  // FAST FOOD / HAMBÚRGUER
  { key: "mcd-big-mac-combo", name: "Combo Big Mac (hambúrguer + batata + refrigerante)", category: "fast food", calories: 950, protein_g: 30, carbs_g: 115, fat_g: 42 },
  { key: "mcd-quarterao-combo", name: "Combo Quarterão com Queijo (hambúrguer + batata + refrigerante)", category: "fast food", calories: 1020, protein_g: 36, carbs_g: 112, fat_g: 48 },
  { key: "mcd-mcchicken-combo", name: "Combo McChicken (lanche + batata + refrigerante)", category: "fast food", calories: 900, protein_g: 28, carbs_g: 116, fat_g: 34 },
  { key: "mcd-duplo-cheeseburger-combo", name: "Combo Duplo Cheeseburger (lanche + batata + refrigerante)", category: "fast food", calories: 980, protein_g: 36, carbs_g: 112, fat_g: 44 },
  { key: "bk-whopper-combo", name: "Combo Whopper (hambúrguer + batata + refrigerante)", category: "fast food", calories: 1050, protein_g: 37, carbs_g: 116, fat_g: 50 },
  { key: "bk-whopper-queijo-combo", name: "Combo Whopper com queijo", category: "fast food", calories: 1140, protein_g: 42, carbs_g: 118, fat_g: 57 },
  { key: "bk-chicken-combo", name: "Combo de sanduíche de frango empanado", category: "fast food", calories: 960, protein_g: 31, carbs_g: 120, fat_g: 38 },
  { key: "bk-rodeo-combo", name: "Combo Rodeio", category: "fast food", calories: 900, protein_g: 27, carbs_g: 118, fat_g: 34 },
  { key: "hamburguer-artesanal-batata", name: "Hambúrguer artesanal com queijo + batata frita", category: "hamburguer", calories: 850, protein_g: 41, carbs_g: 77, fat_g: 47 },
  { key: "hamburguer-duplo-bacon-batata", name: "Hambúrguer duplo com bacon e queijo + batata", category: "hamburguer", calories: 1080, protein_g: 54, carbs_g: 78, fat_g: 63 },
  { key: "cachorro-quente-completo", name: "Cachorro-quente completo + batata", category: "lanche", calories: 760, protein_g: 25, carbs_g: 84, fat_g: 35 },

  // MASSAS / COMIDAS DE CONFORTO
  { key: "lasanha-bolonhesa-350", name: "Lasanha à bolonhesa (350 g)", category: "massa", calories: 595, protein_g: 30, carbs_g: 56, fat_g: 28 },
  { key: "lasanha-quatro-queijos-350", name: "Lasanha quatro queijos (350 g)", category: "massa", calories: 700, protein_g: 29, carbs_g: 52, fat_g: 43 },
  { key: "macarrao-quatro-queijos", name: "Macarrão ao molho quatro queijos (porção grande)", category: "massa", calories: 760, protein_g: 26, carbs_g: 86, fat_g: 34 },
  { key: "macarrao-frango-cremoso", name: "Macarrão com frango ao molho cremoso", category: "massa", calories: 720, protein_g: 38, carbs_g: 82, fat_g: 27 },
  { key: "nhoque-molho-carne", name: "Nhoque ao molho de carne (porção grande)", category: "massa", calories: 690, protein_g: 25, carbs_g: 94, fat_g: 23 },
  { key: "frango-parmegiana-completo", name: "Frango à parmegiana + arroz + batata frita", category: "comida brasileira", calories: 950, protein_g: 55, carbs_g: 78, fat_g: 43 },
  { key: "strogonoff-completo", name: "Strogonoff de frango + arroz + batata palha", category: "comida brasileira", calories: 900, protein_g: 38, carbs_g: 105, fat_g: 35 },
  { key: "feijoada-completa", name: "Feijoada + arroz + farofa", category: "comida brasileira", calories: 900, protein_g: 40, carbs_g: 88, fat_g: 42 },

  // SALGADOS / DELIVERY
  { key: "frango-frito-completo", name: "Combo de frango frito (3 pedaços + batata)", category: "delivery", calories: 1000, protein_g: 46, carbs_g: 76, fat_g: 57 },
  { key: "pastel-3-combo", name: "3 pastéis de carne", category: "salgado", calories: 960, protein_g: 36, carbs_g: 93, fat_g: 48 },
  { key: "esfiha-4", name: "4 esfihas de carne com recheio de queijo", category: "salgado", calories: 720, protein_g: 28, carbs_g: 78, fat_g: 29 },

  // JAPONÊS NO ESTILO CONSUMIDO NO BRASIL — refeição completa
  { key: "japones-combinado-20", name: "Combinado japonês (20 peças, incluindo niguiris e uramakis)", category: "comida japonesa", calories: 700, protein_g: 34, carbs_g: 88, fat_g: 24 },
  { key: "hot-roll-12", name: "12 peças de hot roll / Hot Philadelphia", category: "comida japonesa", calories: 1008, protein_g: 33, carbs_g: 110, fat_g: 52 },
  { key: "temaki-hot-roll", name: "Temaki de salmão com cream cheese + 8 hot rolls", category: "comida japonesa", calories: 820, protein_g: 35, carbs_g: 92, fat_g: 34 },
  { key: "yakisoba-500", name: "Yakisoba (500 g)", category: "comida japonesa", calories: 610, protein_g: 37, carbs_g: 91, fat_g: 13 },

  // OUTROS
  { key: "burrito-completo", name: "Burrito completo com carne, queijo e molhos", category: "mexicana", calories: 850, protein_g: 37, carbs_g: 90, fat_g: 38 },
  { key: "nachos-carne-queijo", name: "Nachos com carne, queijo e guacamole", category: "mexicana", calories: 820, protein_g: 28, carbs_g: 64, fat_g: 52 }
];

export function generateFreeMealOptions({
  dailyCalorieTarget = null,
  dailyCaloriesRemaining = null,
  currentMealBudget = null,
  preferences = [],
  dislikes = [],
  preferredCategories = [],
  limit = 5
} = {}) {
  const target = Number(dailyCalorieTarget);
  const remaining = Number(dailyCaloriesRemaining);
  const mealBudget = Number(currentMealBudget);

  const fallbackBudget = Number.isFinite(target) && target > 0
    ? Math.round(target * 0.35)
    : null;

  const budget = Number.isFinite(mealBudget) && mealBudget > 0
    ? Math.round(mealBudget)
    : Number.isFinite(remaining) && remaining > 0
      ? Math.min(Math.round(remaining), fallbackBudget || Math.round(remaining))
      : fallbackBudget;

  const rejected = (dislikes || [])
    .map(normalizeText)
    .filter(Boolean);

  const filtered = FREE_MEAL_OPTIONS.filter((option) => {
    const text = normalizeText(`${option.name} ${option.category}`);
    return !rejected.some((item) => text.includes(item));
  });

  const learnedPreferences = [...(preferences || []), ...(preferredCategories || [])]
    .map(normalizeText)
    .filter(Boolean);

  // Em uma refeição livre, a curadoria deve priorizar comidas realmente
  // prazerosas e reconhecíveis como "refeição livre", e não simplesmente
  // os itens matematicamente mais próximos do orçamento.
  const defaultCategoryOrder = [
    "pizza",
    "fast food",
    "hamburguer",
    "massa",
    "comida japonesa",
    "comida brasileira",
    "delivery",
    "mexicana",
    "lanche"
  ];

  const preferenceCategoryOrder = [];
  for (const pref of learnedPreferences) {
    const matched = [
      "pizza",
      "fast food",
      "hamburguer",
      "massa",
      "comida japonesa",
      "comida brasileira",
      "delivery",
      "mexicana",
      "lanche",
      "salgado"
    ].find((category) => pref.includes(normalizeText(category)) || normalizeText(category).includes(pref));
    if (matched && !preferenceCategoryOrder.includes(matched)) {
      preferenceCategoryOrder.push(matched);
    }
  }

  const categoryOrder = preferenceCategoryOrder.length
    ? [...preferenceCategoryOrder, ...defaultCategoryOrder.filter((c) => !preferenceCategoryOrder.includes(c))]
    : defaultCategoryOrder;

  const scored = filtered.map((option) => {
    const category = normalizeText(option.category);
    const distance = budget === null ? 0 : Math.abs(option.calories - budget);
    const fits = budget === null ? null : option.calories <= budget;
    const categoryIndex = categoryOrder.findIndex((item) => normalizeText(item) === category);
    const preferenceIndex = preferenceCategoryOrder.findIndex((item) => normalizeText(item) === category);

    return {
      ...option,
      fits_budget: fits,
      distance_to_budget: distance,
      category_rank: categoryIndex === -1 ? categoryOrder.length + 1 : categoryIndex,
      preferred_category_rank: preferenceIndex === -1 ? preferenceCategoryOrder.length + 1 : preferenceIndex
    };
  });

  // Primeiro garante variedade entre tipos de refeição. Só depois usa calorias
  // como critério secundário. Assim uma refeição livre não vira uma lista de
  // cinco opções "certinhas" de dieta só porque cabem no saldo.
  const selected = [];
  const usedCategories = new Set();

  for (const category of categoryOrder) {
    if (selected.length >= Math.max(1, Math.floor(limit))) break;

    const candidates = scored
      .filter((item) => normalizeText(item.category) === normalizeText(category))
      .sort((a, b) => {
        if (a.fits_budget !== b.fits_budget) return a.fits_budget ? -1 : 1;
        return a.distance_to_budget - b.distance_to_budget;
      });

    if (candidates.length) {
      selected.push(candidates[0]);
      usedCategories.add(normalizeText(category));
    }
  }

  // Completa a lista se alguma categoria não estiver disponível.
  const remainingOptions = scored
    .filter((item) => !selected.includes(item))
    .sort((a, b) => {
      if (a.preferred_category_rank !== b.preferred_category_rank) {
        return a.preferred_category_rank - b.preferred_category_rank;
      }
      if (a.fits_budget !== b.fits_budget) return a.fits_budget ? -1 : 1;
      return a.distance_to_budget - b.distance_to_budget;
    });

  for (const option of remainingOptions) {
    if (selected.length >= Math.max(1, Math.floor(limit))) break;
    selected.push(option);
  }

  return selected;
}

export const JAPANESE_BRAZIL_OPTIONS = [
  "temaki",
  "sashimi",
  "nigiri",
  "niguiri",
  "hossomaki",
  "uramaki",
  "hot roll",
  "hot philadelphia",
  "guioza",
  "yakisoba",
  "sunomono",
  "missoshiru",
  "tempurá",
  "salada de kani",
  "combinado japonês"
];
