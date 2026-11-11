# Propuesta de espacio de identificadores para la segunda serie de NL-03 — 2026-11-11

**Estado: PROPUESTA. Nada de este documento adopta un modelo ni modifica el extractor.**

## 1. Hechos verificados (snapshot oficial adquirido, reforma declarada 10-jun-2022)

- El Código de Procedimientos Civiles del Estado de Nuevo León (`nuevo-leon-pending-03`) numera su serie principal 1–1128 y, tras ella, incluye un **TITULO ESPECIAL DE LA JUSTICIA DE PAZ** cuya numeración reinicia en 1 y llega a **87** (inspección del 2026-11-11 sobre el texto del PDF: encabezados "Artículo 1.-" … "Artículo 87.-" completos, sin huecos; artículo 42 y 84 presentes).
- Después de la serie especial vienen "DISPOSICIONES FINALES" (Tribunal Virtual, arts. 84–87 de la misma serie) y luego "ARTICULOS TRANSITORIOS:".
- La guardia fail-closed del extractor (`operative-numbering-restarts-before-transitory-boundary`) detiene la extracción al encontrar el reinicio: la serie principal (1,202 registros) quedó extraída y auditada; la serie especial está íntegra en el snapshot pero no segmentada.

## 2. Opciones de modelado

**Opción A — Sufijo de serie en el identificador.** La serie especial se segmenta como el mismo documento con `articleId` de la forma `JP-1` … `JP-87` (o `S2-1`…). La guardia de reinicio se relaja SOLO cuando hay un encabezado de sección verificado (`TITULO ESPECIAL`) inmediatamente antes del reinicio, y la numeración de la segunda serie también se verifica monótona. Pro: un solo documento por código, citas internas coherentes ("artículo 5 de este Título"). Contra: el articleId deja de ser la cita textual literal ("artículo 5" a secas), hay que documentar el prefijo.

**Opción B — Documento separado.** La serie especial se trata como instrumento propio (`MX-NLE-CPC-JUSTICIA-PAZ`) con su versión y proveniencia apuntando al mismo snapshot. Pro: numeración literal 1–87 sin prefijos; la guardia de reinicio no se toca (cada documento es monótono). Contra: artificialmente divide un solo cuerpo legal; el "documento" no existe como tal en la fuente.

**Opción C — Mantener cuarentena.** No segmentar la serie especial; el corpus declara la cobertura 1–1128 y la limitación permanece documentada. Pro: cero riesgo nuevo. Contra: 87 artículos operativos (justicia de paz, tribunal virtual) fuera del corpus.

## 3. Recomendación de análisis (no adoptada)

La **Opción A** es la menos artificial: la fuente es un solo cuerpo y las citas cruzadas internas ("de este Título") se conservan. Su riesgo principal (relajar la guardia de reinicio) se acota exigiendo: (i) encabezado de sección capturado en `pendingSection` inmediatamente antes del reinicio; (ii) la segunda serie reinicia exactamente en 1 y se verifica monótona hasta el marcador TRANSITORIOS; (iii) cualquier desviación reactiva el fail-closed con anomalía. El prefijo debe derivarse del encabezado real de la sección, no inventarse: p. ej. `TEJP-1` por "TITULO ESPECIAL DE LA JUSTICIA DE PAZ", registrado en el documento como `seriesId`.

La **Opción B** es aceptable si el producto prefiere no explicar prefijos, a costa de una división inexistente en la fuente.

## 4. Qué NO incluye esta propuesta

- No cambia la guardia de reinicio para ningún otro caso: reinicios sin encabezado de sección verificado siguen deteniendo la extracción.
- No afirma vigencia ni validez jurídica de la serie especial; `declaredAmendedAt` del documento sigue siendo 2022-06-10 declarado por la fuente.
- No propone adoptar nada: la elección es decisión del proyecto.
