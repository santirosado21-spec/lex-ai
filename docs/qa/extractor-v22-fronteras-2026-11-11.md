# Extractor v22 — corrección de fronteras de artículos y rúbricas editoriales

Fecha: 2026-11-11. Estado: implementación local para revisión; NO integrado, NO aprobado como textReview/legalReview; corpus en cuarentena.

## Alcance

Corrección de los defectos confirmados por la revisión independiente sobre v17:

- Pérdida/absorción de artículos sufijados (Clases 1a/1b): LGSMIME 21/43/77 (+sufijados), 78-BIS; REG_SENADO 56 (+4 sufijados), 265-BIS.
- Truncamiento de cuerpo por guardia de sección y pendingSection (Clase 2a: LGSMIME 12/37/56/63, REG_SENADO 25).
- Filtro de cabecera CÁMARA insensible a mayúsculas comiendo líneas de cuerpo (Clase 2b: REG_SENADO 221).
- Retrovisor de fragmentos a media oración ciego a subtítulos descartados (Clase 3: 265-Bis).
- Inclusión de rúbricas editoriales sin ordinal al final de registros (LOEFAM: lista de 43 registros de la revisión).
- Negativo nuevo del revisor: ruta noTerm capturaba "Artículo 21 Bis" como 21 plano con 20 vigente (cita espuria).

## Cambios (server/legal-library.mjs, EXTRACTOR_VERSION=22)

1. noTerm con lookahead negativo anti-sufijo (Bis/Ter/Quáter/Quinquies/...): la cita "Artículo 21 Bis" ya no abre 21 plano.
2. Ruta noTermSuffix: encabezados pegados con sufijo sin terminador ("Artículo 43 Ter Se resolverá…") abren N-SUFIJO; subnumeración romana con coma ("ARTICULO 208 BIS II, (DEROGADO…)") conserva el romano en el id.
3. Ruta bareSuffix: encabezado desnudo con sufijo en línea exacta abre N-SUFIJO solo inmediatamente después de su base numérica; si no, queda como cuerpo + anomalía unmatched-suffixed-heading-in-body.
4. Guardia de sección: solo descarta si la línea previa cerró oración o la línea es ALL-CAPS pura; si no, conserva como cuerpo + contador keptAmbiguousStructuralLines + anomalía documental mid-sentence-structural-line-kept-as-body.
5. pendingSection acotado a 2 líneas de subtítulo (secSkip contabilizadas); la 3ª regresa a cuerpo + anomalía section-discard-exceeded-2-lines.
6. Retrovisor de fragmentos salta líneas secSkip.
7. Filtro de cabecera ^CÁMARA DE DIPUTADOS ahora sensible a mayúsculas.
8. Recorte de rúbricas editoriales finales: (a) línea completa (título "De las X", ALL-CAPS ≤8 palabras sin punto final y con línea previa cerrada, "Servicio/Cuerpo…", Generalidades/Disposiciones, nota pegada "… Subsección adicionada DOF …", 3 hardcodeadas heredadas); (b) sufijo pegado en línea final tras cierre de oración (nota DOF, "Generalidades" tras fecha DOF, título/servicio, rúbrica ALL-CAPS solo si el prefijo tiene minúsculas, protegiendo documentos íntegros en mayúsculas); (c) "Derogado Del X" heredado. Tope 2 recortes por vía por registro; todo recorte va a editorialNotes del registro + contador coverage.removedTrailingRubrics + muestras coverage.discardedSamples.

## Iteraciones locales (trazables en el ledger inmutable de artifacts/)

- v18 (legal-library-18): primera implementación; la verificación encontró que "ARTICULO 208 BIS I/II" (Código Penal NL) perdía el romano → id duplicado 208-BIS → paro fail-closed por reinicio de numeración (solo 241 registros).
- v19: corrección del romano; la verificación encontró que el recorte ALL-CAPS sin guardas comía líneas de cuerpo reales en documentos en mayúsculas (411 líneas en Código Penal NL) y que 8 rúbricas LOEFAM seguían pegadas en línea (no línea propia).
- v20/v21: guardas del recorte (sin punto final, ≤8 palabras, línea previa cerrada) + recorte inline; la verificación mostró 4 casos (23/31/32/138) donde la rúbrica llega envuelta en 2 líneas o pegada tras nota DOF y no se recortaba.
- v22: recorte inline sobre el texto unido del registro. Verificación completa a continuación.

## Verificación (todo contra la capa pdfjs real, no pdftotext)

1. Suite completa: 1176 pruebas, 1143 pasan, 0 fallas, 33 omitidas (preexistentes). 14 pruebas nuevas de fronteras/rúbricas, incluidos negativos: cita "Artículo 21 Bis" no abre 21; "Artículo 43 Ter de la presente ley" queda como cuerpo; línea de cuerpo en mayúsculas ("MISMO O CAUSEN SUS EFECTOS EN EL.") nunca se recorta; "B. Soldado Marinero" (tabla) nunca se recorta; 208 BIS I/II abren ids distintos sin paro.
2. Re-extracción offline de los 46 documentos disponibles (7 lotes): todos state complete, 0 fallas.
3. Diff v17→v22 por documento: 15 articleIds agregados (21-BIS, 43-BIS, 43-TER, 77-BIS, 77-TER, 78-BIS, 265-BIS, 56-BIS, 56-TER, 56-QUATER, 56-QUINQUIES, 208-BIS, 208-BIS-I, 208-BIS-II, 299-TER), 0 eliminados; todos los textos cambiados clasificados por causa (recorte de rúbrica, encabezado sufijado movido a su propio registro, línea a-media-oración restaurada); 0 cambios sin clasificar.
4. Censos: LGSMIME 118, LOEFAM 233, REG_SENADO 317 (esperados de la revisión).
5. Barrido de firmas de encabezados sufijados dentro de cuerpos: 0 (excluyendo la primera línea de cada registro, que es su propio encabezado).
6. LOEFAM contra la lista de 43 registros del revisor: 39 con rúbrica eliminada y trazable en extractionDiagnostics.editorialNotes; 136/165/166 verificados limpios (las rúbricas vecinas se recortan en 167); 130 ("B. Soldado Marinero") CONSERVADO a propósito — fragmento de tabla de equivalencias, clase ambigua: la revisión lo cuenta como contaminación, la protección anti-tabla lo conserva. Punto abierto de diseño para la revisión posterior.
7. Reconciliación pdfjs real de 33 artículos clave (lgsmime 12/21/21-BIS/37/43/43-BIS/43-TER/56/63/77/77-BIS/77-TER/78-BIS; reg-senado 25/56/56-BIS/56-TER/56-QUATER/56-QUINQUIES/221/265/265-BIS; loefam 21/23/31/32/75/77/95-QUINQUIES/130/138/156/170): todas las líneas del tramo del artículo o están en el registro o pertenecen a una clase de remoción conocida y contabilizada (cabeceras, notas de reforma, rúbricas de sección, rúbricas editoriales trazadas). 0 líneas de cuerpo sin explicación.
8. LGSMIME 37 recuperó su texto completo (4301 caracteres; en v17 perdía ~4000).

## Anomalías documentales en v22 (esperadas, fail-closed)

- LGSMIME y REG_SENADO (y otros 15 documentos): mid-sentence-structural-line-kept-as-body y/o section-discard-exceeded-2-lines — líneas estructurales ambiguas conservadas como cuerpo y contabilizadas en lugar de descartadas en silencio. Estos documentos NO deben tratarse como limpios; quedan en cuarentena con anomalía.
- LOEFAM: sin anomalías; 39 recortes trazables + art 130 conservado como caso ambiguo documentado.
- nuevo-leon-pending-03 mantiene operative-numbering-restarts-before-transitory-boundary (preexistente en todas las generaciones: la fuente reinicia numeración en "1"; el paro fail-closed es el comportamiento diseñado).

## Limitaciones conocidas

- En documentos íntegramente en mayúsculas, una rúbrica editorial pegada en línea tras ". " es indistinguible de una frase de cuerpo: se conserva (no se recorta). Cobertura de rúbricas en esos documentos limitada a líneas completas con las guardas indicadas.
- Encabezados estructurales con ordinal sufijado ("TÍTULO TRECE BIS") o con error de la fuente ("TIULO SEXTO") no los reconoce la ruta de secciones; llegaban al cuerpo (preexistente) y ahora se recortan como rúbrica trazable. Sin pérdida de contenido de artículos.
- La nota "Subsección adicionada DOF" suelta como línea propia (sin rúbrica previa) no se recorta (sin evidencia de caso real en el corpus disponible).

## Lo que NO se hizo

Sin integración, sin re-freeze, sin exports-v3, sin push, sin cloud, sin gasto, sin re-descarga de corpus. El corpus re-extraído permanece en cuarentena (textReview/legalReview: pending); las anomalías impiden tratar cualquier resultado como aprobado.
