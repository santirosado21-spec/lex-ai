# Tiempo y honorarios: respuesta tardía de otro asunto

V3 (delta de prueba de solapamiento; lógica V2 intacta). Corte local sobre main c1a60267f7aee02d806f8bd6f6fb679243dc6fcc. Sin publicar todavía.

## Defecto reproducido

TimeBillingView mantiene su instancia al cambiar asunto. Retener resolución A,
seleccionar B y completar B antes de liberar A mostraba estado, resultado y nota
de A bajo el encabezado de B. La regresión falla en base por nota A visible.
No se ejecutó un cierre incorrecto ni se usaron datos reales.

## Cambio

Una revisión de carga y el asunto activo descartan respuestas obsoletas. Los
resultados globales se actualizan aunque falle el detalle del asunto. Estado listo pertenece al
asunto cargado; acuerdo y resolución anteriores no se muestran al cambiar y las
acciones esperan una carga vigente. Fallar carga mantiene las acciones bloqueadas.
Limpieza y notificaciones de éxito no se aplican al nuevo asunto si cambió
mientras esperaba. Toda operación refresca el asunto actualmente visible y los
globales al terminar. Sus fallos permanecen visibles con el asunto original
(timer usa su propio asunto). Operaciones excluidas por ref impiden solapamiento.
El timer global conocido conserva pausar/detener aunque falle cargar detalles;
Reintentar carga permite recuperarse sin navegar. No cambia contratos de servidor, importes, reglas ni SQLite.

## Medido

- Componente React real, estilos del producto, HTTP simulado sintético.
- Respuesta A tardía tras B; A no se muestra bajo B. Carga A fallida después de
  cambio externo: sin tarifa B y botones resolución/cobrado deshabilitados.
  Volver a B recupera tarifa correcta, botones y ausencia de error previo.
- 1 prueba focal PASS. Base sin corrección falla por nota A visible. V1 falla
  nuevo caso escritura retenida tras navegar: timer global queda obsoleto.
- V2 cubre inicio retenido tras navegación externa, stop fallido tras cambio
  con aviso del asunto del timer, timer operable tras fallo de detalles y retry.
  Tres mutaciones aisladas fallan cada una: quitar invalidación, omitir refresh
  tras cambio y silenciar fallo tras cambio. Restauradas, prueba focal PASS.
- Delta V3: dos eventos submit síncronos en el mismo turno del navegador
  crean una sola operación retenida. Quitar operation.current produce dos
  peticiones y falla 2 != 1; restaurada, focal PASS. Sin cambio de lógica V2.
- Workflow de fuentes/UI (V2, no repetido por delta de prueba V3): 370 tests, 367 PASS, 3 SKIP, 0 FAIL.
- Contratos tiempo/honorarios y vault: 16 PASS. Build y diff --check PASS.
- Capturas 1280/390 inspeccionadas, timer B identificado y detalle A correcto, sin overflow
  de página. Tablas estrechas conservan su desplazamiento interno existente.

## Límites

Sin Mac, modelo ni clientes reales. HTTP de esta regresión simulado; contratos
backend se probaron por separado. No validación de facturación real o CFDI.
No cubre dos ventanas concurrentes ni persistencia nueva. Entradas de formulario
no guardadas al cambiar asunto, reloj en vivo y revisión de fechas son problemas
separados, no se declaran resueltos aquí. Un trabajo de escritura ya enviado no
se cancela por cambiar asunto; conserva su destinatario original.
