# S2b.1a: diagnóstico nativo detenido, sin reintentos

Reporte 2026-11-10; corrida iniciada el 2026-11-09 local. [Datos y recibos agregados](legal-task-structured-S2b1-2026-11-10.json), [protocolo](../architecture/legal-tasks/structured-development-probe-v1.md) y [freeze previo](legal-task-structured-S2b1-freeze-2026-11-09.json).

Se planificaron ocho solicitudes: dos inputs nuevos inventados, dos modelos Groq explícitos y dos modos de salida, manteniendo skill S1/input/prompt/esquema por par. Común: esfuerzo bajo, razonamiento textual excluido, temperatura 0, salida máxima 2.500 y 45 s. No datos reales ni proposiciones de derecho mexicano real. El corte no selecciona proveedor de producto ni reutiliza credenciales de desarrollo para clientes.

La ejecución se detuvo tras **tres POST y seis HTTP** por HTTP 400 `CONFIGURATION_ERROR` en el primer intento nativo de 20b. No se conservó el cuerpo de error remoto; la causa exacta no se reconstruye ni se atribuye a incapacidad general del modelo. Sin retry, reparación, cambio de esquema, modelo o proveedor. Los cinco jobs pendientes permanecen en el denominador.

| Intento | Modelo / modo | Observado |
| --- | --- | --- |
| 1 | gpt-oss-20b / prompt-only | HTTP200, finish stop, JSON válido pero falla contrato S1 |
| 2 | gpt-oss-120b / native-json | HTTP200, finish stop, JSON y contrato S1 válidos |
| 3 | gpt-oss-20b / native-json | HTTP400; identidad/respuesta/usage no disponibles |

No hay pares completos. El único pase estructural no demuestra respaldo semántico o calidad jurídica. Consumo reportado: **7.798 tokens en dos respuestas** (3.352 + 4.446), con 929 de razonamiento ya incluidos. Usage del tercer intento **desconocido, no cero**; factura y cuota restante desconocidas. Duración con espera: 66.420 ms. Latencias de generación observadas 951/2.455/925 ms; con una muestra por celda no hay comparación de rendimiento fiable.

Builder y revisor independiente Sol: 27/27 simuladas antes de live. Root y revisor repitieron replay offline y hashes contra starts, cuerpo real, fuente/dataset y cadena; **APPROVE de la evidencia**, sin nuevos envíos. Las dos respuestas observadas coinciden con los modelos pedidos; no inventar identidad para el error. La primera separación de inicios 20b fue 65.269 ms.

La salida visible se conserva tras filtros de credenciales y bloques de razonamiento, según el arnés; eso no repara validez. Los datos brutos/recibos están en artifacts ignorados, sin cabeceras de autenticación o errores remotos. La cadena acredita consistencia local, no autenticidad firmada por el proveedor.

S2b permanece abierto: corregir observabilidad segura de errores en una versión nueva si hace falta y probar referencias preindexadas para evitar cálculo de offsets por el modelo. [Anclas v2](../architecture/legal-tasks/anchors-v2.md) es el siguiente componente optativo; tampoco evalúa entailment. Conservar este resultado parcial y su código antes de otro experimento. No escoger ganador, rebajar S1 o activar rutas por una sola respuesta válida.
