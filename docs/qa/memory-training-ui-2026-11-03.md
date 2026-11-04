# Memoria, entrenamiento e interfaz — 2026-11-03

El dueño autorizó liberar memoria, continuar el entrenamiento y mejorar la interfaz reduciendo consumo. Sólo datos públicos/sintéticos; no se activó ningún candidato ni se cambió la instalación.

## Recuperación de recursos

Se comprobaron procesos, memoria del sistema y modelos de Ollama: no había modelos cargados. Se cerraron normalmente Chrome, Claude y Wispr Flow; Claude volvió a aparecer posteriormente, por lo que no se afirma que permaneciera cerrado. El entorno que sostiene esta conversación y sus editores se preservaron. No se descartaron cambios de documentos ni se borraron archivos de usuario.

Se detuvieron mediante SIGTERM seis brokers huérfanos de sesiones antiguas: estaban sin padre, sin actividad de CPU, con listener ya eliminado y sin clientes externos conectados; las tres conexiones anónimas correspondían al transporte del hijo. También se cerró el servidor de desarrollo huérfano del proyecto, cuyo manejador libera sus recursos. No se usó SIGKILL. La comprobación posterior confirmó la salida de esos procesos. Se preservaron servicios cuyo estado no se pudo demostrar inicialmente; sus diagnósticos están guardados. No se cerraron procesos por su nombre de forma indiscriminada.

La memoria disponible observada subió de aproximadamente **6,1 a 9,8 GiB** antes de cargar otra vez pesos; osciló durante la limpieza y no se presupone un margen estable de 10 GiB. El piloto corregido observó 8,42 GiB al prepararse. `purge` fue rechazado por permisos; no se escaló ni se alteró la configuración del sistema. La medición sigue siendo la de la receta (`vm_stat`: libre + inactiva, sin memoria comprimida), no un valor simulado.

También se cerró normalmente otra copia de LEX AI que se había abierto desde el instalador 0.4.2, sin leer expedientes; el texto no enviado quedó conservado localmente en `/tmp/lex-ai-unsent-draft-20261103.txt` (permiso 0600). Chrome volvió a abrirse y finalmente se cerró por su menú normal. Se detuvo Ollama global después de comprobar que no tenía modelos cargados; el entrenamiento MLX no depende de ese servicio. No se ejecuta localllm en paralelo con este trabajo. Se desmontó el instalador inactivo de Flow; no se forzó el desmontaje de un volumen ocupado.

Se cerró además un `next dev` inactivo de vídeo: no tenía conexiones TCP abiertas y no se modificaron sus fuentes. Para reiniciarlo, desde `/Users/santiagorosado/Desktop/VIDEO EDITING/motion`, ejecutar `node node_modules/.bin/next dev -p 3000`. El editor y la conversación principal permanecen abiertos. No se tocaron servicios del sistema cuya actividad o estado no se pudo demostrar.

Evidencia local: [artifacts/memory-training-20261103](../../artifacts/memory-training-20261103/), con mediciones, procesos y decisiones de limpieza. Los PIDs son históricos y deben comprobarse de nuevo antes de señalarlos.

## Perfil de entrenamiento reducido

Se utiliza el presupuesto configurable de la receta, reduciendo realmente el límite del asignador MLX, sin aplicar una guarda menor a una corrida que conserve la asignación anterior:

| Recurso | Perfil original | Ensayo de 4 GiB, rechazado | Perfil optimizado vigente |
|---|---:|---:|---:|
| Presupuesto MLX | 8 GiB | 4 GiB | **7 GiB** |
| Mínimo disponible para iniciar | 10 GiB | 6 GiB | **9 GiB** |
| Reserva mínima durante la ejecución | 2 GiB | 2 GiB | **2 GiB** |

Se mantienen modelo base de cuatro bits, rango LoRA 16, 24 bloques, dataset 5.000/200, exclusiones, máscaras de asistente, contexto y verificaciones de procedencia. El perfil nuevo crea una firma/checkpoint propios y no se presenta como continuación compatible con los checkpoints de otro presupuesto. La reserva y el pico observado se comprueban durante la ejecución. **El presupuesto del asignador MLX no garantiza un techo instantáneo:** los intentos siguientes excedieron lo solicitado y la guarda detuvo la ejecución antes de actualizar pesos. No se falsificó disponibilidad ni se desactivó la guarda.

Primer comando ejecutado, conservado como intento fallido:

```sh
.venv-training/bin/python scripts/qwen-training/raft_train.py --run --steps 10 --memory-gib 4 --min-free-gib 6 --reserve-gib 2 --wall-seconds 600 --output artifacts/raft/pilot-memory4g-20261103
```

El primer intento evaluó los 200 ejemplos de desarrollo: pérdida de validación **2,0111138069**, pico MLX **2.361.956.436 bytes**, base intacta y **cero pasos de optimización**. Falló por `CustomKernel` sin VJP: la receta usaba `model.eval()` también para actualizar pesos. El [código oficial de MLX-LM](https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/models/qwen3_5.py) y la versión instalada eligen la recurrencia diferenciable mediante el modo de entrenamiento. Se corrigió la receta para usar ese modo al calcular gradientes y el modo de inferencia sólo al validar; dropout sigue en cero.

Se añadió una comprobación real de backward antes de la validación costosa. Su primera versión detectó otra limitación del SDK instalado: el kernel SDPA para secuencias muy cortas tampoco produce el dato necesario para VJP. Ese segundo fallo se conserva en `pilot-memory4g-gradient-v2-20261103`. El probe corregido usa **128 posiciones de entrada sintéticas**, sin actualización del optimizador ni truncamiento del dataset. Dos pruebas Metal reales, sin pesos del modelo, reproducen/previenen los fallos de recurrencia y atención. Pasaron **2/2**; las pruebas RAFT pasaron **26/26**. Los scripts de ensamblado y sus hashes quedaron idénticos al manifiesto: no se regeneraron datos ni se relajó su auditoría.

El primer backward completo del perfil de 4 GiB llegó a **6,77 GiB** y se detuvo, con cero actualizaciones. Una espera antigua (`start-when-memory-free.sh`) se activó cuando hubo 10 GiB y ejecutó la receta corregida con el perfil original 8/10; también se detuvo antes de actualizar, con pico de **8,44 GiB**. Ambos fallos y bases intactas están conservados. La espera antigua terminó; no se mantuvieron entrenamientos duplicados ni se adoptó su resultado como éxito.

El diagnóstico llevó a dos cambios de memoria, sin recortar diálogos ni reducir capas entrenables: proyección/pérdida por bloques de 16 posiciones supervisadas, y rematerialización de estados recurrentes por bloques de 32 posiciones. El estado conserva su gradiente entre bloques. La adaptación recurrente se instala sólo en el proceso de entrenamiento; la inferencia conserva la ruta oficial y no se modificó la biblioteca instalada. Cuatro pruebas reales verifican kernels, pérdida/gradientes, máscara, cola incompleta, repetición de cabezas y gradientes a través del estado final. La proyección se compara en CPU a 1e-5 y en Metal con tolerancia explícita por redondeo al cambiar el tamaño del GEMM; no se afirma identidad bit a bit.

La ejecución optimizada con presupuesto de 4 GiB (`pilot-memory4g-gradient-v4-20261103`) redujo el pico del backward completo a **4,48 GiB**, frente a 6,77 del intento anterior comparable. Seguía excediendo cuatro, así que se detuvo y quedó preservada. Un microbatch posterior llegó a **6,15 GiB** en el ensayo de seis, todavía con cero actualizaciones. La medición motivó el perfil vigente de **7 GiB de presupuesto + 2 GiB de reserva**, con guarda de inicio de nueve. El supervisor espera 9,5 GiB antes de lanzar para dar margen a la preparación; la receta vuelve a comprobar los nueve antes de cargar pesos. No se presenta un presupuesto inferior al pico como un éxito.

El piloto `pilot-memory7g-gradient-v6-20261103` **completó y verificó dos pasos reales**. Se adoptó ese checkpoint, sin volver a entrenarlo, para una continuación local separada de la sesión; el supervisor está guardado en `artifacts/memory-training-20261103/continue_training.py`. Puede continuar hasta **1.250 pasos** con los mismos parámetros y firma, guardando cortes en 25, 100, 200 y siguientes centenas. Cada fase tiene un límite de tiempo; la espera de recursos puede durar hasta 16 horas, sin cargar pesos ni llamar modelos externos. Un fallo del entrenamiento detiene la cadena **sin reintentos automáticos**. `caffeinate` se limita al PID de entrenamiento durante la fase activa. El estado vivo está en [pipeline-state.json](../../artifacts/memory-training-20261103/pipeline-state.json); distingue espera de memoria de entrenamiento efectivo. Los supervisores anteriores están conservados y no siguen activos.

## Resultado real del piloto

- Estado final: `TRAINED_EXPERIMENTAL_NOT_LEGALLY_VALIDATED`.
- **2 actualizaciones**, ocho microbatches y 751 tokens supervisados en total; no es una época completa.
- Pérdidas de entrenamiento de los dos batches: **3,203339 / 2,977097**; son batches distintos, no una comparación de calidad.
- Validación en los mismos 200 ejemplos de desarrollo: **2,011099 → 1,920204**.
- Pico MLX: **7.454.543.834 bytes (6,94 GiB)**, dentro del presupuesto de siete; no se presenta como un modelo que entrena con cuatro.
- Base en disco intacta: `baseFilesModified: []`.
- [Checkpoint de paso 2](../../artifacts/raft/pilot-memory7g-gradient-v6-20261103/checkpoint-0000002/checkpoint.json) verificado con hashes de adaptadores, Adam, RNG y configuración; `nextMicrobatch: 8`.
- Candidato inactivo; no hay comparación semántica/profesional ni validación física de 8 GB. Una bajada de pérdida no acredita precisión jurídica.

Al corte, la continuación está **esperando recursos**, no actualizando pesos. El supervisor exige 9,5 GiB antes de lanzar y la receta vuelve a comprobar nueve. Conserva el checkpoint mientras espera y no exige otra llamada a Codex para arrancar. No se afirma que ya estén completos los pasos posteriores ni los 1.250 previstos.

Tomar el lock o iniciar un proceso no equivale a completar pasos; consultar las métricas/checkpoints efectivos. No hay promoción automática. El presupuesto de MLX no corresponde al consumo total del proceso. La medición en esta Mac de 24 GB no valida entrenamiento o uso de producto en hardware físico de 8 GB.

## Interfaz y comprobaciones

Claude Opus 5.5 implementó el indicador del compositor en sus dos archivos asignados. Desde 3.200 caracteres muestra un contador; un dictado de más de 4.000 se conserva completo, explica el exceso y marca el campo con `aria-invalid`. El lector de pantalla recibe el cambio de estado, sin anunciar un contador nuevo en cada pulsación. Codex adaptó los colores a los tokens del tema elegido en la app, para que no dependan sólo del tema del sistema.

Codex añadió `scripts/ui-prompt-limit-smoke.mjs`: usa audio y transcripción sintéticos con UI/API reales, sin micrófono ni inferencia. Comprueba un dictado de **4.401 caracteres**, bloqueo explicable del envío, ausencia de recorte, corrección posterior, temas claro/oscuro, ancho de 320 px y ausencia de envío automático. Se inspeccionó visualmente la captura oscura.

También se corrigió el smoke de conversación: al faltar deliberadamente la biblioteca/índice, una navegación debe abstenerse, en lugar de exigir una cita del artículo anterior. No se relajó la validación de citas del producto.

- `npm run build`: correcto.
- `npm test`: **346/346**, cero fallos/omitidas.
- `.venv-training/bin/python scripts/raft/test_raft.py`: **26/26**.
- `.venv-training/bin/python scripts/qwen-training/test_raft_kernels.py`: **4/4** (Metal real, sin pesos base).
- `node scripts/ui-prompt-limit-smoke.mjs`: correcto.
- `node scripts/ui-conversation-smoke.mjs`: correcto, con inferencia explícitamente simulada.

## Consumo y continuidad

Se aplicó dsystem y se consultó la skill frontend-design para la intervención acotada. Una llamada a Claude terminó correctamente y reportó Opus 5.5 como modelo principal; también registró una llamada auxiliar Haiku del CLI. El contexto automático cargado fue mayor de lo previsto: sus contadores reales se guardaron en `model-usage-review.json`. No son un porcentaje de cuota restante ni un cobro de suscripción verificado. No se repitió la delegación; antes de otra hay que aislar herramientas/MCP y contexto de arranque por llamada.

No se invocaron Gemini ni localllm en este ciclo: la crítica de continuidad ya existía y cargar otro modelo local competiría con el entrenamiento. Los logs y métricas permanecen en disco para continuar con comandos deterministas y resúmenes pequeños.
