# C1b exploración — cuatro plazas Jalisco con candidato en Orden Jurídico Nacional

2026-11-12. Investigación pública read-only ejecutada por el agente Instinct del usuario (canal corpus), sin revisión independiente todavía. No es una continuación firmada por Sol/Codex: la procedencia de cada dato es verificable en los recibos citados. Cero descargas de cuerpos, cero adquisición, cero cambios de catálogo, corpus o allowlist. Los bloqueos documentados (catálogo Jalisco 406, SJF 403) conservan su significado: ningún host congresojal.gob.mx ni scjn.gob.mx fue contactado en este corte.

## Resultado

Las cuatro plazas que C1b.5 dejó `checked-unselected` tienen candidato concreto en Orden Jurídico Nacional (ordenjuridico.gob.mx, portal oficial SEGOB), host distinto del catálogo bloqueado:

| Plaza | Instrumento | Ficha OJN | Publicación declarada | Última reforma declarada (listado) | Recurso (HEAD 200) | Last-Modified | Bytes |
|---|---|---|---|---|---|---|---|
| jalisco-pending-04 | Código Fiscal del Estado de Jalisco | [77047](http://www.ordenjuridico.gob.mx/fichaOrdenamiento.php?idArchivo=77047&ambito=estatal) | 16-12-1997 | 10-06-2023 | wo77047.doc | 2023-07-03 | 395,264 |
| jalisco-pending-05 | Código Urbano para el Estado de Jalisco | [54124](http://www.ordenjuridico.gob.mx/fichaOrdenamiento.php?idArchivo=54124&ambito=estatal) | 27-09-2008 | 22-07-2023 | wo54124.doc | 2023-07-27 | 677,376 |
| jalisco-pending-07 | Ley de Justicia Administrativa del Estado de Jalisco | [82041](http://www.ordenjuridico.gob.mx/fichaOrdenamiento.php?idArchivo=82041&ambito=estatal) | 18-01-2000 | 12-11-2015 | wo82041.doc | 2015-12-10 | 217,600 |
| jalisco-pending-08 | Ley del Gobierno y la Administración Pública Municipal del Estado de Jalisco | [82110](http://www.ordenjuridico.gob.mx/fichaOrdenamiento.php?idArchivo=82110&ambito=estatal) | 05-10-2000 | 18-07-2023 | wo82110.doc | 2023-07-27 | 352,768 |

Las cuatro fichas declaran Estatus "Vigente" y Ámbito Estatal. Los Last-Modified de los recursos son posteriores a las reformas declaradas en el listado OJN: coherencia interna, no prueba de vigencia.

## Límites y cautelas

- OJN es host oficial federal (SEGOB), no el congreso estatal. Sus consolidaciones pueden ir ATRASADAS frente al catálogo del Congreso de Jalisco: C1b.5 observó filas de catálogo con fechas 2023-2026 para otros instrumentos. La pregunta de versiones (¿cuál consolidación es la vigente?) queda intacta para el lote autorizado de permisos/robots/versiones.
- Los recursos son .doc (Word), no PDF: el pipeline de extracción actual procesa PDF; un lote futuro necesitaría conversión declarada o fuente PDF alternativa. Esto es un límite de formato, no una objeción de fondo.
- robots.txt de ordenjuridico.gob.mx: HTTP 404 (archivo inexistente) → no hay directivas robots; esto NO es permiso de reutilización ni de adquisición masiva. Permisos de reutilización: UNKNOWN para los cuatro.
- HEAD solamente: sin cuerpos, sin hashes de contenido, sin verificación textual. Ficha/listado son declaraciones del editor.
- La contraparte primaria sigue siendo el catálogo del Congreso de Jalisco (bloqueo 406 documentado, sin reintento). Los candidatos OJN no sustituyen esa fuente; la complementan para el análisis de versiones.

## Presupuesto y evidencia

Operaciones de este corte: 8 búsquedas web, 3 aperturas (2 listados OJN + 1 robots.txt), 4 fichas OJN, 4 HEAD. Sin automatización de navegador, sin PDFs abiertos, sin evasión de bloqueos. Recibos completos en el JSON paralelo (URLs exactas, códigos, fechas, bytes). No se repitió ninguna consulta de C1b.5 para revalidar su historial.

Siguiente paso (no autorizado por este informe): lote de versiones/permisos que contraste OJN vs catálogo Jalisco por instrumento y decida fuente canónica; después, manifiesto de adquisición propio.
