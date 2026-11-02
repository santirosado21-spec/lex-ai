# Chequeo local de conflicto de intereses

`conflict.check` es una comprobación determinista y local de nombres. No usa modelos, red, documentos ni herramientas del sistema. Su único propósito es producir pistas para revisión humana: **es un chequeo léxico, no una determinación jurídica de conflicto de intereses; la ausencia de coincidencias no es autorización ni clearance**.

## Alcance y datos

El servicio obtiene los asuntos del espacio de trabajo activo y compara el nombre solicitado únicamente contra metadatos de asuntos: hoy, `client` y `title`. Si futuras versiones almacenan campos explícitos de partes (`counterparty`, `otherParty`, `counterparties`, `otherParties` o `parties`), el mismo comprobador los considera cuando sean texto. No consulta ni devuelve texto de documentos, respuestas ni notas.

Si se proporciona `matterId`, debe pertenecer al espacio actual y representa el asunto desde el que se inicia la revisión; ese mismo asunto se excluye de los resultados para buscar coincidencias en otros asuntos. Ningún asunto de otro espacio de trabajo llega al comprobador.

## Comparación y límites

Los nombres se normalizan de forma NFC, minúsculas, sin acentos, con espacios colapsados y sin puntuación. Se quitan designaciones corporativas mexicanas al final del nombre (`S.A. de C.V.`, `S. de R.L.` y `S. de R.L. de C.V.`, `A.C.`, `S.C.`). El resultado marca:

- `exact`: nombre normalizado idéntico, con `score: 1`.
- `similar`: solapamiento de tokens o una distancia de Levenshtein acotada para erratas, con una puntuación entre 0 y 1.

La petición acepta exactamente `{name, matterId?}`. `name` debe tener entre 2 y 200 caracteres y normalizarse a al menos dos caracteres; los identificadores de asunto tienen la misma gramática acotada que el resto del servicio. Se escanean como máximo 500 asuntos, ordenados determinísticamente por ID. Cuando quedan asuntos sin escanear, `truncated` es `true`; por tanto, un resultado vacío con truncamiento requiere revisión adicional.

Las coincidencias se ordenan de modo determinista: exactas antes que similares, después por puntuación, título normalizado, ID de asunto, campo y texto coincidente.

## Auditoría

Cada consulta registra `conflict.check` en la auditoría local. El identificador auditado es un SHA-256 con dominio del nombre normalizado, no el nombre en texto claro. La auditoría no almacena documentos ni el resultado de la búsqueda.
