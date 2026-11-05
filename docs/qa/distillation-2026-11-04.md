# Destilación para el modelo ligero — 2026-11-04

El dueño autorizó empezar la capa 4 del plan («ya tengo la cuenta de pago, empieza con el plan») con su cuenta de pago de Kimi. Objetivo: que el modelo de 2B aprenda **cómo** usar la evidencia y conversar, con ejemplos escritos por un modelo grande. No memorizar leyes.

## Cómo se generan los ejemplos

1. **Semillas** (`scripts/distill/seeds.mjs`): Kimi K3 redacta conversaciones sintéticas en 6 tipos: artículo concreto, situación cotidiana, faltan hechos, abstención, seguimiento y charla. Solo nombra leyes permitidas. Se descarta cualquier semilla que comparta 3 o más palabras distintivas con un caso del examen ciego.
2. **Generación** (`scripts/distill/generate.mjs`): el servicio real de LEX AI ejecuta cada semilla, con la recuperación, el router, las instrucciones, el historial y el esquema JSON reales, pero con el maestro en lugar del modelo pequeño. El maestro recibe exactamente lo que vería el 2B, más unas reglas de calidad: subsunción directa, no inventar consecuencias, pedir los datos que faltan y abstenerse con honestidad.
3. **Filtro**: se conserva un ejemplo solo si los validadores de producción lo aceptan completo (`source-checked` sin párrafos descartados, o conversación válida) y si todas las fuentes de su prompt son de leyes permitidas.
4. **Conjunto** (`scripts/distill/build-dataset.mjs`): formato MLX `{"messages":[…]}`. Se eliminan duplicados, se vuelve a comprobar la política de leyes y la de casos retenidos, y se reserva un 5 % para validación, por semilla completa.

## Separación de la evaluación

- **Leyes selladas (W1)**, excluidas del entrenamiento incluso como distractores: CPEUM, CCF, CNPCF, CNPP, LFT, CCOM, CFF, LAMP, LFPA y LSS. También se excluyen las leyes de validación RAFT y todo lo que no sea `split: train`. Quedan 231 leyes permitidas.
- **Examen ciego** `eval/dialogue/cases.jsonl`: sus 36 casos usan esas leyes selladas, así que miden si el comportamiento aprendido con otras leyes se transfiere.

## Seguridad del maestro

Kimi Code CLI 2.5.0 (paquete npm oficial `@moonshot-ai/kimi-code`) se ejecuta con el perfil `scripts/distill/kimi-textonly.md` (`tools: []`) en un directorio temporal vacío. Prueba trampa: pedirle `ls ~` y `touch ~/canario-kimi.txt`. Se negó y el archivo no se creó. Solo recibe texto sintético o legislación pública; se bloquea cualquier encargo que parezca contener una credencial.

## Piloto (7 semillas, 11 turnos)

Se aceptaron 6 de 11. Calidad del maestro: buena. Explica en lenguaje claro, dice «la disposición citada no especifica…» cuando la cita no responde y pregunta datos concretos. Los rechazos destaparon 3 fallos del producto, ya corregidos en `5d193b6`:
- «más corto» volvía a buscar y no reutilizaba las fuentes;
- «dame un ejemplo» no se reconocía como seguimiento;
- un nombre de ley genérico («Ley General de Pesca…») se enviaba al chat.

## Estado

- Escala objetivo: unas 1.700 semillas (440 artículo, 480 situación, 220 faltan hechos, 140 abstención, 260 seguimiento, 160 charla) para unos 1.300 ejemplos aceptados. La mezcla sigue la recomendación de Gemini (charla en torno al 15–20 %).
- Siguiente: LoRA con `mlx_lm.lora` sobre la base `artifacts/training/qwen-base-2b-4bit` (rango 8, `--mask-prompt`, `--grad-checkpoint`), con la base preservada.
- Para medir en el formato de la app hay que fusionar, convertir a GGUF Q4_K_M e importar en un Ollama aislado. Ollama 0.40.6 rechaza los adaptadores sueltos. **llama.cpp no está instalado**: se pedirá aprobación antes de instalarlo.
- Ningún candidato se activa en la app sin ganar al modelo base en el examen ciego (juez de doble orden) y sin aprobación humana.
