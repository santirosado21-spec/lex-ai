# D1g — diagnóstico A/B del entorno PowerShell

**Preparado para revisión, no ejecutado en Windows.** No modifica el helper o monitor productivo ni amplía sus deadlines. No es un cuarto intento de implementación: compara un único comando fijo bajo dos entornos para localizar el defecto persistente. No hubo push, ejecución CI, instalación o nuevo gasto desde esta entrega.

## Evidencia previa preservada

Logs locales en `artifacts/phased-completion-20261110-batch2/`:

| Ensayo | Evidencia observada | Lo que no demuestra |
| --- | --- | --- |
| `windows-ci-first.log` D1c | Primera muestra falla a 2020.85 ms; cero muestras | No distingue arranque, módulos, stdin o CIM |
| `windows-ci-protocol2.log` D1d | STARTUP_TIMEOUT a 10000.53 ms | No identifica la instrucción bloqueada |
| `windows-cim-diagnostic-third.log` D1e | BOOT a 2198.35/178.09 ms; después READ_READY_TIMEOUT/CIM_START_TIMEOUT | Se detiene antes de lectura/CIM; no demuestra que UTF-8 sea la causa |
| `windows-ci-ascii-first.log` D1f | Sin mutaciones de encoding; STARTUP_TIMEOUT a 10006.49 ms | Retirar encoding no resolvió; tampoco prueba que CIM sea lento |

Todos los lanzamientos examinados pasan únicamente `SystemRoot` y `WINDIR` al ejecutable Windows PowerShell fijado. `New-Object`, conversión JSON, selección y CIM aparecen en las rutas afectadas. No hay evidencia suficiente para atribuir los tres fallos a una causa concreta.

Microsoft documenta búsqueda recursiva de módulos y reconstrucción de `PSModulePath` cuando falta. Si incluye `$PSHOME\Modules`, Windows PowerShell puede insertar la ruta AllUsers; añadir la variable no garantiza que sea la única ruta efectiva. La ausencia de la variable **no equivale a ausencia de módulos**. Véase la sección Windows PowerShell startup de [about_PSModulePath](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_psmodulepath?view=powershell-7.5).

El uso inicial de cmdlets y `Get-Command` con nombres exactos puede cargar sus módulos; los comodines no tienen el mismo comportamiento. Esto hace comprobable la hipótesis de búsqueda/autoload bajo entorno incompleto, sin confirmarla todavía. Fuentes: [about_Modules 5.1](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_modules?view=powershell-5.1), [Get-Command 5.1](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/get-command?view=powershell-5.1).

## Experimento predeclarado

- A: `SystemRoot` y `WINDIR` exclusivamente.
- B: mismo entorno, añadiendo sólo `PSModulePath` derivado del directorio validado del ejecutable PowerShell del sistema y `Modules`. No hereda la variable del shell padre ni acepta una ruta proporcionada por documentos.
- Exactamente el mismo comando literal, argumentos y stdin numérico en ambas variantes; primero A y después B. Máximo dos PowerShell y una fixture Node propia, sin descendientes de la fixture. No retry ni fallback.
- Fases: BOOT → ENV → LOOKUP_UTILITY → LOOKUP_CIM → READ_READY → JSON → CIM → RESULT → DONE. La solicitud `{id:1,pid}` se envía sólo después de READ_READY. Los timeouts indican la fase que estaba ejecutándose, no la fase siguiente.
- ENV emite sólo número de entradas y booleano de presencia de la ruta builtin; nunca valores. No se afirma una whitelist efectiva de módulos por el comportamiento de startup descrito arriba.
- Consulta local filtrada al PID de la fixture, sólo ProcessId/WorkingSetSize. La salida conserva únicamente count=1 y RSS positivo seguro, nunca filas, PID, nombres, rutas o líneas de comando. `Get-CimInstance` sin servidor/sesión remota usa WMI local: [documentación Microsoft](https://learn.microsoft.com/en-us/powershell/module/cimcmdlets/get-ciminstance?view=powershell-5.1).

Cada sonda tiene un plazo **absoluto de 10 s**, que ninguna fase renueva, y hasta 250 ms para observar su salida tras kill. Si no se observa la salida, no inicia la segunda. Readiness de fixture: 2 s. Limpieza normal/forzada de fixture: hasta 500+500 ms. Watchdog global a 26 s aborta sondas y mata sólo la fixture propia; presupuesto configurado total 27 s. El tiempo monotónico también se verifica al recibir datos y close: callbacks tardíos no convierten un timeout en éxito. Retrasos del scheduler/OS pueden exceder el presupuesto observado y se reportan como incumplimiento, nunca como validación.

Sólo se aceptan marcadores finitos, enteros acotados y hasta 4096 bytes ASCII. Stderr se descarta. Excepciones, señales arbitrarias, cabeceras, entorno y textos de procesos no se serializan. La limpieza debe observarse y la fixture terminar limpiamente para declarar `diagnosticComplete`. Ese campo significa diagnóstico completado, **no aprobación de rendimiento**, seguridad general, instalador, hardware 8 GB o inferencia.

## Interpretación anticipada

A atascado en lookup y B completo apoyaría una interacción del entorno/búsqueda, pero **orden y cachés están confundidos**: una pareja secuencial no demuestra causalidad. Ambos atascados allí dejarían abierta la hipótesis de otras variables, cache o carga del módulo. Llegar a READ_READY y detenerse en JSON localizaría conversión/entrada; llegar a CIM aislaría una fase posterior. Éxito de ambas sondas tampoco satisface el protocolo productivo de 2 s o su colección persistente. No habrá una nueva corrección productiva inferida automáticamente del resultado.

## Workflow y verificación

El prefijo exacto `[windows-env-diagnostic]` al inicio del mensaje del head commit selecciona sólo el job D1g. Los jobs RSS y D1e lo excluyen; D1e conserva su marcador previo y no se vuelve a ejecutar con D1g. Un siguiente commit sin marcadores restaura RSS. Los tres jobs requieren repositorio público, `contents: read`, runner estándar `windows-2025`, timeout de cinco minutos y checkout fijado sin persistir credenciales. Sin uploads, schedule, instalación Node o dispatch automático adicional.

Prueba local: 49/49 contratos dirigidos pasan en macOS con PowerShell simulado y fixture Node sintética real. No ejecutan CIM ni prueban rendimiento Windows. Comando reproducible:

```sh
node --test tests/windows-cim-env-diagnostic.test.mjs tests/windows-cim-diagnostic.test.mjs tests/windows-memory-monitor.test.mjs tests/windows-process-memory.test.mjs tests/windows-memory-smoke.test.mjs tests/runtime-memory.test.mjs
```

## Alternativa nativa, sin implementación

Un helper Rust/Win32 podría evitar arranque de PowerShell, autoload y JSON de shell, usando API de memoria de proceso y enumeración de snapshots. Microsoft documenta [GetProcessMemoryInfo](https://learn.microsoft.com/en-us/windows/win32/api/psapi/nf-psapi-getprocessmemoryinfo) y [snapshots de procesos](https://learn.microsoft.com/en-us/windows/win32/toolhelp/taking-a-snapshot-and-viewing-processes). Sería un componente adicional que exige revisión de handles/permisos, cierre y reciclaje de PID, arquitectura, empaquetado y pruebas Windows. No está demostrado que mejore esta implementación ni se incorporan dependencias/builds ahora. Primero se obtiene evidencia del bloqueo actual.
