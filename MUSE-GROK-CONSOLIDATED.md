# Consolidado Muse + Grokbot: verificación y corrección candidata

24nov2026. Delta sobre commit LOCAL 88cdc03adbb5a92d7f7868fe393c69ff0ea4766e, base remota 4ad70b4. No push, instalación, corpus activo ni reanudación de GLM. Retest independiente Linux comunicado a las13:25:53/53, build y tres smokes PASS; reprodujo WAL antes2/5 y después5/5, limpieza y hashes conservados. Bloqueo WAL resuelto para este alcance Linux. Retest Chrome Mac del delta pendiente; aceptación anterior de Mac no cubre esta corrección.

## Hipótesis contrastadas

### SQLite WAL: fallo real antes, corregido en candidato

Fixture: copiar índice y fuentes a directorio temporal; abrir escritor SQLite, activar WAL y desactivar autocheckpoint; cambiar solo texto de un registro por SYNTHETIC_WAL_MARKER; conservar WAL pero restituir bytes originales exactos del archivo principal. Su SHA256 vuelve a coincidir con el pin. Antes, openDofAppReview abre y sirve el marcador alterado desde WAL. Activar WAL sin restituir el main ya cambiaba su cabecera y se rechazaba, por eso ese caso solo no demostraba el fallo.

También se reprodujo influencia de WAL creado DESPUÉS de abrir el índice original. Rechazar solo archivos presentes al inicio no bastaba para ese caso.

Corrección: rechazar -wal, -shm y -journal, incluso vacíos; leer bytes del main una sola vez y validar su digest; escribir exactamente esos bytes a snapshot temporal propio de acceso restringido y abrir esa copia read-only. SQLite ya no consulta la ruta original ni sus auxiliares durante el servicio. El snapshot se elimina al cerrar y en errores de apertura/validación. No se cambió pin, candidato, HTML ni índice original.

Límite: no es defensa frente a un proceso con capacidad de modificar arbitrariamente código/memoria o los archivos privados del mismo usuario. El snapshot temporal es una copia del documento público, no datos privados. No se presenta como bóveda, aislamiento de sistema operativo o garantía externa.

### Captura reemplazada tras arranque: descartada para el corte actual

El servicio conserva en memoria el Buffer HTML cuyo hash verificó al abrir. Fixture reemplaza captura en disco después de arrancar y solicita GET: devuelve exactamente bytes originales, no el marcador nuevo. Una nueva apertura rechaza la captura alterada. Esta prueba ya pasaba antes de la corrección WAL. GET de captura pública sigue sin token, con CSP sandbox; API sí requiere Bearer. No se afirma reverificación por petición, sino servicio desde bytes comprobados retenidos.

### Ambas bibliotecas existen: separación confirmada en fixture

Se construyó biblioteca principal ficticia válida con marcador ZZ PRINCIPAL y se abrió a la vez que revisión DOF. library.status disponible; búsqueda principal encuentra su marcador, revisión no; revisión encuentra Aviso Cruce, principal no; IDs de principal no abren en dofReview.record y IDs DOF son rechazados por library.source. Bytes de biblioteca ficticia intactos. La prueba pasa antes y después. No tocó biblioteca real ni adoptó contenidos. Es prueba de namespaces/datos del fixture, no prueba de permisos multiusuario.

## Evidencia antes/después

Mismo archivo tests/dof-adversarial.test.mjs: contra adaptador anterior, 2/5 pasan (captura y coexistencia) y 3/5 fallan (WAL inicial, auxiliares, WAL posterior). Contra corrección, 5/5 pasan. Primer fixture principal demasiado corto fue rechazado por contrato de longitud del builder; se corrigió el fixture, no la validación de producto. No se cuenta ese error de arnés como fallo de separación.

## Delta Muse incorporado

Conteo distingue coincidencias de búsqueda de colección dev de nueve fragmentos, con singular/plural para 0/1/2. No es posición del resultado. Tarjeta de MVE dice modificación parcial/no consolidado; no llama parciales a todos los transitorios completos. Etiqueta texto del fragmento fuente. No se añadió advertencia de destino DOF defectuoso ni vigencia inventada.

## Medición de esta candidata

- Autor: build TypeScript/Vite PASS.
- 53/53 seleccionadas: cinco adversariales nuevas, siete DOF existentes, 18 Taller, 23 biblioteca/barreras.
- Tres smokes bundle Vite real y backend, incluida navegación App: PASS. Conteo 0/1/2 comprobado, captura local abierta, panel vacío, carrera importación Taller y separación de entradas con recarga. Cero excepciones.
- Capturas desktop y móvil de delta UX inspeccionadas. No nueva auditoría de accesibilidad.
- No se repitió suite completa tras este delta; medición anterior fue1521=1477pass+3fallos preexistentes ENOENT+41skip. No atribuir53 ni correcciónWAL al revisor anterior.

El corte anterior se reprodujo independientemente en Linux y Chrome macOS (build48y3smokes). Este nuevo delta solo tiene pruebas del autor en Linux hasta retest. WKWebView/Tauri/app nativa y clic DOF remoto siguen pendientes. La frase anterior de que último pin tenía solo pruebas del autor quedó superada por QA12:10, pero eso no cubre esta corrección nueva.

## Paquete de revisión

consolidated-delta.patch aplica sobre commit local88cdc03, no sobre main directamente. Archivos completos incluidos. Requiere los mismos artefactos públicos del ZIP conjunto, índice SHA305306c419b8ed7ae8495822374d0a04c68bf6bb34535679d46a70b76ecf40d9. No regenerar ni sustituir pin. Ejecutar cinco archivos seleccionados y tres smokes en copia separada. Main sigue retenido por instrucción20nov y bloqueo nuevo hasta revisión independiente de este consolidado.
