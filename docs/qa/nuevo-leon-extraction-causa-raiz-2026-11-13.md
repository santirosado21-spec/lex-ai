# QA — Causa raíz de los 6 fallos nuevo-leon-extraction y reconciliación — 2026-11-13

CORRIGE claims anteriores (docs del 2026-11-12 y reportes asociados) que atribuían los
6 fallos de `tests/nuevo-leon-extraction.test.mjs` a "dependencia del ambiente Linux de
desarrollo remoto". Esa atribución era una HIPÓTESIS sin verificar y era INCORRECTA:
los fallos se reproducen en cualquier máquina a HEAD ≥ 5795147, incluida la Mac.

## Causa raíz (verificada por repro)

1. `scripts/extract-nuevo-leon-research.mjs` está CONGELADO por diseño al parser pineado:
   `FROZEN_HASHES['server/legal-library.mjs'] = 84d8eb4d…` (= legal-library.mjs @ 03f47d7,
   `EXTRACTOR_VERSION=22`) y `quarantineExtraction` exige `raw.extractorVersion === 22`.
   En producción, `verifyInputs` rechaza cualquier otro parser con `source-drift`:
   comportamiento intencional y correcto.
2. Los fixtures del test envolvían el `extractArticles` VIGENTE. El bump federal a
   `EXTRACTOR_VERSION=24` (commit 5795147) hizo que el fixture entregara
   `extractorVersion: 24` → rechazo `parser-provenance` → `partial-quarantine` → 6 fallos.
3. Repro mínima ejecutada: `runResearchExtraction` con fixture sintético →
   `nl-civil state=failed errorCategory=parser-provenance`. Confirmado.

## Reconciliación (mínima, sin tocar producción ni corpus)

Los fixtures ahora emulan el parser PINEADO (que es lo que la herramienta de producción
exige): parsean con el código vigente y re-sellan `extractorVersion: 22`, con comentario
explícito en el test. No se modificó `extract-nuevo-leon-research.mjs`,
`server/legal-library.mjs`, artefactos ni corpus. Las compuertas de producción
(`verifyInputs`, `source-drift`, pin 22) quedan intactas; las pruebas negativas de
`parser-provenance` siguen existiendo y pasando.

## Resultado

- `tests/nuevo-leon-extraction.test.mjs`: 15/15.
- Suite completa `npm test`: 1159 pass / 0 fail. PRIMERA suite verde desde el bump v24.

## Límites de claims (sin cambios)

Corpus en cuarentena; única revisión independiente de contenido = extractor v22 sobre
5 PDFs. Suite verde es una propiedad del código y sus fixtures sintéticos, NO una
validación de contenido ni de procedencia del corpus.

## Verificación de fidelidad del re-sello (ampliación 13:16)

El re-sello NO se apoya en la etiqueta: se demostró equivalencia contra el parser v22
REAL pineado (`legal-library.mjs@84d8eb4d`, extraído de git a /tmp, no versionado):

- `extractArticles` v22-pineado vs v24-vigente sobre los TRES inputs sintéticos exactos
  de los fixtures (artículo base, encabezado abreviado `Art. 1o.-`, y
  `Última Reforma 02/01/2025`), mismo source/metadata.
- Resultado: salidas deep-equal en todos los campos EXCEPTO `extractorVersion`
  (records, textSha256, coverage, declaredAmendedAt, versionId). 3/3 idénticos.
- Conclusión: en estos inputs, v22 y v24 solo difieren en el sello; re-sellar el
  fixture a 22 reproduce fielmente lo que el parser pineado habría entregado.

Guardia permanente: nuevo test `parser vigente SIN el sello del parser pineado sigue
rechazado (compuerta parser-provenance)` — la salida real v24 sin re-sello produce
`partial-quarantine` + `errorCategory=parser-provenance`. La compuerta negativa queda
probada en cada corrida, no asumida.

Si un futuro bump del extractor cambia la salida en estos inputs, la equivalencia debe
re-verificarse contra el parser pineado; el re-sello no se extiende por inercia.

`tests/nuevo-leon-extraction.test.mjs`: 16/16. Verde = prueba fiel, no corpus validado.
