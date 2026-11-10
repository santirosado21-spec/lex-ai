# Recuperación de bóveda: CI de supervisión de recursos, protocolo 1

Preparación para revisión del coordinador el 10-11-2026. **No ejecutado ni compilado en el Mac del dueño; no ejecutado en CI desde esta entrega.** El workflow nuevo es [vault-recovery-supervisor.yml](../../.github/workflows/vault-recovery-supervisor.yml). Su publicación y ensayo único permanecen condicionados a que el coordinador confirme la compilación previa satisfactoria y prepare un freeze nuevo; no continúa automáticamente hacia la batería criptográfica.

## Alcance autorizado

Este corte ejecuta exclusivamente la prueba ignorada `supervisor_cleanup_without_crypto`, del target `recovery`, tras un typecheck separado con `--no-run`. El cuerpo revisado en `crates/lex-vault/tests/recovery.rs` ejercita registro, reap y cierre de procesos propios `/bin/sleep` y `/bin/true`, fallos de sampler inyectados y cleanup tras unwind sintético. No invoca el helper de recuperación, age/KDF, claves, DB o almacenes. Los mensajes del panic sintético capturado pueden aparecer en el log; el resultado depende de las aserciones posteriores y del resumen final del test.

Compilar esos targets puede ejecutar build scripts y proc macros de terceros. No se ejecutan en la computadora del dueño. Se reutiliza el límite de confianza documentado en [compilación limpia, protocolo 1](vault-recovery-clean-ci-v1.md): VM pública estándar nueva `macos-15`, credenciales no persistidas, fuentes públicas fijadas, Cargo aislado y sin entorno de desarrollo/CI heredado. HOME se omite en los hijos Cargo; CARGO_HOME, target y TMPDIR son nuevos bajo RUNNER_TEMP. No se heredan caches o datos del dueño.

GitHub documenta que el runner público `macos-15` es M1/arm64 de 7 GB, que cada job recibe una VM nueva y que la instancia se retira al terminar. Fuentes primarias consultadas: [elección de runner](https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/choose-the-runner-for-a-job) y [ciclo de vida](https://docs.github.com/en/actions/how-tos/manage-runners/github-hosted-runners/use-github-hosted-runners). Es una VM de 7 GB, no una aceptación física de 8 GB ni validación del producto.

## Selección y freeze nuevo

Solo push en `docs/hybrid-psf-development-loop`, con cambios de `crates/lex-vault/**` o del workflow supervisor, puede generar el evento. Antes de asignar runner se requiere repositorio público y prefijo exacto `[vault-recovery-supervisor]` en el head commit. Un solo job, máximo paralelismo 1, diez minutos, grupo fijo con cancelación automática desactivada. No se interpola el mensaje en shell.

Checkout conserva el SHA revisado `34e114876b0b11c390a56381ad16ebd13914f8d5`, profundidad 1 y `persist-credentials=false`. Solo `contents: read`. Sin PR duplicado, schedule, dispatch, instalaciones, secrets, action cache, uploads, releases, deploy, runner pagado o autoalojado. No hay código que active el siguiente corte.

El coordinador creará **después de la compilación verde y la revisión de este corte** `docs/qa/vault-recovery-supervisor-freeze-2026-11-10.json`. Forma esperada:

```json
{
  "schemaVersion": 1,
  "scope": "SUPERVISOR_ONLY",
  "approvedForSingleSupervisorOnlyRun": true,
  "feature": "synthetic-recovery",
  "minimumRustVersion": "1.99.0",
  "workflowSha256": "<sha256 del workflow supervisor>",
  "sourceHashes": {
    "crates/lex-vault/Cargo.toml": "<sha256>",
    "crates/lex-vault/Cargo.lock": "<sha256>",
    "crates/lex-vault/README.md": "<sha256>",
    "crates/lex-vault/src/lib.rs": "<sha256>",
    "crates/lex-vault/src/recovery.rs": "<sha256>",
    "crates/lex-vault/tests/recovery.rs": "<sha256>",
    "crates/lex-vault/tests/recovery_process.rs": "<sha256>",
    "crates/lex-vault/tests/support/recovery_fixture.rs": "<sha256>"
  },
  "baselineSourceHashes": {
    "<cada otro .rs versionado del crate>": "<sha256>"
  }
}
```

Ambos mapas disjuntos deben cubrir exactamente el crate versionado completo: actualmente ocho archivos de la entrega y siete base. El workflow verifica fuente y su propio SHA antes y después, además del inventario/cada archivo de la copia aislada. No acepta symlinks, fuentes adicionales, dependencias path/git/registro alterno, reemplazos o configuración Cargo de ancestros. El lock actual exige una entrada local `lex-vault` y 179 entradas crates.io con checksums. El freeze es JSON de datos: ningún campo se convierte en shell, código o selector de tests arbitrario. El freeze anterior de compilación se conserva intacto.

## Secuencia, sin fallback

Se conserva el patrón aprobado de compilación: Python estándar, `rustup which` desde el temporal, binarios reales absolutos preinstalados, auto-install desactivado, rustc al menos 1.99.0 y host arm64, SDK/Clang disponibles y entorno de Cargo mediante `env -i`. Si una herramienta falta o es antigua, falla; no instala ni cambia toolchains. El directorio temporal y CARGO_HOME nuevos no contienen credenciales o caché compartida.

1. `fetch --locked` anónimo desde crates.io, target arm64, retry 0 y timeout HTTP 15 s. No ejecuta tests.
2. Compilación offline `test --locked --offline --features synthetic-recovery --no-run --jobs 1 --target aarch64-apple-darwin`. No ejecuta ningún test, helper o binario de recuperación. Build scripts/proc macros siguen siendo posibles y se confinan a la VM.
3. Solo después de devolver cero la compilación, se ejecuta exactamente:

```text
cargo test --locked --offline --manifest-path <Cargo.toml aislado> --features synthetic-recovery --test recovery supervisor_cleanup_without_crypto -- --ignored --exact --nocapture --test-threads=1
```

Cargo es el binario absoluto ya comprobado. El entorno fija `CARGO_BUILD_TARGET=aarch64-apple-darwin` para reutilizar la compilación anterior sin alterar ese selector literal. `--test recovery`, el nombre completo y `--exact` limitan la ejecución a una prueba; no hay `first_batch_18`, selector amplio de ignorados, baseline SQLCipher ni helper de recuperación. [Cargo test](https://doc.rust-lang.org/cargo/commands/cargo-test.html) documenta `--no-run` y el límite de target de integración; los argumentos posteriores a `--` van al harness.

Compilación y prueba mantienen `CARGO_NET_OFFLINE=true` y el perfil fijo de sandbox que deniega red; no se incorpora proveedor ni se amplían credenciales. El test recibe un wall máximo de **90 s**, recortado si queda menos presupuesto del driver. Su grupo de procesos propio se termina en timeout con TERM y luego KILL si es necesario, igual que la compilación; el cierre puede añadir hasta 5+5 s, sin convertir el timeout en éxito. Fetch/compilación conservan máximos de 240/300 s, un presupuesto monotónico compartido del driver de 540 s y el job de diez minutos.

La salida del único test se conserva temporalmente en la VM y se muestra en el log, con máximo admitido de 1 MiB. Para declarar éxito se exige exit code cero, `running 1 test`, nombre del supervisor y resumen `1 passed; 0 failed; 0 ignored`. Un selector que ejecute cero pruebas no cuenta como PASS. Sin upload, caché o publicación de log/binarios. Integridad posterior fallida invalida el resultado aunque la prueba haya pasado.

## Interpretación y verificación local

El informe usa `status=SUPERVISOR_ONLY`, `supervisorTestOnly=true`, `cryptoTestsExecuted=false`, `cryptographyValidated=false`, `h5Complete=false` y `physical8GBValidated=false`. `testsExecuted=true` se registra cuando la salida indica el inicio de una prueba; PASS requiere además resumen satisfactorio e integridad preservada. Fallos anteriores a la ejecución mantienen `testsExecuted=false`; una invocación solicitada queda separada en `supervisorTestInvoked`.

Un PASS prueba únicamente la regresión de supervisión de procesos sintéticos seleccionada en esta VM. No prueba cifrado, recuperación, passphrase, parámetros KDF, roundtrip, DB, custodia, el producto ni H5 completo. La batería futura de 18 invocaciones requiere otro freeze y decisión del coordinador, después de este resultado; el workflow no la invoca.

Esta entrega se comprueba solo mediante lectura de fuente, parseo YAML y AST del Python embebido. No hay ejecución del driver, Cargo, código generado, proc macros o tests nativos en el Mac del dueño. La compilación previa en curso y la futura ejecución supervisor conservan evidencias y aceptaciones separadas.
