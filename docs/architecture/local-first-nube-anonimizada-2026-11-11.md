# LEX AI: motor local primero, nube con contenido protegido — mapa y plan de cableado

Fecha: 2026-11-11. Estado: diseño verificado contra el código vigente; ninguna llamada de red, gasto ni cambio de runtime realizado. La instrucción operativa del dueño (2026-11-11) pide que el motor local atienda las primeras consultas mientras se capturan los datos sensibles del asunto y que después la conversación corra en la nube con la API ya existente en el proyecto. Este documento traduce esa instrucción al recorrido de `hybrid-local-privacy-router-2026-11-09.md` y a los componentes H1/H2/H3/H6 ya construidos. No sustituye las decisiones de modelo, cobro ni piloto, que siguen pendientes del dueño.

## Lo que ya existe (verificado en código)

| Pieza | Archivo | Estado real |
| --- | --- | --- |
| Motor local (daemon propio, catálogo verificado por digest, límites de memoria) | `server/inference.mjs`, `server/bundled-model.mjs` | Producción local; única ruta de generación activa |
| Enrutador de intención (chat vs. trabajo jurídico/documental) | `server/assistant-router.mjs` | Producción; solo enruta, no ejecuta |
| Generación de conversación | `server/service.mjs` (l. 671), `server/conversation.mjs` (l. 47), `server/proactive-drafts.mjs` | Llaman `inference.generate` directamente, sin puerta de salida |
| Transporte OpenRouter (H1): solo modelos `:free`, `max_price` en cero, ZDR + `data_collection:'deny'`, rechaza cargo distinto de cero, sobre ≤ 7000 caracteres y ≤ 16 mensajes | `server/providers/openrouter.mjs` | Construido y probado; **no importado por el producto** |
| Custodia de credencial (H6b): Keychain `LEX AI.product.openrouter`, solo lectura, sin provisioning | `server/providers/openrouter-keychain.mjs` | Construido; **no importado** |
| Puerta de salida (H2): clasificación de todo el sobre serializado, grants por ámbito workspace/asunto/hilo, categorías `public`/`synthetic`, revalidación de política antes de cada chunk, auditoría sin texto | `server/egress-policy.mjs` | Construido y probado; **no importado** |
| Seudonimización (H3): sustitutos `[[LEX_*]]` por par workspace/asunto, protección y restitución literales, marcadores desconocidos señalados | `server/privacy/pseudonyms.mjs` | Prototipo en memoria, solo sintético; sin persistencia ni cifrado |
| Contrato de privacidad v2: copia JSON estricta, procedencia, razones de bloqueo ordenadas | `server/privacy/operational-v2.mjs`, `server/privacy/provenance.mjs`, `server/privacy/detector.mjs` | Maquinaria offline de fixtures; detector sin validación medida |

Conclusión del mapa: el proyecto ya contiene toda la maquinaria fail-closed que la instrucción necesita. Lo que falta es el **cableado** y las **validaciones**, no conceptos nuevos. La «API de OpenAI que ya tiene el proyecto» es, en código, este transporte OpenRouter gateado; cualquier modelo de OpenAI u otro proveedor llega por esa vía con las mismas restricciones.

## Flujo objetivo (por consulta)

1. **Local primero.** La pregunta entra al asunto en el equipo. Recuperación, biblioteca, horas y originales permanecen locales. Las primeras consultas (captura de datos del asunto, preguntas con datos sensibles sin tratamiento validado) las responde el motor local actual; nada sale del equipo.
2. **Detección y seudonimización local.** El detector local + reglas identifican nombres, RFC/CURP, cuentas, teléfonos, domicilios, expedientes y datos sensibles del sobre completo (pregunta, historial, fragmentos, nombres de archivo, metadatos). Se sustituyen por marcadores estables del asunto (`PERSONA_01` vía H3). La correspondencia original↔sustituto nunca sale; se conserva local, cifrada cuando exista ese almacenamiento.
3. **Puerta de salida (H2).** El sobre serializado completo se clasifica contra la política del asunto. Categorías permitidas hoy: `public` (fuentes jurídicas públicas) y `synthetic`. Un contenido seudonimizado requiere una categoría y una validación del detector que **aún no existen**; hasta entonces la puerta bloquea por diseño (fail-closed).
4. **Transporte (H1) solo tras la puerta.** Si la política concede el destino y la categoría, el transporte envía con ZDR, sin fallbacks, precio máximo cero y recibo de uso verificado. La clave sale de Keychain (H6b) solo para la solicitud inmediata.
5. **Validación y restitución local.** La respuesta vuelve; se verifican citas contra la biblioteca como hoy, se restituyen únicamente marcadores válidos del mismo asunto y cualquier turno posterior vuelve a proteger el texto restituido antes de reutilizarlo.
6. **Degradación honesta.** Sin política, sin detector validado, sin credencial o sin cuota: la tarea se mantiene local y la interfaz lo dice. Nunca se reenvía a otro destino ni se baja la protección automáticamente.

## Puntos de cableado concretos

- Adaptador de generación único: que `service.mjs`, `conversation.mjs` y `proactive-drafts.mjs` dejen de llamar `inference.generate` en crudo y pasen por un punto que decida ruta (local vs. remota) según política del asunto, disponibilidad y validación del detector. Conversación, borradores y propuestas proactivas necesitan la misma puerta.
- Política por asunto: almacén local de grants (ámbito, destino, categorías, versión), visible y revocable en la interfaz; sin grants comodín.
- Persistencia de correspondencias H3: hoy en memoria; requiere almacenamiento con versión, vínculo al documento y cifrado (pendiente el cifrado de aplicación general).
- Categoría nueva en H2 (`pseudonymized`) solo después de la evaluación del detector: umbrales de omisión/falsos positivos medidos sobre corpus sintético mexicano, con la gobernanza de evaluación vigente (dev split; heldout y retirados congelados).
- Selección de modelo: dos perfiles remotos (económico y de mayor capacidad) evaluados a ciegas sobre las mismas tareas antes de elegir; el transporte ya exige precio cero, así que ampliar a modelos de pago es una decisión de gasto separada que requiere autorización expresa.

## Orden propuesto y criterios de aceptación

1. **Transporte simulado (sin red).** Constructor de solicitudes + captura de bytes exactos. Aceptación: corpus sintético con identificadores mexicanos; sobre sin originales ni correspondencias; aislamiento entre dos asuntos; bloqueo ante fallo del detector/formato no soportado; restitución correcta; seguimiento re-protegido. Suite y build verdes.
2. **Adaptador desactivado por defecto.** H1+H2+H3 cableados tras la puerta, `enabled:false` en producto. Aceptación: mismas pruebas contra transporte simulado a través del cableado real; ninguna ruta de generación sin puerta.
3. **Evaluación del detector.** Medición con la gobernanza vigente; categoría `pseudonymized` solo si los umbrales acordados se cumplen. Sin esto, la nube recibe únicamente `public`/`synthetic`.
4. **Corrida remota sintética.** Solo con acceso autorizado, presupuesto definido y modelo `:free` del transporte actual; comparación ciega de calidad, omisiones, costo y latencia.
5. **Piloto.** Cifrado de almacenamiento con restauración comprobada, política efectiva del proveedor revisada, controles de gasto y autorización del despacho para el alcance concreto.

## Límites de este documento

No se eligió modelo remoto, no se activó facturación, no se enviaron datos, no se modificó runtime. Fechas, importes y relaciones con relevancia jurídica no se alteran silenciosamente: si la política impide enviarlos y son necesarios, la tarea se mantiene local o se pide revisión. La seudonimización reduce exposición; no garantiza anonimización. El objetivo de equipos de 8 GB se mantiene para la ruta local.
