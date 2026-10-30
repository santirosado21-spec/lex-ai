# Límites actuales

- Prototipo, no producto listo para clientes confidenciales. Falta revisión legal y evaluación semántica independiente.
- Un usuario OS y un despacho por directorio; no usuarios/roles por cliente. SQLite sin cifrado propio; no borrado seguro ni backups gestionados.
- Gemma 4 26B-A4B requiere macOS arm64/24 GB y unos 16 GB de pesos. Otras plataformas/modelos no validados. Descarga limpia y reanudación todavía requieren verificación completa.
- Búsqueda lexical FTS5; no embeddings/híbrida, OCR ni jurisprudencia. Biblioteca federal de 35.452 artículos/303 instrumentos, más semilla de 21 artículos/7 instrumentos. Auditoría técnica por muestras, sin cobertura estatal completa ni vigencia confirmada. La consulta nueva de CDMX falla por certificado TLS; se conserva el snapshot previo sin eludir TLS.
- Los hashes y citas exactas prueban trazabilidad de pasajes, no que la interpretación sea jurídicamente correcta. Se intenta JSON estricto y se permite únicamente escapar LF/CR/TAB literales dentro de strings, registrando el ajuste. Después se rechazan estructuras, IDs, citas o párrafos sin referencias que no pasen las validaciones. El parser no corrige razonamiento.
- El feedback del usuario solo propone notas de asunto, con evaluación estructural y revisión humana. El ajuste local de pesos autorizado por el dueño es un proceso de desarrollo separado, con legislación pública y ejemplos sintéticos. No hay entrenamiento automático con documentos ni sustitución automática del modelo activo. El candidato v2 se entrenó 400 pasos para citas/JSON/abstención, sin validar razonamiento profesional.
- El TAR experimental v2-r2 requiere importación manual en Ollama compatible. La UI todavía usa el modelo base fijado; no incluye un selector del candidato. El flujo sintético del candidato se verificó contra el servicio real con transporte sin esquema; no demuestra instalación del candidato dentro de la app en otro Mac. La continuación v3 fue rechazada.
- Exportación DOCX de análisis/borradores; no editor de plantillas jurídicas completo.
- El servicio de inferencia loopback no protege ante procesos maliciosos de la misma cuenta.
- Distribución con firma ad hoc local; sin firma Developer ID/notarización ni actualizador firmado. No se afirma comportamiento de Gatekeeper en otro Mac.
- El catálogo fija un digest: si el tag remoto cambia, la inicialización debe rechazarlo y requerir actualización revisada del catálogo.
- En Ollama 0.40.6 la caché de prefijos MLX retiene memoria entre solicitudes. La app descarga el runner de memoria tras cada respuesta para evitar su acumulación en equipos de 24 GB; la siguiente consulta paga nuevamente el coste de carga.
