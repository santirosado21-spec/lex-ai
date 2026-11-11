# privacy-development-v4 (DEV4)

Corpus de desarrollo sintético que ejercita los campos opcionales de segmento del
contrato v2 congelado `privacy-eval-v2-annotation-2` (`extractionStatus`,
`assessment`) a través del candidato local de reglas adaptado, **no activado**.

- 16 casos `DEV4-###`: 12 bloqueados operativos (3 por cada razón:
  `unsupported_format`, `partial_extraction`, `ambiguous_context`,
  `detector_failure`), 2 de ellos con entidad que debe conservarse detectada bajo
  bloqueo, y 4 controles limpios `complete` con estados por defecto (sin campos
  opcionales).
- Validado con `validateCases` del protocolo v1 más los campos aditivos v2;
  16/16 estados y razones esperados por la ruta real del candidato.
- Regresión v1: tras la adaptación, `predictions.json` y `score.json` del dev
  oficial son byte-idénticos a la corrida `dev-rules-baseline-v4-2026-11-11`.

Los archivos del contrato v2 congelado **no** están en este repositorio; su carga
y activación esperan aprobación de coordinación. `assessment: "failed"` está
reservado por el contrato y no se usa. Este material es solo de desarrollo: no es
heldout, no es validación ciega ni evidencia de aceptación.
