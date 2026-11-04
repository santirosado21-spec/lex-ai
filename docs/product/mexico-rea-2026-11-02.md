# Referencias mexicanas observadas con REA — 2 de noviembre de 2026

El propósito es orientar la experiencia propia de LEX AI: una conversación que decide cuándo consultar evidencia y cuándo pedir datos. Se inspeccionaron páginas públicas de tres productos mexicanos y un recorrido de consulta del corpus abierto IANM mediante escenarios reales de REA/Chromium, sin cuentas, cargas de documentos ni consultas a sus modelos. La captura de una página comercial acredita su contenido e interacción expuesta; no acredita el comportamiento del producto autenticado, la calidad jurídica o su arquitectura interna.

## Límite de Harvey

El coordinador observó en `app.harvey.ai` una pantalla de acceso por correo; evidencia `ev_661fc78f8748e62850bb1a0ae1bb4bc28dc5aa84dfe5d04470f46897d35dd6b7`. No se accedió a su asistente autenticado. Este informe aplica la alternativa solicitada: productos mexicanos con información pública accesible.

## Qué se pudo observar y qué afirma cada proveedor

| Producto | Observación directa de REA | Afirmación del proveedor; no verificada en operación | Referencia útil para LEX AI |
|---|---|---|---|
| [IUX](https://iux.mx/) | La página pública organiza expedientes, documentos, plantillas, monitoreo y chat como partes de un mismo espacio. Ofrece registro y acceso. | Describe recuperación previa de leyes, tesis y documentos, seguida de selección de fuentes y redacción con referencias. También anuncia rellenado de plantillas DOCX. Su encabezado comercial de entrenamiento no acredita ajuste de pesos. | Vincular conversación y expediente sin obligar a elegir una modalidad técnica. Conservar el formato de una plantilla al completar variables revisables. |
| [IUDEX](https://iudex.mx/) | La presentación incluye una respuesta jurídica con referencias, un documento Word, carpetas y flujos. `chat.iudex.mx` redirigió a acceso por correo y contraseña. | Publicita investigación, redacción, revisión documental y seguimiento por práctica jurídica. La [página de soluciones](https://iudex.mx/soluciones) diferencia litigio, corporativo, transaccional y áreas internas. No se probó su generación ni su cobertura. | Mostrar fundamento junto al resultado y llevar el trabajo al escrito. Adaptar instrucciones y datos requeridos a la tarea, manteniendo una conversación común. |
| [Iurexia](https://www.iurexia.com/) | La portada presenta entrada de consulta y sugerencias, además de navegación a redacción, carpetas, normativa y flujos. Su acceso requiere autenticación; no se envió ninguna consulta. | Su [descripción de consulta](https://www.iurexia.com/plataforma/consulta) afirma resolver jurisdicción estatal más federal, abrir la fuente oficial en página exacta y reconocer fuentes ausentes. Explica búsqueda conceptual y exacta; no se verificó precisión, cobertura o vigencia. | Resolver ámbito antes de contestar, abrir el pasaje que sustenta cada afirmación y pedir la información faltante en lugar de inventarla. |

No se midieron cifras de corpus, seguridad, ahorro de tiempo, precisión ni promesas de ausencia de alucinaciones. Las cifras y testimonios comerciales no se incorporan como evidencia de calidad ni como datos de entrenamiento de LEX AI.

## Un recorrido funcional público: IANM

Desde [IANM](https://ianm.com.mx/) se siguieron enlaces realmente observados: [catálogo de leyes](https://ianm.com.mx/leyes) → [Código Penal Federal](https://ianm.com.mx/ley/codigo-penal-federal) → [artículo 8](https://ianm.com.mx/ley/codigo-penal-federal/articulo/8). El texto del artículo se abrió sin registro, con navegación anterior/siguiente, fecha de reforma de referencia y fecha de actualización del índice. La explicación divulgativa asistida por IA está separada del texto normativo. Se observaron enlaces a tesis del SJF y a la fuente oficial.

Ese último enlace lleva al índice general de leyes de Diputados, no al pasaje exacto de un PDF. La oportunidad propia es dar acceso más preciso al documento y pasaje utilizados. No se validó el contenido jurídico ni su vigencia. Los [términos del portal](https://ianm.com.mx/terminos) distinguen el corpus gratuito sin registro de la plataforma comercial IAN Jurídico y reservan su trabajo editorial. No se copió material procesado del competidor al corpus de entrenamiento: LEX AI debe obtenerlo de las fuentes oficiales originales.

## Principios aplicables a la implementación propia

1. **Una entrada, decisiones internas.** El abogado escribe su petición y continúa el hilo. El sistema distingue presentación, organización, consulta jurídica, análisis documental y borrador; el usuario no necesita conocer RAG o seleccionar un modo. Las preguntas mixtas requieren conservar la parte jurídica sustantiva.
2. **Ámbito visible y preciso.** El asunto limita documentos privados; la ley expresamente pedida determina el ordenamiento. Una consulta federal desde un asunto local no debe sustituirse por otro código. Si falta estado, tribunal o documento, se pregunta solo lo necesario.
3. **Comprobación desde la afirmación.** Cada cita debe abrir su pasaje, documento, versión y procedencia. Separar los estados de verificación textual, vigencia y revisión profesional; una cita coincidente no valida la inferencia jurídica.
4. **Del diálogo al escrito.** Primero se confirma objetivo, hechos y datos faltantes; después se redactan secciones revisables y se entrega DOCX. Las plantillas y reglas por despacho pueden aportar más valor verificable que prometer conocimiento universal.
5. **Entrenamiento y evidencia cumplen funciones distintas.** El ajuste local de Qwen puede enseñar conversación, seguimiento, formatos y selección de tareas. La recuperación mantiene a la vista el texto jurídico versionado. Unificar la experiencia no exige eliminarla. El corpus público propio y las tareas sintéticas conservan procedencia y evaluación retenida; documentos privados y contenido propietario de competidores quedan fuera del entrenamiento.

Estas son decisiones de diseño propuestas para LEX AI, no una reproducción del software o de las interfaces de los competidores. No se descargó código, se accedió a endpoints privados ni se intentó reconstruir sus modelos, instrucciones o conjuntos de entrenamiento.

## Registro de evidencia y cobertura

| Captura | Evidencia REA | Resultado y límite |
|---|---|---|
| IUX, portada pública | `ev_8432847703c91c6d5e8ddfdf87b08dc0049a8eac59e9abfc13641028dfe70439` | Contenido y navegación observados. |
| IUDEX, portada pública | `ev_d701b04b0d22a14479fbbd05ecd5b9093a00cb9cdfeb65c3088028b0b44b4a40` | Presentación de producto observada; no respuesta de modelo ejecutada. |
| Iurexia, portada pública | `ev_1f6ec36563049138e273dba31d43ef1f3c224b01f3e263319fcb5093c057ea2d` | Entrada de consulta expuesta, sin envío. |
| IUX, `/login` | `ev_afbe5ef819e78375787b4c1bf05ba4babe25f4a94719f22e6198def53ad41054` | Solo raíz de documento después de observación acotada. Se desconoce si se debió a carga, bloqueo o estado de la página; no se declara fallo del producto. |
| IUDEX, chat | `ev_396b0623db9603d56b6dc62f1877752eae0c5e7b0ebb51b104e1e736c8fc9252` | Redirección y pantalla de acceso observadas. |
| Iurexia, acceso | `ev_34533abe5bbe98ca4f63f2f1e288e3cfc43263a58a1f104ff4877fc48724867f` | Pantalla de autenticación observada. |
| IANM, portada | `ev_9dede377044b3911f4f263aaee70bc1a774ddfc3694fa558b90ee5e8d9a2b5d4` | Entrada pública de búsqueda y enlaces de catálogo observados. |
| IANM, catálogo | `ev_2ba01a0c1b09f6eafd7f41357875d66eebf69bfe60a427b63994d56a996f6ac2` | Catálogo público navegado desde enlace observado. |
| IANM, índice del CPF | `ev_41d5ca4911a2406919eb5e1eb23594ed636bdb015ff736cc3cccd95ed25ebc7b` | Índice por artículo y metadatos observados. |
| IANM, artículo 8 | `ev_5f20d0e1588bc3666c8ad0abdae9e31d03f10a06a18e1655d81a4a45b959bd5a` | Visor de texto, fechas, explicación separada y enlaces de comprobación observados. |

Las diez capturas completaron sus acciones de navegación/observación. Esta completitud técnica no convierte la investigación del producto autenticado en completa. REA registró orden de recepción de eventos, no causalidad entre peticiones; la plataforma y arquitectura del host no fueron observadas por el proveedor. No se solicitaron cuerpos de red, valores de almacenamiento ni DOM. Los resúmenes locales, hashes de accesibilidad y límites están en `artifacts/competitor-rea/mexico-captures.json` y `mexico-ianm-captures.json`. La sesión de este investigador es distinta de la de Harvey del coordinador; los diez registros completos se exportaron a `artifacts/competitor-rea/mexico-evidence-2026-11-02.json` (350.325 bytes), sin repetir capturas.

Se aplicaron la skill `reverse-engineer-anything`, su guía de observación de runtime y dsystem. Codex realizó la observación y contraste de fuentes; no se atribuye una revisión a Claude, Gemini o un modelo local.
