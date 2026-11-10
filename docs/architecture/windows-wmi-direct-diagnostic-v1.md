# D1h — sonda WMI directa sin descubrimiento de cmdlets

Propuesta de contrato del 10-11-2026, preparada por Codex/Sol siguiendo PSF. Contrato aprobado por el coordinador para implementación acotada; **sin ejecución Windows ni aprobación de rendimiento**. Código y selección de workflow preparados para revisión independiente. El manifiesto compañero es [windows-wmi-direct-diagnostic-v1.json](../../resources/windows-wmi-direct-diagnostic-v1.json). La ejecución sigue pendiente de revisión independiente y autorización del coordinador.

## Pregunta y evidencia previa

D1g conservó dos resultados `TIMEOUT_LOOKUP_UTILITY` con presencia declarada de la ruta builtin. No alcanzó lectura de stdin, JSON ni CIM. La instrucción entre los marcadores era `Get-Command` para varios cmdlets de utilidad; esto localiza un límite de instrucción, sin demostrar qué mecanismo interno se detuvo. El orden minimal→builtin y los posibles efectos de caché impiden inferir causalidad del arranque más rápido del segundo proceso. Registro preservado: `artifacts/phased-completion-20261110-batch2/windows-cim-env-first.log`, commit `7fb989e4ee945718eee483c915bbc1f33591842b`.

D1h pregunta si un único acceso local WMI, mediante tipos .NET documentados y sin pasar por los cmdlets afectados, alcanza resolución de tipo, construcción, consulta y enumeración dentro de una sonda de diez segundos. No intenta arreglar el monitor, ampliar sus deadlines ni sustituir una medición ausente por cero.

## Soporte documental y disponibilidad pendiente

La [fuente oficial de about_Type_Accelerators para PowerShell 5.1](https://raw.githubusercontent.com/MicrosoftDocs/PowerShell-Docs/main/reference/5.1/Microsoft.PowerShell.Core/About/about_Type_Accelerators.md) enumera `wmisearcher` como alias de `System.Management.ManagementObjectSearcher`. La [documentación oficial 5.1 de clases](https://raw.githubusercontent.com/MicrosoftDocs/PowerShell-Docs/main/reference/5.1/Microsoft.PowerShell.Core/About/about_Classes.md) incluye la construcción mediante `::new`. La [API de constructores](https://learn.microsoft.com/en-us/dotnet/api/system.management.managementobjectsearcher.-ctor?view=netframework-4.8.1) documenta la sobrecarga con ámbito y consulta como strings; [Get()](https://learn.microsoft.com/en-us/dotnet/api/system.management.managementobjectsearcher.get?view=netframework-4.8.1) obtiene la colección de resultados.

Estas fuentes sostienen el diseño del acceso tipado. **No comprueban que el tipo, ensamblado, constructor o servicio sean utilizables en el runner concreto.** Las páginas API solicitadas con vista .NET Framework mostraron también una cabecera de paquete reciente; no se usa esa cabecera como evidencia del ensamblado instalado. La resolución del acelerador, construcción y llamada se observan por separado; no hay instalación, carga alternativa, `Add-Type` ni fallback si fallan. La URL web de about_Type_Accelerators 5.1 no fue accesible en esta consulta; se leyó su archivo oficial MicrosoftDocs, no una fuente secundaria.

[Win32_Process](https://learn.microsoft.com/en-us/windows/win32/cimwin32prov/win32-process) declara ProcessId y ParentProcessId como uint32 y WorkingSetSize como uint64, en bytes. La sonda no trata una coincidencia de PID como identidad duradera ni usa estos datos para autorizar acceso a documentos.

## Contrato de ejecución propuesto

Una fixture Node propia, sin descendientes, conserva un buffer sintético de 8 MiB. Se conserva su handle de proceso y PID asignado por spawn; no se acepta PID de argumentos, archivos o variables de entorno. IPC cerrado o plazo fijo de treinta segundos terminan la fixture. Readiness y liveness se verifican, incluso después de awaits y antes de una desconexión intencional; solo una salida esperada cero acredita su limpieza.

Se crea **un solo** Windows PowerShell 5.1 mediante la ruta absoluta derivada de SystemRoot validado, con NoLogo/NoProfile/NonInteractive, shell desactivado y entorno mínimo SystemRoot/WINDIR idéntico a la variante A de D1g. No hay cambios de PSModulePath, perfiles, políticas de ejecución, consola o encoding. Stderr se descarta.

El programa PowerShell será literal y fijo. No contendrá Get-Command, Import-Module, New-Object, ConvertFrom-Json, ConvertTo-Json, Select-Object, Sort-Object, Get-CimInstance, Get-WmiObject, Invoke-Expression o ejecución de texto recibido. Solo sintaxis del lenguaje y métodos/propiedades .NET. Los identificadores se resuelven dentro del proceso; su coste forma parte del plazo.

Tras READ_READY se envía una única línea ASCII de dígitos decimales: el PID de la fixture. Se valida como uint32 positivo con parseo numérico invariante y estilo sin signos/espacios. No se transmite una consulta. Se construye una sola consulta de forma fija: `SELECT ProcessId,ParentProcessId,WorkingSetSize FROM Win32_Process WHERE ProcessId=<decimal validado>`, con ámbito local literal `root\cimv2`. El único fragmento variable es la representación decimal del uint32 validado. No hay nombre de servidor, credenciales, ámbito recibido, búsqueda amplia o segundo intento.

Se utiliza el constructor tipado de `wmisearcher` con los dos strings. Get y la enumeración posterior pertenecen ambos al trabajo WMI observado: recibir una colección no demuestra que su enumeración haya terminado. Debe haber exactamente una fila, ProcessId idéntico al PID propio solicitado, ParentProcessId uint32 y WorkingSetSize entero positivo seguro para JavaScript. Cero filas, duplicados, valores ausentes, cero RSS o conversiones inciertas fallan cerradas.

Se eliminan explícitamente los objetos de fila, colección y buscador mediante Dispose en finally; la limpieza no tiene un plazo independiente que amplíe el límite absoluto. Solo se emiten marcadores ASCII fijos y un RESULT numérico: count, PID solicitado, parent PID y RSS decimal invariante. Node debe comprobar identidad numérica y límites antes de eliminar los PID del informe persistido. El informe no persiste filas, PID, parent PID, nombres, rutas, consulta expandida, entorno, excepciones o stderr.

## Protocolo y límites

Secuencia única: BOOT → TYPE_RESOLVE → TYPE_READY → READ_READY → QUERY_CONSTRUCT → QUERY_READY → WMI_GET → WMI_ENUMERATE → RESULT → DISPOSED → DONE. El marcador anterior a cada operación identifica qué límite no terminó; no identifica su causa interna. Errores usan un marcador/categoría de un conjunto cerrado, sin mensajes originales.

- Diez segundos **absolutos desde antes de spawn**, sin renovación por fase; verificación monotónica antes de aceptar cada marcador, agregado o close. Callback tardío no permite aceptar salida vencida.
- Tras fallo, kill solo del PowerShell propio y hasta 250 ms para observar close. Salida no observada deja diagnóstico incompleto; no se abre otro proceso alternativo.
- Readiness de fixture hasta 2 s; cierre normal/forzado hasta 500+500 ms; watchdog global a 14 s y presupuesto total máximo configurado de 15 s. Exceso observado del scheduler/OS se declara incumplimiento.
- Máximo 4096 bytes ASCII y secuencia exacta. Se rechazan salida adicional, buffer final no terminado, campos fuera de esquema y números inseguros. Parseo de informe en Node puede usar JSON; el programa PowerShell no usa cmdlets JSON.
- Una consulta, un PowerShell y una fixture; cero retry, fallback, downloads, instalación, dependencias o activación productiva.

`diagnosticOnly=true` y `performanceValidated=false` permanecen siempre. `diagnosticComplete` requiere resultado finito interpretable, salida observada y fixture terminada con cero después del cierre intencional; nunca equivale a PASS del monitor. El prefijo exacto `[windows-wmi-diagnostic]` selecciona únicamente el nuevo job público D1h; los anteriores lo excluyen y un commit posterior sin marcador restaura RSS. No se ejecuta CI desde esta entrega. El cambio de workflow pertenece al protocolo nuevo: no actualiza el hash histórico del freeze D1g.

## Interpretación predeclarada

Llegar a RESULT mostraría que esa ruta tipada, ese PID y ese acceso WMI local pudieron completarse sin los cmdlets bajo la misma política mínima de entorno. Apoyaría seguir investigando la ruta de descubrimiento/importación y distinguirla de una imposibilidad general del acceso WMI, pero **no demuestra que autoload sea la causa**. API, proyección y ejecución son distintos de D1g, y no hay asignación aleatoria ni control de caché.

Un fallo en TYPE_RESOLVE deja disponibilidad/carga de tipos abierta. Fallo en QUERY_CONSTRUCT puede involucrar constructor, ámbito o inicialización. Fallo en WMI_GET/WMI_ENUMERATE sitúa el límite dentro de la ruta WMI, sin separar servicio, proveedor, permisos o COM. Sin marcador suficiente, la causa sigue desconocida.

Aun con RESULT no se valida árbol de descendientes, PID reciclado, memoria compartida, muestreo repetido a 2 s, coste de un colector persistente, inferencia, instalador o aceptación física de 8 GB. La siguiente decisión requiere evidencia y revisión; no activa un fallback de producción.
