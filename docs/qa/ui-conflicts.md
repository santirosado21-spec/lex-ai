# QA: Conflictos

`node scripts/ui-conflict-smoke.mjs` ejecuta el humo de Playwright sobre el API local real con datos sintéticos. No inicializa inferencia ni hace solicitudes remotas.

Comprueba que “Conflictos” esté visible y activo en “Herramientas jurídicas”; registra contrapartes en el asunto activo; presenta la coincidencia de contraparte y el aviso de no-clearance; muestra el estado vacío requerido; no expone texto de documentos; y no desborda horizontalmente a 1440, 1024, 768 ni 390 px. Las capturas y el informe quedan en `artifacts/ui-conflicts/`.
