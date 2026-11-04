# QA: Tiempo y honorarios

## Cobertura automatizada local

`node --test tests/time-billing.test.mjs` usa solo una base SQLite temporal y datos sintéticos. Comprueba la migración, minutos/centavos enteros, redondeo mitad hacia arriba, aislamiento por asunto, pausas, recuperación explícita de un temporizador obsoleto, resolución auditada, pendientes existentes, CSV seguro y una prueba determinista de 2,000 entradas sin deriva al sumar reportes.

## Recorrido manual/UI previsto

1. Crear un despacho y dos asuntos sintéticos de clientes distintos.
2. Abrir **Herramientas jurídicas → Tiempo y honorarios** y comprobar objetivos táctiles de al menos 44 px en temporizador, entrada manual, CSV, cobro y resolución.
3. Configurar una tarifa por hora y un incremento de 6 minutos. Registrar 31 minutos; comprobar 30 minutos facturables y que el importe se muestra como MXN.
4. Cambiar la tarifa y comprobar que la entrada previa no cambia. Crear una entrada nueva y comprobar que sí usa el nuevo snapshot.
5. Iniciar, pausar, reanudar y detener un temporizador. Confirmar que no puede iniciar otro asunto con el mismo usuario local.
6. Forzar un temporizador de más de 12 horas solo en una base sintética; confirmar que se exige **Recuperar y guardar** o **Descartar**.
7. Registrar una resolución y confirmar que aparece como `resuelto`; reabrirla y comprobar que se conserva la auditoría de cierre en SQLite.
8. Crear una tarea y un recordatorio existentes; comprobar que el conteo de pendientes coincide con Panel/Pendientes, sin una lista duplicada.
9. Exportar CSV, abrirlo en un visor de texto y comprobar BOM UTF-8 y que una descripción que empieza con `=`, `+`, `-` o `@` tiene apóstrofo inicial.
10. Verificar modo claro y oscuro, 1440/768/390 px, foco visible y ausencia de desbordamiento horizontal. Confirmar que no se presenta texto de documentos ni nombres de proveedores/modelos.

## Smoke

`scripts/ui-time-billing-smoke.mjs` queda preparado para el recorrido de navegador con datos sintéticos, pero no se ejecutó en este entorno: el sandbox bloquea loopback, necesario para iniciar el servidor local y Playwright.
