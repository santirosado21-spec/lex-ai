# Biblioteca jurídica nacional local: referencia Luthor

Fecha: 2026-11-04. Requisito del dueño: contar con una base de datos comparable funcionalmente a la referencia https://luthor.mx/despachos/, conservando privacidad local y un núcleo ligero para equipos de 8 GB.

Este documento concreta el objetivo y las brechas; no declara adquirido un corpus nacional, equivalencia con Luthor o implementación de las funciones pendientes. La revisión consultó páginas públicas y archivos públicos del proyecto. No abrió expedientes privados, conectó MCP remoto ni descargó masivamente contenido.

## Dos bases con finalidades distintas

La [página para despachos de Luthor](https://luthor.mx/despachos/) combina investigación jurídica con expedientes, contactos, contratos, calendario y seguimiento. En LEX AI deben mantenerse dos capas:

- **Conocimiento jurídico público:** legislación, criterios judiciales, versiones, reformas y procedencia. Se prepara para distribución y consulta local.
- **Trabajo privado del despacho:** clientes, asuntos, escritos, notas, contratos, tareas y chats. Permanece en el equipo y dentro de su ámbito autorizado; no se incorpora al corpus público, entrenamiento o paquetes de actualización.

El entrenamiento enseña a usar la biblioteca; no sustituye la biblioteca ni debe intentar memorizarla como fuente de citas.

## Qué muestra la referencia

La [wiki](https://luthor.mx/wiki/) presenta legislación por artículos; el [archivo de tesis](https://luthor.mx/tesis/) distingue criterios del Poder Judicial y del TFJA, con búsqueda por rubro, texto, registro y época. Su [bitácora](https://luthor.mx/actualizaciones/) describe publicaciones del corpus conservando revisiones anteriores y cambios por disposición.

En las páginas devueltas durante esta revisión, su [catálogo normativo](https://luthor.mx/scjn/) anuncia 113.602 ordenamientos y distingue 9.838 incorporados. La página de tesis más reciente devuelta anuncia 312.193 del Poder Judicial, capturadas al 30-10-2026, y 48.262 del TFJA; una respuesta anterior de la misma herramienta mostró un corte anterior con 312.122. Son cifras publicadas por el proveedor, no una auditoría independiente.

**Catalogar un enlace no equivale a tener el texto íntegro, indexarlo o comprobar su vigencia.** Tampoco son comparables sin más una colección selecta de artículos, un censo histórico y un archivo judicial. La referencia sirve para definir funciones y trazabilidad, no para anunciar igualdad por contar filas.

## Punto de partida medido en LEX AI

Conteo directo de los recursos públicos del proyecto, sin modificar las bases:

| Recurso | Medición | Límite |
|---|---:|---|
| `resources/public-library.sqlite` | 35.452 registros de artículos; 303 instrumentos; 153.014.272 bytes | Jurisdicción etiquetada MX-FED; no acredita legislación completa, vigencia ni exactitud semántica de extracción. |
| `resources/state-library.jsonl` | 5.304 registros; cinco instrumentos; 10.674.280 bytes | Jalisco: dos instrumentos/2.882 registros. Nuevo León: tres/2.422. No son las 32 entidades. |
| Catálogos federales del corte histórico | 317 leyes y 163 enlaces de reglamentos | Son inventarios de adquisición; no afirmar 480 textos completos en la biblioteca distribuida. |
| Tesis, jurisprudencias y relaciones entre criterios | Sin acervo distribuido comparable identificado | Brecha prioritaria. El índice federal actual representa artículos; no implementa una ficha judicial completa. |
| Reformas y consultas históricas | Existen metadatos y snapshots | Falta acreditar reconciliación de decretos/transitorios y comparación temporal sistemática. |

La base federal tiene FTS5, consulta paginada y caché SQLite configurada en 16 MiB. El adaptador estatal actual es **de búsqueda exacta por ley/artículo** y carga el pequeño JSONL congelado en memoria. No basta ampliar ese archivo para tener búsqueda temática nacional: hay que migrar el contenido estatal a índices en disco y ampliar su recuperación. El lector federal también impone un máximo de 1 GiB por índice; una colección judicial grande necesita paquetes y presupuestos explícitos, no eliminar guardas sin medir.

El informe reproducible con hashes y estados está en `artifacts/luthor-reference-20261104/coverage-audit.json`. Las cifras describen archivos del proyecto; no se verificó su igualdad con cada instalación distribuida. La cobertura histórica en `docs/legal-library-coverage.md` conserva su fecha y sus limitaciones.

## Capacidades que debe tener nuestra biblioteca

1. **Legislación:** instrumentos federales y estatales, artículos/fracciones/transitorios, fuente y ámbito territorial. Reglamentos, tratados y normativa administrativa según disponibilidad y evaluación; municipios con universo declarado.
2. **Criterios judiciales:** registro digital o identificador oficial, rubro, texto, órgano, época, materia, circuito cuando proceda, tipo de criterio, publicación y precedentes. Distinguir jurisprudencia y tesis aislada, y conservar notas de sustitución, interrupción y relaciones cuando la fuente las proporcione. No deducir obligatoriedad solo de una etiqueta o fecha.
3. **Historia normativa:** texto y fuente por versión; publicación, reforma, vigencia y captura como fechas distintas. Estado desconocido explícito; los transitorios pueden impedir usar la fecha de publicación como inicio de aplicación.
4. **Búsqueda:** exacta por referencia y temática, filtros de jurisdicción/materia/órgano/fecha y resultados con pasajes consultables. El agente debe recuperar automáticamente sin exigir que el abogado navegue primero por la biblioteca.
5. **Trazabilidad:** cada conclusión debe poder abrir su pasaje y fuente/versiones. La existencia textual de una cita no demuestra que sustente la conclusión o que sea aplicable al asunto.
6. **Cobertura visible:** separar descubierto, descargado, extraído, rechazado, revisado, indexado y publicado; mostrar actualización y lagunas. Una región no instalada no se presenta como cubierta ni dispara una consulta remota con hechos privados.

## Organización de datos propuesta

Entidades conceptuales para diseñar una migración reversible, **todavía no tablas implementadas**:

| Entidad | Propósito |
|---|---|
| `sources` y `acquisition_attempts` | Editor/URL oficial, política y base de reutilización, fecha de captura, hashes, errores y método de extracción. |
| `instruments`, `instrument_versions`, `provisions` | Identidad estable del ordenamiento y texto por versión/artículo/fracción/transitorio con páginas o localizadores. |
| `judicial_criteria`, `criterion_versions` | Ficha y texto de criterios con identificadores oficiales y captura de las notas publicadas. |
| `legal_relationships` | Remisiones, reformas y relaciones entre criterios con evidencia de su origen; inferencias editoriales separadas de relaciones oficiales. |
| `change_events` | Decreto/publicación, disposiciones afectadas y tratamiento de transitorios, preservando el historial. |
| `releases`, `release_items`, `coverage` | Paquete publicado, versiones incluidas, comprobaciones, cobertura y exclusiones. |

Cada registro debe conservar el texto de origen y distinguirlo de resúmenes/editorial; las fechas no verificadas quedan nulas. Los IDs no se basan únicamente en títulos que cambian. El esquema público debe permanecer separado de las tablas de clientes y asuntos.

## Fuentes y adquisición

Construir el acervo desde canales oficiales verificables. La similitud de producto no implica licencia sobre la recopilación, comentarios o software de Luthor. Sus [términos](https://luthor.mx/terminos/) identifican derechos del operador/licenciantes; no se encontró en las páginas revisadas una autorización general para copiar su base completa.

| Familia | Fuente inicial | Pendiente antes de ingesta amplia |
|---|---|---|
| Legislación federal | Cámara de Diputados y publicaciones DOF | Extracción completa, reformas/transitorios y vigencia documentada. |
| Legislación de las 32 entidades | Congresos y periódicos/gacetas oficiales; OJN como catálogo auxiliar | Resolver URL y editor por instrumento; validar contenido en lugar de tratar índices como textos. |
| Tesis y jurisprudencias del Poder Judicial | [Semanario Judicial de la Federación](https://sjf2.scjn.gob.mx/busqueda-principal-tesis) | Canal permitido y reproducible de adquisición, identificadores, metadatos, historial y cobertura. La consulta web accesible no acredita un permiso ni una API de descarga masiva. |
| Criterios TFJA | [Sistema oficial del TFJA](https://tfja.gob.mx/cesmdfa/sctj/scjn/) y publicaciones oficiales enlazadas | Confirmar rutas de producción, cobertura por época y extracción de fichas. No basar un conector de distribución en un host de pruebas. |
| Tratados y otras normas | SRE, DOF y autoridades competentes | Separar firma/publicación/aplicación y verificar fuente y condiciones por colección. |

La [LFDA consultada](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFDA.pdf), artículo 14 VIII, diferencia textos oficiales de anotaciones e interpretaciones originales; exige fidelidad al texto oficial cuando se publica. Esa distinción no concede acceso a un servicio privado ni elimina la revisión de derechos, compilaciones, términos y datos personales. No eludir bloqueos, autenticación o restricciones de adquisición. El estado de acceso se registra, no se convierte en cobertura ficticia.

## Distribución local para equipos de 8 GB

- Modelo pequeño, documentos e índices son componentes separados. Una biblioteca grande en SSD no exige cargarla completa en RAM ni ampliar los pesos del modelo.
- Un núcleo nacional y paquetes públicos por región/materia/tipo de fuente pueden descargarse y actualizarse por versión. El agente selecciona los índices instalados y envía al modelo un presupuesto acotado de pasajes; la ausencia de un paquete debe quedar visible.
- Índices SQLite/FTS en disco, cachés limitadas y búsqueda paginada. Evaluar búsqueda semántica pequeña solo si mejora recuperación dentro del presupuesto; evitar mantener todos los textos o embeddings en memoria.
- Publicar actualizaciones de contenido independientes del modelo: manifiestos autenticados, integridad, reemplazo atómico y rollback. Tener un hash local detecta cambios, pero por sí solo no autentica al publicador.
- El cliente descarga archivos públicos por identificadores de paquete/versiones. No envía preguntas, nombres, documentos, historial o hechos de los asuntos para decidir qué actualizar. Debe poder importar un paquete offline.
- Medir tamaño instalado, construcción de índices, latencia, caché, presión de memoria y límites en hardware físico de 8 GB. Que el diseño use disco no garantiza rendimiento aceptable automáticamente.

El mantenimiento de un corpus público puede hacerse centralmente sin almacenar expedientes de clientes. Su distribución no necesita transformar LEX AI en un servicio de inferencia en nube.

## Orden de implementación

1. Conservar esta auditoría como línea base y definir contratos de registros/versiones/paquetes con migración reversible desde los índices existentes.
2. Añadir ficha y adquisición reproducible de criterios judiciales con un lote pequeño revisado antes de escalar. Registrar permisos y fallos de acceso. Evaluar identificación exacta, cita y estado jurídico por separado.
3. Convertir el acceso estatal exacto en recuperación temática en disco y ampliar entidad por entidad, declarando leyes y artículos disponibles/rechazados. Conservar el conjunto retenido de entrenamiento fuera de generación de datos y selección de parámetros; la biblioteca para inferencia y los splits de entrenamiento son finalidades diferentes.
4. Completar brechas federales y la conciliación de versiones/decretos; integrar tratados y demás familias con alcance declarado. Conectar legislación y criterios sin asumir que una relación temática acredita aplicabilidad.
5. Distribuir paquetes con actualizaciones comprobadas, interfaz de cobertura y pruebas de búsqueda/privacidad/rendimiento en equipos de destino.

Aceptación: recuperación por referencia y tema sobre fuentes realmente instaladas; fidelidad de pasajes; jurisdicción/versión correctas; historial recuperable; relaciones respaldadas; fallos y cobertura parcial visibles; cero documentos privados en paquetes; funcionamiento sin red una vez instalados. Revisión profesional antes de declarar aptitud jurídica por área.

La prioridad nueva es construir y mantener **una biblioteca jurídica nacional verificable**, además del modelo conversacional. El archivo judicial, los estados y el control de reformas son brechas concretas; entrenar más épocas no las llena.
