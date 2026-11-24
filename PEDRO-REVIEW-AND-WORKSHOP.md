# Rejon: revisión de aportaciones de Pedro y Taller integrado candidato

24 de noviembre de 2026. Base comprobada de origin/main: `4ad70b41d74794e85bad9d297004ab9618cc11a6`. Remoto actualizado sin cambios respecto a esa base. No se modificó main, Mac, corpus activo ni configuración de modelos.

## Inventario y autoría

Se localizaron seis ramas `origin/pedro/*` y dos `origin/codex/citation-fractions-*` con trabajo atribuido en Git a Pedro Cordero Gutierrez. Las puntas consultadas son del 11 de noviembre. Ninguna de esas puntas es antecesora del main actual. Esto no prueba que no exista trabajo suyo en otro repositorio o sin publicar. No se atribuyen a Pedro los commits registrados bajo otro autor.

| Rama remota | Punta | Contenido y resultado de revisión |
| --- | --- | --- |
| pedro/cordelius-ideas-rejon-20261111 | c756ed9 | Propuestas de producto y Taller. Documentales, no funciones activas. |
| pedro/taller-modular-simulado-20261111 | b05069a | 24 módulos y cinco plantillas, composición/importación/exportación sin ejecución. 18/18 pruebas propias de la rama reproducidas. Seleccionado para integración reversible. |
| pedro/radares-publicos-contrato-20261111 | 0a078e1 | Parser offline público, estados separados de error/sin novedades. 17/17 reproducidas. No adquiere fuentes ni ejecuta n8n. Bloquea query strings deliberadamente, por lo que no admite aún los enlaces DOF codigo/fecha del corte actual. No se debilitó esa barrera. |
| pedro/pre-egress-review-demo-20261111 | 078efd9 | Demo HTML con canarios conocidos y aprobación invalidada tras ediciones. 14/14 reproducidas. No demuestra detección general ni protege datos reales; no tiene envío. |
| pedro/h5b2c-pseudonym-maps-20261111 | ee2298c | Código Rust para historial local de mapas, CAS y referencias a originales. Revisión estática del módulo; sin compilador Rust disponible para reproducir. No se valida cifrado, broker, autorización de usuarios ni integración con piloto. |
| pedro/sqlcipher-portability-proposal-20261111 | d6927f6 | Propuesta documental Windows/Linux. No compilación, distribución ni elección de proveedor realizada. No se adoptó ni se verificaron nuevamente sus enlaces externos/licencias. |
| codex/citation-fractions-v1 | e59f0e6 | Parser estructural de artículos/fracciones y reporte de posibles rechazos. 17/17 reproducidas. No precisión jurídica ni cambio de aceptación, no integrado. |
| codex/citation-fractions-ci-v1 | b27996e | Variante de contratos/CI de citas. 14/14 reproducidas. No es ancestro de la otra punta; no mezclar ambas como idénticas. |

Los resultados son ejecuciones locales sobre snapshots exactos, no comprobación de estados CI actuales ni revisión exhaustiva de cada línea histórica. Los hashes completos y autoría se pueden consultar con Git en las referencias nombradas.

## Incorporación selectiva del Taller

Se copiaron los cuatro archivos de módulo de la rama de Pedro y su prueba, conservando su contenido salvo el arreglo acotado descrito abajo. Se añadieron únicamente importación, tipo de página, entrada de menú, grupo de navegación y render en el App.tsx actual. No se copió el App.tsx antiguo entero, pues perdería cambios posteriores del piloto. Se añadió una entrada de previsualización aislada para pruebas `#preview=workshop` en main.tsx, sin API ni datos.

La autoría de catálogo, vista, estilos y contratos originales corresponde a la rama de Pedro. Este paquete aporta adaptación al main actual, regresión UI y arreglo de carrera asíncrona. No contiene merge ni commit atribuido a Pedro por cambios ajenos.

### Defecto comprobado y corregido

Una importación JSON pendiente podía finalizar después de que el usuario eligiera otra plantilla y sobrescribir su decisión más reciente. Se reprodujo en el bundle Vite real con lectura File.text diferida: al elegir Litigio después de iniciar importación, la pantalla volvía a Regulatorio al terminar la lectura.

Se añadió una revisión monotónica local: una elección o modificación más reciente invalida una importación antigua. La misma regresión falló antes y pasó después. No añade persistencia ni red. Un JSON inválido conserva el plan anterior.

## Medición de esta incorporación

- TypeScript y Vite: PASS, con advertencia de tamaño de bundle, no error.
- 41/41 pruebas: 18 del Taller y 23 de biblioteca/barreras existentes.
- Chrome headless, bundle Vite real: plantillas, dependencia que impide quitar un módulo requerido, agregar/ordenar, exportar JSON, importar válido, rechazar extra inválido sin cambiar plan, limpieza al recargar, carrera de importación, móvil de 390 px sin overflow horizontal, cero excepciones y cero llamadas API/remotas en previsualización.
- App completa con backend y despacho ficticio temporales: navegación desde menú al Taller, selección de plantilla, Biblioteca federal aún accesible y regreso al Taller. Al salir se descarta el plano no guardado, como comportamiento de simulación. Cero inicializaciones o generaciones de modelo; inferencia sustituida por objeto de prueba, no modelo real.
- Capturas reales inspeccionadas de App, previsualización desktop y móvil. No prueba Mac/WKWebView/Tauri, lector de pantalla ni rendimiento de 8 GB.

## Uso y límites

Paquete candidato para revisión en copia separada del commit base. `git apply --check pedro-workshop.patch` antes de aplicar. No sobrescribir WIP ni instalar sobre app activa. Las pruebas UI incluidas usan Chrome Linux y /downloads; requieren adaptación para otros equipos. No se ejecutó en Mac ni se reanudó GLM.

No se conectan herramientas, radares, n8n, expedientes ni credenciales. El plano solo contiene IDs/orden del catálogo y no se guarda automáticamente. Las herramientas visibles siguen en simulación; agregar un módulo no lo ejecuta. No sustituye los gates de privacidad o de calidad jurídica. No comparte archivos de clientes ni activa mapas seudónimos.

La integración DOF es otro corte separado. No se combinó silenciosamente en esta copia; ambas afectan main.tsx y deben reconciliarse mediante delta explícito y prueba conjunta antes de cualquier adopción.
