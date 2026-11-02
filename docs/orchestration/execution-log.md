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
