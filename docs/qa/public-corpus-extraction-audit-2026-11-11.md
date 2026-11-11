# Auditoría de extracción del corpus público — 2026-11-11

**Alcance.** Verificación estructural de las extracciones generadas desde los snapshots oficiales adquiridos el 2026-11-11 (10 documentos federales en `artifacts/public-corpus/pilot/`, 8 documentos de Nuevo León en `artifacts/public-corpus/pilot-mx-nle-2026-11-11/`). Esta auditoría mide cobertura e integridad de extracción; no es validación jurídica del contenido.

## 1. Método

Script de solo lectura `scripts/public-corpus-extraction-audit.mjs`, que por cada documento:

- recorre la cadena de integridad del reporte de adquisición (`loadPublicAcquisitionReport`) y verifica que cada extracción corresponde a un snapshot adquirido;
- recalcula `textSha256` y `contentSha256` de cada registro y los compara con los almacenados;
- detecta registros vacíos, `articleId` duplicados y numeración no monótona;
- verifica fragmentos canónicos puntuales en documentos seleccionados (`cpeum`, `cff`, `lft`, `lfda`);
- cuando un documento tiene varias extracciones (versiones del extractor), audita solo la más reciente.

## 2. Cambios del extractor verificados en esta auditoría

La revisión de cobertura encontró cinco formatos editoriales reales de los PDF oficiales que la versión 6 no segmentaba, y se corrigieron de forma determinista (versión actual: 12):

1. **Encabezados abreviados `Art. N.-`** (códigos de Nuevo León; la v6 solo aceptaba `ARTÍCULO`/`Artículo`). Sin esta forma, el Código Civil de NL producía 2 registros.
2. **Sufijos bis con numeral romano multicaracter** (`Art. 1053 Bis IX.-`, `Art. 410-Bis-II.-`, `Artículo 180 Bis. IV.-`). La v6 capturaba un solo carácter y colapsaba `410-Bis-II` sobre `410-BIS`, lo que disparaba la guardia de duplicados.
3. **Encabezados de artículo derogado con marcador entre paréntesis** (`Art. 37 (DEROGADO, P.O. 28 DE NOVIEMBRE DE 2008)`), sin terminador `.-`: se segmentan y quedan en cuarentena como marcador de derogación, en vez de plegarse en el artículo anterior.
4. **Encabezados secuenciales sin terminador** (`ARTICULO 355 AL RESPONSABLE DEL DELITO...`, donde el PDF oficial perdió el `.-`): se aceptan solo con tres guardas simultáneas — el artículo en curso existe, el número es exactamente el siguiente de la serie, y la línea sustantiva anterior cierra enunciado (saltando notas editoriales). Las palabras del encabezado se conservan en el texto del artículo. Un fragmento de referencia con la misma forma se sigue plegando porque su línea previa no cierra enunciado.
5. **Fragmentos de referencia cruzada al inicio de línea** (`... A LO DISPUESTO POR EL` / `ARTICULO 96.`). Una referencia interna partida por salto de línea en el PDF original simulaba un encabezado nuevo y detenía la extracción por numeración reiniciada. La regla actual pliega el fragmento en el artículo en curso cuando la línea anterior no cierra enunciado o cuando la línea siguiente es otro encabezado; los encabezados reales en línea propia (p. ej. `Artículo 26.` de la CPEUM, precedidos de cierre de enunciado y seguidos de cuerpo) se conservan.

Pruebas de regresión añadidas en `tests/legal-library.test.mjs` para las cinco formas (16/16 pruebas del archivo pasan).

## 3. Resultados

### Corpus federal (`pilot/`)

| documento | registros | anomalías |
| --- | ---: | --- |
| ccf | 3,085 | 0 |
| ccom | 1,641 | 0 |
| cff | 421 | 0 |
| cpeum | 136 | 0 |
| cpf | 546 | 0 |
| lamp | 272 | 0 |
| lfda | 254 | 0 |
| lfpc | 188 | 0 |
| lft | 1,266 | 0 |
| lgsm | 277 | 0 |
| **total** | **8,086** | 0 |

Control de falsos positivos: los 10 conteos son idénticos a los de la versión 6 (línea base ya verificada), es decir, las extensiones de la gramática no abrieron encabezados nuevos en los formatos federales.

### Corpus Nuevo León (`pilot-mx-nle-2026-11-11/`)

| slot | registros (v6 → v11) | anomalías |
| --- | --- | --- |
| nuevo-leon-pending-01 (Código Civil) | 2 → 3,088 | 0 |
| nuevo-leon-pending-02 (Código Penal) | 100 → 589 | `no-explicit-transitory-boundary` |
| nuevo-leon-pending-03 (Código de Procedimientos Civiles) | 185 → 1,202 | `operative-numbering-restarts-before-transitory-boundary` |
| nuevo-leon-pending-04 | 211 | `no-explicit-transitory-boundary` |
| nuevo-leon-pending-05 | 64 | `no-explicit-transitory-boundary` |
| nuevo-leon-pending-06 | 55 | `no-explicit-transitory-boundary` |
| nuevo-leon-pending-07 | 229 | 0 |
| nuevo-leon-pending-08 | 172 | 0 |
| **total** | **5,610** | — |

La auditoría automática sobre ambos directorios termina sin hallazgos: cadena de integridad completa, hashes recalculados coincidentes, sin registros vacíos, sin duplicados, numeración monótona dentro de cada serie extraída.

## 4. Limitaciones conocidas (cobertura, no validación jurídica)

1. **NL-03 segunda serie de numeración.** El Código de Procedimientos Civiles de NL contiene, tras el artículo 1128, un `TITULO ESPECIAL DE LA JUSTICIA DE PAZ` cuya numeración reinicia en 1. La guardia de reinicio (fail-closed por diseño) detiene la extracción ahí: los 1,202 registros cubren la numeración principal completa (1–1128) y la serie especial queda en cuarentena. Incorporarla requiere una decisión de modelado (p. ej. espacio de identificadores por serie), no un cambio silencioso del extractor.
2. **Documentos sin marcador TRANSITORIOS.** NL-02, NL-04, NL-05 y NL-06 no contienen una línea `TRANSITORIOS` reconocible en el texto del PDF; se registran con `no-explicit-transitory-boundary` y sus artículos quedan en cuarentena estructural según la política vigente.
3. **Análisis de huecos de numeración.** Tras la v12, los huecos numéricos restantes se verificaron contra el texto de los PDF oficiales: en NL-01 faltan 149, 871, 893, 971 y 1511 porque el PDF oficial no contiene esos encabezados (derogados y removidos por el editor oficial, no omisiones del extractor); en NL-02 no queda ningún hueco (el 355 se recuperó con la forma sin terminador). El artículo 37 de NL-01 existe solo como marcador de derogación y así quedó registrado. La numeración de la CPEUM y el CFF no tiene huecos.
4. Los fragmentos canónicos verificados son puntuales (4 documentos); la igualdad de hashes y las guardias estructurales cubren el resto, pero no sustituyen una revisión jurídica del contenido.

## 5. Reproducción

```bash
node scripts/public-corpus-extraction-audit.mjs artifacts/public-corpus/pilot artifacts/public-corpus/pilot-mx-nle-2026-11-11
```

Termina con `ok: true` en ambos directorios al 2026-11-11 (extractor v12). Las re-extracciones se ejecutaron en modo `--offline` sobre los snapshots adquiridos, sin nuevas descargas; la cadena snapshot → extracción → registro permanece verificable por hash.
