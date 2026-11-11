# S1: ejemplos de desarrollo de tareas jurídicas

`development.jsonl` contiene **12 ejemplos escritos por un agente Sol de SF independiente del constructor**: seis de investigación y seis de revisión contractual. Son datos de desarrollo visibles, no un examen ciego ni un conjunto de aceptación congelado. El plan de 30 casos sigue propuesto; estos 12 no lo completan.

Todos los textos, fuentes, fechas, versiones e importes son expresamente ficticios y sintéticos. Los códigos de jurisdicción son identificadores de esquema, no evidencia de derecho. Las etiquetas negativas `confidential` y `unknown` aparecen juntas en un caso de rechazo de preparación con texto inventado; no contienen información privada real y ese caso no aísla el rechazo individual de cada etiqueta.

Cada línea tiene exactamente `id`, `input`, `expectedPreparation`, `candidateOutput`, `expectedOutput`, `description` y `behavioralExpectation`. Solo el caso rechazado en preparación tiene candidato y expectativa de salida nulos. Los hashes de texto son SHA-256 UTF-8; `requestSha256` usa SHA-256 de `canonicalJson(input)` de `server/canonical-json.mjs`. Cambiar una entrada requiere recalcular su digest. Los casos de salida negativa alteran el candidato expresamente.

La cobertura incluye cita falsa, versión falsa, mezcla de jurisdicción, cobertura elevada de extracto a completo, preferencia comercial presentada como ley, campo fuera del contrato, jurisdicción/fecha y rol faltantes, instrucciones maliciosas dentro de fuentes tratadas como datos y abstención sin fuentes. Son contrastes acotados; los tests del constructor cubren más combinaciones.

Comprobación offline desde la raíz:

```sh
node scripts/check-legal-task-skills.mjs
```

El comando comprueba preparación y contratos; no ejecuta inferencia ni llama proveedores. Las descripciones, expectativas y rúbricas permanecen locales, fuera del paquete de modelo. No enviar el objeto completo del caso como input.

Las salidas de ejemplo fueron redactadas por ese agente Sol como fixtures; no se obtuvieron ejecutando estas skills contra los modelos/proveedores candidatos ni en una comparación con/sin skill. Una aceptación significa exclusivamente consistencia estructural con el contrato: no prueba exactitud jurídica, implicación de las citas, vigencia, exhaustividad, resistencia conductual a inyección ni calidad de conversación. `behavioralExpectation` expresa una rúbrica para evaluación posterior, no una conducta ya comprobada por el validador. Tampoco constituye una ablación real, evaluación de detector de privacidad, autorización de egreso ni activación de proveedor.

S2 deberá reservar aceptación independiente y congelada, y comparar con/sin skill bajo igual modelo, contexto y presupuesto. No usar los conjuntos privados retirados ni ajustar estos ejemplos contra un examen de aceptación. Estos fixtures no justifican un ganador de modelo, activación del producto, cobertura nacional ni validación profesional.
