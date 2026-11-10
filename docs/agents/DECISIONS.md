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
