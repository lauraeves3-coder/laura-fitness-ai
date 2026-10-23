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
| feijao-carioca-cozido | Feijão carioca cozido | BRC0090T | 81 | 4.68 | 15.3 | 1.72 | 50% grão e 50% caldo, c/ óleo, cebola e alho |
| feijao-preto-cozido | Feijão preto cozido | BRC0107T | 73 | 4.41 | 14.1 | 1.72 | 50% grão e 50% caldo, c/ óleo, cebola e alho |
| lentilha-cozida | Lentilha cozida | BRC0018T | 99 | 7.3 | 19.6 | 0.46 | cozida e drenada |
| ervilha-cozida | Ervilha cozida | BRC0071T | 91 | 7.45 | 17.6 | 0.58 | grão fresco cozido |
| milho-cozido | Milho cozido | BRC0138A | 97 | 3.4 | 18.4 | 2 | milho verde no vapor |
| pao-frances | Pão francês | BRC0002A | 300 | 9.83 | 61.6 | 2.12 | — |
| pao-forma | Pão de forma tradicional | BRC0003A | 256 | 10.1 | 49.6 | 2.49 | média de marcas |
| pao-integral | Pão integral | BRC0155A | 249 | 10.5 | 48.6 | 2.55 | de forma, média de marcas |
| pao-de-leite | Pão de leite | BRC0147A | 284 | 8.15 | 53.9 | 4.63 | industrializado |
| pao-de-hamburguer | Pão de hambúrguer | BRC0158A | 283 | 9.67 | 53.3 | 4.14 | — |
| pao-sirio | Pão sírio | BRC0575A | 266 | 9.1 | 55.7 | 1.2 | dado importado pela TBCA |
| torrada-integral | Torrada integral | BRC0170A | 398 | 13 | 71 | 7 | — |
| patinho-grelhado | Patinho grelhado | BRC0045F | 211 | 36 | 0 | 7.5 | — |
| patinho-cru | Patinho cru | BRC0075F | 114 | 21.1 | 0 | 3.33 | — |
| patinho-frito | Patinho frito | BRC0633F | 265 | 33 | 0 | 14.7 | — |
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
| sobrecoxa-de-frango-assada | Sobrecoxa de frango assada | BRC0116F | 232 | 29.2 | 1.7 | 12 | — |
| tilapia-grelhada | Tilápia grelhada | BRC0486E | 90 | 18.5 | 0 | 1.73 | — |
| tilapia-cozida | Tilápia cozida | BRC0098E | 108 | 22.2 | 0 | 2.07 | — |
| tilapia-crua | Tilápia crua | BRC0031E | 93 | 18.1 | 0 | 2.3 | — |
| ovo-inteiro | Ovo cozido | BRC0010J | 125 | 10.4 | 1.38 | 8.7 | — |
| ovo-frito | Ovo frito | BRC0015J | 235 | 15.6 | 1.19 | 18.6 | — |
| ovo-mexido | Ovo mexido | BRC0065J | 146 | 12.2 | 2.3 | 9.77 | — |
| queijo-minas-frescal | Queijo minas frescal | BRC0052G | 243 | 15.9 | 3.02 | 18.6 | — |
| muçarela | Queijo muçarela | BRC0059G | 320 | 23.8 | 1.97 | 24.1 | — |
| parmesao | Queijo parmesão | BRC0061G | 468 | 32.1 | 4.83 | 36.7 | ralado |
| queijo-prato | Queijo prato | BRC0064G | 346 | 24.2 | 0.2 | 27.6 | — |
| cottage | Queijo cottage | BRC0158G | 116 | 9.7 | 3.2 | 7.1 | dado importado pela TBCA |
| cream-cheese | Cream cheese | BRC0009G | 235 | 6 | 2.24 | 22.5 | tradicional |
| iogurte-natural-integral | Iogurte natural integral | BRC0020G | 57 | 4.02 | 4.76 | 2.43 | média de amostras |
| iogurte-grego-natural | Iogurte grego natural | BRC0133G | 97 | 9 | 3.98 | 5 | integral; dado importado pela TBCA |
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
| banana-prata | Banana prata | BRC0011C | 107 | 1.11 | 25.9 | 0.28 | — |
| maca | Maçã | BRC0063C | 65 | 0.23 | 16.6 | 0.25 | argentina, c/ casca |
| mamao | Mamão | BRC0045C | 47 | 0.82 | 11.6 | 0.12 | formosa |
| laranja | Laranja | BRC0020C | 37 | 0.87 | 8.63 | 0.21 | pera |
| mexerica | Mexerica | BRC0032C | 40 | 0.85 | 9.54 | 0.07 | tangerina ponkã |
| abacaxi | Abacaxi | BRC0002C | 50 | 0.68 | 11.6 | 0.33 | — |
| manga | Manga | BRC0046C | 67 | 0.41 | 16.7 | 0.26 | haden |
| morango | Morango | BRC0029C | 30 | 0.82 | 6.54 | 0.4 | — |
| uva | Uva | BRC0035C | 50 | 0.54 | 12.1 | 0.17 | rubi |
| melancia | Melancia | BRC0027C | 29 | 0.7 | 6.53 | 0.06 | — |
| melao | Melão | BRC0028C | 24 | 0.61 | 5.7 | 0.15 | — |
| kiwi | Kiwi | BRC0061C | 59 | 1.25 | 12.7 | 1 | — |
| goiaba | Goiaba | BRC0016C | 50 | 0.92 | 13.3 | 0.54 | vermelha, c/ casca |
| maracuja-polpa | Maracujá (polpa) | BRC0026C | 74 | 1.99 | 12.3 | 2.1 | amarelo |
| acai-polpa-sem-xarope | Açaí polpa sem xarope | BRC0003C | 68 | 0.9 | 7.66 | 5.01 | polpa, média de amostras |
| abacate | Abacate | BRC0001C | 76 | 1.15 | 5.84 | 6.21 | variedades brasileiras; o Hass importado tem mais gordura |
| mandioca-frita | Mandioca frita | BRC0091B | 304 | 1.38 | 50.3 | 11.2 | — |
| acucar-refinado | Açúcar refinado | BRC0007K | 397 | 0.16 | 99 | 0 | — |
| acucar-cristal | Açúcar cristal | BRC0005K | 400 | 0.32 | 99.6 | 0 | — |
| acucar-mascavo | Açúcar mascavo | BRC0006K | 382 | 0.76 | 94.5 | 0.09 | — |
| mel | Mel de abelha | BRC0028K | 324 | 0.17 | 80.9 | 0 | — |

Total: 123 itens.
