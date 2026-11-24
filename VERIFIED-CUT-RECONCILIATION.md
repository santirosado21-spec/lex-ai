# Conciliación del corte verificado DOF + Taller

24nov2026. Solo desarrollo verificado. No publicado, instalado en Mac, activado como biblioteca ni certificado jurídicamente.

## Revisión independiente recibida

La revisión independiente reprodujo npm ci/build, las 48 pruebas seleccionadas y los tres smokes del corte conjunto sobre copia Git limpia de 4ad70b4. Recalculó hashes de candidato, HTML e índice y probó rechazo de modificaciones/override de pin. La evidencia visual corresponde a imágenes generadas por los smokes e inspeccionadas, no a una segunda navegación manual independiente. No comprobó Rust, Mac/WKWebView/Tauri, accesibilidad completa ni calidad jurídica. Su alcance sobre Pedro fue el Taller, no todas sus ramas.

## Captura pública y autenticación

Las acciones API dofReview.* requieren Bearer y la frontera HTTP local existente. La ruta GET /dev/dof-review/source NO requiere token cuando está habilitado el modo de revisión dev. Sirve únicamente la captura DOF pública fija y comprobada por hash, con CSP sandbox y sin scripts/red. No describir la ruta GET como autenticada igual que la API. Sin habilitar revisión devuelve 404. No sirve archivos arbitrarios o documentos privados.

## Texto limpio auxiliar

rgce3-candidate-source-clean.txt SÍ tiene consumidores: scripts/dof-app-prepare.mjs y las regresiones de validateCandidate. No es necesario en el arranque normal: openDofAppReview solo abre candidato, HTML e índice fijados. Por tanto se excluye de la garantía de pin y del conjunto de entradas de runtime, NO se elimina de fixtures de preparación/pruebas. Su hash no forma parte de REVIEWED_DEV_PIN. No afirmar que todos los archivos del ZIP están fijados. La preparación explícita usa este auxiliar, valida anclas/hashes derivados y exige que el índice resultante sea exactamente el ya fijado; no se ejecuta al abrir ni acepta un hash nuevo.

## Suite completa y tres fallos

Ejecución propia en clon Git real del corte: 1521 pruebas, 1477 aprobadas, tres fallidas, 41 omitidas, cero canceladas. Los tres errores observados son ENOENT al hacer stat de resources/public-library.sqlite:

- tests/intake-question-facts.test.mjs:47, a generated exercise projects protected facts while restored source evidence stays local.
- tests/intake-question.test.mjs:31, public library search respects exact citations, uses unmasked terms, and rejects unsupported jurisdictions.
- tests/intake-question.test.mjs:126, return and replacement identify separate customs regimes and preserve the page break and the prior import condition.

Reejecución de esos dos archivos en worktree limpio 4ad70b4: ocho pruebas, cinco aprobadas y los mismos tres fallos con el mismo ENOENT. Esto comprueba preexistencia en ese entorno; no prueba que cargar una base cualquiera arregle sus expectativas ni atribuye una causa jurídica o funcional más amplia. No se cambió ni fabricó una biblioteca para forzar pases.

Una ejecución previa en directorio exportado sin .git agregó un cuarto fallo de inventario runtime porque git ls-files no podía ejecutarse. Se descartó como entorno incompleto y se repitió en clon Git, donde ese test pasó. Una ejecución de base completa fue interrumpida por límite de tiempo, no se presenta como medición completa propia. El resultado completo de base comunicado por la revisión independiente sigue siendo evidencia distinta.

## Publicación retenida

La instrucción original autenticada del 20nov05:13 exige rama nueva y no push a main sin aprobación del dueño. Es posterior al permiso general del 11nov. No se encontró aprobación posterior específica para este corte. La orden actual de avanzar no se transforma en aprobación de main. Se prepara commit/rama local sin publicar, pendiente decisión del usuario en momento útil. Ninguna nota del repositorio concede esa aprobación.

## Siguiente

Decisión de publicación del corte dev. Después, prueba Mac cuando el usuario lo reabra; sin reanudar GLM ni tocar sesiones. Activación de fuentes, funciones reales y datos privados siguen fuera del corte.
