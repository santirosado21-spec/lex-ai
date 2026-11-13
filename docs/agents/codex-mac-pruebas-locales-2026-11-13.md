# Puente Codex (Mac) ↔ Instinct — pruebas locales pendientes — 2026-11-13

Instrucciones para Codex en la Mac de Santiago. Alcance: "pasarle las pruebas locales
pendientes y revisar sus resultados", confirmado por Santiago con "Si" en WhatsApp
2026-11-13 10:34 CST (mensaje wamid.HBgNNTIxNTU0ODU1ODk4MBUCABIYFDNBNUMwMzVEQzBDRDBFMzIzREYxAA==,
respuesta a la propuesta de usar GitHub como puente, sin acceso directo a la Mac).
Nada más. Este documento no crea ni amplía permisos: solo los describe.

## QUÉ SÍ

- Leer el repo, actualizarlo y ejecutar las pruebas indicadas.
- Escribir el resumen de resultados donde se indica y devolverlo.

## QUÉ NO

- NO instalar nada sin preguntar antes a Santiago (si falta `node_modules`, pedir
  permiso explícito para `npm ci`, que solo instala lo del lockfile, sin paquetes nuevos).
- NO modificar código ni pruebas para que pasen. Si algo falla en Mac, se reporta el
  error exacto; la corrección la decide el carril de desarrollo.
- NO tocar `eval/privacy-v2/heldout.jsonl` ni nada del examen reservado.
- NO usar claves, tokens ni secretos; NO llamadas de red salvo `git` contra GitHub.
- NO ejecutar extractores contra la red ni activar corpus: todo el corpus sigue en
  cuarentena; estas pruebas corren offline sobre fixtures sintéticos.

## Pasos

1. `cd` al clone local de lex-ai. Si no existe: avisar a Santiago y clonar
   `https://github.com/santirosado21-spec/lex-ai.git`.
2. `git fetch origin && git switch main && git pull --ff-only`
   Verificar: `git log --oneline -1` debe empezar con `3c89129`.
3. `node --version` — debe ser >= 22.13. Si no, reportar y parar.
4. Si no existe `node_modules/`: preguntar a Santiago antes de `npm ci`.
5. Prueba focal (los 6 fallos pendientes de confirmar en Mac):
   `node --test tests/nuevo-leon-extraction.test.mjs 2>&1 | tee /tmp/nl-mac-2026-11-13.log`
   Anotar conteos `# pass` / `# fail` y, si hay fallos, el primer bloque `error:` completo.
6. Suite completa: `npm test 2>&1 | tail -40` — anotar conteos generales.
7. Diagnóstico de ambiente (una línea cada uno):
   `which pdftotext`, `python3 --version`, `sw_vers`, `node --version`.

## Contexto para interpretar

En el sandbox Linux de Instinct estos 6 casos de `tests/nuevo-leon-extraction.test.mjs`
fallan (estado `partial-quarantine` donde se espera `complete-quarantine`, y ENOENT de
fixtures de extracción). Hipótesis: diferencia de ambiente (parser/Poppler). En la Mac,
donde el extractor se construyó y corrió el piloto NL, deberían pasar. Este encargo
CONFIRMA esa hipótesis; no la asume.

- Si en Mac pasan los 6 y la suite queda 1159/1159: hipótesis confirmada, ambiente Linux
  documentado como causa.
- Si en Mac fallan: es defecto real del extractor o del fixture; reportar el error exacto
  y parar. NO arreglar.

## Formato de devolución

Opción A (preferida): crear `docs/qa/nuevo-leon-extraction-mac-run-2026-11-13.md` con:

```
# Corrida Mac 2026-11-13 — nuevo-leon-extraction + suite
- HEAD: <hash corto>
- node: <versión>  macOS: <versión>  python3: <versión>  pdftotext: <ruta o "no encontrado">
- tests/nuevo-leon-extraction.test.mjs: pass X / fail Y
- npm test: pass X / fail Y
- Si fail>0: primer error completo (pegado)
```

Commit y push a `main` con mensaje `qa: corrida Mac nuevo-leon-extraction 2026-11-13`.

Opción B: devolver el mismo resumen a Santiago para pegarlo por WhatsApp.

## Límites de claims (permanentes)

Corpus en cuarentena; la única revisión independiente de contenido es extractor v22
sobre 5 PDFs. Ningún resultado de estas pruebas valida contenido ni procedencia.
