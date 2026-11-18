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

## Brecha abierta (no resuelta aquí)
- Dónde vive la clave del mapa en una Mac real (Keychain con ACL propia, distinta del ítem de la API key) y cómo se respalda o se pierde. Es trabajo de custodia (H6b) y requiere una Mac real; no se implementó para no ampliar funciones.
- Qué pasa si se pierde la clave: el mapa es irrecuperable y las respuestas ya recibidas no se pueden reidentificar. Debe decidirlo el usuario.
- Sin ese destino confirmado, no hay persistencia del mapa: reiniciar la app borra la reidentificación.

Pruebas: `tests/reidentification-map-custody.test.mjs`, `tests/privacy-pseudonym-persistence.test.mjs`.
