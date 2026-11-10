# Paquete optativo de tareas jurídicas — S1

[Contrato v1](contract-v1.md), [instrucciones/procedencia](../../../resources/legal-task-skills/PROVENANCE.md), [fixtures de desarrollo](../../../eval/legal-tasks/README.md).

Se construye un contrato ejecutable para preparar dos tareas de nube: investigación jurídica mexicana y revisión contractual. Actualmente carga instrucciones locales versionadas y valida entradas/salidas de prueba, sin generar respuestas ni conectar un proveedor. No se registra en el inventario activo `server/skills.mjs` o en rutas de la app. Las fuentes del piloto C1a permanecen en cuarentena y no se promueven por construir este paquete.

```sh
node scripts/check-legal-task-skills.mjs
node --test tests/legal-task-contracts.test.mjs
```

El resultado `legal-task-skills-prepared-unmeasured` acredita preparación y coincidencia con fixtures inventados. No acredita utilidad de un LLM, anonimización, cero filtraciones, vigencia o calidad jurídica. El checker nunca prepara el texto de expectativas/rúbricas como contexto para un modelo.

Flujo futuro: el entorno local prepara y autoriza el contexto; el adaptador con presupuesto/modelo explícitos envía la tarea; el resultado pasa validación y restitución local dentro del mismo ámbito. Clasificar y autorizar datos sigue perteneciendo a H2/H4/H5/H6/H7, no a un campo `dataClass`, una skill o un hash. Preguntas/historial/metadatos/herramientas derivados de un asunto no se vuelven públicos por usar fuentes públicas.

El validador comprueba campos y relaciones concretas: IDs/versiones, hashes del input, citas exactas del texto suministrado, ámbito declarado, rol faltante y cobertura que no crece de excerpt a full. No certifica semántica o que un modelo leyera todo. Los offsets UTF-16 y el esquema estricto todavía necesitan una medición real de cumplimiento por modelo. Las fechas de análisis/captura no validan vigencia y `text-reviewed` no significa revisión jurídica.

S2 sigue abierto: preparar aceptación independiente, fijar modelo/endpoint y presupuesto autorizados, ejecutar pares con/sin skill con iguales inputs, medir calidad y fallos con abogado, citas/cobertura, tokens/coste/latencia y límites de contexto. Las doce muestras S1 son desarrollo visto, no el examen ni los treinta casos propuestos en S-R0. No usar el examen privado retirado. Sin compra, instalación, descarga o activación automáticas.

Los límites S1 no modifican M1: sus perfiles públicos actuales permiten 7.000 UTF-16 de entrada y salidas 800/1.200 tokens; no se asignan automáticamente a estas tareas. S2 debe medir el contexto final con instrucciones, esquema y evidencia, fijar un presupuesto específico y registrar truncados/fallos. Ni aumentar límites ni usar una cuenta de desarrollo como credencial de producto se autoriza por preparar el paquete.
