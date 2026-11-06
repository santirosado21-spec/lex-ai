# Decisiones — LEX AI

Solo se añade al final. Cada decisión lleva su motivo para que otro agente no la deshaga sin saber por qué. Usa `dmem decide`.

## 2026-11-05 09:07 — claude — Revisión de Cursor (Grok) al validador: 2 arreglos, 2 decisiones de no cambiar

**Por qué:** Arreglados y probados: (1) el número del artículo citado respaldaba cualquier cifra igual a ese número ('dentro de 47 días'); ahora solo respalda la frase 'artículo N'. (2) 'uno' se normalizaba a 1 y respaldaba un '1' inventado; 'uno' sale de la tabla de cardinales. NO cambiado: (3) un párrafo de charla con una afirmación jurídica que el léxico no detecta ('El finiquito incluye las partes proporcionales') se conserva si otro párrafo tiene cita; es un límite del filtro léxico, y endurecerlo con 'menciona ley' haría abstenerse a respuestas legítimas que piden un dato ('si me dices la fecha del despido…'). Pendiente de medir con el examen. (4) Las cifras de la ventana de 600/1200 caracteres de UN artículo público cuentan como respaldo: es deliberado (la ley dice 'veinte' en otra frase del mismo artículo); la ventana no cruza artículos.

## 2026-11-05 14:30 — codex — Dirección híbrida con prioridad ChatGPT

**Por qué:** El dueño acepta trasladar parte del procesamiento a la nube y conservar biblioteca jurídica, habilidades/recursos, expedientes, archivos y horas. Diseñar integración oficial de ChatGPT con contexto mínimo autorizado y almacenamiento/recuperación locales. Elegibilidad comercial de suscripciones y acceso efectivo pendientes; API es alternativa separada. No habilitar gasto ni cargar expedientes reales a partir de esta decisión. Ver docs/architecture/hybrid-private-workspace-2026-11-05.md.
