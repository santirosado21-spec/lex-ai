# Custodia del mapa de reidentificación (F3) - diseño offline

Estado: diseño y pruebas sintéticas. Sin disco, red, Keychain ni cableado. No verificado en Mac.

## Qué es el mapa
`pseudonyms.mjs` guarda, por asunto, texto original <-> marcador. Es el dato más sensible del flujo: con él se reidentifica cualquier respuesta de la nube. La API key de OpenAI no lo protege ni lo reemplaza.

## Reglas
1. Clave del mapa distinta de la API key. Son 32 bytes aleatorios para AES-256-GCM (`pseudonym-persistence.mjs`, ya existente). El sellador rechaza cadenas con forma de API key, hex y buffers de otro tamaño (`invalid_key`).
2. El mapa sellado está atado al asunto (workspaceId + matterId) como AAD: no se puede trasplantar a otro asunto.
3. El texto original nunca aparece en el sellado; solo el mapa abre su propio blob; cualquier otra clave da `authentication_failed`.
4. El proveedor OpenAI no recibe mapa, clave del mapa ni snapshot. El mapa solo existe en el proceso local.
5. Los snapshots sin sellar son solo memoria local y sintéticos; nunca se escriben a disco.

## Custodia local de la clave (server/privacy/map-key-keychain.mjs, solo fakes)
- Ítem de Keychain propio (`LEX AI.product.reidentification-map` / `map-seal-key-v1`), distinto del de la API key.
- La clave son 32 bytes aleatorios locales, guardados como 64 hex por stdin de `security -i`; nunca en argv, env, logs, archivos ni front. No hay diálogo: el usuario no ve ni elige la clave.
- `create()` nunca sobrescribe (sin -U). `getKey()` con ítem ausente o malformado falla (`key_missing` / `invalid_key_item`) y NUNCA crea una clave nueva en silencio, porque eso dejaría mapas sellados ilegibles.
- `remove()` devuelve `sealedMapsUnrecoverable:true`. No hay respaldo ni recuperación; no se promete ninguna.
- Desactivado por defecto, solo darwin. NO verificado en una Mac real; no hay persistencia en disco del mapa sellado aún (qué archivo y dónde sigue sin implementar).

## Brecha abierta
- Dónde se escribe el blob sellado en disco y su ciclo de vida: sin implementar.
- Sin Mac real no se verifica el comportamiento de `security -i`.

Pruebas: `tests/reidentification-map-custody.test.mjs`, `tests/map-key-keychain.test.mjs`, `tests/privacy-pseudonym-persistence.test.mjs`.
