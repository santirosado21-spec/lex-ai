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

### Segunda tanda de bindings (misma fecha, verificación en vivo)

| slot | documento | URL oficial | versión declarada por la fuente | vía de verificación |
| --- | --- | --- | --- | --- |
| jalisco-pending-02 | Código Penal para el Estado Libre y Soberano de Jalisco | …/Código Penal para el Estado Libre y Soberano de Jalisco -271026.pdf | PDF sufijo 271026 | HEAD 200, 1,227,998 B, LM 2026-10-27 |
| jalisco-pending-04 | Código Fiscal del Estado de Jalisco | …/Código Fiscal del Estado de Jalisco-220726.pdf | PDF sufijo 220726 | HEAD 200, 530,974 B, LM 2026-07-22 |
| jalisco-pending-05 | Código Electoral del Estado de Jalisco | …/Código Electoral del Estado de Jalisco-300926.pdf | PDF sufijo 300926 | HEAD 200, 1,133,292 B, LM 2026-09-30 |
| jalisco-pending-07 | Código Urbano para el Estado de Jalisco | …/Código Urbano para el Estado de Jalisco-080726.pdf | PDF sufijo 080726 | HEAD 200, 1,139,227 B, LM 2026-07-08 |
| jalisco-pending-08 | Código de Asistencia Social del Estado de Jalisco | …/Código de Asistencia Social del Estado de Jalisco-251125.pdf | PDF sufijo 251125 | HEAD 200, 627,545 B, LM 2025-11-26 |
| nuevo-leon-pending-01 | Código Civil para el Estado de Nuevo León | https://www.hcnl.gob.mx/trabajo_legislativo/leyes/codigos/codigo_civil_para_el_estado_de_nuevo_leon/ | Última reforma 26-jun-2026 | página en vivo (HTTP 200) |
| nuevo-leon-pending-02 | Código Penal para el Estado de Nuevo León | https://www.hcnl.gob.mx/trabajo_legislativo/leyes/codigos/codigo_penal_para_el_estado_de_nuevo_leon/ | Última reforma 15-jun-2026 | página en vivo (HTTP 200) |
| nuevo-leon-pending-03 | Código de Procedimientos Civiles del Estado de Nuevo León | https://www.hcnl.gob.mx/trabajo_legislativo/leyes/codigos/codigo_de_procedimientos_civiles_del_estado_de_nuevo_leon/ | Última reforma 10-jun-2022 | página en vivo (HTTP 200) |
| nuevo-leon-pending-04 | Ley de los Derechos de Niñas, Niños y Adolescentes para el Estado de Nuevo León | https://www.hcnl.gob.mx/trabajo_legislativo/leyes/leyes/ley_de_los_derechos_de_ninas_ninos_y_adolescentes_para_el_estado_de_nuevo_leon/ | Última reforma 07-nov-2025 | página en vivo (HTTP 200) |
| sjf-pending-01 | Jurisprudencia P./J. 39/2026 (12a.), Pleno — alerta registral y protección de datos personales | https://sjf2.scjn.gob.mx/detalle/tesis/2031956 | Época 12a., jurisprudencia | render real (navegador), metadatos visibles |
| sjf-pending-02 | Jurisprudencia P./J. 211/2026 (12a.), Pleno — registro digital de contratos de arrendamiento | https://sjf2.scjn.gob.mx/detalle/tesis/2032822 | Época 12a., jurisprudencia | render real (navegador), metadatos visibles |

Evento de caducidad observado en esta tanda: el candidato previo de `jalisco-pending-02` (Código Penal -240626, propuesto 2026-11-10) ya fue reemplazado en el índice por -271026 (LM 2026-10-27). Segunda caducidad de sufijo Jalisco en dos días: confirma que la re-vinculación desde el índice legislativo vigente es obligatoria antes de cualquier adquisición.

Las 4 plazas Jalisco sin candidato previo (04/05/07/08) se llenaron con los códigos estatales restantes del índice oficial: Fiscal, Electoral, Urbano y Asistencia Social.

Con esta tanda, las 20 plazas pendientes del registro tienen binding oficial verificado; el registro ya no contiene `url: null`. Ningún documento cambia de `status`: todos siguen `pending`.

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

## 4. Estado de ejecución al 2026-11-11 (acotado, en cuarentena)

- diputados-fed: ejecutado — 10/10 documentos, estado `complete` (`artifacts/public-corpus/pilot/`).
- nuevo-leon: fuente aprobada tras revisión del 2026-11-11 (`docs/research/public-corpus-rights-review-2026-11-11.md`); ejecutado — 8/8 documentos, estado `complete` (`artifacts/public-corpus/pilot-mx-nle-2026-11-11/`). Bindings corregidos de página HTML a PDF exacto.
- congreso-jalisco: derechos revisados y resueltos; **canal bloqueado** — robots.txt redirige 301 a página de error y el pipeline falla cerrado (`robots-unavailable`). Documentos de vuelta a `pending`. Decisión pendiente del proyecto: política de robots o canal oficial alterno.
- sjf: pendiente — el canal oficial alterno ya existe (Gaceta del SJF en PDF sobre www.scjn.gob.mx, robots sin restricción para /sites/default/files/, compatible con el pipeline); la única cuestión abierta son los términos SCJN (cláusula anti-comercialización vs LFDA Art. 14 VIII), decisión del responsable del producto; ver `public-corpus-rights-review-2026-11-11.md`.

## 5. Ruta de ejecución propuesta para lo pendiente

1. Jalisco: tras resolver la política de robots/canal, re-vinculación desde el índice vigente e ingesta vía `scripts/legal-acquisition.mjs` con los límites existentes.
2. SJF: vía documentada en `docs/qa/public-corpus-slot-verification-2026-11-11.md` (navegador real; sin cliente programático). No automatizable por el pipeline actual.
3. Jalisco: re-vinculación obligatoria desde el índice legislativo vigente antes de ejecutar (sufijos caducables).

Nada en este borrador autoriza gasto, egreso de contenido privado, ni envío de datos a terceros.
