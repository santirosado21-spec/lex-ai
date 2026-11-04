# Tablero de integración — corte local 0.4.13 (2026-11-04)

**Copia activa corregida (2026-11-04):** el ejemplo del dueño «Hola → análisis de contrato» provenía de 0.4.2 abierta desde el instalador. Se cerró normalmente, se desmontó y quedó **0.4.13 de Aplicaciones activa**. Prueba visual nativa en el mismo asunto sintético, contrato y habilidad jurídica: **«¡Hola! ¿En qué puedo ayudarte hoy?»**, sin citas. Historial conservado. [Evidencia](../qa/dialogue-routing-context-0.4.13.md).

**Diálogo por defecto, 0.4.13 (2026-11-04):** instalada con respaldo. La charla no recupera documentos ni leyes; solicitudes jurídicas/documentales y seguimientos mantienen fuentes. Contexto de chat con turnos completos cuando caben y mensaje más simple. 378 pruebas y paquete arm64 con doce turnos reales PASS funcional. **Naturalidad sólo parcialmente mejorada**: persisten frases torpes, consejos no pedidos y problemas creativos; no presentar el PASS técnico como conversación lograda. [Comparación, ensayos fallidos y límites](../qa/dialogue-routing-context-0.4.13.md).

**Conversación base corregida, 0.4.12 (2026-11-04):** instalada en Aplicaciones con respaldo; 374 pruebas y build PASS, paquete arm64 y x64-Rosetta con inferencia real y biblioteca completa PASS. Listas, cálculo y placeholders de correo ya no se rechazan como citas jurídicas; aritmética explícita no usa leyes irrelevantes. Modelo base sin nuevo entrenamiento ni activación de adaptadores. [Evidencia y límites](../qa/general-chat-base-0.4.12.md).

**Resultado nocturno revisado, 2026-11-04:** 384 pasos / tres épocas completados a las 00:06, en 48 minutos. Checkpoint final y base verificados; candidato **rechazado para promoción**: 43/49 frente a 47/49 comprobaciones mecánicas de la base, con repetición y respuestas inadecuadas observadas. App sin cambios, fase jurídica completa pendiente, ningún entrenador activo. [Evidencia y límites](../qa/night-conversation-training-2026-11-03.md).

**Objetivo final reiterado:** [asistente jurídico conversacional único, fuentes, documentos y contexto](../architecture/conversational-product-contract-2026-11-03.md). El entrenamiento nocturno de 512 chats es una primera etapa parcial; la fase conductual jurídica completa y su aceptación siguen pendientes.

**Entrenamiento nocturno, última instrucción del dueño:** mejorar la conversación del modelo ligero actual mientras duerme. Piloto y reanudación completados/verificados: **dos pasos reales**, base intacta, pico 2,68 GiB. Continuación en fase `MAIN`. Supervisor independiente PID 69901 en `artifacts/raft/night-20261103-conversation/`, máximo ocho horas; 512 conversaciones de entrenamiento, 128 conversaciones retenidas y 200 casos jurídicos de validación. Tres épocas/384 pasos máximos, cuatro capas/rango ocho, 6 GiB MLX y dos de reserva. El corpus completo excedió memoria al segundo backward; se conservan su checkpoint real del paso uno y todos los fallos. La selección nueva parte de la base, no recorta diálogos, verifica reanudación y programa diagnóstico emparejado; candidato inactivo. [Estado, pruebas y comandos](../qa/night-conversation-training-2026-11-03.md). Consultar estado vivo antes de afirmar que terminó.

**Opciones remotas dsystem, actualización posterior:** Groq, OpenRouter, Hugging Face y Mistral implementados como conectores de desarrollo y traspasos web. Comando `dsystem` instalado, skill global actualizada, 18 pruebas dirigidas y 369 totales PASS; catálogos públicos OpenRouter/Hugging Face comprobados y cuatro dry-runs sin envíos. Activación API pendiente de claves y comprobación de cuentas gratuitas; no hubo inferencia autenticada ni pagos. El dueño declara cuentas HF/OpenRouter y DeepSeek Harness; Grok de Cursor/Grok Bot es distinto de Groq. [Operación y evidencia](remote-collaborators.md).

**Workflow ampliado, 2026-11-03:** el dueño incorporó Kimi Desktop y Cursor. Codex mantiene coordinación, diseño, verificación e integración; sigue prohibido usar Claude. Reglas persistentes de Cursor listas, carpeta local vinculada y prueba de lectura completada. Kimi con sesión/K3 visibles, pero su única prueba no devolvió contenido y fue detenida. Sin API ni pagos nuevos. [Reparto, evidencia y límites](desktop-collaborators.md).

**Corrección conversacional 0.4.11:** app de Aplicaciones actualizada; copia antigua 0.4.2 cerrada y disco desmontado. Saludos y presentaciones sin análisis no solicitado, memoria extractiva de nombre/profesión por hilo y explicación de capacidades. 351 pruebas PASS, UI/API sintética PASS, seis turnos de evaluación local PASS y paquetes arm64/x64-Rosetta PASS. Firma y DMG verificados. La prueba visual final espera el desbloqueo de macOS; no fingir su ejecución. [Evidencia y fallos previos](../qa/conversational-native-fix-0.4.11.md). No usar Claude.


**Prioridad vigente del dueño, 2026-11-03:** entregar el agente conversacional y no usar Claude. Codex implementó el panel de chats, búsqueda, persistencia y menú de ventana pequeña. Compilación universal lista; inferencia real arm64 confirmó respuesta, recuerdo y aislamiento de hilos. Inferencia real x64 bajo Rosetta también PASS; no equivale a medir un Intel físico ni una máquina de 8 GB. Instalador universal 0.4.9 generado; firma local e integridad DMG PASS. El paquete mantiene el modelo base pequeño y el entrenamiento experimental separado. [Informe y fallos conservados](../qa/conversational-agent-0.4.9.md).


Rige `AGENTS.md`. Codex ejecuta el plan autorizado de continuidad con cuota reducida. [Evidencia de esta ejecución](../qa/continuity-budget-2026-11-03.md).

**Actualización posterior del dueño:** se liberaron recursos y se corrigieron los kernels y el uso de memoria de la receta conductual. Los intentos previos se conservan como fallidos; la rematerialización por bloques redujo el backward comparable de 6,77 a 4,48 GiB, pero otros microbatches necesitaron 6,15. El piloto vigente usa presupuesto MLX de **7 GiB**, mínimo de inicio de **9 GiB** y reserva de **2 GiB**. El piloto completó dos pasos con pico de 6,94 GiB y base intacta; su checkpoint fue verificado. La continuación hasta 1.250 pasos está guardada y espera 9,5 GiB disponibles antes de iniciar el siguiente tramo. El estado vivo está en el informe enlazado; no hay candidato activado. El compositor incorpora contador y explicación de exceso sin recortar dictados, con build, 346 pruebas y smokes de interfaz aprobados; pasan además 26 pruebas RAFT y cuatro de kernels/memoria. [Estado actual, evidencia y límites](../qa/memory-training-ui-2026-11-03.md). Las filas inferiores conservan el corte anterior de integración.

- Base Git observada: `68eb716`. Inventario inicial: **36 archivos versionados modificados y 217 sin seguimiento**, con hashes por archivo y diff versionado guardados en `artifacts/continuity-budget/20261103T191744Z/`. El propietario del trabajo previo está sin verificar; esta sesión no lo atribuye ni lo incorpora indiscriminadamente a un commit.
- Código y plist instalado: **0.4.8**, comprobados por separado. El router instalado no coincide con el árbol corregido; el DMG conservado es **0.4.6**. No se ha empaquetado ni instalado este corte.
- Verificación de esta ejecución: **37/37 pruebas dirigidas**, **346/346 pruebas completas**, build TypeScript/Vite correcto. Comparación W1 emparejada sin cambios por caso: **60/60 directas, 32/60 coloquiales, 25/40 seguimientos** antes y después del parche. Son pruebas técnicas con datos sintéticos; no acreditan calidad jurídica, distribución nativa ni hardware de 8 GB.

| Módulo | Estado local y responsabilidad de este corte | Siguiente paso concreto |
|---|---|---|
| Router y recuperación de continuidad | Codex corrigió el reconocimiento de navegación y eliminó la sustitución del sucesor por el artículo previo cuando falta el índice. Pruebas sintéticas nuevas cubren Bis, huecos, extremos, contexto ambiguo y cambio de ley. | Revisar el parche aislado de la sesión antes de integrar; mantener consultas directas y aislamiento. |
| Recuperación por fragmentos / tesauro | Trabajo previo sin commit; W5 reporta 33/60 coloquiales y 60/60 directas, con regresiones documentadas. | Tratar W1 como diagnóstico observado; nuevos casos de desarrollo y evaluación independiente antes de una promoción. |
| Conversación, hilos y memoria | Trabajo previo sin commit; pruebas de hilos incluidas en la verificación actual. | Revisar cambios de servicio/store por separado de interfaz y recuperación. |
| Office / SharePoint | Trabajo previo sin commit; el informe 0.4.6 distingue host nativo y simulaciones. | Preservar sus archivos; no asumir validación de tenant real ni publicar desde esta sesión. |
| Voz / honorarios / correo / borradores | Trabajo previo sin commit; pruebas técnicas incluidas en la suite actual. | Integración por módulo y smoke correspondiente, sin mezclarlo con continuidad. |
| Corpus estatal, descubrimiento y adquisición | Trabajo previo sin commit con procedencia y exclusiones documentadas. | Revisar fuentes y artefactos por separado; cobertura parcial, sin declaración nueva de vigencia. |
| RAFT conductual | Dry-run nuevo aprobado: 5.000 train / 200 valid, hashes/exclusiones/máscaras verificados, cero truncamiento y base intacta. Piloto de diez pasos preparado, no iniciado. | Requiere 10 GiB disponibles; preflight midió ~5,41 GiB y el dry-run ~3,13 GiB. No bajar la guarda ni dejar un proceso esperando. |
| Documentación operativa | Codex alineó versiones, reparto y evidencia en este corte, conservando el historial inferior. | Retomar desde este corte y los logs guardados, sin releer todo el historial. |

El parche aislado, alcance de archivos, inventario final y logs están en `artifacts/continuity-budget/20261103T191744Z/`. No hubo commit, push, descarga, entrenamiento, activación ni cambio de instalación en esta ejecución. El entrenamiento queda pendiente de recursos medidos; no se declara completado.

---

## Corte histórico — 0.4.3 (2026-11-02)

Este tablero sustituye el corte histórico `0.3.0`. Describe el estado que se puede comprobar en el árbol local y en los documentos de entrega; no declara validación jurídica, instalación limpia ni compatibilidad física con 8 GB. La fuente operativa de las restricciones sigue siendo `AGENTS.md`.

## Estado de integración

- Base integrada: `main` remoto `d219871` (catálogo de instalación 0.4.3). Este árbol tiene además los commits locales `ffca2b6` y `85df52f`; no se deben perder al integrar trabajo posterior.
- Árbol concurrente: hay cambios sin integrar en biblioteca jurídica, dictado, complemento de Office y horas/facturación. Se inventarían abajo como **en curso**, no como funciones entregadas. Sus archivos y pruebas pertenecen a la persona que los está desarrollando.
- Evidencia histórica más reciente del ciclo: build y 182 pruebas pasaron antes de los cambios concurrentes; el instalador 0.4.3 se verificó con firma ad hoc. Esa evidencia no cubre los cambios sin integrar ni sustituye la prueba que se ejecute sobre el árbol final.
- Verificación de este árbol (2026-11-02): `npm run build` y `npm test` pasan (**210/210**). Se corrigieron seis regresiones de la selección/evaluación de evidencia: una fuente pública larga ya no se descarta por su previsualización truncada; una referencia exacta sin fuente mantiene la compuerta de evidencia; y los tests de ablation sólo exigen una fuente privada o diversidad de fuentes cuando el contexto realmente las contiene. El subconjunto aislado de Office/dictado/horas pasa **16/16** y `npm run test:ui` pasa con inferencia explícitamente simulada y datos sintéticos. Esto no valida calidad jurídica ni inferencia real.

| Área | Estado | Dependencias y evidencia disponible | Límite o siguiente verificación |
|---|---|---|---|
| Aislamiento de despacho/asunto, importación y recuperación local | Integrado | Node/SQLite/FTS, contratos de servicio y pruebas deterministas | Probar de nuevo aislamiento después de cada migración o endpoint nuevo; no usar documentos reales en fixtures. |
| Respuesta con fuentes y controles de citas | Integrado con controles técnicos | Recuperación local, procedencia/versiones y pruebas de citas | La cita válida no acredita que la interpretación sea correcta; falta evaluación semántica revisada por abogados. |
| Runtime ligero local | Candidato experimental de la app | Catálogo fijado, descarga explícita y guardas de memoria; el nombre técnico sólo se conserva en documentación interna | No cambiar el runtime ni promover adaptadores sin evaluación emparejada. El objetivo de 8 GB no está probado en un equipo físico de 8 GB. |
| DOCX y apertura de escritos | Integrado para recorrido sintético | Exportador, pruebas que reabren DOCX y prueba histórica de apertura de TXT/DOCX | Faltan inspección visual nativa reproducible, instalación limpia y plantillas jurídicas revisadas. |
| Interfaz, identidad y herramientas locales | Integrado hasta el corte 0.4.3 | Rediseño, logo, pruebas/smokes históricos con datos sintéticos | Los smokes Chromium no son una revisión de la ventana Tauri ni de accesibilidad con usuarios. |
| Comparador, conflictos, checklist, pendientes y acciones propuestas | Integrado con alcance acotado | Pruebas deterministas y UI smokes históricos | Comparación y conflictos son léxicos, no dictámenes; los plazos no se calculan automáticamente. Un agente no recibe shell ni puede aprobar sus propuestas. |
| Biblioteca federal y recuperación de fuentes | Integrada con cobertura parcial | Corpus versionado y catálogos de procedencia | Sin garantía de vigencia, cobertura estatal completa, jurisprudencia ni recuperación híbrida. |
| Complemento de Office | En curso, sin integrar | `office-addin/`, `server/office-bridge.mjs`, `tests/office-bridge.test.mjs`, documentación local nueva | Ejecutar sus pruebas, verificar aislamiento y no activar/publicar el complemento ni pedir credenciales sin aprobación humana. |
| Dictado local | En curso, sin integrar | `server/stt.mjs`, `src/VoiceInput.tsx`, `tests/stt.test.mjs`, preparación de runtime | Confirmar empaquetado y consumo de memoria con binario/modelo aprobados; no descargar ni cargar recursos pesados automáticamente. |
| Horas y facturación | En curso, sin integrar | `server/time-billing.mjs`, `src/TimeBillingView.tsx`, pruebas y smoke nuevos | Verificar límites de acceso, totales y UX; no presentarlo como contabilidad o cálculo fiscal validado. |
| Descubrimiento OJN y reglamentos | En curso, sin integrar | Catálogos, scripts de descubrimiento/cobertura y pruebas offline | Revisar procedencia, fecha y accesibilidad antes de incorporar datos; no afirmar completitud ni vigencia. |

## Orden de trabajo

1. **Cerrar cambios concurrentes por módulo, sin mezclar commits.** Cada dueño ejecuta las pruebas unitarias de su módulo, `npm run build`, `npm test` y el smoke UI pertinente con datos sintéticos. Revisar `git diff` antes de cada commit para no incluir trabajo ajeno. Los fallos de listener loopback del sandbox se registran como limitación del entorno; no son un pase automático.
2. **Conservar las compuertas de seguridad y el alcance local.** En especial: separación despacho/asunto, texto documental como datos, aprobación humana para escrituras/acciones, límites de tamaño/memoria y validación de citas. No rebajar la compuerta de memoria para convertir un bloqueo en resultado.
3. **Resolver las brechas de evaluación antes de mejorar el modelo.** Repetir los casos públicos bloqueados sólo con memoria libre suficiente, medir abstención y control numérico en un conjunto retenido, y obtener revisión semántica humana. El candidato entrenado continúa separado e inactivo.
4. **Preparar el smoke de distribución.** En un segundo Mac limpio y con datos sintéticos: instalar, descarga/interrupción/reanudación, primera consulta recuperada, DOCX reabierto, apertura de escrito y aislamiento entre dos despachos. Registrar equipo, RAM, versión y resultado; no extrapolar la Mac de 24 GB a 8 GB.
5. **Después de la evidencia anterior, priorizar valor jurídico de bajo riesgo.** Recuperación híbrida local y curaduría de fuentes, edición/versionado de borradores y plantillas revisables. El cómputo de plazos permanece bloqueado hasta revisión humana de un calendario oficial de inhábiles.

## Bloqueos explícitos

- Validación profesional, semántica y de vigencia: requiere revisión humana y fuentes oficiales versionadas; no se infiere de tests técnicos.
- Rendimiento/compatibilidad en 8 GB: requiere medición en hardware físico objetivo.
- Instalación limpia, Developer ID, notarización y actualización firmada: pendientes; una firma ad hoc y un build no los sustituyen.
- Integración o publicación de Office, descargas nuevas de runtimes/modelos y cualquier servicio de pago: requieren una decisión y autorización humana específicas.

## Regresiones de evidencia cubiertas

| Riesgo | Prueba que lo cubre |
|---|---|
| Una fuente válida sin inventar una segunda fuente privada | `lightweight-skills.test.mjs`: `a valid single-source context stays valid without inventing a private document source`; `grounded-output.test.mjs`: `requires distinct citeable sources; one source remains possible`. |
| Dos fuentes disponibles deben mantenerse distintas | `lightweight-skills.test.mjs`: `v2 requires distinct sources and numeric support in each paragraph quote`; `grounded-output.test.mjs`: `requires distinct citeable sources; one source remains possible`. |
| Números, artículos y fechas sin respaldo | `grounded-output.test.mjs`: `unsupported numbers, articles, full dates and numeric words reject`; `lightweight-skills.test.mjs`: `canary, truncation and novel numeric claims fail instead of being repaired`. |
| Citas o IDs no presentes en la evidencia | `grounded-output.test.mjs`: `unknown IDs, cross-source and altered quotes reject`; `service.test.mjs`: `invented citations fail closed without streaming or saving output`. |
| Consulta sin evidencia | `conversation.test.mjs`: `no relevant passage abstains without inference or sources`; `service.test.mjs`: `no relevant evidence means an abstention before inference`. |
| Pasaje útil después de una previsualización pública truncada | `public-library-integration.test.mjs`: `RAG retrieves full long article then selects relevant bounded passage and excludes other matter`. |
