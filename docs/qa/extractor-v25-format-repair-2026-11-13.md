# Reparación del extractor v25: variantes de formato de encabezados (2026-11-13)

## Alcance

Diagnóstico y reparación de los 13 documentos `extraction-invalid` de los programas Yucatán y Aguascalientes, autorizada por el coordinador el 2026-11-13 (19:57 CST: "reparación del extractor con fixtures de esos formatos, regresiones y versionado correcto… no re-sellar salidas distintas ni activar contenido"). Sin activación de corpus: todo sigue en cuarentena (`textReview`/`legalReview` pendientes).

## Diagnóstico (causa real verificada contra los PDFs, no supuesta)

El resumen previo atribuía los 13 fallos al formato ordinal «Artículo.- 1o.». La verificación directa del texto extraído por el worker (pdf-parse `pagerender`, no pdftotext) mostró cinco causas distintas:

| Variante | Ejemplo real | Documentos |
|---|---|---|
| Numérica sin espacios (glifos de espacio ausentes en el PDF) | `Artículo1.-Se crea…` | yuc-ley-022, 047, 098 |
| Numérica sin espacios con sufijo ordinal | `Artículo1o.-…` | yuc-ley-117 |
| Viñeta `¬` (U+00AC) envolviendo el encabezado | `¬Artículo 1.-¬ Se crea…` | yuc-ley-039, 043, 101 |
| Viñeta `¬` + ordinal en mayúsculas | `¬ARTICULO PRIMERO.-¬ …` | yuc-ley-097 |
| Ordinal deletreado en minúscula capitalizada | `Artículo Primero.-…` | yuc-ley-029, 032, 040, 045 |
| Ordinal invertido | `Artículo.-1o.…` | yuc-ley-029 (artículo 1) |
| Sin estructura de artículos (no es fallo del parser) | Código de Ética con preámbulo y principios, cero encabezados `Artículo N` en todo el documento | ags-ley-160 |

yuc-ley-011, 012, 015: escaneados sin capa de texto (pdftotext=0), exclusión permanente ya documentada; no son parser-gap.

## Cambios (server/legal-library.mjs, EXTRACTOR_VERSION 24 → 25)

Todos fail-closed, dentro del gate existente de dos pasadas (los caminos nuevos solo corren cuando NO hay ningún encabezado numérico con espacio en todo el documento) y con apertura estrictamente secuencial compartiendo `lastOrd`:

1. Limpieza de viñetas `¬` (U+00AC) al construir líneas, contabilizadas en `coverage.removedBulletGlyphs`. Repara 039/043/101 vía el camino numérico estándar y 097 vía el camino ordinal en mayúsculas existente.
2. `ordinalHeadingTC`: ordinales deletreados en minúscula capitalizada con terminador estricto inmediato (`Artículo Primero.-`). Las referencias de cuerpo ("el artículo primero de esta ley") nunca llevan terminador: no cuelan.
3. `nospaceHeading`: `ArtículoN.-` / `ArtículoNo.-` con terminador `.-` estricto. Una referencia de cuerpo envuelta al inicio de línea ("Artículo65 del Código") no lleva `.-`: no cuela.
4. `reversedOrdinal`: `Artículo.-1o.` con forma rígida completa.
5. Anomalías nuevas de documento: `titlecase-ordinal-heading-mode`, `nospace-heading-mode`, `reversed-ordinal-heading-mode` (cuarentenan todos los registros del documento, coherente con la cuarentena global del corpus).

Sin cambios en `finish()` ni en rutas existentes: los encabezados de las rutas ordinales permanecen en `content` (comportamiento ya vigente para ordinales en mayúsculas).

## Fixtures y regresión

- `tests/extractor-format-variants.test.mjs`: 10 casos sintéticos (cada variante, más fail-closed de desecuencia, ordinal sin terminador, y regresión de que un documento numérico con espacios nunca entra a los caminos nuevos).
- Suite completa: 1170 pass / 0 fail / 33 skipped (antes: 1160 pass; +10 nuevos).

## Verificación contra los PDFs reales (cuarentena, sin re-sellar)

Extractor v25 sobre los snapshots ya adquiridos: 12/12 Yucatán extraen (022: 6 registros; 029: 10; 032: 5; 039: 14; 040: 17; 043: 14; 045: 5; 047: 25; 097: 6; 098: 14; 101: 14; 117: 15). ags-ley-160: 0 encabezados de artículo en el documento completo; queda como brecha documentada de estructura (no parser-gap).

## Pendiente de ejecución posterior

- Re-correr los lotes Yucatán afectados (03, 04, 05, 10, 11, 12) con v25 para cerrar los 12 documentos en los reportes de adquisición y actualizar la contabilidad con sección «Corrección» en el QA de Yucatán (mismo día).
- ags-ley-160: reclasificar la causa en la próxima actualización de contabilidad (sin reescritura del doc histórico de AGS).

## Addendum v26 (2026-11-13, mismo día): límite de páginas del worker

Causa de nay-ley-148 (Presupuesto de Egresos Nayarit 2026, 1,376 páginas, 20,324,463 B bajo techo duro): cap de 1,200 páginas del worker (`PDF page coverage incomplete`). Verificado antes del cambio sobre el snapshot real: con cap 2,000 parsea 1,376/1,376 páginas en ~12 s y ~77 MB heap (límites worker 120 s / 768 MB). Cambio: `EXTRACTOR_MAX_PAGES=2000` exportado, `EXTRACTOR_VERSION=26`, test de contrato añadido. Sobre el cap se sigue fail-closed. Re-corrido nay-leyes-15b: nay-ley-148 cuarentenado con 99 registros. Suite completa: 1171 pass / 0 fail / 33 skipped. Sin gasto ni cambio de condiciones.
