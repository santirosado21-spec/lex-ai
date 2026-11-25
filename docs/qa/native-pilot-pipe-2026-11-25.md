# Puente privado de desbloqueo nativo: contrato y evidencia

Base df9977e. Preparación opt-in, no entrada ejecutable ni importación por main.rs. No diálogo real, build nativo, GUI o instalación. No se afirma app integrada.

## Camino del secreto

El futuro Rust crea un hijo Node con stdin/stdout anónimos exclusivos y stderr no persistido. Le fija root canónico de identidad aislada y ejercicio validados por código nativo, nunca parámetros de webview. runNativePilotPipe no acepta frase en protocolo. Para create/unlock usa createNativePilotSecretReader: /usr/bin/osascript con script constante de diálogo hidden answer, shell=false, env vacío, encoding buffer, tamaño y timeout limitados, cancelación por AbortSignal. El script en argv tiene solo texto fijo, no secreto. La frase retornada cruza el stdout del diálogo al proceso Node y se copia a Buffer para vault; stdout/stderr capturados se sobrescriben. Confirmación solo en create. No llavero nuevo ni persistencia de frase.

Esto limita superficies, no demuestra ausencia global de copias: osascript y sistema de diálogos manejan texto; execFile puede tener buffers internos y memoria del proceso; un debugger con acceso al proceso puede leerlos. No hay promesa de borrado de JS/OS/swap/crash dump ni confidencialidad contra administrador local. No se ejecutó el diálogo en Mac. El proceso padre debe mantener stdout del helper privado: contiene token/conexión, aunque no frase. Nunca heredarlo a consola, volcarlo a log, incluirlo en errores o URL. El módulo no puede probar que un caller arbitrario use pipes privados; rechaza TTY, pero la responsabilidad de construirlos recae en Rust.

## Protocolo específico

UTF8 canónico, un JSON compacto por línea LF: op status/create/unlock/lock/dispose, único campo, sin IDs, payload o strings libres. Máximo128bytes/frame, decodificación fatal UTF8, tamaño acumulado acotado antes de concatenar; chunking no afecta semántica. Duplicate keys/whitespace no canónico rechazados por comparación con serialización exacta. Malformado/operación desconocida/campos extra devuelve solo request_failed. Overflow trunca canal y limpia sesión. Comando concurrente rechazado, sin cola de prompts. No endpoint HTTP de desbloqueo.

Respuesta ok con estado; create/unlock devuelve connection y viewHash sin secreto. Rust guarda connection solo en memoria y solo entrega a main empaquetado exacto de piloto por comando caller-gated. Nuevo unlock genera token nuevo; UI debe invalidar cache anterior en lock/unlock. El hash pilot=intake no transporta token/frase. Este consumidor Rust y reset de cache UI todavía no se implementan.

lock responde locked solo tras close real. dispose responde disposed y termina canal. EOF/error/pérdida salida aborta diálogo pendiente y espera dispose; cierre fallido retorna closed:false/failed:true, no promesa de limpieza. SIGKILL/crash de Node no ejecuta finally; servidor del mismo proceso muere al terminar proceso, pero futuras conexiones/procesos/recursos externos no están demostrados. Rust deberá cerrar stdin, esperar acuse/proceso con timeout y kill+wait de SU hijo si no termina, sin matar otros PIDs. No debe recrear sesión ante failed-close suponiendo limpieza.

## Consumidor nativo mínimo pendiente

No modificar main productivo por defecto. Un montaje opt-in futuro necesita: identidad/config propia, root canonicalizado por sistema, hijo privado con inventario runtime revisado y hash; comandos vacíos caller main+packaged exacto+pilot hash (no popup/remoto/debug); diálogos sin parámetros controlados por página; estado locked sin connection; connection nueva tras unlock y cache invalidada; lock verificado antes de desmontar UI; cierre/espera del hijo por ownerRAII. El controlador general connection actual no debe seguir entregando la conexión vieja en ese montaje. No añadir opener ni permisos remotos. Hasta cerrar estos puntos, no activar ni decir entrada nativa completa.

Inventario runtime aprobado sigue faltante en rutas consultadas por conductor; módulo/protocolo no lo aprueban ni descargan nada. GUI pausada.

## Medido

7tests de puente/diálogo,6session y boundary:69PASS. Diálogo se simula únicamente mediante execFile fake para inspeccionar script/argv/env/opciones/limpieza/cancelación/errores; no prueba macOS real. Pipes de memoria comprueban creación/vault real, rotación/token, lockHTTP cerrado antes respuesta, malformed/extra/duplicate/future/overflow/truncated/concurrencia/EOF/outputloss/refusal. Un proceso Node hijo real con stdio pipe y reader sintético fijo comprueba protocolo por pipes de proceso, ausencia del secreto sintético en stdout/stderr y fin del listenerHTTP tras EOF y exit0. No modelos ni nube. Build frontend0. No pruebas Rust, foreground, UI ni inventario. Los tests tienen raíces realpath(tmpdir), cleanup y guard de proceso propio.
