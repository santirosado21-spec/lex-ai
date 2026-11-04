# Claude Legal 1.3.0 y viabilidad comercial de LEX AI local

Fecha: 2026-11-04. Evaluación de Codex sobre el archivo proporcionado por el dueño y el estado real del proyecto. No es validación profesional jurídica, de seguridad ni de demanda comercial. No se instaló el plugin, conectaron servicios externos, entrenó un candidato nuevo o cambió el modelo de producción.

## Decisión recomendada

Mantener **un asistente jurídico local, ligero y sin cuotas de inferencia del proveedor** como dirección del producto. El objetivo de 8 GB sigue vigente: una base de 9B/12B probada en la Mac de 24 GB del desarrollador no resuelve ese requisito. No exigir modelos grandes para el producto básico.

Adaptar las habilidades del paquete como procesos de la aplicación, con políticas del despacho, evidencia local, tareas pequeñas y verificaciones. El ajuste del modelo puede mejorar esas conductas, pero su beneficio debe demostrarse con ejemplos nuevos y sin deteriorar conversación, abstención o citas. El modelo pequeño actual es una base experimental; hoy no existe evidencia suficiente para presentarlo como asistente jurídico comercial validado.

El negocio es una hipótesis razonable: vender trabajo útil, privacidad verificable, integración documental, mantenimiento y soporte. Su rentabilidad y la disposición a pagar siguen sin medirse. El ZIP no acredita demanda ni la calidad de nuestro modelo.

## Qué contiene realmente el ZIP

Archivo: `/Users/santiagorosado/Downloads/Legal-1.3.0-v1.zip`.

SHA-256: `8888f7b6c1bf38d5f8890208c32faaa2b71d555256a4ce9399540a0ec5b08787`.

- 14 archivos, 123.080 bytes descomprimidos; nueve `SKILL.md`, documentación, licencia, manifiesto y configuración MCP.
- Metadatos: plugin `legal`, versión `1.3.0`, autor declarado Anthropic; el manifiesto público del repositorio oficial coincide en esos campos. No es una certificación criptográfica del ZIP.
- **No contiene pesos de Claude, tokenizer, adaptador entrenado ni corpus supervisado.** Describe métodos, formatos y herramientas que requieren un modelo capaz de seguirlos.
- Las nueve habilidades suman **99.730 caracteres**. `review-contract` tiene 16.706 caracteres: una sola habilidad ya supera el máximo de 7.000 caracteres de entrada configurado actualmente en LEX AI. No podemos concatenar todas las habilidades con documentos e historial en una llamada. Ese límite de caracteres y la ventana de contexto son controles distintos.
- El README incluye una estructura histórica que menciona `commands/`; el archivo recibido no contiene ese directorio. La evaluación se basa en las nueve habilidades efectivamente presentes, no en esa lista ilustrativa.

El [README oficial](https://github.com/anthropics/knowledge-work-plugins/blob/main/legal/README.md) presenta el paquete como productividad jurídica para Cowork/Claude Code y señala que sus ejemplos requieren adaptación al sistema jurídico del usuario. Nuestros equivalentes necesitan políticas mexicanas y fuentes aplicables; las preferencias de negociación no se convierten en leyes por incluirlas en un prompt.

## Qué adaptar y con qué límites

La columna de viabilidad es un juicio de arquitectura, no una capacidad ya demostrada del modelo 2B.

| Habilidad del archivo | Versión local propuesta en LEX AI | Viabilidad y condición |
|---|---|---|
| `review-contract` | Revisión por cláusulas contra un playbook del despacho, citas del documento y propuestas de cambio | Núcleo prioritario. Indexar todas las cláusulas y sus referencias; no afirmar revisión completa si solo se recuperaron fragmentos. Cambios como borradores revisables; DOCX con control de cambios real requiere implementación específica. |
| `triage-nda` | Lista de criterios, desviaciones documentadas y ruta de revisión | Núcleo prioritario. Criterios configurables; nunca convertir un verde generado por el modelo en autorización automática para firmar. |
| `legal-response` | Plantillas mexicanas con variables, datos pendientes y borrador exportable | Prioritario. Las plantillas y sus condiciones deben ser revisadas. Preparar un texto no envía correos ni presenta escritos. |
| `legal-risk-assessment` | Registro de riesgos con hechos, impacto, fundamento y revisión | Viable con reglas del despacho. Severidad y probabilidad necesitan justificación; su producto es una heurística, no una probabilidad judicial validada. |
| `compliance-check` | Listas de requisitos según jurisdicción, actividad y fuentes oficiales locales | Viable por dominios evaluados. No trasladar GDPR/CCPA ni plazos ilustrativos de 72 horas a México automáticamente. |
| `brief` | Resumen de asuntos, agenda local y documentos importados | Viable con las fuentes disponibles. Un briefing offline no conoce novedades regulatorias que no se hayan incorporado. |
| `meeting-briefing` | Expediente de preparación, participantes proporcionados y pendientes | Viable con agenda/notas importadas. No requiere leer calendarios o correos remotos por defecto. |
| `vendor-check` | Estado de contratos de una contraparte dentro del espacio autorizado | Viable con metadatos e índice local. No encontrar un contrato en los archivos importados no demuestra que no exista. |
| `signature-request` | Lista previa a firma, campos y documento de instrucciones | La preparación es local. Envío por DocuSign, correo o servicios equivalentes es una operación externa distinta, excluida del modo estrictamente local. No afirmar que una firma es válida solo por completar una lista. |

El paquete contempla conexiones a Slack, Box, Egnyte, Atlassian y DocuSign, además de entradas vacías para calendario/correo. Su archivo MCP no se ejecutó. LEX AI debe sustituir esas dependencias por capacidades locales explícitas; no importar sus servidores como parte del núcleo privado.

Hay decisiones del paquete que no deben copiarse literalmente: aprobación rutinaria de NDA sin nueva revisión, seguimiento de obligaciones desde sistemas no conectados y recomendaciones de mercado basadas en otros países. La preparación documental puede conservarse sin conceder a un modelo autoridad de aprobación o comunicación externa.

## Prueba local realizada en esta revisión

Modelo existente `qwen3.5:2b-q4_K_M`, fijado al digest del catálogo, sin descargar pesos. Inferencia por loopback con contexto de 4.096 tokens, máximo de 512 tokens de salida, `think:false` y parámetros de muestreo actuales de producción. Se usó el runtime del ayudante local, **no el recorrido completo de la app**. El equipo tiene 24 GB; no se midió consumo de memoria total ni se simuló un equipo físico de 8 GB.

Se definieron siete casos sintéticos: NDA con/sin no competencia, límite de responsabilidad para proveedora/cliente, excepción entre cláusulas, instrucción maliciosa dentro del documento y validez jurídica sin fuentes. Se compararon un prompt básico y el mismo prompt con un método de revisión compacto. Dos pasadas, 28 respuestas locales en total. La segunda aclaró las etiquetas en ambos brazos después de observar la primera; **son casos de diagnóstico vistos, no un conjunto ciego de evaluación**.

| Pasada | Prompt básico: etiqueta esperada | Con método compacto: etiqueta esperada | Interpretación |
|---|---:|---:|---|
| 1 | 2/7 | 2/7 | Varias explicaciones detectaron una desviación pero eligieron `unknown`. El caso con instrucción maliciosa produjo `clear` en ambos. |
| 2, etiquetas explícitas | 5/7 | 5/7 | Mejoró la clasificación en estos casos observados, sin ventaja del método compacto. Persistieron errores semánticos. |

En la segunda pasada el modelo confundió confidencialidad con no competencia y marcó como desviación un límite de 36 meses que satisfacía el mínimo de 12 exigido por la parte cliente. La variante con método compacto citó una frase de la pregunta como si fuera texto del contrato. Algunas salidas omitieron campos o añadieron otros; JSON válido por sí solo no implica cumplir el esquema.

Los controles combinados de etiqueta, esquema exacto, cita y señal de necesidad de fuentes pasaron en **1/7** respuestas básicas y **2/7** con método en la segunda pasada. Son comprobaciones diagnósticas sobre un contrato de salida propio, no una tasa de precisión jurídica. El reconocimiento de una cita tampoco acredita que apoye la conclusión. La mejora de un indicador aislado no justifica promoción.

Esta evidencia sostiene una conclusión acotada: un método breve puede ejecutarse con la base pequeña, pero copiar instrucciones no demuestra razonamiento fiable. No prueba que mejorar un modelo pequeño sea imposible. La aplicación debe detectar y rechazar contradicciones y apoyar las comparaciones explícitas con reglas verificables. No se observó ejecución de herramientas, exfiltración ni fallo del aislamiento de la app en esta prueba de prompts.

Artefactos reproducibles: `artifacts/legal-plugin-review-20261104/` contiene inventario, hashes, licencia, casos, fuentes del piloto, resultados de ambas pasadas y revisión. El resumen textual del ayudante local tardó 7 s y fue contrastado por Codex: el playbook puede ser local y preparar una solicitud de firma no garantiza una copia ejecutada. Ese ayudante no decidió seguridad, negocio ni conclusiones jurídicas. No se llamó a Claude ni a otro modelo externo para este análisis.

## Arquitectura adecuada a poca memoria

1. Conservar una base instruida pequeña y cuantizada; medir primero el candidato actual y comparar alternativas pequeñas con el mismo presupuesto. El modelo de 2B distribuido ocupa unos 1,95 GB; **tamaño de descarga no equivale a RAM total**.
2. Guardar documentos, índice, políticas, citas e historial en disco local. Recuperar contexto relevante automáticamente y mantener un registro de cobertura documental; el tamaño de una biblioteca no debe convertirse en un prompt gigantesco.
3. Cargar solo el procedimiento necesario y dividir el trabajo: identificar contexto/parte, extraer datos con citas, comparar criterios, revisar excepciones, redactar y comprobar. Más llamadas secuenciales pueden aumentar la latencia; deben medirse. No se debe ocultar una pérdida de calidad o cobertura con un resumen.
4. Usar reglas para comparaciones comprobables: mínimos/máximos, fechas expresas, campos obligatorios y criterios del playbook. El modelo ayuda a localizar e interpretar; el software calcula y exige evidencia. Los plazos legales no se deducen como fechas ordinarias sin base normativa y revisión.
5. Validar esquemas, texto citado y ámbito de acceso; después evaluar pertinencia, aplicabilidad y contradicciones. Una salida estructurada no resuelve por sí sola errores de razonamiento.
6. Mantener conversación natural y memoria del hilo separadas del registro de evidencia. Las estructuras internas del análisis no obligan a responder con plantillas rígidas a un saludo.
7. Entrenar ajustes pequeños y reproducibles sobre fuentes públicas utilizables y tareas sintéticas revisadas. Incluir negativos, cambios de parte, excepciones, ausencia de cláusulas, fuentes insuficientes y conversación; conservar evaluación nueva por familias documentales y jurisdicción. No entrenar con expedientes de clientes ni con el conjunto usado para seleccionar el ajuste.

El entrenamiento se realiza en el entorno del desarrollador; los compradores reciben un artefacto evaluado para inferencia. Sus computadoras no tienen que soportar el entrenamiento. Cuantizar también puede afectar calidad: hay que evaluar el artefacto final que ejecuta la app, no solo el checkpoint de desarrollo.

El último ajuste conversacional no es una mejora aprobada: el diagnóstico anterior cayó de 47/49 a 43/49 comprobaciones mecánicas pese a reducir la pérdida. Permanece separado e inactivo. [Evidencia de la corrida](../qa/night-conversation-training-2026-11-03.md).

## Compatibilidad comercial realista

La meta puede ser cubrir computadoras comunes; la oferta necesita requisitos verificables. Actualmente el catálogo exige 8 GB y plataforma macOS, y el empaquetado comprobado se concentra en Mac. Los ensayos x64 bajo Rosetta no validan un PC Intel físico ni Windows.

| Equipo objetivo | Tratamiento recomendado |
|---|---|
| Mac/PC con 8 GB y CPU compatible | Objetivo del núcleo ligero. Aún pendiente de validación física de instalación, conversación y documentos con otras apps abiertas. |
| Equipos de 16 GB o más | El mismo núcleo debe funcionar; perfiles mejores pueden ser opcionales, nunca necesarios para cumplir la promesa básica. |
| Equipos de 4 GB o CPU muy antigua | No declarar soporte hasta demostrarlo. No degradar silenciosamente a nube. |
| Windows/macOS/Linux | Portabilidad del motor no equivale a producto distribuible y probado en los tres. Priorizar Windows y macOS para la propuesta amplia y definir Linux según clientes reales. |

El [motor llama.cpp documenta compilación CPU y distintos backends/plataformas](https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md). Eso sustenta una ruta técnica multiplataforma, no certifica LEX AI en cada combinación de hardware. Hay que medir instalación, memoria total, presión/swap, primer token, tiempo de análisis, cobertura, batería y errores con documentos representativos. La UI no debe prometer analizar íntegramente un documento que excede lo efectivamente revisado.

## Privacidad que podemos vender de manera responsable

Procesar y recuperar en el equipo reduce la exposición a proveedores externos. Es una ventaja compatible con libertad de uso sin cuotas de un servicio de inferencia. Sin embargo, **local no significa riesgo cero, equipo invulnerable, conclusión correcta o cumplimiento automático de protección de datos**.

La revisión de código muestra un runtime de inferencia en loopback con nube desactivada, y SQLite local con permisos de directorio/archivo. No muestra cifrado propio de la base de datos en `createStore`; tampoco se verificó aquí el cifrado del disco del usuario. No hay evidencia suficiente para anunciar una bóveda cifrada o seguridad absoluta.

Antes de presentar garantías comerciales: verificar aislamiento y autorizaciones, cifrado/gestión de claves adecuados al producto, copias de respaldo, exportaciones, logs/diagnósticos sin contenido, actualizaciones y funcionamiento con tráfico saliente bloqueado. El acceso de malware o de otra persona a un equipo desbloqueado sigue siendo un riesgo. Un backup o carpeta sincronizada del usuario puede salir del equipo aunque la inferencia sea local.

La [LFPDPPP consultada en la Cámara de Diputados](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf), con última reforma indicada de 14-11-2025, incluye tratamiento automatizado y exige medidas de seguridad y confidencialidad en sus artículos 18 y 20. Por ello, la operación local no exime por sí sola al despacho de sus obligaciones. La aplicación concreta requiere revisión jurídica del producto y de los flujos de datos.

Propuesta de mensaje comercial **sujeta a verificar la implementación completa**:

> Procesa tus documentos y conversaciones en tu equipo, sin enviarlos a modelos externos y sin utilizarlos para entrenar nuestros modelos. Trabaja sin conexión y sin cobro por consulta.

La información pública necesaria para actualizar el corpus puede descargarse por separado sin transmitir hechos del asunto ni consultas con datos de clientes. Las herramientas remotas de dsystem siguen limitadas a desarrollo con material público/sintético; no son un fallback del producto.

## Licencias y diferenciación

El archivo incluye Apache-2.0 y el [repositorio oficial del plugin](https://github.com/anthropics/knowledge-work-plugins/blob/main/LICENSE) publica esa licencia. La [licencia Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0), secciones 4 y 6, permite distribución y modificaciones bajo sus condiciones: incluir licencia, conservar avisos aplicables, identificar cambios y trasladar los avisos NOTICE cuando existan. No concede derechos de marca. La ficha oficial de [Qwen3.5-2B](https://huggingface.co/Qwen/Qwen3.5-2B) también declara Apache-2.0; cada componente redistribuido y dato de entrenamiento necesita su propia procedencia y revisión.

Esto ofrece una base para adaptación comercial, **no acceso a pesos de Claude ni garantía de derechos sobre cualquier otro paquete u output de un servicio**. No presentar LEX AI como producto oficial de Anthropic ni atribuirnos la autoría exclusiva de componentes de terceros. Los avisos técnicos pueden coexistir con una interfaz principal centrada en LEX AI.

Las habilidades abiertas son copiables por competidores. La diferenciación defendible debe venir de calidad medida en español/México, fuentes y versiones, documentos editables, configuración del despacho, privacidad comprobada, soporte e instalación sencilla. Cobrar solo por renombrar un modelo descargable tendrá poca protección competitiva.

## Modelo de negocio propuesto y pruebas pendientes

Recomiendo probar **licencia por usuario o equipo para una versión principal**, con uso local sin límite de consultas y mantenimiento opcional para nuevas versiones, fuentes y soporte. La licencia instalada debe conservar utilidad sin conexión; una actualización opcional no debería convertirse en una dependencia de nube para abrir expedientes. Una suscripción también es posible, pero debe explicar claramente qué mantenimiento recurrente financia.

La inferencia local evita un coste de proveedor por cada respuesta del cliente; quedan desarrollo, distribución, firma de instaladores, corpus, evaluación, incidencias, soporte y mantenimiento multiplataforma. No se han estimado costes ni fijado precio. No se puede afirmar rentabilidad, retorno o demanda sin datos de compradores.

Validaría disposición a pagar con 5–10 despachos de perfiles distintos y tareas representativas: comparar tiempo total de trabajo **incluida la corrección del borrador**, tasa de errores relevantes, uso repetido y necesidades de soporte. El primer piloto debe usar material sintético/público; la incorporación posterior de expedientes requiere que las condiciones y controles del producto estén comprobados. Esta muestra es exploratoria y no representa por sí sola el mercado.

## Orden de trabajo y criterios para avanzar

1. Diseñar el playbook local versionado y tres flujos completos: revisión contractual, NDA y respuestas/borradores. Traducir y adaptar criterios con abogados mexicanos; mantener el producto general y ampliar por evidencia, no anunciar validación de todas las ramas por implementar esas tres funciones.
2. Implementar extracción con referencias y controles de política, cobertura documental, esquemas y acciones autorizadas. Probar contra el núcleo actual, no dar por integrado el piloto de esta revisión.
3. Ejecutar evaluación nueva por conversación, documentos, jurisdicción, citas, abstención y ataques de instrucciones; comparar base, flujo y posterior ajuste en el mismo runtime. La regresión de un caso crítico impide promoción aunque mejore la media.
4. Resolver errores reproducidos con datos/entrenamiento específico cuando corresponda. No entrenar más épocas a ciegas ni asumir que pegar las nueve habilidades crea competencia jurídica. Preservar base, candidato y rollback.
5. Validar físicamente el mínimo de 8 GB y construir/ensayar Windows/macOS; completar controles de privacidad y revisión profesional antes de ofrecer una versión de confianza comercial.
6. Medir valor, soporte y disposición a pagar antes de fijar precio o prometer amplitud universal.

Recomendación final: **continuar con el producto local ligero y adaptar estos procesos; mantener como pendientes la competencia del modelo, la seguridad comercial y la demanda.** El paquete resulta útil como referencia de producto y procedimientos. No demuestra que nuestro 2B ya pueda desempeñarlos con fiabilidad ni justifica subir el requisito de RAM como solución por defecto.
