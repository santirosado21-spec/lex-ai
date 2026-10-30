# Ciclo 3 — UI, biblioteca federal y entrenamiento local

Estado: E2E DEL CANDIDATO, PAQUETE DE MODELO E INSTALADOR COMPROBADOS. Este informe no acredita un piloto jurídico listo para clientes.

## Producto y datos comprobados

- UI dirigida con una consulta real a Claude Opus 5.5, referencias de 21st.dev y ejecución/integración de Codex. Paleta por teclado, biblioteca documental, lector, actividad, tareas manuales y estado real de entrenamiento.
- 317 PDFs del catálogo federal descargados. Snapshot v2: 35.452 artículos de 303 instrumentos, con exclusiones trazadas y 910/910 muestras cotejadas mediante otro extractor. No es una revisión jurídica exhaustiva ni garantía de vigencia.
- Índice SQLite local de 153.014.272 bytes, sin documentos de clientes. Fuentes completas, filtros y búsqueda real comprobados en API y navegador.
- Las referencias explícitas a ley y artículo se resuelven de forma exacta. El modelo recibe alias breves; una doble validación devuelve los IDs canónicos antes de guardar.
- App 0.3.0 reconstruida y paquete final verificado a las `2026-10-30T14:55:03.296Z`: hashes del servicio/parser y biblioteca coinciden con el código. Firma ad hoc, sin notarización ni prueba en un segundo Mac limpio. El verificador ejecuta servicios empaquetados; no afirma una nueva prueba visual nativa.

## Entrenamiento real v2

Gemma 4 26B-A4B, base MLX fijada por revisión y hashes, 400 pasos locales. Cuatro bloques finales, siete proyecciones q/v, rango 4, 185.344 parámetros entrenables. Duración 324,57 segundos; pico MLX 15,31 GB. Adapter SHA256: `2534b68c6cd2e944452e98b42be1f33405a25171ade4574c1ea12443b5c73fd0`.

El dataset v2 tenía 31.956 ejemplos de entrenamiento; 31.954 caben completos en el contexto de 512 tokens. Validación: 3.116; test: 3.688. Las leyes se separaron por partición. La corrida recorrió 400 batches de un ejemplo, no un epoch completo ni toda la legislación. Los objetivos son citas, JSON, abstención y resistencia a instrucciones sintéticas, no asesoría generada como verdad.

| Medida | Base | Adapter v2 |
|---|---:|---:|
| Pérdida en 16 casos fijos de validación | 1,78798 | 0,00151 |
| Pérdida en 16 casos fijos de test | 1,81351 | 0,00430 |
| JSON estricto en 32 casos reservados | 0/32 | 32/32 |
| Integridad de fuentes/abstención léxica en esos casos | 28/32 | 32/32 |
| Ausencia del canario de inyección | 32/32 | 32/32 |

El 0/32 de JSON de la base se debe a envolturas Markdown; no significa 0% de conocimiento jurídico. Las métricas son de protocolo y texto, no evaluación semántica profesional.

## Exportación y fallos encontrados

1. La fusión que recuantizaba las capas ajustadas perdió buena parte del delta LoRA. Una comparación CPU encontró solo 9–22% del componente alineado del cambio. Dos pruebas reales con el mismo prompt confirmaron que el adapter y la fusión selectiva densa conservan respuestas, mientras la fusión q4 las pierde.
2. Ollama usó inicialmente un renderer que omitía cuatro tokens del prefijo. Se fijó `gemma4-large` y el prefijo coincide exactamente: 171 tokens en el caso comprobado.
3. La exportación v2-r2 conserva solo las siete proyecciones ajustadas en BF16; el resto permanece cuantizado. Pasó 32/32 casos técnicos importada en Ollama 0.40.6.
4. El flujo de aplicación encontró errores adicionales con párrafos y dos fuentes: referencias no vinculadas, repetición al decodificar con esquema y saltos de línea literales dentro de JSON sin esquema. La aplicación rechazó las salidas. **El éxito de 32 ejemplos breves no aprobó ese flujo.**

## Continuación v3: entrenada, rechazada

V3 continuó realmente el adaptador v2 durante 150 pasos adicionales (550 acumulados), con contexto de 1024 tokens y learning rate `1e-5`. Duró 272,92 segundos y alcanzó 16,25 GB de memoria MLX. SHA256 del adaptador: `fa7404db1e8d7a3e267f4676e63ada9b9c9ca23f6662b05befded9efa318f4db`. El [reporte de entrenamiento](../../artifacts/training/lex-gemma4-lora-v3/training-report.json) registra la procedencia y los casos fijos balanceados de evaluación.

El dataset v3 contiene 2948 ejemplos train: 2448 comparaciones con un documento sintético y un pasaje público, más 500 ejemplos originales de replay. Conserva los 3116 ejemplos de validación y añade 52 workflow. El test de 3688 ejemplos es idéntico byte a byte a v2. Todos los ejemplos caben completos: máximos 909/944/402 tokens para train/valid/test; no hubo truncamientos. Ocho pruebas CPU y una auditoría de los 2500 targets workflow comprobaron JSON, referencias por párrafo y citas textuales. Esto acredita la construcción de los targets, no su aprendizaje ni exactitud jurídica.

**V3 queda RECHAZADO para exportación/promoción.** La [prueba de aplicación](../../artifacts/training/lex-gemma4-lora-v3/application-probe.json) produjo repetición degenerativa y JSON inválido. La [sonda con penalización de repetición](../../artifacts/training/lex-gemma4-lora-v3/application-probe-rp1.1.json) también falló y alteró texto de una cita. La pérdida reducida de validación/test (0,07321/0,05729) no compensa esos fallos. No se presenta el entrenamiento completado como un candidato aprobado.

Se conserva **v2 de 400 pasos, exportación v2-r2**, como candidato experimental seleccionado. La evaluación importada 32/32 queda registrada en [behavior-imported.json](../../artifacts/training/lex-gemma4-lora-v2/behavior-imported.json). Si un recorrido posterior reutiliza esa evidencia tras verificar hashes y contratos, se declara reutilizada; no constituye otra ejecución de 32 pruebas.

## Integración final y artefactos

El [reporte final de runtime](../../artifacts/training/runtime-v2-r2/verification.json), terminado a las `2026-10-30T14:53:56.695Z`, tiene `technicalGatePassed:true` y `status:PASS`. Ejecutó realmente contrato sintético → recuperación en biblioteca federal → respuesta con dos fuentes validadas → DOCX. La respuesta tardó 34.873 ms. La evidencia previa de los 32 casos fue reutilizada tras comprobar integridad, declarado como `behavioralEvidenceReused:true`; no fueron otros 32 casos ejecutados.

El recorrido usó el servicio real con un adaptador de transporte que genera sin esquema, máximo 512 tokens. El parser, después de fallar `JSON.parse`, escapó **4 controles literales LF/CR/TAB dentro de strings JSON**, registrado como `json-string-control-escaping`. Esa normalización preserva el contenido decodificado; no corrige comillas, gramática, citas, IDs ni conclusiones. Las validaciones de estructura y fuentes permanecen activas. El benchmark de 32 casos conserva JSON estricto sin esta tolerancia. El reporte declara `legalAccuracy:not-evaluated` y revisión profesional obligatoria.

**El modelo de la app no se ha sustituido.** La app sigue usando el Gemma original con su transporte y esquema ya probados. V2-r2 se entrega por separado para importación manual en un runtime compatible; no hay selección automática del candidato en la UI. La prueba del servicio con transporte experimental no acredita un cambio de modelo predeterminado.

El archivo [LEX-Gemma4-Experimental-v2.tar](../../artifacts/LEX-Gemma4-Experimental-v2.tar) ya se produjo: **14.372.300.800 bytes**, SHA256 `2b172c99001ab5de8e28ff9d469e0655101b559bcd36464ec2a4b364f84a558b`. La [verificación de distribución](../../artifacts/training/distribution-verification.json) comprueba 52 miembros y la transformación de metadatos sin cambiar pesos/configuración. El [paquete final 0.3.0](../../artifacts/cycle-3-package-check.json) tiene PASS. El DMG canónico [LEX-AI-0.3.0-arm64.dmg](../../artifacts/LEX-AI-0.3.0-arm64.dmg) pasó `hdiutil verify`, según el coordinador, con SHA256 `58de3bfc32119f1fbf00db90c34b1770f2db94d31ff7889d15e64c8e56d5d83d`. Un PASS de estos recorridos es técnico y sintético, no aprobación de un piloto jurídico.

## Participación y diagnóstico

Codex implementó, entrenó y verificó; Claude Opus 5.5 participó en diseño. Hubo una consulta real a Gemini, conservada en [gemini-workflow-opinion.txt](../../artifacts/training/gemini-workflow-opinion.txt). Su diagnóstico de 1235 tokens sumó erróneamente los 361 tokens del sistema a los 874 que ya representaban el total; también extrapoló un fallo de RoPE desde el contexto de entrenamiento. Codex rechazó esas afirmaciones: no son evidencia causal. La decisión de rechazar v3 se basa en las salidas observadas, no en la opinión externa ni en inferir capacidad profesional a partir de la pérdida.

## Memoria, supervisión y límites

Ollama 0.40.6 retiene snapshots de prefijos entre solicitudes. Se observó crecimiento hasta 20,70 GiB en una evaluación de 32 solicitudes. La política para 24 GB es descargar el runner entre consultas (`keep_alive:0`); supone recarga posterior. Las métricas del runtime deben distinguirse del pico de entrenamiento.

El supervisor tiene ingesta pública cada seis horas como mínimo, propuestas separadas de los snapshots aprobados, pruebas y exclusión de GPU. El bloqueo de pipeline cubre evaluación y E2E. La prueba de cancelación comprueba que no queda un proceso huérfano.

La primera corrida bajo `ProcessType=Background` agotó los cinco minutos de inferencia sin emitir tokens; se conserva en `artifacts/night-watch/runs/e3dcc791-5d82-4bfb-bed8-78a764b4e713`. Se cambió a `Standard`, sin ampliar tiempos máximos ni cambiar modelo, prompt o validaciones. La nueva corrida completó el análisis en 89,16 segundos y terminó PASS a las `2026-10-30T15:04:40.994Z`: citas, DOCX, feedback, aprobación sintética y rollback. La salida del modelo base fue JSON estricto sin normalización. El resultado es compatible con limitación de recursos en segundo plano; no se afirma una medición causal exhaustiva del sistema operativo.

El monitor actual arrancó a las `2026-10-30T15:02:44Z` y termina como máximo a las `2026-10-31T03:02:44Z` (30 de octubre, 21:02:44 en Ciudad de México), mientras el Mac permanezca encendido. Primer ciclo completo aprobado; estado `sources-partial` por incidencias públicas conocidas, no por fallos de pruebas. Próximo ciclo: `15:49:44Z`. Las fuentes conservan sus intervalos mínimos de consulta; no se volvieron a descargar en este ciclo. El monitor no se instala para reiniciar automáticamente tras reinicio o cierre de sesión.

Resultados: 62 pruebas Python y 94 pruebas Node aprobadas; 13 pruebas dirigidas del supervisor tras el cambio de prioridad. Smoke estándar de UI y [smoke con biblioteca real](../../artifacts/ui-real-library-smoke.json) PASS: conteos reales, búsqueda CCF1797, fuente completa y ancho de 700 px sin desbordamiento. Las pruebas de UI no ejecutan el modelo; las dos evaluaciones reales de candidato y base se registran por separado. V3 permanece rechazado y sus evidencias se conservan. No se enviaron documentos privados a modelos externos ni se compró cómputo en nube.
