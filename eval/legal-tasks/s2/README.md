# S2a — aceptación independiente congelada

Ocho casos nuevos: cuatro investigación y cuatro revisión contractual. Autor independiente del constructor del ejecutor; ningún caso proviene de fixtures S1 ni del examen privado retirado. No se leyó ese examen. No hubo generación de respuestas, llamadas a proveedores/modelos ni revisión profesional. Criterios locales separados de inputs; nunca serializar rúbricas, IDs de evaluación o notas al modelo. Estado congelado antes del primer intento live. Cualquier cambio requiere nuevo freeze y revisión previa a live, nunca ajuste tras observar salidas.

## Procedencia y alcance

Preguntas, contratos, preferencias y cuatro reglas sintéticas fueron inventados para este piloto; no son documentos de clientes ni derecho real. Dos casos de investigación usan exclusivamente artículos 6/7 y 21 del CCF de Cámara de Diputados. Autor verificó literalmente los pasajes contra PDF oficial abierto vía web el 2026-11-10T00:13:38.189Z; texto con saltos de línea convertidos a espacios, sin cambiar palabras o puntuación. Páginas físicas 1 y 3 (índices PDF 0 y 2). URL: https://www.diputados.gob.mx/LeyesBiblio/pdf/CCF.pdf. Cabecera observada: última reforma DOF 14-11-2025; esto no verifica vigencia al asOf.

Captura pública C1: 2026-11-09T23:38:56.066Z; PDF SHA256 `4d4090f60137ce0d82bf321c24c962f698c407910fc94ebeb34b49d0a4236a76`; versión `ccf@sha256:4d4090f60137ce0d82bf321c24c962f698c407910fc94ebeb34b49d0a4236a76`. Artefacto de consulta: `artifacts/public-corpus/c1-final-pilot-20261109/extractions/ccf/4d4090f60137ce0d82bf321c24c962f698c407910fc94ebeb34b49d0a4236a76/c7dbfc4ac8c67deac2afc7c5008cb5d6917d3e7369a22f85aefa80f4be08e689.json`. Los pasajes se cotejaron también con sus registros C1 y hashes UTF-8; cada sourceEvidence registra página, timestamp, versión y hash exacto. Sólo estos textos seleccionados se etiquetan text-reviewed para evaluación. La captura/extracción C1 permanece en cuarentena: sin promoción, indexación ni habilitación de fuentes del producto. No se verifica integridad o exhaustividad de toda la ley.

Las rúbricas evalúan sólo fidelidad a textos suministrados, excepciones adversas, límites y ambigüedad. El pase estructural se mide aparte mediante S1; humanReviewRequired no concede puntos de calidad. No contienen salidas modelo prefabricadas. Un pase no acredita exactitud jurídica general, cobertura nacional, aplicabilidad, vigencia, calidad conversacional general ni validez profesional. Presupuestados para salida de 2500 tokens, con inputs compactos; la longitud final de wrapper+skill+esquema debe verificarla el ejecutor antes de live.

## Freeze

- cases.jsonl SHA256: `8ccdba8a3af46e6e48f4324fd3ef9d91c7b6657ff891bd71bf0e36ae7020f89d`
- rubrics.json SHA256: `677883dcbfc607fe44720af9bde44715a0667ed7e45d76d40dcebe4070bcc5a3`
- Freeze autor: 2026-11-10T00:13:38.189Z

Estos archivos son aceptación exclusivamente del piloto S2a y permanecen sin usar hasta revisión del coordinador y del arnés. Al abrirlos para evaluación se retiran de aceptación para futuras afinaciones; cualquier afinación posterior necesita casos nuevos independientes. README no se incluye en su propio hash; el coordinador puede registrar el SHA externo del archivo completo.
