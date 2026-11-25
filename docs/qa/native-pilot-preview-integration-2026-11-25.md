# Entrada nativa preview integrada en código, feature apagada

Base e5ea737. Este corte conecta entrypoint Node, consumidor Rust y vista de bloqueo en código. NO se compiló Rust, ejecutó diálogo, abrió GUI ni generó bundle. No es entrada nativa validada. Default Cargo no incluye la feature; cuerpo previo main se conserva bajo cfg inverso. No activar ni publicar antes de revisión.

## Frontera y estado

Feature native-pilot-preview, sin default. Config separado exige identifier exacto mx.lexai.nativepilot.preview; sin bundle activo y ventana initialURL de preview. Se rechaza identidad del producto antes de crear root/hijo. Config base no cambia. El caller crea app_data_dir de identidad propia y lo canonicaliza. Ejercicio fijo preview, sin selección de ruta proveniente de webview. Node entry acepta solo root canónico y ejercicio, no frase. Ejecuta puente privado existente por stdio y sale distinto de0 si no cerró bien. No importación por main general.

Rust inicia Node empaquetado con env_clear, stdin/stdout piped, stderr null. Sin secreto en args/env: root y preview no son secretos. Lector acota4096bytes/respuesta, canal capacidad1, timeout250s. Operaciones en blocking worker con try_lock rechazan concurrente sin cola de prompts. Cuerpo vacío y ventana main empaquetada exacta #pilot=intake&native=preview; remotos/debug/popup/otras rutas rechazados. Comandos create/unlock/status/lock responden estado, nunca token. native_connection devuelve conexión RAM solo a ese caller. URL y token devueltos por hijo se validan. Rechazo de create/unlock estando abierto se verifica también ANTES de invocar diálogo en Node.

Lock borra connection Rust antes de request; UI limpia connection/cache/texto/componentes al iniciar lock, permanece busy, solo declara locked al acuse real. Errorclose deja failed sin botones de reabrir. UI recarga connection en cada unlock y api usa epoch para rechazar respuestas HTTP anteriores incluso si JSON termina tarde. El texto leído se elimina al cambiar documento y el lector usa generation guard. Comparación reutiliza componente existente. No frase en UI, URL ni hash. El hash solo selecciona vista.

RAII del Bridge cierra stdin y espera hasta4s, luego kill+wait de su hijo. Cierre normal espera EOF/dispose del Node; no hay promesa de prueba kill ni de salida limpia si fue necesario matar. Este código Rust no está compilado: firmas Tauri, async/blocking, cierre/lifecycle, identidad efectiva y caller real requieren revisión y compilación autorizada. Tests regex solo etiquetados estáticos, no verifican semántica Rust. No ejecutar el candidato por nombres de target previos.

## Utilidad y límite actual

Vista aislada permite abrir/crear sesión cifrada, leer originales y comparar dos soportes ya guardados. No ofrece importación ni generación; backend preparation las prohíbe. Una identidad y ejercicio nuevos están vacíos y la UI lo dice. No copia datos del perfil del usuario ni migra plaintext para llenar la demo. El hito útil completo requiere decidir y probar cómo incorporar soportes sin ampliar inferencia por accidente, o usar una bóveda sintética preparada expresamente en el scope correcto. No simular éxito de importación con mocks como prueba nativa.

## Evidencia fueraMac

30testsPASS:7pipe,6session,2integración,1cache tardía,1UI, más13API/capture. El entrypoint real ejecuta status por pipeschild, acuse locked y EOFexit0 sin abrir diálogo. Prueba puente rechaza unlock abierto antes de nueva petición de secreto. UI real renderizada Chromium con móduloIPC de prueba y API sintética verifica retirada de texto ANTES del acuse lock, token1→token2, fallo cierre sin reabrir. Píxeles open1280/failed390 inspeccionados, sin overflow. Capturas son UI simulada, no Mac/Tauri. Cache test real api.ts transpiled rechaza cuerpo tardío tras reset. Build frontend0.

No se midió diálogo macOS real, Rust compile, gate nativo ejecutado, kill, runtime integrado, importación o modelos. No se cambió default de nube/modelo. NoF6/F7.

## Inventario

Conductor reportó lectura de Node arm64v22.22.3 nvm, LICENSE disponible y firma aún por verificar; sin tarball proveedor para cotejo. Ollama0.40.6 notarizada universal con symlinks/dependencias fuera contrato regular actual. No hay inventario aprobado. Es brecha técnica de procedencia/paquete, no obligación del usuario de aprobar una copia basada en un documento generado. No copia/build/distribución autorizados por este corte. El builder actual exige Node y Ollama aunque esta preview no cargue modelo; no se relajó contrato para decir bundle listo.

## Delta de revisión lifecycle

EvidenciaUI ahora respeta REJON_UI_EVIDENCE_DIR o tmpdir; sin /downloads fijo. Bridge/ChildOwner separado en módulo Rust específico sin Tauri. Owner compartido fuera del mutex del request mantiene estado terminal, cierra/kill/reap propio sin esperar mutex del diálogo. Su mutex protege solo try_wait/kill de duración acotada, nunca lectura bloqueante ni espera de protocolo; bucles de espera duermen fuera. Fallo lock/dispose marca terminal y stop, no solo error recuperable. CloseRequested/Destroyed y Exit usan Owner separado. No respawn. UI que recarga con backend unlocked ofrece exclusivamente bloquear, sin restituir conexión/texto ni abrir otra sesión.

Se escribieron4 tests Rust reales de Bridge con hijo /bin/sh simulado: rechazo close, EOF/timeout breve, stop concurrente con request pendiente y ausencia de hijo vivo, status/cierre normal. NO ejecutados aquí por falta de Cargo; el conductor tiene autorización de compile/test offline aislado, no app/GUI. El diseño de stop espera hasta200ms EOF, luego kill propio y sondea try_wait hasta2s; no afirmar que un proceso imposible de matar ya murió por cumplir timeout. Estado terminal evita continuar, caller aún debe comprobar proceso. Revisión de capacidades/subframes/config efectiva continúa pendiente.

## V3 cierre ordenado

Se reemplaza la gracia200ms por5s de tolerancia de cierre al EOF, no garantía de SQLite ni del disco. Terminal se fija inmediatamente y stdin se cierra para cancelar diálogo/activar finally dispose de Node. Atomic closing evita que stop concurrente mate antes de acabar la gracia; comparte resultado por Condvar sin mutexchild retenido. Tras gracia se permite kill propio y2s de sondeo. StopOutcome distingue Graceful únicamente exit0 sin kill, Forced si kill enviado y proceso reaped, Unconfirmed para exiterror o sin confirmación. Estado terminal siempre impide reabrir; diagnóstico stderr solo enum, sin URL/token/secretos. El diagnóstico no convierte forced en limpio. No se añade recuperación/respawn.

entrypoint común retorna resultado de runNativePilotPipe, que espera operación activa y dispose; CLI solo termina0 con closed y no failed. Error dispose queda failed y exit1. Test JS ejecuta entrypoint fallido por frame truncado y verifica exit1; no es inyección específica de falloSQLite/dispose. Se añaden tests Rust reales para cierre>200ms sin kill, forced separado y Node real que usa funciónentry común con reader sintético solo fixture, guarda canario cifrado, cierra graceful, reinicia y verifica contenido/integrity_check. No frase/token en argumentos de fixtures: credenciales efímeras para comprobación solo pipe stdin. Aún requieren ejecución del conductor, no afirmar pase antes de su recibo.
