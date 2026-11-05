# Ciclo autónomo de mejora del agente — 2026-11-04

Objetivo: que el modelo pequeño (8 GB) converse con naturalidad y conteste preguntas jurídicas con fuentes, sin inventar. Se mide con el examen ciego `eval/dialogue/cases.jsonl` (36 casos retenidos: **nunca usarlos como datos de entrenamiento**).

## Reglas del ciclo

- Trabajar solo en la rama `rescate-0.4.13`. Commits locales y push a esa rama. Nunca a `main` (despliega la landing).
- Sin instalar en /Applications, sin descargar o cargar modelos nuevos, sin pagos ni datos de clientes.
- **Actualización del dueño (2026-11-04, noche):** con su cuenta de pago de Kimi pidió «empieza con el plan». Queda autorizada la capa 4: destilación con Kimi como maestro y un LoRA local acotado. Condiciones: base preservada, candidato inactivo, medición ciega contra la base y aprobación humana antes de activar. Proceso en `docs/qa/distillation-2026-11-04.md`. Instalar llama.cpp para la conversión a GGUF requiere aviso previo.
- Cada cambio: `npm test` completo en verde antes del commit. Si una prueba antigua protege una regla de seguridad, no se debilita: se ajusta el cambio o se documenta.
- Groq (juez) solo con datos sintéticos; si falla la red o la cuota, se para y se continúa en la siguiente vuelta. Sin reintentos en bucle.
- Máximo tres intentos fallidos por problema; después, diagnosticar y anotarlo aquí.
- No presentar un PASS técnico como calidad conversacional lograda.
- Prueba intermitente conocida: `stt.test.mjs` «rejects oversize audio and a concurrent job…» (carrera ya documentada en 0.4.13). Puerta de commit: `scratchpad/green.sh` exige `# fail 0` y solo admite una repetición si falla esa prueba concreta. El commit `bc9a657` se hizo con esa prueba fallando por un encadenado sin puerta; el contenido pasa 402/402 al repetir.

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
| v4 | 36/41 | — | quitada la instrucción «si no estás seguro, dilo»; 2 timeouts por reposo de la Mac (no del modelo) |
| v5 | 37/39 | **18 / 12 / 6** (36/36). Naturalidad 3,47→3,94; instrucciones 3,47→3,83; fidelidad 3,86→3,78 | filtro de distractores. Gana en jurídico 4-2, faltan-hechos 2-0; pierde en seguimiento 1-3 y cambio de tema 2-3 |
| v6 | 37/39 | — | números con letra = cifras; frases con cantidades primero |
| v7 | 37/39 | — | instrucción «solo lo que dice la cita»; «más corto» como seguimiento. Aguinaldo ya correcto (15 días, antes del 20 de diciembre). Nuevo fallo: «más corto» buscaba en la ley forestal |
| v8 | 37/40 | 21 de 36 antes de un corte; **no fiable** (ver abajo) | detector de seguimiento también en el módulo de búsqueda |
| v9-chat | 19/20 (solo charla) | vs base con juez nuevo: 1 / 0 / 18, acuerdo de orden 18/19 | prueba de cordura: instrucción de chat original = respuestas idénticas a la base en 17/19 |
| v10 | 37/39 | sin juicio (Groq caído) | párrafos mal formados se quitan; historial sin marcas [L1]; instrucción de chat de v8 |
| v11 | 37/39 | **11 / 8 / 4** (23 de 36, doble orden, juez ve las citas; se detuvo por límite de cuota de Groq). Base re-ejecutada con su código (`base-q`, 28/41) | citas por relevancia en situaciones; recuerda «no soy X, soy Y»; «contar algo» directo |

**Juez con citas (v11):** el juez ahora ve el texto citado. Antes juzgaba la fidelidad sin ver la fuente. La base se volvió a correr con el código de `c8b29f8` en una copia aparte (`scratchpad/base-worktree`) para guardar sus citas. Faltan por juzgar 13 casos (sobre todo jurídicos): reanudar con `--resume` cuando Groq renueve la cuota.

**Corrección del método (v9):** el juez original (temperatura 1 de Groq, un solo orden A/B) cambiaba de veredicto ante textos idénticos. Desde `0dae09a` el juez usa temperatura 0 y `--both-orders` (una victoria solo cuenta si coincide en ambos órdenes). Los resultados de juez de v2, v5 y v8 son orientativos, no comparables con los nuevos.

## Problemas abiertos (priorizados)

0c. **Panel SF sobre el filtro de distractores (Gemini + Groq, coinciden):** la regla «conservar fuentes cuya primera frase comparta palabras del tema con la fuente principal» es frágil: descarta excepciones que abren con «Los trabajadores señalados en el artículo anterior…», admite distractores que mencionan el tema de pasada y depende de que la fuente principal sea la correcta. Propuestas: usar el puntaje del recuperador o similitud sobre el texto completo, y nunca dejar menos de 2 fuentes si hay 2 relevantes. Es una hipótesis para medir con el examen, no una orden; pendiente. Informe: `scratchpad/sf-out/report.md` (reproducible con `psf panel`).

0. **Fidelidad jurídica no mejora** (juez v5: 3,78 vs 3,86). Contestar más trae errores: vacaciones (fidelidad 2), despido sin aviso (1), art. 16 (2). En v7: aguinaldo y art. 16 corregidos; siguen mal «despido sin aviso» (elige la cita de «causas análogas») y «me despidieron» (lee el art. 47 al revés). Prioridad máxima: que lo dicho sea correcto, no solo citado.
0b. **Seguimientos** («más corto», «¿y el siguiente?», «¿qué área soy?») pierden 1-3 frente a la base.

1. Chat: v2 perdió frente a la base en varios casos de charla (tímido al pedir un dato curioso, duplicados en listas). Se quitó «si no estás seguro, dilo» (v4).
2. Explicaciones jurídicas con errores de razonamiento (v5: filtro de distractores — si la primera frase de la fuente principal nombra el tema, se descartan fuentes cuya primera frase no lo comparte; aguinaldo pasa de 3 fuentes a solo el art. 87): vacaciones («el primer año no garantiza vacaciones»), aguinaldo sin los 15 días, art. 16 con contenido de otro párrafo. Idea: elegir citas por relevancia a la pregunta y no solo por coincidencia de palabras; pasos pequeños (primero elegir la cita, luego explicar).
3. Abstenciones restantes: art. 1794 («dos elementos»: el modelo cuenta fracciones I y II; contar fracciones como cifra se descartó porque un pasaje recortado haría decir «cuatro causas» cuando hay quince). «Más corto» a veces abstiene; «¿qué área soy?» resuelto en v11.
6. Donde la base todavía gana (juez v11): correo y listas (repite un nombre), «cuéntame algo curioso» (el modelo invierte la petición), y párrafos jurídicos que usan información de otra frase del artículo distinta de la citada.
7. Límite de esta vía: los ajustes de instrucciones y validación ya dan rendimientos decrecientes. El siguiente salto de calidad requiere la capa 4 (ejemplos escritos por un modelo grande y un ajuste corto medido), fuera del alcance de este ciclo sin autorización expresa.
4. Timeouts: causados por el reposo de la Mac con batería (pmset log 16:08–16:28). Las corridas se envuelven ahora con `caffeinate -i -w <pid>`; cerrar la tapa sigue suspendiendo.
5. Alucinaciones en charla general (pulpos «sin branquias»). Difícil sin más contexto; no prometer.
