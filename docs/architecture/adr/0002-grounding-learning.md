# ADR 0002 — Evidencia y aprendizaje con revisión

Estado: aceptado para prototipo, 2026-10-29.

Recuperación lexical local con alcance de asunto y jurisdicción; evidencia fija por respuesta. Se rechazan IDs desconocidos, citas textuales no coincidentes y párrafos sustantivos sin referencia. No se confunde esta comprobación con evaluación de exactitud jurídica.

Los snapshots conservan fecha, origen y SHA256; campos de entrada en vigor desconocidos permanecen nulos. No afirmar que un código conserva vigencia por estar alojado en un portal oficial. El PDF de CDMX usado tiene una anomalía editorial de portada expresamente registrada.

Feedback produce propuestas de notas limitadas al asunto, nunca entrenamiento. Activación exige evaluación estructural y revisión humana confirmada. Versionado y rollback se realizan en una transacción SQLite. Ajustes de skills, plantillas, embeddings y evaluación jurídica automática quedan fuera de este corte.
