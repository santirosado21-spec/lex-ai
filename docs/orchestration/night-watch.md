# Monitor nocturno local

Solicitud del dueño: seguir consultando fuentes mexicanas y verificar backend/frontend mientras no está presente. Implementación: supervisor determinista de Node bajo `launchd`, sin depender de que siga abierta esta conversación. Codex dirigió el desarrollo; no se presenta el supervisor como otro modelo pensando indefinidamente.

## Operación

```bash
npm run watch:start
npm run watch:status
npm run watch:stop
npm run watch:unload
```

`start` carga exclusivamente el job `mx.lexai.nightwatch` de esta sesión gráfica. Se ejecuta como el usuario actual, sin root. Hace un ciclo inmediato y luego espera 45 minutos entre ciclos, con límite de 12 horas o 16 ciclos. No se instala para arrancar tras reiniciar el Mac. `stop` deja una señal y el proceso cancela el trabajo en hasta cinco segundos; `unload` además descarga el job de launchd. Para un nuevo arranque, descargar primero el job terminado. Los registros se conservan.

El job usa `ProcessType=Standard`, con los límites normales de launchd. La clasificación `Background` agotó el límite de cinco minutos de inferencia sin emitir tokens en el ciclo del 30/10 a las 14:54Z; el registro fallido se conserva. Según el manual local `launchd.plist`, Background restringe recursos para tareas no solicitadas directamente por el usuario. Se cambió únicamente la clasificación, sin ampliar tiempos máximos ni eludir validaciones; la corrida posterior completó el análisis en 89,16 segundos y el ciclo entero pasó a las 15:04Z. El estado actual se consulta en `watch:status`.

`caffeinate -i` evita la suspensión por inactividad mientras vive el job, sin mantener encendida la pantalla. El Mac debe permanecer encendido, con conexión para las fuentes públicas; cerrar la tapa, cerrar sesión o reiniciar puede interrumpirlo. No cambia las preferencias de energía del sistema.

Cada ciclo ejecuta, en orden:

1. Comprueba si venció la ventana de seis horas para las siete fuentes oficiales; cuando vence, hace una consulta condicionada. Las nuevas copias quedan en cuarentena. Antes del vencimiento registra el paso como omitido, conservando su evidencia previa.
2. Descubrimiento público en GitHub cada seis horas: tres consultas, hasta cinco candidatos por consulta, sin credenciales ni ejecución de código de terceros.
3. Pruebas backend, extracción, corpus, seguridad de límites y supervisor.
4. Compilación TypeScript/Vite.
5. Prueba funcional del frontend con API local y modelo explícitamente simulado.
6. Prueba con Gemma real al primer ciclo y cuando cambie el hash del corpus incorporado. Datos exclusivamente sintéticos. El proceso de inferencia termina al concluir.

Una compilación fallida impide ejecutar un smoke contra un `dist` anterior. Cada subprocess tiene un tiempo máximo y recibe cancelación. Los fallos generales aumentan la espera hasta tres horas; no se convocan Claude, Codex o Gemini en cada vuelta. La prueba local de Gemma se repite si aún no aprobó o cambió el corpus. Una fuente parcialmente inaccesible se registra por separado, sin ocultar las demás comprobaciones correctas. El proceso termina al alcanzar el límite temporal y conserva la última evidencia.

No hay autorreparación de código sin supervisión en este job. Las correcciones de este ciclo las implementó y verificó Codex antes de arrancarlo. El monitor consulta, prueba y registra. No modifica el corpus utilizado por los abogados, no aprueba aprendizaje, no despliega ni publica datos.

## Evidencia y controles

- Estado: `artifacts/night-watch/status.json`, PID y heartbeat cada cinco segundos.
- Historial: `artifacts/night-watch/runs/<id>/cycle-XX/result.json` y logs de cada comando.
- Fuentes: `artifacts/legal-sync/status.json`, manifest e historial PDF por SHA-256.
- Repos: `artifacts/legal-repositories/status.json`; candidatos no equivalen a autoridad jurídica.
- Publicación de estado para la app: `~/Library/Application Support/LEX AI/public-monitor/status.json`. Contiene solo metadatos públicos y de pruebas. La app lo lee; no hace solicitudes a internet para mostrarlo.
- La API marca `unresponsive` un monitor activo cuyo heartbeat tiene más de 120 segundos; no inventa actividad tras un crash.
- Bloqueo de instancia única; la recuperación de un bloqueo obsoleto exige comprobar que su PID ya no existe. No se mata un proceso solo por encontrar su PID en un archivo.

El runtime del producto, sus documentos, SQLite, recuperación e inferencia permanecen en el equipo. La red se utiliza para fuentes legislativas públicas, metadatos de repositorios y desarrollo autorizado con Claude/Codex. Supabase y Vercel no son necesarios para este corte local.

Se consultó la [documentación oficial de Codex sobre automatización](https://learn.chatgpt.com/docs/non-interactive-mode) para evaluar un agente persistente. Se eligió un supervisor de comandos acotados porque las comprobaciones no requieren consumir una nueva sesión de modelo en cada ciclo.
