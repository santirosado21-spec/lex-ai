# Decisiones — LEX AI

Solo se añade al final. Cada decisión lleva su motivo para que otro agente no la deshaga sin saber por qué. Usa `dmem decide`.

## 2026-11-05 09:07 — claude — Revisión de Cursor (Grok) al validador: 2 arreglos, 2 decisiones de no cambiar

**Por qué:** Arreglados y probados: (1) el número del artículo citado respaldaba cualquier cifra igual a ese número ('dentro de 47 días'); ahora solo respalda la frase 'artículo N'. (2) 'uno' se normalizaba a 1 y respaldaba un '1' inventado; 'uno' sale de la tabla de cardinales. NO cambiado: (3) un párrafo de charla con una afirmación jurídica que el léxico no detecta ('El finiquito incluye las partes proporcionales') se conserva si otro párrafo tiene cita; es un límite del filtro léxico, y endurecerlo con 'menciona ley' haría abstenerse a respuestas legítimas que piden un dato ('si me dices la fecha del despido…'). Pendiente de medir con el examen. (4) Las cifras de la ventana de 600/1200 caracteres de UN artículo público cuentan como respaldo: es deliberado (la ley dice 'veinte' en otra frase del mismo artículo); la ventana no cruza artículos.

## 2026-11-05 14:30 — codex — Dirección híbrida con prioridad ChatGPT

**Por qué:** El dueño acepta trasladar parte del procesamiento a la nube y conservar biblioteca jurídica, habilidades/recursos, expedientes, archivos y horas. Diseñar integración oficial de ChatGPT con contexto mínimo autorizado y almacenamiento/recuperación locales. Elegibilidad comercial de suscripciones y acceso efectivo pendientes; API es alternativa separada. No habilitar gasto ni cargar expedientes reales a partir de esta decisión. Ver docs/architecture/hybrid-private-workspace-2026-11-05.md.

## 2026-11-09 08:31 — codex — Privacidad local y modelos remotos por tarea

**Por qué:** Dirección del dueño del 2026-11-09: pequeño detector local, almacenamiento privado en la computadora y explorar OpenRouter como primera ruta multimodelo. Sustituye la prioridad ChatGPT del 05/11. Respaldos externos cifrados y colaboración compartida son etapas posteriores; protección reversible es seudonimización. No autoriza gasto ni cargas de clientes. Plan y criterios en docs/architecture/hybrid-local-privacy-router-2026-11-09.md.

## 2026-11-09 11:00 — codex — Loop híbrido PSF con revisión y primera integración simulada

**Por qué:** Pedido del dueño: preparar loop de desarrollo y publicarlo en GitHub para Lorenzo y Cordero. Una tarea solo desbloquea dependencias con aceptación, pruebas y revisión registradas; review-pending permite borrador, no integración. Revisión sintética de Kimi incorporada: contratos H1, flujo vertical H3V y reanudación explícita tras diagnóstico. No usar el runner antiguo sin revisión; trabajar en ramas/PR a rescate-0.4.13, sin tocar main.

## 2026-11-09 11:42 — codex — H1 captura un sobre simulado sin modificar el motor activo

**Por qué:** El dueño pidió iniciar H1 y subir al PR existente. Se mantiene createInference de producción intacto y se añade un mock optativo con capture JSON/UTF-8 determinista. Una prueba pareada fija límites reales del contrato y la documentación distingue estos bytes del futuro HTTP. Los puertos de privacidad/almacenamiento solo se proponen: no se adelantan H2 ni H6. Commit de implementación a99bb1f, revisado independientemente y con 437 pruebas/build aprobados.

## 2026-11-09 11:43 — codex — Reservar Astra para código con impacto material

**Por qué:** El dueño pide usar Astra únicamente para código que haga la diferencia. Reservarlo para lógica crítica, integraciones difíciles o defectos persistentes; evitarlo en documentación, resúmenes, boilerplate y revisiones rutinarias. Usar rutas adecuadas de menor costo cuando estén disponibles, sin delegar código entregable o decisiones críticas a pequeños modelos locales. No afirmar cambios de modelo de la sesión sin verificación.

## 2026-11-09 14:03 — codex — H3 usa identificadores opacos para evitar reutilización tras snapshots antiguos

**Por qué:** La revisión independiente reprodujo que contadores restaurados desde una instantánea antigua podían asignar el marcador de Beta a Gamma. Nuevos UUID por entrada y versión mantienen los marcadores importados conocidos pero impiden reutilización accidental al añadir correspondencias. 14 pruebas H3 y reproducción independiente pasan. No autentica snapshots manipulados ni implementa cifrado.

## 2026-11-09 15:54 — codex — SF sin Claude y selección explícita de modelos durante esta etapa

**Por qué:** Orden del dueño 2026-11-09: plan con el resto de SF, sin Claude por el momento. AGENTS actualizado; no invocar Auto ni wrappers sin identidad como evidencia. opinion no fija --model, su primera respuesta queda sin atribución; la consulta Gemini explícita se ejecutó con gemini-3.8-flash-high. Cursor mostró Claude y no recibió texto. Astra reservado a código crítico, no planificación.

## 2026-11-09 16:15 — codex — H4a separa puntuación del detector de egreso y retira el corpus previo a la guía

**Por qué:** Kimi y revisor Sol identificaron que predicciones de spans/blocked no prueban bytes de transporte y que faltaban límites de anotación. Se fijó guía general sin mostrar golds al implementador, cambió identidad/hash de protocolo y se reemplazó entero el primer corpus sin candidato puntuado. El definitivo BERYL de autor separado se liga por hashes a protocolo, guía y declaración exacta de corpus. Scorer deja routingSafety/preservation no evaluadas; H4b requiere H3V con detector real. Límites de recursos son experimentales, sin afirmar Tauri ni8GB físicos.

## 2026-11-09 16:32 — codex — H5a: contrato de bóveda y modelos públicos separados

**Por qué:** ADR 0003 elige SQLCipher Community/rusqlite, Keychain y recuperación age como objetivo condicionado a viabilidad, paridad DAO, temporales y restauración real; aún sin cifrado implementado. H4b puede medir detector contra contratos H5a sin esperar H5b. Las cinco habilidades existentes leen el asunto: los perfiles públicos propuestos son instancias separadas, con procedencia del sobre completo y sin fallback desde datos privados. Cuatro candidatos OpenRouter inactivos; selección final exige evidencia ciega, retención, pin, acceso y presupuesto propios, sin reutilizar claves PSF.

## 2026-11-09 16:57 — codex — No promover reglas fallidas ni equiparar viabilidad SQLCipher con bóveda completa

**Por qué:** H4b.1 ba763a2 fue congelado y puntuado una vez por revisor Sol independiente: 300 casos, precisión exacta 31,52 % y recobrado 56,38 %, gate FAILED. V1 conserva resultados/corpus/umbrales y se retira de afinación/selección futuras; nuevo protocolo/examen independiente debe incluir estímulos operativos de formato/extracción/ambigüedad/fallo, nunca gold como input. El baseline no habilita egreso. H5b.1a c0f3733 prueba núcleo SQLCipher real aislado, pero contrato Node es fixture en memoria y matriz de 32 APIs conserva 3 core, 5 parciales y 24 pendientes con gate false. Completar dominios atómicos y IPC antes de custodia/recuperación/migración. No cambiar almacén activo o abrir H6 por estos cortes.

## 2026-11-09 17:06 — codex — Prioridad cofounders: mínima inferencia local y prueba del producto híbrido

**Por qué:** El dueño confirma al menos 8 GB RAM y quiere un detector local pequeño entrenado/adaptado que reduzca y sustituya datos antes de razonamiento por tarea en nube. Conservar mapas, originales y controles deterministas locales; no usar un LLM conversacional local grande ni iniciar nuevo entrenamiento de chat como solución. Lorenzo y Pedro deben aportar revisión jurídica/experiencia: banco público/sintético separado puede preparar evidencia temprana con acceso/presupuesto autorizados; beta integrada conserva puertas H4/H5/H6/H7. Sistemas de ambos aún no confirmados. El pedido no autoriza clientes, gasto o activación de proveedor.

## 2026-11-09 17:21 — codex — SF de corpus nacional: fuentes oficiales y fábrica pública separada para demo web

**Por qué:** El dueño confirmó luthor.mx/despachos y autorizó Claude para esta investigación, junto a Gemini/Kimi/Cursor y Perplexity si OpenRouter lo permite. Encargos públicos sin herramientas/clientes. Selección provisional Crawlee con descargador LEX y Playwright selectivo; extracción nativa primero, OCRmyPDF/Docling como pruebas separadas. Procesar/indexar corpus público fuera del cliente de 8 GB; backend público y cachés opcionales no autorizan consultas privadas sin política. RAM no equivale a tamaño en disco. Catálogo/descarga/extracción/revisión/indexación son estados distintos; fuente/versiones/fechas y fidelidad textual separadas de validación jurídica. No copiar corpus de competidor o inferir permiso por un repo público. Verificar canales documentados SIDOF y manuales SCJN antes de scraping genérico.

## 2026-11-09 17:42 — codex — Fábrica pública separada y corte C1a federal, C1 parcial

**Por qué:** El dueño reafirma local para privacidad/sustitución/mapa/restitución y nube para trabajo pesado. La adquisición pública se ejecuta fuera del runtime cliente; ensayo acotado no activa infraestructura ni egreso privado. Conservamos 30 plazas: diez PDFs federales adquiridos en C1a y veinte pendientes sin URL; C1 completo no se marca terminado. Texto siempre en cuarentena hasta aceptación textual/jurídica; no afirmar vigencia por extracción. Reutilizar descargador/parser sin instalar crawler adicional hasta medir necesidad. Detalles: docs/architecture/public-corpus-factory-v1.md y QA C0-C1a.

## 2026-11-09 17:48 — codex — Adaptar skills mexicanas por tarea, con procedencia y evaluación separadas

**Por qué:** S-R0 encontró módulos mexicanos útiles, pero prompts/formato SKILL.md no demuestran exactitud, ejecución determinista o permiso de transmisión. Elegir investigación/contratos primero y solo módulos con licencia/dependencias claras; conservar atribución y reemplazar supuestos extranjeros. Softlaw México AGPL no hereda Apache raíz; lawve NC-ND no equivale a material comercial adaptable. Método Consulto abierto no incluye conector/bases de pago. Mapa/originales siguen locales; sanitizar en nube llega tarde. Ver docs/research/cloud-legal-skills-selection-2026-11-09.md. No instalar/conectar o activar proveedor por esta decisión.

## 2026-11-09 18:02 — codex — S1 es preparación offline; estructura y cita no validan análisis ni egreso

**Por qué:** Dos instrucciones y contratos pueden prepararse sin activar el proveedor. Mantener originales/mapas/acceso locales y no importar a rutas activas. DataClass/reviewState y digest no clasifican ni autentican permiso. Un probe de inferencia sin respaldo con cita válida pasó estructura y conservó entailment/precisión no evaluados. S2 necesita aceptación independiente, modelos/budget explícitos y comparación con/sin skill más abogado; no promover por605tests. Los fixtures fueron redactados por SolSF, no generados al ejecutar la habilidad contra candidatos. S1 no amplía M1 ni hereda conectores/licencias restringidas. Ver QA S1.

## 2026-11-09 18:46 — codex — Retirar aceptación S2a y separar diagnóstico de formato de calidad jurídica

**Por qué:** Los casos V1 quedaron confundidos por guía común y V2 ya fue observado/puntuado/desvelado. Conservar freezes y evidencia; no afinar ni seleccionar usando estos casos como nuevo examen. Catorce truncamientos y cinco fallos de citas bajo salida2500/promptJSON no prueban incapacidad general del modelo. S2b debe ensayar formato/anclas/presupuesto en desarrollo y usar nueva aceptación independiente antes de ganador. Una respuesta que pasa criterios incluye contenido adicional no respaldado; no equivale a aprobación jurídica. No ampliar límites M1 ni activar proveedor de producto por este piloto SF.

## 2026-11-09 18:49 — codex — La protección ocurre antes de cualquier subida del archivo privado

**Por qué:** El dueño exige introducir primero información confidencial y que el componente local la sustituya antes del trabajo remoto. Una subida web al servidor para anonimizar allí incumpliría ese orden. Fijar extracción/protección en cliente o servicio local y tratar original, mapa, nombres, historial y metadatos antes del egreso; bloqueo si formato o tratamiento inciertos. Requisito de producto probado primero con sintéticos, sin habilitar datos reales o dar por aprobado detector/cifrado.

## 2026-11-09 19:12 — codex — Ordenar fases sin confundir demo web, bóveda nativa y marca disponible

**Por qué:** El dueño pide plan completo y otra identidad. Mantener privacidad/bóveda y calidad/corpus como frentes paralelos, resolver canal local web antes de implementar paridad que se acople a él y cerrar H4/H5 antes de integración H6/H7 según backlog. S2a no valida privacidad ni justifica ganador. No esperar toda la legislación nacional para subconjunto aprobado de demo, con cobertura explícita. Un buscador sin coincidencia no despeja marca/dominio; Folimbra/Cautria/Citeroa son propuestas creativas, IMPI/fonética/dominios y elección del dueño pendientes. No cambiar aún textos/IDs/paquetes ni borrar historial.

## 2026-11-09 19:36 — codex — Canal local seleccionado y nuevo examen de privacidad separado del candidato

**Por qué:** ADR0004 reutiliza UI servida por loopback del equipo y futura bóvedaRust; no convertir una web pública que recibe originales en procesamiento local. F0/H4b2a y dominio recordatorios probados4ba5262 no activan H4/H5/H6. Protocolo v2 congelado antes de autor independiente300; corpus validado contra bytes/splits y revisión de anotación separada antes de puntuar. Astra candidato solo dev, OSdeniega corpus/scorer/evaluador al proceso; no afinar con heldout. UUID numéricos pueden ser detectados conservadoramente: corregir fixture sin eximir marcadores de origen no comprobado o debilitar gate. Continuar próximas fases por autorización del dueño, no parar tras dos cortes ni declarar aceptaciones externas completas.

## 2026-11-10 12:00 — codex — Atribuir fallos antes de cambiar modelo o relajar gates

**Por qué:** Tres configuraciones de detector no son elegibles. Replay y telemetria invariantes distinguen pérdidas de composición y cobertura; mantener examen300 intacto. Medir causa no autoriza egreso, reparar contra gold o rebajar incertidumbre. Windows también acumula tres fallos reales: investigar entorno con sondas acotadas, no repetir implementaciones o elevar límites sin evidencia.

## 2026-11-10 12:22 — codex — Conservar la vertical H4b.2d abierta

**Por qué:** El plan reserva H4b.2d para repetir H3V con detector elegible. Informes históricos Rampart usaron por error ese ID; mantener bytes/hash y registrar alias canónicos H4b.2b.4/4a evita declarar completa una integración aún pendiente. Composición nueva H4b.2b.4b sigue diagnóstica.

## 2026-11-10 13:40 — codex — Ejecutar nuevas dependencias nativas sólo en VM efímera limpia

**Por qué:** Cuatro probes locales de datos sintéticos probaron file/network deny pero no bloquearon argv/env del helper mediante KERN_PROCARGS2. No se inspeccionaron secretos reales ni se amplían permisos host. Compilar/tests optativos H5/age pasan a macos-15 estándar de GitHub público, entorno vacío, checkout sin credenciales persistidas, código/datos públicos-sintéticos; crypto requiere freeze separado. D0preserva249GETverificados y183archives; presupuesto v2de256HTTP/112nuevos se basó en149deps resueltas, no compras.

## 2026-11-10 14:13 — codex — Ensayos criptográficos representativos sin ampliar límites

**Por qué:** El primer harness age terminó por watchdog71 con perfiltest sin optimizar; la fase exacta se desconoce. Para el segundo experimento explícito se elige optimización2 del perfiltest y marcas finitas, revisadas independientemente, conservando60s/300s/768MiB,guardresets,18casos/R23 yalgoritmo. No rebajar workfactor18 ni aceptar roundtrip sin ambosEOF. Fallo/freeze anteriores inmutables; no ejecución nativa nueva en Mac dueño o retries automáticos.

## 2026-11-10 18:20 — codex — Main es rama experimental de integración para cofundadores

**Por qué:** El dueño autorizó push a main. Se verificó que main anterior 68eb716 era ancestro sin divergencia; la promoción por fast-forward conserva historia y permite colaborar. El producto activo aún usa SQLite sin cifrar y no tiene flujo híbrido validado, por lo que main no equivale a release ni habilita expedientes de clientes. CI de clon limpio tendrá un subconjunto explícito hasta resolver FTS5 y activos generados.

## 2026-11-10 18:29 — codex — V3 Nym no ejecuta modelo hasta cerrar V3-R1 y V3-R2

**Por qué:** Revisión independiente Claude Opus5.5 de fuente pública encontró que content_witness en Python y JS admite huecos de whitespace entre offsets; Codex lo reprodujo con fixture sintético, aunque egreso sigue false. La identidad de venv no cubre pyvenv.cfg/base stdlib. Corregir y revisar ambas condiciones sin modificar evidencia V1/V2, luego congelar nueva ejecución con límites intactos. Cero forwards autorizados en este estado.

## 2026-11-10 18:56 — codex — Credencial OpenRouter de producto separada de PSF

**Por qué:** La cuenta de desarrollo PSF no autoriza el egreso de documentos ni garantiza límites o custodia de producto. H6a exige una credencial exclusiva, almacenada localmente, verificada y sin activar envíos privados hasta superar H4/H5.

## 2026-11-10 20:17 — codex — No relajar ZDR para documentos privados por fallo de ruta gratuita

**Por qué:** La cuenta autenticó, pero el endpoint gratuito rechazó Zero data retention con 404; quitar esa restricción para una prueba ficticia tampoco produjo respuesta (429). H4/H5 siguen pendientes y la autorización sólo cubre datos públicos/sintéticos. Mantener el adaptador de producto apagado y separar diagnóstico sintético de política de egreso privado.

## 2026-11-10 20:21 — codex — Permitir pruebas pagadas ZDR dentro de USD 6, sin activar egreso privado

**Por qué:** El dueño autorizó expresamente USD6 para pruebas. Las rutas gratuitas no completaron una generación, mientras dos rutas pagadas ZDR respondieron con texto ficticio a costo reportado de USD0.000008075. Mantener endpoints exactos, límites de precio y recibos; H4/H5/H7 bloquean documentos reales.

## 2026-11-10 20:29 — codex — Nombre público Rejon.AI; compatibilidad LEX AI preservada

**Por qué:** El dueño fijó Rejon.AI el 10 de noviembre. UI, landing, prompts activos y metadatos visibles adoptan el nombre. Se mantienen IDs de almacenamiento, servicio Keychain, URLs GitHub y el nombre real del DMG anterior para evitar pérdida de datos, clave o descargas engañosas; requieren migración y nuevo build separado.

## 2026-11-10 20:38 — codex — Monograma R de Rejon.AI para app y landing

**Por qué:** El dueño eligió Rejon.AI. Se creó la marca vectorial original en Figma y se usó una misma geometría para SVG, favicon e iconos de escritorio. Los identificadores internos y el instalador anterior conservan compatibilidad hasta contar con migración y build verificado.

## 2026-11-19 11:54 — codex — Guardar los soportes revisados por asunto y verificar la procedencia del documento de práctica

**Por qué:** El abogado necesita consultar el original e insertar un dato después de reabrir la sesión. El expediente cifrado vincula el mapa al despacho y al asunto. Sólo el documento sintético generado por el servidor puede aportar hechos del texto a la solicitud de práctica. El detector todavía pierde información en los controles aduaneros.

## 2026-11-19 12:01 — codex — Elegir fragmentos jurídicos por clave y unir el soporte del asunto después de la respuesta

**Por qué:** Una prueba de copia libre devolvió una cita inexacta de dos. El modelo puede seleccionar entre fragmentos de dos fuentes verificadas y plantear preguntas. El servicio local inserta la cita literal. El documento importado y la línea que motivó la lectura permanecen en el equipo.

## 2026-11-19 12:11 — codex — Anclar las lecturas aduaneras a páginas de una edición y conservar los importes en el equipo

**Por qué:** El PDF de la Ley Aduanera distingue la edición impresa de la reforma posterior. La matriz de trabajo requiere cantidades, monedas, folios y observaciones para las exportaciones. La consulta pública sólo necesita los pasajes oficiales y el tema.

## 2026-11-19 18:07 — codex — Limitar el respaldo automático a rechazos expresos de la cuenta principal

**Por qué:** Para el piloto de Rejon, el mismo sobre se vuelve a autorizar una sola vez con otra clave únicamente ante clave inválida o cuota insuficiente explícitas. Ambos envíos conservan el presupuesto común. Un corte, límite por frecuencia o generación incompleta deja el resultado para revisión y evita repetir el envío.

## 2026-11-19 18:49 — codex — Revisar indicios indirectos con una segunda lectura local y un mapa reversible

**Por qué:** En diez documentos ficticios, el primer análisis cubrió 7 de 11 identificadores indirectos. La segunda lectura selecciona sólo oraciones reales del documento y suma protección sin poder retirar sustituciones previas. Las correcciones del abogado tienen revisión y deshacer. El texto libre importado sigue en este equipo mientras se mide el riesgo residual.

## 2026-11-19 19:00 — codex — Cotejar en el equipo la hipótesis del asunto

**Por qué:** En el piloto de comercio, una consulta pública común por tema cubre las tres hipótesis. El indicio, el folio original, la elección y las ediciones pertenecen al expediente local cifrado. Las descargas del Semanario se conservan en investigación hasta el cotejo.

## 2026-11-19 19:08 — codex — Generar el seguimiento desde las citas del primer borrador

**Por qué:** El abogado conserva sus ediciones privadas y puede pedir una carta o un control interno. La nube recibe el encargo, las citas reconstruidas desde la fuente y los tipos documentales elegidos. Sólo un ejercicio de procedencia comprobada añade sus hechos protegidos. El soporte y la hoja de trabajo se restituyen en el equipo.

## 2026-11-19 19:18 — codex — Distinguir la mención de una fracción del renglón de la tarifa

**Por qué:** Un código también puede aparecer en el texto de otro renglón o en una lista de un decreto. La ficha guarda el PDF y la página seleccionada. Sólo se muestran columnas donde dos extractores coinciden. Los datos de tarifa son los impresos en esa edición.

## 2026-11-19 19:24 — codex — Conservar edición y NICO de dos dígitos al citar y exportar

**Por qué:** Varias opciones comparten fracción. El libro informativo aporta la descripción y su fila. La clave queda reconciliada con el artículo de creación del DOF. Sólo las descripciones literales cotejadas y de longitud suficiente habilitan un seguimiento. El PDF local permite revisar anotaciones y transitorios.

## 2026-11-19 19:37 — codex — Restituir la pregunta original en el equipo y conservar íntegros los pasajes aduaneros delimitados

**Por qué:** Las preguntas del abogado pueden contener identificadores y relaciones privadas. La nube recibe un mensaje reconstruido con fuente pública cotejada, conceptos y enfoque. La respuesta de prueba omitió el final de un inciso. Al citar esa unidad el producto recupera el pasaje completo y la condición del encabezado desde la copia local.

## 2026-11-19 19:47 — codex — Conservar los originales adjuntos por expediente y exigir selección expresa del par documental

**Por qué:** La misma empresa puede tener operaciones distintas. El abogado identifica el par. El sistema conserva los originales cifrados, las líneas y la versión del cotejo. La respuesta pública sobre el mismo tema puede reutilizarse sin enviar identidades ni fragmentos privados.

## 2026-11-19 20:17 — codex — Vincular los hechos de práctica y las fuentes de cada turno sin reenviar la edición privada

**Por qué:** El abogado elige qué hechos verificados hacen falta para su pregunta. El servicio recompone esos hechos y las citas en el equipo para cada turno. Una corrección privada no se convierte en material de nube. Una discrepancia inequívoca del flete se señala también localmente porque el comentario del modelo puede dejarla implícita.

## 2026-11-19 20:34 — codex — Conservar en el equipo la evidencia documental de archivos propios

**Por qué:** Los dos ejercicios verificados pueden enviar líneas elegidas con alias temporales. Los 26 documentos independientes del catálogo dieron 19 de 20 indicios cubiertos y 31 de 32 afirmaciones íntegras. El abogado puede conservar como soporte cualquier línea de sus archivos con referencia local. La ampliación de la salida a expedientes reales sigue pendiente de validación.

## 2026-11-19 20:51 — codex — Seleccionar el periodo del trámite en el equipo a partir de alternativas públicas

**Por qué:** La primera generación pidió comprobar una declaración anterior al hito aplicable. El proveedor recibe las fuentes y las cuatro opciones de redacción; la fecha y la clasificación de la operación permanecen locales. El expediente conserva la lectura temporal para exportarla tras reabrir.

## 2026-11-19 21:02 — codex — Confirmar la mercancía para C1 de Economía y la fecha documental para el cotejo

**Por qué:** La clave C1 tiene usos distintos. Elegir la autoridad no acredita que sean productos del numeral 8 TER. Dos fechas distintas del mismo expediente producen pasos de revisión distintos. El abogado elige el supuesto y la fuente; la ficha y la lista conservan su decisión en el expediente cifrado.

## 2026-11-19 21:12 — codex — Conservar el punto técnico completo y el intervalo documental pendiente

**Por qué:** La excepción del punto 156 de AD_29-24 incluye uso y varias características. Una cita corta puede omitir tolerancias decisivas. La preliminar sólo fija cuatro meses; los tres actos cotejados no resuelven todos los días hasta la definitiva. Se conserva el texto de la fuente y el cotejo temporal local al exportar.

## 2026-11-19 22:41 — codex — Conservar el texto libre del informe en el equipo

**Por qué:** La reserva inédita de seis documentos dejó visible un acontecimiento local. El expediente recupera sus soportes al exportar y sólo ofrece al proveedor pasajes públicos o hechos de práctica verificados.

## 2026-11-19 22:49 — codex — Comprobar cada cita contra el pasaje que le corresponde

**Por qué:** La relación entre dos disposiciones debe conservar la procedencia y las condiciones de cada una. La primera respuesta real devolvió literales de 239 y 394 caracteres. Se admiten hasta 420 por fuente y el seguimiento exige recuperar ambas citas.

## 2026-11-19 22:58 — codex — Conservar referencias documentales dentro de sustituciones más amplias

**Por qué:** Un encabezado cubierto junto con un nombre de cliente ocultaba correctamente el primer folio y lo dejaba sin protección en un seguimiento. El mapa local conserva su identidad dentro del texto ya oculto y reconstruye las referencias rotuladas de expedientes anteriores.

## 2026-11-19 23:05 — codex — Indexar la edición impresa de Ley Aduanera por página

**Por qué:** El índice federal congelado omite esta ley. La navegación usa 277 encabezados del cuerpo y conserva el PDF completo. Las preguntas aceptan únicamente los pasajes cotejados y distinguen la cita del contexto del párrafo primero.

## 2026-11-19 23:14 — codex — Restringir la nueva instrucción local al contexto de retorno

**Por qué:** Aplicarla a todo el corpus redujo de seis a tres los indicios protegidos en doce documentos históricos. La revisión específica mejoró retorno y garantía y el código final mantuvo las cifras de los 38 documentos de regresión. El texto libre de los expedientes continúa en el equipo.
