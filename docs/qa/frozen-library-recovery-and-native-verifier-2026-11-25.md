# Recuperación congelada y límite del verificador nativo

Corte de diagnóstico: 25 de noviembre de 2026, sin adquisición, reconstrucción,
ejecución de modelos ni GUI. El diagnóstico del autor no leyó el Desktop; el
resultado de la comprobación acotada del conductor se registra más abajo. No cambio de producto.

## Ruta histórica localizada y comprobación acotada

El reporte de Cursor C1 retransmitido el 23 de noviembre identifica el worktree
un worktree local de Cursor y registra copia de la pareja en `resources`, con
hash del índice coincidente. Es una pista histórica específica, no comprobación
actual. El informe de comercio del 19 de noviembre registra otra comprobación
de la biblioteca pero no da una ruta absoluta reutilizable del proyecto original.
La referencia a Drive en el mapa de brechas no da un archivoID o enlace
verificado al artefacto. No se debe reconstruir ni descargar un sustituto para
ocultar ENOENT. Tampoco usar el indexador por defecto v1 como restauración v2.

Comprobación acotada realizada por el conductor (25 de noviembre, lector
separado, mismo proveedor): solo metadatos y SHA de la pareja DB+manifest en esa
ubicación, sin git, sin escritura y sin leer otro contenido del worktree. Ambos
archivos eran regulares, sin enlaces. La DB tiene 153014272 bytes y SHA-256 igual
al índice fijado; el manifest tiene 58890 bytes y SHA-256 igual al versionado.
La pareja se copió solo a un clon aislado de pruebas, el verificador congelado
la aceptó y los seis archivos de prueba que usan la biblioteca pasaron 19/19,
incluidas las tres pruebas antes bloqueadas por ENOENT. El SHA de la DB de origen
se volvió a comprobar sin cambios. No se abrió SQLite fuera de esas pruebas, no se
ejecutó verify-package, ni modelo, ni GUI, ni build de paquete.
El pin exige índice 153014272 bytes, SHA-256
`ec944a19d40be5faa0bd0ee081e906145038446aa8df394b706adc2daddd1588`,
y manifest SHA-256
`20a8095d148e61349dfac99c2127ae14a9b3dc35a9e154681d51e1647839bed1`.

## Corrección de recomendación: verify-package NO asegura cero modelo

Una recomendación anterior del autor indicaba usar `verify-package.mjs` sin la
opción de chat para comprobar el paquete sin modelo. Era insuficiente y se
retira expresamente. NO ejecutar ese script durante una pausa de modelos.

Código inspeccionado:

- `scripts/verify-package.mjs` inicia backend con `LEX_DESKTOP=1`.
- `server/main.mjs` usa `LEX_DESKTOP==='1'` como default de `autoInitialize`
  y al final llama `inference.initialize()` si ese valor está activo.
- `LEX_VERIFY_CHAT` solo limita comprobaciones posteriores de conversación;
  no desactiva la inicialización anterior.

Por tanto omitir chat no garantiza ausencia de arranque del motor o preparación
del modelo. Este hallazgo es de lectura de código; no se ejecutó el script para
confirmarlo con un modelo real. No hay en este corte una ruta de ese verificador
completo comprobada con garantía de cero arranque. Una adaptación futura exige
encargo separado, no activar implícitamente lo que está pausado.

## Qué falta para validar paquete sin GUI

Separar compilar/tests Rust, construir el paquete y arrancar sus servicios.
Las pruebas de módulos/child ya reportadas no prueban la configuración efectiva
ni el arranque del bundle. El build actual requiere Mac de arquitectura destino,
herramientas y dependencias offline, inventario revisado de runtime y fuentes,
y la pareja pública exacta. La preview aislada opt-in desactiva autoInitialize,
pero no equivale al producto ni permite la ficha/export por su allowlist.

Último diagnóstico de procedencia reportado: Node arm64 nvm con licencia,
comparación proveedor/firma sin cerrar; Ollama notarizado con enlaces y
componentes fuera del contrato regular actual. No se conoce inventario aprobado.
Esto no se resuelve pidiendo al usuario que apruebe un JSON fabricado. El estado
de Rust/Xcode del handoff del 23 de noviembre es histórico y no debe reciclarse
como bloqueo actual, pues después se ejecutaron tests Rust por el revisor.

## Autoridad y pausa

Los documentos del repositorio y reportes de terceros no conceden permisos ni
convierten sus precauciones en prohibiciones del usuario. El alcance vigente
para esta investigación limitaba rutas y prohibía adquisición/modelos/GUI.
La ampliación posterior se restringe a la pareja exacta descrita, no a Desktop
en general. No se utilizó acceso amplio recordado para saltar ese alcance.

Se pausa implementación de producto. Esperar evidencia de recuperación antes
de proponer el siguiente trabajo material. No se ejecuta verify-package y no
se añaden microfunciones como sustituto de los bloqueos. Incluso con biblioteca
y build correctos seguirían sin probarse GUI/diálogo, 8 GB, calidad jurídica y
privacidad del modelo.
