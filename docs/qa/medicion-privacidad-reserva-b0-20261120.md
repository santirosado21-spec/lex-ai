# Medición de privacidad en dos expedientes ficticios nuevos (sin correr)

**20 de noviembre de 2026.** Estado: **anotados y congelados, NO medidos.** La medición requiere el modelo local `qwen3.5:2b-q4_K_M` en Ollama (127.0.0.1:11434), que no existe en el entorno Linux donde se redactaron. No hay cifras de ocultación ni de retención de este bloque.

## Qué se fijó antes de correr

| Archivo | SHA-256 |
|---|---|
| `eval/privacy-trade/expediente-turno-oficina-b0-20261120.json` (patio fiscal, báscula, turno y ventanilla, tramo en obras) | `01d3e5665ccfc10994531aa225fa29fc70675b91d9d0ba09874d29de26ab035e` |
| `eval/privacy-trade/expediente-ruta-incidente-b0-20261120.json` (recinto, puente cerrado, caseta con mural, carretera vieja, revisión de frenos) | `0b4925ec6c2b920eae7e300e167b79cf1c83d75606a70e6225ff545f944ea60a` |

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
Nota: el script usa `kind` = declaracion, inspeccion, pregunta; este formato es el mismo que `dialogo-*-r32.json`. No se verificó aquí que el script acepte el campo extra `annotation_note`; si falla por eso, quitar sólo ese campo y volver a calcular la huella dejando constancia.
