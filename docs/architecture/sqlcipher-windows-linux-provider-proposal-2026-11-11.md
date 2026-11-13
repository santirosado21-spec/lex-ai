# Propuesta (sin código) — SQLCipher para Windows y Linux

**Fecha:** 2026-11-11 · **Responsable:** Pedro (cofundador) / implementación documental ChatGPT
**Estado:** propuesta para revisión de Santi; no aprobada ni implementada.
**Rama:** `pedro/sqlcipher-portability-proposal-20261111`.
**Fuente de arquitectura vigente:** `crates/lex-vault/Cargo.toml` (`rusqlite=0.41.1`, `bundled-sqlcipher`) y `crates/lex-vault/src/lib.rs:open`.

## Problema exacto

El prototipo `SyntheticVault` inicializa SQLCipher con `sqlite3_key`, exige `PRAGMA cipher_provider = 'commoncrypto'`, FTS5, temp_store=MEMORY, `TEMP_STORE=2|3`, foreign_keys=ON y journal_mode=DELETE. Ese guard es correcto **para la evidencia macOS** y falla cerrado fuera del entorno probado. No hay hoy proveedor alternativo autorizado, contrato de distribución Windows/Linux, custodia de llave de producto ni migración de schema 4/5. La bóveda sigue sintética e inactiva; la app activa no obtiene cifrado por redactar esta propuesta.

## Alternativas evaluables, ninguna activada

| Ruta | Qué supondría | Ventajas | Riesgos, dependencias y licencias |
| --- | --- | --- | --- |
| **A · SQLCipher Community + OpenSSL del sistema** | Mantener la versión fijada de `rusqlite` con `bundled-sqlcipher`, enlazando contra una biblioteca criptográfica disponible y fijada en cada SO; introducir provider-gate *explícito por plataforma* tras medir capacidades reales. | Menor peso potencial que un OpenSSL vendorizado; paquetes de seguridad del SO en Linux. | En Windows el despliegue de OpenSSL/libssl y rutas DLL es especialmente delicado; riesgo ABI, mezcla de proveedores, cambios de PATH y falsos pases en equipos distintos. No confundir carga de librería o `cipher_version` con cifrado operativo. Cumplir BSD-3-Clause SQLCipher y avisos de dependencias. |
| **B · SQLCipher Community + OpenSSL vendorizado** | Probar la feature documentada `bundled-sqlcipher-vendored-openssl` de rusqlite en **una rama separada**, con build reproducible y versiones/digests fijados para x64/ARM cuando proceda. | Reduce la dependencia de instalación de OpenSSL del cliente; más control del artefacto. | Artefacto mayor, superficie de build de C/compiladores, actualizaciones CVE y ciclo de parches propios; verificar que OpenSSL realmente es el provider en runtime. Preservar avisos SQLCipher BSD-style, OpenSSL Apache-2.0 (o condiciones que apliquen a versión específica) y licencias de todo el grafo. No interpretar vendorización como licencia comercial ni mantenimiento automático. |
| **C · Paquetes comerciales/enterprise de Zetetic** | Solicitar cotización, condiciones de redistribución, plataformas, soporte, parches, FIPS si fuera exigencia contractual. | Soporte formal y artefactos específicos bajo contrato. | Costos/licencia no autorizados; el trial no da permiso de redistribución ni producción. No contratar, descargar con cuenta ni activar antes de decisión explícita de Santi. |

**Recomendación de exploración:** empezar por **B como candidato técnico de laboratorio**, sin cambiar `main`, porque permite un artefacto autocontenido cuyo proveedor/ABI se puede comprobar. **No es aprobación de distribución ni elección definitiva:** A puede ser preferible donde existan bibliotecas del SO controladas, y C si soporte/licencias reguladas son requisito. Mantener `commoncrypto` en Mac mientras no exista evidencia de regresión y aprobación separada.

## Requisitos de seguridad que no se negocian

1. **Fail-closed por plataforma y proveedor.** La futura rama debe atestiguar `cipher_version` no vacío, nombre exacto de proveedor esperado, FTS5, temp_store memory, journal DELETE, foreign keys, sin fallback a SQLite plano. Nunca usar `PRAGMA key` textual ni registrar claves, SQL privado, originales o entradas de mapas.
2. **Compatibilidad y apertura.** Abrir con clave correcta e incorrecta, un archivo plano y otro de proveedor diferente; garantizar ausencia de recreación, downgrade automático, corrupción o migración implícita. Registrar salt/KDF/compatibility por versión sin exponer material secreto; comparar ciphertext/reopen entre plataformas con **solamente fixtures ficticios**, y decidir si archivos son portables antes de prometerlo.
3. **Aislamiento y durabilidad.** Exigir permisos/ACL locales, journal/WAL/temp cifrados o ausentes, escáner de canarios de BD y artefactos temporales con control positivo, transacciones IMMEDIATE + CAS, triggers de inmutabilidad, errores uniformes y cierre. SQLite cifrado no sustituye broker/autorización/custodia/backup.
4. **Cadena de suministro y cumplimiento.** Fijar versiones, SBOM del binario, reproducibilidad por runner, licencia y avisos visibles accesibles al usuario. Verificar impactos legales de distribución propia; no asumir que el listado de metadatos de crates equivale a dictamen jurídico.
5. **Validación.** Antes de integrar: CI limpia en Windows y Linux (incluido Windows 11/x64 y Ubuntu LTS, con variantes de arquitectura según distribución), revisión distinta del autor, test de rendimiento/arranque, límites de memoria de la app completa y aceptación real en equipo de 8 GB. Un `cargo test` exitoso no valida salida confidencial, recuperación de identidad ni calidad jurídica. No correr pruebas nuevas H5/age en la Mac del dueño.

## Plan para una eventual implementación (no autorizado por esta nota)

- **P0 (Santi):** elegir B/A/C y objetivos de distribución, resolver licencias y presupuesto, decidir si interoperabilidad Mac↔Windows↔Linux es obligación de release.
- **P1:** rama aislada con feature compilada sólo por target, contrato de capacidades específico y fallback **prohibido**; sin editar el gate macOS probado hasta revisión.
- **P2:** tests públicos/sintéticos en runners efímeros con paquete y hashes congelados; revertir al primer fallo de cifrado/canario/ABI; nunca usar datos reales.
- **P3:** revisión externa de código, empaquetado y seguridad, después custodia, sesión local, recuperación y backup bajo autorización; sólo entonces decidir integración al producto.

## Decisiones pendientes de Santi

**D1.** ¿La prioridad de implementación es el build autónomo con OpenSSL vendorizado (B) o bibliotecas del sistema (A)? **D2.** ¿Se necesita portabilidad criptográfica entre SO o únicamente crear/abrir en el mismo SO? **D3.** ¿Hay un requisito comercial/FIPS/soporte que justifique cotización comercial (C)? Esta propuesta no toma esas decisiones ni abre gasto.

## Referencias comprobables (consultadas 2026-11-11)

- [Zetetic — licencias SQLCipher Community, Commercial y Trial](https://www.zetetic.net/sqlcipher/license/). Community BSD-style exige atribución en materiales accesibles; trial prohíbe redistribución/producción.
- [Zetetic — edición Community y uso comercial cerrado](https://www.zetetic.net/sqlcipher/community/). Community puede incorporarse con cumplimiento de términos.
- [SQLCipher LICENSE.txt fuente](https://github.com/sqlcipher/sqlcipher/blob/master/LICENSE.txt). Condiciones BSD de redistribución y no endorsement.
- [rusqlite v0.41.1](https://docs.rs/crate/rusqlite/0.41.1) y [features documentadas de rusqlite](https://github.com/rusqlite/rusqlite). Diferencian `sqlcipher`, `bundled-sqlcipher` y `bundled-sqlcipher-vendored-openssl`.
- [libsqlite3-sys de rusqlite](https://github.com/rusqlite/rusqlite/blob/master/libsqlite3-sys/Cargo.toml). Fuente de integración nativa y selección de features; verificar la revisión efectivamente fijada por Cargo.lock antes de build de release.

**Afirmación limitada:** son opciones documentales; ninguna ruta se compiló, enlazó, cifró, reabrió ni fue probada en Windows/Linux dentro de este trabajo.
