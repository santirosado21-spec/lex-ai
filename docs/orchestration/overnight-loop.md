# Loop nocturno — Claude orquesta (desde 2026-11-01)

**Cambio de roles (dueño, 2026-11-01):** Claude Code es el orquestador principal (revisa, dirige diseño, decide, mantiene el loop). Codex hace el trabajo pesado de implementación; Gemini da opiniones; Gemma local ayuda con texto sencillo. Las reglas de AGENTS.md y dsystem siguen vigentes (datos sintéticos, todo local, identidad LEX AI sin nombres de modelo en la UI, sin compras ni nube de pago, aprobación humana para acciones externas/destructivas).

## Protocolo del loop (cada iteración)
1. Leer este archivo y `execution-log.md`; elegir el siguiente ítem abierto de mayor valor.
2. Asignar a un worker con archivos propios explícitos (no pisar cambios ajenos; hay cambios sin commit en `server/*` y `scripts/evaluate-lightweight-skills.mjs`, `server/local-files.mjs`).
3. Verificar: `npm run build`, `npm test`, smoke relevante. Sin evidencia no se marca PASS.
4. Commit atómico por ítem (rama `main`, mensaje claro). Sin push/deploy sin que esté ya autorizado en AGENTS.md (GitHub/Vercel/Supabase sí, solo metadatos públicos).
5. Anotar en `execution-log.md`: qué se hizo, quién (Codex/Gemini/Gemma/Claude), evidencia, qué falló. Máx. 3 intentos fallidos → diagnosticar y pasar al siguiente.
6. Si un colaborador no está disponible, registrar y continuar sin bucles de reintento.

## Frentes de trabajo (prioridad)
| # | Frente | Dueño | Criterio de aceptación |
|---|---|---|---|
| A | **Modelo ligero ≤ 8 GB de RAM** (el Gemma actual pesa ~16 GB): elegir base cuantizada pequeña, entrenar adaptador con fuentes públicas/sintéticas con procedencia, held-out aparte, base preservada | Codex (+Gemini opinión) | Métricas reales de entrenamiento/eval, tabla antes/después vs base, memoria pico medida en el Mac, artefactos reproducibles; "candidato experimental", no validado jurídicamente |
| B | **Conocimiento de derecho mexicano en el modelo** (no solo biblioteca): generar tareas sintéticas por materia (civil, mercantil, laboral, fiscal, amparo, penal, administrativo, comercio exterior…) desde textos oficiales con cita; ampliar cobertura | Codex + Gemma (borradores/etiquetado) | Cobertura por materia, held-out por materia, ejemplos donde el modelo entrenado responde distinto a la base (con prompt, salida y fuente) |
| C | **Pruebas con casos públicos**: sentencias/tesis/criterios públicos (SCJN, DOF, etc.) como entradas; evaluar cada skill | Codex | Informe `docs/qa/public-cases.md` con casos, resultados, fallos honestos |
| D | **Exports de alta calidad** (DOCX: portada, estilos, numeración, tabla de fuentes, encabezados/pies, citas; plantillas editables; PDF opcional) | Codex, diseño de Claude | DOCX reabierto y renderizado a imagen revisado visualmente |
| E | **UI**: centrado/alineación, paleta consistente, logos/identidad (Figma/Canva si hay acceso), landing mejorada | Claude dirige diseño, Codex implementa | Capturas antes/después en varios anchos; smoke UI PASS |
| F | **Agentes que operan la app (computer-use interno)**: acciones tipadas dentro de la app (crear asunto, importar, buscar, redactar, exportar) con registro y aprobación humana; sin shell | Codex | Pruebas de límites de permiso y aislamiento por despacho |
| G | **Proactividad**: recordatorios de plazos, preguntas de seguimiento, borradores sugeridos, "pendientes del día" locales, mismo modelo ligero | Codex | Planificador local con aprobación; pruebas con relojes inyectados |
| H | **Nuevas funciones para abogados**: lista priorizada por Gemini+Claude (cronología del caso, cómputo de plazos, checklist documental, comparador de versiones de contrato, bitácora de horas, conflicto de intereses, resumen de expediente…) | Claude/Gemini proponen, Codex implementa | Una función por iteración con pruebas |

## Orden sugerido
A → B (en paralelo con D/E, que no usan GPU) → C → G → F → H. La GPU es un recurso exclusivo: respetar `artifacts/training/gpu.lock` y `pipeline.lock`.

## Límites que no se cruzan
Sin datos de clientes reales; sin compras de GPU/dominios/planes; sin subir documentos privados; sin presentar el modelo entrenado como validado por abogados; sin enviar comunicaciones externas.
