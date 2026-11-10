# F1B / H5b.2 — diseño de recuperación nativa sintética v1

2026-11-10. **Diseño para revisión independiente; no implementación ni recuperación ejecutada.** Fuente legible por máquina: `resources/vault-recovery-synthetic-v1.json`. Este corte prepara el siguiente encargo de código crítico a Astra después de revisión; Sol mantiene esta investigación/documentación. Se aplicó PSF, ADR 0003, inventario privado y protocolo H5. No se llamó a otro modelo, tocó clave/almacén de usuario, instaló dependencia, abrió comunicación o ejecutó recuperación.

El objetivo es recuperar bytes y relaciones de una bóveda **nueva y exclusivamente sintética**, en un proceso/raíz temporal nuevos sin el Keychain o la clave original del proceso creador. El paquete debe contener snapshot SQLCipher, clave necesaria y manifiesto autenticado dentro de un formato mantenido. El almacén activo de la aplicación sigue en claro; paridad completa, autorización, puente, custodia OS, lock global, migración y H5 completo continúan abiertos.

## Evidencia actual y elección condicionada

El crate `crates/lex-vault` crea únicamente `TempDir` propio 0700 con SQLCipher 0600; esquema 4, DELETE, temporales MEMORY, CommonCrypto. `KeyMaterial` contiene 32 bytes obtenidos con `getrandom`, sin Debug/Clone/Serialize, y zeroiza su propia asignación al drop. No tiene recuperación, custodia persistente ni garantía sobre copias de biblioteca/SO. `SyntheticVault::reopen` permite otras conexiones y `Vault::close` cierra solo una: cerrar un handle no acredita una copia coherente.

Se conserva como **candidato de prueba** `age = "=0.12.1"`, `default-features=false`, dependencia opcional detrás de `synthetic-recovery`. Su release/tag y docs se verificaron el 10 de noviembre; GitHub lo mostraba como Latest, publicado 2026-07-14, commit abreviado `7a854c9`. No se atestó el SHA completo ni el checksum crates.io; se deben fijar con el paquete/lockfile antes de compilar. Es un pin, no una afirmación de que futuros Latest sean iguales. [Release oficial](https://github.com/str4d/rage/releases/tag/v0.12.1), [cambio de versión](https://github.com/str4d/rage/commit/7a854c9).

La biblioteca implementa el formato age v1; la API publicada ofrece `Encryptor::with_user_passphrase(SecretString)`, `wrap_output` y exige `StreamWriter::finish`. `Decryptor::new`/`new_buffered`, `is_scrypt` y `decrypt` entregan lector de plaintext. El wrapper debe leer y comprobar errores **hasta EOF autenticado**, nunca publicar por haber leído un prefijo. No escribir primitivas, nonces, MAC o un cifrado alternativo propio. [Encryptor 0.12.1](https://docs.rs/age/0.12.1/age/struct.Encryptor.html), [Decryptor 0.12.1](https://docs.rs/age/0.12.1/age/struct.Decryptor.html), [formato age](https://age-encryption.org/v1).

Upstream clasifica sus versiones anteriores a 1.0 como beta para pruebas. Por ello esta elección respalda solo la fixture, no aceptación comercial de la recuperación. La API de passphrase está destinada a un secreto humano/provisto para humano; la fixture simula ese ingreso, no reutiliza una clave API o una contraseña de cuenta. [Fuente de la biblioteca](https://raw.githubusercontent.com/str4d/rage/v0.12.1/age/src/lib.rs).

El workspace upstream declara Rust 1.74 y licencia `MIT OR Apache-2.0`; el crate actual exige 1.89 y se midió anteriormente con 1.99.1. Son compatibilidades declaradas, no una nueva compilación. Deben conservarse avisos de age y de **cada dependencia resuelta**, no inferir la licencia del grafo a partir de la raíz. [Manifest workspace](https://raw.githubusercontent.com/str4d/rage/v0.12.1/Cargo.toml), [licencia MIT](https://raw.githubusercontent.com/str4d/rage/v0.12.1/LICENSE-MIT).

El manifest age 0.12.1 tiene defaults vacíos; aun desactivando armor/async/CLI/plugins/SSH incorpora dependencias criptográficas y de internacionalización. Declara age-core, scrypt, ChaCha20-Poly1305, X25519, HKDF/HMAC, SHA2/SHA3, además de HPKE/P-256/ML-KEM, entre otras. El workspace fija rangos: age-core 0.12.0, scrypt 0.11, secrecy 0.10, ChaCha20Poly1305 0.10, X25519 2, HKDF/HMAC 0.12; **no son un grafo transitivo exacto resuelto**. No se promete un build diminuto por `default-features=false`. [Manifest age](https://raw.githubusercontent.com/str4d/rage/v0.12.1/age/Cargo.toml), [manifest age-core](https://raw.githubusercontent.com/str4d/rage/v0.12.1/age-core/Cargo.toml).

La inspección local de Cargo.lock y nombres de archivos/directorios de registry, sin leer credenciales/configuración, encontró **ausentes** age, age-core, secrecy, scrypt, chacha20poly1305, x25519-dalek, hkdf, hmac y aead. Sí están zeroize 1.8.2 y sha2 0.10.9. No se ejecutó Cargo resolver/build/fetch. **Un build age offline está bloqueado ahora por esa ausencia**; no se inventa soporte ni se reemplaza por criptografía propia. La ficha JSON conserva la observación. Algunas URLs docs.rs/Cargo API no fueron accesibles; se contrastaron manifests/fuentes del tag primario, sin tomar resultados de terceros como evidencia.

D0, antes del código: el coordinador puede autorizar una adquisición pública acotada de dependencias como parte de este encargo revisado, sin compra ni nueva puerta de proveedor o permiso del usuario. Obtener archivo/checksum oficial de age y grafo completo, fijar Cargo.lock y revisar licencias/avisos, features, Rust mínimo y cambios respecto al lock anterior. Propuesta de tope para esa futura adquisición: ≤100 paquetes nuevos, ≤64 MiB comprimidos, ≤180 s, sin retries/fallback de registro; parar si no cabe. **No se adquiere nada en esta entrega.** Después, exigir compilación/test `--locked --offline`. Si no se satisface D0, la parte criptográfica queda blocked; se pueden preparar tipos/pruebas pero no llamarlos recuperación funcional. Usar el CLI Go/age sería otra integración/proceso que requiere revisión; no se sustituye silenciosamente.

## Paquete concreto de adquisición futura D0

El JSON contiene `dependencyPreparation.packet`, listo para revisión del coordinador, sin ejecutar fetch. Paquete primario **age 0.12.1**: metadata oficial `https://index.crates.io/3/a/age` (alternativa `https://crates.io/api/v1/crates/age/0.12.1`), archivo fijo `https://static.crates.io/crates/age/age-0.12.1.crate`, tag `https://github.com/str4d/rage/tree/v0.12.1`. **Checksum SHA-256 del archivo: aún no verificado, `null`, por tanto no aceptable para descarga/build aprobados.** No se calcula un hash de HTML como si fuera el archivo crate. El siguiente responsable obtiene `cksum` de la entrada exacta 0.12.1 del registro oficial, mide el archivo y exige igualdad antes de extraerlo/compilarlo; el SHA completo del tag también queda pendiente.

Topes futuros: age archive ≤2 MiB; metadata individual ≤1 MiB, combinada ≤8 MiB; todos los archives ≤64 MiB/100 paquetes nuevos; ≤240 intentos HTTP/180 s de lote, 15 s/request, cero retries. Solo registros/repositorios oficiales declarados en el paquete, HTTPS y sin redirección a otro host/credenciales. Una resolución mayor que esos límites queda incompleta; no se compra un servicio ni se llama a un proveedor. Ningún dato local privado, clave o passphrase acompaña solicitudes públicas de paquetes.

Resolver primero en una copia de build aislada: age top-level exacto/opcional, defaults desactivados; producir candidato de lockfile y árbol de features sin sustituir silenciosamente el lock compartido. Por cada paquete registrar nombre/versión exacta, source URL, checksum de registro y SHA medido, bytes, licencia SPDX **y** archivos de licencia/avisos con hash, edges/features, Rust mínimo, build script/proc macro y dependencias nativas. Esos campos, el checksum del crate, grafo total y build offline están **no verificados** hoy; el repo/tag/API y declaraciones raíz sí se consultaron. La revisión independiente de ese inventario y sus recibos es el paso D0 que el coordinador puede autorizar dentro del trabajo público normal, sin inventar una puerta de compra/proveedor o pedir otra clave al usuario.

## Capacidad cerrada y snapshot coherente

Se elige una copia de archivo **solo tras cierre y exclusividad demostrados**, no online backup en esta rebanada. SQLite dispone de API mantenida de backup, pero su conveniencia no demuestra que cualquier destino SQLCipher esté previamente cifrado. Si se necesita snapshot vivo, abrir un encargo separado con `rusqlite::backup::Backup` y destino SQLCipher pre-keyed, nunca el helper que abre una ruta sin clave. [API oficial SQLite](https://www.sqlite.org/backup.html); el helper existente de rusqlite 0.41.1 se inspeccionó localmente. SQLCipher expone APIs propias para clave/exportación, cuya mera existencia tampoco demuestra una copia segura: [API oficial SQLCipher](https://www.zetetic.net/sqlcipher/sqlcipher-api/).

Contrato propuesto `SyntheticVault::seal_for_recovery(self, vault: Vault, key: KeyMaterial, expected: SyntheticRecoveryExpectation) -> ClosedSyntheticSource`:

1. Antes de cerrar, comprobar `Arc::ptr_eq` y `Arc::strong_count(root)==2` (propietario y Vault pasado), y presencia de la clave; otros handles vivos o cerrados retenidos bloquean sin cerrar el Vault recibido. La API devuelve `Result<ClosedSyntheticSource, SealFailure>`: el fallo opaco debe conservar el propietario original, `Option<Vault>`, clave y expectativa; no hay conversión automática a un Error que descarte esos propietarios. Cerrar con `Connection::close` conservando/reinsertando la conexión devuelta en error; después de cierre correcto, drop del Vault y exigir count1. Todo fallo posterior devuelve propietario+clave+expectativa y Vault=None. El source nunca desaparece por un `?` del mecanismo. Abandonar deliberadamente el objeto de fallo sigue siendo RAII del dueño; no se promete persistencia tras que el dueño descarte su única capacidad. El éxito sellado carece de reopen/escritura y sólo permite control de lectura. Exportar toma prestada esa capacidad y conserva original ante finish/fsync/publicación fallidos.
2. Confirmar raíz propia, archivos regulares, un solo link, sin symlinks ni rutas suministradas por contenido. Solo `vault.sqlite`, sin `-journal`, `-wal`, `-shm`, temporales o archivos desconocidos. Rechazar un journal residual; no limpiarlo/replayarlo para fabricar éxito. Exigir cierre DELETE limpio y configuración esperada. WAL no se admite en v1: una implementación futura necesita snapshot/checkpoint coherente y nuevo protocolo.
3. Abrir la base existente con clave por API binaria, flags READ_ONLY/NO_MUTEX/NOFOLLOW, sin CREATE/URI, sin cambiar journal/esquema o ejecutar SQL del paquete. Forzar lectura, confirmar SQLCipher/provider/schema4, `integrity_check`, `foreign_key_check` y comprobación de autenticación disponible en SQLCipher. Conservar errores categóricos; no exponer SQL/payload. Si una comprobación no existe en la versión enlazada, parar y revisar, no declararla pasada.
4. Bajo esta única conexión de solo lectura, inventariar tablas/objetos, scopes exactos y vector de revisiones. Rechazar tablas/esquema/scopes desconocidos, revisión esperada obsoleta, originales/mapas huérfanos o hash incorrecto. Cerrar y confirmar nuevamente cero otros handles. Registrar tamaño/hash/inode del ciphertext; copiar con lectura acotada, comprobar nuevamente hash/identidad del origen y destino. Nunca chmod/escribir/normalizar el origen. No hay un escritor permitido durante ese intervalo.
5. Construir manifiesto del mismo snapshot, no un inventario de antes/después de otra revisión. Un fallo nunca reabre en escritura, sustituye una base por una vacía o limpia un archivo ajeno. Un lector externo malicioso con privilegios del usuario no queda controlado por Arc; una sustitución detectada aborta, y esta fixture no se presenta como defensa contra malware del usuario.

La fuente sellada sigue viva mientras haga falta verificar preservación y se elimina solo mediante su propietario temporal al finalizar la fixture. El paquete recibe un ID aleatorio nuevo y se termina con `finish`, flush, fsync y publicación exclusiva; los failpoints diferencian completar el contenedor de publicarlo. No copiar DB viva ni un conjunto ambiguo de sidecars. La fuente debe seguir íntegra y abrir con su clave correcta en un control posterior, sin mutación por operaciones de recovery.

## Payload versionado dentro del sobre age

Un archivo binario estándar `.age`, exclusivamente passphrase/scrypt, sin armor/plugins/SSH/recipients alternativos. Fuera del sobre solo bytes age, nombre opaco y recibos técnicos sanitizados; nombres de documentos, scopes, hashes de contenidos privados, clave y manifiesto van dentro. Cualquier metadata externa es **no confiable** y nunca autoriza restaurar.

La estructura interna es framing de aplicación, **no un criptosistema**: magic fijo `LEXREC1\n`, longitud de manifiesto u32 BE, JSON UTF-8 canónico de manifiesto, exactamente 32 bytes de KeyMaterial, exactamente `store.bytes` de SQLCipher y EOF; sin compresión, rutas, archivo tar/ZIP, enlaces ni miembros arbitrarios. Sumas de longitudes checked antes de reservar memoria; bytes adicionales internos, duplicados, campos desconocidos, JSON profundo/duplicado o versiones futuras fallan. Se debe validar consumo completo de ciphertext/EOF por la API revisada y probar append/truncation; **R23a (plaintext interno extra autenticado) y R23b (ciphertext externo extra) son obligatorios en el primer lote antes de aceptar R01**; si age tolera basura externa o no permite comprobar consumo, detener para revisar esa política, sin inventar un parser criptográfico.

El manifiesto `lex-vault-recovery-manifest-v1` usa enteros acotados/no floats, orden determinista y ninguna normalización Unicode implícita. Campos obligatorios exactos:

| Grupo | Campos/vínculo |
| --- | --- |
| Formato | formatVersion=1, manifestVersion=1, payloadEncoding, serializationVersion, cryptoProfile/age crate+source+lock SHA |
| Identidad | snapshotId, sourceVaultId, sourceLineageId, keyVersion, createdAt; IDs opacos, no rutas/nombres humanos |
| Base | schemaVersion=4, schemaDigest, SQLCipher/SQLite/provider reales, store.bytes y store.sha256, keyBytesSha256 |
| Ámbitos/CAS | workspace exacto; lista ordenada de matter/thread explícito-null y revisión exacta; digest/vector completo; ninguna wildcard/ausencia permisiva |
| Objetos | ID/tipo/version, scope, bytes/hash de original y payload exacto, padres/documentVersion/hash, namespace+mappingVersion para mapas; conteos por dominio/FTS y receta/versiones de extracción/política |
| Alcance | synthetic=true, productionEnabled=false, noExecution=true; features y versiones de dominios; material legado/no soportado rechazado |

El hash de los 32 bytes de clave se mantiene **solo en el manifiesto cifrado**; el wrapper compara ese hash, el ciphertext ligado y la apertura real SQLCipher. Es comprobación interna de correspondencia, no autenticación independiente: la autenticidad del manifiesto/clave/base depende del sobre age completo. No se emite un hash/fingerprint de clave en recibos públicos.

La fixture guarda originales PDF sintéticos binarios exactos con la API nativa existente. La nota sintética con forma de mapa v1 se persiste como `Kind::Note`, dato opaco e inerte cuya forma conoce únicamente la fixture, con namespace/version y referencia al hash exacto del documento/texto; se preservan sus bytes JSON. **No existe todavía una tabla/API H3 de mapas nativos**: se cotejan bytes de una nota, sin restaurar el servicio de mapas H3, sin ejecutar correspondencias y sin afirmar persistencia/integración H3 o un dominio nativo de mapas completo. El inventario esperado se construye fuera del mecanismo, versionado y limitado; permite comparar resultados sin confiar en el manifiesto que se está probando. Una base con objetos extras/foreign scope o un mapa de versión distinta falla.

## Secretos y recursos

Nuevos tipos opacos `RecoveryPassphrase`, `ClosedSyntheticSource`, `RecoveryArtifact`, `RestoredSyntheticVault`; ni claves ni buffers de secretos derivan Debug/Display/Serialize o se devuelven como Vec público. `KeyMaterial` conserva sus restricciones; solo un método privado del módulo puede escribir/leer sus 32 bytes dentro del stream age/memoria zeroizing. Nunca serializar la clave vía serde/base64, usar SQL textual con ella, argv/env/log/archivo de respaldo claro, panic `unwrap` con secretos, snapshots de pruebas o prompts.

La fixture genera un secreto efímero con OS RNG, simula entrada explícita y lo entrega al proceso limpio por stdin/pipe privado heredado acotado. No lo imprime ni persiste; no es una UX/custodia de producto, Keychain o política de fortaleza aprobada. Clones inevitables de SecretString dentro de APIs mantenidas se inventarían/reducirían, no se promete borrar copias del SO/compilador. El proceso limpio no recibe la DEK original por otra vía: solo el paquete y passphrase, política/expected sintéticos. Sin passphrase no hay recuperación ni reset mágico.

Para evitar DoS por header/KDF, usar `age::scrypt::Recipient::new` + `set_work_factor(18)` y `Encryptor::with_recipients` con **un solo recipient scrypt**, en lugar de dejar el coste elegido automáticamente. En restore `Identity::new` + `set_max_work_factor(18)` y exigir `Decryptor::is_scrypt()`. Es API mantenida verificada; no se alteran primitivas. Los constructores todavía calibran inicialmente según upstream: también quedan bajo supervisor/límites. El valor 18 es un tope/perfil sintético por revisar/medir, no recomendación de contraseña para producto; no bajarlo al fallar. Fuente: [scrypt nativo 0.12.1](https://raw.githubusercontent.com/str4d/rage/v0.12.1/age/src/native/scrypt.rs).

| Recurso | Límite propuesto |
| --- | --- |
| Base SQLCipher | 16 MiB; ciphertext age 18 MiB |
| Manifiesto / objetos | 256 KiB / 128, profundidad JSON ≤12 |
| PDF original / mapas | 4 originales ≤1 MiB cada uno; 4 mapas ≤64 KiB cada uno |
| Ámbitos | 1 workspace, 2 matters, 2 threads por matter más null; vector ≤8 |
| Decrypt total / buffers | ≤17 MiB plaintext en memoria zeroizing; chunks IO ≤64 KiB; nunca spill claro |
| Header / scrypt | ≤16 KiB antes de payload; scrypt logN=18 export y máximo18 restore; rechazo antes de KDF caro |
| Procesos / tiempo | 1 operación en vuelo, cero retries; ≤60 s por caso / 300 s lote |
| RSS | medir proceso; supervisor cancela si observa >768 MiB, muestreo ≤50 ms; no garantía de pico instantáneo ni 8 GB |
| Artefactos/casos | ≤128 MiB disco propio por caso, ≤48 invocaciones de casos/subcasos de matriz fija; recibo sanitizado ≤1 MiB |

No `read_to_end` sin wrapper de límite; comprobar longitud del archivo antes de age y limitar cada read/acumulación y el header antes de grandes reservas. Usar lector acotado revisado, no un nuevo parser de criptografía. La ausencia de API para imponer un límite requerido bloquea la implementación y exige revisión. Cancelación cooperativa antes/después de cada fase/IO; KDF bloqueante se contiene con proceso hijo y deadline/muestreo, no se promete abortarlo mediante un bool desde otro hilo. El supervisor mata solo el grupo de proceso propio y espera su salida. Deshabilitar core dumps donde exista soporte mantenido; no prometer que esto limpia swap o todos los crash dumps.

## Restore y publicación

`restore_synthetic(artifact: RecoveryArtifact, passphrase: RecoveryPassphrase, expected: SyntheticRecoveryExpectation, cancel) -> RestoredSyntheticVault` no acepta directorio/URL/base arbitrarios. Crea su propia raíz aleatoria 0700, nunca abre un almacén existente. Estas capacidades/restoreEpoch son **contratos futuros nuevos para la fixture**: el prototipo actual no tiene restauración, epochs ni sistema de permisos. El estado inicial propuesto no permite lecturas DAO. El proceso limpio tiene HOME/TMPDIR propios y no llama Keychain, UI, scheduler, proveedores o correo.

1. Validar límites/formato externo y perfil soportado; decrypt con coste acotado a memoria zeroizing. Leer hasta EOF autenticado; no devolver ni escribir clave/manifiesto/originales en claro durante streaming. Un tag válido de prefijo no basta. Missing/wrong passphrase produce fallo genérico, sin oracle de contenido.
2. Validar framing, campos exactos, scope/linaje/esquema4/revisiones y expected independiente; comprobar hashes de clave y base antes de crear `vault.sqlite`. Un paquete válido de otro workspace/vault/snapshot no se acepta porque pueda descifrarse.
3. Escribir **solo ciphertext SQLCipher** en staging nuevo exclusivo 0600, fsync. Comparar hash byte a byte con el snapshot original. Abrir staging SQLCipher read-only, validar integridad/referencias y cada original/mapa/payload/revisión contra manifiesto y expected; búsqueda/FTS también se comprueban sin reconstruir silenciosamente. La clave solo existe en memoria nativa.
4. Emitir capacidad restaurada con **nuevo restoreEpoch/linaje opaco**, parent snapshot/lineage y vector sourceRevision; no borrar ni rebobinar el origen. Publicación significa devolver la nueva capacidad a la fixture una vez validada, no activar producto o mover datos a un destino del usuario. No merge, sobrescritura, replay de consentimientos, ejecución de jobs o timer-stop/facturación automática.
5. F1B mantiene SQL schema4 y bytes exactos: restoreEpoch se conserva en la capacidad viva y en el recibo interno de la fixture; **su custodia durable autenticada entre reinicios no se implementa aquí**. Por eso no hay permiso para uso productivo, escrituras post-restore o claim de V14 completo. El destino es de lectura/inspección solamente; el trabajo posterior debe diseñar persistencia del nuevo linaje/CAS y estados recuperados antes de habilitar writes. No introducir un sidecar privado claro para simularlo.

El punto 5 limita conscientemente esta rebanada: demuestra recuperación real de snapshot cerrado, no ciclo completo de nueva bóveda operativa. El fixture puede cerrar/reabrir la conexión de lectura dentro de la capacidad sin perder restoreEpoch y comprobar bytes, pero no acredita relanzamiento productivo con nueva custodia. Original key loss se prueba dejando caer el KeyMaterial del padre antes del restore limpio; wrong internal key se prueba con un paquete de prueba autenticado pero inconsistente. Perdida de passphrase y clave original es irrecuperable por diseño, no un fallo que deba tener backdoor.

## Fallos, rollback y evidencia

Failpoints fijos: antes del seal, otra conexión viva, después del close, durante copia ciphertext, antes de age.finish, después de finish/antes de fsync, antes de publicación del paquete, durante decrypt, antes/después de escribir staging, al validar DB y antes de devolver capacidad. Probar errores de escritura corta/ENOSPC/flush/rename mediante FS/failpoints de fixture, nunca llenando disco real. No se simula un cipher mock para declarar éxito criptográfico.

Ante error/cancelación/SIGKILL: origen y paquete completo anterior intactos; solo se limpia la raíz aleatoria propia, sin seguir links. Un `.partial.age` truncado o staging ciphertext no publicado puede quedar tras crash, pero nunca secreto/manifiesto/plain backup claro. Un intento posterior los trata como residuo no confiable; no reanuda ni los promueve automáticamente. RAII/finally no acredita SIGKILL. Power-loss/VM queda `not-run` sin prueba específica. Restauración es a nuevo destino; rollback es descartar ese destino incompleto, jamás copiar datos encima del origen.

El recurso fija R01–R24 y sus vínculos Vxx. Los resultados iniciales son todos `not-run`; un caso posterior debe acreditar hash/conteos, cierre/reapertura/efectos persistidos y control negativo del scanner. La salida pública contiene IDs de casos, versiones/hashes de **código público/fixtures declaradas**, estados/categorías, conteos, latencia/RSS y residuos permitidos/prohibidos; nunca texto sintético sensible, manifiesto descifrado, scopes de un almacén real, clave, passphrase, fingerprint de clave o ruta privada del host. Un diagnóstico local puede examinar canarios sintéticos sin publicarlos.

## Encargo exacto posterior y secuencia

Archivos nuevos propuestos: `crates/lex-vault/src/recovery.rs`, `crates/lex-vault/tests/recovery.rs`, `crates/lex-vault/tests/support/recovery_fixture.rs`, `crates/lex-vault/tests/recovery_process.rs`. Ediciones mínimas: `src/lib.rs` para módulo/exports detrás de feature y acceso privado a root/clave/lectura sellada; `Cargo.toml` para age opcional y feature `synthetic-recovery`; `Cargo.lock` solo después de D0 revisado; README para límites/resultados reales. **Sin SQL schema change**: schema4, sin migración ni nueva API de escritura/producción. No añadir puente Node/Tauri, key-store, comandos de shell a agentes o ruta global de usuario.

El primer lote incluye obligatoriamente **ambos checks R23 antes de aceptar el roundtrip**. R01 puede medirse primero, pero su resultado permanece provisional hasta que R23a y R23b rechacen las entradas respectivas sin exponer datos/capacidad. Si la API mantenida no demuestra el consumo/rechazo exigido, un check no cabe o no se ejecuta, marcar **aceptación de política EOF/lote `blocked`**, sin aceptar el roundtrip, ampliar el presupuesto o fingir completitud. No se difieren estos checks a una fase posterior.

La asignación exacta es de **18 invocaciones supervisadas**, sin retries. Una invocación es un intento de seal/recovery con una mutación negativa concreta o un restore feliz; sus aserciones/scanner no ocultan otros intentos de recuperación.

| Caso | Invocaciones | Variante exacta del primer lote |
| --- | ---: | --- |
| R01 | 1 | Bundle cerrado y roundtrip en proceso limpio, resultado provisional hasta ambos R23 |
| R03 | 2 | Passphrase incorrecta; passphrase ausente/perdida sin fallback |
| R04 | 2 | KeyMaterial fuente ausente; KeyMaterial fuente incorrecto |
| R05 | 2 | Otro Vault reabierto vivo; handle cerrado aún retenido: ambos bloquean seal |
| R06 | 1 | Truncado de chunk autenticado final/finish ausente |
| R07 | 1 | Bit flip en cuerpo ciphertext |
| R09 | 1 | Bundle válido contra expected de workspace/scope ajeno |
| R13 | 1 | Colisión `vault.sqlite` existente dentro de raíz sintética nueva propia; nunca overwrite |
| R17 | 4 | Ciphertext sobre tope; header >16 KiB; plaintext decodificado >17 MiB; logN19 rechazado por máximo18 antes de ejecutar ese KDF |
| R18 | 1 | Control positivo claro del scanner y examen negativo de artefactos/log/argv/env permitidos |
| R23a | 1 | Sobre age autenticado cuyo plaintext tiene un byte extra tras el payload interno exacto; rechazo antes de exposición |
| R23b | 1 | Un byte extra tras ciphertext age completo; demostrar consumo íntegro/rechazo con lector mantenido antes de exposición |
| **Total** | **18** | Ambos R23 son condiciones previas de aceptación, no observaciones opcionales |

Se genera/sella/cifra una sola fixture base, se preservan sus bytes y expected independiente, y se reutiliza su ciphertext inmutable para negativos de restore y mutaciones R23 en **destinos nuevos**. Las pruebas de seal R04/R05 usan fuentes pequeñas propias separadas, porque consumen capacidades; no se vuelve a sellar la base por cada restore ni se reutiliza un destino fallido. No se elimina wrong key, corrupt o foreign scope para acomodar EOF. Las demás filas de la matriz de 24, y variantes no seleccionadas de R06/R07/R09/R13/R17, siguen `not-run`; esta tabla no acredita que toda una familia de variantes esté pasada. Completar este lote no aprueba H5.

Astra implementa la frontera crítica y pruebas de cifrado/restore después de revisión de este diseño y D0; otro revisor inspecciona antes de ejecutar las fixtures. El propio módulo no exporta una clave genérica ni acceso a ruta arbitraria. Mantener los tests existentes/defaults sin nueva feature; el contrato DAO global continúa `VAULT_PARITY_COMPLETE=false`. Comandos propuestos, **no ejecutados aquí**:

```sh
cargo test --locked --offline --manifest-path crates/lex-vault/Cargo.toml -- --test-threads=1
cargo test --locked --offline --manifest-path crates/lex-vault/Cargo.toml --features synthetic-recovery --test recovery -- --test-threads=1
cargo test --locked --offline --manifest-path crates/lex-vault/Cargo.toml --features synthetic-recovery --test recovery_process -- --test-threads=1
```

El supervisor de pruebas aplica los topes anteriores y usa procesos hijos con pipe privado; no poner un secreto en estos comandos ni `--nocapture` para material privado. Tras máximo tres fallos del mismo problema, diagnosticar antes de otro fix. No declarar aprobación por solo compilar o por un roundtrip feliz.

Entregable de aceptación F1B: bundle age real, restore en proceso limpio sin DEK original, lectura/búsqueda y bytes PDF/mapa/store coincidentes, negativos sin exposición/mutación, recibo reproducible y revisión independiente. Permanece pendiente: OS Keychain/custodia, lock de toda la app/temporales y servicios, ciclo durable de linaje y escritura/rotación, scopes/autorización de usuario, migración/release/Windows/Intel, V07 power-loss, V14/V15/V21/V22 completos, cliente físico8GB y H5/H6. Este diseño no los aprueba.

## Precisión de propiedad anterior a implementación

El coordinador detectó que consumir ambos propietarios y devolver sólo una categoría podía borrar el único TempDir en un fallo por RAII, contradiciendo la preservación. Se exige el retorno tipado de capacidades descrito arriba y sus pruebas de missing/wrong key, puntero ajeno, handles, close y publicación. Astra concretó el contrato antes de escribir código. Este cambio se revisa aparte antes de congelar la implementación; no es recuperación ejecutada. El diseño D0 original es histórico: el paquete de preparación v2 separa140 GET de metadata observados,42 archivos reutilizados y107 nuevos planificados, máximo256 HTTP/112 archivos nuevos, manteniendo64MiB/180s y sin compilación autorizada por metadata.
