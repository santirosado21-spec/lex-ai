# Tiempo y honorarios local

`server/time-billing.mjs` mantiene tiempo, honorarios y resolución dentro de la base SQLite local del despacho. Cada consulta durable exige `workspace_id` y, cuando corresponde, `matter_id`; el factory vuelve a verificar el asunto mediante el capability interno `matter()` antes de leer o escribir. No recibe texto de documentos, ni llama a red, ni expone herramientas al usuario.

## Dinero y redondeo

`duration_minutes`, `billed_minutes`, `rate_centavos` y `amount_centavos` son enteros. Nunca se guarda ni suma un decimal. La duración de un tramo de temporizador se redondea a un minuto entero con mitad hacia arriba; las entradas manuales ya requieren un número entero de minutos. Al crear una entrada facturable se fija la tarifa aplicable y el incremento configurado para el asunto (1, 6 o 15 minutos): `billed_minutes = round-half-up(duration_minutes / increment) * increment`. El importe guardado es `round-half-up(billed_minutes * rate_centavos / 60)`. Los reportes suman los importes de cada entrada, no vuelven a calcular el importe total. Así se conserva el mismo resultado tras miles de registros y cambios posteriores de tarifa.

Un acuerdo por hora puede tener tarifa del asunto o usar la tarifa predeterminada del cliente. Los acuerdos fijo, retainer, contingencia y pro bono se preservan como configuración; no inventan un importe horario. La contingencia se expresa en puntos base enteros (por ejemplo, 1,250 = 12.50%). Todo valor usa `MXN`; esto es administración interna, no CFDI, IVA ni factura fiscal.

## Temporizador, resolución y CSV

Solo puede existir un temporizador por usuario local y despacho. La tarifa se captura al iniciarlo. Pausar guarda únicamente minutos enteros; reanudar inicia un nuevo tramo. Tras 12 horas en curso se marca como obsoleto por una posible caída. No se crea un cargo silencioso: la persona debe recuperar y guardar o descartar explícitamente el temporizador. La recuperación que guarda limita el tramo en curso a esas 12 horas y deja el evento auditado.

El estado por asunto es `abierto`, `en-espera`, `resuelto` o `archivado`. `resolution.close` es la única vía para `resuelto`, exige resultado, fecha y notas acotadas, y genera `resolution.close` en la bitácora. Las estadísticas reúnen estados/resultados, duración desde `matter.createdAt` hasta la fecha de resolución, entradas de tiempo, tareas pendientes y recordatorios propuestos/aprobados existentes.

El CSV se codifica UTF-8 con BOM para Excel. Toda celda que comienza con `=`, `+`, `-` o `@` recibe un apóstrofo inicial; los valores se entrecomillan siguiendo CSV. La exportación contiene solo metadatos de tiempo y no texto de documentos.

## Contrato de métodos

Métodos de temporizador y registros:

- `time.active`, `time.start`, `time.pause`, `time.resume`, `time.stop`, `time.recover`, `time.create`, `time.list`

Métodos de honorarios y reportes:

- `billing.arrangement.get`, `billing.arrangement.set`, `billing.clientRate.get`, `billing.clientRate.set`, `billing.report`, `billing.markBilled`, `billing.exportCsv`

Métodos de resultado:

- `resolution.get`, `resolution.setStatus`, `resolution.close`, `resolution.reopen`

Estadísticas: `statistics.get`.

## Acceso en escritorio

Desde 0.4.6 la vista **Tiempo y honorarios** está en Herramientas jurídicas. El servicio valida los parámetros con el módulo de tiempo y delimita las operaciones por despacho y asunto.

## Migración y reversibilidad

La migración aditiva crea las tablas `time_entries`, `active_timers`, `fee_arrangements`, `client_hourly_rates` y `matter_resolutions` con `CREATE TABLE IF NOT EXISTS`; intencionalmente conserva `PRAGMA user_version` porque la migración previa de contrapartes y su prueba de compatibilidad son dueñas de ese marcador. No modifica documentos ni borra datos. Para una reversión de código, conservar las tablas es seguro: son datos locales independientes y las versiones anteriores las ignoran.
