# Fontes nutricionais — TBCA

Valores por 100 g copiados da Tabela Brasileira de Composição de Alimentos (TBCA/USP, https://www.tbca.net.br),
consultada em 23/10/2026. Campos usados: Energia (kcal), Proteína, Carboidrato total e Lipídios.
Arquivo gerado por `scripts/gerar-fontes-tbca.mjs` a partir de `src/nutritionCatalog.js` — não editar à mão.

Critérios de escolha: versão "s/ sal" quando existe (sal não altera energia nem macros); senão a versão "c/ sal".
Preparos "grelhada/assada s/ óleo" para grelhado e assado; "frita (c/ óleo de soja)" para frito.

| id | Nome no catálogo | Código TBCA | kcal | Proteína (g) | Carboidrato (g) | Lipídios (g) | Observação |
|---|---|---|---|---|---|---|---|
| arroz-branco-cozido | Arroz branco cozido | BRC0208A | 138 | 2.41 | 29.2 | 1.6 | polido, cozido c/ óleo, cebola e alho |
| arroz-integral-cozido | Arroz integral cozido | BRC0016A | 108 | 2.44 | 23.5 | 0.87 | cozido s/ óleo |
| arroz-japones-cozido | Arroz japonês para sushi | BRC0711A | 131 | 2.34 | 30.2 | 0.4 | shari: arroz para sushi c/ vinagre, açúcar e sal |
| feijao-carioca-cozido | Feijão carioca cozido | BRC0090T | 81 | 4.68 | 15.3 | 1.72 | 50% grão e 50% caldo, c/ óleo, cebola e alho |
| feijao-preto-cozido | Feijão preto cozido | BRC0107T | 73 | 4.41 | 14.1 | 1.72 | 50% grão e 50% caldo, c/ óleo, cebola e alho |
| lentilha-cozida | Lentilha cozida | BRC0018T | 99 | 7.3 | 19.6 | 0.46 | cozida e drenada |
| ervilha-cozida | Ervilha cozida | BRC0071T | 91 | 7.45 | 17.6 | 0.58 | grão fresco cozido |
| milho-cozido | Milho cozido | BRC0138A | 97 | 3.4 | 18.4 | 2 | milho verde no vapor |
| aveia-em-flocos | Aveia em flocos | BRC0024A | 379 | 15.6 | 64.5 | 8.6 | flocos finos |
| granola-tradicional | Granola tradicional | BRC0396A | 410 | 10.7 | 61.8 | 15.1 | artesanal, c/ óleo e mel |
| farinha-de-mandioca | Farinha de mandioca | BRC0088B | 351 | 1.23 | 89.2 | 0.29 | torrada |
| tapioca-pronta | Tapioca pronta | BRC0906B | 289 | 0.36 | 71.9 | 0 | sem manteiga e sem recheio |
| macarrao-cozido | Macarrão cozido | BRC0195A | 125 | 3.5 | 27.3 | 0.46 | s/ ovos, cozido e drenado |
| pao-frances | Pão francês | BRC0002A | 300 | 9.83 | 61.6 | 2.12 | unidade média de 50 g |
| pao-forma | Pão de forma tradicional | BRC0003A | 256 | 10.1 | 49.6 | 2.49 | média de marcas, fatia média de 25 g |
| pao-integral | Pão integral | BRC0155A | 249 | 10.5 | 48.6 | 2.55 | de forma, média de marcas, fatia média de 25 g |
| pao-de-leite | Pão de leite | BRC0147A | 284 | 8.15 | 53.9 | 4.63 | industrializado, unidade média de 40 g |
| pao-de-hamburguer | Pão de hambúrguer | BRC0158A | 283 | 9.67 | 53.3 | 4.14 | unidade média de 70 g |
| pao-sirio | Pão sírio | BRC0575A | 266 | 9.1 | 55.7 | 1.2 | dado importado pela TBCA, unidade média de 60 g |
| torrada-integral | Torrada integral | BRC0170A | 398 | 13 | 71 | 7 | — |
| biscoito-cream-cracker | Biscoito cream cracker | BRC0060A | 435 | 11.6 | 70.9 | 12.4 | — |
| biscoito-maizena | Biscoito maisena | BRC0200A | 437 | 8.07 | 75.2 | 12 | — |
| biscoito-recheado-chocolate | Biscoito recheado de chocolate | BRC0045A | 489 | 5.4 | 69.6 | 21.8 | — |
| patinho-grelhado | Patinho grelhado | BRC0045F | 211 | 36 | 0 | 7.5 | — |
| patinho-cru | Patinho cru | BRC0075F | 114 | 21.1 | 0 | 3.33 | — |
| patinho-frito | Patinho frito | BRC0633F | 265 | 33 | 0 | 14.7 | — |
| patinho-refogado | Patinho refogado | BRC0637F | 165 | 27.9 | 0.75 | 5.61 | s/ gordura, refogado c/ óleo, cebola e alho |
| musculo-cozido | Músculo bovino cozido | BRC0043F | 183 | 30.8 | 0 | 6.6 | — |
| musculo-cru | Músculo bovino cru | BRC0072F | 137 | 20.7 | 0 | 6.06 | — |
| acem-cozido | Acém bovino cozido | BRC0026F | 208 | 27.5 | 0 | 10.9 | — |
| acem-cru | Acém cru | BRC0053F | 128 | 19.8 | 0 | 5.46 | — |
| acem-frito | Acém frito | BRC0651F | 261 | 24.6 | 0 | 18 | — |
| coxao-mole-grelhado | Coxão mole grelhado | BRC0727F | 208 | 33.4 | 0 | 8.32 | carne de primeira cozida/grelhada/assada |
| coxao-mole-cozido | Coxão mole cozido | BRC0034F | 209 | 32.2 | 0 | 8.91 | — |
| coxao-mole-cru | Coxão mole cru | BRC0064F | 143 | 20.4 | 0.01 | 6.76 | — |
| coxao-mole-frito | Coxão mole frito | BRC0642F | 265 | 29.8 | 0 | 16.2 | — |
| coxao-duro-cozido | Coxão duro cozido | BRC0033F | 208 | 31.8 | 0 | 8.92 | — |
| coxao-duro-cru | Coxão duro cru | BRC0063F | 132 | 22 | 0 | 4.96 | — |
| lagarto-cozido | Lagarto cozido | BRC0039F | 212 | 32.6 | 0 | 9.11 | — |
| lagarto-cru | Lagarto cru | BRC0068F | 128 | 21.3 | 0 | 4.72 | — |
| lagarto-frito | Lagarto frito | BRC0626F | 268 | 30.2 | 0 | 16.4 | — |
| alcatra-grelhada | Alcatra grelhada | BRC0042F | 236 | 32.6 | 0 | 11.7 | — |
| alcatra-crua | Alcatra crua | BRC0055F | 134 | 23.5 | 0 | 4.47 | — |
| alcatra-frita | Alcatra frita | BRC0607F | 286 | 29.4 | 0 | 18.7 | — |
| contrafile-grelhado | Contrafilé grelhado | BRC0616F | 187 | 35.9 | 0.86 | 4.49 | — |
| contrafile-frito | Contrafilé frito | BRC0618F | 241 | 33 | 0 | 12.1 | — |
| file-mignon-grelhado | Filé-mignon grelhado | BRC0036F | 211 | 32.9 | 0 | 8.83 | — |
| file-mignon-cru | Filé-mignon cru | BRC0065F | 137 | 21.6 | 0 | 5.61 | — |
| file-mignon-frito | Filé-mignon frito | BRC0596F | 266 | 30.2 | 0 | 16.1 | — |
| maminha-grelhada | Maminha grelhada | BRC0041F | 141 | 30.7 | 0 | 2.04 | — |
| maminha-crua | Maminha crua | BRC0070F | 142 | 21.1 | 0 | 6.37 | — |
| maminha-frita | Maminha frita | BRC0817F | 205 | 28.3 | 0 | 10.2 | — |
| fraldinha-grelhada | Fraldinha grelhada | BRC0801F | 267 | 21.8 | 0 | 20 | — |
| fraldinha-crua | Fraldinha crua | BRC0067F | 216 | 17.6 | 0 | 16.1 | — |
| fraldinha-cozida | Fraldinha cozida | BRC0038F | 329 | 24 | 0 | 25.9 | — |
| fraldinha-frita | Fraldinha frita | BRC0803F | 292 | 20 | 0 | 23.5 | — |
| picanha-grelhada | Picanha grelhada | BRC0047F | 281 | 26.3 | 0 | 19.5 | — |
| picanha-sem-gordura-grelhada | Picanha sem gordura grelhada | BRC0048F | 233 | 32 | 0 | 11.7 | — |
| picanha-crua | Picanha crua | BRC0077F | 160 | 20.4 | 0 | 8.68 | — |
| cupim-assado | Cupim assado | BRC0024F | 321 | 28.2 | 0.03 | 23.1 | — |
| cupim-frito | Cupim frito | BRC0807F | 357 | 26.9 | 0 | 27.7 | — |
| costela-bovina-assada | Costela bovina assada | BRC0032F | 362 | 28.6 | 0 | 27.5 | — |
| costela-bovina-crua | Costela bovina crua | BRC0062F | 346 | 16.7 | 0 | 31.8 | — |
| carne-moida-bovina | Carne moída bovina cozida | BRC0025F | 205 | 26.7 | 0 | 10.9 | — |
| carne-moida-crua | Carne moída bovina crua | BRC0054F | 129 | 19.7 | 0 | 5.56 | — |
| carne-seca-cozida | Carne-seca cozida | BRC0084F | 259 | 37.4 | 0 | 12.2 | — |
| carne-seca-frita | Carne-seca frita | BRC0660F | 305 | 33.5 | 0 | 19 | — |
| figado-bovino-grelhado | Fígado bovino grelhado | BRC0035F | 217 | 29.9 | 4.2 | 9.01 | — |
| figado-bovino-frito | Fígado bovino frito | BRC0752F | 272 | 27.5 | 3.86 | 16.3 | — |
| peito-de-frango-grelhado | Peito de frango grelhado | BRC0114F | 150 | 32.1 | 0 | 2.45 | — |
| peito-de-frango-cozido | Peito de frango cozido | BRC0194F | 154 | 31.3 | 0 | 3.16 | — |
| peito-de-frango-assado | Peito de frango assado | BRC0113F | 153 | 31.1 | 0 | 3.16 | — |
| peito-de-frango-frito | Peito de frango frito | BRC0236F | 214 | 28.5 | 0 | 11.1 | — |
| peito-de-frango-cru | Peito de frango cru | BRC0133F | 105 | 21.1 | 0 | 2.29 | — |
| coxa-de-frango-cozida | Coxa de frango cozida | BRC0109F | 160 | 26.8 | 0 | 5.85 | — |
| frango-desfiado | Frango desfiado | BRC0194F | 154 | 31.3 | 0 | 3.16 | equivalente: peito de frango s/ pele cozido |
| coxa-de-frango-assada | Coxa de frango assada | BRC0108F | 207 | 28.5 | 0.06 | 10.4 | c/ pele, assada s/ óleo |
| sobrecoxa-de-frango-assada | Sobrecoxa de frango assada | BRC0116F | 232 | 29.2 | 1.7 | 12 | — |
| asa-de-frango-assada | Asa de frango assada | BRC0741F | 267 | 23.2 | 0 | 19.3 | c/ pele, assada s/ óleo |
| peru-assado | Peito de peru assado | BRC0197F | 158 | 26.2 | 0.57 | 5.68 | peru congelado assado s/ óleo |
| lombo-suino-assado | Lombo suíno assado | BRC0163F | 200 | 35.7 | 0 | 6.4 | assado s/ óleo |
| pernil-suino-assado | Pernil suíno assado | BRC0167F | 257 | 33.1 | 0 | 13.9 | assado s/ óleo |
| bisteca-suina-grelhada | Bisteca suína grelhada | BRC0160F | 275 | 28.9 | 0.64 | 17.4 | grelhada s/ óleo |
| bacon-frito | Bacon frito | BRC0941F | 655 | 26 | 1.06 | 61.2 | toucinho defumado frito c/ alho e alecrim (único bacon frito na TBCA) |
| calabresa-grelhada | Linguiça calabresa grelhada | BRC0899F | 280 | 14.9 | 3.33 | 21.9 | assada no forno s/ óleo |
| presunto-cozido | Presunto cozido | BRC0199F | 121 | 15.1 | 2.32 | 5.7 | média de amostras |
| peito-de-peru-fatiado | Peito de peru fatiado | BRC0196F | 124 | 19.6 | 2.93 | 3.8 | defumado |
| mortadela | Mortadela | BRC0193F | 269 | 13.7 | 16.1 | 16.6 | — |
| salame | Salame | BRC0208F | 401 | 26 | 2.45 | 31.9 | média de tipos |
| salmao-grelhado | Salmão grelhado | BRC0067E | 234 | 26 | 0 | 14.4 | s/ pele, grelhado s/ óleo |
| salmao-cru | Salmão cru | BRC0065E | 165 | 19.4 | 0 | 9.7 | s/ pele |
| tilapia-grelhada | Tilápia grelhada | BRC0486E | 90 | 18.5 | 0 | 1.73 | — |
| tilapia-cozida | Tilápia cozida | BRC0098E | 108 | 22.2 | 0 | 2.07 | — |
| tilapia-crua | Tilápia crua | BRC0031E | 93 | 18.1 | 0 | 2.3 | — |
| atum-fresco-grelhado | Atum fresco grelhado | BRC0129E | 149 | 34.7 | 0 | 1.18 | assado/grelhado s/ óleo |
| atum-enlatado-oleo | Atum em óleo | BRC0040E | 171 | 26.3 | 1.58 | 6.63 | conserva em óleo, média de marcas, sólido e ralado |
| sardinha-assada | Sardinha assada | BRC0068E | 176 | 27 | 10.3 | 2.99 | — |
| bacalhau-cozido | Bacalhau cozido | BRC0365E | 84 | 20.4 | 0 | 0.25 | dessalgado e cozido |
| merluza-grelhada | Merluza grelhada | BRC0062E | 117 | 26.6 | 0.51 | 0.92 | filé assado s/ óleo |
| pescada-grelhada | Pescada grelhada | BRC0153E | 136 | 20.8 | 0.05 | 5.84 | branca, assada/grelhada s/ óleo |
| camarao-cozido | Camarão cozido | BRC0001E | 82 | 17.7 | 0.01 | 1.28 | s/ casca, cozido e drenado |
| polvo-cozido | Polvo cozido | BRC0226E | 156 | 29.8 | 4.4 | 2.08 | cozido e drenado; dado importado pela TBCA |
| ovo-inteiro | Ovo cozido | BRC0010J | 125 | 10.4 | 1.38 | 8.7 | unidade média de 50 g |
| ovo-frito | Ovo frito | BRC0015J | 235 | 15.6 | 1.19 | 18.6 | unidade média de 50 g |
| ovo-mexido | Ovo mexido | BRC0065J | 146 | 12.2 | 2.3 | 9.77 | — |
| clara-de-ovo | Clara de ovo | BRC0004J | 57 | 13.4 | 0.57 | 0.09 | cozida |
| queijo-minas-frescal | Queijo minas frescal | BRC0052G | 243 | 15.9 | 3.02 | 18.6 | — |
| muçarela | Queijo muçarela | BRC0059G | 320 | 23.8 | 1.97 | 24.1 | — |
| parmesao | Queijo parmesão | BRC0061G | 468 | 32.1 | 4.83 | 36.7 | ralado |
| queijo-prato | Queijo prato | BRC0064G | 346 | 24.2 | 0.2 | 27.6 | — |
| queijo-coalho | Queijo coalho grelhado | BRC0139G | 311 | 21.4 | 3.35 | 23.5 | espeto grelhado s/ óleo, espeto médio de 80 g |
| cottage | Queijo cottage | BRC0158G | 116 | 9.7 | 3.2 | 7.1 | dado importado pela TBCA |
| cream-cheese | Cream cheese | BRC0009G | 235 | 6 | 2.24 | 22.5 | tradicional |
| iogurte-natural-integral | Iogurte natural integral | BRC0020G | 57 | 4.02 | 4.76 | 2.43 | média de amostras, unidade média de 100 g |
| iogurte-grego-natural | Iogurte grego natural | BRC0133G | 97 | 9 | 3.98 | 5 | integral; dado importado pela TBCA, unidade média de 100 g |
| leite-integral | Leite integral | BRC0043G | 62 | 3.19 | 4.8 | 3.39 | pasteurizado |
| leite-desnatado | Leite desnatado | BRC0036G | 37 | 3.12 | 5.14 | 0.4 | — |
| creme-de-leite | Creme de leite | BRC0010G | 238 | 1.95 | 4.16 | 23.7 | 25% de gordura, UHT |
| leite-condensado | Leite condensado | BRC0030G | 319 | 7.67 | 57 | 6.74 | — |
| batata-cozida | Batata inglesa cozida | BRC0041B | 52 | 1.33 | 12.3 | 0.05 | — |
| batata-assada | Batata assada | BRC0140B | 89 | 2.51 | 20.3 | 0.05 | — |
| batata-frita | Batata frita | BRC0048B | 248 | 4.06 | 32.9 | 11.9 | — |
| batata-doce-cozida | Batata-doce cozida | BRC0042B | 92 | 0.85 | 23.1 | 0.18 | — |
| mandioca-cozida | Mandioca cozida | BRC0053B | 120 | 0.64 | 29.8 | 0.24 | — |
| mandioquinha-cozida | Mandioquinha cozida | BRC0054B | 77 | 0.85 | 18.9 | 0.17 | batata-baroa |
| inhame-cozido | Inhame cozido | BRC0342B | 89 | 2.3 | 20.5 | 0.14 | — |
| cenoura-cozida | Cenoura cozida | BRC0047B | 17 | 0.54 | 4.31 | 0.2 | — |
| brocolis-cozido | Brócolis cozido | BRC0045B | 27 | 2.71 | 4.44 | 0.54 | — |
| couve-flor-cozida | Couve-flor cozida | BRC0052B | 17 | 1.28 | 3.41 | 0.2 | — |
| abobrinha-cozida | Abobrinha cozida | BRC0040B | 14 | 0.99 | 2.82 | 0.23 | italiana |
| abobora-cozida | Abóbora cozida | BRC0059B | 50 | 1.44 | 10.8 | 0.73 | cabotiá |
| tomate | Tomate | BRC0035B | 18 | 1.04 | 3.82 | 0.17 | — |
| folhas-salada | Salada de folhas | BRC0060B | 10 | 1.35 | 1.7 | 0.16 | alface crespa como referência |
| pepino | Pepino | BRC0030B | 10 | 0.7 | 2.24 | 0.09 | c/ casca |
| cebola | Cebola | BRC0018B | 41 | 1.76 | 9.21 | 0.13 | — |
| palmito | Palmito | BRC0078B | 25 | 2.44 | 4.69 | 0.34 | em conserva, drenado |
| cogumelo | Cogumelo | BRC0698B | 27 | 1.88 | 4.81 | 0.4 | champignon cru |
| tofu | Tofu | BRC0056T | 69 | 6.55 | 2.13 | 3.95 | — |
| edamame | Edamame cozido | BRC0994B | 120 | 11.9 | 8.91 | 5.2 | cozido |
| bebida-de-soja | Bebida de soja | BRC0043T | 42 | 2.73 | 4.25 | 1.61 | extrato de soja, natural |
| iogurte-de-soja | Iogurte de soja | BRC0182T | 49 | 2.82 | 8.23 | 0.59 | extrato de soja tipo iogurte, c/ açúcar |
| banana-prata | Banana prata | BRC0011C | 107 | 1.11 | 25.9 | 0.28 | — |
| maca | Maçã | BRC0063C | 65 | 0.23 | 16.6 | 0.25 | argentina, c/ casca, unidade média de 130 g |
| mamao | Mamão | BRC0045C | 47 | 0.82 | 11.6 | 0.12 | formosa, fatia média de 170 g |
| laranja | Laranja | BRC0020C | 37 | 0.87 | 8.63 | 0.21 | pera, unidade média de 140 g |
| mexerica | Mexerica | BRC0032C | 40 | 0.85 | 9.54 | 0.07 | tangerina ponkã, unidade média de 135 g |
| abacaxi | Abacaxi | BRC0002C | 50 | 0.68 | 11.6 | 0.33 | — |
| manga | Manga | BRC0046C | 67 | 0.41 | 16.7 | 0.26 | haden |
| morango | Morango | BRC0029C | 30 | 0.82 | 6.54 | 0.4 | — |
| uva | Uva | BRC0035C | 50 | 0.54 | 12.1 | 0.17 | rubi |
| melancia | Melancia | BRC0027C | 29 | 0.7 | 6.53 | 0.06 | — |
| melao | Melão | BRC0028C | 24 | 0.61 | 5.7 | 0.15 | — |
| kiwi | Kiwi | BRC0061C | 59 | 1.25 | 12.7 | 1 | unidade média de 90 g |
| goiaba | Goiaba | BRC0016C | 50 | 0.92 | 13.3 | 0.54 | vermelha, c/ casca |
| maracuja-polpa | Maracujá (polpa) | BRC0026C | 74 | 1.99 | 12.3 | 2.1 | amarelo |
| acai-polpa-sem-xarope | Açaí polpa sem xarope | BRC0003C | 68 | 0.9 | 7.66 | 5.01 | polpa, média de amostras |
| abacate | Abacate | BRC0001C | 76 | 1.15 | 5.84 | 6.21 | variedades brasileiras; o Hass importado tem mais gordura |
| azeite | Azeite de oliva | BRC0002D | 900 | 0 | 0 | 100 | oliva |
| oleo-soja | Óleo de soja | BRC0030D | 900 | 0 | 0 | 100 | — |
| manteiga | Manteiga | BRC0004D | 673 | 0.39 | 0.52 | 74.4 | média de amostras c/ e s/ sal |
| pasta-de-amendoim | Pasta de amendoim | BRC0290T | 615 | 26.5 | 21.6 | 48.4 | integral |
| amendoim | Amendoim torrado | BRC0021T | 626 | 27.5 | 16.9 | 51.8 | torrado, c/ sal |
| castanha-de-caju | Castanha-de-caju | BRC0002U | 617 | 20.7 | 24 | 49.6 | torrada, c/ sal |
| castanha-do-para | Castanha-do-pará | BRC0003U | 674 | 14.5 | 15.1 | 63.5 | castanha-do-brasil crua |
| nozes | Nozes | BRC0009U | 649 | 14 | 18.4 | 59.4 | crua |
| chia | Semente de chia | BRC0402A | 443 | 16.5 | 42.1 | 30.7 | semente seca; dado importado pela TBCA |
| linhaça | Linhaça | BRC0006U | 453 | 14.1 | 43.3 | 32.3 | semente |
| brigadeiro | Brigadeiro | BRC0190K | 387 | 6.31 | 57.8 | 14.6 | artesanal, c/ chocolate ao leite (única versão na TBCA), unidade média de 25 g |
| beijinho | Beijinho | BRC0191K | 350 | 5.45 | 46.5 | 16.1 | caseiro, unidade média de 25 g |
| goiabada | Goiabada | BRC0097C | 309 | 0.42 | 78.7 | 0.1 | cascão |
| chocolate-ao-leite | Chocolate ao leite | BRC0046K | 535 | 7.22 | 59.6 | 30.3 | média de marcas |
| chocolate-meio-amargo | Chocolate meio amargo | BRC0054K | 548 | 4.86 | 62.4 | 29.9 | — |
| pizza-mucarela-direta | Pizza de muçarela | BRC0225A | 286 | 14.1 | 28.9 | 13.1 | artesanal, assada, fatia média de 90 g |
| pizza-calabresa-direta | Pizza de calabresa | BRC0425A | 297 | 12.2 | 33 | 13.2 | caseira, fatia média de 90 g |
| pizza-frango-catupiry-direta | Pizza de frango com Catupiry | BRC0678A | 289 | 13 | 38.6 | 9.52 | frango com requeijão, caseira, fatia média de 90 g |
| pizza-portuguesa-direta | Pizza portuguesa | BRC0427A | 249 | 9.82 | 29.5 | 10.7 | assada, fatia média de 90 g |
| pizza-quatro-queijos-direta | Pizza quatro queijos | BRC0682A | 307 | 11.9 | 37.6 | 12.5 | caseira, fatia média de 90 g |
| pizza-marguerita-direta | Pizza marguerita | BRC0685A | 251 | 10.5 | 31.4 | 9.65 | artesanal, fatia média de 90 g |
| pizza-napolitana-direta | Pizza napolitana | BRC0688A | 301 | 11.8 | 38.7 | 11.3 | caseira, fatia média de 90 g |
| pizza-atum-direta | Pizza de atum | BRC0677A | 255 | 14.3 | 28.1 | 9.75 | artesanal, c/ muçarela, fatia média de 90 g |
| pizza-palmito-direta | Pizza de palmito | BRC0875A | 234 | 8.55 | 33.4 | 7.8 | palmito e requeijão, fatia média de 90 g |
| pizza-pepperoni-direta | Pizza de pepperoni | BRC0686A | 334 | 12.2 | 38.6 | 14.9 | caseira, fatia média de 90 g |
| pizza-presunto-queijo-direta | Pizza de presunto e queijo | BRC0426A | 250 | 12.2 | 32.6 | 8.17 | presunto, caseira, fatia média de 90 g |
| pizza-vegetariana-direta | Pizza vegetariana | BRC0687A | 234 | 6.34 | 39.7 | 5.97 | caseira, fatia média de 90 g |
| sorvete-creme | Sorvete de creme | BRC0141K | 210 | 3.5 | 26.6 | 10.1 | industrializado, sabor não especificado; dado importado pela TBCA |
| coxinha-frango | Coxinha de frango | BRC0100F | 273 | 9.61 | 34.5 | 11.8 | industrializada, frita, unidade média de 50 g |
| pastel-carne | Pastel de carne | BRC0166A | 383 | 17.1 | 22.6 | 25.1 | frito, artesanal, unidade média de 100 g |
| esfiha-carne | Esfiha de carne | BRC0422A | 276 | 16 | 39.7 | 6.25 | esfirra de carne caseira, assada, unidade média de 70 g |
| empada-frango | Empada de frango | BRC0443A | 354 | 6.94 | 47.5 | 15.6 | assada, unidade média de 50 g |
| cachorro-quente | Cachorro-quente | BRC0240A | 225 | 6.87 | 13.3 | 16.4 | pão de leite, salsicha, ketchup, mostarda e maionese, porção média de 170 g |
| lasanha-carne | Lasanha à bolonhesa | BRC0395A | 178 | 11.3 | 15.2 | 8.23 | bolonhesa, artesanal, assada |
| strogonoff-frango | Strogonoff de frango | BRC0225F | 152 | 17.6 | 2.59 | 7.96 | — |
| strogonoff-carne | Strogonoff de carne | BRC0224F | 169 | 15 | 2.98 | 10.8 | — |
| feijoada | Feijoada | BRC0064T | 131 | 9.59 | 11.8 | 6.23 | — |
| escondidinho-carne | Escondidinho de carne | BRC0765B | 177 | 7.99 | 16.3 | 9.14 | carne bovina |
| parmegiana-frango | Frango à parmegiana | BRC0494F | 292 | 20.6 | 12.5 | 12.9 | filé de frango à parmegiana |
| parmegiana-carne | Bife à parmegiana | BRC0312F | 342 | 17.2 | 10 | 20.3 | bife à parmegiana |
| temaki-philadelphia | Temaki de salmão com cream cheese | BRC1206A | 162 | 8.69 | 22 | 4.99 | temaki c/ shoyu e wasabi |
| temaki-philadelphia-sem-shoyu | Temaki de salmão com cream cheese sem shoyu | BRC1173A | 165 | 8.73 | 21.5 | 5.42 | temaki s/ shoyu e s/ wasabi |
| hot-roll-philadelphia | Hot Philadelphia (Hot Roll) | BRC0304E | 282 | 9.06 | 30.4 | 14.5 | s/ shoyu e s/ tare |
| uramaki-salmao-pepino | Uramaki de salmão com pepino e cream cheese | BRC0985A | 144 | 6.72 | 20.2 | 4.67 | peça média de 60 g |
| sashimi-salmao | Sashimi de salmão | BRC0065E | 165 | 19.4 | 0 | 9.7 | salmão cru s/ pele; fatia de 25 g é estimativa |
| hossomaki-salmao | Hossomaki de salmão | BRC0305E | 167 | 9.06 | 21.8 | 5.43 | salmão grelhado e cream cheese, peça média de 30 g |
| uramaki-california | Uramaki Califórnia | BRC0306E | 140 | 7.57 | 23.8 | 2.77 | sushi California |
| guioza-caseiro | Guioza | BRC0876A | 224 | 10.7 | 31 | 6.7 | caseiro |
| yakisoba-brasileiro | Yakisoba brasileiro | BRC0204A | 124 | 7.52 | 18.3 | 2.61 | s/ sal |
| tempura-camarao | Tempurá de camarão | BRC0340E | 189 | 13.2 | 7.68 | 11.7 | unidade média de 70 g |
| harumaki | Harumaki (rolinho primavera) | BRC0627A | 297 | 11 | 21.6 | 18.6 | rolinho primavera frito, unidade média de 60 g |
| harumaki-camarao | Harumaki de camarão | BRC0738A | 302 | 11.1 | 16.4 | 21.5 | frito, unidade média de 60 g |
| hossomaki-pepino | Hossomaki de pepino (kappa maki) | BRC0867A | 122 | 5.28 | 25 | 1.19 | sushi c/ pepino, peça média de 30 g |
| shoyu | Molho shoyu | BRC0189T | 59 | 3.47 | 11.7 | 0.24 | média de tipos, colher de sopa de 15 ml |
| molho-teriyaki | Molho teriyaki | BRC0016L | 92 | 0.79 | 21.4 | 0.4 | colher de sopa de 15 g |
| pure-de-batata | Purê de batata | BRC1037B | 100 | 3.7 | 10.4 | 5.12 | — |
| mandioca-frita | Mandioca frita | BRC0091B | 304 | 1.38 | 50.3 | 11.2 | — |
| acucar-refinado | Açúcar refinado | BRC0007K | 397 | 0.16 | 99 | 0 | — |
| acucar-cristal | Açúcar cristal | BRC0005K | 400 | 0.32 | 99.6 | 0 | — |
| acucar-mascavo | Açúcar mascavo | BRC0006K | 382 | 0.76 | 94.5 | 0.09 | — |
| mel | Mel de abelha | BRC0028K | 324 | 0.17 | 80.9 | 0 | — |
| suco-de-laranja | Suco de laranja | BRC0042C | 36 | 0.98 | 8.08 | 0.09 | natural, laranja-pera, sem diluição |
| suco-de-uva | Suco de uva | BRC0226C | 61 | 0.37 | 14.8 | 0.13 | integral; dado importado pela TBCA |
| refrigerante-cola | Refrigerante de cola | BRC0030H | 35 | 0 | 8.66 | 0 | regular, c/ açúcar |
| refrigerante-zero | Refrigerante zero | BRC0047N | 0 | 0 | 0.11 | 0 | c/ adoçante, média de sabores |
| agua-de-coco | Água de coco | BRC0174C | 21 | 0 | 5.29 | 0 | industrializada |
| milk-shake-chocolate | Milk-shake de chocolate | BRC0144H | 113 | 2.84 | 21.8 | 5.86 | baunilha c/ calda de chocolate; os macros publicados somam ~151 kcal, mantido o valor de energia publicado |

Total: 224 itens.
