# C1b.4: el parser federal no cubre correctamente estos códigos estatales

El primer parse offline concluyó técnicamente en819,879ms, dos invocaciones/ninguna solicitud de red y619páginas(Civil396/Penal223). **La calidad es insuficiente:** Civil produce sólo2candidatos; Penal100 con anomalías y parada anticipada. Todos permanecen en cuarentena. [Evidencia](nuevo-leon-extraction-C1b4-2026-11-10.json), [freeze](nuevo-leon-extraction-C1b4-freeze-2026-11-10.json), [protocolo](../architecture/nuevo-leon-extraction-v1.md).

| Original | Parser legal-library-6 sin modificar | Límite observado |
| --- | --- | --- |
| Civil | 2candidatos estructurales, transitorio observado enp374 | La abreviatura Art.1o.- de la primera página no coincide con la gramática federal. Dos no significa completitud. |
| Penal | 100registros, todos con anomalía; detención en artículo96/p27, sin frontera transitoria | Una referencia partida al artículo96 se confunde con cabecera; el registro previo contiene sólo ARTICULO96. enp26. |

Root renderizó primera página de ambos y páginas26/27 del Penal mediante Poppler y las inspeccionó. Enp26 la referencia terminal pertenece al párrafo de artículo89 y no lleva delimitador .-; enp27 aparece la cabecera real96.-. Esto explica el falso duplicado concreto sin decidir vigencia o contenido operativo. La muestra no valida619páginas, toda la extracción o exactitud jurídica. La siguiente versión necesita evidencia por página y perfil estatal separado; no editar la corrida fallida o el parser federal congelado para ocultarla.

Se verificaron13entradas y6salidas, hashes PDF/texto/referencias de página y flags pendientes. Builder/revisor15/15 con extractor inyectado; revisor posterior comprobó evidencia real sin otra extracción o red. APPROVE técnico, no elegibilidad sustantiva. missingNumericHeadings:false sólo expresa que hubo algún match; no que todos los artículos estén presentes.

Se conservan PDF originales, procedencia exacta y queries opacas. Fechas declaradas siguen null cuando el parser no las reconoce; la captura como fallback de versión es técnica, nunca reforma o vigencia. No adquisición aprobada, índice, publicación, entrenamiento o cambio de allowlist/registro. El límite768MiB es heap V8old-generation del worker, no RSS total o validación8GB del cliente.
