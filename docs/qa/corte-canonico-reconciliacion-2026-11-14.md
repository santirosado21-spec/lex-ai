# Reconciliacion del corte canonico (id por id) — 2026-11-14

## Por que
El corte vigente (2,845/2,840/2,829/260,711) se construia por SUMAS ACUMULADAS de
cifras de QA por programa. Al derivarlo de forma independiente desde los
registries canonicos + el arbol de artefactos aparecio una brecha (main
2026-11-14 05:40 pidio confirmar definicion y reconciliar). Hallazgo central: el
corte acumulado NO es reconstruible id-por-id desde los QA — sus componentes por
programa mezclan convenciones distintas (catalogados vs adquiribles vs
extraidos) y contienen al menos un doble conteo (nay-ley-148 plegado dos veces:
dentro del catalogo estatal y otra vez al recuperarse). Esa fragilidad es la
causa; se corrige cambiando el METODO, no solo las cifras.

## Metodo nuevo (reproducible)
Universo = union de ids de resources/legal-acquisition-*.json EXCEPTO pilot.json
y fed-diagnostic (programas no canonicos documentados), MAS los 10 ids federales
unicos del piloto original (ccf, ccom, cff, cpeum, cpf, lamp, lfda, lfpc, lft,
lgsm: adquiridos y extraidos, ausentes de los registries por id corto), MAS
col-reg-023 (catalogado, enlace roto, sin registry). Para cada id: presente =
snapshot en el arbol; extraccion = >=1 archivo de extraccion; registros = la
extraccion MAS RECIENTE del id (regla de agregacion: resultado vigente, con los
intentos historicos preservados en el arbol).

## CORTE CANONICO NUEVO (sustituye al acumulado)
- ids registrados: 2,878
- documentos presentes (snapshots, sin importar exito de extraccion): 2,874
- extracciones validas: 2,863
- registros: 270,354
Consistencia interna verificada: 2,878 = 2,874 + 4 registrados sin snapshot
(ags-ley-2529, bc-presupuestoestado2026 [document-byte-budget], col-reg-023
[catalog-link-broken], mex-ley-209 [duplicado de catalogo bloqueado]);
2,874 = 2,863 + 11 presentes sin extraccion (6 cola OCR: yuc-ley-011/012/015,
oax-ley-219/222, reg-lfgfaga-fe-16may55; 5 brecha de estructura: ags-ley-160,
mor-cod-031/045/069/090).

## Delta contra el corte acumulado
ids +33 (2,845->2,878); presentes +34; extracciones +34; registros +9,643
(260,711->270,354).

Hallazgos exactos:
1. Lotes federales tempranos nunca plegados a las sumas de QA: fed-expansion-2,
   -3, -4, -5 y fed-expansion-2026-11-11 (5 ids cada uno) + ligie-2022 = 26 ids,
   7,483 registros, TODOS cuarentenados desde 2026-11-11/12 con extraccion
   valida: lss(337), lieps(52), lfpa(117), lic(486), ladua(277), cnpcf(1191),
   cnpp(490), lisr(236), liva(80), lfpdppp(64), lgtoc(440), cfpc(630),
   lfcdo(57), lgamvlv(98), lgs(721), lmv(463), lisf(510), lpab(95), lfi(195),
   luc(151), lgtaip(216), lgra(235), laassp(120), lopsrm(133), lgcg(87),
   ligie-2022(2). Incluye leyes nucleares (LISR, LIVA, CNPP, CNPCF, LGS, LSS,
   LFI, LMV): el corte viejo las daba por contadas y NO lo estaban.
2. col-ley-104 (class catalog-link-broken en el QA de Colima) fue RECUPERADO en
   una corrida posterior (registry col-oficial-11-2026-11-14, snapshot
   a4c0687e... + extraccion): la clase catalog-link-broken baja a 1
   (col-reg-023). El listado de fallidos del corte viejo estaba desactualizado.
3. fed-reglamentos: 138 ids reales en registries vs 139 en las sumas (-1
   fantasma historico).
4. Resto del delta: correcciones de convencion en sumas historicas (ver "Por
   que"); no reconstruibles con exactitud, que era justamente el problema.

## Tabla por programa (derivada)
| programa | registrados | presentes | extracciones |
|---|---|---|---|
| ags-leyes | 179 | 178 | 177 |
| bc-leyes | 166 | 165 | 165 |
| coahuila-leyes | 250 | 250 | 250 |
| col-oficial | 168 | 167 | 167 |
| dgo-leyes | 165 | 165 | 165 |
| fed-expansion | 304 | 304 | 304 |
| fed-reglamentos | 138 | 138 | 137 |
| mex-oficial | 261 | 260 | 260 |
| mor-leyes | 261 | 261 | 257 |
| nay-leyes | 164 | 164 | 164 |
| nl-recuperacion | 8 | 8 | 8 |
| oax-leyes | 224 | 224 | 222 |
| pilot-federal-unico | 10 | 10 | 10 |
| tab-leyes | 191 | 191 | 191 |
| yuc-leyes | 389 | 389 | 386 |

Nota col-oficial: 168 = 167 registry (incluye col-ley-104 recuperado) +
col-reg-023 (catalogado, sin registry). El 169 catalogado original contaba 2
enlaces rotos; hoy solo queda 1.

## Regla a futuro
Todo corte futuro se deriva con este metodo (union de registries + arbol), nunca
sumando sobre el corte anterior. El corte anterior queda en historia sin
reescribir.

## Correccion (mismo dia, extractor v31)
Corte derivado de nuevo con scripts/derive-canonical-cut.mjs (script nuevo que
reproduce este metodo; este documento queda como registro del metodo):
- extracciones validas: 2,871 (+4); registros: 270,712 (+23).
- Recuperados por v31 (docs/qa/extractor-v31-no-articulados-2026-11-14.md):
  ags-ley-160 (10 principios), mor-cod-031 (6 capitulos), mor-cod-090 (5
  capitulos), oax-ley-222 (2 resolutivos). Todo cuarentenado.
- Presentes sin extraccion bajan a 3: mor-cod-045 (fuente sin mapa Unicode:
  cola OCR pendiente force-OCR), mor-cod-069 (secciones sin numerar: clase no
  soportada), reg-lfgfaga-fe-16may55 (declaratoria 1955 texto corrido).
- ids registrados (2,878) y presentes (2,874) sin cambio.

## Correccion 2 (mismo dia, extractor v32 force-OCR)
- extracciones validas: 2,872 (+1: mor-cod-045, 22 articulos via OCR forzado);
  registros: 270,734 (+22). Derivado con scripts/derive-canonical-cut.mjs.
- Presentes sin extraccion: 2 (mor-cod-069, reg-lfgfaga-fe-16may55).
