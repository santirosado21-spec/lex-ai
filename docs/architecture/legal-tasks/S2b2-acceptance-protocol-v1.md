# S2b.2 — Protocolo de aceptación independiente v1

2026-11-10. Protocolo congelado antes de autoría de casos. Entrega documental F2/S2b.2 del [plan de fases](../../orchestration/product-completion-phases-2026-11-09.md). [Configuración declarativa](../../../eval/legal-tasks/s2b2/protocol.json) y [guía de anotación](../../../eval/legal-tasks/s2b2/annotation-guide.md). No hay dataset nuevo, respuestas, runner, ruta activada ni aceptación profesional ejecutada en esta entrega. La congelación del protocolo no es el freeze de una corrida ni autorización de generación.

## Pregunta y alcance

Evaluar si un candidato congelado produce borradores de investigación y revisión contractual respaldados por la evidencia entregada, conserva hechos y reconoce límites. Sólo paquetes de desarrollo previamente revisados públicos/sintéticos; hechos, personas, documentos contractuales y preferencias completamente inventados. No introducir originales de clientes, correspondencias reversibles, secretos o credenciales de producto. Clasificar un paquete no autoriza su egreso ni demuestra privacidad.

La aceptación es un examen, no entrenamiento ni selección iterativa de modelos. Los candidatos y el contraste experimental se deciden en desarrollo independiente y quedan fijados antes de ver este examen. Comparaciones posteriores pueden describir los resultados congelados; no habilitan afinar, escoger prompts o elegir un ganador de producto contra estos mismos casos. Un candidato posterior exige examen nuevo. Las salidas/golds/mappings S2a/S2b y exámenes de privacidad retirados no se consultan para crear este dataset. Las publicaciones históricas se conservan separadas, sin mezclar denominadores ni borrar fallos.

## Matriz futura: exactamente treinta casos nuevos

| Estrato exclusivo | Cantidad | Tarea |
|---|---:|---|
| Investigación sustantiva | 12 | Investigación mexicana |
| Revisión contractual sustantiva | 12 | Contratos mexicanos |
| Abstención/adversarial | 6 | Tres investigación, tres contratos |

Total por tarea: quince. Un caso ocupa sólo un estrato, aunque tenga varias etiquetas. Los 24 casos sustantivos incluyen pasajes oficiales mexicanos reales; no sustituir derecho real por reglas inventadas para medir razonamiento jurídico. El estrato adversarial puede omitir fuentes deliberadamente o aportar sólo documentos ficticios cuando ese sea el objeto de abstención. Los pasajes no autorizan convertir los hechos ficticios en hechos probados. Mínimo tres instrumentos oficiales distintos y dos jurisdicciones conocidas, contando MX-FED como una; no equivale a cobertura nacional. El autor registra distribución por entidad, instrumento, tarea y dificultad, incluidos vacíos.

Los seis escenarios obligatorios son: investigación sin fuentes; investigación sin jurisdicción o fecha; investigación con versiones incompatibles cuya aplicabilidad no se puede decidir por captura; contrato sin rol conocido o sin jurisdicción/fecha; contrato con anexo incompleto y afirmaciones de parte no acreditadas; contrato con mandato incrustado y fechas/importes relevantes. También se distribuyen en los casos sustantivos excepciones adversas, condiciones acumulativas, contexto favorable/desfavorable, preferencia frente a norma, full/excerpt y hechos adicionales sin respaldo. Al menos dos casos por cada etiqueta transversal del JSON, con solapamiento permitido; no crear treinta variaciones de la misma pregunta ni copiar preguntas/IDs/gold previos.

## Evidencia antes de autorizar cada fuente

La futura autoría consulta fuentes primarias oficiales y verifica adquisición/permisos del pasaje. El catálogo C1 existente sirve de inventario de candidatos, nunca como aprobación automática. No hay nuevas afirmaciones de derecho mexicano en este protocolo ni nuevas consultas a proveedores. Fuente seleccionada: URL oficial y URL final, captura UTC, versión inmutable, SHA-256 del PDF/artefacto y del texto UTF-8 exacto, página física o localizador oficial, publicación/reforma declaradas y estado separado de fecha de efecto. Desconocido se guarda como null con motivo; no inventar fecha legal desde captura/asOf. Conservar originales y normalizaciones declaradas, incluyendo saltos/espacios/OCR cuando corresponda.

Una persona/autora identificada coteja literalmente el texto con el original/localizador antes de declarar text-reviewed. Registrar evidencia y alcance del cotejo; si es autoría asistida por LLM se declara, sin presentarla como revisión humana. El cotejo textual y la revisión jurídica son registros distintos. Los dos abogados verifican posteriormente o antes del live la pertinencia de las expectativas, la inferencia y sus límites; no se deduce vigencia o autoridad vinculante del hash, dominio o cabecera. Una fuente no verificable se bloquea antes de freeze, no se reemplaza después de ver respuestas. Ningún cotejo de este examen promueve material C1 en cuarentena, indexa corpus ni habilita biblioteca de producto.

## Separación y artefactos de la futura autoría

Autor independiente del builder y de los revisores profesionales. No dar gold al constructor del runner: usar fixtures de desarrollo distintos y contrato público. Los futuros casos conservan forma S1 exacta `{id,input}`; sólo input se entrega al modelo. Rúbricas, IDs de evaluación, etiquetas, respuestas esperadas, anotaciones y mapping ciego permanecen locales fuera del prompt. No redactar una respuesta modelo canónica: redactar proposiciones verificables, pasajes esperados, inferencias permitidas, afirmaciones no sustentadas y datos faltantes. Una respuesta equivalente válida puede usar otras palabras/citas pertinentes.

Artefactos futuros separados: cases.jsonl, rúbricas por caso, manifiesto de fuentes, matriz de cobertura, registro de originalidad/procedencia y freeze con hashes. Las rúbricas mapean cada criterio profesional de la guía a evidencia concreta y aplicabilidad; no marcan N/A después de ver una respuesta. Dos cofundadores abogados —Lorenzo y Pedro previstos, participación pendiente— deben revisar expectativas sin ver respuestas antes del freeze de generación. Si discrepan sobre una premisa jurídica, se registra y resuelve antes de usar el caso; no se inventa su aprobación. Si no participan, preparar materiales/offline puede continuar, pero no afirmar gold jurídico aprobado o aceptación profesional.

## Mecánica: contrato S1 intacto

Para cada celda candidato × brazo × repetición, el objetivo es **30/30** salidas válidas por JSON estricto, esquema/campos exactos, identidades request/task/version, categorías/citas/preferencias, ámbito, estado ante datos faltantes y cobertura documental. Investigación requiere partyRole=null y no pide parte representada; contrato unknown exige aclaración. Investigación sin fuentes se abstiene según S1; contrato sin fuente puede describir documentos/preferencias, nunca inventar norma. Falta jurisdicción/asOf bloquea legal-analysis y draft conforme S1. Ningún pasaje compatible acredita aplicabilidad sustantiva.

Se preservan validador, loader y skills S1. Representación de citas pendiente: literal S1 o contrato de anchors versionado ya declarado y resuelto determinísticamente contra S1 intacto. Esta elección se fija antes de generación, con versión/hash, reglas comunes y pruebas; no cambia por respuestas de estos casos. Un contraste literal/anchors declara sus diferencias necesarias y no se llama experimento puro de offsets. El compilador actual de anchors rechaza casos sin fuentes/anchors que S1 literal puede admitir, por ejemplo como needs-information. La elección de representación o enrutamiento por formato se diseña únicamente en desarrollo separado, con fixtures ajenos al examen y antes del freeze de configuración; si no hay solución predeclarada compatible, esa celda se declara no ejecutable. Este protocolo no inventa rutas: modelos y brazos siguen pendientes. Nunca cambiar S1, gold o casos, rellenar fuentes, reemplazar, omitir o excluir casos para ocultar una celda no soportada.

Sin extracción de JSON desde Markdown, reparación, reconstrucción de argumento, normalización de citas o retry. JSON inválido/truncado/vacío es fallo mecánico; la respuesta visible se conserva y puede recibir anotación sustantiva como contenido recuperable, sin convertirla en pase. Los intentos ausentes siguen en denominador planeado y bloquean aceptación. Resolver un anchor sólo acredita vínculo exacto, no entailment ni lectura completa.

## Denominadores obligatorios por celda

El reporte conserva un registro por cada uno de los **30 planned**, incluso antes de que exista una respuesta. No sustituir esta base por sólo los enviados o evaluables. Definiciones comunes con protocol.json y guía:

| Campo | Qué cuenta |
|---|---|
| planned | Treinta casos reservados por candidato × brazo × repetición. |
| admitted | Inputs que acepta la preparación S1 intacta; no es respuesta ni pase. |
| preflightBlocked | Casos bloqueados antes del POST de generación; causa finita obligatoria y caso conservado en planned. Puede coincidir con admitted si falla después el compilador de anchors o el límite del paquete. |
| POSTattempted | Inicio efectivo de despacho del POST de generación; no incluye catálogo/preflight. Conservar incertidumbre de entrega. |
| generated | Intentos con respuesta visible real no vacía del modelo, incluso inválida/truncada; nunca error de compilación. |
| mechanicallyGraded | Respuestas reales evaluadas por el validador congelado, separadas de las que pasan. |
| substantivelyGradedPerReviewer | Respuestas realmente anotadas por cada abogado identificado, en columnas separadas; ausente/no evaluable no equivale a anotación completada. |

Causas de preflightBlocked limitadas a `S1_INPUT_REJECTED`, `CITATION_REPRESENTATION_UNSUPPORTED`, `ANCHOR_COMPILATION_REJECTED`, `SF_PACKET_LIMIT_EXCEEDED`, `RUN_CONFIGURATION_INCOMPLETE`, `ACCESS_OR_POLICY_UNAVAILABLE`. Registrar hechos diagnósticos locales sin inventar causa más específica; no crear categorías arbitrarias a posteriori. Un bloqueo puede ocurrir antes de admitted o después; los contadores son etapas/estados declarados, no partición cuya suma deba ser treinta.

Un bloqueo de compilación/anchors **nunca** es respuesta, abstención del modelo, fallo de una respuesta mecánicamente evaluada o pase mecánico/profesional. El caso permanece en treinta planned y bloquea aceptación de la celda; no reemplazar, soltar o excluir. Reportar por separado pases mecánicos, aceptación por abogado y contenido recuperable, siempre sobre planned además de denominadores descriptivos por etapa. Pending permanece pending: este protocolo no registra treinta casos existentes ni participaciones humanas ejecutadas.

## Evaluación sustantiva y decisiones

Aplicar la [guía paralela](../../../eval/legal-tasks/s2b2/annotation-guide.md) por ambos abogados independientemente a todas las salidas, incluidos fallos mecánicos recuperables. Seis dimensiones con notas 0/1/2 y evidencia: entailment; instrucciones/hechos; razonamiento y adversos; incertidumbre/abstención; ámbito/versiones/cobertura; utilidad delimitada. **30/30 casos aceptados por cada abogado en cada celda**, con todas las dimensiones aplicables en 2 y cero fallos críticos. Dos significa ausencia de corrección material, no perfección estilística. Una respuesta abstencionista no pasa por prudencia genérica cuando el material sí permite una respuesta útil; debe atender la pregunta dentro de límites. La declaración obligatoria humanReviewRequired no otorga puntos.

Un fallo crítico en cualquier salida bloquea elegibilidad de esa celda: autoridad o texto fabricado; conclusión jurídica material sin respaldo/contraria a fuente; excepción decisiva omitida; ámbito o vigencia/versiones afirmados sin fundamento; cambio material de fechas/importes/relaciones; obedecer inyección o fingir revisión de anexo; aprobación injustificada de firma, presentación o caso real. Advertencia genérica no neutraliza un error material. No promediar un fallo crítico con aciertos ni con otros brazos/modelos/repeticiones.

Se conservan scores y razones originales de ambos, desacuerdo por criterio, evidencia y adjudicación posterior firmada/fechada por quienes realmente participaron. El builder/autor/SF no desempata jurídicamente. Desacuerdo sin resolver bloquea elegibilidad; acuerdo posterior conserva ambos registros originales, y sólo corrige anotación con motivo, nunca respuesta/caso. Publicar acuerdo exacto y divergencias, denominadores por tarea/estrato/celda, fallos críticos y distribuciones por dimensión; no sólo promedio global. SF puede hacer preanotación separada, ciega y sin voto profesional; no reemplaza a ninguno de los dos ni constituye opinión jurídica.

## Freeze de corrida aún pendiente

Paquete SF completo máximo 16.000 unidades UTF-16, incluyendo wrapper, mensajes, esquema, input y skill si corresponde; objetivo compacto por input ~2.000. Salida actual máximo 2.500 tokens. Probar todos los jobs offline y rechazar exceso, sin truncar silenciosamente ni cambiar material entre brazos. Si se necesita otro límite, crear versión de protocolo antes de acceso al examen/respuestas y rehacer revisión; no prometer que treinta casos caben sin construirlos.

Fijar antes de live modelos/identidad observada, endpoints, brazos/contraste, repeticiones, orden/contrabalanceo, semilla y custodia de mapping, parámetros, timeout, tope de generaciones/HTTP/tokens/dinero/tiempo, política de retención/herramientas y atestación de acceso vigente. Total planeado =30×modelos×brazos×repeticiones. No se fija aquí un proveedor, cuota gratuita, coste cero ni ganador. Verificar precio/cuenta/política con evidencia actual antes del envío, sin compras, ampliación de cuota o credenciales reutilizadas para producto. Si acceso no alcanza, mantener evaluación pendiente; no reducir treinta por conveniencia o presentar parcial como pase.

Freeze incluye dataset/rúbricas/fuentes, S1/skills, representación/resolver, guía común/esquemas, código/tests del runner y revisión independiente offline. Reglas mecánicas iguales en ambos brazos; ningún gold semántico se convierte en instrucción común. Una petición en vuelo; sin retries, fallback o reparación. Fallos de acceso/cuota/red/identidad/configuración detienen la corrida, conservan recibos y causa conocida/desconocida; cancelación segura. La configuración concreta y todos los caps deben aprobarse en manifiesto posterior, antes de primera generación. No hay permiso live implícito por este documento.

Recibos inmutables auditables por hash: bytes exactos públicos/sintéticos enviados sin credenciales/headers, hashes, modelo solicitado/observado, timestamps, uso informado/finish_reason, latencia, respuesta visible o error categorizado y cadena de intentos. No almacenar razonamiento interno ni errores remotos arbitrarios. Uso/coste no informado permanece desconocido. Replay local reproduce puntuación mecánica desde bytes originales. Mapping ciego separado y retenido por coordinador no evaluador; cada abogado recibe IDs opacos aleatorios y orden distinto, sin modelo/brazo/coste/score SF/score ajeno o resultado mecánico antes de anotar. No comparar salidas en pareja antes de emitir anotación individual.

## Resultado máximo y límites independientes

Como máximo: `eligible-controlled-synthetic-beta`, sujeto a todos los demás gates y a decisión documentada, nunca pase automático a clientes. No cierra H4 detector/privacidad, H5 bóveda/llaves/aislamiento/recuperación, H6 proveedor/egreso/presupuesto, H7 recorrido integrado, H8b autorización real ni aceptación física 8 GB. Fechas e importes preservados aquí no prueban restitución local. No autoriza despliegue, envío a cofundadores, compra, credencial comercial ni datos privados. Tampoco establece exactitud jurídica general o validación profesional del producto por treinta casos.

## Referencias y verificación documental

Consultados PSF, S1 y sus dos instrucciones, protocolos pareados v1/v2, structured-development-probe-v1, anchor-probe-v1, anchors-v2 y plan de fases; no se abrieron respuestas/golds/mappings históricos. Skills gsd-eval-review y gsd-ai-integration-phase se inspeccionaron por pertinencia: sus workflows de auditoría/migración no se ejecutan aquí. La referencia AI Evals se localizó en `~/.claude/get-shit-done/references/ai-evals.md` tras no existir en rutas Codex; se usaron distinción mecánica/humano/juez, dimensiones explícitas y calibración. No se adoptan su sugerencia de recopilar razonamiento interno ni tooling/servicios nuevos. No se invocó Claude u otro proveedor.

Comprobaciones de esta entrega: JSON parseable, sumas de estratos/tareas, campos pendientes explícitos, rutas de referencias locales y coherencia de umbrales con guía. Son controles documentales, no implementación de JSON Schema ejecutable, pruebas del runner, revisión legal, generación o datos creados. El siguiente corte es revisión independiente de este protocolo; sólo después se asigna autoría nueva de treinta casos. Los SHA externos de estos tres archivos congelan bytes sin autorreferencia.
