# privacy-development-v4 (DEV4)

Corpus de desarrollo sintético que ejercita los campos opcionales de segmento del
contrato v2 congelado `privacy-eval-v2-annotation-2` (`extractionStatus`,
`assessment`) a través del candidato local de reglas, **no integrado al producto ni
evaluado oficialmente**.

- 16 casos `DEV4-###`: 12 bloqueados operativos (3 por cada razón:
  `unsupported_format`, `partial_extraction`, `ambiguous_context`,
  `detector_failure`), 2 de ellos con entidad que debe conservarse detectada bajo
  bloqueo, y 4 controles limpios `complete` con estados por defecto (sin campos
  opcionales).
- Validado con `validateCases` contra el contrato v2 congelado
  (`eval/privacy/protocol-v2.json`, sha256
  `d0381fcbccd30ab4a6c9475f8f54619d2a19a4c7130d757b3976a1ab311f6af8`).
  Bajo protocolo v1 estos casos son rechazados por diseño: los campos de estado
  solo son válidos bajo protocolo versión 2.
- Unicidad de condición de bloqueo (fail-closed, contrato v2): cada caso bloqueado
  mapea a exactamente una razón inequívoca que coincide con la evidencia de
  estado/provenance; dos estados distintos en un caso se rechazan; un estado sin la
  razón declarada correspondiente se rechaza; los casos `complete` no portan
  ninguna condición y solo estados por defecto; `assessment: "failed"` está
  reservado y no aparece en material puntuado.
- 16/16 estados y razones esperados por la ruta real del candidato; regresión v1
  byte-idéntica en predicciones sobre el corpus dev oficial.

Este material es solo de desarrollo: no es heldout, no es validación ciega ni
evidencia de aceptación. La selección de un DEV versionado para una futura corrida
v2 y el manifest-v2 correspondiente son decisiones de coordinación aún no tomadas;
el DEV v1 oficial no se sobrescribe ni se migra.
