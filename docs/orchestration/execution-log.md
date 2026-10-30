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
