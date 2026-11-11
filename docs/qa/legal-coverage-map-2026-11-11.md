# Mapa de cobertura legal — 11 de noviembre de 2026

Consolidación de evidencia offline ya existente en el repositorio, distinguiendo **catalogado / ingerido / verificado / vigencia**. No incorpora textos nuevos, no ejecutó red ni adquisición, y no afirma completitud, vigencia ni validez jurídica. Cada cifra conserva su captura de origen.

## Catalogado (referencias, no textos incorporados)

- **Federal:** 480 instrumentos desde el catálogo público de la Cámara de Diputados: 317 leyes y 163 reglamentos (captura del 2026-11-02, `docs/legal-library-coverage.md`).
- **Estatal:** el índice offline del Orden Jurídico Nacional (SEGOB) registra conteos publicados de 2,440 leyes, 213 códigos y 2,483 reglamentos en las 32 entidades (`resources/legal-library-catalog-ojn-index.json`, capturas del 2026-11-02). 16 entidades no publican conteo por tipo; el índice no contiene textos ni verifica completitud, vigencia o autenticidad.
- **Judicial:** fuentes candidatas investigadas (SJF entre 8 candidatas estatales/judiciales, C1b.1) sin catálogo de conteos propio en el repositorio.

## Ingerido (texto en biblioteca)

- **303 instrumentos federales** en la exportación congelada, 35,452 artículos, más semilla de 21 artículos/7 instrumentos. 177 instrumentos federales extraídos permanecen pendientes o excluidos de esa exportación.
- **0 instrumentos estatales** incorporados: las 20 plazas del piloto (Jalisco, Nuevo León, SJF) siguen pendientes de selección, derechos y manifiesto; dos PDF de investigación de NL permanecen en cuarentena.
- **0 tesis o jurisprudencia**: no hay fuente judicial incorporada.

## Verificado (qué prueban las comprobaciones)

- Auditoría técnica por muestras, no censal: la auditoría de fidelidad de Nuevo León (`resources/nuevo-leon-fidelity-audit-v1.json`) es cuarentena offline donde las discrepancias son evidencia, nunca reparación automática ni selección de versión operativa.
- Los hashes y citas exactas prueban trazabilidad de pasajes contra la captura, no que el texto esté vigente ni que su interpretación sea jurídicamente correcta (`docs/qa/known-limitations.md`).

## Vigencia

- **Sin confirmar en ningún instrumento.** La consulta nueva de CDMX falla por certificado TLS y se conserva el snapshot previo sin eludir TLS; ninguna otra entidad tiene re-consulta registrada. El texto servido es el de la captura congelada.

## Brechas declaradas

Entre lo catalogado (480 federal + ~5,136 estatal publicado por OJN, con datos parciales) y lo ingerido (303 federal) hay una brecha de órdenes de magnitud, además de la ausencia total de historial de reformas y de tesis. Cerrar cualquiera de estas brechas requiere adquisición con manifiesto, revisión de derechos y validación propias: ninguna está autorizada por este documento.
