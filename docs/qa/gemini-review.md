### Evaluación Crítica del Plan LEX AI

El diseño prioriza adecuadamente la privacidad y soberanía de datos (sin nube, inferencia local en loopback, validación estricta de citas *fail-closed*). Sin embargo, presenta vulnerabilidades críticas en la superficie de ataque del host local, rigidez excesiva en la validación sintáctica y riesgos de vigencia normativa.

A continuación se detallan **cinco casos concretos de falla**, sus brechas y las **pruebas empíricas propuestas** (diseñadas para ejecución en banco de pruebas, no ejecutadas previamente).

---

### 1. Fuga de token y control de acceso en loopback local (macOS / IPC)

* **Falla:** Un servicio Node y un Ollama escuchando en `127.0.0.1` con bearer token no aíslan el tráfico frente a otros procesos ejecutados por el mismo usuario en macOS. Si el token se pasa vía variables de entorno o argumentos de comando (`ps aux`), o si un proceso local escanea puertos efímeros, cualquier binario local puede usurpar la API SQLite o emitir inferencias arbitrarias a Ollama.
* **Brecha:** Uso de sockets TCP en loopback en lugar de **Unix Domain Sockets (UDS)** con permisos `0600`, y ausencia de enlace criptográfico directo con la capa Rust de Tauri.
* **Prueba concreta propuesta:**
  * *Test de intrusión local:* Ejecutar un script Python/Bash sin privilegios especiales bajo la misma sesión de usuario que intente leer la tabla de procesos (`ps -Eww`), detectar el puerto loopback activo con `lsof -iTCP -sTCP:LISTEN -n -P` y extraer el token para consultar directamente la base SQLite sin pasar por Tauri.

---

### 2. Denegación de servicio funcional por desajuste Unicode / Normalización (*Fail-Closed*)

* **Falla:** La política de *fail-closed* ante citas no coincidentes colapsará con falsos positivos legítimos. En macOS (APFS), la codificación de caracteres acentuados suele diferir (NFD vs. NFC). Además, Gemma puede emitir comillas tipográficas (`“”`, `«»`), espacios no separables (`\u00A0`) o truncar saltos de línea presentes en los snapshots normativos o documentos ingested. El sistema rechazará respuestas jurídicamente correctas por discrepancias de un solo byte.
* **Brecha:** Ausencia de un pipeline de normalización canónica simétrica (NFKC, *case-folding*, colapso de espacios en blanco y *strip* de puntuación de formato) previo a la comparación exacta de texto.
* **Prueba concreta propuesta:**
  * *Test de normalización canónica:* Inyectar 50 pares de cita/respuesta sintéticos que contengan: (a) texto normativo con acentos en NFD frente a respuesta del modelo en NFC; (b) comillas inglesas vs. latinas; (c) sangrías de salto de línea inter-párrafo. Medir la tasa de rechazo erróneo (*false-rejection rate*).

---

### 3. Anacronismo normativo por "validez actual desconocida" (Derogaciones silenciosas)

* **Falla:** En el ámbito civil federal y de CDMX, múltiples figuras (ej. causales clásicas de divorcio, interdicción, firma electrónica local) han sido derogadas o declaradas inconstitucionales. Limitarse a verificar hash/proveniencia de snapshots estáticos sin vector temporal permite al modelo fundamentar demandas con artículos formalmente vigentes en el snapshot pero materialmente abrogados o reformados.
* **Brecha:** Los metadatos de los chunks en SQLite FTS carecen de campos estructurados de temporalidad (fecha de publicación en DOF/GODF, vigencia inicial, reformas aplicables y marcas de derogación).
* **Prueba concreta propuesta:**
  * *Test de contraste anacrónico:* Formular consultas sobre artículos específicos históricamente reformados (ej. artículos de interdicción sustituidos por apoyos y salvaguardias). Verificar si el sistema advierte la incertidumbre temporal o si emite un dictamen afirmativo asumiendo vigencia absoluta.

---

### 4. Agotamiento de recursos en ingestión acotada (*ZIP Bomb* y *Regex DoS*)

* **Falla:** La ingestión "acotada" de DOCX/PDF puede eludir límites de tamaño de archivo en disco si no se valida la relación de compresión. Un archivo DOCX de 2 MB puede descomprimirse en estructuras XML de varios gigabytes (Billion Laughs / Zip Bomb), o PDFs con tablas de referencias cruzadas circulares pueden bloquear el hilo de Node o disparar el uso de memoria durante el tokenizado e indexación FTS5.
* **Brecha:** Falta de límites estrictos a nivel proceso (límites POSIX `rlimit`, cuotas de descompresión antes de lectura y timeouts asíncronos en los workers de parseo).
* **Prueba concreta propuesta:**
  * *Test de estrés de descompresión y parseo:* Cargar (a) un archivo `.docx` con ratio de compresión 100:1 y entidades recursivas; (b) un PDF con 10,000 páginas en blanco y fuentes incrustadas circulares. Monitorear si el proceso Node es terminado limpiamente por el supervisor de Tauri o si causa un OOM crash en el frontend React.

---

### 5. Incoherencia transaccional durante el *Rollback* de retroalimentación

* **Falla:** El mecanismo de retroalimentación local y propuestas de mejora requiere versionado y *rollback*. Si se revierte una versión de configuración o de *prompts* tras una actualización que modificó o re-indexó embeddings/tablas FTS en SQLite por materia, un fallo durante el rollback dejará la base de datos en un estado disociado entre el esquema nuevo y los metadatos anteriores.
* **Brecha:** No se especifica transaccionalidad atómica multietapa que cubra tanto los archivos de configuración/versión como el estado interno de SQLite (`WAL mode`, transacciones explícitas y puntos de restauración con snapshotting de DB).
* **Prueba concreta propuesta:**
  * *Test de fallo forzado (Chaos rollback):* Simular una aprobación de mejora que ejecute una migración de índices FTS, enviar una señal `SIGKILL` a Node en medio del proceso de rollback y ejecutar posteriormente `PRAGMA integrity_check;` junto con consultas de verificación por materia para constatar si existe corrupción de índices o pérdida de estados anteriores.

---

### Recomendaciones Directas

1. **Sustituir TCP loopback por Unix Domain Sockets:** Configurar la comunicación entre Tauri y Node exclusivamente mediante sockets UDS protegidos con permisos de archivo estrictos (`0600`).
2. **Definir matching canónico estricto:** Para las citas *fail-closed*, exigir coincidencia byte a byte únicamente tras una transformación determinista (Unicode NFKC, unificación de comillas y reducción de espacios en blanco).
3. **Incorporar bandera de alerta temporal:** Almacenar en SQLite la fecha del snapshot y forzar un *disclaimer* estricto en la exportación DOCX cuando el asunto analizado sea posterior a la fecha del snapshot normativo.
