# Decisiones — LEX AI

Solo se añade al final. Cada decisión lleva su motivo para que otro agente no la deshaga sin saber por qué. Usa `dmem decide`.

## 2026-11-05 09:07 — claude — Revisión de Cursor (Grok) al validador: 2 arreglos, 2 decisiones de no cambiar

**Por qué:** Arreglados y probados: (1) el número del artículo citado respaldaba cualquier cifra igual a ese número ('dentro de 47 días'); ahora solo respalda la frase 'artículo N'. (2) 'uno' se normalizaba a 1 y respaldaba un '1' inventado; 'uno' sale de la tabla de cardinales. NO cambiado: (3) un párrafo de charla con una afirmación jurídica que el léxico no detecta ('El finiquito incluye las partes proporcionales') se conserva si otro párrafo tiene cita; es un límite del filtro léxico, y endurecerlo con 'menciona ley' haría abstenerse a respuestas legítimas que piden un dato ('si me dices la fecha del despido…'). Pendiente de medir con el examen. (4) Las cifras de la ventana de 600/1200 caracteres de UN artículo público cuentan como respaldo: es deliberado (la ley dice 'veinte' en otra frase del mismo artículo); la ventana no cruza artículos.

## 2026-11-05 14:30 — codex — Dirección híbrida con prioridad ChatGPT

**Por qué:** El dueño acepta trasladar parte del procesamiento a la nube y conservar biblioteca jurídica, habilidades/recursos, expedientes, archivos y horas. Diseñar integración oficial de ChatGPT con contexto mínimo autorizado y almacenamiento/recuperación locales. Elegibilidad comercial de suscripciones y acceso efectivo pendientes; API es alternativa separada. No habilitar gasto ni cargar expedientes reales a partir de esta decisión. Ver docs/architecture/hybrid-private-workspace-2026-11-05.md.

## 2026-11-09 08:31 — codex — Privacidad local y modelos remotos por tarea

**Por qué:** Dirección del dueño del 2026-11-09: pequeño detector local, almacenamiento privado en la computadora y explorar OpenRouter como primera ruta multimodelo. Sustituye la prioridad ChatGPT del 05/11. Respaldos externos cifrados y colaboración compartida son etapas posteriores; protección reversible es seudonimización. No autoriza gasto ni cargas de clientes. Plan y criterios en docs/architecture/hybrid-local-privacy-router-2026-11-09.md.

## 2026-11-09 11:00 — codex — Loop híbrido PSF con revisión y primera integración simulada

**Por qué:** Pedido del dueño: preparar loop de desarrollo y publicarlo en GitHub para Lorenzo y Cordero. Una tarea solo desbloquea dependencias con aceptación, pruebas y revisión registradas; review-pending permite borrador, no integración. Revisión sintética de Kimi incorporada: contratos H1, flujo vertical H3V y reanudación explícita tras diagnóstico. No usar el runner antiguo sin revisión; trabajar en ramas/PR a rescate-0.4.13, sin tocar main.

## 2026-11-09 11:42 — codex — H1 captura un sobre simulado sin modificar el motor activo

**Por qué:** El dueño pidió iniciar H1 y subir al PR existente. Se mantiene createInference de producción intacto y se añade un mock optativo con capture JSON/UTF-8 determinista. Una prueba pareada fija límites reales del contrato y la documentación distingue estos bytes del futuro HTTP. Los puertos de privacidad/almacenamiento solo se proponen: no se adelantan H2 ni H6. Commit de implementación a99bb1f, revisado independientemente y con 437 pruebas/build aprobados.
