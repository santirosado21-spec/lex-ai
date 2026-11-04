# Paneles de Word, Excel y SharePoint

El instalador 0.4.6 incluye el paquete de complementos. [Instalación por equipo y por sitio](../../integrations/LEEME.md). El elemento web de SharePoint se compila con SPFx 1.24.1. La organización controla su instalación en el catálogo.

En Configuración, la persona selecciona un asunto y solicita un código de un solo uso. El escritorio verifica ese asunto antes de habilitar el puente HTTPS en loopback. El código vence en un minuto y el token de sesión en quince. La revocación elimina tokens y códigos del asunto. Para SharePoint, la vinculación exige el origen HTTPS exacto del sitio autorizado. La página local limita el enmarcado a ese origen y comprueba el origen y la ventana de los mensajes de selección. El componente ofrece una ventana auxiliar cuando el navegador restringe el iframe de localhost.

Cada panel puede recuperar los últimos veinte turnos, consultar al asistente local y guardar borradores editados por versión. Una selección se previsualiza antes de importarla como documento de texto del asunto. Las consultas usan el mismo historial y recuperación que el escritorio. Los botones de inserción requieren un gesto en Word o Excel. Word conserva control de cambios y Excel limita la inserción a una celda vacía con formato de texto. Las tablas extraídas se escriben en una hoja nueva.

El servicio recibe peticiones de datos desde su propio origen y deriva el asunto del token. Expone operaciones concretas para hilo, preguntas, selección y borradores. El panel carece de rutas para enviar correo o aprobar acciones. La página de SharePoint recibe solicitudes de selección y devuelve ese fragmento al origen local. Las respuestas y credenciales del puente permanecen en el panel local.

Las pruebas reproducibles incluyen un recorrido HTTPS con dos asuntos y revocación en tests/office-https.test.mjs. scripts/ui-office-smoke.mjs usa Chromium, interfaces de host simuladas y generación sintética. Permite distinguir fallos del panel de los que dependen del cliente Microsoft 365, del certificado y de la política del tenant.
