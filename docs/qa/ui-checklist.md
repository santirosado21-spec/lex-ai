# QA: Checklist

`node scripts/ui-checklist-smoke.mjs` ejecuta el humo de Playwright sobre el API local real con datos sintéticos. No inicializa inferencia ni hace solicitudes remotas.

Comprueba que “Checklist” se alcance desde “Más herramientas”, sin una cuarta navegación primaria; que las plantillas se presenten como sugerencias organizativas que la persona abogada debe confirmar y no como requisitos legales; que editar, marcar y guardar quede aislado en el asunto activo; que el texto de un documento de otro asunto no entre al DOM; y que no haya desborde horizontal a 1440, 1024, 768 ni 390 px. Las capturas y el informe quedan en `artifacts/ui-checklist/`.
