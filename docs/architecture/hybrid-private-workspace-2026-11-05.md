# LEX AI: espacio jurídico híbrido y control de datos

> Actualización 2026-11-09: la [nueva dirección de privacidad local y modelos por tarea](hybrid-local-privacy-router-2026-11-09.md) sustituye la prioridad de acceso ChatGPT de este documento. Mantiene los controles de datos y continuidad del producto. Este archivo se conserva como antecedente.

Fecha: 2026-11-05. Estado: dirección del dueño y propuesta de arquitectura; integración remota y cifrado pendientes de implementación. Se revisaron código y documentación pública, sin llamadas de inferencia ni envío de documentos del despacho.

## Decisión y continuidad del producto

El dueño acepta trasladar parte del procesamiento a la nube, con prioridad en ChatGPT e interés secundario en Claude. Continúan la biblioteca jurídica nacional, sus fuentes/versiones, habilidades jurídicas, recursos reutilizables, expedientes, archivos y registro de horas. Se interpreta provisionalmente «keys de derecho» como habilidades/recursos jurídicos y «rips» como repositorios o componentes útiles; no se confunden con credenciales ni se presupone una integración específica.

La propuesta conserva el escritorio como espacio de trabajo y usa un proveedor remoto para conversación y razonamiento cuando la tarea y la política del despacho lo permitan. El objetivo de equipos de 8 GB continúa, aunque la conversación remota requiere conexión y cuota. Entrenar un modelo pequeño deja de ser requisito previo para entregar el asistente; las bases, candidatos y evaluaciones existentes se preservan.

El cambio autoriza diseñar esta arquitectura. No equivale a autorizar una carga real de expedientes, contratar servicios, compartir cuentas o activar gasto. La primera prueba será sintética/pública.

## Suscripciones: posibilidades oficiales y límites comprobados

La documentación oficial describe [Sign in with ChatGPT](https://learn.chatgpt.com/docs/sign-in-with-chatgpt): usuarios elegibles pueden autorizar uso de su plan en apps compatibles; la cuota se comparte con el plan. No se ha comprobado elegibilidad de LEX AI ni de la cuenta del dueño.

La [guía para integradores](https://developers.openai.com/siwc/quickstart) distingue identidad de autorización para inferencia. El [flujo abierto/local](https://developers.openai.com/siwc/token-sharing-open-source) remite las aplicaciones de pago o alojadas remotamente a un formulario de interés. Para el producto comercial, confirmar el acceso aplicable antes de prometer esta función. Que el repositorio sea público o la app se ejecute en el equipo no demuestra autorización comercial.

Opciones, en orden de ajuste al pedido:

1. Integración aprobada con el plan propio de cada usuario. Deseable por experiencia y aprovechamiento de la suscripción; disponibilidad pendiente. Nunca reutilizar tokens de Codex/ChatGPT de otra app.
2. API de OpenAI con credenciales del propio despacho, conexión desde el servicio local y medición de consumo. Evita concentrar contenido y secretos de todos los clientes en un servidor de LEX AI. La [documentación de beneficios](https://developers.openai.com/api/docs/guides/chatgpt-api-credits) contempla créditos para suscripciones Pro/Business elegibles, que requieren activación, vencen y tienen límites. Saldo y beneficio del dueño no verificados; no activar compras ni recargas.
3. Plugin/MCP dentro de ChatGPT como experiencia complementaria, si se justifica. La conversación ocurre en ChatGPT y los resultados que recibe salen del equipo. No sustituye automáticamente la experiencia de escritorio ni resuelve permisos, retención o aislamiento. No exponer el sistema de archivos completo.

Claude queda como opción posterior, con verificación independiente de acceso, términos, retención y coste. Su suscripción no se considera credencial API. No se realizó ninguna llamada a Claude.

## Reparto de componentes

| Componente | Propuesta | Situación observada |
| --- | --- | --- |
| Fuentes jurídicas públicas y versiones | Adquisición/actualizaciones públicas; índice local y paquetes opcionales | Existen corpus federal y estatal parcial; expansión nacional pendiente |
| Habilidades y recursos jurídicos | Procedimientos versionados, comprobación de fuentes y herramientas controladas | Existen capacidades y propuesta de adaptación de Legal; no todas integradas |
| Expedientes, originales, notas y memoria | Almacenamiento local cifrado, separación por despacho/asunto | SQLite local con permisos; cifrado de aplicación pendiente |
| Extracción, búsqueda y selección de pasajes | Local; solo asunto autorizado | Existe recuperación local; mantener sus controles en la ruta remota |
| Conversación y razonamiento complejo | Proveedor remoto autorizado con contexto mínimo | El motor de producto inspeccionado es local; adaptador remoto pendiente |
| Horas, tarifas y reportes | Cálculo y persistencia locales | Existen `server/time-billing.mjs`, tablas y `src/TimeBillingView.tsx` |
| Respaldo/sincronización privada | Copia cifrada antes de salir del equipo, opcional | Propuesta; no se verificó ni activó un servicio |

## Flujo de una consulta

1. El usuario abre un chat/asunto. El servicio local comprueba su ámbito y la política de tratamiento.
2. LEX AI recupera los pasajes necesarios y prepara la solicitud: pregunta, historia pertinente, fuentes públicas y fragmentos privados permitidos. Un resumen de un expediente también es información privada.
3. La interfaz muestra el proveedor y el alcance de salida cuando sea relevante. La autorización del asunto puede persistir para tareas dentro de ese alcance; ampliar a otro asunto, otro destino o nuevos datos exige una decisión explícita. El estado visible debe permitir revocarla.
4. Se envía directamente desde el servicio local al proveedor oficial. El navegador/interfaz no recibe la clave. La política se aplica también a reintentos, errores, llamadas de herramientas y seguimiento, no solo al primer mensaje.
5. La respuesta vuelve a LEX AI; se verifican referencias y pasajes, se almacena en el ámbito correspondiente y se permite preparar un borrador/exportación. Una coincidencia textual no demuestra corrección jurídica ni aplicabilidad.

Ejemplo sintético: para revisar responsabilidad, enviar la cláusula pertinente y su contexto necesario en vez del directorio del cliente. Sustituir identificadores por «Cliente A»/«Contraparte B» cuando no afecte el análisis. La correspondencia permanece local. La combinación de hechos, fechas y cantidades puede identificar a una persona incluso sin su nombre: esto es reducción de exposición, no anonimización garantizada.

## Protección propuesta

**Almacenamiento.** Evaluar una solución mantenida de cifrado de base, incluyendo índice de búsqueda, originales, diarios SQLite y temporales. Claves protegidas por el almacén seguro del sistema; bloqueo y recuperación documentados. Cifrar solo los originales mientras los fragmentos siguen en claro sería insuficiente. Los permisos 0700/0600 actuales no equivalen a cifrado. Una copia local de respaldo debe permitir restauración comprobada antes de migrar; conservar reversibilidad y no destruir los originales por una prueba técnica.

**Salida de información.** Políticas por asunto: solo local; nube con contexto reducido; nube con fragmentos privados expresamente permitidos. La reducción automática de datos debe poder revisarse. Las políticas de acceso y de salida se ejecutan en código local, fuera del texto del modelo. Documentos y respuestas son datos, nunca autorizaciones para ampliar acceso. Herramientas con operaciones y argumentos cerrados; sin shell ni lectura arbitraria de rutas.

**Proveedor y credenciales.** Una cuenta/organización por despacho cuando corresponda, mínimo acceso y revocación. Secretos del producto en el almacén seguro del sistema; no copiar las claves de colaboradores de desarrollo. TLS protege el transporte; el proveedor necesita procesar el contexto recibido. No anunciar cifrado de extremo a extremo frente al propio proveedor de inferencia. Los respaldos cifrados con clave exclusiva del despacho son un flujo diferente.

**Retención.** En la API estándar, [OpenAI documenta](https://developers.openai.com/api/docs/guides/your-data) ausencia de entrenamiento con los datos salvo adhesión explícita y registros de abuso normalmente de hasta 30 días, con excepciones. `store:false` reduce almacenamiento de estado, pero no concede Zero Data Retention. ZDR requiere aprobación y tiene límites por función/modelo. Verificar la política efectiva del acceso por suscripción por separado; no trasladarle automáticamente las garantías de una organización API. El primer prototipo usa texto, historial local y funciones locales, sin índices privados alojados en el proveedor.

**Auditoría.** Registrar localmente quién autorizó, ámbito, destino, fecha, categorías de datos, versión de política, resultado y consumo disponible. Los logs operativos y reportes de errores no deben contener prompts, archivos, secretos ni respuestas privadas. Probar revocación y aislamiento con dos despachos y dos asuntos sintéticos.

## Promesa comercial y costes

Propuesta: «Tus expedientes permanecen bajo el control de tu despacho. LEX AI utiliza únicamente el contexto autorizado para asistirte con IA y te permite decidir qué información se envía al proveedor».

La licencia puede cobrar por biblioteca mantenida, organización de expedientes, habilidades, control de horas y experiencia integrada. El uso de IA depende del plan conectado o del consumo API contratado. Mostrar cuotas y consumo cuando el proveedor los exponga; no prometer razonamiento remoto ilimitado ni márgenes sin medición. Al agotarse la cuota, archivos, búsqueda y horas siguen disponibles. No cambiar de proveedor, activar recargas o enviar a un modelo gratuito sin la política y autorización correspondientes.

## Orden de entrega y aceptación

1. **Acceso oficial:** comprobar elegibilidad comercial de Sign in with ChatGPT. Preparar la alternativa API por despacho sin activar gasto. No enviar formularios ni contratar planes desde este análisis.
2. **Prueba sintética:** conversación y revisión jurídica con la misma recuperación local, historial delimitado y fuentes verificables. Comparar utilidad/citas con el motor actual; medir latencia, consumo y fallos. No reutilizar casos retenidos para entrenar.
3. **Control de salida:** revisar exactamente qué bytes salen, bloquear destinos/ámbitos no autorizados, impedir filtración por herramientas y verificar revocación. Probar desconexión, falta de cuota y error de proveedor sin repetir información a otro destino.
4. **Cifrado:** migración recuperable de una copia sintética, índices y temporales protegidos, bloqueo y restauración de backup. Verificar en macOS y en las plataformas realmente soportadas; no extrapolar la Mac de desarrollo a equipos de 8 GB.
5. **Piloto:** solo después de verificar el tratamiento contractual y técnico del proveedor elegido, con autorización del despacho para el alcance concreto. Medir fidelidad jurídica y utilidad conversacional, además de pruebas técnicas.

Próxima entrega de ingeniería: adaptador de inferencia desacoplado del proveedor y construcción local de solicitudes con política de salida. Esta propuesta no lo declara implementado. Tampoco declara cifrado, cobertura nacional o seguridad comercial validados.
