# UI cycle 3 — continuidad del expediente

## Dirección y referencias

Codex implementa e integra. Claude Opus 5.5 dirigió el diseño mediante la consulta real verificada por el orquestador, conservada en `docs/architecture/design-cycle-3.md`. La primera llamada del worker falló por autenticación; no se presenta como consulta exitosa. La llamada posterior de root confirmó `claude-opus-5-5`.

Referencias inspeccionadas en la pestaña 21st.dev del usuario, sin ejecutar instaladores ni copiar dependencias:

- [Action Searchbar](https://21st.dev/@koustubhayadiyala36/components/action-searchbar): búsqueda compacta, resultados con icono y metadatos, teclado y pie de atajos.
- [Activity Feed](https://21st.dev/@felipemenezes098/components/item-19): actividad en filas con acción, detalle y fecha.
- [File List Item](https://21st.dev/@felipemenezes098/components/item-14): archivos en filas compactas, icono por formato y acciones contextuales.

Se consultaron dsystem, React best practices y frontend-design oficial en caché. La implementación conserva el sistema Mesa limpia: blanco/gris, tipografía local y azul reservado a evidencia/foco.

## Funciones implementadas

- Cmd/Ctrl+K abre búsqueda de acciones, nombres de documentos y preguntas guardadas del asunto activo. Normalización sin acentos; flechas, Home/End, Enter y Escape. Escape limpia la búsqueda antes de cerrar. No busca contenido completo de archivos ni otros asuntos.
- Biblioteca con filtros por nombre y formato, orden por nombre/fecha, contador anunciado y reinicio de filtros al cambiar de asunto.
- Expediente con estadísticas y actividad derivada de importaciones, respuestas y feedback. Excluye fechas inválidas; no simula agenda, tareas, plazos o actuaciones oficiales.
- Lector de texto extraído con búsqueda y navegación de coincidencias, panel paralelo de última respuesta/evidencia, y selección de extracto hacia el composer. Cmd/Ctrl+Shift+A o botón abre la consulta sin enviarla. El aviso declara recuperación del asunto completo.
- Modelos y evaluación consume `training.status`, actualiza cada 8 segundos solo montado/visible y presenta únicamente datos reales recibidos. El candidato experimental no se activa ni se descarga desde esta vista.

Las colecciones persistentes, tareas y entrenamiento desde UI requieren APIs futuras y no aparecen como controles ficticios. El lector es un diálogo amplio apilable, manteniendo el retorno al contexto de biblioteca; no simula páginas del original. La evidencia en el panel corresponde al último análisis del asunto y se etiqueta así.

## Validación

`npm run build`: TypeScript y Vite PASS. El worker no pudo abrir loopback por sandbox (`listen EPERM`); root ejecuta el smoke con permisos de su sesión. Primer smoke ampliado PASS: onboarding, importación, filtros, paleta, expediente, fuentes, entrenamiento, exportación, feedback/evaluación/aprobación/rollback y responsive700. Smoke final ampliado PASS (2026-10-30T13:07:05Z), incluyendo búsqueda dentro del lector, selección de extracto y Escape en dos pasos.

Todas las pruebas usan documentos sintéticos y una inferencia explícitamente simulada; no prueban la calidad de Gemma. Fixtures de monitor y entrenamiento viven en el directorio temporal del test y no alteran el entrenamiento real.

Capturas: `artifacts/ui-library.png`, `ui-dossier.png`, `ui-command-palette.png`, `ui-training.png`, además de Inicio/Asistente/Fuentes/responsive. Reporte ejecutable: `scripts/ui-smoke.mjs`; resultado: `artifacts/ui-smoke.json`.

## Biblioteca federal

La vista `Biblioteca federal` usa `library.status/search/source` directamente. No carga el corpus completo en `state`: solo catálogo de leyes, diez resultados por página y un artículo completo al abrirlo. Filtra por instrumento, conserva términos aplicados al paginar y descarta respuestas obsoletas al salir o iniciar otra consulta. La paginación respeta el límite de offset1000.

El lector distingue vista previa de texto completo, presenta versión, recuperación, páginas y hashes y permite copiar referencia o extracto seleccionado con referencia. La vigencia siempre aparece no verificada. Ausencia del índice y fallo de integridad muestran estados distintos; no hay descarga implícita ni fallback presentado como biblioteca completa. Investigación conserva su flujo previo.

El smoke construye un índice sintético temporal de12 artículos y dos instrumentos: comprueba filtro, páginas10+2 y artículo completo mayor12.000caracteres (marcador final fuera de la vista previa). Producción consulta el índice público real instalado, sin fixtures ni datos privados.

## Empaquetado 0.3.0 e índice completo

La versión 0.3.0 incorpora el índice público completo instalado por el orquestador: **303 instrumentos y 35.452 artículos**. Estas cifras describen el snapshot indexado, no toda la legislación mexicana ni una certificación de vigencia. Los componentes consultan las cifras de `library.status`; no las fijan en el código de la UI.

`scripts/ui-real-library-smoke.mjs` utiliza `resources/public-library.sqlite` real y crea únicamente un despacho sintético temporal. Verifica las cifras del snapshot, busca CCF1797, abre su texto completo y captura escritorio y700px. La inicialización/inferencia del motor están prohibidas expresamente en el doble de prueba; no se presenta como evaluación de Gemma. Root debe ejecutarlo donde esté permitida la escucha loopback.

`scripts/verify-package.mjs` verifica versión nativa y paquete0.3.0, firma local, hashes de módulos/recursos, `sources.status`, índice303/35.452, búsqueda/lectura CCF1797 y `training.status`. Es una comprobación del bundle construido; no crea ni firma el bundle. Escribe `artifacts/cycle-3-package-check.json`, incluyendo fallos.

`scripts/package-dmg.sh` deriva la versión de package.json y conserva artefactos anteriores: si ya existe el nombre de esa versión, añade fecha UTC y PID. No usa sobrescritura `hdiutil -ov`. La preparación del worker solo comprobó sintaxis; compilación nativa, firma, DMG y prueba del bundle corresponden a la sesión root.
