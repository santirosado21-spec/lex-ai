# D0 v2 — archivos públicos y metadata offline de recuperación

2026-11-10. **Preparación pública completada; revisión de licencias/features y build nativo pendientes.** Solo se escribió en el directorio de artefactos asignado y estos dos documentos QA. No se compilaron dependencias/código nativo, ejecutaron build scripts/proc macros, tests nativos o recuperación; no se generó/usó clave ni abrió un almacén. Ninguna ruta de producto se activó.

El coordinador autorizó D0 v2 después de revisión Sol independiente del paquete `resources/vault-recovery-dependency-preparation-v2.json` (SHA `45e807634a7f982c25c1993a2bb5e2fe60b9f6a50225ff1040f260c77898181c`). Se preservaron el Cargo.lock del probe (`0776d8f329bbe17eb2de9c8998f9364b96cbccf4269143c907b4c43dc7eb7b17`), el recibo histórico y su log. El recibo histórico mantiene `httpRequestCount=null`; el nuevo conteo no lo sobrescribe.

## Medido

| Resultado | Evidencia |
| --- | --- |
| Paquetes registry fijados / archivos verificados | 149 / 149 |
| Reutilización | 42: 41 archivos públicos de caché global y age 0.12.1 capturado previamente; cada SHA igual al lock antes de copiar |
| Nuevas solicitudes | 107 GET directos, 107 respuestas 200, un intento por archivo, cero retries/redirecciones |
| Conteo D0 observado | 140 GET del log Cargo mediante regex literal `http-debug: > GET` + 2 solicitudes fijas anteriores + 107 directas = **249**, dentro del paquete de 256 |
| Archivos combinados | **13.686.782 bytes**; mayor archivo 2.517.186 bytes, debajo de 8 MiB individual/64 MiB combinado |
| Tiempo de descarga / preparación inicial | 6.890,289 ms / 9.303,564 ms; cada request con deadline absoluto15 s, lote de descarga180 s, un vuelo |
| Inspección tar sin extraer/ejecutar | 5.446 miembros, 70.856.192 bytes descomprimidos leídos; mayor paquete18.384.384 bytes, debajo de64 MiB/paquete y512 MiB total |
| Metadata sin filtro | 149 paquetes registry/150 nodos incluyendo probe; nombres/versiones/checksums de archivos coinciden con lock |
| Metadata Mac ARM | 140 paquetes registry/141 nodos incluyendo probe, filtro `aarch64-apple-darwin`; nueve paquetes del lock fuera de este grafo |
| Features age | `[]` en ambos grafos; manifest del probe fija `default-features=false` |
| Scripts/macros declarados | 13 build scripts y14 proc macros en todos los destinos;13 y12 en Mac; inspeccionados como metadata, no ejecutados |
| Avisos/licencias | Seis paquetes sin archivos de aviso reconocidos;149 decisiones de licencia pendientes; diez expresiones históricas con `/`;52 paquetes sin Rust mínimo declarado |

Se descargaron exclusivamente las URLs exactas `static.crates.io` del paquete, con cliente HTTPS directo sin proxy/auth/cookies, sin shell, sin redirect/retry, contando antes de GET. Cada stream usó archivo `.part` exclusivo; solo se publicó en cache después del SHA esperado. Se rechazaban rutas/nombres/versiones ajenos, symlinks y overwrites. El ledger NDJSON conserva intento y resultado de cada URL, estado, tiempo, bytes y SHA, sin headers crudos, entorno o rutas privadas.

Los tar se inspeccionaron con prefix exacto paquete-versión y límites de bytes/miembros; no se permitían absolutos, traversal, symlinks, hardlinks o dispositivos. Se registraron manifests declarados, features, Rust mínimo, repository, build scripts, proc macros y hashes de archivos LICENSE/NOTICE reconocibles. No se extrajo ni ejecutó un script para obtener esa información. Posteriormente **Cargo metadata sí desempaquetó** fuentes verificadas dentro de su propia caché aislada; esto no equivale a compilar o instalar globalmente.

Los totales HTTP describen este paquete D0, no todo el proyecto. El histórico140 es un conteo observado del log real, conservado con SHA `71d08b33f855b65c4757b8addccd4fd770a8c5b2c2ef3853253ce4108ca70c54`; no prueba retrospectivamente un techo de requests que Cargo no proporcionó en su recibo original. Las solicitudes directas107 sí se cuentan explícitamente. No se hicieron nuevas consultas web/manuales durante esta adquisición.

## Metadata offline y caché de la base nativa

Se usó Cargo instalado mediante ruta absoluta del toolchain, hash `6d576d8058f8ca643e8fce55b64ee3c614ba64c9da2e536bae843e6a2e1f3951`, RUSTC absoluto, entorno mínimo y `CARGO_HOME` aislado. Solo se ejecutaron comandos `cargo metadata --locked --offline --format-version 1` sobre el manifest del probe, una vez sin filtro y dos veces con filtro Mac. No `fetch`, build/test, codegen, build script o proc macro. Cargo puede consultar versión/cfg del compilador; no se confunde esa consulta informativa con compilación nativa.

El comando inicial sin filtro tuvo supervisión de stdout32 MiB/stderr1 MiB,60 s y directorio600 MiB. La primera consulta Mac verificó tamaño tras captura; se conservó sin modificar y se añadió una comprobación Mac offline con **stream y límites supervisados**:789,01 ms,659.328 bytes stdout,0 stderr, máximo observado87.313.694 bytes de Cargo home; grafo idéntico. Un typo de sintaxis de este helper se corrigió antes de iniciarse Cargo. Ningún límite se amplió ni se repitieron descargas. Los paths de los JSON guardados se sanitizaron a referencias `repo://`/`toolchain://`; los hashes de stdout original quedan en los recibos.

La afirmación de cero red durante metadata procede de `--offline`/`CARGO_NET_OFFLINE` y del tipo de operación. **No se hizo una traza externa de sockets**, ni se afirma haber medido un límite duro de tráfico interno de Cargo. Todos los archivos requeridos estaban disponibles localmente y ambos grafos resolvieron con exit0.

Por autorización adicional del coordinador, se incorporó a esa caché aislada la base nativa ya existente de `crates/lex-vault/Cargo.lock`, SHA **`6694ffbdbaf0e3d6831157f44eadf3cfe81511d525842691afea07d22aedcff5`**, sin cambiarlo. Se validaron sus57 versiones/checksums de registry:23 archivos ya estaban en los149; se copiaron **34** archivos públicos faltantes,14.142.457 bytes, y **29** registros sparseindex públicos,2.527.370 bytes. Cero HTTP, ninguna extracción/build adicional. Cache final: **183 archivos crate únicos/27.829.239 bytes**. Esto prepara la coexistencia del lock antiguo y el probe, no regenera ni integra el lock nativo.

Solo se seleccionaron archivos concretos del registry público `index.crates.io-1949cf8c6b5b557f`, validando paths/symlinks y cada checksum de versión del registro contra el lock nativo. Las configuraciones pública/aislada declaraban `dl=https://static.crates.io/crates`, `api=https://crates.io`, sin `auth-required` (false efectivo); no se copiaron configuración global, credenciales o registros privados. Los límites offline propios fueron8 MiB/archivo,32 MiB de archivos nuevos,64 MiB de cachearchivos combinado;2 MiB/registro y4 MiB de registros copiados. La suma del cacheindex puede crecer por esas copias locales; no hubo nuevo tráfico de metadata ni expansión del límite HTTP. El recibo `baseline-cache-import-receipt.json` conserva hashes/cantidades/postconteos y SHA del lock antes/después.

## Procedencia y pendientes

El archivo age 0.12.1 coincide con SHA `fd290633c2482479f70f6d1d96ae0e9f52c6a26cd5859edd47ee1fe33fc89f26`. Su `.cargo_vcs_info.json`, procedente de ese archivo verificado, reporta commit **`7a854c9c8c02dab2ebea19e02e6693a5730a8b2a`**, path `age`. age-core0.12.0 reporta **`f6383f367e9aa514a3b5fbce7feede08a425d647`**, path `age-core`; no se inventa el mismo commit para ambos. Son datos reportados por archivos de registro verificados, sin una nueva descarga/verificación independiente de Git.

Los seis paquetes sin avisos reconocibles son:

| Paquete | Declaración en manifest |
| --- | --- |
| age0.12.1 | MIT OR Apache-2.0 |
| age-core0.12.0 | MIT OR Apache-2.0 |
| cookie-factory0.3.3 | MIT |
| fluent-langneg0.13.1 | Apache-2.0 OR MIT |
| intl_pluralrules7.0.2 | Apache-2.0/MIT |
| io_tee0.1.1 | MIT OR Apache-2.0 |

Ausencia de archivo reconocible no elimina una declaración de licencia ni acredita tener todos sus avisos. No se crearon avisos para rellenar la brecha. `self_cell1.3.0` declara `Apache-2.0 OR GPL-2.0-only`; no se seleccionó una rama de licencia ni se emitió autorización comercial. El inventario conserva cada expresión y todos los avisos encontrados; **todas** las decisiones permanecen pendientes. Continúa vigente la calificación upstream beta/testing de age anterior a1.0.

El siguiente revisor debe resolver avisos y selección/licencias por paquete, revisar features transitivas, los13 build scripts y12 proc macros activos, y aprobar el encargo de build sintético antes de ejecutar código de terceros. El manifest del probe no prueba compatibilidad al integrarlo en `lex-vault`: sus dependencias fijadas y lock existente se preservan; la nueva feature y resolución nativa requieren revisión propia. No hay prueba de API/EOF/KDF/roundtrip, recuperación, Keychain, custodia global, linaje durable, migración, cliente8GB o H5 completo por esta preparación.

## Artefactos reproducibles

Directorio: `artifacts/vault-recovery-deps-d0-lock-20261110-first/archive-preparation-01/`. `preparation-receipt.json` es el recibo inicial inmutable; `metadata-mac-bounded-receipt.json` y `baseline-cache-import-receipt.json` añaden las verificaciones sin editarlo. El ledger/archivo de eventos, inventario tar, metadata de ambos grafos, inventario combinado de licencias/features y procedencia age están referenciados con hashes en el JSON QA compañero. Los tres scripts de preparación/recheck/import y el finalizador viven en el padre asignado. Son operaciones de una sola pasada sin reanudación automática; no volver a ejecutarlos sobre estas hojas existentes.

Comprobaciones finales:149 archivos del ledger inicial releídos y SHA verificado;149 paquetes del grafo general exactamente contra lock,140 del Mac como subconjunto explícito;57 paquetes base con archivos/registros verificados; source lock/recibo/log originales sin cambios; recibos/artefactos completos guardados de solo lectura. No hay commit, modificación de fuentes nativas ni copia de configuración privada.
