# Modelo de amenazas del prototipo

## Activos y límites
Contratos, asuntos, respuestas, feedback y notas aprobadas pertenecen al despacho. El MVP confía en una cuenta macOS dedicada y el sistema operativo; no ofrece ACL por usuario. SQLite reside en un directorio 0700 con umask 077. No hay cifrado propio de la base ni garantía de borrado seguro en SSD.

| Amenaza | Mitigación implementada | Verificación / deuda |
|---|---|---|
| Página web invoca servicio local | Loopback, token aleatorio, origen permitido, POST JSON | Test HTTP de 401/403 |
| Consulta cruza asuntos/despachos | Almacén por despacho y APIs que exigen matterId | Pruebas negativas y reinicio |
| Archivo interpreta instrucciones | Datos separados de instrucciones, sin herramientas de shell | No garantía semántica contra prompt injection; ampliar evaluación |
| DOCX comprimido/PDF patológico | 10MiB, ZIP preflight, worker con timeout/memoria, límite páginas/texto | Pruebas de ZIP; fuzzing pendiente |
| Cita inventada | Esquema con IDs/pasajes permitidos, postvalidación exacta canónica | Pruebas negativas; no valida razonamiento jurídico |
| Modelo manipulado | Manifiesto pin y SHA256 de blobs, comparación de capas ejecutables | Prueba de inicialización real; catálogo firmado pendiente |
| Runtime huérfano/cancelación | Parada serializada, aborto durante inicio, timeout; cierre stdin en app | Test de carrera inicio/parada; supervisión ante crash OS pendiente |
| Aprendizaje contamina otro asunto | Nota con alcance, propuesta inactiva, evaluación, aprobación, rollback | Test transaccional; revisión semántica humana |
| Corpus desactualizado | Versión/fecha/estatus explícitos en UI y DOCX | Actualizador y abogado revisor pendientes |
| Malware del mismo usuario | Sin defensa completa; permisos OS no aíslan ese adversario | UDS/IPC, cifrado y hardening antes del piloto confidencial |

El motor Ollama propio escucha únicamente en 127.0.0.1, con funciones cloud desactivadas; no está autenticado frente a procesos locales. El producto no registra prompts del runtime. Modelo, fuentes oficiales y actualizaciones constituyen flujos de red separados de documentos privados. No se afirman certificaciones ni cumplimiento normativo.

No se implementan envío, firma ni presentación de escritos. Una futura herramienta de alto impacto deberá requerir permiso específico y aprobación humana.
