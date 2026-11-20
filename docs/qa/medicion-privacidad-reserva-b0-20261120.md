# Medición de privacidad en dos expedientes ficticios nuevos (sin correr)

**20 de noviembre de 2026.** Estado: **anotados y congelados, NO medidos.** La medición requiere el modelo local `qwen3.5:2b-q4_K_M` en Ollama (127.0.0.1:11434), que no existe en el entorno Linux donde se redactaron. No hay cifras de ocultación ni de retención de este bloque.

## Qué se fijó antes de correr

| Archivo | SHA-256 |
|---|---|
| `eval/privacy-trade/expediente-turno-oficina-b0-20261120.json` (patio fiscal, báscula, turno y ventanilla, tramo en obras) | `c6d70b4ce96a93db886f67f34676e68d4b7c5cb9e14f25362f8b818312a5db48` |
| `eval/privacy-trade/expediente-ruta-incidente-b0-20261120.json` (recinto, puente cerrado, caseta con mural, carretera vieja, revisión de frenos) | `676985678db0fc69376afb1131ab167fd8b8a628fee48038ea847e6d223018cc` |

Cada texto trae `private` (folio), `clues` (indicios de lugar, suceso, sonido, olor o rasgo físico) y `facts` (hechos técnicos útiles que deben seguir legibles). Se anotaron antes de cualquier ejecución. Todo es ficticio. No se usa el examen privacy-v2.

## Reglas de uso

- Estas dos muestras son **reserva**: no ajustar el detector con ellas. Si tras medirlas se cambia el detector, medir en otra reserva nueva y subir la versión del detector; no adoptar sin QA independiente.
- Medir por separado (a) indicios completamente ocultos y (b) hechos legibles completos, igual que en `privacidad-contextual-y-edicion-r32.md`. Un indicio parcialmente visible cuenta como omisión. Un hecho parcialmente legible pierde el punto.
- Nube: cero solicitudes. Sin claves.

## Cómo medir en un equipo con Ollama (Mac del dueño o de quien corresponda)

```
git fetch origin && git checkout <rama-con-estos-archivos>
npm ci
ollama list   # debe mostrar qwen3.5:2b-q4_K_M; no se descarga desde aquí
node scripts/measure-intake-dialogue.mjs eval/privacy-trade/expediente-turno-oficina-b0-20261120.json --app=.
node scripts/measure-intake-dialogue.mjs eval/privacy-trade/expediente-ruta-incidente-b0-20261120.json --app=.
```

Pegar la salida completa (sin editar) y el commit. Antes: `sha256sum` de los dos JSON debe coincidir con la tabla.
Verificado por lectura de `scripts/measure-intake-dialogue.mjs` y por una comprobación sintética de parseo (sin detector, sin Ollama): el script sólo lee `case`, `client`, `entries[].kind/text/private/clues/facts`; ignora `annotation_note`. Exige que cada término anotado aparezca una sola vez y literal en su texto; esa comprobación pasa en los dos archivos tras corregir 4 anotaciones antes de correr. El script en sí no se ejecutó sobre estas muestras.
