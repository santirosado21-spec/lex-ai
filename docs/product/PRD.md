# LEX AI — MVP local

## Objetivo
Un espacio jurídico privado para despachos mexicanos de distintas especialidades. Comercio exterior es una especialidad posible, no el límite del producto. México es la primera jurisdicción; la arquitectura separa jurisdicción, corpus, skills y almacenamiento.

## Personas y recorrido principal
- Abogado responsable: importa un contrato, identifica riesgos y revisa fuentes antes de exportar.
- Colaborador jurídico: organiza asuntos y documentos autorizados y prepara borradores.
- Administrador del despacho: elige áreas de práctica, conserva datos y revisa cambios aprobados.

En este primer corte las tres funciones pertenecen al mismo usuario del sistema operativo. No se simula autorización multiusuario.

## Alcance del primer corte
macOS Apple Silicon, 24 GB RAM, Gemma 4 26B-A4B fijado por digest, un despacho por directorio privado. Creación de asuntos, TXT/MD/PDF/DOCX, extracción local, índice FTS5, consulta contextual, corpus federal/CDMX reducido, citas trazables, DOCX, feedback y propuestas de notas del asunto con aprobación/reversión. Todas las llamadas del producto a IA son locales.

No incluye cobro, litigación automática, envío de comunicaciones, firma, presentación judicial, OCR, cobertura legal exhaustiva ni validación jurídica profesional. El alcance inicial excluía fine-tuning; el dueño autorizó después el ajuste local como prioridad del 30/10/2026. Ese desarrollo usa datos públicos/sintéticos y evaluación separada, sin aprendizaje automático con expedientes ni promoción de pesos sin evidencia. Los avisos de vigencia son obligatorios: la coincidencia textual no prueba aplicabilidad de una norma.

## Criterios de aceptación medibles
1. La interfaz y el servicio compilan; una aplicación macOS inicia sin Python ni Node instalados por el abogado.
2. El motor incluido puede iniciar/parar; solo una versión aprobada de Gemma se usa después de comprobar SHA256 de manifiesto y archivos.
3. Los datos persisten al reiniciar; otro asunto/despacho no aparece en la recuperación contextual.
4. Importación de cada formato admitido produce texto; entradas inválidas y expansión ZIP excesiva se rechazan.
5. Una prueba con Gemma real, datos sintéticos y fuentes oficiales genera análisis cuyos IDs y pasajes coinciden con la evidencia recibida. Las respuestas inválidas se rechazan, nunca se sustituyen por texto prefabricado.
6. Exportación DOCX conserva análisis, citas, procedencia y limitaciones.
7. Feedback persiste; una propuesta no se activa sin evaluación estructural y confirmación humana explícita; rollback restaura la versión previa.
8. La API rechaza token ausente/incorrecto y origen web no autorizado; escucha solo en loopback.
9. Las pruebas de interfaz identifican los mocks; no cuentan como evidencia de inferencia real.
10. El piloto exige además instalación limpia, descarga desde cero, firma/notarización y revisión profesional; no se declara listo por compilar.

## Riesgos iniciales
| Riesgo | Tratamiento | Pendiente |
|---|---|---|
| Alucinación o cita engañosa | IDs/pasajes comprobados, revisión humana | Evaluación semántica jurídica independiente |
| Fuente antigua | Snapshot/versiones visibles y exportadas | Actualización controlada, revisión de vigencia |
| Filtración entre asuntos | Acceso centralizado y tests negativos | Usuarios/roles antes de uso compartido |
| Compromiso del mismo usuario de macOS | Permisos privados, sin nube | Cifrado de aplicación/Keychain; aislamiento de proceso más fuerte |
| Documento malicioso | Límites, worker, timeout, ZIP preflight | Fuzzing y revisión especializada |
| Modelo/descarga muy grande | Hardware mínimo y progreso | Variantes menores verificadas y pruebas de instalación limpia |
| Aprendizaje perjudicial | Propuesta inactiva, evaluación, aprobación, rollback | Benchmark de mejoras semánticas antes de optimización automática |
