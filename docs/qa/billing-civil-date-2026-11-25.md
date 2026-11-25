# Honorarios: fechas civiles sin desplazamiento UTC

Corte local sobre main 12f5d8a1d64fc515a332f8afbf199572de97ddaa.
Sin publicar todavía.

## Defecto y corrección

Una resolución guardada como 2026-11-24 se mostraba como 23 nov en México
porque Date interpretaba la fecha civil como medianoche UTC. Además, el valor
inicial del formulario tomaba el día UTC: a las 20:30 del 24 nov en México
ofrecía el 25 nov. La prueba de componente real reproduce el primer defecto;
restaurar sólo el default UTC hace fallar específicamente el segundo.

La fecha civil se formatea en UTC con ancla de mediodía, sin convertir su día.
El formulario toma año/mes/día del navegador local. Las entradas con timestamp
siguen siendo instantes y conservan la conversión de zona del navegador.
No se cambia fecha almacenada, payload de cierre, backend ni cálculos monetarios.

## Medido

- Mismo fixture/componente React de aislamiento de honorarios; sin nuevo arnés.
- Reloj fijo 2026-11-25T02:30:00Z, contextos America/Mexico_City y Asia/Tokyo.
- Fecha civil 24 nov se mantiene en ambos; timestamp de entrada se muestra
  24 nov en México y 25 nov en Tokio. Default del formulario 24/25 respectivamente.
- Cambiar formulario a 2024-02-29 conserva exactamente ese string en HTTP
  sintético de resolution.close para el asunto B.
- 3 UI PASS, incluido aislamiento previo. Base falla México (23 vs 24 nov).
  Mutación default UTC falla México (25 vs 24), restaurada. Build PASS.
- Contratos tiempo/honorarios y vault 16 PASS. Diff --check PASS.
- Capturas de ambas zonas inspeccionadas: resolución 24 nov y registro
  instantáneo 24/25 visibles, legibles. No cambios de layout.

## Límites

HTTP simulado, sin Mac, modelo ni clientes reales. No fecha procesal calculada,
CFDI o migración. Zona del navegador determina hoy y los instantes, como antes;
la fecha civil elegida no lleva zona. No corrige las fechas de otras pantallas,
ni actualiza automáticamente un formulario que permanezca abierto al cruzar
medianoche. La suite general no se repitió para este cambio focal; CI la correrá
sobre el árbol publicado tras revisión.
