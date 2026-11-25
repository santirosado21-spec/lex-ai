# Preparación de sesión nativa cifrada, sin entrada productiva

Base ee939b2. Estado: módulo opt-in no importado por Tauri ni por launcher. No es app nativa integrada, interfaz de desbloqueo ni canal IPC. No se compiló/lanzó Tauri ni se instaló nada.

## Frontera

createNativePilotSession recibe root absoluto ya creado por un futuro caller nativo confiable y un identificador de ejercicio, nunca un destino enviado por una página. El controlador empieza locked sin crear archivos/HTTP. Bajo root separa native-pilot-v1/ejercicio. Rechaza rutas no canónicas, symlinks en ancestros/directorios y archivo de bóveda no regular o con hardlinks. Rechaza lex.sqlite incluso si es enlace roto: nunca invoca migración de almacén en claro. realpath/lstat no son defensa frente a un proceso local adversarial que cambie rutas entre comprobación y uso; el root debe ser privado/controlado por el caller, sin escritores no confiables. No promete sandbox del sistema.

unlock acepta Buffer en memoria y confirmación para bóveda nueva. Usa startServer real, intakePilot true, pilotPassphrase obligatorio, autoInitialize false, almacén cifrado existente. Consume y sobrescribe ambos buffers en finally incluso en errores/estados inválidos. No escribe secretos, no los pone en args/env/config/log/URL y no incluye detalles del error interno. La llave derivada queda en el vault existente hasta close. No promete borrado de todas las copias JS/OS, swap o crash dump. No añade llavero ni nuevas primitivas criptográficas.

startServer añade nativePilotPreparation opt-in, default false. Exige piloto cifrado, sin service externo ni autoInitialize. HTTP permite solo state, intake.status, intake.save, intake.readDocument, intake.downloadSource e intake.compareVersions. Todo lo demás se deniega antes del dispatch, incluido lector Ollama, importación, generación, biblioteca RPC, engine y acciones futuras. Esta restricción es necesaria porque el lector de documentos no usa inference.generate sino su propia ruta local. Permite lectura local de documentos ya guardados, no importar documentos nuevos en este corte. Rutas GET de archivos estáticos/fuentes públicas preexistentes no cambian.

Además inyecta proveedor lifecycle inerte y generación denegada, con generador intake explícitamente denegado. No depende del default intakeGenerate, que en servicio crea generador real si se omite. No hay inicialización del motor ni acceso a credenciales. El token aleatorio nuevo solo retorna como dato al caller confiable futuro. viewHash contiene pilot=intake, nunca token/frase. El caller deberá entregar connection por comando caller-gated y descartar conexión anterior; no reutilizar el hash con token del launcher navegador.

lock cierra app/HTTP/vault y permite nuevo unlock; dispose es terminal e idempotente al completar. Transiciones simultáneas se rechazan, sin devolver un desbloqueo ajeno a locked. Si close falla pasa a failed sin fingir bloqueo exitoso. El puerto puede ser reutilizado por SO; seguridad exige token nuevo y rechazo del anterior, no puerto siempre diferente. No existe endpoint HTTP unlock ni entrada ejecutable nueva.

## Medición

6 tests nuevos PASS. HTTP y vault reales con datos sintéticos: save, reabrir, secreto equivocado/reintento, estado protegido, token nuevo y anterior 401, servidor cerrado al lock, buffers cero, confirmación/legacy/symlinks/copia bajo otro ejercicio/concurrencia/dispose terminal. Fetch instrumentado rechaza todo salvo HTTP loopback del servicio y prohíbe explícitamente puerto Ollama; cero intentos prohibidos en recorrido. Acciones lector/generación/futuras devuelven403 antes del dispatch. No mide detector ni UI. Comparación+soportes+boundary+desktop/inventory:77 PASS,1 SKIP específicoMac. Build frontend0. Mutación con main base:2FAIL/4PASS; restaurado6PASS. No prueba una promesa de no llamada initialize por spy: se verifica autoInitializefalse/contrato y ausencia de red/modelo en recorrido; proveedor inyectado no puede cargar pesos.

Incidencia del ensayo de mutación: primera versión del negativo de configuración no pasaba dataDir y no cerraba una app si faltaba rechazo. Al retirar guard de main, abrió almacén de esquema vacío en el HOME Linux de ensayo y dejó HTTP vivo hasta timeout. No fue Mac ni datos del usuario. Corregido test: tmpdir explícito y finally cierra cualquier app inesperada. Repetición mutación termina2FAIL, sin timeout. Registro no se oculta; no se borró ni se atribuye a producto. No repetir esa versión defectuosa del test.

## Pendiente antes de integrar

Caller Rust autenticado de ventana empaquetada exacta, transporte efímero de secreto desde entrada oculta/llavero y desbloqueo sin almacenar secreto en frontend; identidad/dataDir aislados, UI locked/unlocked con renovación de conexión; UX para funciones sin inferencia; revisión de canal y recuperación. Inventario runtime aprobado sigue faltante en rutas consultadas por conductor. No build/GUI hasta revisión y levantamiento de pausa. No cambia default productivo ni cierra F6/F7.

## Revisión de portabilidad y cierre fallido

Revisión Mac del conductor encontró 4/6 fallos con TMPDIR de sistema por /var/folders enlazado a /private/var; con raíz canónica6/6. Tests ahora canonicalizan realpath(mkdtemp) antes de crear sesión, sin relajar guard de producto. El futuro caller nativo debe canonicalizar el root mediante la API del sistema antes de pasarlo. Alias de sistema no son una razón para aceptar raíces enlazadas sin comprobar.

Si app.close falla, estado failed conserva referencia app pero no ofrece recuperación/reintento en este corte. No se probó por inyección ese fallo. Crear otra sesión no demuestra que el recurso anterior se cerró; el caller deberá diagnosticar y confirmar cierre/puerto/proceso antes de continuar. No hay limpieza garantizada de un recurso que quedó vivo por fallo de close.
