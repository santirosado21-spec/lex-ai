# S1 — Dos skills mexicanas y contratos offline

2026-11-09, America/Mexico_City. [Contrato](../architecture/legal-tasks/contract-v1.md), [arquitectura/uso](../architecture/legal-tasks/README.md), [procedencia](../../resources/legal-task-skills/PROVENANCE.md), [métricas y comprobaciones](legal-task-skills-S1-2026-11-09.json), [freeze](legal-task-skills-S1-freeze-2026-11-09.json).

## Entregado

Dos instrucciones LEX AI v0.1.0 en formato SKILL.md: `investigacion-juridica-mx` y `revision-contratos-mx`. Input/JSON de salida exactos, loader con hashes/versiones inactivas, preparación de paquetes inmutables y validador de citas/identidades/cobertura. CLI optativo y doce fixtures sintéticos de desarrollo de autor independiente. No registro en inventario, arranque, UI o proveedor activos; ninguna fuente C1a en cuarentena se promueve aquí.

Las instrucciones son redacción nueva de LEX AI y documentan referencias de patrones Apache/MIT (Consulto, Mike, Anthropic). No se distribuyen archivos/conectores de esos proyectos ni módulos AGPL/NC-ND/licencia desconocida. Método de amparo de Consulto inspira estados de evidencia, no equivale a su motor de bases/vigencia. No se heredan defaults de jurisdicción estadounidense, firma por colores o acceso entre asuntos.

## Verificado

| Comprobación | Resultado observado |
|---|---:|
| Pruebas nuevas del builder | 18/18 |
| Combinadas con candidatos públicos M1 | 33/33 |
| Pruebas dirigidas repetidas por revisor independiente | 18/18 |
| Probes adicionales del revisor | 6/6 |
| Suite completa coordinador | 605/605 |
| Build TypeScript/Vite | OK |
| Fixtures escritos de desarrollo | 12 (6 investigación / 6 contratos) |
| Preparaciones esperadas reproducidas | 11 aceptadas / 1 rechazada |
| Salidas de ejemplo contrastadas | 5 aceptadas / 6 rechazadas / 1 no ejecutada |
| Ejecuciones de las skills contra modelos/proveedores candidatos | 0 |
| Dependencias añadidas | 0 |

Los doce casos y sus salidas fueron redactados por el agente autor Sol como datos de test; no son respuestas obtenidas ejecutando las skills contra modelos/proveedores candidatos. Las tres asignaciones SF sí utilizaron Sol y se registran abajo. El caso de procedencia usa etiquetas negativas inventadas, no datos privados reales. Las expectativas y rúbricas se mantienen fuera del paquete del modelo. El coordinador comprobó once paquetes preparados, inmutabilidad/flags y ausencia de campos de evaluación en raíz; los hashes del freeze coinciden. Máximo de esos once paquetes canónicos: 10.007 bytes, **no coste de tokens o latencia de nube**. No demuestra tamaño para todos los contratos ni mejora de modelo.

Pruebas: hashes modificados, flags/rutas/versiones de recurso, symlinks, datos no JSON/getters/ciclos, fechas imposibles, límites de entrada, campos inesperados, cita falsa/versión/offset UTF-16, referencias entre solicitudes, ámbito de fuente, preferencias sin playbook, excerpt elevado a full y datos faltantes. El revisor repitió suite/CLI y agregó probes de getter anidado no ejecutado, prototipo alterado, mutación de esquema congelado, offset inseguro, identidad de otra solicitud y carácter de control.

**Revisión Sol independiente `review_legal_task_skills_s1`: APPROVE para S1 offline**, confirmada en los hashes de código/tests/CLI/fixtures congelados. Cierre final APPROVE: revisor recalculó los nueve hashes congelados y corroboró QA/checker y logs de 605/605/build. No repitió la suite completa ni generó respuestas. Sin hallazgos bloqueantes. No es aprobación de precisión jurídica, clasificación de confidencialidad, resistencia conductual a inyección o uso de clientes.

## Límite demostrado

El coordinador construyó una inferencia deliberadamente sin respaldo dentro de un fixture sintético que conserva cita literal, identidad y esquema válidos. El validador la aceptó como `structurally-valid-unmeasured` y mantuvo `entailment=not-evaluated`, `legalAccuracy=not-evaluated`. Se registra como límite de semántica, **no como respuesta correcta**. Verificar quote/rango no demuestra que una cita apoye la conclusión.

`dataClass` y `reviewState` son declaraciones del preparador de desarrollo: no detector ni autoridad de egreso. Hashes ligan consistencia, no autentican al revisor. Cobertura expresa texto suministrado, no lectura exhaustiva del modelo. Timestamps/ámbito compatibles no acreditan vigencia/aplicabilidad. El input público puede estar mal etiquetado: H2/H4/H5/H6/H7 siguen siendo necesarios en la integración posterior. No ejecutar sanitización en nube sobre originales ni enviar mapas reversibles.

## Reproducir y continuar

```sh
node scripts/check-legal-task-skills.mjs
node --test tests/legal-task-contracts.test.mjs tests/public-agent-candidates.test.mjs
npm test
npm run build
```

Logs originales ignorados: `artifacts/legal-task-skills-s1-20261109/{checker.json,npm-test.log,build.log}`. Las futuras comparaciones reales conservarán datos, modelo observado, endpoint, configuración, costes/fallos/latencia y revisión profesional. Este corte no tiene medición de memoria cliente/8 GB, proveedor real, anonimización, entrenamiento o despliegue.

S2 conserva aceptación independiente y pares con/sin skill. Los doce ejemplos vistos no son ese examen, ni completan los treinta casos propuestos en S-R0; no usar el heldout privado retirado. El presupuesto/serialización final deben incluir instrucciones y esquema y no aumentan automáticamente los límites M1 de 7.000 UTF-16 y 800/1.200 tokens de salida. Elegir modelos por tarea necesita resultados; no hay ganador en este corte.

SF: Codex coordina y redacta instrucciones/contrato; un builder Sol, un autor Sol independiente de fixtures y un revisor Sol independiente. Tres asignaciones `gpt-6.1-sol`; tokens/cuotas no expuestos. Sin Astra o nuevas consultas a Claude/Gemini/Kimi/Cursor/Perplexity. Fuentes GitHub se consultaron en lectura; no se instaló/ejecutó código de terceros ni se activaron conectores.
