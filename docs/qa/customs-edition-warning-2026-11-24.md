# Conservar la advertencia de edición en documentos derivados

Base: 20a2376. La referencia local de Ley Aduanera ya contiene un aviso específico de reforma posterior respecto a la copia seleccionada. El visor lo conserva en summary, pero renderResearchNote, renderTradeReading y renderFollowup lo omitían de sus textos derivados y dejaban solo un aviso genérico.

Se conserva ese summary existente en la nota, lectura y seguimiento como Advertencia de la copia consultada. Se deduplica cuando dos referencias de la misma ley comparten el aviso. No se interpreta una reforma, se modifica la fuente ni se afirma vigencia. La advertencia corresponde a la copia local, no a una revisión actual del sitio oficial. Los mensajes enviados al proveedor no cambian.

Pruebas antes FAIL/después PASS en notas de una/dos fuentes, abstención, lectura y seguimiento; condiciones y citas completas permanecen y los sobres son idénticos antes/después de renderizar. Suite portable de piloto/worksheet/KB/remedy: 17 pruebas. Build sin errores. Exportación real del servicio piloto con expediente cifrado, pregunta revisada y respuesta sintética: DOCX releído con mammoth y renderizado a PDF de dos páginas. La advertencia y nota al pie están en página 1, la tabla poblada con Ley Aduanera/artículo 65/enlace en página 2; ambas inspeccionadas. La muestra inicial directa usó citations vacío y no sirve como prueba de exportación de expediente. No se modificó el exportador para ocultar esa diferencia.

No se activa índice general ausente, skill, modelo ni nueva fuente. No se ensaya modelo real ni verifica legislación en línea. Las notas ya guardadas no se reescriben: el cambio afecta textos nuevos generados por estos renderizadores. Las tareas AD29/TMEC conservan sus avisos existentes sin alteración.
