# Backlog del loop híbrido

Fecha: 2026-11-09. H1, H2, H3, H3V, H4a, H5a, M1 y los cortes H4b.1/H5b.1a revisados. H4b y H5b parciales; H4/H5 completos siguen sin cerrar. Orden y archivos propuestos; leer vecinos antes de modificar. Este tablero es el vigente para la transición. `docs/loop/BACKLOG.md` es histórico y no alimenta este ciclo.


Plan de terminación vigente: [H3V–H9 con SF sin Claude](hybrid-completion-plan-2026-11-09.md), con [aportaciones, cantidades y límites reales](hybrid-completion-review-2026-11-09.md). Es planificación: no modifica los estados pendientes ni inicia ejecución. H3V fija también el contrato legacy y de versiones; H4b cerrará tras congelar inventario/contratos H5a.

Continuación actual tras S2a: [plan por fases F0–F8 y nombres N0–N2](product-completion-phases-2026-11-09.md). Conserva los IDs de este tablero y sus gates; no marca fases implementadas por redactarlas. Primeros cortes propuestos: F0/H4b.2a y primer dominio de paridad H5b.1b.1. Biblioteca y S2b pueden avanzar con público/sintético en paralelo.

Estados: `todo`, `in-progress`, `review-pending`, `done`, `blocked`. Solo `done` desbloquea dependencias. Marcar revisión, commit y evidencia en cada tarea. Responsable y rama se reclaman antes de editar; las asignaciones y cierres efectivos figuran en la tabla.

Requisito transversal reafirmado: **entrada confidencial local → extracción/detección/sustitución local → política del sobre completo → nube → validación/restitución local**. En demo web no subir el original para anonimizarlo en servidor ni pedir preparación manual al usuario. H4/H5/H6/H7 deben probarlo primero con información sensible inventada, incluidos archivo/metadatos/historial/logs y seguimiento que vuelve a protegerse. [Guion integrado](../qa/cofounder-hybrid-beta-2026-11-09.md#recorrido-integrado-desde-el-archivo-original). S2a/S2b de calidad jurídica no cierran ese requisito; sus estados y gates permanecen.

El coordinador concede `done` únicamente con aceptación demostrada, revisión independiente registrada y referencia al commit probado. Para reabrir `blocked`: registrar diagnóstico, corrección propuesta y decisión explícita de reanudación del coordinador; nunca reinicio automático. Si cambia alcance o se requiere una autorización nueva, esa parte espera su autorización. H4 y H5 pueden avanzar en paralelo tras H3V con responsables/archivos separados; H6 conserva una puerta prudente de preparación del producto, no una afirmación de dependencia técnica inevitable.

| ID | Tarea | Depende de | Estado | Responsable / rama |
| --- | --- | --- | --- | --- |
| H1 | Contrato y transporte simulado | — | done | Codex / `docs/hybrid-psf-development-loop` (PR #1, `a99bb1f`) |
| H2 | Política de salida y auditoría sin texto | H1 | done | Codex coordina; worker `implement_h2` / `docs/hybrid-psf-development-loop` |
| H3 | Sustituciones y restitución por ámbito | H2 | done | Codex coordina; worker `implement_h2` / `docs/hybrid-psf-development-loop` |
| H3V | Primera rebanada vertical sin red | H3 | done | Codex/Sol; worker `build_h3v` / `docs/hybrid-psf-development-loop` |
| H4 | Detector local y examen independiente | H3V | in-progress | H4a done; H4b parcial, baseline medido no elegible |
| H4a | Protocolo, corpus independiente y evaluador | H3V | done | Codex/Sol y worker Sol; autor retenido independiente / misma rama PR #1 |
| H4b | Detector real y medición | H4a, contratos H5a | in-progress | Baseline H4b.1 evaluado y fallido; modelo semántico/nuevo examen pendientes |
| H4b.1 | Reglas/procedencia reales, integración y primer examen | H4a, H5a | done | Worker Sol `build_detector_h4b`, coordinador/revisor Sol / PR #1, `ba763a2`; resultado no elegible |
| H5 | Almacenamiento cifrado y restauración | H3V | in-progress | H5a done; H5b parcial con spike nativo, recuperación pendiente |
| H5a | Inventario, ADR de bóveda y protocolo de recuperación | H3V | done | Codex/Sol; worker Sol `inventory_h5a` / PR #1, `ea6a6df` |
| H5b | Bóveda cifrada, migración y recuperación real | H5a | in-progress | Se inicia solo H5b.1; ciclo privado/migración posteriores pendientes |
| H5b.1 | Spike SQLCipher nativo y contrato/paridad DAO | H5a | in-progress | Viabilidad H5b.1a revisada; paridad completa pendiente (gate false) |
| H5b.1a | Viabilidad nativa y contrato de dominio parcial | H5a | done | Worker Astra `build_vault_h5b1`, revisor Sol / PR #1, `c0f3733`; paridad false |
| M1 | Candidatos LLM para tareas estrictamente públicas y protocolo de selección | H3V, H4a | done | Codex/Sol y worker Sol `public_candidates_tools` / PR #1, `b482f13`; preparación de H6/H8, sin desbloquearlos |
| H6 | Adaptador OpenRouter apagado y selección por tarea | H4, H5 | todo | Sin asignar |
| H7 | Integración de todas las rutas de generación y UI | H6 | todo | Sin asignar |
| H8 | Comparación ciega pública/sintética | H7, acceso y presupuesto autorizados | todo | Sin asignar |
| H9 | Respaldo externo y colaboración | Piloto y decisión de almacenamiento compartido | todo | Sin asignar |
| B0 | Prueba interna cofounders y beta híbrida | Gates H3-H7 y paquetes por OS | todo | Landing tres tarjetas; sólo ARM0.4.3 anterior real; Intel/Windows sinURL, sin prueba Lorenzo/Pedro |
| C-R0 | Investigación SF de adquisición jurídica nacional para demo web | Dirección del dueño, fuentes públicas | done | `67e3d3b`; investigador/revisor Sol, tres respuestas SF; límites/precisiones integrados |
| C0 | Registro y planes cerrados de adquisición pública | C-R0 revisada | done | `9ac5bd8`; 15 tests, revisión independiente; 10 URLs aprobadas y 20 plazas pendientes |
| C1 | Piloto público de 30 plazas | C0 y política/rutas por fuente | in-progress | C1a federal completada; faltan 16 documentos estatales y 4 judiciales concretos |
| C1a | Fábrica, evidencia y primer lote federal | Plan C0 válido | done | `e6dab95`; 10/10 PDFs, 8.086 segmentos en cuarentena, offline 10 cachés/0 solicitudes; ver QA C0-C1a |
| C1b | Completar selección y adquisición estatal/judicial | Revisar fuentes/rutas/robots y permisos | in-progress | Dos PDF NL de investigación capturados;20 plazas del piloto aún sin aprobación, sin cobertura nacional |
| S-R0 | Investigación GitHub de skills/repos para trabajo jurídico en nube México | Pedido del dueño, lectura pública | done | `80aef8d`; Codex + investigador Sol, 13 repos; revisor Sol APPROVE documental por muestra |
| S1 | Especificar/adaptar investigación y revisión contractual MX | S-R0 revisada, licencias/dependencias resueltas por módulo | done | `fcce90d`; dos skills/contratos offline, 12 fixtures, 605/605 y build; revisor Sol APPROVE |
| S2 | Comparación pareada de skills y modelos por tarea | S1, aceptación independiente, acceso/presupuesto de evaluación | in-progress | S2a piloto SF gratuito autorizado; S2b evaluación ampliada/rutas producto y abogados pendiente |
| S2a | Piloto pareado: V1 cancelado y V2 de seis casos independientes | S1 congelada, Free Groq vigente y arnés revisado | done | V2 24/24; 5 contratos válidos, 1 pase conjunto con reserva, 14 truncadas; 631/631+build; revisión ciega SF cerrada, abogado pendiente |
| S2b | Formato/budget medidos, aceptación ampliada y revisión profesional | Resultados S2a, aceptación nueva y presupuesto/rutas propias | in-progress | Probe parcial preservado y anclas offline; nuevo examen y abogados pendientes, sin ganador producto |
| F0 | Contrato web/componente local, formatos y aceptación | Arquitectura y contratos actuales | done | 4ba5262; ADR0004 y guard HTTP58/58, APPROVE; no demo privada integrada |
| H4b.2a | Contrato operativo v2 y protocolo de examen nuevo | H4a/H5a; F0 incorporado en el corte | done | 4ba5262; v2+manifiesto/splits, freeze previo a autor300; revisiónSolAPPROVE, sin calidad nueva evaluada |
| H5b.1b.1 | Primer dominio atómico de paridad | Matriz H5b.1a; F0.1 decidido antes de implementar | done | 4ba5262; recordatorios/auditoría atómicos, 17nativas/13Node, reviewSolAPPROVE; paridad3core/9parciales/20ausentes |
| H4b.2b | Candidato pequeño local más reglas | H4b.2a/F0, modelo/licencia/digest y límites | in-progress | 8152424: ONNX optativo dev12 TP2/FP16/FN1, todos bloqueados; inadecuado. Guardas runner95f4f48 revisadas; sin heldout puntuado |
| H4b.2c | Nuevo examen independiente y medición única | Protocolo/corpus/candidato congelados y revisión | in-progress | 8152424: corpus300 y anotación revisados, manifiesto válido; falta candidato elegible/freeze y única medición |
| S2b.1 | Diagnóstico de formato nativo y presupuesto común | S2a, acceso/budget propios antes de live | in-progress | 31f31ad: 3/8POST, HTTP400 detiene sin retry; replay/revisiónAPPROVE, sin pares completos ni ganador |
| D0 | Landing con tres opciones de descarga | Pedido10nov, catálogo de activos reales | done | d4fc1de; 4Node/browserQA5anchos y reviewAPPROVE, previewREADY; sólo ARM0.4.3real, Intel/Win pendientes |
| D1 | Portabilidad y empaquetado por target | Canal F0, manifiestos/runtime específicos | in-progress | D1a/b revisados; colector Windows falla en CI real, sin instaladores Intel/Windows |
| H5b.1b.2 | Propuestas/logs nativos atómicos | H5b.1b.1 | done | 801b62a; cierre schema4 conjunto36nativas/29Node revisados, sin efectos de aprobación |
| H5b.1b.3 | Horas/tarifas/resolución nativas | H5b.1b.2 | done | 801b62a;36nativas/29Node+3probes revisorSolAPPROVE, 3core27parciales2ausentes; sin puente/migración |
| S2b.1b | Compilador de citas con anclas opacas | S1 y diagnóstico S2a | done | 31f31ad; 13nuevas/31conS1 por builder/revisor, root combinado52; literalidad no entailment |
| D1a | Memoria de árbol de procesos Windows | D1 | done | 94e48c8; 12dirigidas, revisiónSolAPPROVE y controlMac; Windows físico/coste polling sinmedir |
| D1b | Staging y verificación explícitos por target | D1a/inventario runtimes | done | 6d00b78;11/11/reviewSolAPPROVE, inventariosSHA/stagingatómico/offline; sin buildreal/Windows habilitado |
| H4b.2b.3 | Ablation5vs3 etiquetas | H4b.2b/DEV3 independiente | done | 7bdc217;120dispatches, ambosinadecuados/todosbloqueados; reviewevidenciaAPPROVE, sinheldout |
| H4b.2b.4 | TokenNER compacto distinto | H4b.2b diagnóstico | done | ff0619b;13TP/41FP/35FN en60dev, no elegible; código/replay revisados, no producto |
| H4b.2b.4a | Causas acotadas con invariancia | H4b.2b.4/diagnóstico | done | faec790;60 salidas idénticas,26 fallos backend atribuidos,39 tests/review APPROVE; sin mejora de calidad |
| S2b.1c | Comparación literal/anclas | S2b.1a/S2b.1b | done | 51587ff;4/4JSON/S1/citas,2paresficción,16447tokens; no aceptación/ganador |
| C1b.1 | Fuentes estatales/judiciales candidatas | C0/C1a | done | 71ad54f;8 candidatos y12 sin selección, conflicto Jalisco/derechos pendientes; sin autorización general de adquisición |
| C1b.2 | Inspección HTML NL fija | C1b.1 | done | 4004c1f;17tests+3HTTP1583649B,2HTMLquarantine; PDFqueryrechazadas sinnormalizar |
| C1b.3 | Captura específica de2PDF NL | C1b.2/literalesexactos | done | 2165eed;17tests+3HTTP3001218B,2PDForiginalesquarantine; sinextract/rights/versionapproval |
| C1b.4 | Extracción offline NL con parser actual | C1b.3 | done | f032b35;619 páginas/102 registros,100 anómalos, Civil incompleto/Penal truncado; negativa preservada,15 tests y revisión |
| D1c | Primer smoke Windows real | D1a | done | b3fd346;CI42864129769FAILprimerCIM2020.85ms,0muestras; negativa conservada |
| D1d | Colector persistente optativo | D1c | in-progress | 7b37d96;tests/reviewAPPROVE, CI42865975268STARTUP_TIMEOUT10s, sinrendimientovalidado |
| D1e | Diagnóstico etapas Windows | D1d/2fallosreales | done | 9b77171;42868018670diagnosiscomplete, sinREAD_READY/CIM_START, no performancepass |
| D1f | Hipótesis de protocolo ASCII | D1e | done | 91fd4fa;31 tests/review27, CI42869183776 STARTUP_TIMEOUT10s; hipótesis sin mejora, negativa conservada |
| D1g | Diagnóstico entorno/autoload A/B | D1f/3 fallos | done | 7fb989e+b0d6830; CI42872682039 ambas TIMEOUT_LOOKUP_UTILITY,0 muestras;20,09s/cleanup correcto, auditoría independiente; causa exacta pendiente |
| H4b.2b.4b | Composición diagnóstica con prueba de contención | H4b.2b.4a | done | 23d0662;57 pruebas, revisión y60 replays,38 completos/22 bloqueados; sin score/egreso/elegibilidad, H4 abierto |
| H4b.2d | Repetir H3V con detector elegible real | H4b.2b/H4b.2c | todo | Gate del plan F1A; los experimentos TokenNER no cierran esta vertical |
| S2b.2a | Protocolo ampliado antes de autoría | S2a/S2b.1 | done | 77c4831;30 propuestos, denominadores/gates y revisión independiente; sin generación |
| S2b.2b | Datos nuevos y rúbricas propuestas | S2b.2a | done | 837cd20;30 casos/32 artículos/3 instrumentos/2 jurisdicciones, revisión Sol; S1 30, anclas29; abogados y sobre completo pendientes |
| C2a | Páginas estatales completas y candidatos | C1b.3/C1b.4 diagnóstico | done | 4d25180;619 páginas,3564 candidatos,13 repeticiones sin truncar;19 tests/reconstrucción independiente, cuarentena |
| C2b | Comparación independiente de fidelidad | C2a | done | ca2ccd8;24 páginas/48 comparaciones,45 normalizadas iguales/3 diferencias conservadas,6 renders vistos; revisión técnica, sin fidelidad integral aprobada |
| D1h | Consulta WMI directa aislada | D1g | done | c473fab/df8e855;CI42875919825,1 raíz40.656.896B/5,15s/cleanup0;59 tests y auditoría; no árbol/polling todavía |
| D1i | Colector de árbol WMI sin cmdlets | D1h | done | 467d7fd/e8e63ba;CI42878658531:arranque3551ms/4muestras237–248ms,una raíz48,1MB;73dirigidas/988global+build,reviewAPPROVE; no instaladores/8GB |
| C1b.5 | Doce plazas aún no investigadas | C1b.1 | done | 867d88b;8URLs/4sinselección,28operaciones declaradas;review documental,8llamadas reconstruidas/noatestadas,0adquisición |
| H5b.2a | Diseño de recuperación sintética cifrada | H5a/H5b.1 | done | 44b387a;18casos/R23,propiedad retenida en fallo,D0verificado;revisiónSol; no recuperación probada |
| H5b.2b | Recuperación nativa sintética de lectura | H5b.2a | in-progress | Primera subserie18 CI42904113430 PASS/review independiente; matriz24 y H5 completos abiertos |
| H4b.2b.5 | Preparación Nym multilingüe | H4b.2b.4b/diagnóstico | done | 20a8aa2;6files151MB/4HTTP verificadas,sin runtime;53Python/review;licenciarelease pendiente |
| H4b.2b.5a | Contrato runtime/tokenizer Nym | H4b.2b.5 | in-progress | f22b8a8/87172ea;5eventos reales/4tokenizaciones/0forwards, padreFAILEDcausaUNKNOWN;auditoríaofflinemetadatosparcialesAPPROVE,no postflight/RSScombinado;fix3d3d588/12tests+review;planinferencia622f08erevisado,sinautorizaciónejecución |
| H4b.2b.5b | Protocolo de inferencia Nym y testigos estructurales | H4b.2b.5a/auditoría parcial | done | 622f08e/04d5264;plan revisado y8testigos sintéticos sin gold/outputs;0forwards, no autorización de ejecución |
| H4b.2b.5c | Decoder nativo estricto Nym optativo | H4b.2b.5b | in-progress | a501868/19mocks+review;fuenteV1inactiva,8testigosactuales0NN/globalproofFALSE;mapping/egreso/producto inactivos |
| H4b.2b.5d | DEV Nym nuevo independiente | H4b.2b.5b | done | 5704b31;60casos/70entidades/revisiónsilver/0scores; examen300 intacto, sin autorización de ejecutar |
| H4b.2b.5e | Estructura Nym v1 medida | H4b.2b.5c | done | ebd1975;8testigos/1admitidoestructural/8bloqueadosNN/0forwards;440565760B tokenizer-only,review; no calidad |
| H4b.2b.5f | Prueba de contenido original v2 | H4b.2b.5e/fuentes fijadas | done-with-failure | 36mocks PASS; ejecución real FAIL SAMPLE_GAP143.671ms durante inventario/0testigos/0NN; evidencia preservada, no calidad |
| H5b.2b.1 | Primer subconjunto recuperación sintética de lectura | H5b.2b/diagnóstico aislado | done | CI42904113430:18/18 invocaciones,11.268s,R23a4/R23b3,reviewSol; picos separados padre296222720B/hijo291110912B; no matriz24/H5 completo |
| H5b.2c | Mapas H3 seudonimizados tipados/versionados | H5b.2b.1 y contrato H3 | todo | Contrato y límites en vault-next-native-slices; código/VM/review pendientes |
| H5b.2d | Aprobación atómica de propuesta de recordatorio | H5b.1b.2 y H5b.2c | todo | Una transacción/CAS/idempotencia; revisión/VM pendientes |
| H4b.2b.5g | Inventario preparado Nym separado | H4b.2b.5f | done | 198804filas/13.533.851B, auditoría independiente total; asset de construcción, no inferencia ni20ms runtime |
| H4b.2b.5h | Decoder V3 streaming | H4b.2b.5g | in-progress | Astra fuente+26mocks; revisión independiente agotó cuota, sin carga real/forward/score/activación |
| D1k | Diagnóstico bootstrap/identidad de descendientes | D1j tres fallos | done-with-gap | CI42901408180 cierre6/3extras desconocidos; cleanup sólo3conocidos; sin aceptación rendimiento |
| D1l | Clasificación acotada de extras Windows | D1k | done-with-gap | CI42928786842: cierre6/3extras con ruta exacta sistema conhost.exe; identidad/cleanup extra sin probar, rendimiento/instalador bloqueados; reviewfuente+17tests |
| D2 | Verificar/publicar activos y activar enlaces por plataforma | D1, evidencias de distribución/alcance | todo | Versiones/hashes/bytes/URLs reales; no presentar release anterior como híbrida |
| N0 | Investigación y shortlist de nombre alternativo | Pedido del dueño | in-progress | Cribado web inicial; Folimbra/Cautria/Citeroa candidatos sin disponibilidad comprobada |
| N1 | Validación del finalista y decisión de nombre | N0, evidencia IMPI/fonética/dominios y elección del dueño | todo | Sin búsquedas por candidato en bases oficiales, registro o compra todavía |
| N2 | Migración de identidad y compatibilidad | Nombre elegido tras N1 | todo | Sin replace global, cambios de datos/IDs o despliegue automático |

**Corrección de IDs (10 noviembre):** el plan reserva `H4b.2d` para repetir H3V. Dos informes históricos de Rampart usaron por error ese ID y `H4b.2d.1`. Se preservan sus bytes/hashes; sus alias canónicos en este tablero son `H4b.2b.4` y `H4b.2b.4a`. Ningún experimento de detector cierra la vertical pendiente. El candidato nuevo usa `H4b.2b.4b`.

**Checkpoint b0d6830:** suite root932/932 y build TypeScript/Vite OK, antes del candidato de composición v2 en construcción. QA dirigido y aceptación profesional/física se registran por separado.

## H1 — Contrato y transporte simulado

- Archivos asignados a Codex: `server/inference-mock.mjs`, `tests/inference-mock.test.mjs`, `tests/inference.test.mjs`, `docs/architecture/inference-contract-v1.md`, `docs/qa/hybrid-H1-2026-11-09.md`; backlog/memoria por el coordinador. Se añade la prueba del motor existente para comprobar compatibilidad contra ambos proveedores con el mismo conjunto de entradas; no se modifica producción. Se reutiliza la rama del PR #1 por pedido explícito de subir allí el avance.
- Leer contrato real de `server/inference.mjs` y consumidores antes de fijar la API. Preservar `outputContract`, estado, inicialización, generación asíncrona y parada según los usos actuales; no inventar compatibilidad.
- Definir además interfaces sustituibles de detector, correspondencias/almacenamiento y selección de ruta; ejemplos contractuales sintéticos de restauración, reversión y ámbito. Documentarlas junto a las pruebas antes de acoplar implementaciones concretas.
- Aceptación: respuesta por chunks, cancelación antes/durante generación, validación de entradas y copia profunda de solicitudes. Cambiar el objeto original después del envío no cambia la captura. Capturar tanto la estructura como los bytes serializados que habría recibido un transporte remoto, con un formato determinista documentado.
- Sin red, llaves ni cambios del proveedor activo. Pruebas con entradas inválidas y abortos; no registrar prompts de usuarios reales.
- Revisión: subagente independiente `review_h1`, contexto separado y solo lectura. Hallazgo P2 de fixtures dispersos corregido con regresiones y vuelto a comprobar; veredicto final `APPROVE`. Commit probado: `a99bb1f`. Evidencia: [reporte H1](../qa/hybrid-H1-2026-11-09.md), dirigidas 34/34, suite 437/437 y build OK. El coordinador marca `done`; H2 queda desbloqueada, todavía sin iniciar.

## H2 — Política de salida y auditoría

- Archivos asignados a `implement_h2`: `server/egress-policy.mjs`, `tests/egress-policy.test.mjs`, `tests/egress-canary.test.mjs`; si hace falta compartir serialización exacta, `server/inference-mock.mjs` y un módulo JSON de apoyo. Coordinador: contrato, QA, backlog y memoria. Rama del PR #1 reutilizada por pedido del dueño. Astra se reserva aquí al código crítico del límite de privacidad; la revisión independiente usará una ruta de menor costo. Objetivo: control local que falle cerrado antes de invocar el simulador, sin integración de producción.
- Aceptación: denegar por defecto; exigir despacho, asunto, hilo y destino autorizados. Política fuera del prompt. Revalidar revocación por operación y rechazar herramientas/destinos no permitidos. Contexto sin clasificación fiable no sale.
- Pruebas: solicitud completa capturada con dos despachos y dos asuntos sintéticos, historial y metadatos; errores y cancelación no producen envíos alternos. Auditoría solo con categorías, ámbito, destino, fecha, resultado y versión de política, sin texto ni secretos.
- Este paso no presume que una lista de canarios detecte todo dato sensible.
- Revisión independiente `review_h2` (`gpt-6.1-sol`): `APPROVE`, confirmada tras dos regresiones finales; 50/50 dirigidas. Coordinador: 453/453 suite y build OK. [Evidencia H2](../qa/hybrid-H2-2026-11-09.md). Aceptación verificada y commit probado `47d0478`; el coordinador concede `done`. H3 desbloqueada.

## H3 — Sustituciones y restitución

- Archivos asignados al worker `implement_h2` (segunda rebanada H3): `server/privacy/pseudonyms.mjs`, `tests/privacy-pseudonyms.test.mjs`. Coordinador: contrato, QA, backlog y memoria; misma rama PR #1. Astra continúa exclusivamente con código crítico de aislamiento/restitución. Revisión independiente separada con Sol. Objetivo: sustituciones sintéticas por asunto, snapshots solo en memoria y restitución estricta, sin cifrado ni integración de producto.
- Aceptación: entidades declaradas de fixtures se sustituyen con marcadores estables dentro del asunto y aislados entre ámbitos. Restituir solo marcadores conocidos; no reemplazar texto libre ni aceptar marcadores de otro asunto. Pruebas de colisión, reinicio de sesión simulado, Unicode y marcador dividido entre chunks.
- Mapa inicialmente en memoria sintética; no persistir correspondencias privadas en claro. Las respuestas restituidas se vuelven a proteger en los seguimientos. Mantener cita/procedencia de la fuente original por separado de su representación enviada.
- Revisión independiente `review_h2` (`gpt-6.1-sol`): `APPROVE` tras reproducir/corregir reutilización de identidad desde snapshot antiguo; comprobó 41/41 (H3/H2/mock). Worker: 14/14 H3 y 64/64 combinadas; coordinador: 467/467 suite y build OK. [Evidencia H3](../qa/hybrid-H3-2026-11-09.md). Aceptación verificada y commit probado `08d7429`; el coordinador concede `done`. H3V desbloqueada, sin iniciar: se alcanzó el máximo de dos tareas de la sesión.

## H3V — Primera rebanada vertical sin red

- Archivos asignados al worker Sol `build_h3v`: `tests/hybrid-offline-flow.test.mjs`, `tests/fixtures/hybrid/synthetic.mjs`. Coordinador: `docs/qa/hybrid-H3V-2026-11-09.md`, backlog y memoria; misma rama PR #1 por pedido del dueño. Cambios de interfaces solo si H1–H3 muestran un defecto y tras registrar el motivo. Aceptación ampliada por el plan vigente: bloqueo de chats legacy sin ámbito, versiones/concurrencia e interrupciones por fase.
- Aceptación: componer recuperación sintética por ámbito, sustitución de entidades declaradas, puerta de salida, proveedor simulado, validación y restitución. Capturar los bytes completos, comprobar aislamiento y que una respuesta restituida se vuelva a proteger en el siguiente turno. No usar la red ni persistencia real.
- Reejecutar esta prueba contractual al introducir H4, H5 y H6, sustituyendo sus dobles de prueba. H7 cubre después la matriz completa de llamadas del producto; no será el primer contacto entre componentes.
- Revisión independiente `review_h3v` (Sol): `APPROVE` tras corregir categoría/procedencia de historial y componer el validador real después de restitución; 14/14 verticales, 87/87 dirigidas. Coordinador: 481/481 suite y build OK. [Evidencia H3V](../qa/hybrid-H3V-2026-11-09.md). Commit probado `e7b55b5`; coordinador concede `done`. H4/H5 desbloqueadas. Segunda y última subentrega elegida: H4a.

## H4 — Detector local medido

### H4a cerrada en esta sesión

- Coordinador: `docs/architecture/privacy-classification-v1.md`, `eval/privacy/protocol.json`, `eval/privacy/README.md`, `eval/privacy/manifest.json`, `scripts/measure-privacy-baseline.mjs`, QA/backlog/memoria. Worker Sol: `scripts/eval-privacy.mjs`, `tests/privacy-evaluation.test.mjs`, `eval/privacy/dev.jsonl`. Autor Sol independiente: `eval/privacy/heldout.jsonl` y notas de procedencia, sin leer desarrollo ni recibir resultados de candidato. Revisor independiente sin autoría en esos archivos. No se implementa detector ni clasificación de producción.
- Se usa `privacy-evaluation.test.mjs` en H4a para probar validación y puntuación del evaluador; `privacy-detector.test.mjs` y `privacy-provenance.test.mjs` se reservan a H4b, evitando tests vacíos de módulos inexistentes. Se añade script de medición base porque el plan exige una referencia reproducible temprana.
- La medición base distingue Node empaquetado + SQLite + UI web Chromium de Tauri nativo y equipo físico 8 GB; esos requisitos siguen abiertos y no se promociona candidato por esa referencia.

- Evidencia H4a: [QA](../qa/hybrid-H4a-2026-11-09.md), [contrato](../architecture/privacy-classification-v1.md), manifiesto/protocolo/guía versionados. 36 casos dev y 300 retenidos de autor separado; ningún candidato puntuado. Coordinador: 16/16 evaluador, 60/60 dirigidas, 497/497 suite y build OK. Revisor Sol: 103/103 dirigidas y `APPROVE`. Commit probado `46b740a`; coordinador concede `done` a H4a. H4 completo y H4b siguen pendientes de implementación/evaluación real; H6 no se desbloquea. Se alcanzó el máximo de dos subentregas (H3V/H4a); no hay loop desatendido.

### H4b parcial: baseline no elegible

- Archivos propuestos: `server/privacy/detector.mjs`, `tests/privacy-detector.test.mjs`, `eval/privacy/README.md`, `eval/privacy/cases.jsonl`, `scripts/eval-privacy.mjs`.
- Aceptación: pipeline local de reglas/detector con fallos que bloqueen salida; RFC/CURP/CLABE, nombres, relaciones, correos/domicilios e identificadores judiciales, incluyendo datos en historial/metadatos. Formatos no soportados se rechazan para envío.
- Separar desarrollo y examen retenido. Reportar por categoría omisiones, falsos positivos y hechos reidentificables; no solo promedio. Fijar con el coordinador los criterios del piloto antes de observar el examen y reservar revisión humana para ambigüedad. No equiparar ausencia de canarios con anonimización garantizada.
- Medir tiempo/memoria del detector real, sin descargar o cargar automáticamente modelos grandes. 24 GB no validan el objetivo físico de 8 GB. Un modelo conversacional instalado no se considera detector evaluado.
- Primer corte H4b.1 implementado: reglas locales, registro de procedencia inmutable, superficies JSON completas y tests reales H1/H2/H3. [QA H4b.1](../qa/hybrid-H4b-2026-11-09.md), [freeze](../qa/privacy-detector-freeze-2026-11-09.json), [métricas/predicciones](../qa/privacy-detector-heldout-2026-11-09.json) y [recursos](../qa/privacy-detector-resources-2026-11-09.json). Revisor Sol: 40/40 dirigidas y APPROVE para código baseline/una evaluación; no aprueba calidad.
- Examen una sola vez: 300 casos, precisión exacta micro 31,52 %, recobrado 56,38 %, 130 omisiones y 365 FP; gate FAILED. 8/24 bloqueos; cuatro motivos solo existen en gold, sin estímulo operativo en v1 y sin inyección de etiquetas. Corpus/protocolo v1 se conservan, retirados de futuras afinaciones/selecciones. Corregir entrada operativa en v2 y crear examen independiente antes de otro candidato; no bajar umbrales ni ajustar al examen fallido.
- Recursos pareados: mismo código/assets, 30 muestras/mode y 3 procesos fríos candidato; p95 1,34 ms para reglas, app+SQLite+Chromium+reglas pico 605.306.880 bytes sobre 24 GiB, no semántico/nativo/8 GB. Coordinador 552/552 suite y build OK. H4b.1 es cierre de implementación/evidencia fallida, no de requisito H4b; H6 no se desbloquea.

## H5 — Cifrado recuperable

### H5a cerrada en esta sesión

- Worker Sol `inventory_h5a`: `docs/architecture/private-data-inventory.md`, `docs/qa/vault-test-protocol.md`, `scripts/qa-vault-inventory.mjs` y reporte sintético `docs/qa/vault-inventory-2026-11-09.json`. Coordinador: `docs/architecture/adr/0003-private-vault.md`, QA, backlog/memoria. Se usa ADR 0003 para no colisionar con los ADR 0002 existentes. Sin cambios al almacén real, instalación global ni criptografía nueva. El ADR decide el contrato para H5b; no presenta cifrado ya implementado.
- Base de memoria H4a reutilizable porque no cambió producción; Tauri nativo y máquina física de 8 GB siguen sin validación.
- Evidencia: [QA H5a](../qa/hybrid-H5a-2026-11-09.md). Control V00: 12/12 comprobaciones, 7/7 exposiciones esperadas de texto claro y 37/37 hashes fuente. Revisor independiente Sol `review_h5a_m1`: **APPROVE**. Commit probado `ea6a6df`; coordinador concede `done` a H5a, no H5. V01–V24, cifrado, migración y recuperación siguen sin implementar. Suite conjunta H5a/M1: paralela 511/512 por STT intermitente preexistente, aislado STT 5/5 y serie completa 512/512; build OK. H4b queda habilitada por contratos, H5b por ADR; ninguna se inicia al cerrar estas dos subentregas.

### H5b parcial: viabilidad nativa

- Archivos iniciales a inspeccionar: `server/store.mjs`, `server/main.mjs`, `src-tauri/src/`. Crear contrato de migración y lista definitiva de archivos antes de implementar; elegir una solución mantenida y registrar la decisión, no criptografía propia.
- Aceptación: proteger originales, fragmentos, índices, correspondencias y temporales. Migración reversible desde copia sintética, bloqueo, custodia de claves y recuperación fuera del equipo perdido. Restauración real de una copia con evidencia.
- Prueba negativa: revisar artefactos en disco tras bloqueo/fallo; permisos de archivos no cuentan como cifrado. No migrar ni borrar la base de usuarios de esta Mac.
- Corte H5b.1a: crate aislado `crates/lex-vault/`, rusqlite 0.41.1/SQLCipher real 4.19.0, SQLite 3.53.4/CommonCrypto/FTS5/TEMP_STORE=2/arm64. Worker Astra: build/fmt y 9/9 nativas, 6/6 Node. Revisor Sol independiente repitió 9/9 nativas offline +6/6 Node: APPROVE solo viabilidad. [QA H5b.1a](../qa/hybrid-H5b1-2026-11-09.md) y README del crate.
- Contrato Node en memoria, sin puente/persistencia cifrada. Matriz 32 APIs: 3 core, 5 parciales, 24 pendientes, `VAULT_PARITY_COMPLETE=false`. H5b.1 permanece parcial hasta paridad y frontera IPC; custodia/recuperación/temporales/migración pertenecen a H5b.2/.3. El almacén real sigue sin cifrado.
- Las dos subentregas de este loop son H4b.1 y H5b.1a: se acota por evidencia y paridad explícita, sin rebajar aceptación de padres. Commits probados `ba763a2` (H4b.1) y `c0f3733` (H5b.1a), coordinador concede done a estos cortes con revisión independiente y 552/552 suite/build; los padres siguen sin cerrar. No tercera tarea ni proceso desatendido.

## H6 — Adaptador y selección por tarea

- Archivos propuestos: `server/providers/openrouter.mjs`, `server/providers/task-router.mjs`, `tests/openrouter-provider.test.mjs`, `tests/task-router.test.mjs`.
- Aceptación offline: transporte inyectable, ruta remota apagada por defecto, modelo y endpoint permitidos explícitos, sin fallbacks silenciosos, credencial fuera de la UI. Verificar contrato con documentación oficial vigente al implementar.
- Simular errores de cuota, timeout, fallo de privacidad y cancelación. La lista permitida y límites se comprueban antes de enviar. Separar tarifa máxima por token de presupuesto total; los reintentos consumen presupuesto y requieren la misma política.
- Proponer dos perfiles remotos; no declarar modelos ganadores sin H8. No reutilizar claves/configuración del PSF de desarrollo.
- Revisión/commit/evidencia: pendientes.

## H7 — Integración completa

- Archivos a inspeccionar/asignar: `server/main.mjs`, `server/service.mjs`, `server/conversation.mjs`, `server/proactive-drafts.mjs`, `server/skills.mjs` y componentes de ajustes/chat en `src/`; fijar lista exacta antes de editar.
- Aceptación: todas las generaciones pasan por la puerta autorizada; historial, fuentes y herramientas respetan el ámbito. Conversación natural, fuentes oficiales, borradores y horas se conservan. La UI presenta LEX AI; destinos y alcance se explican en ajustes/revisión de salida cuando sean relevantes.
- Desconexión o cuota agotada conserva archivos/búsqueda/horas y explica el estado. Sin activar un modelo alternativo local/remoto ni ampliar contexto silenciosamente. Revocación efectiva y modo solo local probados.
- Revisión/commit/evidencia: pendientes.

## H8 — Comparación y piloto

- Archivos propuestos: `eval/hybrid/README.md`, conjunto independiente público/sintético y reporte en `docs/qa/` (nombrar al definir protocolo).
- Aceptación: comparación ciega y pareada de dos rutas con las mismas tareas; calidad conversacional, citas, jurisdicción, abstención, preservación de hechos, costo por respuesta aceptada y latencia. Registrar modelo/proveedor efectivo y tratamiento aplicable. No usar el examen para entrenar.
- Llamadas reales solo con acceso autorizado y presupuesto explícito si existe cobro. Un resultado técnico no autoriza datos de clientes ni activa producción. Registrar qué falta de validación profesional y de 8 GB.
- Revisión/commit/evidencia: pendientes.

## H9 — Respaldo y trabajo compartido

- Definir después del piloto. Copia consistente cifrada a disco externo o Drive y restauración; no abrir una SQLite activa desde varias computadoras mediante sincronización de carpetas.
- El servicio compartido con permisos y concurrencia es otro frente. Su arquitectura y archivos requieren una decisión posterior; no está implícito en la selección de una carpeta del director.
- Revisión/commit/evidencia: pendientes.

## M1 — Selección preliminar de LLM públicos (dirección del dueño)

- Encargo añadido por el dueño al continuar: determinar modelos para agentes sin información confidencial. Primera entrega: inventario real de permisos por habilidad, definición de entrada pública verificada, catálogo oficial vigente de modelos/endpoints/precios y lista corta por tarea, configuración candidata inactiva y protocolo comparativo público/sintético. Ningún rol se considera público por su nombre; instrucciones, consulta, historial, herramientas y metadatos también cuentan.
- Archivos del coordinador: `docs/architecture/public-agent-model-selection-2026-11-09.md`, `resources/public-agent-candidates.json`, `eval/public-agents/catalog-snapshot-2026-11-09.json`, `eval/public-agents/README.md`, `eval/public-agents/cases.jsonl`, `scripts/check-public-agent-candidates.mjs`, `tests/public-agent-candidates.test.mjs`, QA y memoria. Sin llamadas pagadas, activación de rutas ni reutilización de claves PSF en producto. H6/H8 conservan dependencias y autorizaciones.
- Sin Claude/Astra en esta entrega. Dos workers Sol con propiedad separada y revisor Sol independiente; Kimi aportó una consulta pública/sintética (29.495 ms, modelo efectivo/tokens no atestados).
- Evidencia: [QA M1](../qa/public-agent-model-selection-2026-11-09.md). Checker offline coherente e inactivo, 15/15 tests, 28 casos de preparación (14/perfil); no generaciones, calidad/coste real/pin/retención no evaluados. Revisor independiente `review_h5a_m1`: **APPROVE**. Commit probado `b482f13`; coordinador concede `done` a preparación M1. Suite/build conjuntos registrados en H5a y QA; H6/H8 no se desbloquean. Se alcanzó el máximo de dos entregas (H5a/M1); no hay proceso desatendido.


## Encargos de continuación H4b / H5b.1

- Se reutiliza rama `docs/hybrid-psf-development-loop` del PR #1. Máximo dos entregas en este loop; no iniciar H6 por inferencia. No se modifica el motor activo.
- Worker Sol `build_detector_h4b`: `server/privacy/detector.mjs`, `server/privacy/provenance.mjs`, `tests/privacy-detector.test.mjs`, `tests/privacy-provenance.test.mjs`, nuevo `tests/privacy-detector-integration.test.mjs`. Reglas reales + procedencia/rangos comprobados, bloqueo de incertidumbre, composición H2/H3. No leer heldout ni modificar protocolo/guía/umbrales. Coordinador: harness de evaluación/medición, QA y memoria. Congelar candidato antes de una evaluación retenida independiente; fallar métricas no se convierte en pase técnico.
- Worker Astra `build_vault_h5b1`: crate aislado `crates/lex-vault/` (Cargo.toml/lock, src, tests, README), `server/privacy/vault-dao-contract.mjs` y `tests/vault-dao-contract.test.mjs`. Código nativo crítico SQLCipher con API de dominio acotada, fixtures sintéticos, pruebas de claves/cierre/FTS/transacciones/scope; inventario explícito de paridad, sin fingir cubrir funciones aún no portadas. Artefactos de compilación solo en `artifacts/`, no cambios a Tauri/almacén real ni Keychain. El toolchain existe en `~/.cargo/bin`, no estaba en PATH. Bibliotecas oficiales/versiones del ADR verificadas al compilar.
- Coordinador conserva backlog, docs/agents y reportes QA; revisor independiente Sol separado inspecciona ambos cambios antes de cierre. No compartir archivos entre workers ni revertir trabajo ajeno.


## B0 — Feedback temprano de cofounders abogados

El dueño solicita involucrar a Lorenzo y Pedro; confirma mínimo 8 GB y cómputo local mínimo dedicado a detector entrenado/protección, con razonamiento remoto. [Guion](../qa/cofounder-hybrid-beta-2026-11-09.md) preparado, no ejecutado ni enviado. Evaluación pública/sintética en banco separado puede preparar calidad antes de bóveda completa, pero requiere acceso/budget autorizados y no representa producto privado integrado. H6 conserva sus dependencias. La beta integrada necesita H4/H5/H6/H7 y paquete verificable; datos reales requieren H8b. Sistemas de ambos pendientes; corregir versiones/onboarding y comprobar instalación limpia antes de entrega. No se afirma participación o aprobación de los cofounders.


## C-R0 / C0–C5 — Corpus público antes de la demo web

El dueño confirma referencia Luthor y solicita Claude/Gemini/Kimi/Cursor, Perplexity por OpenRouter si disponible. Excepción Claude limitada a esta investigación, sin compras. [Síntesis y plan C0–C5](../research/mexican-legal-corpus-sf-2026-11-09.md), [nueve herramientas y tres repos mexicanos](../research/legal-corpus-tools-2026-11-09.md), [mapa descubierto de 32 entidades](../research/mexican-legal-source-map-2026-11-09.json) y [participación real](../research/legal-corpus-sf-participation-2026-11-09.json).

La investigación descubre canales oficiales (incluido SIDOF documentado) y propone Crawlee + descargador existente + Playwright selectivo, extracción nativa/OCRmyPDF/Docling en fábrica pública separada. No corpus masivo, 32 portales probados o vigencia validada; no activar infraestructura/proveedor ni tocar datos privados. Ese fue el encargo de investigación; la construcción posterior C0/C1a se registra abajo con versiones/cobertura explícitas. Biblioteca pública central para web no autoriza enviar consultas privadas sin preparación/política. B0 se prioriza como demo web; no bloquear ese canal por notarización de escritorio. H4/H5/H6 conservan puertas para privado.


Cierre C-R0: commit `67e3d3b`, revisión documental independiente favorable y precisiones de presupuesto/H6/cachés opcionales incorporadas. JSON/enlaces y snapshot SHA verificados; 32 entidades únicas, 33 enlaces legislativos, 32 gacetas, cero textos legales adquiridos y cero portales estatales probados. Gemini/Kimi/Cursor aportaron una respuesta cada uno; Claude un timeout sin respuesta y Perplexity cero generaciones por falta de ruta elegible. No suite de producto repetida por documentos. C0/C1 conserva permisos/rutas pendientes; C-R0 done no significa corpus nacional o vigencia validada.


## Encargo de construcción C0/C1

Dirección del dueño: empezar pruebas/fábrica de adquisición; reafirma local para sustitución/mapa/restitución y nube para trabajo pesado. La fábrica pública es un worker/CLI fuera del runtime del cliente, ejecutable en infraestructura de procesamiento; el piloto se mide en desarrollo sin desplegar/comprar nube nueva. No cambiar motor local activo por inferencia remota sin sus gates/acceso/presupuesto.

- Worker Sol `build_corpus_registry`: `server/corpus/source-registry.mjs`, `tests/corpus-source-registry.test.mjs`. Registro confiable de fuentes/documentos y plan serializable cerrado, rechazo de privados/fuentes pendientes/URLs no aprobadas y presupuestos/versiones vinculados por hash.
- Worker Sol `build_public_factory`: `server/corpus/acquisition.mjs`, `scripts/legal-acquisition.mjs`, `tests/corpus-acquisition.test.mjs`. Reutiliza descargador/parser existentes, sin ampliar allowlist de producción; límites globales de solicitudes/bytes/tiempo, recibo de procedencia, snapshots/versiones/extracción en cuarentena y repetición idempotente offline. Sin entrenamiento/export de datasets, OCR/modelos descargados o publicación automática.
- Coordinador: `resources/legal-acquisition-pilot.json`, `docs/architecture/public-corpus-factory-v1.md`, QA/script de medición si hace falta, instrucciones/backlog/memoria. Revisor Sol independiente solo lectura; sin tocar archivos de los workers. No cambios a `server/legal-sync.mjs` o `legal-library.mjs` sin hallazgo y ownership explícito. Máximo dos entregas en este loop, C0/C1; fuentes bloqueadas permanecen pendientes, sin evasión ni sustitución silenciosa.


## Cierre de construcción C0/C1a

C0 `9ac5bd8` entrega registro confiable/planes cerrados; C1a `e6dab95` entrega worker/CLI público sin dependencia nueva y primer lote federal real. [QA y comandos](../qa/public-acquisition-C0-C1a-2026-11-09.md), [métricas/hashes](../qa/public-acquisition-C0-C1a-2026-11-09.json). Fuente Diputados, 10 PDFs de 2.652 páginas, 8.086 segmentos candidatos; 1.400 con anomalías y 4.175 con notas editoriales. Todos quedan en cuarentena, sin publicación/indexación o validación de vigencia. El parser todavía no conserva transitorios/historia completa como unidades consultables; originales íntegros preservados.

Revisión final live: 20 solicitudes, 23.803.914 bytes decodificados, 38.391 ms; RSS máximo observado 304.349.184 bytes en Mac de desarrollo de 24 GiB, sin validación cliente/8 GB. Offline: 10 cachés, 0 solicitudes/bytes, 79 ms y 31 archivos de integridad idénticos. Primer ensayo preservado por separado y repetición final tras añadir recibos MIME; dos ensayos no cuentan como 20 leyes únicas. Suite inicial 586/587 por nueva aserción de reloj demasiado estricta; test corregido con reloj simulado determinista, suite final 587/587 y build OK. Revisión Sol independiente y QA enlazada. SF: dos builders Sol y un revisor Sol, sin Astra ni generaciones externas nuevas; tokens/cuotas no expuestos.

Se alcanzan dos cortes: C0 y C1a. **C1 global sigue parcial**, con 20 plazas estatales/judiciales pendientes sin URL y C2/C3 de fidelidad/transitorios/OCR abiertos. Siguiente: C1b y aceptación textual C2; C4 demo/citas/revisión de Lorenzo/Pedro después. No nueva infraestructura, coste, envío de clientes o motor remoto activado; H4b/H5/H6 privados siguen abiertos. Local prepara privacidad y restituye resultados, nube hace trabajo pesado cuando el flujo esté integrado y medido. Sin loop desatendido, merge o despliegue.


## S-R0 / S1 / S2 — Habilidades jurídicas para nube

El dueño solicita repos/skills similares al paquete Legal, principalmente GitHub, aplicables a ley mexicana y al trabajo pesado en nube. [Selección y primer paquete propuesto](../research/cloud-legal-skills-selection-2026-11-09.md), [seis candidatos México](../research/mexican-cloud-legal-candidates-2026-11-09.md), [evidencia de ocho repos coordinador](../research/cloud-legal-github-evidence-2026-11-09.json). ThomasMoreAI compartido: 13 repos distintos en la matriz. La investigación es documental; no instala, ejecuta, valida o activa proveedores.

Priorizar métodos y módulos seleccionados de Consulto/ThomasMore/MiGaceta, flujos portables Mike y upstream Anthropic, evaluación Harvey LAB/LegalBench-RAG. Softlaw/wariomx es referencia México próxima al objetivo pero sus plugins México tienen AGPL/comercial diferente de raíz Apache. Lawve tiene raíz CC BY-NC-ND: descubrimiento, no asumir adaptación comercial. No confundir prompt de sanitización con detector local medido ni publicidad de la fuente con permiso para transmitir el caso. Revisión por skill y procedencia antes de reutilizar.

S1 propuesto empieza investigación/revisión contractual; cronología, borrador de escrito y matriz después según aceptación. S2 compara con/sin skill bajo iguales modelos/contexto/presupuesto y fuentes oficiales, aceptación independiente y abogado; 30 casos solo propuestos, no creados/ejecutados por el informe. No usar el heldout privado retirado para seleccionar estos agentes. H4/H5/H6/H7 no se desbloquean por leer repos, y ninguna cuenta/MCP/pago se activa por S-R0.

Cierre S-R0: `80aef8d`, revisión independiente Sol APPROVE por muestra de fuentes críticas, licencias/supuestos y consistencia. JSON/enlaces/diff comprobados; sin cambio de producción y sin repetir suite/build de C1a. S1/S2 siguen todo, cinco skills y lote de 30 casos propuestos sin crear/ejecutar. No se instalan repositorios ni se incorporan módulos con licencia/dependencia no aclarada. Dos contextos Sol (investigación y revisión), Codex coordina; sin Astra ni consultas nuevas a Claude/Gemini/Kimi/Cursor/Perplexity.


## Encargo S1

El dueño autoriza el siguiente paso de la selección. Coordinador: `docs/architecture/legal-tasks/contract-v1.md`, `resources/legal-task-skills/**`, procedencia/QA/backlog/memoria. Worker Sol `build_legal_task_contracts_s1`: `server/legal-tasks/contracts.mjs`, `scripts/check-legal-task-skills.mjs`, `tests/legal-task-contracts.test.mjs`. Autor Sol independiente `author_legal_task_cases_s1`: `eval/legal-tasks/development.jsonl`, `eval/legal-tasks/README.md`. Revisor independiente solo lectura después de implementación; Astra no se necesita para este paquete offline sin nueva frontera de privacidad. Preservar archivos ajenos y no importar en rutas activas.

Dos instrucciones propias en formato SKILL.md, contrato estricto/citas/cobertura y loader/CLI de preparación optativos. Métodos Apache/MIT solo como referencias verificadas, sin copiar módulos AGPL/NC-ND/licencia desconocida ni conectar servicios. Preparación pública/sintética declarativa no es clasificador ni permiso de egreso; S1 no cierra S2. Examen de calidad con modelos/ablation, acceso/presupuesto y revisión jurídica independientes permanece pendiente.


Cierre S1 `fcce90d`: dos instrucciones v0.1.0 propias con referencias documentadas, loader/compilador/validador optativos y 12 fixtures (6+6) de autor Sol independiente del builder. [QA](../qa/legal-task-skills-S1-2026-11-09.md), [freeze/resultados](../qa/legal-task-skills-S1-2026-11-09.json). Builder18/18, combinadasM133/33; revisor18/18+6probes y cotejo de nueve hashes/evidencia, APPROVE offline. Coordinador605/605 y buildOK. Checker11preparadas/1rechazada y5salidasfixtureaceptadas/6rechazadas/1noejecutada. Sin inferencia de tareas contra candidatos de producto: salidas escritas por agenteSF para tests, no respuestas de benchmark. Tres asignaciones Sol (builder/autor/revisor), sin Astra o proveedores externos adicionales, tokens no expuestos.

S1 demuestra forma/referencias/cobertura, no semántica: un análisis sintético deliberadamente sin respaldo con cita literal válida pasó estructura y mantuvo entailment/precisión no evaluados. DataClass/reviewState y hashes son declaraciones/consistencia, no clasificador/autorización. No importar a motor/UI, promover corpus C1a, transmitir clientes, registrar rutas o elegir ganador. S2 sigue todo: aceptación independiente y ablation real con mismo modelo/contexto/presupuesto autorizado, abogado y coste/latencia reales. El paquete S1 no amplía límites M1 (7.000UTF-16/800–1.200tokens salida). Doce ejemplos no completan el plan de30 ni sustituyen examen independiente. C1b/C2/H4/H5/H6/H7 siguen abiertos.


## Encargo S2a

El dueño autoriza S2. [Protocolo pareado congelable](../architecture/legal-tasks/paired-evaluation-v1.md). Groq status confirma clave presente/atestación Free actual y catálogo120b/20b; OpenRouter sin atestación vigente, no se activa. Ensayo SF de desarrollo, no proveedor de producto o presupuesto de M1 ampliado. Ocho casos nuevos, cuatro por tarea, 2modelos x2brazos, una repetición, tope32generaciones; contrabalanceo e igualdad de input/esquema/parámetros. Intervalo65s por modelo, sin retries/fallback/compras; stop por acceso/cuota/red/identidad, fallos de contenido conservados.

Ownership: Sol `author_s2_pilot_acceptance` solo `eval/legal-tasks/s2/{cases.jsonl,rubrics.json,README.md}`; Sol `build_s2_paired_runner` solo `scripts/eval-legal-task-skills.mjs`, `tests/legal-task-eval.test.mjs`; coordinador protocolo/acceso/QA/corrida/paquete revisión/memoria. Revisor independiente solo lectura antes de live y contra evidencia final; sin Astra salvo defecto crítico que lo justifique. No modificar S1/casos después de observar respuestas; aceptación del piloto se retira después de revisar/publicar. Prohibido exponer rúbricas al modelo o mapas/credenciales a logs. Revisión SF ciega no sustituye abogados y coste facturado desconocido se conserva separado de tokens/cuota Free declarada.


Diagnóstico S2a durante ejecución: V1 cancelado tras6envíos por condición de rol conocida incorrecta en guía común de investigación; no atribuir esos resultados a capacidad de modelos. Código/datos/freezes/replay preservados en69ebff1. Protocolo V2 y seis casos nuevos3+3 independientes, misma skillS1 sin cambios, guía corregida igual en ambos brazos y regresión específica. Builder44/44 dirigidas/revisor26/26 y coordinador631/631+build antes del live. V2máximo24envíos, acumulado30≤32inicial; no otros proveedores/pagos/retries. Checkpoint previo al cierre, posteriormente sustituido por los resultados siguientes.


## Cierre S2a

[QA medido](../qa/legal-task-skills-S2-2026-11-09.md) y JSON/freeze vinculados. V2 terminó24/24, dos modelos Groq con/sin skill, seis casos nuevos y una repetición. Contrato5/24, JSON10/24,14truncadas/10vacías; criteriosSF29/96, solo1pase conjunto con discusión adicional sin respaldo. Sin ventaja general ni ganador; S2/S2b siguen abiertos. Sesión30generaciones (6V1confundidas+24V2),127834tokens reportados,15por modelo; factura desconocida, sin retries/fallback pagado. V1 preservado69ebff1, V1/V2 retirados de aceptación futura mediante archivos separados sin tocar freezes.

Tres contextos Sol autor/builder/revisor, Astra0; builder44/44, revisor26/26 y grados ciegos congelados antes de mapping; coordinador631/631+build y replay offline. Visor estático completo en artifacts/legal-task-skills-s2-blind-review-v2-20261109/review.html y ZIP de dos archivos sin grados/mapa: navegación/descarga local comprobadas, cero red/erroresJS; feedback técnico sintético no es participación de abogados. Lorenzo/Pedro pendientes, sin mensajes enviados. S2b empieza por separar formato/citas/budget de fidelidad con desarrollo separado, después nueva aceptación independiente más amplia y revisión profesional. No cambiar skills contra V2 ni ampliar M1; no proveedor de producto, clientes, corpus promovido o despliegue.


## Primer lote de ejecución continua

Commit4ba5262: F0/H4b.2a y H5b.1b.1 revisados. QA docs/qa/hybrid-F0-H4b2a-H5b1b1-2026-11-09.md y JSON. Primera suite708/709 por marcadorUUID aleatorio que podía parecerCLABE: denegación antes del chunk, valor histórico no guardado. Fixture determinista y regresión de marcador numérico conservan puerta real/denegación; final721/721, buildOK, revisorSolAPPROVE. HTTP58/58, contrato61/61builder/26revisorfinal, nativas17/17 y Nodebóveda13/13. Sin aislamiento de sesión/llaves/custodia o recuperación completos; base activa sin cifrado; paridadfalse3/9/20. Nuevoheldout300 autorindependiente trasfreeze, candidatopequeño y probeS2b siguen como siguiente lote, sin activar cloud privado ni producto.

## Continuación 2026-11-10

Los límites de dos tareas son checkpoints revisables, no una orden de detener el trabajo continuo. Commits95f4f48/31f31ad/94e48c8 preservan guardas del examen, probe parcial/anclas y RSS Windows. Root52/52 combinadas de probe/anclas/semántico y16/16 distribución; estas dirigidas no sustituyen suite global actual. Propuestas/schema4 801b62a, landing d4fc1de y staging6d00b78 cerrados en su alcance con revisión independiente; root812/812 y buildOK. Sigue ablationdev detector y fuentes C1b, no ampliar esa aceptación a producto. Padre H4/H5/H6/H7 sin aceptación; no clientes reales o cloud privado.

H4b.2b.3: ablation de desarrollo en preparación (mismos pesos/umbral,5etiquetas vs3documentadas) y60casosdev nuevos de autor independiente, revisión pendiente. Sin heldout o entrenamiento. C1b.1 busca fuentes oficiales para plazas pendientes, sin aprobarlas o descargar masivamente.

## Evidencia continua adicional 2026-11-10

Privacyff0619b/faec790 sigueinelegible; tiposnativosnoequivalenatemáticaMX. Instrumentación60resultadosidénticos permiteatribuir26bloqueosdelbackend aUNK4/BIO3/confianza3/tiposnomapeados16, sinfalloPATHcausante. S2b1c4/4estructuraenficciónno calidadjurídica. CorpusNL2HTML+2PDForiginalesenR&Dcuarentena; elpiloto30sigue10federales/20pendientes. Windows3implementacionesfallaron; unjobdiagnósticocompletadonovalidarendimiento. SFKimi1opinion/Gemini1intentosinfinalusable/local1drafttruncadodescartado; tokens/cuotasdesconocidos, noClaude/cliente/pago/nuevaaceptación. Pruebasroot867checkpoint, posterioresdirigidas39trace/17PDF/31Windows, noampliarafirmaciónsinlotesactuales.
