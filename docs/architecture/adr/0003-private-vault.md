# ADR 0003 — Bóveda local y recuperación fuera del equipo

Fecha: 2026-11-09. Estado: **decisión de arquitectura para implementar H5b**, con puerta de viabilidad y paridad obligatoria. H5a inventaría y fija contratos; no instala estas bibliotecas, cifra datos, migra bases de usuarios ni demuestra recuperación. Este ADR no sustituye las pruebas de implementación.

## Problema y evidencia

La base actual `node:sqlite` contiene originales, FTS, historiales, mapas futuros, borradores/versiones, correo y horas. El [inventario I01–I27](../private-data-inventory.md) describe las demás superficies. El control sintético V00 del [reporte](../../qa/vault-inventory-2026-11-09.json) confirma que se puede reabrir sin clave y que páginas/diario conservan texto claro. Permisos de archivo no resuelven esto. `PRAGMA key` sobre SQLite ordinaria no convierte el backend en SQLCipher.

Se requiere proteger los datos controlados por la aplicación en reposo, cerrar accesos al bloquear y recuperar originales/correspondencias en un entorno limpio sin depender del Keychain del equipo perdido. El objetivo de 8 GB y las funciones de búsqueda/documentos/escritos/horas siguen vigentes; no se acepta cifrar solo campos y dejar el índice legible.

## Opciones y decisión

| Opción mantenida | Ventaja | Coste/límite | Decisión |
| --- | --- | --- | --- |
| SQLCipher Community con Rust/rusqlite | Cifrado de páginas de base e índice; conserva modelo relacional/FTS y transacciones | Compilación/avisos de licencia; frontera IPC y adaptación DAO requieren paridad real | Elegida como arquitectura objetivo, sujeta a H5b.1 |
| Archivo SQLite completo cifrado mediante age, con trabajo en memoria/snapshot por escritura | Formato mantenido útil para archivo/recuperación, evita implementar primitivas | Reconstrucción del índice/base en RAM y reescritura completa no encajan bien con datos crecientes/8 GB; usar SQLite temporal claro viola el límite al fallar | Usar age para recuperación, no como backend activo |
| Cifrar registros/BLOB con una biblioteca AEAD pero mantener SQLite/FTS normales | Cambios locales aparentes en algunos campos | Índice, metadatos, páginas antiguas y diarios siguen revelando datos; rediseñar búsquedas/autenticación no queda resuelto por una primitiva | Descartada como solución suficiente de este slice |

SQLCipher no es una extensión cargable de SQLite normal; necesita su propia compilación. Sus diarios tienen tratamiento específico y hay que configurar/verificar temporales, no inferir protección de WAV o cachés ajenas. Referencia: [diseño SQLCipher](https://www.zetetic.net/sqlcipher/design/). Community permite uso comercial con avisos BSD y dependencias; no se compra una edición comercial ni se afirma FIPS: [licencia/avisos](https://www.zetetic.net/sqlcipher/community/).

## Bibliotecas y límite de implementación

Objetivo inicial verificable en H5b.1:

- `rusqlite = "=0.41.1"` con `bundled-sqlcipher`, FTS y flags de temporales en memoria comprobados en el binario resultante. En macOS, estudiar la vía SecurityFramework del build mantenido antes de añadir OpenSSL externo; no depende de Homebrew del cliente. Fuente: [rusqlite y características SQLCipher](https://github.com/rusqlite/rusqlite). Fijar también revisiones transitivas y versión SQLCipher efectivamente compilada en Cargo.lock/SBOM; esta sesión no resolvió ni compiló ese grafo.
- `security-framework = "=3.7.0"` para APIs Keychain de macOS, cuenta por `vaultId/keyVersion`, clase/acceso y política de sincronización elegidas explícitamente; usar opciones que no autoricen sincronización por defecto. Estudiar [API mantenida](https://docs.rs/security-framework/3.7.0/security_framework/passwords/index.html) y [Keychain Apple](https://developer.apple.com/documentation/technotes/tn3137-on-mac-keychains). La compatibilidad exacta de opciones, entitlements y recuperación se prueba en H5b, no se presupone por existir una función.
- `age = "=0.12.1"` para cifrar el paquete de recuperación mediante passphrase independiente, usando su formato/API mantenidos y sin criptografía propia. Fuentes: [API de passphrase](https://docs.rs/age/0.12.1/age/), [implementación y licencia rage](https://github.com/str4d/rage). No pasar passphrases/DEK por argv, variables de entorno, prompts o logs.

Son versiones elegidas para el spike, no dependencias ya incorporadas. Antes de incluirlas: verificar sus licencias/avisos y transitivas, versiones de macOS/Apple Silicon, arquitectura de binario, FTS, cryptoprovider, tempstore, tamaño/tiempo de arranque y empaquetado/firma. Si el spike falla, H5b se detiene para diagnóstico; no sustituye backend o proveedor en silencio.

**Proceso y autoridad:** mantener la clave de datos en un proceso Rust propio y supervisado, con conexión SQLCipher privada. El broker Node solo obtiene operaciones de dominio versionadas y acotadas, no `.db`, SQL libre, shell ni lectura arbitraria de archivos para agentes. No añadir un puerto público de almacén. Usar IPC privado heredado del proceso con mensajes/identidad/longitud/estado controlados y cerrar descriptores al bloquear; la amenaza y autenticación local se revisan en H5b. No se afirma que separar procesos proteja de malware con privilegios del usuario.

La API actual es síncrona. **No portar por sustitución mecánica:** primero introducir contrato DAO asíncrono y matriz de paridad sobre fixtures, sin claves reales ni activar migración. Las operaciones compuestas (original+registro+chunks+FTS; versiones de borrador; aprobación/resultado; horas) siguen siendo una transacción de dominio en el backend; no se trocean en RPC independientes sin atomicidad. Todas las lecturas exigen ámbito; el backend vuelve a comprobarlo aunque Node haya autorizado antes.

## Modelo de bóveda, bytes y procedencia

Una bóveda por workspace local con `vaultId` opaco, clave de datos independiente y aislamiento lógico despacho/asunto/hilo. Un nombre de cliente nunca es ruta o cuenta Keychain. Mapas reversibles se vinculan al workspace/asunto, versión/namespace, versión exacta del documento y linaje. Compartir clave de bóveda dentro del despacho no concede permiso entre asuntos ni multiusuario.

Adoptar el contrato versionado de bytes/manifiesto del inventario: originales binarios exactos; texto extraído con hash y versión de extractor/transformaciones declaradas; offsets UTF-16 sobre ese texto, no sobre bytes DOCX/PDF; JSON canónico UTF-8 sin normalización implícita para estructuras. Los derivados conservan IDs/hash/ámbito/categoría de padres; la categoría resultante no puede ser menos restrictiva sin una decisión local explícita y auditable. Cifrar también manifiestos/índices privados; no dejar nombres de documento, correspondencias o fragmentos en un sidecar claro.

Este contrato congela la interfaz para H4b; no fija todavía la biblioteca/extractor del detector ni acredita su medición. H4b puede desarrollar y medir el detector real contra estos contratos sin esperar la implementación H5b. Si H5b cambia serialización/procedencia, versionar y repetir los tests/mediciones afectados antes de H6.

## Custodia, bloqueo y recuperación

La clave de datos se genera con APIs criptográficas mantenidas del sistema, nunca por un LLM. Keychain guarda el acceso de uso local; la UI/modelos no reciben la clave. Generación, permisos, vida en memoria y versión son código crítico para revisión especializada. No prometer borrado de strings V8 por GC ni eliminación de todo vestigio del SO.

Al bloquear: parar scheduler de correo/proactivos antes de cerrar datos; cancelar generación/extracción/dictado/exportación; invalidar conexiones/tokens Office y operaciones en vuelo; cerrar handles y rechazar nuevos accesos. Para soltar heaps privados Node/UI se requiere reinicio/limpieza de proceso/vista con nueva sesión, no confiar solo en vaciar una lista React. La custodia nativa puede permitir desbloqueo posterior, pero el backend se niega a leer mientras su estado lógico esté bloqueado. H5b debe medir la secuencia y carreras de callbacks.

**Recuperación independiente:** obtener snapshot consistente mediante la API transaccional de la biblioteca, incluir base cifrada completa (originales/mapas/versiones), manifiesto interno y material necesario de recuperación de esa versión de clave. Cifrar todo el paquete con age/passphrase independiente; no dejar DEK o manifiesto privado claro en un ZIP o al lado del backup. El secreto de recuperación se conserva fuera del equipo y del propio backup; debe poder introducirse en un perfil limpio sin el Keychain original. UI debe explicar que perder ambas vías puede hacer los datos irrecuperables. El protocolo de fortaleza/generación y el flujo de guardar/verificar el secreto se implementan y prueban, no se delegan a un modelo gratuito.

Backup con `vaultId`, esquema, versiones de serialización/clave/mapa/FTS, revisión, linaje y hashes autenticados dentro del contenedor. Rotar clave no revoca mágicamente copias antiguas y secretos ya entregados: definir recuperación/retención por versión y qué hacer si se pierde cada secreto. Un backup anterior puede recuperarse en una bóveda nueva aislada mediante su secreto correspondiente; no puede sobrescribir por defecto la activa o traer consentimientos de envío antiguos.

Restaurar requiere archivo completo/autenticado y versiones soportadas; validar en staging seguro, restaurar a **nuevo linaje y nueva ubicación** y comparar bytes/datos antes de publicar. CAS contra revisión esperada impide perder escrituras posteriores; ante conflicto no hay merge automático. Correo aprobado/submitting vuelve a revisión/unknown y jobs de generación a estado revisable; no ejecutar acciones por recuperar un consentimiento viejo. Reconciliar temporizadores sin inventar tiempo o duplicar cobros. Solo se publica el destino íntegro, con rollback/versiones explícitos y origen preservado.

## Temporales y salidas explícitas

SQLCipher no protege `dictation-tmp/*.wav`, `opened-documents/document-*/<nombre>` ni el TMPDIR global del motor por el hecho de cifrar la base. H5b debe cerrar **todas** esas rutas: procesamiento de audio en memoria con API mantenida o scratch cifrado comprobado que no deje claros tras crash; preparación de exportaciones en memoria; buffers acotados; configuración nativa/WebView/daemon observada. `finally` no ejecuta limpieza tras SIGKILL. No copiar datos a un staging claro para luego cifrarlos.

Abrir escritos seguirá disponible mediante visor local y una acción explícita de copia/exportación externa cuando se necesite otra app. La copia solicitada a ubicación elegida por el usuario está fuera de la bóveda; explicar su persistencia y que Word/otras apps pueden guardar autosave/cachés propios. No renombrar silenciosamente el cache actual como «exportación» para dar la prueba por aprobada. Tampoco eliminar exports deliberados al bloquear. Hasta implementar esa distinción no se declara H5b listo ni se cambia el modo actual de la app por este ADR.

## Entregas y criterios de parada H5b

1. **H5b.1 — Viabilidad/paridad sin migrar usuarios:** compilar bibliotecas fijadas y binarios Apple Silicon; confirmar versión real/cipher/FTS/tempstore; prototipo con bóveda NUEVA sintética y DAO de dominio, matriz de todas las operaciones actuales, transacciones y regresiones. API/broker nuevo permanece inactivo. Si falta compatibilidad o se pierde una función, diagnosticar antes de seguir.
2. **H5b.2 — Ciclo privado y recuperación:** Keychain/recovery age, temporales/lock/Office/daemons/UI, escrituras durables, fallos V01–V24 y restauración real en entorno limpio. Separar simulación de SIGKILL de corte eléctrico/VM; no afirmar un escenario no ejecutado.
3. **H5b.3 — Migración desde copia sintética y paridad de release:** export/import offline a nuevo vault, idempotente por fase, con origen intacto. Considerar legacy solo lectura dentro del prototipo, sin declarar que la copia legacy sin cifrar esté protegida. El cambio de backend requiere paridad y pruebas antes de ofrecer una migración real. Revalidar H3V, memoria conjunta y empaquetado; no tocar ni borrar la base de esta Mac.

Archivos/propietarios previstos figuran en el [protocolo V00–V24](../../qa/vault-test-protocol.md). Añadir explícitamente `src-tauri/src/vault.rs`, un worker/broker Rust si se separa (`src-tauri/src/bin/lex-vault.rs` o crate propio decidido en el spike), `server/privacy/vault-client.mjs`, DAO/migración, tests y Cargo.lock. La ubicación final se fija antes de asignar; no editar los mismos archivos en paralelo. Astra se reserva para código criptográfico, IPC o un fallo difícil donde aporte; Sol mantiene documentación, integración habitual y pruebas.

## Estado de aceptación

H5a cierra inventario/contratos, decisión y protocolo con revisión independiente. Solo V00 negativo fue ejecutado: **la implementación actual sigue sin cifrado**. SQLCipher/Keychain/age y los pasos V01–V24 no se probaron en esta entrega. No hay migración, recuperación real, validación FIPS, Tauri nativo/8 GB o autorización de piloto. H5 completo/H6 no se desbloquean por aprobar un ADR.
