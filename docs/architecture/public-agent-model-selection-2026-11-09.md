# M1 — Modelos candidatos para agentes con entradas públicas

Fecha de consulta: 2026-11-09. Dirección del dueño: comenzar a determinar LLM para agentes que no trabajan con información confidencial. Esta es selección **de producto**, distinta de los asientos SF que desarrollan LEX AI. Registro candidato: `resources/public-agent-candidates.json`; todas las rutas siguen inactivas y ningún modelo fue declarado ganador.

## Qué agentes pueden optar a este perfil

La inspección de `server/skills.mjs` encontró que las cinco habilidades actuales (`legal-researcher`, `contract-reviewer`, `legal-drafter`, `document-analyzer`, `matter-assistant`) tienen `read:current-matter`. El investigador jurídico actual no es público por nombre. `conversation.mjs` y `proactive-drafts.mjs` también pueden incorporar memoria, hechos o prompts de asuntos. Permanecen fuera de esta propuesta hasta su integración/política específica.

Crear instancias futuras **separadas**, con capacidades y entrada acotadas:

| Agente propuesto | Entrada posible | Permisos previstos | Perfil/modelos a comparar |
| --- | --- | --- | --- |
| `public-catalog-curator` | Título, fecha, jurisdicción y pasajes de un catálogo oficial público identificado | Leer únicamente el catálogo público y devolver propuesta estructurada; publicar cambios exige validación de fuente/versión | `public-light`: GPT‑6 Luna / Qwen3.8 Flash |
| `public-explainer` | Consulta genérica sin hechos ni historial privado, instrucciones del sistema y material público verificado | Texto/JSON, sin recuperación de expediente, correos, archivos locales o herramientas remotas | `public-light`: GPT‑6 Luna / Qwen3.8 Flash |
| `public-legal-researcher` | Pregunta pública y pasajes oficiales/versionados de una biblioteca pública | Recuperación pública local acotada; citas verificables y abstención; sin lectura de asuntos o acciones externas | `public-evidence`: GPT‑6.1 Terra / Gemini 3.8 Flash |
| Cálculo, horas/tarifas, hash, ámbito, recuperación exacta y validación de exportación | Datos que el servicio ya maneja localmente | Herramientas deterministas locales | Sin LLM para decidir/escribir sus resultados |

No hay herencia automática de herramientas del asistente principal. Un agente público no puede invocar un subagente con permisos del asunto, usar una memoria compartida privada o convertir resultados de herramientas privadas en «públicos». La selección de pasajes también puede revelar la pregunta/estrategia de un cliente; material legal de acceso público no hace pública la consulta que lo eligió.

## Prueba de entrada pública, no una etiqueta del prompt

Antes de enviar, el constructor local futuro debe comprobar **todo**: instrucciones, pregunta, historial incluido, nombres de archivo, schema, metadata, fuentes seleccionadas y resultados de herramientas. Procedencia confiable procede de la aplicación/catálogo autorizado, con IDs y versiones verificables; no de un `public:true`, URL escrita por el modelo o una instrucción de documento. Si un elemento proviene de un asunto o de su derivado, la solicitud no pertenece a estos perfiles públicos. Rechazar, mantener local o regresar al flujo privado autorizado; no reclasificar automáticamente ni hacer fallback público.

Las primeras tareas de catálogo pueden ser generadas desde fuentes públicas registradas sin texto libre del expediente. Para preguntas genéricas escritas por una persona no basta una casilla: hay que resolver el tratamiento de contenido y la procedencia del sobre, y bloquear la ambigüedad. Seudonimizar hechos privados no los convierte en públicos. H4b/H5b/H6/H7 conservan las puertas necesarias.

Los jobs públicos tendrán una identidad/tipo de contexto propio y verificado al integrarse. No introducir un asunto público compartido que absorba chats legacy o salte la tupla exacta H2. El diseño de ese tipo y de su almacenamiento es parte de H6/H7; esta configuración no concede ámbitos ni modifica H2.

## Lista corta y precios observados

Consulta pública sin clave a [catálogo OpenRouter](https://openrouter.ai/api/v1/models) y sus endpoints. Se observaron 464 entradas, entre ellas variantes/servicios que no son candidatos de texto; el conteo no significa calidad o elegibilidad. Se guardó un [extracto reproducible](../../eval/public-agents/catalog-snapshot-2026-11-09.json) de los cuatro modelos y endpoints propuestos, con hashes de las respuestas fuente. El extracto no es una firma del proveedor ni una garantía de frescura.

| Perfil | ID de modelo del catálogo | Canonical observado | Endpoint observado propuesto | USD/1M entrada / salida |
| --- | --- | --- | --- | --- |
| Ligero | `openai/gpt-6-luna` | `openai/gpt-6-luna-20260922` | `openai` | 0,10 / 0,50 |
| Ligero | `qwen/qwen3.8-flash` | `qwen/qwen3.8-flash-20260826` | `alibaba/us-east-1` | 0,15 / 0,47 |
| Evidencia | `openai/gpt-6.1-terra` | `openai/gpt-6.1-terra-20261026` | `openai` | 1,00 / 5,00 |
| Evidencia | `google/gemini-3.8-flash` | `google/gemini-3.8-flash-20260902` | `google-ai-studio` | 0,75 / 3,75 |

Fuentes directas: [Luna](https://openrouter.ai/openai/gpt-6-luna), [Qwen Flash](https://openrouter.ai/qwen/qwen3.8-flash), [Terra](https://openrouter.ai/openai/gpt-6.1-terra), [Gemini Flash](https://openrouter.ai/google/gemini-3.8-flash). Se eligieron por disponibilidad declarada, capacidad JSON y niveles de coste, para contrastar familias distintas. Los nombres/comercialización no demuestran español jurídico, seguimiento de instrucciones, precisión de citas o coste por tarea aceptada. El orden del array no asigna prioridad y `activeCandidateKey` es null.

El catálogo agregado y un endpoint pueden tener precios distintos. Para Gemini se observó 0,825/4,125 en el catálogo y 0,75/3,75 en el endpoint elegido; se conservan ambas cotizaciones. No aplicar otra vez un descuento indicado en metadata ni asumir que la promoción continuará. Con 2.000 tokens de entrada y 500 de salida, solo los dos cargos básicos del endpoint darían respectivamente USD 0,00045; 0,000535; 0,0045; 0,003375. Son escenarios aritméticos, no factura/coste total: faltan razonamiento facturado cuando aplique, caches, extras/tier, errores/reintentos, jueces, impuestos/comisiones y respuestas rechazadas.

La ventana comercial grande no amplía el límite actual de la app: el perfil conserva 7.000 unidades UTF-16 de entrada. UTF-16 no es conteo de tokens; cotizar tokens reales antes de reservar gasto. Precios y endpoint/capacidades se vuelven a consultar antes de una evaluación real y antes del piloto. Los límites por contexto/overrides de precio siguen en el snapshot; no usar la tarifa corta en otra banda.

## Antes de elegir o activar

1. Comparar cada par sobre los mismos casos, contexto y límites; registrar IDs exactos/canonical, endpoint efectivo, parámetros, calidad, latencia y consumo. No sustituir un modelo agotado por otro en el mismo resultado.
2. Verificar cómo fijar realmente el endpoint/modelo/revisión. El `canonical_slug` observado no acredita por sí solo que un alias quede inmóvil al generar. Los slugs base pueden cubrir variantes del proveedor: examinar y probar el enrutamiento, sin anunciar pin exacto por copiar `only:['openai']`. Usar `allow_fallbacks:false`, parámetros requeridos y controles del [routing oficial](https://openrouter.ai/docs/guides/routing/provider-selection), y comprobar respuesta efectiva antes de cerrar H6.
3. Revisar la política actual del proveedor **y** del agregador, así como caches, retención de seguridad y herramientas: [políticas OpenRouter](https://openrouter.ai/docs/guides/privacy/provider-logging). Esta entrega no atesta retención/ZDR ni habilita herramientas remotas/plugins. Datos públicos tampoco autorizan envíos de hechos privados.
4. Contar con acceso de producto autorizado y presupuesto explícito aplicable. La clave PSF no es una clave del producto. Estado actual: OpenRouter tiene credencial, pero no confirmación gratuita vigente para la clave efectiva; no se reactivó ni se compró uso. Las tarifas de la tabla describen rutas potencialmente pagadas, no llamadas ejecutadas gratis.
5. Exigir comparación ciega, verificación determinista de estructura/citas/fechas y revisión profesional para calidad jurídica. Ganar un test de JSON no valida derecho mexicano ni autoriza piloto. Perfil ligero no ejecuta acciones; el de evidencia no reemplaza la firma/revisión del abogado.

Protocolo concreto y 28 casos sintéticos de preparación: [eval/public-agents](../../eval/public-agents/README.md). No se usa el examen retenido del detector ni ejemplos de clientes para elegir estos LLM. La selección final quedará en un ADR posterior con evidencia, consumo por respuesta aceptada y límites; por ahora permanecen cuatro candidatos y dos perfiles.

## Verificación de esta entrega

`check-public-agent-candidates.mjs` solo contrasta forma/configuración inactiva, inventario real y cotizaciones/capacidades contra el extracto guardado. No autentica publicaciones remotas ni detecta contenido privado. No contiene transporte, lector de expedientes o función de autorizar/activar. Los tests cubren mutaciones de configuración/evidencia y casos del protocolo; no son una ejecución de los LLM.

La selección se incorpora como preparación M1 solicitada por el dueño. No marca H6/H8 hechos ni cambia el motor actual. El registro de QA consigna pruebas/revisión y lo no medido. Se mantiene LEX AI como identidad en la interfaz; estos nombres son procedencia técnica interna.
