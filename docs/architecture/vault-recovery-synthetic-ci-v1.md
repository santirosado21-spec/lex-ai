# Recuperación sintética: CI del primer lote de 18, protocolo 1

Preparado el 10-11-2026 para revisión independiente. **Sin ejecución local del driver, Cargo, código nativo, KDF o pruebas; sin ejecución CI desde esta entrega.** El workflow nuevo es [vault-recovery-synthetic.yml](../../.github/workflows/vault-recovery-synthetic.yml). El coordinador solo publicará el ensayo tras supervisor verde, freeze nuevo y revisión estática de este corte. No se dispara como continuación automática de los workflows anteriores.

## Canal y presupuesto

Se reutiliza la VM pública estándar `macos-15` de 7 GB y el aislamiento revisado en [compilación limpia](vault-recovery-clean-ci-v1.md) y [supervisión sin criptografía](vault-recovery-supervisor-ci-v1.md). Referencias oficiales ya consultadas: [runner público y especificaciones](https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/choose-the-runner-for-a-job), [VM nueva y retirada al finalizar](https://docs.github.com/en/actions/how-tos/manage-runners/github-hosted-runners/use-github-hosted-runners). No se usan documentos del dueño, clientes, stores activos, cachés privadas, proveedor remoto, nuevos pagos o máquina autoalojada.

El único job requiere repositorio público y prefijo exacto `[vault-recovery-synthetic]` antes de asignar runner. Solo push en `docs/hybrid-psf-development-loop` y cambios del crate o del workflow. Checkout fijado en `34e114876b0b11c390a56381ad16ebd13914f8d5`, profundidad 1, sin persistir credenciales; `contents: read`, paralelismo 1 y concurrencia fija sin cancelación automática. Sin secretos, schedule, dispatch, action cache, uploads, releases o despliegue.

Límite del job: 15 minutos; driver monotónico: 840 s. Cada fase debe disponer de **su ventana completa más diez segundos de margen de cleanup**, comprobada también inmediatamente antes de lanzar el proceso: fetch 240 s, compilación 300 s, supervisor 90 s y lote 300 s. La suma de todos sus máximos no cabe en 840 s: por diseño, una fase que consume demasiado impide iniciar la siguiente. No se recorta silenciosamente el lote criptográfico, aumentan los límites ni reintenta/reanuda. Timeout termina el grupo propio con TERM y después KILL si procede.

## Freeze nuevo y fuente inmutable

Ruta: `docs/qa/vault-recovery-synthetic-freeze-2026-11-10.json`. Forma relevante:

```json
{
  "schemaVersion": 1,
  "scope": "SYNTHETIC_RECOVERY_FIRST_BATCH",
  "approvedForSingleSyntheticRecoveryRun": true,
  "feature": "synthetic-recovery",
  "minimumRustVersion": "1.99.0",
  "workflowSha256": "<sha256 de este workflow>",
  "protocolSha256": "1b1125e92adb2e1360c67ca3dcaa1b86daa01e26591e7f6df496f7cd73195794",
  "expectedCaseInvocations": 18,
  "maxCaseMs": 60000,
  "maxBatchMs": 300000,
  "maxRssBytes": 805306368,
  "rssIntervalMs": 50,
  "requiredCaseIds": [
    "R01", "R03-wrong", "R03-missing", "R04-missing", "R04-wrong",
    "R05-live", "R05-retained-closed", "R06-final-truncate", "R07-body-flip",
    "R09-foreign", "R13-staging-collision", "R17-cipher-size", "R17-header",
    "R17-plain-size", "R17-log19", "R23a-internal-append",
    "R23b-external-append", "R18-scanner"
  ],
  "r23Bindings": {
    "R23a-internal-append": {"categoryCode": 4, "published": false},
    "R23b-external-append": {"categoryCode": 3, "published": false}
  },
  "expectedPreparation": {
    "baseFixture": 1,
    "negativeSealFixtures": 4,
    "baseExports": 1,
    "authenticatedNegativeEnvelopes": 2
  },
  "sourceHashes": {"<los ocho paths nativos revisados>": "<sha256>"},
  "baselineSourceHashes": {"<los otros siete .rs versionados>": "<sha256>"}
}
```

Los ocho paths son Cargo.toml, Cargo.lock, README.md, src/lib.rs, src/recovery.rs, tests/recovery.rs, tests/recovery_process.rs y tests/support/recovery_fixture.rs bajo `crates/lex-vault/`. La unión disjunta de mapas debe cubrir exactamente todos los archivos versionados del crate, actualmente 15. El workflow valida hashes de fuentes, workflow y [protocolo congelado](../../resources/vault-recovery-synthetic-v1.json) antes y después, además del inventario y hashes de la copia aislada. La aprobación nueva no cambia los estados históricos del protocolo o freezes anteriores.

El feature, los límites, IDs y R23 se comparan contra literales del workflow; el JSON no aporta comandos, selectors o shell. Fuente con symlinks, cambios, entradas adicionales, dependencias git/path/registro alterno o configuración Cargo heredada bloquea el ensayo. El lock conserva un único paquete local y 179 paquetes crates.io con checksums. Root debe calcular los hashes del código final aceptado, después de la compilación y el supervisor; esta entrega no crea ese freeze.

## Ejecución explícita

Se comprueban herramientas preinstaladas reales mediante rustup sin auto-install; mínimo 1.99.0 y host arm64. Cargo usa rutas absolutas y `env -i`, HOME omitido, CARGO_HOME/target/TMPDIR nuevos, SDK/Clang comprobados y target arm64 fijo. No hereda secretos, flags, wrappers, proxies, claves o caches del desarrollo. No instala toolchains. Fetch es anónimo y locked, retry 0/HTTP timeout 15 s. Compilación y tests usan offline y el perfil de red denegada de la VM; build scripts/proc macros pueden ejecutarse durante la compilación autorizada.

Después de `test --locked --offline --features synthetic-recovery --no-run`, se repite exactamente la regresión de recursos:

```text
cargo test --locked --offline --manifest-path <copia/Cargo.toml> --features synthetic-recovery --test recovery supervisor_cleanup_without_crypto -- --ignored --exact --nocapture --test-threads=1
```

Se requiere cargo cero y resumen de exactamente una prueba pasada, cero fallidas/ignoradas. Solo entonces, con al menos 300+10 s disponibles, se lanza **una vez**:

```text
cargo test --locked --offline --manifest-path <copia/Cargo.toml> --features synthetic-recovery --test recovery first_batch_18 -- --ignored --exact --nocapture --test-threads=1
```

No se invoca directamente el helper de recuperación; sus llamadas indirectas pertenecen al harness revisado y reciben datos sintéticos por pipe. No se ejecutan baseline SQLCipher de 36 pruebas, otros targets o una selección amplia de ignorados. Solo se compilan los demás targets mediante `--no-run`. No hay ruta automática al resto de la matriz, UI, store nativo o producción.

## Recibo requerido

Salida de cada test hasta 1 MiB en archivo temporal de VM y log de CI, sin subir artefactos. Cargo debe devolver cero, el harness declarar `running 1 test`, identificar `first_batch_18` y cerrar con `1 passed; 0 failed; 0 ignored`. El JSON puede aparecer en la misma línea que `test first_batch_18 ... ` o en su propia línea. Se acepta exactamente un recibo, sin claves duplicadas, constantes no finitas, campos adicionales o números de tipo incorrecto. Pánico o backend inesperado no se convierten en éxito por haber impreso un fragmento de recibo.

Se exigen exactamente los trece campos emitidos por el test actual, protocolo `vault-recovery-synthetic-v1`, invocations=18, caseMatrixRows=24, firstBatchOnly/eofChecksPassed verdaderos, roundtripProvisional/productionEnabled/h5Complete falsos. La lista debe conservar los dieciocho IDs únicos en el orden congelado. Categorías y publicación exactas:

| Caso | categoryCode | published |
| --- | --- | --- |
| R01 | 0 | true |
| R03-wrong / R03-missing | 3 / 2 | false |
| R04-missing / R04-wrong | MissingCredential / SourceIntegrity | false |
| R05-live / R05-retained-closed | SourceNotQuiescent | false |
| R06-final-truncate / R07-body-flip | 3 | false |
| R09-foreign / R13-staging-collision | 5 / 11 | false |
| Cuatro R17 | 9 | false |
| R23a-internal-append / R23b-external-append | 4 / 3 | false |
| R18-scanner | Sin categoryCode; positiveControl=true y encryptedNegative=true | Sin campo published |

R01 no se acepta si falta o falla cualquiera de R23a/R23b. Esos checks prueban el rechazo de append interno autenticado y append externo según el contrato del prototipo, no exhaustividad criptográfica. El resumen positivo solo aparece después de las aserciones del harness; otra salida o categoría falla cerrada.

El recibo también debe contener preparación exacta 1/4/1/2, RSS positivo entero de padre e hijo dentro de 805306368 bytes y elapsedMs entero positivo menor de 300000. Son campos de muestra/observación del harness; no se inventan tiempos individuales de caso o conteos de muestras ausentes.

## Denominadores y límites de la conclusión

Las 18 entradas se componen de **13 variantes de restore en hijos, cuatro negativos de sellado en proceso y un scanner**. Son distintas de la preparación: una fixture base, cuatro fixtures de sellado negativo, un export base y dos exports de sobres autenticados deliberadamente inválidos. **No equivalen a 18 llamadas KDF.** El número real de llamadas KDF no está instrumentado; `kdfInvocationCount=null` lo deja explícito.

El código supervisa caso/etapa a 60 s y lote a 300 s; monitoriza memoria del padre y muestras RSS de hijos con sleep configurado de 50 ms y threshold de 768 MiB. La duración real entre muestras incluye scheduler y ps, y no está medida en el recibo. No se promete intervalo máximo real de 50 ms ni límite duro de todo pico RSS. Se conservan por separado los dos máximos reportados; no se suman máximos que pudieron ocurrir en instantes distintos. El proceso externo limita el grupo completo durante la ventana de 300 s. Estos guardas no acreditan hardware físico de 8 GB.

El informe final mantiene `status=FIRST_BATCH_ONLY`, H5/8GB/producción inactivos. `cryptoTestsExecuted=true` solo si se observó el inicio del harness y el nombre exacto del batch; una invocación solicitada o compilación sola no lo acredita. `technicalPass` y `recoveryPrototypeReadonlyValidated` solo son verdaderos con supervisor pasado, cargo cero, recibo completo/18/R23 y freeze posterior íntegro. Ante fallo conserva `PARTIAL_FAILURE` y evidencia parcial, sin retry/resume ni convertir una medición técnica en aprobación jurídica o del producto. `cryptographyValidated=false` evita afirmar validación criptográfica general.

Este PASS acotado no completa H5, custodia de claves del sistema operativo, recuperación real, integración H3 de mapas/DAO, OS portability, aceptación física 8 GB o revisión de abogados. La siguiente fase requiere otra decisión y freeze del coordinador.

## Comprobación de esta entrega

Lectura del test/protocolo actuales, parseo YAML y AST del Python embebido solamente. Ningún driver, Cargo, compiler, helper, base, clave, KDF o test nativo se ejecuta en el Mac del dueño. No se añade un test que copie la implementación del workflow. La ejecución real permanece pendiente de supervisor verde y revisión independiente de este corte.
