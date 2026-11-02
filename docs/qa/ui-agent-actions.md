# Acciones propuestas: smoke de interfaz

`scripts/ui-agent-actions-smoke.mjs` usa registros sintéticos con la API local real. No invoca inferencia ni hace solicitudes remotas.

Ejecutar después de compilar la interfaz:

```sh
node scripts/ui-agent-actions-smoke.mjs
```

La prueba siembra propuestas de recordatorio, creación de asunto e importación de un archivo con texto que parece una inyección. Comprueba que la interfaz sólo revele los metadatos seguros del archivo (nombre, tamaño y prefijo SHA-256), nunca su contenido. También cubre confirmación antes de aprobar, rechazo, bitácora, caducidad inhabilitada, aislamiento entre asuntos, objetivos de 44 px y ausencia de desbordamiento a 1440, 1024, 768 y 390 px.

El resultado y las capturas se escriben en `artifacts/ui-agent-actions/`. El sandbox de Codex no permite abrir listeners loopback; Claude debe ejecutar el smoke en una shell local normal.
