# Trade address / false-positive dev set v1 (DEV ONLY, measurement)

- Fully invented names, streets and companies. No real data. Not heldout; never combine with eval/privacy heldout.
- `dev-addresses-v1.jsonl`: 24 positives (foreign and Mexican addresses; with and without cue words, uppercase, multiline, inline in prose, pdf-items flattened) and 25 negatives (customs headers/lines that contain no personal data).
- Primary metric: STRICT span coverage, i.e. the union of detections must cover the whole address span. Overlap coverage is reported only as secondary.
- Negatives: any detection counts as a false positive (over-redaction).
- Residual check: masking the detections in the text and testing whether the address text is still present. This is a text proxy, NOT the cloud route; the route byte assertions are a separate harness.
- This set is a measurement, not acceptance, and was not used to tune any rule.

## Known limits of the metrics
- Route "token leak" ignores address tokens shorter than 4 characters (for example UK postcode halves such as "BS1" "4XY"), so it undercounts leakage. Strict span coverage is the primary metric.
- Negatives through the route are reported in three groups: sent unchanged, sent altered by masking (damaged document text) and blocked.
- Set written by one author, small, one style per country. Measurement only, not acceptance.

The Spanish/English indirect-logistics development files are synthetic. The 14 first cases measure whole-identifier concealment and whether legally useful expressions survive. The 8 additional cases include distinctive roles and locations. Those cases informed a subsequent fix. Both sets are visible development material. Run the actual local importer with `node scripts/check-pilot-local-privacy.mjs --indirectos` or `--transferencia`. Report exact restoration separately from detectability, privacy of the cloud envelope, and legal quality.

The 10 `--control` examples were subsequently used to diagnose omissions and improve local review. The 6 `--seguimiento` examples were written after that adjustment. They have the same author and are not an independent acceptance exam. All values are fictitious.

## Control posterior a r20 · comercio y defensa

`expedientes-defensa-r20.json` contiene seis documentos ficticios en tres pares. Un modelo local propuso los escenarios iniciales. Se revisó su redacción, se retiraron referencias jurídicas inventadas y se fijaron las anotaciones antes de ejecutar el importador. El lote incluye tres folios que aparecen una vez en cada documento del par, seis indicios contextuales y diez expresiones que deberían seguir siendo legibles. Un indicio se considera cubierto sólo cuando se ocultan todas sus letras y números. Una expresión útil se conserva cuando sigue íntegra.

Para reproducir la evaluación, ejecuta `node scripts/check-pilot-paired-privacy.mjs eval/privacy-trade/expedientes-defensa-r20.json` con el modelo de privacidad del piloto disponible en Ollama. Con r20, el 19 de noviembre de 2026, se restituyeron los seis originales. La evaluación conjunta cubrió las seis apariciones de folios y cinco de seis indicios. Sólo cuatro de diez expresiones útiles quedaron íntegras después de la sustitución. Los documentos ordinarios de este conjunto aportaron cero líneas literales elegibles para enviar. El resultado individual coincidió con el conjunto. Las métricas miden la representación local y no acreditan anonimización general. Los ejemplos son material de desarrollo desde la primera ejecución.

### Reserva r21

`expedientes-reserva-r21.json` contiene seis textos ficticios en tres pares. Un modelo local propuso ejemplos. Se editaron y anotaron antes de ejecutar la evaluación. SHA-256 del archivo evaluado: `732dae0bacc1d290bf10a9d5fd0f7e9a61c5e8f5f994bbf62ed0de77a5c944b1`. La reserva ya se utilizó para comparar r20 y r21. Para medir un cambio posterior se necesita otra muestra inédita. Los resultados por documento se guardan en `artifacts/privacidad-r21/`.

### Conversación libre de valoración · r22

La prueba local `node scripts/measure-intake-dialogue.mjs` usa una factura, un anexo, una pregunta y un seguimiento ficticios. Un modelo local propuso el escenario. Se editaron los textos, se anotaron los identificadores, indicios y fragmentos útiles, y se congeló el archivo antes de probarlo. SHA-256 de `dialogo-valoracion-r22.json`: `d33511b584a7b1818986047aada99a8ada9590f684b2e14f5f87dff07aec38fe`. El cliente figura en el alta. Para inspeccionar cada documento, Ollama recibe las identidades que la aplicación ya conoce. El evaluador usa las anotaciones únicamente al puntuar el resultado. Las preguntas se proyectan sobre el expediente en memoria para medir un posible intercambio de texto libre. Los únicos accesos de inferencia en este ensayo son a Ollama en loopback.

En este caso se restituyeron cuatro originales, se cubrieron las ocho menciones anotadas de identidades y folios y se conservaron las tres relaciones entre sus menciones. Quedaron expuestos total o parcialmente los tres indicios de lugar o acontecimiento. Cinco de siete fragmentos útiles quedaron íntegros. El seguimiento perdió texto de la petición documental y sobre quién asumió el seguro. Ninguna línea quedó habilitada para envío. Es un solo escenario de desarrollo. Una prueba posterior necesita una muestra distinta y la revisión de un abogado.

### Comparación de diálogos en r23

Las propuestas ficticias de regalías y origen se editaron y anotaron antes de medirlas. Sus huellas están en `artifacts/dialogo-r23/reservas.sha256`. Se usaron durante el desarrollo. Después se congeló `dialogo-retorno-reserva-r23.json` con SHA-256 `984e82b995012d8eafeb218edd30746f215b46e95508d81573c8f683a948607d` y se compararon las dos ediciones. El guion acepta `--app=ruta/al/paquete` para ejecutar exactamente el código de cada edición. Los archivos `reserva-retorno-r22.json` y `reserva-retorno-r23.json` de ese directorio contienen la puntuación por documento, la pregunta y el seguimiento. La comparación de los cuatro diálogos se encuentra en el informe del piloto.
