# Núcleo contractual opt-in: formato, no rendimiento

Base 1ecf59c. Nueva identidad semántica draft, NO congelada/elegible. Ninguna
ruta de producto importa este candidato; no hay endpoint, runner, grant ni
activación. No se ejecutó modelo ni se abrió/parseó/hasheó heldout.

Cambios: retirado inspectLocalText sin uso; el candidato pasa texto exacto
directamente a reviewIntakeDocument, sin extracción ni normalización.
inspectLocalDocument queda byte-idéntico a main; reviewIntakeDocument puede devolver categorías de reglas
antes de fusionar vista, solo con includeTypedRanges. El candidato recibe el
contrato operacional v2 y backend local inyectado, revisa juntos todos los campos
y sus paths, vincula el snapshot completo por SHA-256 y exige respuesta tipada.
Reutiliza reglas, vista y revisión contextual de intake. Todo rango adicional
ocultado por heurística/contexto sin respaldo categorizado provoca bloqueo. No se
clasifica DatoN. Paths con detecciones bloquean pues el scorer no admite sus spans.

Backend opt-in real: createIntakeContractualOllama inyecta el mismo modelo y
transporte loopback de intake, con prompt/schema tipado distinto y parser
estricto de campos, valores, rangos y finalización. No se ejecutó modelo: solo
respuestas sintéticas sobre fetch simulado. El constructor no conecta/probea;
la invocación explícita detect() usa loopback, no endpoint de nube. El default
del producto no importa candidato ni adaptador. Se exige done=true/stop, modelo
y rol correctos, UTF-8/JSON válido y respuesta<=256KiB; sin reintentos.
La identidad real de pesos, template/tokenizer y runtime sigue sin acreditar.
No se afirma que Ollama siga el contrato o clasifique de forma fiable.

No hay persistencia de bindings; cada invocación revisa su copia del snapshot.
La vinculación a revisión vigente de ficha y almacenamiento queda fuera de este
corte; NO se construye un candidato de envío.

Identidad futura requiere grafo del candidato nuevo (operational-v2 incluido),
backend y prompt completo, fuentes/resources transitivos de intake, runtime y
pesos reales. La lista de imports del test anterior es alarma de cambios, no
freeze. No se genera un archivo con hashes supuestos ni record de aceptación.

Pruebas sin inferencia: preservación CRLF/NUL/espacios, offsets emoji, categorías,
relación tipada entre campos, hash distinto por texto o scope, backend no muta
snapshot, foreign/path/unknown/malformed output, revisión contextual incompleta,
scope/operacional/abort/marcadores y errores de backend. Son construcciones del
autor. No prueban detección real ni precisión, recall, memoria, latencia, privacidad,
preservación jurídica o integración de transporte.

Medido V2:56/56 PASS (incluye3de transporte simulado). V1:52/52 PASS en candidato/formato/import/contexto/operacional;
4/4 PASS en contratos de preguntas que no requieren biblioteca externa. Intento
con intake-question completo:55/57, dos ENOENT por public-library.sqlite ausente;
no se presenta como suite verde ni se añade el recurso a este parche. Los demás
casos pasaron. Sin UI, captura ni app nativa: no hay cambio visual.

El núcleo limita espera total del backend a15segundos y honra aborto incluso si
el backend no coopera. Esto solo limita la espera del llamador: no demuestra que
un futuro proceso local haya dejado de computar; el adaptador real deberá
propagar cancelación al proceso antes de poder evaluar recursos.

Correcciones V2: rutas de campo pasan además por reglas/heurísticas deterministas
de intake antes del backend; no dependen solo de su respuesta. Detección privada
en path bloquea, no se transforma en span de texto. No es prueba de detección
universal. Se propaga señal combinada de plazo/aborto a toda revisión y ask.
El caso de literal repetido con un solo span tipado bloquea por cobertura parcial
porque el protector heredado sustituye todas sus apariciones. El test de
transporte conserva CRLF/NUL/espacios y comprueba la misma señal en ambas etapas.

Contrato propuesto de spec sigue siendo plan original, no afirmación de que
todos sus pasos estén completos. En particular no hay ejecución/scorer record,
freeze, identidad runtime, integración cloud-route ni validación de privacidad.
