# Extractor v29 (OCR local) — reproceso de la cola de escaneados — 2026-11-14

Alcance: los 6 documentos en cola OCR del corte canonico 2026-11-14
(2,878/2,874/2,863/270,354). Todo sigue en CUARENTENA (textReview/legalReview
pending); nada de esto activa corpus en producto.

## Resultado: 4 leyes recuperadas (+280 registros), 2 documentos confirmados sin estructura de articulos

| Documento | Paginas | Registros | Notas |
| --- | ---: | ---: | --- |
| yuc-ley-011 | 79 | 115 | ids secuenciales 1-115; OCR limpio |
| yuc-ley-012 | 38 | 78 | ids secuenciales 1-78; OCR limpio |
| yuc-ley-015 | 29 | 50 | ids secuenciales 1-50; OCR limpio |
| oax-ley-219 | 68 | 37 | ids 1,2,4,...; ver limites conocidos |
| oax-ley-222 | 24 | 0 | CONFIRMADO no articulado: decreto con resolutivos "Primero./Segundo." (sin "ARTICULO <ordinal>"); el equivalente digital daria 0 registros |
| reg-lfgfaga-fe-16may55 | 1 | 0 | CONFIRMADO no articulado: declaratoria administrativa de 1955, una pagina |

Corte canonico correccion mismo-dia: 2,878 registrados / 2,874 presentes /
2,867 extracciones / 270,634 registros. Derivado del arbol: exactamente 4 ids
ganaron extraccion hoy (verificado por mtime, una extraccion por id), +280
registros. Fallidos vigentes: 7 extraction-invalid (5 estructura digital:
ags-ley-160, mor-cod-031/045/069/090; 2 no articulados confirmados) +
2 document-byte-budget (ags-ley-2529, bc-presupuestoestado2026) +
1 catalog-link-broken (col-reg-023) + 1 catalog-duplicate (mex-ley-209).

## Como funciona v29 (fail-closed)

- Si la capa de texto digital extrae menos de 10 caracteres por pagina en
  promedio, el worker rasteriza con pdftoppm (300 dpi, grises) y OCR local con
  tesseract (idioma spa preferido, eng como fallback con marca). Sin red, sin
  costo. El MISMO parseo de articulos corre sobre el texto OCR.
- Todo registro OCR queda quality=quarantined + anomalia
  ocr-derived-text-layer en registro y documento: NUNCA puede salir por
  exportLibrary (solo structurally-verified). coverage.ocr registra motor,
  version, idioma, dpi y paginas.
- Reparacion acotada: tesseract funde el sufijo ordinal ("Articulo 2o.-" ->
  "20.-"). Solo cuando la secuencia espera n y el encabezado al inicio de linea
  lee exactamente n*10, se reescribe al ordinal esperado y se anota la anomalia
  ocr-ordinal-suffix-fused-heading-repaired (3 reparaciones en oax-ley-219).
- Techos: 160 paginas OCR por documento (mas => sigue extraction-invalid con
  nota ocr-page-cap-exceeded; nunca OCR parcial silencioso); 30s por pagina.
- Reanudable: las paginas OCR se cachean atomicas (tmp+rename) por sha256 del
  snapshot cuando LEX_OCR_CACHE_DIR esta definido; el presupuesto de
  adquisicion sigue en 45s por politica, asi que cada intento deja paginas en
  cache y el siguiente continua. Intentos fallidos por request-timeout no
  degradan el estado del documento.

## Pruebas y equivalencia

- tests/extractor-ocr-fallback.test.mjs: fixture escaneado sintetico (Pillow,
  2 paginas) recupera articulos 1 y 2, todos quarantined con anomalias OCR;
  se salta sin tesseract/poppler/PIL. CI instala tesseract-ocr-spa +
  poppler-utils + python3-pil y la corre (run 43599051399 verde).
- Suite completa: 1181/0 (2 pruebas nuevas).
- Equivalencia digital byte a byte vs extraccion almacenada v28:
  ags-ley-179, 37/37 registros identicos, sin OCR activado.
- reg-lfgfaga-fe-16may55 valido la ruta end-to-end via ledger de adquisicion
  (offline) antes de las 5 leyes.

## Limites conocidos (textReview pendiente lo revisa)

- oax-ley-219: el encabezado "Articulo 3," (coma atipica, visible en el OCR;
  posiblemente en la impresion) no coincide con la gramatica estricta
  ([.:\-]); el texto del articulo 3 quedo absorbido en el registro 2. Los ids
  recuperados son 1,2,4,..., con anomalia
  operative-numbering-restarts-before-transitory-boundary + 3 reparaciones de
  ordinal. Aceptado como cuarentena con anomalias explicitas; NO se amplio la
  gramatica sin mas evidencia (fail-closed).
- Calidad OCR: las leyes de Yucatan salieron limpias; el escaneado de 1955
  (maquina de escribir) quedo legible pero con errores de OCR visibles; nada
  de esto cambia su estado: cuarentena, textReview/legalReview pending.
- Los reportes report.json de los 5 lotes reflejan ahora la ultima corrida de
  reproceso; los reportes previos quedan preservados como
  report-pre-ocr-2026-11-14.json en cada lote (evidencia de todas las corridas).

## Clasificacion final de la cola OCR

- extraction-invalid (estructura digital, sin cambio): ags-ley-160,
  mor-cod-031/045/069/090.
- extraction-invalid (no articulados, OCR verificado): reg-lfgfaga-fe-16may55,
  oax-ley-222.
- Clase OCR como tal: CERRADA (0 pendientes de OCR en el corpus).
