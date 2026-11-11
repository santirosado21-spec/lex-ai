# LEX AI: transición a privacidad local e inteligencia por tarea

Fecha: 2026-11-09. Dirección del dueño registrada; diseño para implementación. No describe funciones ya entregadas. Pedro y Lorenzo ya tienen el repositorio, según el dueño.

## Decisión de producto

LEX AI conserva expedientes, originales, búsqueda, memoria de chats, biblioteca jurídica, recursos y horas. Un modelo pequeño local ayuda a detectar información sensible. La conversación, redacción y análisis pueden ejecutarse en modelos remotos elegidos por tarea, después de aplicar una política local de salida. El objetivo de equipos de 8 GB sigue vigente.

OpenRouter es la primera opción a explorar para ese acceso multimodelo. Esta prioridad sustituye la dependencia previa de comprobar primero la integración de suscripciones ChatGPT; dicha integración puede evaluarse después. Elegir modelos exige medir calidad, privacidad y costo, no declarar un ganador por marca.

La sesión autoriza diseño y desarrollo con datos públicos/sintéticos. No activa facturación, recargas, credenciales de producción ni tratamiento remoto de clientes. Los conectores PSF de desarrollo siguen separados del producto.

## Recorrido propuesto

```mermaid
flowchart LR
    A[Documento y pregunta] --> B[Almacenamiento y recuperación locales]
    B --> C[Detección y sustitución local de datos]
    C --> D[Comprobación de salida y política del asunto]
    D --> E[Selección de modelo y proveedor permitidos]
    E --> F[OpenRouter e inferencia remota]
    F --> G[Validación y restitución locales]
    G --> H[Respuesta y borrador en el expediente]
```

Es un flujo a construir. La correspondencia entre identidad y sustituto permanece local y nunca forma parte de la solicitud. El modelo propone detecciones; código local controla permisos, persistencia y envío. Un documento no puede autorizar nuevas herramientas ni destinos.

### Entrada confidencial primero — aclaración del dueño

El usuario introduce el documento y la pregunta originales en su equipo; no tiene que sustituir datos a mano para que el producto funcione. La capa local extrae y detecta información sensible, conserva las correspondencias y prepara contexto mínimo con sustitutos consistentes. Solo después de comprobar el sobre completo y la política se entrega ese contexto a agentes de nube. Al regresar, se valida la respuesta y se restituyen localmente los marcadores autorizados del mismo asunto; cualquier turno posterior vuelve a proteger el texto restituido.

En la **demo web**, seleccionar/arrastrar un archivo debe leerlo en el navegador o servicio local autorizado. El original, texto extraído, mapa, nombre y metadatos privados no se suben primero al backend, almacenamiento, OCR, telemetría o logs remotos para protegerlos después. La extracción/OCR de documentos privados debe ser local; si un formato no puede tratarse de forma fiable, se bloquea su salida. La fábrica del corpus jurídico público es un flujo distinto.

Se sustituye o minimiza información sensible; no se altera indiscriminadamente todo el documento. Fechas, importes y relaciones con relevancia jurídica necesitan un tratamiento que preserve significado o una revisión/bloqueo cuando no pueda lograrse bajo la política. El objetivo de cobertura completa exige medición; no prometer que cambiar nombres elimina toda posibilidad de identificación.

La aceptación vertical empieza con un contrato **ficticio que contiene identificadores y hechos sensibles**, pasa por detección real local, sobre capturado, respuesta y restitución, y termina con un seguimiento que se protege de nuevo. Debe mostrar también bloqueo ante omisión detectable/incertidumbre/formato no soportado, aislamiento de asuntos y ausencia de originales/mapa en tráfico o logs. Primero transporte simulado; una corrida remota sintética posterior exige los gates y acceso correspondientes. S2a evalúa skills con inputs públicos/sintéticos preparados y no prueba este recorrido. Detector elegible, bóveda/recuperación e integración web completa siguen pendientes.

## Almacenamiento: comenzar en la computadora

| Modalidad | Primera versión | Condiciones |
| --- | --- | --- |
| Computadora del usuario | Almacén principal recomendado | Cifrado, bloqueo y recuperación comprobables; aislamiento por despacho/asunto |
| Disco externo | Respaldo cifrado posterior | Copia consistente, restauración y manejo de desconexión; no mover la base activa por defecto |
| Drive del director o directora | Respaldo cifrado opcional posterior | Cifrar antes de sincronizar, definir acceso y custodia de claves; no sincronizar una SQLite activa entre usuarios |
| Equipo o servidor del despacho | Trabajo compartido futuro | Servicio con autenticación, permisos, concurrencia y auditoría; una carpeta compartida no implementa esos controles |

El modelo no guarda documentos por sí mismo: el servicio de almacenamiento lo hace. El dueño debe poder recuperar originales y correspondencias tras perder la computadora. Keychain puede proteger claves de uso local, pero hace falta un mecanismo de recuperación que no dependa exclusivamente del equipo perdido. Un respaldo cifrado solo cuenta como funcional después de restaurarlo en otro entorno autorizado. Si la app está cerrada o bloqueada, no debería dejar índices, diarios o temporales privados en claro.

## Seudonimización y preservación del contenido jurídico

Si podemos restituir nombres, el tratamiento es reversible: usar el término técnico seudonimización y explicar sus límites al venderlo. Quitar nombres no garantiza que los hechos dejen de identificar a alguien.

Combinar patrones verificables para identificadores y un detector local para nombres, entidades y contexto. Cubrir nombres, RFC/CURP, cuentas/CLABE, teléfonos, correos, domicilios, firmas, identificadores de expediente y datos sensibles. Revisar también nombres de archivos, metadatos, comentarios, historial y resultados de herramientas; no solo el cuerpo del último mensaje. Imágenes, escaneos y formatos sin extracción fiable quedan bloqueados para salida hasta contar con tratamiento local probado.

Usar sustitutos estables dentro del asunto, por ejemplo `PERSONA_01`, con espacios de nombres separados entre asuntos/despachos. Las correspondencias deben cifrarse. La persistencia entre sesiones requiere versión y vínculo con el documento. No emplear sustitución global ingenua al restituir: aceptar únicamente marcadores válidos del ámbito actual y señalar los desconocidos. Con streaming, esperar a tener un marcador completo antes de mostrarlo. Volver a proteger cualquier respuesta restituida que se incluya en una consulta posterior.

Fechas, importes, parentescos, ubicaciones y números de expediente pueden identificar y también determinar el resultado jurídico. No cambiarlos silenciosamente. Si son necesarios y la política impide enviarlos, pedir una revisión del contexto o mantener esa tarea local. Una confianza alta del detector no demuestra ausencia de filtraciones.

La puerta de salida procesa la solicitud completa serializada, incluidos historial, fuentes y herramientas. Si falla la extracción, el detector o la política, bloquea el envío. Para asuntos especialmente sensibles debe existir modo solo local. Mostrar una vista del contexto saliente cuando se necesite revisión y recordar autorizaciones delimitadas y revocables, sin exigir confirmación en cada turno del mismo alcance.

## Modelos por tarea y control de consumo

| Trabajo | Ruta propuesta | Evaluación requerida |
| --- | --- | --- |
| Detección de datos y sustitución | Detector pequeño local más reglas | Omisiones, falsos positivos, relaciones entre entidades y memoria/latencia en 8 GB |
| Búsqueda, cálculo, fechas y horas | Herramientas locales deterministas | Exactitud y aislamiento; IA solo interpreta la petición |
| Conversación, resumen y borrador sencillo | Modelo remoto económico aprobado | Español, seguimiento de instrucciones, fidelidad y costo por tarea aceptada |
| Análisis jurídico complejo | Modelo remoto de mayor capacidad aprobado | Citas oficiales, jurisdicción, hechos, abstención y revisión profesional |

Empezar con dos perfiles remotos y un detector local. No elegir modelos concretos todavía: falta evaluación. Escalar por tipo de tarea y resultados verificables; la confianza declarada por un modelo no basta. Mantener proveedores/modelos versionados y autorizados, con presupuesto por tarea y despacho. Si la ruta permitida falla, informar; no enviar a otro destino automáticamente.

OpenRouter separa modelo y proveedor de inferencia. Su [documentación de enrutamiento](https://openrouter.ai/docs/guides/routing/provider-selection) ofrece listas permitidas, desactivación de fallbacks, filtros de datos y límites de precio por token. `zdr:true` requiere revisar además la configuración de Safety Retention; no garantiza por sí solo la política más estricta. Un límite de tarifa por token no es un presupuesto total. Propuesta: lista cerrada de endpoints, fallbacks desactivados, parámetros exigidos y política de retención comprobada antes del piloto.

La [política de proveedores](https://openrouter.ai/docs/guides/privacy/provider-logging) distingue entrenamiento, retención y servicios de herramientas externos. Revisar también el tratamiento del propio OpenRouter. El primer adaptador enviará solo texto preparado localmente y no habilitará herramientas remotas ni carga de archivos originales.

Según la [tarifa publicada consultada hoy](https://openrouter.ai/pricing), Standard cobra 5,5 % al comprar créditos y Business 8 %; la inferencia se cobra a la tarifa del proveedor. No asumir que agregar un intermediario abarata el mismo modelo. El ahorro se busca usando rutas económicas en tareas que las toleren y reduciendo contexto. Revalidar precios y condiciones antes de contratar.

Medir entrada, salida, razonamiento facturado, reintentos, tarifa efectiva, latencia y respuesta aceptada. Comparar con acceso directo antes de decidir la economía comercial. No hay medición ni cotización mensual todavía. El plan de producto necesita límites explícitos; no ofrecer IA remota ilimitada.

Para el primer piloto, proponer credencial propia del despacho, protegida por el almacén seguro del sistema y usada desde el servicio local. Si LEX AI vende consumo incluido, hará falta un servicio propio con autenticación, cuotas y secretos de servidor; nunca distribuir una clave maestra dentro de la app. El modelo de cobro sigue siendo una decisión pendiente, no una integración activada.

## Plan de trabajo para el equipo

Estos son frentes propuestos, sin asignación personal ni cambios de runtime en esta sesión. Crear ramas desde `rescate-0.4.13`; no usar `main`, que despliega la landing.

1. **Contrato de privacidad y evaluación.** Corpus sintético independiente con identificadores mexicanos, ambigüedades, hechos reidentificables, historial y dos asuntos/despachos. Definir política de salida, revisión y criterios de bloqueo antes de conectar una red real.
2. **Protección local.** Detector, correspondencias, cifrado recuperable y prueba de restauración. No reutilizar el modelo conversacional como detector validado sin medirlo.
3. **Prototipo de salida sin red.** Constructor de solicitudes y transporte simulado que capture los bytes exactos. Probar bloqueo ante fallo, aislamiento, inyección en documentos, revocación, seguimiento y restitución sin contaminación entre asuntos.
4. **Adaptador OpenRouter desactivado por defecto.** Separarlo de `scripts/dsystem/remote.mjs`. Reutilizar el contrato de generación donde sea viable sin sustituir indiscriminadamente la instancia local: conversación, propuestas proactivas y otras generaciones necesitan la misma puerta de salida.
5. **Comparación pública/sintética.** Solo con acceso autorizado y presupuesto definido. Comparación ciega de dos rutas sobre las mismas tareas, calidad jurídica/conversacional, omisiones del detector, costo y latencia. Registrar modelo/proveedor efectivamente usados. No activar por ganar una prueba técnica.
6. **Piloto del despacho.** Después de comprobar cifrado, restauración, política efectiva del proveedor, controles de gasto y autorización para los datos concretos. Backups externos y colaboración multiusuario son entregas posteriores.

Puntos observados en el repo: `server/main.mjs` construye el motor e inicia automáticamente el local en escritorio; `server/inference.mjs` implementa el runtime local; `server/service.mjs`, `server/conversation.mjs` y `server/proactive-drafts.mjs` usan generación; `server/store.mjs` almacena originales, fragmentos e índice SQLite con permisos restringidos. El código inspeccionado no demuestra cifrado de aplicación ni integración remota del producto. La transición debe cubrir todas las rutas de generación, manteniendo biblioteca y recuperación por asunto.

## Evidencia de esta sesión

Verificado: lectura de los puntos de código anteriores, arquitectura previa, memoria y onboarding; consulta de fuentes oficiales de OpenRouter. No se ejecutaron inferencias, benchmark del detector, pruebas de restauración ni cambios de runtime. No se eligió un modelo ganador, se activó facturación, se enviaron documentos o se publicó el trabajo. La implementación y validación siguen pendientes.
