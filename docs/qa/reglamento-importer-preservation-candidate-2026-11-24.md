# Diagnóstico y candidato aislado de preservación del Reglamento

24nov2026,09:17 America/Mexico_City. Candidato experimental, no integrado al importer ni a la app. PDF/corpus activo intactos.

## Diagnóstico antes

`parsePdfInWorker` actual ejecutado sin cambios sobre elPDFoficialSHAregistrado, dos rutas: default/pdf-parse y Poppler explícito. Resultados en artifacts/library-expansion-20261124/importer-{default,poppler}-diagnostic.json; resumen en importer-diagnostic-summary.json.

Ambos:282artículos cuarentenados/exportables0; frontera transitoriosp81;13registros transitorios. Arts34/38-Climpios sin títulos pegados y88reconocido. No se reimplementó corrección histórica.

Defecto reproducido: ningún registro transitorio referencia pp82–87, aunque contienen extractos anexos RGCE. P88–89se mezclan en un registro144que absorbe encabezado de decreto. No es pérdida del PDF original, sino falta de cobertura de la representación derivada.

Siete artículos difieren entre parsers:6-A,41,105,110,117,158,236. Poppler desplaza romanos y genera36Aenart117, mientras default conserva36- A. No se eligió Poppler como reemplazo ni se corrigió silenciosamente ninguno.

## Candidato después

En directorio aislado `artifacts/library-expansion-20261124/experiment/`:
- post-body-source-segments.mjs: función aditiva que preserva páginas de texto fuente sin tocar registros existentes.
- post-body-source-segments.test.mjs:3pruebas de preservación exacta, clasificación candidata y rechazo de fronteras/hashes inválidos.
- run-post-body-repro.mjs: reproduce sidecar desde Reg_LAdua.pdf/.txt y la salida actual; verificaSHApdf y número de páginas antes de escribir.

Salida: post-body-source-segments-candidate.json y post-body-preservation-before-after.json. Preserva pp81–90,22,379caracteres con página/hash/procedencia. P81esmixta;pp82–88etiquetadas annex-excerpt-candidate;pp89–90reform-decree-excerpt-candidate. Estas etiquetas son hipótesis visibles de estructura, no validez jurídica. Todas las10páginas siguen explícitamente sin estructura legal verificada.

Antes:pp82–87sinregistrotransitorio. Después:10/10páginas del bloque conservadas íntegramente en sidecar; salida importer anterior byteidéntica,282artículosy13transitorios intactos. Esto evita que un consumidor confunda ausencia estructurada con ausencia de texto. No arregla todavía la mezcla del registro144ni autoriza consumir transitorios antiguos como estructura correcta.

Pruebas:3/3PASS, reproducción realPASS, salida originalSHA d5444829340c53db9112f01dde992acd378fb0e68cbdc6a39c42784150fb785f intacta. `node --test artifacts/library-expansion-20261124/experiment/post-body-source-segments.test.mjs`; `node artifacts/library-expansion-20261124/experiment/run-post-body-repro.mjs`.

## Pendiente antes de integrar

Revisión independiente de sidecar y etiquetas; separar cuerpo/transitorios/anexos por alcance de decreto sin descartar texto; resolver7diferencias de extracción con páginasPDF/DOF; fidelidad y fechas legales; luego diseñar integración versionada del contrato con pruebas de consumidores. Nada se declara listo para adopción por preservar10páginas.
