# Rejon: integración de la vista DOF en desarrollo

24 de noviembre de 2026

## Estado del proyecto

Integración candidata preparada sobre el commit `4ad70b41d74794e85bad9d297004ab9618cc11a6` de Rejon. No se ha aplicado a la app instalada del Mac ni a la biblioteca activa. El trabajo permanece en una copia de desarrollo separada.

El alcance es una vista de revisión de fuentes, no búsqueda de derecho vigente ni generación de respuestas jurídicas. El contenido y los hashes del corte se describen en `DOF-FIXED-DEV-CUT.md`.

## Diseño implementado

- Entrada React delimitada `#review=dof`, con búsqueda, selección, condiciones en español, texto fuente y detalles técnicos plegables.
- Uso del cliente API y backend reales del proyecto. Acciones autenticadas `dofReview.status`, `dofReview.search` y `dofReview.record`, habilitadas solo mediante opción explícita de desarrollo. No se mezclan con las acciones de biblioteca principal.
- Captura HTML original por una ruta separada, con sandbox y sin ejecución de scripts ni acceso de red desde la captura. Enlace adicional a la publicación DOF.
- SQLite de revisión separado, abierto solo para lectura. Verificación de hashes exactos de candidato, captura e índice antes de permitir su uso. No se reconstruye el índice al abrir ni se admite un hash alternativo en el arranque.
- Condiciones exactas por registro, sin campos extra ni valores arbitrarios. La validación se aplica tanto al candidato como al índice abierto.
- Lanzador de desarrollo con directorio temporal nuevo, puerto libre asignado por el sistema, biblioteca principal ausente deliberadamente e inferencia deshabilitada. No necesita cargar modelos ni detener otras aplicaciones.

## Comportamiento de la vista

La consulta inicial muestra Aviso de Cruce. Una consulta de manifestación de valor muestra que el texto es una modificación parcial y explica los límites temporales. Las filas de anexo se identifican como filas parciales, no como apéndices completos.

Sin coincidencias, se vacían el texto, las condiciones, los detalles y las acciones del fragmento anterior. Se evitan respuestas asíncronas antiguas que sobrescriban una selección más reciente. Una consulta superior a 200 caracteres conserva el panel anterior y muestra un error visible; es un residual conocido, no una corrección completada.

La ruta se selecciona al cargar. Todavía no hay acceso desde el menú principal de la aplicación. No se ha probado el comportamiento de ventanas o enlaces dentro de WKWebView/Tauri.

## Evidencia disponible y sus límites

El autor comprobó el build TypeScript/Vite y la UI React con backend real en Linux. Inspeccionó capturas desktop, móvil y sin resultados. El flujo automatizado abrió la captura original, no la publicación DOF remota. Las pruebas del autor llegaron a 30/30 tras los cambios de integridad.

La revisión independiente comprobó seis pruebas de integración, una UI React empaquetada de forma aislada y el contenido/hashes del índice. Usó simulaciones para las demás dependencias del backend. No comprobó el build Vite completo, la aplicación completa, las 30 pruebas ni el último cambio del pin fijo. No deben combinarse estos alcances como si todos hubieran verificado lo mismo.

La prueba Mac anterior corresponde al prototipo portable, no a esta integración React. El contenido documental ya había tenido revisión sustantiva acotada de los nueve textos. Eso no equivale a consolidación normativa ni certificación general de vigencia.

## Próxima comprobación concreta

Cuando se autorice reabrir la prueba en Mac: usar una copia separada del commit base y el corte completo, verificar que no se modifica ninguna sesión ni biblioteca existente, abrir la vista y comprobar búsqueda, condiciones, captura, enlace DOF y limpieza de selección. Después comprobar WKWebView/Tauri, navegación y accesibilidad. No confundir una prueba en navegador con una prueba en app instalada.

Este documento omite instrucciones operativas antiguas. No se debe preparar un índice nuevo y aceptar automáticamente su hash durante el mismo arranque. Cualquier cambio de contenido o artefacto queda fuera del pin actual y necesita su propia comprobación antes de usarse.

## Riesgos para evaluar

¿La pantalla deja suficientemente claro que un fragmento no es una norma completa o vigente? ¿Las condiciones siguen visibles al cambiar de resultado? ¿Los enlaces y el lenguaje inducen confianza mayor que la evidencia? ¿El pin exacto y su alcance están bien delimitados, sin presentarlos como protección externa o validación jurídica? Se buscan defectos concretos y comprobables, sin inventar artículos, fechas, capacidades o resultados pendientes.
