# Comparación de cobertura: Luthor (luthor.mx) vs corpus Rejon — 2026-11-11

Referencia pedida por el producto: «tener el mismo repertorio de documentos
como luthor.mx». Este documento contrasta la cobertura **declarada** por
Luthor con el estado **verificado** del corpus Rejon y mapea las brechas a
fuentes públicas adquiribles con permisos. Las cifras de Luthor son afirmaciones
de marketing público, no verificadas; no implican equivalencia de calidad,
vigencia ni licencia. Nada aquí cambia políticas de corpus, derechos ni
robots.

## Evidencia pública recolectada

- Descripción de su conector (réplica pública en mcptop.com/server/luthor):
  «113,290 normas de todo México (leyes, códigos, reglamentos y decretos
  federales y de las 32 entidades federativas, y tratados internacionales)
  con su vigencia declarada, su fuente y su fecha de corte, y el texto de las
  que lo tienen; el texto de 16 ordenamientos federales curados (fiscal, …);
  311,972 tesis del Archivo Soberano Luthor».
- Páginas públicas de tesis SCJN con registro y clave (épocas 10a./11a.,
  jurisprudencia y aislada), p. ej. luthor.mx/jurisprudencia/JP-2030894/.
- Páginas públicas por artículo con resumen generado, p. ej.
  luthor.mx/liva/LIVA-art-29/ (su valor añadido es la capa de resumen).
- Su portada es una aplicación JS; las páginas de detalle son accesibles
  públicamente una vez conocida la URL.

## Contraste con el estado verificado de Rejon (2026-11-11)

| Dimensión | Luthor (declarado) | Rejon (verificado) |
| --- | --- | --- |
| Normas federales con texto | 16 ordenamientos "curados" + catálogo de normas | 10 ordenamientos federales adquiridos y extraídos (8,086 registros, auditoría limpia) |
| Entidades federativas | 32 (declarado) | 1 (Nuevo León: 8 documentos, 5,610 registros) |
| Reglamentos y decretos | incluidos en la cifra de normas (declarado) | 0 (flujo DOF diseñado, prototipo pausado) |
| Tratados internacionales | incluidos (declarado) | 0 |
| Tesis / jurisprudencia | 311,972 (declarado) | 0 (términos SCJN sin resolver) |
| Vigencia | "vigencia declarada + fecha de corte" (declarado) | `declaredAmendedAt` capturado de la fuente; vigencia NO certificada |
| Escala total | ~113k normas + ~312k tesis (declarado) | 18 documentos / 13,696 registros en cuarentena |

## Brechas y ruta adquirible (derechos y robots intactos)

1. **Estados (brecha mayor: 31 de 32 pendientes).** Vía congresos estatales.
   Estado verificado previo: hcnl.gob.mx (NL) adquirible y ya adquirido;
   Jalisco bloqueado por robots (fail-closed correcto); OJN/SEGOB descartado
   para texto vigente (formato .doc y desfase de 8–18 años). Cada estado
   requiere su propia revisión de canal/derechos como la ya hecha para NL.
2. **Federales más allá de los 10 pilotos.** El alcance aprobado de
   diputados-fed es el piloto acotado de 10 documentos; ampliarlo es una
   decisión de alcance nueva. Luthor afirma 16 federales curados; la lista
   exacta de los 6 restantes no es pública.
3. **Reglamentos y decretos.** Flujo DOF ya diseñado
   (docs/research/dof-decree-flow-design-2026-11-11.md): portada → PDF diario
   por rutas permitidas por robots; los endpoints de consulta histórica están
   prohibidos por robots. Prototipo pausado hasta completar la publicación.
4. **Tratados internacionales.** Clase de fuente nueva, no investigada aún;
   candidatos oficiales: DOF y la colección de tratados del Senado/SRE.
   Requiere la misma revisión de canal/derechos antes de cualquier adquisición.
5. **Tesis / jurisprudencia.** Bloqueada por los términos
   anti-comercialización de SCJN (pendiente de decisión del proyecto); el
   canal Gaceta PDF de www.scjn.gob.mx está localizado. No hay ruta operativa
   sin esa decisión.

## Lectura honesta para el producto

- El "repertorio" de Luthor combina catálogo (metadatos de ~113k normas, no
  necesariamente con texto completo: «el texto de las que lo tienen») con
  texto curado de un subconjunto. Rejon hoy tiene texto completo extraído y
  auditado de 18 documentos; alcanzar la escala de catálogo declarada exige
  un programa de adquisición multi-fuente (estado por estado, con su revisión
  de canal y derechos), no un ajuste. No se estima aquí un plazo: depende de
  decisiones de alcance y de la revisión por fuente.
- La prioridad de mayor valor por esfuerzo verificado: (1) completar federales
  si se aprueba ampliar el piloto, (2) flujo DOF para reglamentos/decretos
  (diseño listo), (3) estados uno a uno replicando la revisión de NL.
- Ninguna cifra de Luthor debe citarse al usuario como cobertura propia ni
  como meta comprometida.
