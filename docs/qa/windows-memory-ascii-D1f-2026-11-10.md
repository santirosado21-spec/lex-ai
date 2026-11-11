# D1f: probar una hipótesis mínima sin elevar límites

El diagnóstico D1e registró BOOT, pero ningún READ_READY/CIM_START. La siguiente hipótesis se limita al intervalo común de mutación de codificación; no concluye si el problema era New-Object, setter de consola, autoload u otra interacción. El protocolo del colector sólo necesita claves ASCII fijas y valores numéricos, por lo que se eliminan OutputEncoding/InputEncoding y New-Object. Se añade guard de bytes ASCII, manteniendo UTF8 fatal y schema/tipos/árbol estrictos. [Fuentes y estado](windows-memory-ascii-D1f-2026-11-10.json).

No cambia comando CIM, entorno, scope, bootstrap10s, consultas2s, respuesta4MiB, procesos propios o producción. Casos con bytes noASCII, campos foráneos escapados y números enviados como texto bloquean. Builder31/31 y revisor27/27 (sin runtime suite), diff limitado aprobado para un solo ensayo normal sin marcador de diagnóstico. Si falla, se conserva y vuelve al diagnóstico, sin incrementar deadlines o repetir automáticamente.

La siguiente ejecución Windows evaluará esta hipótesis sobre VM pública estándar; ningún fallo anterior se transforma en pase. Aun si el smoke pasa, memoria extra de PowerShell, sondeo500ms, Tauri, instalador y equipo físico8GB seguirán sin aceptación.
