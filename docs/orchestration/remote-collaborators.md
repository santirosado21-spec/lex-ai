# Opciones remotas en dsystem

Implementación del encargo del dueño del 2026-11-03: Groq, OpenRouter, Hugging Face y Mistral. Codex conserva coordinación, diseño, implementación principal, decisiones e integración. El objetivo es obtener aportaciones verificables, aunque haya cuotas; no se llama a todos por rutina.

El helper `scripts/dsystem/remote.mjs` usa Node 22 y APIs HTTPS oficiales, sin dependencias ni acceso automático al repositorio. Se puede ejecutar desde cualquier carpeta mediante `dsystem` en este Mac; desde el repositorio también funciona `npm run dsystem -- ...` o `node scripts/dsystem/remote.mjs ...`. No se incorpora al servidor, al frontend ni al modelo de producto.

## Roles y accesos

| Proveedor | Cuándo aporta | Acceso gratuito que se debe comprobar |
|---|---|---|
| Groq | Análisis rápido, hipótesis técnicas y casos de prueba | Cuenta/organización en Free, sin Developer ni cobro por uso |
| OpenRouter | Una revisión independiente con un modelo explícito | Modelo :free, catálogo con todos los precios cero; sin modelos alternativos |
| Hugging Face | Ensayos puntuales de otro modelo o especialista | Cuenta gratuita sin saldo comprado, recargas ni claves BYOK; solo créditos incluidos. También traspaso web a Playground o Space ZeroGPU revisado |
| Mistral | Revisión de código y alternativas de implementación | Studio en Free mode; si no está disponible, usar el traspaso web Vibe dentro de la cuota incluida |

**Grok es distinto de Groq.** Grok en Cursor y Grok Bot continúa como acceso existente; no sirve para autenticar `api.groq.com`. El dueño ya declaró cuentas de Hugging Face y OpenRouter. Eso no demuestra que haya un token instalado ni que la inferencia esté habilitada. DeepSeek Harness es otra app detectada, con acceso y cuota independientes.

## Grok/xAI: preparación de la clave, 2026-11-04

Se preparó el proveedor independiente `grok`, con variable `XAI_API_KEY` y catálogo `https://api.x.ai/v1/models`, a partir del nombre inicialmente indicado. El dueño después aclaró que su clave es de **Groq**. Se corrigió la asignación privada de `grok` a `groq`, conservando los permisos 600, sin imprimir la clave ni sobrescribir una clave Groq distinta. No hay credencial guardada para Grok/xAI. No se buscaron credenciales en otras apps o carpetas.

La consulta autenticada `dsystem models groq` respondió correctamente y devolvió **11 entradas** en esa comprobación; incluyen modelos de chat, audio y protección, y no acreditan cuota restante o plan Free. El dueño después confirmó que no paga en Groq; se registró `enable groq --free-account-confirmed` para su clave efectiva, sin modificar la cuenta del proveedor ni comprar crédito. Para la clave del dueño usar `dsystem status` y `dsystem models groq`; los comandos `grok` siguientes describen únicamente la preparación opcional de xAI.

**Primera inferencia real de Groq, 2026-11-04:** encargo revisado de tres casos conversacionales con nombres y situaciones completamente ficticios. Modelo solicitado y observado `openai/gpt-oss-120b`; **354 tokens de entrada + 293 de salida = 647**, **861 ms** de petición de generación (no incluye consulta de catálogo). Respondió sin herramientas y con terminación completa. No se transmitieron expedientes ni código privado, no se descargó el modelo y no cambió el runtime local de LEX AI. La cuota restante y la facturación remota no fueron auditadas.

Codex revisó la propuesta: saludo y cambio de tema sirven como ejemplos iniciales, pero el caso de memoria no comprueba el aislamiento del chat B y la suposición de memoria por sesión no sustituye el contrato de hilos persistentes del producto. Se conserva como propuesta de desarrollo, sin afirmar pruebas ejecutadas ni una mejora del asistente. Paquete y revisión local en `artifacts/dsystem/2026-11-04/`. No se convocó a otros modelos. El dueño también declara acceso pagado a Grok mediante Cursor; no equivale a una credencial xAI ni activa su API.

```sh
dsystem key grok
dsystem status
dsystem models grok
```

El primer comando pide la clave con entrada oculta y la guarda fuera del proyecto, en la configuración privada ya descrita abajo. El catálogo requiere esa clave; no genera respuestas. `handoff grok` y `ask grok ... --dry-run` preparan/validan texto localmente sin enviarlo.

La [guía oficial de xAI](https://docs.x.ai/developers/quickstart) distingue la creación de una clave de cargar créditos; la [API tiene precios por uso](https://docs.x.ai/developers/pricing). Tener clave, Grok Bot o una suscripción web no prueba cuota API gratuita. Bajo la instrucción vigente de no consumir servicios de pago, `ask grok` está bloqueado antes de contactar la API, y `enable grok --free-account-confirmed` tampoco lo activa. La integración de inferencia xAI queda pendiente de verificar condiciones de la cuenta y contar con autorización de consumo aplicable; este cambio solo prepara credenciales, catálogo y encargos locales, sin transporte de generación habilitado.

Su rol propuesto en dsystem es criticar planes técnicos y preparar casos sintéticos de evaluación. Se mantienen revisión del contexto, prohibición de datos de clientes y separación del runtime de producto. Los expedientes, recuperación e inferencia de LEX AI siguen siendo locales.

Verificación de esta ampliación: **19/19 pruebas dirigidas PASS** en `tests/dsystem-remote.test.mjs`, con transporte simulado; incluyen endpoint xAI separado de Groq, bloqueo de generación incluso con declaración gratuita, rechazo de activación por CLI y detección de claves `xai-` en encargos. No hubo consulta autenticada ni inferencia real xAI. Las cifras del apartado de entrega original del 3 de noviembre conservan su fecha y alcance.

## Activación de cuentas

No se encontraron claves en las variables oficiales consultadas ni en la configuración dsystem. La inicialización crea archivos **vacíos e inactivos** fuera del repositorio, en `~/.config/dsystem/`, con directorio privado y archivos de permisos 600.

```sh
dsystem status
dsystem key openrouter
dsystem key huggingface
dsystem key groq
dsystem key mistral
```

Cada comando `key` pide la clave con entrada oculta en una terminal interactiva. No pasar claves por argumentos, chat, comandos guardados ni archivos del proyecto. Las fuentes son [Groq Keys](https://console.groq.com/keys), [OpenRouter Keys](https://openrouter.ai/settings/keys), [Hugging Face Tokens](https://huggingface.co/settings/tokens) y [Mistral Studio](https://console.mistral.ai/api-keys). En Hugging Face se necesita permiso de inferencia con Inference Providers; no conceder escritura sobre repositorios por esta tarea.

Después de comprobar en la consola que **esa cuenta/organización y clave** solo pueden consumir su cuota gratuita, sin recargas ni saldo comprado, registrar la comprobación:

```sh
dsystem enable openrouter --free-account-confirmed
dsystem enable huggingface --free-account-confirmed
dsystem enable groq --free-account-confirmed
dsystem enable mistral --free-account-confirmed
```

Habilitar únicamente los proveedores efectivamente comprobados. `enable` registra una declaración del operador ligada a la huella de la clave; **no consulta ni audita facturación**. Un cambio de clave invalida esa declaración. Las variables `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `HF_TOKEN` y `MISTRAL_API_KEY`, si existen, tienen prioridad sobre el archivo. La misma comprobación debe corresponder a la clave efectiva.

El helper no compra ni activa servicios y detiene errores 401/402/403/429 sin reintentos. El modo Free y la ausencia de facturación se controlan en la cuenta del proveedor; un límite local de tokens no garantiza coste cero en una cuenta de pago. Para bloquear un acceso: `dsystem disable huggingface` (análogo para los otros).

## Encargos

Usar [remote-request.example.json](remote-request.example.json) como ejemplo sintético. Preparar un JSON propio con `task`, `context`, `acceptance`, `dataClass`, `reviewedForExternal` y `skills` (cada skill con `source` y `guidance`). Codex debe haber revisado ese texto para envío externo. La declaración y el detector básico de claves **no son un anonimizador**. No incluir expedientes, correos privados, secretos ni datos de clientes. No hay adjuntos, lectura de carpetas o inclusión automática de archivos.

```sh
dsystem models openrouter
dsystem models huggingface
dsystem models groq
dsystem models mistral
```

Consultar el catálogo no ejecuta inferencia. Los de Groq/Mistral requieren clave. Elegir un ID concreto de la salida; no se fija un modelo por su fama ni se oculta una sustitución. Hugging Face muestra rutas completas `organización/modelo:proveedor`, y requiere seleccionar una.

```sh
dsystem ask openrouter --model 'ID_EXACTO_DEL_CATALOGO:free' --request docs/orchestration/remote-request.example.json --dry-run
dsystem ask openrouter --model 'ID_EXACTO_DEL_CATALOGO:free' --request docs/orchestration/remote-request.example.json
dsystem handoff mistral --request docs/orchestration/remote-request.example.json
```

Los mismos comandos `ask` y `handoff` funcionan con los cuatro nombres. Reemplazar el ID de ejemplo; no es un modelo real. `--dry-run` valida localmente y nunca consulta la red. `handoff` genera prompt y URL web, **sin abrir ni enviar nada**; permite usar una cuenta web sin suponer acceso API. El traspaso a un Space de terceros requiere revisar su procedencia y sus condiciones antes de transmitir el contexto.

La consulta API comprueba el catálogo actual y envía una sola petición de texto, máximo 800 tokens de salida y 45 segundos por petición HTTP. No transmite herramientas, ejecuta código, aplica respuestas, reintenta, cambia proveedor ni usa fallback de pago. OpenRouter añade restricciones de precio cero y sin fallback. En Hugging Face el proveedor se fija en el ID de ruta; no se permite `:auto`, `:cheapest` o `:preferred`. Claude y Anthropic están excluidos por la instrucción de este proyecto.

La salida identifica proveedor, modelo solicitado/observado, demora y tokens reportados. Se rechazan respuestas vacías, truncadas o con llamadas a herramientas. El helper no guarda prompts, respuestas ni logs por su cuenta. Una respuesta sigue siendo una propuesta: Codex debe contrastarla y ejecutar las pruebas necesarias antes de integrarla.

## Comprobación y límites de esta entrega

- **18/18 pruebas dirigidas PASS** del transporte, límites, precios, errores, credenciales, permisos y traspasos en `tests/dsystem-remote.test.mjs`; usan respuestas simuladas identificadas como tales. La suite completa `npm test` pasó **369/369**, sin omitidas; log en `/tmp/lex-dsystem-tests-20261103.log`. No se reconstruyó ni reinstaló la app por este cambio de herramientas de desarrollo.
- Consulta real y sin credenciales de los catálogos públicos de OpenRouter y Hugging Face: ambos respondieron HTTP 200. La consulta inicial observó 14 entradas OpenRouter :free con prompt/completion cero; no es una promesa de disponibilidad futura. Hugging Face no anunció rutas `is_free: true` en esa consulta; los créditos incluidos y ZeroGPU son accesos separados.
- No hubo inferencia autenticada ni comparación de calidad real: faltan claves y comprobación de las cuentas. No se activaron las cuatro por el mero hecho de instalar los conectores.
- No se compraron créditos, instalaron CLIs de proveedores, crearon cuentas ni descargaron modelos. La app LEX AI mantiene inferencia local.

Verificación final desde el helper instalado: **14** modelos permitidos de OpenRouter y **126** modelos/**247** rutas de Hugging Face en ese instante; cuatro dry-runs y cuatro traspasos locales generados, cero envíos de inferencia. Artefactos en `artifacts/dsystem/2026-11-03/` (ignorados por Git): estado sin valores de claves, catálogos y paquetes sintéticos.

El comando global quedó instalado como enlace a este helper. Se comprobó la entrada oculta de claves mediante una pseudoterminal y una credencial ficticia en una carpeta temporal: sin eco, permisos 600 y cuenta inactiva. El primer arnés de esa comprobación quedó leyendo EOF y fue detenido; se corrigió su condición de salida y la comprobación pasó, sin cambiar el helper ni introducir claves reales. El validador de skill falló inicialmente porque el Python de sistema no tenía PyYAML; se ejecutó con el entorno Python ya existente `.venv-training` y devolvió `Skill is valid!`, sin instalar dependencias. Se guardó la skill anterior en `~/.config/dsystem/backups/SKILL.before-remotes.2026-11-03.md` para reversión.

## Fuentes oficiales consultadas

- [Groq: compatibilidad API](https://console.groq.com/docs/openai), [facturación](https://console.groq.com/docs/billing-faqs).
- [OpenRouter: límites y cuenta](https://openrouter.ai/docs/api-reference/limits), [catálogo vivo](https://openrouter.ai/api/v1/models).
- [Hugging Face: chat API](https://huggingface.co/docs/inference-providers/tasks/chat-completion), [créditos y facturación](https://huggingface.co/docs/inference-providers/en/pricing), [ZeroGPU](https://huggingface.co/docs/hub/spaces-zerogpu).
- [Mistral: activar Studio Free y clave API](https://docs.mistral.ai/getting-started/quickstarts/studio/activate-and-generate-api-key), [chat API](https://docs.mistral.ai/api/endpoint/chat), [Vibe](https://docs.mistral.ai/vibe).

Skill dsystem consultada por Codex; actualizada junto con su referencia de colaboradores remotos. Para el cambio de skill se aplicó `/Users/santiagorosado/.codex/skills/.system/skill-creator/SKILL.md`. No participaron modelos externos en la implementación; los catálogos son evidencia de conectividad, no entregas de modelos.

## OpenRouter: activación, 2026-11-04

El dueño guardó su clave con `dsystem key openrouter`. Al preguntarle si la cuenta era gratuita respondió que tiene **3 centavos de saldo** y pidió usar solo modelos gratuitos. Se activó con `--free-account-confirmed` por decisión del dueño, **sin que la cuenta tenga saldo cero**. Lo que impide un cobro es el código: `dsystem ask` solo acepta modelos `:free` con precios cero verificados en el catálogo, envía `max_price` en cero y `allow_fallbacks: false`. No se recarga saldo ni se autoriza ningún modelo de pago.

Primera prueba real con texto sintético: `google/gemma-4-31b-it:free` y, una vez cada uno, `google/gemma-4-26b-a4b-it:free` respondieron **HTTP 429** (límite de uso). Sin reintentos. Puede ser congestión del proveedor o el límite diario de las cuentas con poco saldo. No acredita que OpenRouter funcione: el asiento queda configurado en `dsf` como obrero (`OPENROUTER_MODEL` en `scripts/dsystem/sf.mjs`) pero sin respuesta exitosa verificada. Repetir la prueba más tarde, no en bucle.
