# Adquisicion de legislacion estatal de Tabasco (congresotabasco.gob.mx) - 2026-11-13

Programa de adquisicion publica acotada de legislacion estatal desde el catalogo
oficial del Congreso del Estado de Tabasco. Todo el material queda en CUARENTENA
(textReview/legalReview pendientes, published=false, indexed=false): extraccion
estructural verificada, SIN revision independiente de contenido.

## Fuente y universo

- Catalogo: https://congresotabasco.gob.mx/leyes/ (195 filas con PDF: titulo,
  fecha, legislatura, trimestre). Captura local del catalogo verificada el
  2026-11-13 (sin sha256 registrado en este QA; el barrido HEAD es la
  evidencia de existencia documento a documento).
- Universo: 192 = 195 - 2 manuales administrativos internos del congreso
  (excluidos: no son legislacion) - 1 URL duplicada de la Constitucion.
- Barrido HEAD previo de los 192 (2026-11-13): 191/192 HTTP 200; 1 enlace
  roto (ver incidentes); 0 sobre el techo duro de bytes.
- Registries: resources/legal-acquisition-tab-leyes-NN-2026-11-13.json
  (lotes 01-20).
- robots.txt estandar WordPress (Disallow: /wp-admin/ y podscache), sin
  bloqueo de agentes IA ni content-signals. Verificacion de terminos
  2026-11-13: el sitio muestra una etiqueta «Aviso Legal» pero su destino es
  404; no se localizo pagina de terminos de uso en home ni catalogo. La
  ausencia de terminos NO se presenta como autorizacion expresa del titular
  ni como dictamen legal; la base documentada es LFDA art. 14 frac. VIII
  (base documentada, no conclusion legal), limitada a textos normativos
  oficiales con enlace de descarga directa.

## Resultado

- 191 de 191 adquiribles extraidos estructuralmente: 17,778 registros.
- 0 fallidos en los lotes. 0 publicados, 0 indexados.

## Contabilidad de cobertura (adquirido != unico != vigente)

- Indice del catalogo: 195 filas. Universo normativo: 192. Intentados: 191.
  Descargados: 191. Extraidos: 191.
- Textos unicos estatales: 191 por id. Deduplicacion cruzada por id y titulo
  normalizado contra los 1,530 ids unicos previos: 1 solape de titulo
  (tab-ley-109 LEY DE EXPROPIACION vs law-35 federal y yuc-ley-006)
  verificado como HOMONIMO, no duplicado: el texto es la ley estatal de
  Tabasco (objeto: derechos del Estado de Tabasco; distinta de la federal y
  de la yucateca). La dedup por id/titulo NO descarta duplicados de
  contenido con titulos distintos; no se afirma unicidad global.
- El catalogo mezcla vigentes y series historicas (p.ej. leyes de ingresos
  anuales); sin marcas de estatus por fila: la vigencia individual NO esta
  verificada en este programa.

## Incidentes y excepciones

1. Ley de Ingresos del Estado de Tabasco 2019: enlace roto (HEAD 404
   verificado 2026-11-13, dos barridos). EXCLUSION documentada por enlace
   roto; el resto de la serie fiscal anual si se adquirio.
2. Un HEAD con error de codificacion (URL con acento sin codificar) resuelto
   quote-encodeando las 192 URLs antes del barrido; sin impacto.

## Estado

Programa cerrado: 191/191 en cuarentena. Activacion en producto prohibida;
cualquier uso posterior requiere revision de contenido independiente.
