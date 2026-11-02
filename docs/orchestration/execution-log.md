# Registro de ejecución — 2026-10-29 (America/Mexico_City)

## Ciclo 1: descubrimiento y vertical funcional
- Carpeta vacía; creados AGENTS.md y contrato de integración. Ninguna restricción previa de comercio exterior que eliminar.
- Codex verificó entorno y herramientas. Claude Opus 5.5 entregó diseño real; Gemini aportó revisión. Workers Codex implementaron servicio/UI y revisaron ciclo de vida.
- Implementados SQLite/FTS con alcance, importación acotada, cinco skills, citas comprobadas, exportación, feedback y notas con evaluación/aprobación/rollback.
- Build TypeScript/Vite PASS. Suite determinista inicial de 17 pruebas PASS, ampliada al cierre a 20/20. UI smoke con inferencia simulada explícita PASS, incluido responsive y DOCX.
- Gemma real intento 1: inicialización/checksums PASS, referencia inválida rechazada. Intento 2 de diagnóstico: el modelo truncaba UUIDs y agrupaba varios IDs en un corchete; no se guardó el análisis inválido. Se introdujeron IDs cortos y esquema de citas restringido a pasajes recuperados. Intento 3: PASS, análisis en 86.7s, citas privada+CDMX, DOCX, feedback y rollback.
- Revisión detectó carrera de parada durante inicio y llamadas concurrentes a stop; corregidas y probadas. Cancelación de análisis se propaga desde HTTP al motor; se evita guardar respuestas de solicitudes canceladas.
- Tauri compiló aplicación macOS. Primer DMG falló por volumen temporal ocupado; se desmontó únicamente ese volumen. Cambio a empaquetado app y creación DMG separada.
- Reempaquetado detectó enlaces absolutos heredados de bibliotecas Ollama; staging regenerado con archivos independientes, sin modificar la instalación original.
- App nativa abierta y despacho sintético persistido. Primera preparación de modelo rechazó diferencia de digest normalizado; corregida validación para comparar manifiesto original fijado y capas ejecutables, sin confiar en el digest resumido del tag.

## Evidencia
`artifacts/real-e2e.json`, `artifacts/synthetic-analysis.docx`, `artifacts/ui-smoke.json`, `artifacts/ui-workspace.png`, `artifacts/ui-responsive.png`. Los artefactos contienen únicamente datos sintéticos y no se consideran evaluación jurídica profesional.

## Estado del ciclo
PASS de la primera vertical también dentro de la app nativa: creación/persistencia, motor incluido con pesos reutilizados y verificados, importación TXT por selector nativo, análisis real con fuentes, exportación DOCX y feedback. DOCX reabierto con extractor y comprobados contenido, fuente y aviso de revisión. DMG creado, montado y checksum verificado; no equivale a instalación limpia desde cero. Piloto comercial todavía NO LISTO. No se declara cumplimiento normativo ni exactitud jurídica.

## Correcciones finales
- Botón de importación convertido en control accesible y probado con selector macOS.
- PDF válido descubierto por nuevo test fallaba con Buffer en PDF.js; Uint8Array corrige la incompatibilidad sin relajar validación. Añadidas pruebas de PDF válido, Markdown Unicode y esquema de fuentes por asunto. Suite final: 20/20.
- Evidencia nativa: artifacts/native-e2e.json, artifacts/native-analysis.docx y artifacts/native-workspace.png. Pesos locales existentes reutilizados; descarga desde cero no probada.
- Cierre nativo comprobado: no quedaron procesos Node/Ollama propios de LEX AI. Runtime de documentos fijado al package-lock del proyecto.
- Auditoría npm de producción ejecutada: 0 vulnerabilidades conocidas reportadas. Artefacto: artifacts/dependency-audit.json. No cubre por sí sola código vendorizado, Rust, binarios o seguridad de la aplicación.
- Prueba de copia fuera del build detectó bundle sin sello de recursos; firmado ad hoc tras retirar solo FinderInfo/ResourceFork de la copia generada. Verificación codesign --deep --strict PASS y arranque de copia independiente PASS. No se eliminó cuarentena ni se desactivó Gatekeeper. Empaquetado usa staging temporal limpio.
- DMG definitivo montado en solo lectura, app extraída a directorio temporal independiente, firma ad hoc deep/strict válida, arranque nativo y lectura del análisis guardado PASS. Informe artifacts/package-check.json. No se sobrescribió /Applications.

# Loop nocturno — Claude orquesta (2026-11-01)

## Iteración 1 (22:26 CST)
- Claude (orquestador) programó el loop cada hora (cron de sesión). Estado al inicio: dos workers Codex en curso desde 22:20-22:21: (1) Frente A+B (modelo ligero ≤8 GB, LoRA por materia, held-out, tabla base vs adaptador, ≥10 ejemplos), (2) Frente E (tokens de diseño, alineación, logo único, landing). Sin locks de GPU activos.
- No se lanza trabajo adicional para evitar solapamiento de archivos. Pendiente: revisar entregas, correr `npm run build` y `npm test`, y commitear de forma atómica por ítem.
- Sin evidencia nueva todavía; nada marcado PASS.

## Coordinación interfaz Apple HIG — Codex `/root/ui` (2026-11-01)
- El encargo actual del dueño prioriza Apple HIG: sidebar Asistente/Asuntos/Escritos, fuente del sistema en controles y encabezados, bajo consumo y logo original vectorial Figma. Revisión Claude Code real en `artifacts/ui-hig/claude-review.json`.
- Se detectó edición concurrente de tokens/style/cover por otra sesión. No se revirtieron colores, layout ni archivos ajenos. Ajuste acotado al final de `src/macos.css`: contrato tipográfico `.app-shell.macos-workspace` de mayor especificidad; el contenido editorial puede conservar su tipografía propia.
- Ownership activo de este arreglo: `src/macos.css`, `scripts/ui-hig-smoke.mjs` y documentación HIG. Evitar reintroducir Source Serif en encabezados y controles de la aplicación. Los tokens de landing no requieren modificación.
- No afirmar rendimiento validado en8GB ni aptitud del modelo: root reporta evaluación actual base0/10; esa evaluación es independiente del PASS de interfaz.

## Coordinación de identidad Figma — Codex `/root/ui` (2026-11-01)
- El dueño pidió un logo nuevo creado mediante Figma. Otra sesión sustituyó `src/assets/lex-mark.svg` por una marca LE previa; se conserva ese archivo ajeno sin revertirlo.
- Se recuperó la respuesta exportAsync SVG original guardada durante la creación Figma, componente `2:5` del archivo `4O4XgcaSNSMEvAQjUQbc0C`: dos documentos enlazados por curva. Archivo exclusivo `src/assets/lex-figma-mark.svg`. La nueva llamada MCP alcanzó límite; se reutilizan bytes originales de la exportación verificada, no una recreación.
- App, BrandAvatar y AppCover apuntan al nuevo nombre para evitar colisión. No se alteraron estilos, icono PNG ni iconos nativos. Preservar esta referencia por prioridad del encargo actual.

## 2026-11-01 — Claude orquestador (Frente D)
- Codex entregó server/docx-export.mjs (tests 19/19). Claude renderizó con LibreOffice→PNG y detectó dos defectos (lista numerada reiniciaba en 1; notas al pie repetidas vacías); Claude los corrigió él mismo porque el job de Codex ya había terminado y otros dos seguían activos.
- Verificación: npm test 127/127 en shell normal (3 fallos reportados por Codex eran EPERM del sandbox); árbol commiteado probado aislado 18/18.
- Commit atómico solo con hunks del export; el resto de server/service.mjs (document.open, legal-researcher) pertenece a otros workers y queda sin commit.

## Integración mínima de diseño revisado — Codex `/root/ui`
- Se inspeccionaron las referencias actuales: App y AppCover apuntaban a `brand/lex-folio-mark.svg`; BrandAvatar ya usaba el export Figma comprobado. Se cambiaron exclusivamente esos dos imports a `assets/lex-figma-mark.svg`.
- Se añadió al final de `src/macos.css` un selector `.app-shell.macos-workspace` para encabezados y controles con stack literal del sistema, independiente de variables editoriales externas. Se preservaron todas las reglas existentes, layouts, demás archivos e iconos empaquetados. Root ejecuta el smoke; no GPU ni navegador desde este worker.

## Iteración 2 (23:25 CST) — Claude orquestador
- Verificación en shell normal (sin sandbox de Codex): `npm run build` PASS; `npm test` 144/144 PASS.
- Smokes UI: `ui-hig-smoke` PASS, `landing-smoke` PASS. FAIL (selectores obsoletos frente a la nueva barra lateral HIG, sin Inicio/Dashboard/bento): `ui-smoke` (primero `.app-cover img` ambiguo por el logo en figcaption — corregido a `img[src*="lex-cover"]` —, luego falta botón «Inicio»), `ui-product-identity-smoke`, `ui-dashboard-smoke`, `ui-bento-smoke`. Es deriva de pruebas, no regresión confirmada del producto; pendiente actualizarlas al shell HIG (dueño: worker UI).
- Frente A: el LoRA de Gemma 3 1B (28 672 params, 100 pasos) bajó la pérdida (1,83→1,27 val) pero 0/8 y 0/10 en gates técnicos: `REJECTED_TECHNICAL_FAILURE`, no promovido. Comparación de runtime con 30 pares: Qwen3.5 2B 30/30 sin habilidad y 28/30 con ella, Qwen3 1.7B 23/22, Gemma 3 1B 20/15; el catálogo usa Qwen3.5 2B solo como evaluación experimental. Las habilidades no mostraron mejora. No hay validación en un Mac físico de 8 GB.
- `docs/qa/model-comparison.md` quedó desactualizado: sigue diciendo «pendiente» aunque ya hubo entrenamiento y evaluación. Pendiente corregirlo.
- Sin commit: el árbol sigue en edición activa por otros workers (entrenamiento y exportación ligeros, UI), así que un commit ahora mezclaría cambios a medias.
- Siguiente iteración: commit atómico por área cuando los archivos dejen de cambiar; actualizar los smokes al shell HIG; luego Frente C (`docs/qa/public-cases.md`).

## Iteración 3 (00:22 CST, 2026-11-02) — Claude orquestador
- Árbol quieto >30 min; build PASS, npm test 147/147 PASS; escaneo de secretos limpio (384 KB nuevos).
- Commits atómicos por área: `9ddee13` runtime ligero + entrenamiento experimental + docs QA; `e23398a` UI HIG, marca Figma y tokens; `9d7fd49` AGENTS/README/package/ignore/log.
- Lanzados dos workers Codex con archivos disjuntos: (1) actualizar smokes UI al shell HIG (`scripts/ui-*-smoke.mjs`, `docs/qa/ui-smoke-status.md`); (2) Frente C casos públicos (`fixtures/public-cases/**`, `scripts/run-public-cases.mjs`, `docs/qa/public-cases.md`). Resultados pendientes; nada marcado PASS hasta verlos.

## Iteración 4 (01:22 CST) — Claude orquestador
- Los dos workers Codex terminaron código pero el sandbox les impidió ejecutar smokes (EPERM loopback) y commitear (`.git/index.lock`); Claude ejecutó y commiteó en shell normal.
- Smokes UI: 10/10 PASS tras correcciones. Hallazgo real: la rediseño HIG había quitado `role="status"` de `.generation-state` (regresión de accesibilidad) — restaurado en `src/App.tsx`. Los demás fallos eran pruebas obsoletas (habilidad por defecto ahora Investigación jurídica; canvas animado retirado a propósito). Commit `74db27a`. `npm test` 149/149.
- Frente C: 16 casos públicos (8 materias, 5 habilidades). Corrida 1 con inferencia real Qwen3.5 2B: 10/16 PASS, pico RSS 2,18 GiB; fallos: 2 de abstención en `matter-assistant`, 1 control numérico, 3 casos bloqueados por la compuerta de memoria (laboral ×2, inyección mercantil) sin evaluar. Corrida 2: 0/16 por memoria libre insuficiente (otras apps), no refleja al modelo. No se bajó el umbral de 3 GB. Commit `621110e`.
- Pendiente: repetir los 3 casos bloqueados con la RAM libre; mejorar abstención de `matter-assistant`; ~7 GB de cachés aislados en `artifacts/public-cases/` (ignorados por git) pueden borrarse con aprobación.

## Iteración 5 (02:22 CST) — Claude orquestador
- Árbol limpio al inicio (HEAD `c8e6265`). Lanzado worker Codex para Frente G (planificador local de proactividad, solo servidor y pruebas): tabla de recordatorios con aislamiento por despacho/asunto, `server/planner.mjs` con reloj inyectado, propuestas inactivas hasta aprobación humana, sin cómputo de plazos legales (los plazos los introduce el abogado), sin notificaciones externas. Resultado pendiente; nada marcado PASS.
- No se repitió la corrida de casos públicos: RAM disponible 3,17 GiB (umbral 3 GiB) con Codex activo; se reintenta en una iteración con más margen.

## Iteración 6 (03:22 CST) — Claude orquestador
- Frente G (servidor) entregado por Codex: tabla `reminders` aislada por despacho/asunto, `server/planner.mjs` con reloj inyectado, métodos `reminder.create/list/update`, `planner.today`, `planner.propose`; propuestas del planificador inactivas hasta aprobación; los plazos los captura el abogado y la app no calcula términos legales. Codex reportó 149/152 por EPERM de loopback en su sandbox; en shell normal pasó 152/152.
- Revisión de Claude encontró y corrigió dos defectos: (1) `proposeFollowUps` calculaba «hoy» en UTC en vez de la zona del planificador (la regla de plazo a 3 días se descuadraba hasta un día por la tarde-noche en CDMX); (2) una propuesta descartada se volvía a proponer en cada llamada. Dos pruebas nuevas cubren ambos. `npm test` 154/154, build PASS.
- Falta de Frente G: interfaz de «pendientes del día» y aprobación en la UI (src/**), y preguntas de seguimiento con el modelo ligero (opcional, sin evidencia aún).

## Iteración 7 (04:22 CST) — Claude orquestador
- Frente G UI entregado por Codex: `src/PendingView.tsx` («Pendientes» en Más herramientas/paleta, sin añadir un cuarto destino principal), estilos al final de `src/macos.css`, `scripts/ui-pending-smoke.mjs`. Verificado por Claude en shell normal: build PASS, `npm test` 154/154, 11/11 smokes UI PASS, capturas revisadas. Pulido menor anotado en `docs/qa/ui-pending.md`.
- Frente G completo salvo preguntas de seguimiento con el modelo ligero (sin evidencia).
- Lanzado Codex para Frente F (servidor): registro cerrado de acciones tipadas para el agente interno, propuestas pendientes con aprobación humana, TTL con reloj inyectado, bitácora append-only sin texto de documentos, sin shell/rutas/red. Resultado pendiente. RAM disponible 3,08 GiB: no se repite la corrida de casos públicos.

## Iteración 8 (05:22 CST) — Claude orquestador
- Frente F (servidor) entregado por Codex: registro cerrado de 9 acciones tipadas, propuestas con aprobación humana, TTL 15 min con reloj inyectado, revalidación de esquema y alcance dentro de la transacción de aprobación, despacho estático, bitácora append-only sin texto de documentos. Codex reportó 157/160 (3 EPERM de sandbox); en shell normal 160/160.
- Revisión de Claude: hueco de diseño — `origin` lo declaraba el llamador y `agent.approve` estaba en el mismo despachador que `agent.propose`, así que un agente con acceso a `dispatch` podía declararse `user` o aprobar sus propias propuestas. Añadido `service.agentChannel` (solo propose/pending/log, origen forzado a `agent`, sin approve/reject) con prueba, y documentado que ningún agente debe recibir `dispatch`. `npm test` 161/161, build PASS.
- Alcance honesto: no existe todavía un bucle de agente ni UI de aprobación de propuestas de agente; el endpoint HTTP actual con un solo token no distingue llamadores. Siguiente para F: UI «Acciones propuestas» (aprobar/rechazar con vista de hash/resumen) y transporte separado para el agente.
- Gemini (opinión, `opinion`): priorizó cómputo de plazos > conflicto de intereses > comparador de versiones > checklist > cronología > bitácora de horas; descartó resumen de expediente con modelo pequeño. Decisión de Claude: empezar por comparador de versiones (determinista, bajo riesgo, alto valor) y **no** construir cómputo de plazos hasta que una persona revise el catálogo oficial de días inhábiles (error = responsabilidad profesional). Lanzados Codex H#1 (`server/doc-compare.mjs`, `document.compare[.export]`) y Codex F-UI (`src/AgentActionsView.tsx`, aprobación humana de acciones propuestas). Resultados pendientes.

## Iteración 9 (06:22 CST) — Claude orquestador
- Entregados por Codex y verificados por Claude en shell normal (los sandbox de Codex no pueden abrir loopback ni commitear): (1) **H#1 comparador de versiones** (`server/doc-compare.mjs`, API `document.compare` / `document.compare.export` con redline DOCX, límites de tamaño, `truncated`, solo léxico, sin modelo); (2) **F-UI «Acciones propuestas»** (`src/AgentActionsView.tsx`, `scripts/ui-agent-actions-smoke.mjs`, `docs/qa/ui-agent-actions.md`).
- Evidencia: `npm run build` PASS; `npm test` 169/169; 12/12 smokes UI PASS (incluye el nuevo `ui-agent-actions-smoke`, con capturas 1440/1024/768/390 revisadas: sin desbordes, objetivos ≥44 px, texto de documentos fuera del DOM).
- Defectos encontrados por Claude y corregidos: (a) comparador: la regex de cifras no reconocía porcentajes seguidos de espacio (`10% mensual`) y `criticalChanges` ignoraba párrafos enteros eliminados/añadidos; ahora ambos se señalan (prueba nueva). (b) **Frente F (mi commit `4a12a31`)**: la bitácora guardaba `proposal_id` nulo en todas las decisiones porque `agentLog` leía `proposalId` pero las propuestas usan `id`; ahora enlaza (prueba de regresión). (c) El smoke de Codex tenía selectores estrictos ambiguos y comparaba el id de la propuesta con el del recordatorio; corregido.
- Alcance honesto: el comparador es léxico y no es análisis jurídico; sin validación con abogados. Aún no existe bucle de agente que use `agentChannel`; la UI solo aprueba/rechaza lo que ya exista. Cómputo de plazos sigue sin construirse hasta que una persona revise el catálogo de días inhábiles.
- Siguiente (H): conflicto de intereses (local, determinista) o checklist documental; Frente C: repetir los 3 casos bloqueados por memoria.
- Frente C (Claude): intento de repetir los casos públicos (`claude-run-3`, `claude-run-3b`). `claude-run-3` falló al reclamar bloqueos: `pipeline.lock`/`gpu.lock` huérfanos de las 01:26 (pid 93691 inexistente, sin entrenamiento activo); los retiré tras comprobar el pid. `claude-run-3b`: 0/16 evaluados — la compuerta de memoria («Libera al menos 3 GB») rechazó cada generación (preflight estimó 4,19 GiB, pero con el modelo cargado quedó bajo 3 GiB). Sin inferencia, sin umbral reducido; sin evidencia nueva de calidad. Estado: bloqueado por memoria en este Mac; requiere cerrar apps o más RAM libre. No se reintenta en bucle.
- Mejora de Claude: `claimLocks` (`scripts/evaluate-lightweight-skills.mjs`) ahora recupera solo bloqueos cuyo pid ya no existe; bloqueos sin pid o de procesos vivos siguen bloqueando (prueba nueva, 14/14 en `lightweight-skills.test.mjs`).
- Lanzado Codex para H#2 conflicto de intereses (`server/conflicts.mjs`, API `conflict.check`, determinista, solo metadatos de asuntos del mismo despacho).
