# Word local de UNA ficha guardada

Base 5e85ae4. Exportación explícita, sin generación/inferencia/egress, ni ampliación
allowlist nativa. Reutiliza docx y patrón de párrafos/TextRun del export de
pendientes; estructura cerrada, sin Markdown/HTML del usuario interpretado.
No cambia ni mezcla Word de pendientes, borradores o corpus.

Servidor recibe SOLO id/revision. Exige expediente cifrado y pertenencia de
workspace/matter/intake, ficha y revisión exactas. Toma texto/citas/contexto del
guardado, no del cliente. Durante await DOCX revalida scope, nombres actuales de despacho/cliente/asunto, snapshot guardado y
estado histórico de evidencia; cambio concurrente rechaza. Audit solo id de
ficha. El archivo no se persiste en servidor ni se comparte automáticamente.

Despacho/cliente/asunto se etiquetan actuales, no como nombres históricos que la ficha no guarda.
Incluye revisión/fecha/autoría, contexto declarado, observación/pregunta literal,
citas guardadas con localizador/hash/páginas/edición/URL/recuperación y avisos.
Si evidencia cambió/no verificable, exporta cita histórica sin reasignarla con
advertencia inicial explícita. No afirma vigencia, lógica ni aplicabilidad.
La UI explica Word sin cifrado y datos privados; exportar con edición local
pendiente usa revisión GUARDADA, lo avisa y no borra ni guarda esa edición.

Medido: servidor 4/4 PASS + UI real componente HTTP 1/1 PASS; UI 1/1 PASS sin variable de
evidencia. HTTP export 200 / stale 400 / native 403, extra fields/foreign/stale/scope
rechazados, carreras de ficha y renombre del asunto tras inicio rechazadas, rama sin fuente jurídica, histórico conserva textos, Markdown
literal sin títulos/listas inyectados; UI descarga contenido guardado y mantiene
edición pendiente también con error de export. npm run build PASS.

DOCX actual e histórico abiertos con LibreOffice, PDF de 2 páginas y render inspeccionado:
título, advertencia, comentario literal, contexto y ambas citas completos,
hashes legibles; corregido encabezado huérfano con keepNext y vuelta a renderizar.
Sin prueba deWord Microsoft, GUI nativa ni privacidad del equipo destino. El
archivo descargado sale del cifrado del expediente, como avisa UI/documento.
