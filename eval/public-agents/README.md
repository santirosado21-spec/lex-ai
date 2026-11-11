# Comparación preparada de agentes públicos — M1

Objetivo: elegir un modelo por perfil de tarea usando evidencia pareada, no marcas o una cuenta de desarrollo. Registro técnico: [candidatos](../../resources/public-agent-candidates.json); alcance/permisos: [decisión M1](../../docs/architecture/public-agent-model-selection-2026-11-09.md). La configuración es inactiva; no hay rutas de inferencia implementadas aquí.

## Material y controles

`cases.jsonl` contiene 28 casos inventados de preparación (14 por perfil), con campos `id,profileId,dataClass,task,input,expected,rubric`. Las publicaciones, números, personas y fragmentos son sintéticos; no representan ley vigente. Hay extracción/JSON, instrucciones en español, fidelidad de fechas/importes, fuentes/citas, abstención y contenido de fuente que intenta dar instrucciones. Los casos con procedencia confidencial mezclada esperan rechazo antes de enviar; esa expectativa escrita **no** prueba cero bytes de transporte y necesitará H2/adaptador reales.

Los cuatro candidatos y parámetros/precios se contrastan con `catalog-snapshot-2026-11-09.json`; la captura conserva la cotización de cada endpoint separada del catálogo. No se consultan claves para el verificador ni se descargan modelos.

```sh
node scripts/check-public-agent-candidates.mjs
node --test tests/public-agent-candidates.test.mjs
```

Un resultado `candidate-plan-valid-unmeasured` significa únicamente propuesta coherente e inactiva. No es calidad aprobada, permiso de egreso o frescura del catálogo. No hay comando de activar/enviar ni oráculo de calidad.

## Protocolo antes de la primera llamada

1. Revisar que todo input y su procedencia sean públicos/sintéticos. No entregar `eval/privacy/heldout.jsonl` ni datos/historial del cliente. El corpus M1 es desarrollo público, no examen retenido: crear un conjunto independiente antes de la decisión final H8.
2. Congelar el candidato exacto, endpoint y configuración por corrida; capturar request/response sintéticos y versión de fuentes. No usar Auto, alias latest, fallback o cambio de endpoint oculto. El actual canonical del snapshot debe verificarse frente a la generación, no se asume pin inmutable.
3. Empezar con 14 casos por perfil, dos candidatos y tres repeticiones por caso: 168 generaciones si todos proceden. Los casos que deban bloquearse se prueban primero con transporte simulado y deben producir **cero** llamadas; nunca enviar el contenido rechazado para ver si el modelo lo reconoce. Por ello el total real autorizado sería menor y debe cotizarse sobre la lista concreta enviable.
4. Una corrida de producto necesita credencial autorizada y reserva por despacho/tarea. Preparar estimación de tokens/cargo máximo y autorización antes de gasto; este plan no la concede. Todos los costes incluyen fallos, rechazo, razonamiento/cache cuando se factura y cualquier evaluación adicional. No derivar presupuesto de las cuentas SF ni asumir gratuidad por una ficha de modelo.
5. Mantener igual input/máximo de salida entre candidatos dentro del perfil. Serializar únicamente `input` y las instrucciones de sistema/perfil congeladas; `expected`, `rubric`, identificadores y mapping ciego permanecen locales y nunca se incluyen en la solicitud. Registrar respuesta vacía, truncada, JSON inválido o timeout como fallo, sin reparar/reintentar automáticamente. Registrar límites reales de esfuerzo/semilla/temperatura admitidos; no fingir equivalencia de parámetros distintos.
6. Desidentificar el nombre del modelo en la revisión, guardar mapping en archivo separado y ordenar por `rubric.blindOrder`; si se usa un juez, evaluar ambos órdenes A/B y B/A. El orden de casos solo no ciega modelos: el preparador debe anonimizar las respuestas. El modelo que responde no es su único juez.

## Rúbrica de selección propuesta

**Puertas técnicas obligatorias:** cero IDs/citas inventadas en los casos de referencias, cero alteraciones de fechas/importes expresamente presentes, cero texto de instrucciones de fuente convertido en nuevas herramientas/permisos, y rechazo previo de todo caso de procedencia confidencial mezclada. JSON estricto y campos exactos según `expected`; ausencia de información debe producir el valor/abstención señalado. Un fallo bloquea promoción hasta diagnóstico y nuevo conjunto independiente cuando haya afinado.

**Medición de utilidad:** respuesta en español, sigue longitud/formato, extrae hechos fielmente y señala límites sin menú no pedido. Informar resultados por tipo de tarea y cada caso, no solo media. No asignar «precisión jurídica» a estos textos ficticios. La evaluación final requiere pasajes oficiales recuperables/versionados y revisión profesional, junto con casos conversacionales/multiturno independientes.

**Medición operativa:** entrada/salida/razonamiento/cache facturados y su tarifa/fecha, coste de cada fallo y coste total por tarea aceptada, p50/p95/timeout, tamaño y parámetros. Un proveedor que ofrece contexto grande no autoriza aumentar el contexto enviado. Comparar pares por mismo conjunto; preferir el coste menor solo cuando cumpla las puertas y utilidad acordadas. No concluir diferencia general por una única respuesta o las afirmaciones comerciales del proveedor.

M1 no produjo respuestas de estos cuatro modelos ni un ranking medido. Los futuros resultados se guardarán en QA con requested/observed model y endpoint, consumo y límites. H6/H8 y la revisión de políticas de datos siguen siendo puertas separadas.
