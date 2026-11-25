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

## Ajuste de CI y parámetros (base 7bd7214)

Los15tests nuevos no figuraban en el workflow del primer commit; su CIverde no
los ejecutó. Ahora se añaden explícitamente los3archivos contractual al paso
Portable source contracts. Medición local del ajuste:15/15PASS, sin modelo/red;
la ejecución real de CI corresponde al conductor tras revisión/publicación.

Se fijan en cada POST los valores SOLICITADOS: temperature0,
presence_penalty0 (anula el default instalado1.5), top_k20, top_p0.95,
num_ctx8192; num_predict4096 para detección y256 para revisión contextual.
keep_alive30s/thinkfalse/streamfalse permanecen explícitos. El test compara todo
el objeto options exacto de ambas etapas, no solo temperature. No se afirman
parámetros efectivos observados, calidad ni determinismo del runtime.

Identidad, evidencia reportada por conductor en lectura de archivos instalada:
GGUF de modelo SHA256
20cb277f0967ace47b0b5d5658e5e494a88937f7378b74b5a266496400938f4c
(1274396992bytes) y projector
5ddf560e34046fd958b2576324f2a9b57d70f297afe6526958d60a23f3bfc20b
(671372768bytes), ambos comparados con sus digests. Ollama0.40.6, binario SHA256
69fcb23ae7b95af30b5184998751f6158df84d0071f930670ee5c22db667c2ff.
No se volvió a leer/cargar modelo en este ajuste.

Si el tokenizer está contenido en ese GGUF, su identidad de BYTES queda cubierta
por el hash del contenedor, sin extraerlo ni duplicarlo. El inventario reportado
no parseó GGUF: no prueba qué metadata/tokenizer contiene ni cuál usa el runner.
No se afirma identidad semántica o uso efectivo del tokenizer. Aún faltan runner/
llama.cpp y dependencias dinámicas efectivas, entorno OLLAMA_* y aplicación de
parámetros/template/parser del runtime. Un contenedor identificado no acredita
el pipeline completo. No hay freeze ni record elegible.

Techo incremental1GiB y total4GiB del protocolo permanecen SIN cambios. Pesos en
disco no equivalen a RSS, pero sus tamaños hacen probable incompatibilidad con
1GiB al cargar; no se ejecutó para averiguarlo. No hay permiso implícito para
cargar, relajar techo o evaluar. Node/ICU de host y CI deben quedar distinguidos
en una futura medición, no considerados equivalentes por pasar tests de formato.
