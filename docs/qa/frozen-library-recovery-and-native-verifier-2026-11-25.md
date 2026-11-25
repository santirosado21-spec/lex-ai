# Recuperación congelada y límite del verificador nativo

Corte técnico: 25 de noviembre de 2026. Sin adquisición ni reconstrucción de la
biblioteca, sin ejecución de modelos y sin GUI. Sin cambio de producto.

## Comprobación de la pareja de biblioteca

Se comprobaron solo metadatos y SHA-256 de la pareja DB y manifest en un
worktree local de Cursor, sin escritura. Ambos archivos eran regulares, sin
enlaces. La DB tiene 153014272 bytes y SHA-256 igual al índice fijado; el
manifest tiene 58890 bytes y SHA-256 igual al versionado.

La pareja se copió a un clon aislado de pruebas. El verificador congelado la
aceptó y los seis archivos de prueba que usan la biblioteca pasaron 19/19,
incluidas tres pruebas antes bloqueadas por ENOENT. El SHA de la DB de origen
se volvió a comprobar sin cambios.

Pin exigido: índice de 153014272 bytes con SHA-256
`ec944a19d40be5faa0bd0ee081e906145038446aa8df394b706adc2daddd1588`, y manifest
con SHA-256
`20a8095d148e61349dfac99c2127ae14a9b3dc35a9e154681d51e1647839bed1`.

No se abrió SQLite fuera de esas pruebas. No se ejecutó verify-package, ni
modelo, ni GUI, ni build de paquete. Un informe anterior sin ruta reutilizable y
una referencia de Drive sin identificador no son evidencia de un artefacto. No
se debe reconstruir ni descargar un sustituto para ocultar ENOENT, ni usar el
indexador por defecto v1 como restauración v2.

## verify-package no garantiza cero modelo

Una recomendación anterior proponía usar `verify-package.mjs` sin la opción de
chat para comprobar el paquete sin modelo. Es insuficiente y se retira.

Código inspeccionado:

- `scripts/verify-package.mjs` inicia el backend con `LEX_DESKTOP=1`.
- `server/main.mjs` usa `LEX_DESKTOP==='1'` como valor por defecto de
  `autoInitialize` y al final llama `inference.initialize()` si está activo.
- `LEX_VERIFY_CHAT` solo limita comprobaciones posteriores de conversación; no
  desactiva la inicialización anterior.

Advertencia: ejecutar ese script puede arrancar el motor y preparar el modelo
aunque se omita el chat. Es una propiedad del código, hallada por lectura; no se
ejecutó para confirmarla. No hay una ruta comprobada de ese verificador con
garantía de cero arranque.

## Qué falta para validar el paquete sin GUI

Compilar y probar Rust, construir el paquete y arrancar sus servicios son pasos
separados. Las pruebas de módulos ya reportadas no prueban la configuración
efectiva ni el arranque del bundle. El build requiere Mac de arquitectura
destino, dependencias offline, inventario revisado de runtime y fuentes, y la
pareja pública exacta. La preview aislada con autoInitialize desactivado no
equivale al producto ni permite ficha/export por su allowlist.

Aun con biblioteca y build correctos quedarían sin probar: GUI y diálogo, 8 GB,
calidad jurídica y privacidad del modelo.
