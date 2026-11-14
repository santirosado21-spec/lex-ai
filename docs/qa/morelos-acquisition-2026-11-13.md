# Adquisicion Morelos — marcojuridico.morelos.gob.mx (2026-11-13)

Cierre del programa acotado de legislacion estatal de Morelos. Todo el material permanece en CUARENTENA (textReview/legalReview pendientes); nada de lo aqui contado es "limpio", "validado" ni activado en producto.

## Fuente y procedencia

- Sitio: Marco Juridico del Estado de Morelos (`https://marcojuridico.morelos.gob.mx/`), biblioteca juridica oficial del Gobierno de Morelos (aplicacion Laravel), enlazada desde la seccion "Leyes y Codigos" del portal del Congreso (`congresomorelos.gob.mx`).
- Catalogo: home sha256 `27fbb321df7055e8d2d29f26484554239b87ae0016fd1017afc9a2aacc770970` (2026-11-13). Categorias server-rendered `/categorias/{id}?page=N`: Leyes (6), Codigos (3), Constitucion Politica del Estado (4).
- Descarga: rutas directas `/documentos/{id}/pdf` (inline) y `/documentos/{id}/download`.
- Verificaciones previas (2026-11-13): robots.txt ausente (404 HTML); la ausencia de robots NO se trata como permiso por si sola. Sin aviso legal ni terminos de uso localizados en home ni paginas de categoria; sin content-signals; sin bloqueo por user agent. Base documentada LFDA art. 14 frac. VIII (misma que programas cerrados). La ausencia de terminos NO es autorizacion expresa del titular ni dictamen legal. Host agregado a la allowlist de `server/legal-sync.mjs` (mismo patron que estados previos).

## Universo

- 261 ids unicos con ruta PDF observada: Leyes 136 + Codigos 123 + Constitucion 2.
- Delta documentado: el encabezado del sitio anuncia 142 leyes y 125 codigos; el listado renderizado y paginado completo muestra 136 y 123 unicos. No hay mas entradas alcanzables por paginacion; el delta queda registrado, no perseguido.
- Diferidos a fase posterior (fuera de este cierre): Reglamentos y programas (categoria 8, ~1,516 documentos) y Leyes de Ingresos y Presupuesto (categoria 7).
- Barrido HEAD previo a lotes: 261/261 HTTP 200 `application/pdf`, 0 sobre 10 MB, 0 sobre el techo duro 20,971,520 bytes.
- Registries: `resources/legal-acquisition-mor-leyes-01..27-2026-11-13.json` (27 lotes de 10, ultimo de 1; maxRetries 0, rateMs 2000, concurrencia 1).

## Resultado

- 261/261 ids registrados; 261/261 PDFs presentes en disco; 257/261 extracciones validas; 14,711 registros estructurales extraidos y cuarentenados, SIN revision independiente de contenido.
- Fallidos (4, todos extraction-invalid por brecha de estructura, misma clase que ags-ley-160; NO parser-gap; PDFs conservados y clasificados aparte, sin forzar segmentacion):
  - `mor-cod-031` Codigo de Conducta del Regimen Estatal de Proteccion Social en Salud — 0 encabezados de articulo numericos (verificado con pdftotext).
  - `mor-cod-045` Codigo de Conducta del Centro de Conciliacion Laboral del Estado de Morelos — 0 articulos.
  - `mor-cod-069` Codigo de conducta del municipio de Tepalcingo — 0 articulos.
  - `mor-cod-090` Codigo de conducta de los servidores publicos del Sistema de Conservacion, Agua Potable y Saneamiento de Zacatepec — 0 articulos.
- Recuperados por reintento idempotente espaciado (misma corrida, sin regenerar registries): `mor-cod-053`, `mor-cod-067`, `mor-cod-099`, `mor-ley-009`, `mor-ley-051` (fallos de red transitorios del servidor; no contaron como ausencia del documento).

## Incidente operativo: watchdog de inactividad de descarga

- Sintoma: el servidor dejaba ciertas conexiones colgadas sin bytes durante ~17-35 minutos; el worker no cortaba.
- Causa raiz: `server/legal-sync.mjs` leia el cuerpo de la respuesta con un for-await sin carrera contra la señal de aborto; un socket medio abierto no despertaba el iterador. Segunda causa: `reader.cancel()` esperado con await puede no resolverse nunca sobre ese mismo socket.
- Cambio acotado (desarrollo existente, sin nueva autoridad): carrera `reader.read()` vs watchdog de inactividad (`downloadInactivityMs`, por defecto 60s) + listener de la señal externa; `reader.cancel()` sin await. Sin reintentos rapidos en caliente (maxRetries 0 se mantiene); los fallidos de red se recuperan con reintento idempotente espaciado. Sin cambio de concurrencia. Los timeouts NO cuentan como ausencia del documento.
- Pruebas: dos tests nuevos en `tests/legal-sync.test.mjs` (cuerpo colgado falla como network-error dentro del limite aunque `cancel()` nunca se resuelva; descarga lenta pero progresiva completa). Suite completa: 1173 pass / 0 fail / 33 skipped.
- Nota: varios "stalls" largos observados coinciden con suspensiones del entorno de ejecucion entre corridas (temporizadores de 45s/20min que no dispararon y reanudacion subita al volver la actividad); el watchdog cubre el caso de red real y los reintentos idempotentes el resto.

## Contabilidad

Inventario por id, SIN resta de duplicados de contenido (la unicidad global de contenido no se afirma). Conteos separados: ids registrados / PDFs presentes / extracciones validas / registros. Escaneados sin texto y documentos sin estructura de articulos quedan clasificados aparte (cola OCR los primeros, brecha de estructura los segundos), no como exclusion permanente.
