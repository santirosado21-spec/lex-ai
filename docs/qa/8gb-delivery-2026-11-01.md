# Entrega local para el objetivo de 8 GB

Versión **0.4.1**, instalada y abierta en `/Applications/LEX AI.app`. Firma ad hoc de desarrollo verificada; no notarizada. La aplicación anterior y la versión 0.4.0 se preservan en `artifacts/desktop-update/`. No se borraron documentos ni modelos anteriores del usuario.

## Resultado entregado

- Descarga predeterminada reducida a 1,945,781,358 bytes: Qwen3.5 2B Q4_K_M, fijado por manifiesto y hashes. Se inicia solo con acción explícita. Un proceso de inferencia a la vez, contexto limitado, descarga cancelable, comprobación de memoria disponible y supervisor de RSS de 3 GiB. El modelo se descarga de memoria al terminar cada consulta.
- Contexto jurídico recuperado automáticamente de la biblioteca local: 35,452 artículos de 303 instrumentos, conservando procedencia. La investigación jurídica funciona sin importar un documento privado. La vigencia no se presume verificada.
- Escritos exportables a DOCX y apertura nativa de originales/escritos. macOS aceptó abrir un TXT y un DOCX sintéticos mediante el servicio real. Esa aceptación no equivale a una inspección visual del editor.
- Navegación Asistente/Asuntos/Escritos, tipografía del sistema, atajos y adaptación de ventanas según la revisión de Claude Code y referencias oficiales Apple HIG. Se quitaron efectos persistentes que consumían GPU. No es una certificación de Apple.
- Logo original editable en [Figma](https://www.figma.com/design/4O4XgcaSNSMEvAQjUQbc0C?node-id=2-22), incorporado a la interfaz y al icono macOS. Claude Opus 5.5 participó en la revisión de diseño; Codex integró y verificó.
- Candidato entrenado grounded-v2 de 1,017,325,920 bytes, con adaptador, checkpoints, métricas y exportación GGUF reales. **Rechazado para activación**, conservado como experimento. La app no descarga esos pesos entrenados.

## Verificación

| Comprobación | Evidencia local | Resultado |
|---|---|---|
| Backend | `artifacts/lightweight/final-runtime-tests.log` | 147/147 |
| TypeScript, Vite y Tauri | `artifacts/lightweight/desktop-0.4.1-build.log` | PASS |
| Paquete y aplicación instalada | `artifacts/desktop-update/package-0.4.1.json`, `installed-0.4.1.json` | PASS |
| Arranque instalado | `artifacts/desktop-update/launch-0.4.1.json` | Proceso nativo observado |
| Runtime incluido, consulta real y DOCX | `artifacts/lightweight/installed-0.4.1-runtime-probe.log` | PASS, prueba breve de integración |
| UI Chromium, API real y datos sintéticos | `artifacts/ui-hig/smoke.json` | PASS en 1440/1000/780/390/320 px |
| Apertura nativa | `artifacts/native-document-open/synthetic-hTWk9N/report.json` | LaunchServices aceptó TXT y DOCX |

La herramienta de inspección visual nativa no pudo iniciar. La prueba de UI corresponde a Chromium; no se afirma haber inspeccionado visualmente la ventana Tauri instalada. Las pruebas del runtime cargaron pesos ya verificados desde cachés aislados de evaluación.

Instalador: `artifacts/LEX-AI-0.4.1-arm64.dmg`, SHA256 `48fe6c02c26bd702ef156740c4b09c433bb31b60fdb3f219f27f39dfc0581248`. El DMG fue verificado por hdiutil y tiene un archivo SHA256 adyacente.

## Límites y trabajo restante

El equipo físico tiene 24 GB. **8 GB es el objetivo, no una compatibilidad validada**. RSS muestreado no equivale a toda la memoria Metal/unificada ni a consumo total del equipo.

La [comparación de modelos base](lightweight-runtime-comparison-2026-11-01.md) dio 28/30 aceptaciones técnicas con skills para el modelo seleccionado y 30/30 sin ese bloque de instrucciones. No demuestra mejora por skills. El [entrenamiento grounded-v2](grounded-training-v2-2026-11-01.md) mejoró la pérdida supervisada, pero obtuvo 24/30 con plantilla original y 19/30 con plantilla alineada en la evaluación técnica con skills. No se validó calidad jurídica. Ambos modelos pueden añadir afirmaciones que una comprobación estructural no detecte.

La versión es un piloto para notas breves con fuentes; no se ha acreditado redacción de escritos completos ni desempeño profesional. Antes de distribuir un modelo entrenado hacen falta evaluación semántica por rol, casos nuevos, control de conversión equivalente y prueba física en 8 GB. No se activa aprendizaje automático ni un adaptador por el solo hecho de terminar entrenamiento.
