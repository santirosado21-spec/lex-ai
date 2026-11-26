# Consulta: descartar revisión anterior después de cambiar artículo o reservas

Base cb6f2cf. Reproducción antes del arreglo: una respuesta tardía de inspectQuestion vuelve a mostrar el pasaje anterior después de cambiar reservationRevision. El mismo riesgo afecta al reemplazo de articleInquiry.

La UI cancela e invalida la inspección al cambiar reservas, reemplazar el artículo o desmontar el componente. Cada inspección captura una época. Sólo su época vigente puede guardar resultado, error o liberar busy. El guard de época sigue siendo necesario si el transporte ignora abort.

Prueba Chrome: tres escenarios con fetch del navegador que deliberadamente ignora la señal de abort: respuesta tardía tras reservas, respuesta tardía tras artículo y error tardío tras artículo. Las aserciones esperan consumo del cuerpo de respuesta en el navegador y dos frames de React. No aparecen fundamento ni botón de preparar mensaje de la pregunta anterior. En el tercer escenario A falla mientras B sigue pendiente: no aparece error de A, y textarea y búsqueda siguen deshabilitados hasta responder B. Después B termina y libera la UI. Mutaciones separadas de las guardas de resultado, error y finally fallan cada una; restaurado, pasa. Dos pruebas preexistentes de alcance de referencias también pasan, total focal 3/3, build PASS.

Capturas 1100 y 390 px inspeccionadas: texto actual legible, no desbordamiento horizontal. Respuestas de la API simuladas. No se ejecutaron modelos, nube ni Mac, no se modifica backend ni autorización. No es un arreglo general de todas las operaciones asíncronas de la consulta: refine, toggleOriginals y callbacks de selección tienen su propia revisión pendiente si su contexto cambia en vuelo. No se afirma suite completa ni validación jurídica.

Corrección tras revisión independiente: la primera prueba de error tardío usaba una espera fija insuficiente y no cubría finally de A mientras B estaba pendiente. Esa evidencia se reemplaza por sincronización y mutaciones separadas. No se midió desmontaje; es comportamiento implementado, no cobertura afirmada. Esta revisión sólo cambia prueba y nota, no el código de la app.
