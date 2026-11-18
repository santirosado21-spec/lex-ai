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

## Almacén sellado en disco (server/privacy/map-vault-store.mjs, solo temp dirs en pruebas)
- Un archivo por asunto, nombre = sha256 del par workspace+matter (sin texto del cliente), modo 0600, directorio 0700. Contenido: solo bytes sellados AES-GCM del sellador existente.
- Escritura atómica: se sella, se escribe un temporal exclusivo, se relee y se abre con la misma clave, y solo entonces se renombra sobre el anterior. Error o cancelación borran el temporal y dejan intacto el original.
- `load` importa solo en un asunto vacío; con clave ausente/incorrecta, archivo manipulado o asunto ocupado no importa nada ni modifica ni borra el archivo.
- Clave ausente = error. Nunca se crea clave ni se sobrescribe un mapa desde este módulo.
- `remove` borra únicamente el archivo de ese asunto, `unrecoverable:true`. Sin respaldo ni recuperación.
- No está conectado a la app ni a la ruta cloud. No usa el Keychain real: recibe `getKey`.

## Brecha abierta
- Sin Mac real no se verifica `security -i` ni el ciclo Keychain+disco juntos. Una prueba de borrado en Mac debe usar un ítem y directorio temporales propios, nunca claves o mapas reales.
- Quién llama a save/load y cuándo (cableado a la app) sin implementar.
- Fallos de disco a mitad de rename dependen del sistema de archivos; no se simularon.

Pruebas: `tests/map-vault-store.test.mjs`, `tests/map-key-keychain.test.mjs`, `tests/reidentification-map-custody.test.mjs`, `tests/privacy-pseudonym-persistence.test.mjs`.
