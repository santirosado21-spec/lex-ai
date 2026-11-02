# Pendientes: smoke de interfaz

`scripts/ui-pending-smoke.mjs` usa registros sintéticos y la API local real. No ejecuta inferencia ni realiza solicitudes remotas.

Desde el rediseño del 2026-11-02, “Pendientes” está visible en “Herramientas jurídicas”. El contador de su entrada sólo puede reflejar tareas pendientes reales del asunto activo.

Ejecutar después de compilar la interfaz:

```sh
node scripts/ui-pending-smoke.mjs
```

La comprobación cubre crear un pendiente, generar y aprobar una sugerencia local, completar, descartar, aislamiento entre asuntos y ausencia de desbordamiento horizontal a 1440, 1024, 768 y 390 px. También comprueba que los controles de Pendientes midan al menos 44 px.

El resultado y las capturas se escriben en `artifacts/ui-pending/`. Como el sandbox de Codex no permite abrir listeners loopback, la ejecución queda a cargo de Claude en una shell local normal.

## Revisión del orquestador (2026-11-02)
- Smoke `ui-pending-smoke` PASS y los otros 10 smokes PASS en shell normal; `npm test` 154/154; build PASS. Capturas revisadas a 1440 y 390 px: sin desbordamiento, controles ≥44 px, copy en español con aviso de que no se calculan términos legales.
- Pulido pendiente (no bloqueante): el ícono de papelera aparece en «Descartar» de los pendientes pero no en el de las sugerencias; el formulario «Agregar pendiente» usa una columna más angosta (≈620 px) que el resto de la vista (≈804 px).
