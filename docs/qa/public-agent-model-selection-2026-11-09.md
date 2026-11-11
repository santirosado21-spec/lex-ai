# M1: selección preliminar de LLM para tareas públicas

Fecha: 2026-11-09. Encargo del dueño al continuar PSF: comenzar a determinar modelos de agentes sin información confidencial. Se añade esta preparación sin saltar las puertas H4/H5/H6/H8. Diseño/selección: Codex/Sol. Worker Sol `public_candidates_tools`: verificador/tests y casos; revisor Sol `review_h5a_m1` independiente. No encargos Claude/Astra ni llamadas de generación a los candidatos.

## Qué queda concreto

El [documento de selección](../architecture/public-agent-model-selection-2026-11-09.md) registra permisos observados y propone instancias públicas separadas. Las 5 habilidades existentes tienen `read:current-matter`; ninguna se convierte en pública por nombre. Consulta, selección de pasajes, memoria, esquemas y derivados también pueden ser confidenciales.

Dos perfiles inactivos: `public-light`, candidatos `openai/gpt-6-luna` y `qwen/qwen3.8-flash`; `public-evidence`, candidatos `openai/gpt-6.1-terra` y `google/gemini-3.8-flash`. El [registro](../../resources/public-agent-candidates.json) guarda canonical observado, endpoint propuesto, cotizaciones separadas del catálogo y las puertas de retención/pin/acceso/calidad pendientes. Un canonical observado no prueba pin inmutable ni selección efectiva del proveedor.

Se consultaron sin clave el catálogo oficial OpenRouter (464 entradas en ese instante) y endpoints de esos 4 modelos. El [extracto público guardado](../../eval/public-agents/catalog-snapshot-2026-11-09.json) permite reproducir lo declarado sin conectar a una cuenta. Las capturas no firman al proveedor ni garantizan frescura. Fuente primaria y fecha están en el registro; la tabla de precios es una cotización, no un coste medido o permiso para pagar.

## Preparación de evaluación y pruebas

`eval/public-agents/cases.jsonl`: 28 casos sintéticos de desarrollo, 14 por perfil, con expectativas tipadas y orden de revisión. Incluye extracción/instrucciones/fidelidad/citas/abstención; 4 casos de procedencia mezclada esperan rechazo antes de cualquier transporte. Es un corpus público de preparación, no el heldout del detector ni un examen final jurídico. Protocolo comparativo y límites: [README](../../eval/public-agents/README.md).

El verificador offline coteja config inactiva, exclusión de permisos de asunto y extracto/hash/cotizaciones/capacidades. No autentica fuente, clasifica prompts, asigna ámbitos o autoriza envíos. CLI devuelve `candidate-plan-valid-unmeasured`; no `winner` ni `production-ready`. Los 15 tests dirigidos comprobaron activación/confidencialidad indebidamente declaradas, exclusiones, referencias, precios/quote contra evidencia, límites y corpus. Se verificó sin llamadas a modelos.

La aritmética ilustrativa con 2.000 tokens de entrada/500 de salida usa solo los cargos básicos del endpoint; no agrega por segunda vez descuentos y separa tarifa de banda/contexto, razonamiento, fees y costo por respuesta aceptada. No se ha medido calidad, latencia o coste real de estos 4 candidatos. OpenRouter no tiene confirmación Free vigente para la credencial efectiva; no se activó. Ninguna clave PSF se usa en producto.

## Aportaciones y puertas

Kimi revisó el paquete conjunto H5a/M1 y advirtió que una pregunta genérica deja de ser pública por sus hechos, metadatos o selección de fuentes. Se incorporó bloqueo por cualquier dato de asunto directo/derivado y ausencia de fallback público desde una ruta privada fallida. El checker no implementa esos permisos: H6/H7 deben comprobarlos con transporte real/inyectado y H8 medir calidad.

El revisor independiente `review_h5a_m1` emitió **APPROVE** para M1: sintaxis/CLI correctos, 15/15 tests dirigidos, hash del extracto/cotizaciones consistentes, 28 casos y las cinco habilidades excluidas. Solicitó aclarar que solo input/instrucciones congeladas se serializan; expected/rúbrica/IDs/mapping quedan locales, y verificó la corrección. No encontró integración de estos modelos/configuración en el runtime activo. El resultado es una lista corta evaluable y una frontera de alcance explícita; no una asignación comercial activada ni validación de privacidad o derecho mexicano.


## Verificación y consumo observados

El coordinador comprobó CLI `candidate-plan-valid-unmeasured`, 15/15 tests dirigidos y build TypeScript/Vite OK. Suite conjunta: primera corrida paralela 511/512 por la intermitencia STT preexistente (`assert.ok(child)`, sin cambios en STT); aislado 5/5 y corrida completa en serie **512/512**, 0 omitidas/canceladas, 14,07 s. `git diff --check` y enlaces relativos de siete documentos nuevos: OK. Evidencia detallada conjunta: [QA H5a](hybrid-H5a-2026-11-09.md).

Distribución de esta sesión: coordinador Sol, dos workers Sol y un revisor Sol independiente, sin Astra/Claude. Una consulta SF a Kimi (29.495 ms, solicitado `kimi-code/k3.1-pro`; versión efectiva/tokens no atestados). Se consultó el catálogo público OpenRouter y los cuatro endpoints, además de un catálogo Groq sin generación. **Cero generaciones a los cuatro candidatos** y cero gasto API nuevo autorizado. Tokens/cuota de los colaboradores no expuestos no se estiman. Logs SF/pruebas permanecen ignorados; no son necesarios para activar ninguna ruta.
