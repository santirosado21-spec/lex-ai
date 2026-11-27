# Contrato experimental v2 de preservación de fuentes

24nov2026,09:25 America/Mexico_City. Extensión aislada trasPASSindependienteKimi del sidecar, no integración de producción.

Archivos: `artifacts/library-expansion-20261124/experiment/preservation-contract-v2.mjs` y `.test.mjs`. Salida real: `artifacts/library-expansion-20261124/preservation-contract-v2-candidate.json`.

Contrato `legal-source-preservation-v2-experimental`, versión2, fin único revisión de fuente. Validator rechaza versión desconocida, banderas de promoción/estructura revisada, páginas faltantes/reordenadas, duplicados, cambios de texto/hash y divergencia de identidad de fuente. Consumidor solo permite modo `source-review`, nunca búsqueda/citación jurídica; devuelve páginas originales y advertencia de no revisión. No importa código de app/server y no altera artículos/transitorios existentes.

Medido:15/15pruebasPASSenexperimento(3preservación+12contrato/consumidor). SobrePDFreal mantiene10segmentospp81–90y22,379caracteres, valid=true/adoptable=false/legalStructureVerified=false. Esto valida integridad mecánica y barrera de consumo del candidato, no exactitud jurídica ni autenticidad criptográfica: un actor con acceso de escritura puede cambiar datos y hashes; el vínculo conPDFreal depende de comprobar bytes contraadquisición y revisión independiente.

Reproducción: `node --test artifacts/library-expansion-20261124/experiment/*.test.mjs`. Para validar archivo real, importar validatePreservationEnvelope del módulo yleerpreservation-contract-v2-candidate.json. No necesita API ni inferencia.

Pendientes: revisión independiente del contrato y consumidor, separación semántica de la páginamixta81yregistro144, resolver7diferenciasentreparsers, fidelidadDOF/fechas/versiones, diseñarmigraciónsinromperconsumidores. No cambia303instrumentosdelíndicecongelado ni habilita documentosclientes. Ninguna dependencia de la revisiónAduanera actualmente pendiente de reconciliación de hashes.
