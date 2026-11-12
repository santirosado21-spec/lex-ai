# QA lote 34 (ligie-2022) y cierre del canal federal — 2026-11-12

## Decisión acotada aplicada (excepción documentada de bytes)
maxDocumentBytes es un presupuesto interno conservador de recursos (introducido en el commit de gating 9ac5bd8; valores históricos 5-20 MB entre registries; techo duro ACQUISITION_LIMITS.maxDocumentBytes = 20971520 en server/corpus/source-registry.mjs). NO deriva de restricción del usuario, seguridad, términos ni política externa. Se aplicó excepción de UN documento: maxDocumentBytes=20971520 solo en este registry (mismo valor del registry piloto); límites globales de los demás registries intactos; resto de límites fail-closed sin cambios. PDF verificado en vivo: HEAD HTTP200 application/pdf 19,158,939 bytes, fila editorial del índice oficial (SHA-256 a23aa115…bca sin deriva).

## Resultado
ligie-2022 (LIGIE 2022): 894 páginas, 2,182,265 caracteres crudos, 2 registros (Artículo 1o. = tarifa completa, 1,584,439 chars; Artículo 2o. = reglas generales, 14,008 chars). La estructura de 2 artículos es la real del instrumento (ley tarifaria), verificada contra la capa de texto del PDF. Anomalías: mid-sentence + section-discard (clases conocidas, trazables). CUARENTENA: textReview/legalReview pending; contenido NO revisado.

## Cierre del canal
317/317 instrumentos del catálogo federal adquiridos y en cuarentena. Canal diputados.gob.mx federal agotado. Esto NO valida contenido: revisión de texto/legal sigue pendiente en su carril; nada publicado, indexado ni exportado.
