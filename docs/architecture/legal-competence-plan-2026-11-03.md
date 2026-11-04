# Plan: LEX AI apto en todas las áreas y conversacional (2026-11-03)

Pedido del dueño: que el modelo de la app sirva en todas las áreas del derecho y que converse con naturalidad, refiriéndose a las leyes y a los documentos del asunto, no sólo como un buscador de artículos.

Autor: Claude Opus 5.5. Segunda opinión: Gemini (`opinion`), que coincidió en el diagnóstico y aportó los puntos marcados con (G).

## Diagnóstico

1. **El entrenamiento actual apunta al objetivo equivocado.** Ajusta Qwen3.5-2B con un LoRA de rango 4 sobre una sola capa usando el texto de los artículos. La pérdida (~0,0005) indica memorización. Un modelo de 2B no puede guardar 35.452 artículos con fidelidad, y lo que memoriza a medias se convierte en citas inventadas. El conocimiento debe venir de la recuperación; el entrenamiento debe enseñar **comportamiento**.
2. **La competencia por área depende sobre todo de la cobertura de fuentes.** La biblioteca federal cubre las leyes principales (Constitución, CCF, CFPC, CNPCF, CPF, CNPP, LFT, LSS, Código de Comercio, LGSM, LGTOC, CFF, LISR, Amparo, LFPA, LFPCA, LFPC, LFPPI). Faltan jurisprudencia, la mayoría de los códigos estatales (civil, familiar y penal locales, donde vive buena parte del trabajo diario) y reglamentos. Sin esas fuentes, ningún entrenamiento hace al modelo apto en familiar o civil estatal.
3. **Hoy hay dos caminos separados:** conversación sin fuentes, o respuesta fundada con fuentes. El usuario debería tener una sola conversación que cite cuando hace falta.
4. **El contexto de 4.096 tokens es el cuello de botella** (G). Instrucciones, historial, pasajes y respuesta compiten por el mismo espacio.
5. **Límite honesto:** un modelo de 2B razona poco ante normas en conflicto o hechos ambiguos (G). «Apto en todas las áreas» sólo puede afirmarse con medición por área y revisión de abogados, nunca por el número de pasos de entrenamiento.

## Arquitectura propuesta

**Un solo agente conversacional con recuperación en cada turno**:

1. **Entender el turno:** reescribe la pregunta con el contexto de la conversación («¿y el siguiente artículo?» se convierte en una consulta completa), detecta el área y la jurisdicción, y pregunta el estado cuando el área es local.
2. **Recuperar fragmentos, no artículos** (G): índice por párrafo y fracción. Búsqueda híbrida: la búsqueda léxica actual más embeddings multilingües pequeños (~120 MB) (G), con un mapa de ley a área para no mezclar materias. Documentos del asunto y biblioteca en el mismo ranking, sin salir del asunto.
3. **Responder en un solo contrato:** frases conversacionales libres y afirmaciones jurídicas con cita [D1]/[L1]. El validador actual (números, artículos y citas que deben existir en el pasaje) se aplica sólo a los párrafos jurídicos. Si no hay fuente para una afirmación, la conversación sigue y LEX AI pide la disposición o el documento.
4. **Memoria por asunto y por conversación:** resumen corto de cada conversación y una ficha del asunto (partes, fechas, documentos clave) que se actualiza al importar documentos. El presupuesto fijo por turno: instrucciones ~600 tokens, memoria ~400, últimos turnos ~700, pasajes ~1.700, respuesta 512.

## Entrenamiento correcto: conductual (RAFT)

- **Qué aprende:** conversar en español jurídico mexicano, usar los pasajes recuperados, ignorar los distractores, citar cada afirmación, abstenerse cuando no hay fuente, preguntar los hechos que faltan y seguir conversaciones de varios turnos.
- **Datos:** diálogos sintéticos de 10 áreas (constitucional, civil, familiar, penal, laboral, mercantil, fiscal, amparo, administrativo y seguridad social), construidos sólo con fuentes públicas recuperadas y con procedencia por ejemplo. Cada ejemplo trae 1 o 2 pasajes correctos y 2 o 3 distractores. Ningún documento de cliente.
- **Configuración:** LoRA rango 16 en todas las capas sobre el mismo Qwen3.5-2B (el base se conserva); pérdida sólo sobre las respuestas del asistente.
- **Evaluación retenida por área**, comparada con el modelo base sin adaptador: fidelidad de citas, abstención correcta, preguntas de hechos faltantes, calidad conversacional y casos con distractores. Una muestra la revisa un abogado. El adaptador sólo entra a la app si mejora al base sin empeorar la abstención.

## Modelo por equipo

- **8 GB:** Qwen3.5-2B con el adaptador conductual (el actual más el entrenamiento).
- **16 GB o más:** evaluar un candidato de 4B con el mismo adaptador y la misma prueba por área. Se ofrece sólo si la medición lo justifica.

## Orden de trabajo

1. Detener el entrenamiento por memorización. Archivar el punto de control 70.000 y su informe, sin borrarlos.
2. Medir la línea base por área con el modelo actual más la recuperación actual: es la referencia contra la que se compara todo lo demás.
3. Agente conversacional único, índice por fragmentos, búsqueda híbrida y memoria por asunto. Esto mejora la conversación sin entrenar nada.
4. Cobertura: reglamentos (catálogo de 163 en curso), códigos civil, familiar y penal de los estados vía OJN, y jurisprudencia obligatoria desde una fuente oficial accesible sin evadir bloqueos (G).
5. Dataset RAFT y LoRA conductual. Evaluación emparejada contra la línea base.
6. Revisión de abogados por área antes de cualquier afirmación de aptitud.

## Decisiones del dueño

- Detener el entrenamiento actual (recomendado).
- Quién genera los diálogos sintéticos: un modelo externo trabajando sólo con texto legal público (mejor calidad), o el modelo local (sin envío, menor calidad). Nunca con datos de clientes.
