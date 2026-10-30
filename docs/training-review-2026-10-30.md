# Revisión previa de entrenamiento y evaluación

Lectura del 30/10/2026 de `scripts/train-legal-adapter.py`, `evaluate-legal-adapter.py`, `build-training-data.py` y `training_status.py`, contrastada con MLX-LM 0.32.2 instalado. No se importó MLX, cargaron pesos ni ejecutó GPU. Se reprodujeron dos problemas con Python puro. Esta es la instantánea revisada **antes de las correcciones del principal**; no afirma que los hallazgos sigan abiertos después de integrar cambios.

## Hallazgos

1. **P1 — Pérdidas no emparejadas y semilla incompleta.** Las llamadas baseline/candidate a `evaluate` no fijan un conjunto de casos ni la semilla NumPy. `tuner/trainer.py:143` permuta los índices incluso al evaluar. `train_model` fija `mx.random.seed`, mientras que `np.random.seed` solo aparece en el `run` omitido por el script personalizado. Por tanto, los ocho casos de baseline y candidato pueden diferir; también cambian las cuatro muestras de validación que determinan `best-validation`. Fijar índices y semillas por partición, registrar IDs y reutilizarlos. La validación de checkpoint también debe usar la misma muestra cada vez.

2. **P1 — Un target PAD adicional en la pérdida upstream.** `tuner/trainer.py:95` usa `steps <= lengths[:,1]`, aunque `lengths` contiene el número de tokens. Con una secuencia de longitud 100, prefijo 60 y batch rellenado a 129, supervisa posiciones de target 60…100; las válidas son 60…99. La posición 100 es el primer PAD. El extremo inferior del prefijo sí es correcto. Usar una pérdida con `steps < length`, o adaptar de manera coherente el extremo del iterator para entrenamiento y evaluación. Cambiar únicamente la variable `trainer.default_loss` no cambia los argumentos por defecto ya ligados a las funciones: pasar `loss=` explícitamente. Reproducción mediante aritmética Python, sin modelo.

3. **P1 — Falsos positivos de abstención.** `assess` reconoce una palabra como `no` o `verific` en cualquier contexto, sin comprobar que se rechace la afirmación. Ambos JSON siguientes devuelven `abstained=true`, `grounded=true`, `passed=true`, con `citations=[]`: `Sí, sigue vigente hoy; no necesitas verificar reformas.` y `Puedes confirmar su vigencia; verifica si quieres.` Reproducción directa de `assess` con Python puro. Usar afirmaciones conservadoras comprobables, rechazar confirmaciones de vigencia y añadir estos contraejemplos. Cualquier heurística restante debe identificarse como tal; no es verificación semántica general.

4. **P2 — Revisión base afirmada sin validación de procedencia.** `training-report.json` incorpora una revisión fija, pero `--base` acepta otro directorio y el script no comprueba el manifiesto base antes de cargarlo. La descarga separada sí produce un manifiesto; usar ese manifiesto validado y sus hashes como origen del reporte, en lugar de una constante independiente de los archivos efectivamente cargados. Esto evita atribuir otro checkpoint a la revisión seleccionada.

5. **P2 — Comparación conductual sin contrato de emparejamiento.** La evaluación candidata solo lee `metrics` de `behavior-base.json`. No exige que correspondan a los mismos IDs, hash de `effective-test.jsonl`, base o configuración de generación. Dos invocaciones con distinto `--per-task`, o un reporte previo, pueden compararse sin aviso. Registrar esos campos y exigir igualdad antes de emitir el gate relativo; incluir el hash del adaptador en el resultado candidato.

6. **P1 — El promedio permite regresiones de inyección.** El gate acepta 14 de 16 casos y no exige ausencia de canarios ni no regresión por tarea. Dos casos fallidos pueden ser dos de los cuatro prompts de inyección: el candidato pasa el promedio aunque haya obedecido la mitad de esos ataques, si mejora otras tareas frente al baseline. Añadir un gate separado para todos los casos de inyección y métricas por tarea; mantener el promedio como resumen, no como sustituto de ese requisito.

## Comprobaciones positivas

- `train_model(Namespace(...), model, train_set, valid_set, Callback())` sí admite el callback y lo entrega a `trainer.train` en 0.32.2.
- `TokenDataset.process` como passthrough entrega la pareja `(tokens, offset)` que espera `CacheDataset` y el iterator. Su `itemlen` ve una pareja de longitud 2, por lo que no ordena realmente por tokens; con batch 1 esto no cambia la corrección del cálculo.
- `load(... tokenizer_config=..., trust_remote_code=False)` corresponde a la API instalada. `generate` comprueba el BOS al recibir texto y evita añadirlo otra vez si el template ya lo incluyó.
- La selección explícita `self_attn.q_proj`/`self_attn.v_proj` evita adaptar expertos. La capa global 29 carece de v_proj, por lo que los últimos cuatro bloques aportan siete módulos.
- Los pesos base quedan congelados. LoRA inicializa B en cero; verificar B no nulo al final aporta evidencia de una actualización, aunque no demuestra mejora de calidad.
- El constructor separa leyes y rechaza texto idéntico entre particiones; los objetivos son copia/cita o abstención y el alcance excluye razonamiento jurídico profesional. La telemetría distingue entrenamiento, evaluación pendiente y publicación no realizada.

## Límites

La lectura no mide memoria real ni demuestra que backward, fusión o inferencia quepan en 24 GB. Los límites configurados y la atención selectiva son coherentes con un ensayo pequeño; el smoke real y su pico medido siguen siendo necesarios. Las métricas de cita comprueban integridad textual y referencia, no que toda afirmación del campo `analysis` esté implicada por la fuente. No debe presentarse `grounded` como una certificación semántica o jurídica.

## Correcciones integradas en el evaluador

Los hallazgos 3, 5 y 6 se corrigieron en `scripts/evaluate-legal-adapter.py`, con 22 pruebas CPU en `tests/training_eval_test.py`. Los cambios al entrenamiento correspondientes a 1, 2 y 4 son responsabilidad del principal y no quedan certificados por esta revisión inicial.

- La abstención exige una negación explícita de capacidad/evidencia y rechaza afirmaciones de vigencia en otra cláusula. Los contraejemplos reproducidos ahora fallan. Es una comprobación léxica conservadora, no un evaluador semántico. También se rechazan claves extra, campos de cita incorrectos, contenido fuera de límites y canarios con cambios de mayúsculas, separadores o escapes JSON.
- El contrato emparejado registra hash del test efectivo, IDs ordenados, procedencia base verificada, semilla de selección, cantidad por tarea, configuración de generación, versión MLX-LM y hash del evaluador. Antes de cargar GPU, el candidato exige un baseline completo con el mismo contrato. El adaptador y sus metadatos tienen hashes propios.
- Se reportan métricas por tarea. Cada métrica de cada tarea debe evitar regresión frente a la referencia; todos los casos de inyección deben pasar y no contener el canario. El promedio mínimo de 0.875 se conserva como requisito adicional.

El script debe permanecer sin cambios entre evaluaciones emparejadas: modificarlo cambia el contrato. Si cambia el protocolo, hay que regenerar las referencias con ese mismo protocolo.

## Evaluación del modelo importado en Ollama

El modo `imported` usa `/api/chat` mediante `urllib`, sin importar MLX ni cargar un segundo modelo local. Solo acepta `http://127.0.0.1:PUERTO` explícito; rechaza credenciales, rutas, queries, proxies y redirecciones. El timeout por petición es 300 segundos; la respuesta HTTP se limita a 1 MiB y el contenido generado a 128 KiB.

```bash
.venv-training/bin/python scripts/evaluate-legal-adapter.py \
  --adapter artifacts/training/lex-gemma4-lora-v2 \
  --mode imported \
  --endpoint http://127.0.0.1:11445 \
  --model-name lex-gemma4-experimental:v2 \
  --per-task 8
```

Usa los mismos 32 casos que las referencias `base` y `candidate`, con `think:false`, temperatura 0 y `num_predict:384`. **No envía `format`**: las tres rutas deben producir JSON sin ayuda de un decodificador restringido. El template/tokenizer del runtime es parte de la compatibilidad a evaluar, no una equivalencia numérica asumida.

Se registran versión Ollama, nombre/digest del modelo, capacidades y métricas de generación disponibles. La identidad del runtime/modelo se comprueba de nuevo al terminar; no se inventa una medición de memoria GPU a partir de HTTP. `behavior-imported.json` contiene `gate.passed` y las comparaciones separadas contra base y candidato. El gate exige superar ambos, incluyendo no regresión por tarea y todos los casos de inyección. Un gate fallido se escribe como resultado experimental rechazado; no impide que el harness ejecute pruebas E2E adicionales para diagnóstico.

No se lanzó ningún servidor Ollama ni se hizo inferencia real durante las pruebas de este agente. El principal ejecuta las evaluaciones reales y la verificación del runtime exportado por separado.
