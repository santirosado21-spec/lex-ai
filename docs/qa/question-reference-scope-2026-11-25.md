# Alcance explicito de articulos sin subconjunto silencioso

Base0d63dba. Repro de API real, no helper aislado: inspectQuestion con articulos66–70 o66 a70 mostraba solo66; lista66,67y68 se truncaba globalmente a8pasajes sin avisar. El helper questionCandidates sin explicitArticleReference retornaba0 y no representaba el flujo del servicio. Se corrigio esa interpretacion antes de proponer el cambio.

No se agrega soporte de rangos ni corpus. listedArticleReferences rechaza rango numeral explicito (guion/en dash/em dash/a/al/hasta, incluidos sufijos/letras/lista antes del rango) con reformulacion. questionCandidates rechaza referencia explicita que reuna mas de8pasajes antes de ranked slice; no cambia ranking ni busqueda tematica. Lista97y117(6) yreglamento150y174(3) siguen disponibles. Singular68(8) conservaVIII;36-A conserva3. No modelo/nube/paquete/Mac activados.

API real y UI componente real con servicio real; lector local de anonimización simulado existente, sin inferencia. Rango y lista>8 muestran error, conservan pregunta y no ofrecen preparar subconjunto. Reformular97y117 devuelve6 y permite preparacion callback, no genera. Chrome1280/390 inspeccionado legible/sin overflow. Retirar por separado guardia de rango o de limite hace fallar regresion; restauradas.

Workflow57archivos365tests362PASS3SKIP0FAIL; buildPASS; API smokePASS. Nueva regresion se incluye en workflowUI y contiene dos tests API/UI. Pruebas juridicas/inferencia/Mac no ejecutadas. No se afirma cobertura completa del parser: cierre focal de rangos indicados y limite de candidatos explicitos.

Revision focal sin bloqueo: la guardia de rango vive en explicitArticleReference y alcanza todos sus flujos del servicio, no solo Ley Aduanera; el limite8 es del piloto de preguntas explicitas. Coste deliberado:66+67 deben consultarse por separado porque suman14pasajes. Falso positivo menor observado por revisor: articulo65 a2clientes se lee como rango y pide reformular; falla cerrado, no produce respuesta parcial. No se amplia parser para corregir esa ambigüedad en este corte. Revision externa no ejecuto UI/end-to-end, que si cubre la evidencia del autor.
