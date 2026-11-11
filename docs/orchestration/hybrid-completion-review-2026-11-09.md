# Aportaciones SF al plan de terminación

Fecha: 2026-11-09. Coordinador: Codex/Sol. Objetivo: revisar el plan H3V–H9 con la fábrica disponible, sin asignar tareas a Claude. Paquete autocontenido público/sintético, sin repositorio adjunto, datos de clientes o credenciales. Las consultas son opiniones o apoyo textual; no ejecutaron implementación ni pruebas del producto.

**Plan resultante:** [hybrid-completion-plan-2026-11-09.md](hybrid-completion-plan-2026-11-09.md). **Paquete revisado:** [hybrid-completion-review-request.json](hybrid-completion-review-request.json). Las respuestas originales quedan localmente en `artifacts/sf/hybrid-completion-2026-11-09/`, ignoradas por Git. Esta síntesis es la evidencia publicable; no se publican logs de cuentas.

## Participación y cantidades reales

| Ruta | Cantidad | Resultado/identidad | Uso en el plan |
| --- | --- | --- | --- |
| Gemini explícito mediante `agy --model gemini-3.8-flash-high` | 1 consulta, 1 turno informado | Modelo elegido del catálogo `agy models`; respuesta SUCCESS en 22,96 s de proceso (21,13 s informados por CLI). La salida no repite un ID efectivo de modelo | Objeciones sobre contratos, RAM temprana, legacy y alcance mínimo |
| Kimi mediante perfil sin herramientas | 1 consulta | Solicitado `kimi-code/k3.1-pro`; respondió en 37,47 s. El wrapper no atesta versión efectiva | Concurrencia, procedencia de derivados, fallos de migración y vertical offline temprana |
| Groq, obrero | 1 consulta | Solicitado `openai/gpt-oss-120b`; respondió en 3,26 s; declaración Free vigente para clave efectiva. SF conserva la respuesta, no el ID efectivo/usage devueltos por el helper | Casos candidatos de presupuesto/fallos; descartados umbrales y decisiones no fundamentados |
| Gemma local, obrero mediante `localllm` | 1 consulta | Respondió en 14,15 s. El panel no conservó stderr con el ID elegido por el helper ni tokens | Extracción de términos ambiguos y datos faltantes; sin voto |
| Primera ruta `opinion` rotulada Gemini en SF | 1 consulta adicional | Respondió en 32,43 s, pero `opinion` no fija `--model` ni devuelve atestación de identidad. No se cuenta como contribución Gemini verificada | Se descartó la atribución de modelo; se hizo la consulta explícita anterior, no una sustitución silenciosa |
| Cursor | 0 consultas de generación | Se generó handoff local. UI mostró This Mac y **Claude Opus 5.5 Medium**; no se envió texto. No se logró abrir nueva consulta: control terminó en `noWindowsAvailable` | Pendiente; no se atribuye una revisión a Grok |
| Codex principal | Esta sesión, sin subagentes | Modelo actual `gpt-6.1-sol` según entorno | Inspección de fuentes/código, plan, síntesis, decisiones, comprobaciones y memoria |
| Astra / Claude | 0 encargos por identificador en este plan | Astra reservado para código crítico futuro; Claude excluido de los encargos | No se usaron para escribir o revisar este plan |

En total: **5 respuestas de generación** (4 rutas con atribución explícita o helper identificado y 1 respuesta adicional sin identidad atestada); **0 encargos enviados desde Cursor**. No se contabiliza un handoff como consulta ejecutada. El resultado de una ruta sin identidad no permite asegurar qué modelo atendió esa llamada; por eso queda separado y no acredita cumplimiento de selección por sí solo. Para próximos encargos Gemini usar selección explícita; no reutilizar `opinion` como prueba de identidad.

**Consumo medido disponible:** la consulta Gemini explícita informó 8.127 tokens de entrada, 2.196 de salida y 10.323 totales; informó además 1.650 de pensamiento (no sumarlos otra vez al total). Los demás wrappers de esta ejecución no conservaron tokens. Coste y cuota restante desconocidos. Tiempos no son un benchmark comparativo: rutas, modelos y contexto difieren. No se compró uso adicional.

## Accesos que no se habilitaron

`sf seats` informa rutas configuradas, no cuota garantizada. `remote status` mostró Groq con credencial presente y declaración Free vigente; OpenRouter con credencial presente pero confirmación gratuita **no vigente** para la clave efectiva; HF/Mistral sin credencial. No se habilitaron, buscaron ni imprimieron claves. La autorización histórica de OpenRouter no sustituye la comprobación de la credencial efectiva actual.

DeepSeek Harness sigue siendo una opción de escritorio sin acceso/cuota/procedencia actual comprobados. Copilot CLI 1.0.105 está instalado; solo se consultaron versión/ayuda, no se le envió contexto ni se asumió un modelo por defecto. No se convocaron rutas adicionales sin una aportación necesaria. Las cantidades anteriores corresponden a esta planificación, no a H2/H3 ni a consultas históricas.

## Síntesis y decisiones del coordinador

| Aporte | Disposición | Aplicación o razón |
| --- | --- | --- |
| Kimi y Gemini explícito: resolver chats generales/legacy antes de H7 | Aceptado | Contrato H3V: sin ámbito completo siguen locales, sin wildcard/asunto compartido; H7 implementa asociación explícita |
| Kimi: concurrencia y versiones desde H3V | Aceptado | Un escritor por asunto y verificación de versión antes de mostrar/guardar; no sobrescribir ámbito activo con snapshot antiguo; intercalados negativos |
| Kimi: derivados deben heredar restricciones | Aceptado | H4a distingue procedencia comprobable de detección y cubre importación, recuperación, historial/resúmenes/FTS/resultados/borradores |
| Kimi: cortes de energía, disco lleno, restauración parcial y escrituras posteriores | Aceptado | H5b exige protocolo de fallos, restauración limpia y manifiesto/versiones consistentes |
| Kimi: vertical de app temprana y más pequeña | Aceptado con límite | H3V compone primero; H7 empieza con asunto nuevo/formato admitido/una generación en app antes de ampliar matriz. No sustituir el objetivo completo por un demo público |
| Gemini explícito: H4b depende del contrato/inventario H5a | Aceptado | Se mantiene paralelismo de preparación, pero cierre/mediciones del detector dependen de contratos congelados; revalidar si H5b altera la serialización |
| Gemini explícito: RAM se evalúa demasiado tarde | Aceptado | Base en H4a/H5a, parada cuantitativa en protocolo previo al heldout; medición compuesta y equipo físico de 8 GB antes de afirmar ese requisito |
| Gemini explícito: ejemplo de límite 400 MB | No adoptado como requisito | No hay medición ni justificación para esa cifra; límites se fijan contra consumo base y margen del sistema antes del examen |
| Gemini explícito: quedarse solo público/sintético con reglas | Adoptado como primera entrega, no como meta final | Evita activar privados antes de H4/H5/H8b, pero el dueño requiere detector local y posibilidad remota por tarea; evaluar reglas vs reglas+modelo, no eliminar el objetivo por opinión |
| Primera respuesta `opinion`: posible vulneración legal automática y OOM asegurado | Excluido como conclusión | Modelo no atestado; además no hay fuentes jurídicas ni medición de memoria que sostengan esas afirmaciones. El plan conserva revisión del tratamiento y mediciones, sin dictamen legal inventado |
| Groq: ensayar presupuesto cero/credencial inválida | Aceptado como casos candidatos | H6 bloquea antes de enviar ante presupuesto agotado; prueba de credencial se simula separada |
| Groq: 200 ms restore; 150/80 ms detector; 1 GB; 5 hilos/2 s | Rechazado como umbrales | Números sin medición ni protocolo; mezcla snapshots en memoria con caída de proceso y no cubre el runtime completo |
| Groq: habilitar WAL y usar HTTP 401 para presupuesto | Rechazado | `server/store.mjs` usa journal DELETE; WAL no es requisito automático ni solución de cifrado. Presupuesto es categoría propia, no autenticación |
| Gemma: «clasificador confiable», «procedencia», «evidencia oficial», «presupuesto» y rúbrica sin definir | Aceptado tras contraste | Definidos en H4a, H6 y H8a; obrero no concede permisos ni decide arquitectura |

Las coincidencias de Kimi y Gemini son señal para revisar, no votación que autoriza privacidad. Codex decidió tras contrastar código, requisitos del dueño y documentación oficial.

## Fuentes y verificación de esta entrega

Se leyeron PSF y sus referencias, instrucciones/estado/backlog/contratos H1–H3, guías de colaboradores y EGM para estructura de brief/borrador/resolución. El pedido actual ya fija alcance y solicita la participación SF; se produjo un plan completo con síntesis, sin ejecutar las macros interactivas de aprobación por sección de EGM ni atribuirles aprobación humana.

Fuentes técnicas primarias consultadas para acotar decisiones, no para prometer integración:

- [Zetetic: diseño SQLCipher](https://www.zetetic.net/sqlcipher/design/): compilación propia, tratamiento de diarios y necesidad de configurar temporales; se propuso spike/ADR, no una dependencia ya instalada.
- [OpenRouter: routing](https://openrouter.ai/docs/guides/routing/provider-selection) y [políticas de proveedores](https://openrouter.ai/docs/guides/privacy/provider-logging): selección de endpoints, fallbacks y distinción entre tratamiento del agregador/proveedores.
- [Apple: APIs Keychain en macOS](https://developer.apple.com/documentation/technotes/tn3137-on-mac-keychains): referencia oficial para el spike de custodia; no se verificó una recuperación de claves en esta sesión.

Comprobado localmente: estado Git y archivos ajenos, puntos reales de generación y almacenamiento, configuración de rutas sin secretos, respuestas/estado de cada consulta, plan y enlaces locales. Validación documental: JSON parseado, enlaces locales y fences Markdown comprobados; CLI `remote ask ... --dry-run` confirmó `sent:false` (6.072 caracteres). Un intento inicial de importar el helper mediante `node -` falló en su guard de entrada (`realpath` sobre `-`); se validó por el CLI documentado, sin modificar código. `git diff --check` correcto; commit se registra en memoria. No se ejecutaron pruebas nuevas del producto ni se cambió código runtime; los 467 tests corresponden al cierre H3 anterior. El plan no demuestra detector, cifrado, restauración, calidad remota o funcionamiento en 8 GB.
