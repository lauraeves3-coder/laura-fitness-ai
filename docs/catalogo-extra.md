# Catálogo extra (CAT-08)

Alimentos novos podem ser adicionados sem editar código em `data/catalogo-extra.json`
(ou no arquivo apontado por `FITPULSE_CATALOG_EXTRA`). O arquivo é uma lista; valores por 100 g.

```json
[
  {
    "id": "bolo-de-fuba",
    "name": "Bolo de fubá",
    "aliases": ["bolo de fubá", "bolo de fuba"],
    "kcal": 330, "protein": 5, "carbs": 50, "fat": 12,
    "default_g": 60, "unit": "1 fatia",
    "source": "curated_estimate"
  }
]
```

Regras (`src/catalogExtra.js`):

- `id` minúsculo com hífens e sem repetir um id do catálogo.
- `kcal`, `protein`, `carbs` e `fat` são números ≥ 0. Os macros somam no máximo 100 g, e a energia fica a até 30% de 4·P + 4·C + 9·G.
- `source`: `tbca_verified` (exige `reference` com código BRC), `official_nutrition_table`, `official_brand`, `curated_estimate` ou `user_label`.
- Entradas inválidas não entram no catálogo e aparecem em `CATALOG_EXTRA_ISSUES`. O teste `test/catalogExtra.test.js` falha se o arquivo versionado tiver alguma entrada inválida.

O arquivo é lido quando o servidor inicia, então mudanças valem depois de reiniciar.
