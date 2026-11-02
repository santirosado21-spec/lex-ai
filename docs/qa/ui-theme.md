# QA: apariencia

La apariencia se guarda en `localStorage` como `lex-ai.appearance`. Si el almacenamiento no está disponible, la sesión conserva su selección sin bloquear el renderizado. `Automático` elimina `data-theme` para seguir en vivo la preferencia del sistema; `Claro` y `Oscuro` fuerzan los tokens correspondientes.

`scripts/ui-theme-smoke.mjs` comprueba la persistencia, el intercambio del distintivo LEX AI y la ausencia de desbordamiento horizontal a 1440, 768 y 390 px en ambos temas explícitos. Las capturas se escriben en `artifacts/ui-theme/`.
