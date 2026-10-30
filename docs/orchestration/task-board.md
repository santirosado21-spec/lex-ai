# Tablero — ciclo 3, modelo experimental verificado

Actualización 30/10/2026: biblioteca pública ampliada a 35.452 artículos de 303 instrumentos; entrenamiento local v2 de 400 pasos, evaluación importada 32/32 y E2E final PASS a las 14:53:56Z. La continuación v3 de 150 pasos falló la prueba de aplicación y queda rechazada. V2-r2 se empaquetó como candidato experimental de importación manual; la app conserva su Gemma predeterminado. El paquete final 0.3.0 pasó verificación a las 14:55:03Z. Ver [reporte de ciclo 3](../qa/cycle-3-report.md) y [supervisión](night-watch.md).

| Objetivo | Estado | Evidencia / siguiente acción |
|---|---|---|
| 0 Descubrimiento | PASS | capability-audit.md, entorno y agentes verificados |
| 1 Definición | PASS | PRD, recorridos, alcance y riesgos |
| 2 Arquitectura | PASS para prototipo | Seis capas, ADRs, amenazas y contrato API |
| 3 Desktop | Paquete 0.3.0 PASS | UI avanzada y biblioteca real comprobadas en navegador; hashes de módulos empaquetados coinciden; sin nueva prueba visual nativa ni segundo Mac limpio |
| 4 Gemma local | v2-r2 experimental verificado | V2 entrenado 400 pasos; 32/32 importados y E2E técnico PASS; paquete separado de importación manual; v3 rechazado; descarga limpia pendiente |
| 5 Documentos | PASS para corte | TXT/MD/PDF/DOCX, FTS, asuntos; pruebas de extracción/aislamiento |
| 6 RAG mexicano | Biblioteca federal ampliada | 35.452 artículos/303 instrumentos; 910 muestras cotejadas, no revisión exhaustiva ni garantía de vigencia; sin jurisprudencia ni embeddings |
| 7 Skills | Motor implementado; E2E candidato PASS | Cinco skills; servicio real con transporte experimental sin esquema, cuatro controles JSON escapados y fuentes validadas; no evaluación jurídica semántica |
| 8 DOCX | PASS para el recorrido sintético | Exportación real con contrato y biblioteca federal comprobada; plantillas avanzadas pendientes |
| 9 Aprendizaje | Experimento local evaluado | V2 seleccionado, v3 rechazado por regresión observada; feedback/notas/aprobación/rollback; sin promoción automática |
| 10 Seguridad/paquete | TAR y paquete 0.3.0 verificados | TAR 14.372.300.800 bytes con hashes/manifiestos verificados; paquete nativo PASS y DMG verificado; instalación limpia/firma comercial/notarización pendientes |
| 11 Piloto | NO LISTO | Revisión jurídica, privacidad, instalación y benchmark pendientes |

## Backlog priorizado
1. Revisar los entregables verificados `artifacts/LEX-AI-0.3.0-arm64.dmg` y el TAR experimental. El candidato se mantiene separado de la app y su integración predeterminada requeriría evaluación nueva.
2. Conservar `artifacts/LEX-Gemma4-Experimental-v2.tar` y sus evidencias; E2E PASS no equivale a validación profesional. Mantener v3 y las salidas fallidas sin promoverlas.
3. Monitor confirmado: primer ciclo completo PASS tras cambiar prioridad a Standard; activo hasta 31/10 03:02:44Z (30/10 21:02 CDMX). Conserva advertencias de fuentes parciales y el timeout previo; revisar nuevas extracciones antes de promoverlas.
4. Instalación limpia y descarga desde cero en equipo soportado, interrupción/reanudación y disco insuficiente.
5. Dataset revisado por abogados: precisión semántica, citas, abstención, cobertura temporal, latencia/memoria y regresiones. El benchmark actual es técnico y léxico, no profesional.
6. Cifrado/Keychain, backup/restauración, supervisión de crash y aislamiento IPC; evaluación de amenazas por especialista.
7. Embeddings locales y recuperación híbrida; fuente estatal editorialmente revisada y proveedor de jurisprudencia.
8. Plantillas editables, roles antes de despliegue compartido, firma/notarización y actualización firmada antes de distribución comercial.
