# Tareas locales en la Mac — pruebas pendientes y diagnóstico de archivos — 2026-11-13

Instrucciones para Codex en la Mac de Santiago. Alcance: dos partes. (1) Correr las
pruebas locales pendientes del repo lex-ai y devolver los resultados. (2) Un diagnóstico
de existencia e integridad de archivos del detector local de privacidad, SOLO LECTURA,
sin ejecutar el detector ni ninguna evaluación. Nada más.

## Límites

- NO instalar nada sin preguntar antes a Santiago. Si falta `node_modules`, pedirle
  permiso explícito para `npm ci` (instala solo lo del lockfile, sin paquetes nuevos).
- NO modificar código ni pruebas para que pasen. Si algo falla, se reporta el error
  exacto y se para; la corrección corresponde al carril de desarrollo.
- NO abrir ni copiar `eval/privacy-v2/heldout.jsonl` (examen reservado).
- NO usar claves, tokens ni secretos. NO llamadas de red salvo `git` contra GitHub.
- El corpus legal sigue en cuarentena: estas pruebas corren offline con fixtures
  sintéticos, sin extractores ni red.

## Parte 1 — Pruebas

1. `cd` al clone local de lex-ai. Si no existe, avisar a Santiago y clonar
   `https://github.com/santirosado21-spec/lex-ai.git`.
2. `git fetch origin && git switch main && git pull --ff-only`.
3. `node --version` — debe ser >= 22.13. Si no, reportar y parar.
4. Si no existe `node_modules/`: preguntar a Santiago antes de `npm ci`.
5. Prueba focal:
   `node --test tests/nuevo-leon-extraction.test.mjs 2>&1 | tee /tmp/nl-mac-2026-11-13.log`
   Anotar conteos `# pass` / `# fail` y, si hay fallos, el primer bloque `error:` completo.
6. Suite completa: `npm test 2>&1 | tail -40`. Anotar conteos generales.
7. Ambiente (una línea cada uno): `which pdftotext`, `python3 --version`, `sw_vers`.

Contexto para interpretar: esos 6 casos fallaban por una divergencia de contrato YA
CORREGIDA en main (los fixtures del test no emulaban el parser pineado v22 al que la
herramienta NL está congelada en producción; el bump federal a v24 los rompió).
En main la suite quedó verde: 1159 pass / 0 fail.
- Si en la Mac la suite queda verde: confirmación cruzada en la máquina donde vive el
  corpus. Listo.
- Si algo falla en la Mac: reportar el error exacto y parar. NO arreglar ni modificar
  código o pruebas.

## Parte 2 — Diagnóstico read-only del detector de privacidad (sin ejecutarlo)

Solo listar archivos y calcular hashes. No cargar el modelo, no correr scripts del
detector, no evaluaciones.

1. `ls -la artifacts/privacy/models/rampart-q4-token-ner-v1/ artifacts/privacy/models/rampart-q4-token-ner-v1/onnx/`
   Se esperan 6 archivos: README.md, LICENSE, config.json, tokenizer.json,
   tokenizer_config.json, onnx/model_q4.onnx. Reportar cuáles existen y cuáles faltan.
2. `shasum -a 256` de cada archivo existente de ese directorio (reportar hash + nombre).
3. `shasum -a 256 artifacts/privacy/rampart-dev-v1-20261110-first/predictions.json`
   (reportar hash, o "no existe").
4. `shasum -a 256 eval/privacy-v2/dev.jsonl` y `wc -l eval/privacy-v2/dev.jsonl`
   (reportar hash y número de líneas).

La comparación de hashes contra los valores esperados la hace el carril de desarrollo
al recibir el reporte; Codex solo reporta lo observado.

## Entrega de resultados

Opción A (preferida): crear `docs/qa/nuevo-leon-extraction-mac-run-2026-11-13.md`:

```
# Corrida Mac 2026-11-13
- HEAD: <hash corto>
- node: <versión>  macOS: <versión>  python3: <versión>  pdftotext: <ruta o "no encontrado">
- tests/nuevo-leon-extraction.test.mjs: pass X / fail Y
- npm test: pass X / fail Y
- Si fail>0: primer error completo (pegado)
## Diagnóstico privacidad (read-only)
- modelos: <archivos presentes/faltantes>
- sha256 por archivo: <lista>
- predictions.json: <sha256 o "no existe">
- dev.jsonl: <sha256>, <líneas> líneas
```

Commit y push a `main` con mensaje `qa: corrida Mac 2026-11-13`.

Opción B: devolver el mismo resumen a Santiago para enviarlo por mensaje.

## Nota permanente

Ningún resultado de estas tareas valida contenido ni procedencia del corpus: sigue en
cuarentena y la única revisión independiente de contenido existente cubre el extractor
v22 sobre 5 PDFs.
