# Ciclo autónomo de mejora del agente — 2026-11-04

Objetivo: que el modelo pequeño (8 GB) converse con naturalidad y conteste preguntas jurídicas con fuentes, sin inventar. Se mide con el examen ciego `eval/dialogue/cases.jsonl` (36 casos retenidos: **nunca usarlos como datos de entrenamiento**).

## Reglas del ciclo

- Trabajar solo en la rama `rescate-0.4.13`. Commits locales y push a esa rama. Nunca a `main` (despliega la landing).
- Sin instalar en /Applications, sin descargar o cargar modelos nuevos, sin iniciar entrenamientos, sin pagos ni datos de clientes.
- Cada cambio: `npm test` completo en verde antes del commit. Si una prueba antigua protege una regla de seguridad, no se debilita: se ajusta el cambio o se documenta.
- Groq (juez) solo con datos sintéticos; si falla la red o la cuota, se para y se continúa en la siguiente vuelta. Sin reintentos en bucle.
- Máximo tres intentos fallidos por problema; después, diagnosticar y anotarlo aquí.
- No presentar un PASS técnico como calidad conversacional lograda.

## Cómo medir

```sh
node scripts/eval-dialogue.mjs run --label vN
node scripts/eval-dialogue.mjs judge --a artifacts/eval-dialogue/<base>.json --b artifacts/eval-dialogue/<vN>.json
# si se detiene: ... judge --a ... --b ... --resume <archivo-judge>.json
```

Base de referencia: `artifacts/eval-dialogue/2026-11-04T21-03-06-810Z-run-base-0.4.13.json` (28/42 comprobaciones).

## Registro

| Versión | Comprobaciones | Juez vs base (gana nuevo / base / empate) | Cambios |
|---|---|---|---|
| base 0.4.13 | 28/42 | — | — |
| v1 | 29/39 | — | más citas por fuente, instrucciones, calculadora |
| v2 | 32/39 | 7 / 11 / 5 (23 de 36; se cortó la red) | router de leyes/prestaciones, números del pasaje, chat por frase |
| v3 | 35/40 | pendiente | fecha falsa "14 de la", tesis honesta; 1 timeout en tema-02 |
| v4 | 36/41 | pendiente | quitada la instrucción «si no estás seguro, dilo»; 2 timeouts por reposo de la Mac (no del modelo) |

## Problemas abiertos (priorizados)

1. Chat: v2 perdió frente a la base en varios casos de charla (tímido al pedir un dato curioso, duplicados en listas). Se quitó «si no estás seguro, dilo» (v4).
2. Explicaciones jurídicas con errores de razonamiento (v5: filtro de distractores — si la primera frase de la fuente principal nombra el tema, se descartan fuentes cuya primera frase no lo comparte; aguinaldo pasa de 3 fuentes a solo el art. 87): vacaciones («el primer año no garantiza vacaciones»), aguinaldo sin los 15 días, art. 16 con contenido de otro párrafo. Idea: elegir citas por relevancia a la pregunta y no solo por coincidencia de palabras; pasos pequeños (primero elegir la cita, luego explicar).
3. Abstenciones restantes: art. 1794 («dos elementos»), «Más corto, en dos líneas» tras una respuesta jurídica, «¿qué área soy?».
4. Timeouts: causados por el reposo de la Mac con batería (pmset log 16:08–16:28). Las corridas se envuelven ahora con `caffeinate -i -w <pid>`; cerrar la tapa sigue suspendiendo.
5. Alucinaciones en charla general (pulpos «sin branquias»). Difícil sin más contexto; no prometer.
