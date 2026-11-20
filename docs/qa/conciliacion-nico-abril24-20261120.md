# Conciliación del XLSX informativo NICO de abril de 2024 con el acuerdo oficial y sus reformas

**20 de noviembre de 2026.** Medición reproducible: `python3 scripts/reconcile-nico-abril24.py` (requiere `pdftotext`; usa sólo PDF y JSONL del repositorio).

## Resultado medido
| Concepto | Pares (fracción, NICO) |
|---|---:|
| Acuerdo DOF 22-ago-2022 (`nico-22ago22.pdf`) | 11 469 |
| Reforma DOF 30-jun-2023: crea 53, suprime 18 (vigor 1-jul-2023) | +53 −18 |
| Reforma DOF 22-mar-2024: crea 6, suprime 3 (vigor al publicarse) | +6 −3 |
| Calculado | 11 507 |
| `nico-abril24.jsonl` (SNICE) | 11 507 |
| Sólo en abril24 / sólo en el cálculo | 0 / 0 |

Las 21 supresiones existían en el texto base y las 59 creaciones no estaban en él (el script lo comprueba con `assert`). Con estas dos reformas, el conjunto de pares de abril de 2024 coincide exactamente con el oficial.

## Fecha de operación
Para una operación anterior al 1-jul-2023 aplica el conjunto base; entre el 1-jul-2023 y el 21-mar-2024, base más la primera reforma; desde el 22-mar-2024, también la segunda. Ejemplo de cambio: 0901.21.99 y 0901.22.99 (café) pasan de `00` a `01` «En cápsulas» y `99` con la Anotación 1 del capítulo 09 desde el 22-mar-2024.

## Límites (no medido)
- Sólo se comparó la existencia de pares. No se compararon descripciones, anotaciones de capítulo ni correlaciones. La modificación de la Anotación del capítulo 72 y las anotaciones 61, 62, 09 y 95 no se contrastaron.
- No se verificó si hubo reformas publicadas después del 22-mar-2024 ni la fecha exacta de la edición del SNICE; sólo se concilió contra las dos reformas del repositorio.
- Es cotejo de texto, no opinión jurídica de vigencia.
