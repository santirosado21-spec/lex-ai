# Plan de pruebas

## Comandos reproducibles
- `npm ci && npm run build`: TypeScript y producción React.
- `npm test`: aislamiento, esquema, citas, persistencia, ZIP, DOCX, aprendizaje, HTTP y ciclo de vida.
- `node scripts/ui-smoke.mjs`: navegador con doble explícito de inferencia; guarda capturas e informe en artifacts.
- `npm run test:e2e`: modelo local REAL, contrato sintético, corpus oficial, DOCX y feedback/rollback. Requiere el hardware soportado y modelo disponible o descarga aprobada. Usa entorno de prueba temporal.
- `npm run desktop:build`: recursos propios, Tauri app; empaquetado y prueba de instalación deben registrarse aparte.

## Matriz pendiente para piloto
1. Instalación limpia en segundo Mac sin Node/Ollama/Python; descarga completa, interrupción/reanudación, poco disco, mala red y checksum incorrecto.
2. Gemma: conjunto revisado por abogados para español, razonamiento jurídico, citas, abstención, documentos largos, JSON y latencia p50/p95. Evaluar cuantización y memoria; una respuesta exitosa no equivale a benchmark.
3. Comparación contra baseline de recuperación; paráfrasis y sinónimos, vigencia, conflicto de jurisdicción, jurisprudencia vinculante/persuasiva.
4. Pruebas adversariales de prompt injection, exfiltración, archivos malformados, pérdida de energía, backups y restauración.
5. Accesibilidad y uso por abogados, firma/notarización/Gatekeeper, actualización y migración reversible.

Los informes distinguen simulación, inferencia real y arranque de escritorio. No declarar instalador probado con solo build o screenshot del navegador.
