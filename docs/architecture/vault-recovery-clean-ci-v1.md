# Recuperación de bóveda: compilación aislada en CI, protocolo 1

Preparado para revisión del coordinador el 10-11-2026. **No ejecutado en CI ni compilado en el Mac del dueño.** El workflow es [vault-recovery-compile.yml](../../.github/workflows/vault-recovery-compile.yml). No prueba recuperación, criptografía, KDF, custodia, rendimiento, aceptación física de 8 GB o habilitación de producto.

## Límite de confianza

La compilación de dependencias Rust puede ejecutar build scripts y proc macros. `--no-run` evita ejecutar las pruebas, pero no convierte la compilación en una operación sin código de terceros. El sandbox local no ha demostrado bloquear la lectura de argumentos de otros procesos del Mac; por ello este protocolo **no se ejecuta en esa máquina**.

Se usa un runner estándar público `macos-15`. GitHub documenta una VM nueva por job, descartada al terminar, y lista ese runner público como M1/arm64 de 7 GB; el uso estándar público es gratuito. Fuentes verificadas: [elección de runner](https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/choose-the-runner-for-a-job) y [ciclo de vida del runner](https://docs.github.com/en/actions/how-tos/manage-runners/github-hosted-runners/use-github-hosted-runners). Una VM de 7 GB no acredita una computadora física de 8 GB ni el producto integrado.

El job se evalúa antes de asignar el runner: repositorio público y prefijo exacto `[vault-recovery-compile]` en el head commit. Solo hay trigger push para `docs/hybrid-psf-development-loop` y cambios de `crates/lex-vault/**` o del propio workflow. Sin PR duplicado, dispatch, schedule, secretos, artefactos subidos, caché compartida, releases, despliegue, cuenta de proveedor, runner de pago o autoalojado. Un solo job, máximo de paralelismo 1, diez minutos y grupo fijo de concurrencia con cancelación automática desactivada. No se interpola texto del commit en shell.

Checkout usa el SHA oficial ya revisado `34e114876b0b11c390a56381ad16ebd13914f8d5`, profundidad 1 y credenciales no persistidas. La protección depende de la condición pública del job; una conversión posterior a privado lo deja sin ejecutar, sin recurrir a minutos privados.

## Freeze esperado, aún a proporcionar por el coordinador

Ruta fija: `docs/qa/vault-recovery-compile-freeze-2026-11-10.json`. Es JSON de datos, nunca shell, Python ejecutable o parámetros de compilación. El workflow falla antes de Cargo si falta o no concuerda. Forma exacta relevante:

```json
{
  "schemaVersion": 1,
  "scope": "COMPILATION_ONLY",
  "approvedForSingleCompileOnlyRun": true,
  "feature": "synthetic-recovery",
  "minimumRustVersion": "1.99.0",
  "workflowSha256": "<64 hexadecimal lowercase characters>",
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
    "<every other tracked crate .rs file>": "<sha256>"
  }
}
```

Los dos mapas deben ser disjuntos y su unión cubrir **exactamente todos** los archivos versionados del crate: ocho archivos de la entrega más los módulos y pruebas base necesarios para compilar. No basta copiar los ocho nuevos. Solo se admiten esos Cargo/README y `.rs` versionados; se rechazan symlinks, traversal y entradas inesperadas. El SHA del workflow se fija en el freeze sin autorreferencia: el workflow no contiene el hash del freeze. La revisión previa de Rust y sus dos correcciones de harness corresponde al coordinador/Astra; este workflow no sustituye esa revisión.

Se verifica la integridad antes de herramientas y otra vez al finalizar, incluso ante fallos. Se copia el crate completo aprobado a un directorio único bajo RUNNER_TEMP y se vuelve a verificar cada copia y el inventario exacto al terminar; cambios, enlaces o archivos adicionales invalidan la entrega. Los freezes históricos de D0/H5 se conservan; un freeze nuevo describe esta compilación y el código final correspondiente.

## Herramientas preinstaladas y entorno de los hijos

Python 3.11+ de la VM solo utiliza biblioteca estándar para JSON, TOML, hashes, archivos y subprocess con arrays, sin `shell=True`. Primero resuelve las rutas reales absolutas de Cargo, rustc y rustdoc mediante `rustup which` desde el directorio temporal, fuera de posibles overrides del repositorio. `RUSTUP_AUTO_INSTALL=0` desactiva instalación automática; no se ejecuta install/update ni se selecciona otro toolchain. Se exige rustc al menos 1.99.0 y host `aarch64-apple-darwin`. Ese umbral es una condición explícita de este ensayo; **no cambia** el `rust-version = 1.89` declarado por el crate ni demuestra su MSRV real. Si el runner trae una versión inferior, el ensayo falla antes del fetch, sin descarga o fallback. Referencia: [variables de rustup](https://rust-lang.github.io/rustup/environment-variables.html).

Se comprueban Xcode/SDK/Clang ya disponibles con consultas, sin instalación. Se requiere además `/usr/bin/sandbox-exec`, incluido en el sistema; no hay fallback si falta. La red de la fase de compilación se deniega con un perfil fijo. La disponibilidad/funcionamiento del perfil en la VM todavía no está medido; no se afirma validado por haber parseado el YAML.

CARGO_HOME, target y TMPDIR son directorios nuevos privados bajo el directorio de tarea. HOME no se redefine ni se transmite a los hijos Cargo; el runner es una VM nueva sin credenciales o documentos del dueño. Cada Cargo se inicia con `/usr/bin/env -i` y una whitelist fija: PATH del binario real del toolchain más directorios de sistema, RUSTC/RUSTDOC absolutos, SDKROOT/CC/CXX comprobados, directorios aislados, configuración de terminal/locale y límites de Cargo. No se heredan tokens, claves, proxies, wrappers, DYLD, flags ni credenciales del entorno de desarrollo o CI a los hijos Cargo. No hay archivos de credenciales en el CARGO_HOME nuevo. Esto no pretende que código nativo malicioso sea seguro en el Mac del dueño: solo se autoriza la VM efímera pública.

El proceso Cargo se inicia en una sesión/grupo propio. Timeout termina ese grupo propio, con TERM y luego KILL si hace falta, sin PID recibido de archivos o entorno. Fetch tiene hasta 240 s y compilación 300 s, recortados por un presupuesto monotónico compartido de 540 s del driver. Después solo quedan cierre del grupo y comprobación final de fuentes; el job conserva el límite externo de diez minutos. No hay reintento automático.

## Fetch y compilación

Preflight exige una sola entrada local `lex-vault` en Cargo.lock y 179 paquetes de registro, todos del origen oficial crates.io y con checksum SHA-256. Rechaza git, registros alternos, dependencias path/workspace externas, patches/replacements y configuraciones `.cargo` heredadas en la copia o sus ancestros. No usa los archives, caches, stores o credenciales locales del dueño.

El manifest aprobado debe conservar la feature exacta `synthetic-recovery = ["dep:age"]`, defaults vacíos y age opcional sin default-features. El código Python no recibe una feature arbitraria del freeze: compara el dato y ejecuta el literal revisado.

1. Cargo absoluto ejecuta `fetch --locked` para el target arm64, con registro sparse oficial, cero retries y timeout HTTP 15 s. Es acceso anónimo a fuentes públicas fijadas, no activación de proveedor o descarga de modelos. [Cargo fetch](https://doc.rust-lang.org/cargo/commands/cargo-fetch.html) documenta la preparación para uso offline y el rechazo de cambios del lock con `--locked`.
2. Cargo absoluto, con red denegada y `CARGO_NET_OFFLINE=true`, ejecuta exclusivamente `test --locked --offline --features synthetic-recovery --no-run --jobs 1 --target aarch64-apple-darwin`. No se pasan argumentos de ejecución ni se invoca ningún ejecutable generado. [Cargo test](https://doc.rust-lang.org/cargo/commands/cargo-test.html) documenta que `--no-run` compila sin ejecutar tests.

No se abren almacenes, se generan claves de recuperación o se invocan helpers de pruebas. El workflow no solicita una operación KDF. Los build scripts/proc macros de terceros sí pueden ejecutarse como parte de la compilación autorizada; por eso un resultado positivo no valida comportamiento criptográfico ni runtime.

El informe final siempre usa `status=COMPILATION_ONLY`, resultado PASS/FAIL y `cryptographyValidated=false`, `testsExecuted=false`, `recoveryHelperInvoked=false`, `physical8GBValidated=false`. PASS solo significa que la compilación prevista devolvió cero y se preservó la integridad de las fuentes. Fallos llevan una categoría de fase fija; no se vuelcan entornos o excepciones originales. No se conserva o publica ningún binario.

## Verificación de esta entrega

Solo lectura local, parseo YAML, parseo AST del Python embebido y revisión manual de condiciones/flags/paths. Sin Cargo, rustc, build scripts, proc macros, tests Rust o código generado en el Mac del dueño. La ejecución CI, su toolchain disponible, SDK, red denegada y compilación permanecen **sin medir** hasta revisión y el ensayo único del coordinador.
