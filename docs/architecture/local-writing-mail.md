# Escritos versionados, Mail local y proactividad

Las respuestas originales del asistente permanecen inmutables. `reply-drafts.mjs` crea una instantánea de texto, citas y validación original; cada edición/restauración añade una versión independiente. El hash del original detecta modificaciones posteriores de procedencia y `expectedVersion` evita sobrescribir cambios de otra ventana. Al guardar, la conversación de escritorio y `office.history` muestran la versión editada con una etiqueta de versión. Los turnos posteriores la reciben como contexto no confiable; el original permanece disponible en el editor y nunca se sobrescribe. Una edición no hereda la comprobación de citas: el DOCX añade un aviso explícito y conserva las fuentes originales. El editor sirve para respuestas conversacionales, investigación pública general y respuestas de asunto.

Los registros viven en SQLite local bajo despacho y asunto. Se reutiliza el almacén `records`, sin migración destructiva. Los tipos nuevos son `reply-draft`, `reply-draft-version`, `email-connection`, `email-proposal`, `proactive-rule` y `proactive-job`. Las propuestas y sus estados se auditan por identificador; el registro de auditoría no incorpora cuerpos de correo ni documentos.

## Mail

La conexión usa las cuentas ya configuradas y habilitadas en Apple Mail. No almacena contraseñas ni claves OAuth ni crea un servicio de nube. Apple documenta Mail como aplicación automatizable; se verificaron `account`, `email addresses`, `outgoing message`, `sender`, destinatarios y el comando `send` contra `/System/Applications/Mail.app/Contents/Resources/Mail.sdef`. Véase [automatizar tareas en Mail](https://support.apple.com/guide/mail/automate-mail-tasks-mlhlp1120/mac).

El transporte ejecuta únicamente dos scripts JXA fijos mediante `/usr/bin/osascript`; no recibe código, comandos o rutas del usuario. El mensaje viaja como JSON por stdin, sin interpolación en scripts ni exposición de su cuerpo en argv. Antes de enviar, el script vuelve a comprobar cuenta habilitada, remitente, asunto, cuerpo y destinatarios. Se desactiva la firma de Mail para evitar añadir texto no aprobado. La app necesita el permiso nativo de Automatización y las declaraciones [NSAppleEventsUsageDescription](https://developer.apple.com/documentation/bundleresources/information-property-list/nsappleeventsusagedescription) y [Apple Events](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.automation.apple-events).

El ciclo es `proposed → approved → submitting → submitted`. La aprobación exige una revisión explícita y el hash exacto de remitente, destinatarios, asunto, cuerpo y fecha. El programador comprueba de nuevo `approvedHash` y `contentHash` antes de llamar al transporte. La aprobación de un mensaje inmediato lo entrega a Mail; una aprobación futura permanece revocable hasta que empiece su entrega. Desconectar Mail revoca propuestas y envíos aprobados pendientes.

`submitted` significa que Mail aceptó el mensaje, no que el destinatario lo recibió. Cualquier resultado ambiguo queda en `unknown`, al igual que un proceso cerrado durante `submitting`; estos mensajes no se reintentan automáticamente. El usuario debe revisar Enviados y Bandeja de salida antes de preparar otro envío. No hay adjuntos automáticos ni destinatarios adivinados.

## Proactividad

El usuario activa una regla por asunto: una vez por día o al vencer un recordatorio aprobado. El programador local revisa cada 15 segundos mientras LEX AI está abierto. Las reglas desactivadas no consultan el estado del motor ni generan texto. Los trabajos se deduplican de forma persistente por regla, versión y evento. Un bloqueo se adquiere antes de esperar el estado del asistente; cada revisión prepara como máximo un borrador y respeta un motor ocupado.

La generación utiliza la ruta real `inference.generate` de texto con metadatos acotados del asunto y del recordatorio. No consulta correo ni otros asuntos y no recibe herramientas. Pide un borrador administrativo o preguntas de seguimiento, sin inventar leyes, términos ni destinatarios. El resultado se conserva como propuesta local sin fuentes comprobadas. Solo al aceptar la propuesta se incorpora a la conversación y puede abrirse en el editor versionado. Convertirlo en correo requiere elegir remitente/destinatarios y aprobar un mensaje nuevo y exacto. Una regla nunca aprueba un correo.

El programador procesa primero los correos aprobados que vencieron y después las propuestas. Se detiene al cerrar la app; no instala agentes de inicio ni promete ejecución con la Mac apagada. Los trabajos interrumpidos conservan el fallo, sin fabricar resultados. Pausar una regla aborta su generación activa.

## Evidencia y límites

- Build y las pruebas enfocadas de versiones, correo y proactividad pasaron con datos sintéticos. Las pruebas enfocadas cubren diez casos, incluida la superposición de ediciones en conversación e historial de Office, la conservación del original, stdin nativo y alteración del hash aprobado. La suite final del árbol es responsabilidad de integración.
- `scripts/ui-writing-email-smoke.mjs`: PASS, con API real, inferencia simulada y transporte de Mail falso. Cubre edición/restauración, DOCX descargado, aprobación exacta, revocación programada y propuesta proactiva generada/deduplicada/aceptada.
- Ambos scripts JXA compilaron con `osacompile`, sin abrir Mail ni contactar cuentas. El transporte tiene una prueba de proceso que verifica script fijo, datos por stdin y ausencia de shell.
- Capturas 1440 y 390 px sin desbordamiento; escritorio inspeccionado visualmente. Evidencia en `artifacts/ui-writing-email/`.
- No se conectó una cuenta real ni se envió correo real durante desarrollo. Falta verificar el permiso de Automatización y una entrega consentida en una instalación final; no se afirma prueba nativa completa ni garantía de entrega SMTP.
