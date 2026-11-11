# Manifiesto de adquisición de corpus público — BORRADOR 2026-11-11

**Estado: BORRADOR. Nada de este documento declara adquisición, aprobación, ejecución ni vigencia jurídica.**
Reconstruido/derivado de fuentes públicas verificadas el 2026-11-11. Este borrador prepara la adquisición pública del corpus legal dentro de los límites vigentes de derechos, canal y gasto: candidatos pendientes actualizados a bindings oficiales verificados conservando URL anterior y proveniencia, e investigación de fuentes públicas y condiciones. No es autorización de gasto ni de egreso de contenido privado.

Relación con artefactos existentes:
- Registro: `resources/legal-acquisition-pilot.json` (fuente aprobada: `diputados-fed`; fuentes pendientes: `congreso-jalisco`, `hcnuevo-leon`, `sjf-pleno-primera-sala`).
- Verificación de plazas: `docs/qa/public-corpus-slot-verification-2026-11-11.md` (preserva URLs anteriores y su evidencia).
- Cobertura: `docs/research/public-corpus-coverage-map-2026-11-11.md`.

## 1. Bindings actualizados en el registro (status sigue `pending`)

Los 9 documentos con candidato oficial verificado hoy llevan ahora `url` y `evidenceUrl` reales en el registro. El `status` de cada documento y fuente permanece `pending`; `buildAcquisitionPlan()` solo selecciona documentos `approved`, por lo que **ninguno es elegible para adquisición automática**. URLs anteriores (nulas u obsoletas) quedan preservadas con su evidencia en `docs/qa/public-corpus-slot-verification-2026-11-11.md`; los archivos de investigación del 2026-11-10 no se reescriben (convención: documentos fechados nuevos superponen con proveniencia).

| slot | documento | URL oficial | versión declarada por la fuente | vía de verificación |
| --- | --- | --- | --- | --- |
| jalisco-pending-01 | Código Civil del Estado de Jalisco | …/Código Civil del Estado de Jalisco-240626.pdf | PDF sufijo 240626 | HEAD 200, 2,275,503 B, LM 2026-06-24 |
| jalisco-pending-03 | Código de Procedimientos Civiles del Estado de Jalisco | …/Código de Procedimientos Civiles del Estado de Jalisco-250424.pdf | PDF sufijo 250424 | HEAD 200, 1,372,537 B, LM 2024-04-25 |
| jalisco-pending-06 | Constitución Política del Estado de Jalisco | …/Constitución Política del Estado de Jalisco-291026.pdf | Índice legislativo: 29-oct-2026; PDF sufijo 291026 | HEAD 200, 783,945 B, LM 2026-10-30 |
| nuevo-leon-pending-05 | Ley de Propiedad en Condominio de Inmuebles para el Estado de Nuevo León | https://www.hcnl.gob.mx/trabajo_legislativo/leyes/leyes/ley_de_propiedad_en_condominio_de_inmuebles_para_el_estado_de_nuevo_leon/ | Última reforma 11-oct-2023 | página en vivo (vía navegador real) |
| nuevo-leon-pending-06 | Ley de Mecanismos Alternativos para la Solución de Controversias para el Estado de Nuevo León | https://www.hcnl.gob.mx/trabajo_legislativo/leyes/leyes/ley_de_mecanismos_alternativos_para_la_solucion_de_controversias_para_el_estado_de_nuevo_leon/ | Última reforma 30-dic-2020 | página en vivo |
| nuevo-leon-pending-07 | Ley de Responsabilidades Administrativas del Estado de Nuevo León | https://www.hcnl.gob.mx/trabajo_legislativo/leyes/leyes/ley_de_responsabilidades_administrativas_del_estado_de_nuevo_leon/ | Última reforma 02-oct-2026 | página en vivo |
| nuevo-leon-pending-08 | Ley de Protección de Datos Personales en Posesión de Sujetos Obligados del Estado de Nuevo León | https://www.hcnl.gob.mx/trabajo_legislativo/leyes/leyes/ley_de_proteccion_de_datos_personales_en_posesion_de_sujetos_obligados_del_estado_de_nuevo_leon/ | Última reforma 11-dic-2019 | página en vivo |
| sjf-pending-03 | Tesis aislada 1a. CLXXVI/2013 (10a.), Primera Sala | https://sjf2.scjn.gob.mx/detalle/tesis/2003693 | Época 10a., aislada | render real (navegador), metadatos visibles |
| sjf-pending-04 | Jurisprudencia 1a./J. 186/2025 (11a.), Primera Sala | https://sjf2.scjn.gob.mx/detalle/tesis/2031026 | Época 11a., jurisprudencia | render real (navegador), metadatos visibles |

Cambio de binding con proveniencia notable: `jalisco-pending-06` — el candidato previo (página constitucional de la OIC) resultó obsoleto (versión 2021) frente al índice legislativo oficial (29-oct-2026); el PDF -180424 de `jalisco-pending-03` también quedó obsoleto (actual -250424). Ambos reemplazos documentados en el anexo QA. Advertencia estructural: los sufijos de fecha de Jalisco caducan sin aviso — re-vincular desde el índice legislativo actual antes de cualquier adquisición futura.

Sin candidato exacto seleccionado (siguen `url: null`): jalisco-pending-02/04/05/07/08, nuevo-leon-pending-01/02/03/04, sjf-pending-01/02.

## 2. Robots por fuente (estado observado hoy)

- hcnl.gob.mx: `User-agent: * Allow: /` — rastreo permitido.
- congresoweb.congresojal.gob.mx: robots.txt devuelve HTML suave (soft-404) — sin política robots discernible.
- sjf2.scjn.gob.mx: robots.txt no responde a clientes no-navegador (timeout); el sitio exige navegador real para renderizar.

**Robots permisivo no prueba derechos ni licencia.** robots.txt es una convención de rastreo, no una licencia de contenido; su ausencia tampoco prohíbe. Los derechos se analizan aparte (sección 3) y la revisión de derechos/canal del registro sigue pendiente.

## 3. Base de derechos investigada (no es aprobación; la revisión formal sigue con el proyecto)

Fuente: Ley Federal del Derecho de Autor (México), texto vigente publicado en DOF 14-05-2026, PDF oficial: https://www.diputados.gob.mx/LeyesBiblio/pdf/LFDA.pdf

Artículo 14, fracción VIII (texto exacto):

> "VIII. Los textos legislativos, reglamentarios, administrativos o judiciales, así como sus traducciones oficiales. En caso de ser publicados, deberán apegarse al texto oficial y no conferirán derecho exclusivo de edición;
>
> Sin embargo, serán objeto de protección las concordancias, interpretaciones, estudios comparativos, anotaciones, comentarios y demás trabajos similares que entrañen, por parte de su autor, la creación de una obra original;"

Lectura operativa para este corpus:
- Los textos legislativos y judiciales objetivo (leyes NL/Jalisco, tesis SJF, legislación federal) **no son objeto de protección como derecho de autor** en México.
- Condiciones: apego al texto oficial; ninguna publicación confiere derecho exclusivo de edición.
- Anotaciones, comentarios y trabajos originales de terceros SÍ están protegidos — excluirlos de cualquier ingesta.
- Los términos de uso del sitio y las condiciones del canal son una cuestión separada del derecho de autor; la fuente SJF exige navegador real y su robots es indeterminado, por lo que su vía queda documentada-sin-ejecutar.
- La fuente federal `diputados-fed` ya tiene `rightsReview.status: approved` en el registro (revisión previa del proyecto). Las fuentes Jalisco/NL/SJF mantienen revisión pendiente: este borrador es insumo, no sustituto.

## 4. Ruta de ejecución propuesta (cuando exista autorización)

1. Jalisco/NL: ingesta vía `scripts/legal-acquisition.mjs` tras `rightsReview: approved` de cada fuente y `status: approved` de cada documento; límites existentes (presupuesto de peticiones, rateMs) sin cambios.
2. SJF: vía documentada en `docs/qa/public-corpus-slot-verification-2026-11-11.md` (navegador real; sin cliente programático). No automatizable por el pipeline actual.
3. Jalisco: re-vinculación obligatoria desde el índice legislativo vigente antes de ejecutar (sufijos caducables).

Nada en este borrador autoriza gasto, egreso de contenido privado, ni envío de datos a terceros.
