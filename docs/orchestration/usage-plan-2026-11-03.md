# Continuidad dsystem con cuota reducida — 2026-11-03

Objetivo: aprovechar el trabajo existente y avanzar por defectos acotados sin repetir exploraciones, redacción masiva ni rondas de revisión. Codex conserva implementación, decisiones e integración conforme a AGENTS.md. Este corte no cambia modelos de producto ni publica una versión.

**Ejecución autorizada posterior:** consultar el [corte de ejecución](../qa/continuity-budget-2026-11-03.md) para el estado vigente: consolidación documental, corrección de navegación y 346 pruebas aprobadas. El [piloto posterior](../qa/memory-training-ui-2026-11-03.md) ya completó dos pasos y tiene checkpoint verificado; la continuación supervisada espera recursos sin llamadas adicionales a modelos externos. Las cifras y comprobaciones inferiores describen el análisis previo y se conservan como historial.

## Estado comprobado

- HEAD observado: `68eb716`; package.json declara **0.4.8**. Hay 36 archivos versionados modificados y 216 archivos sin seguimiento al inicio del análisis; los directorios agrupados por Git no equivalen al número de archivos. Preservar todo el trabajo y revisar propietarios antes de integrar.
- El tablero describe 0.4.3 y README mezcla entregas 0.4.5/0.4.6. La versión del árbol, el paquete construido y la app instalada deben registrarse por separado; no se inspeccionó la instalación en esta sesión.
- **Verificación nueva de esta sesión:** `npm test` pasó **342/342**, sin omitidas; `npm run build` pasó. Logs: `/tmp/lex-usage-npm-test-20261103.log` y `/tmp/lex-usage-build-20261103.log`. No se repitieron smokes nativos ni calidad de inferencia jurídica.
- Hay trabajo local en conversación/hilos, recuperación por fragmentos, fuentes estatales, voz, Office, correo/borradores y honorarios. Existencia de código y pruebas no equivale a entrega del árbol completo.
- [W5](../../server/retrieval/W5-colloquial.md) y sus JSON documentan artículo hit@3 coloquial **6/60 → 33/60**, directas **60/60 → 60/60**, seguimientos **24/40 → 25/40**, global **90/160 → 118/160**. Es recuperación con inferencia simulada. Persisten regresiones: seguimientos laboral 4→3, amparo 2→1, seguridad social 3→2; fragmentos constitucional 7→5. No son resultados nuevos ejecutados en esta sesión.
- [RAFT](../qa/raft-dataset-2026-11-03.md) ya contiene 5.000 respuestas finales únicas y 200 ejemplos de validación. Manifest y dry-run confirman `DATA_VALIDATED_NOT_TRAINED` / `DRY_RUN_VALIDATED_NOT_TRAINED`, cero pasos, pesos no cargados y candidato inactivo. La memoria observada en aquel dry-run no pasaba su guarda; no describe la memoria libre actual.
- El [piloto estatal anterior](../qa/qwen-state-corrective-training-2026-11-02.md) fue rechazado por regresiones de terminación/citas. No usar pérdida de entrenamiento ni datos preparados como justificación de promoción. Los PIDs y colas de ese informe son históricos, no estado vivo comprobado aquí.

## Reparto y consumo

| Responsable | Encargo acotado | Límite |
|---|---|---|
| Ayudante local mediante localllm | Clasificar fallos, extraer campos, resumir logs, primeros borradores de prosa | Verificar contra fuente; no código de producción ni decisiones críticas |
| Gemini mediante opinion | Una objeción concreta al plan o a un supuesto | Resumen sanitizado; sin datos de clientes, acceso a archivos ni ejecución de pruebas |
| Codex | Elegir el defecto, implementar, revisar diff e integrar con pruebas | Un módulo por encargo; contexto mínimo y registros completos en disco |
| Claude | Consulta puntual cuando haya una nueva decisión de diseño o revisión difícil | Conservar cuota; no convocarlo en este análisis operativo |

No hay telemetría de cuota restante/reinicio expuesta en las herramientas utilizadas. No se estiman porcentajes de ahorro ni se promete progreso con cuota agotada. Los comandos deterministas no requieren una llamada de modelo para cada paso, aunque su coordinación y los resultados enviados al chat sí consumen contexto.

Ollama reportó dos modelos instalados: `qwen3.5:2b-q4_K_M` (~1,95 GB de archivo) y `gemma4:26b-a4b` (~16,15 GB de archivo), ninguno cargado al consultar. Tamaño de archivo no equivale a RAM necesaria. **No se cargó Gemma grande.** Se anunció y seleccionó explícitamente el pequeño con `LOCALLLM_MODEL` sólo para el resumen de desarrollo; no cambia el candidato de la app. Gemma ligera queda pendiente de una selección medida, sin descargas automáticas.

## Próximos encargos

1. **Consolidar el corte actual.** Inventariar cambios por módulo y dueño, alinear tablero/versiones con evidencias y preparar integración por archivos explícitos. No hacer `git add .`, reset, limpieza ni mover trabajo concurrente indiscriminadamente. Registrar build/pruebas sobre cada árbol realmente integrado.
2. **Resolver un defecto de continuidad por vez.** Priorizar seguimientos y selección del fragmento, conservando la recuperación directa. Usar ejemplos públicos/sintéticos nuevos de desarrollo, una reproducción mínima y pruebas dirigidas. La evaluación W1 ya fue observada: sirve como diagnóstico/regresión, no como una prueba final todavía ciega; preparar otra evaluación independiente antes de decidir promoción.
3. **Entrenamiento conductual separado.** Reutilizar RAFT validado, comprobar hashes, exclusiones, recursos y procesos activos antes de un piloto reproducible. Conservar base y resultados fallidos, comparar base/candidato con inferencia real y bloquear activación automática. No regenerar 5.000 respuestas para ocupar menos cuota. Pruebas en esta Mac no validan hardware físico de 8 GB.

Cada encargo a Codex debe contener: objetivo de una frase, archivos propios, reproducción mínima, resultado esperado, fallo pertinente y criterio de aceptación. Guardar logs completos fuera del chat; mostrar totales y extractos de errores. Ejecutar primero pruebas dirigidas y completar las comprobaciones de integración necesarias al cerrar el módulo. No repetir suites, explorar todo el repositorio ni consultar varios modelos sin una incertidumbre nueva.

## Contribuciones reales de esta sesión

- Se leyó la skill dsystem y se entregó su guía pertinente a ambos ayudantes sin acceso a archivos.
- Una llamada local completó el resumen en **14,9 s** con el modelo pequeño. La revisión de Codex rechazó su afirmación de que RAFT ya se había entrenado, la expresión «simulación de inferencia real» y la confusión entre hash y firma. El original está en `/tmp/lex-usage-local-summary-20261103.txt`. El ayudante ahorra trabajo de lectura, pero no sustituye la comprobación.
- Una llamada a `opinion` terminó con salida 0 y una crítica efectiva: priorizar recuperación, aislar cambios, reducir logs/contexto y proteger consultas exactas contra sobreajuste. Codex acepta esas prioridades con los límites anteriores; no incorpora la sugerencia de cargar un ayudante adicional dentro de la recuperación de producto sin medición.
- Codex contrastó los informes con artefactos JSON, inspeccionó cambios y ejecutó build y las 342 pruebas. No hubo trabajadores adicionales, entrenamiento, instalación de dependencias, commit, push ni despliegue. Sólo se añadió este documento.
