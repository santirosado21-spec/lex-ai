# Mapa de brechas de biblioteca ligado al demo mercantil (2026-11-18)

Alcance: lo que ya está en el repositorio (manifiesto de la biblioteca pública, catálogos de leyes y reglamentos, corpus propio de 21 artículos). No se descargó nada, no se tocaron los archivos de adquisición en cuarentena y no se midió paridad con ningún producto comparable.

Distinciones que este mapa NO borra:
- Cobertura documental: el texto del instrumento está en la biblioteca.
- Cobertura jurídica: que el conjunto de normas alcance para resolver un caso (supletoriedad, jurisprudencia, normas locales). Requiere criterio de abogado y no se mide aquí.
- Vigencia: ningún estado de esta tabla la acredita. El manifiesto dice `structurally-verified-currentness-unverified` y el snapshot es del 30/10/2026.

## Qué hay (fuente: `resources/public-library.sqlite.manifest.json`, 303 instrumentos federales, 35,452 artículos; auditoría de fidelidad por muestra: 910 de 910, solo fidelidad de texto)

| Norma citada o necesaria en una demanda mercantil | Documental | Nota |
| --- | --- | --- |
| Código de Comercio (780 artículos) | En biblioteca | El corpus propio de 21 artículos solo tiene 1, 2 y 78 |
| Código Civil Federal (2893) | En biblioteca | Corpus propio: 1796, 1797, 1832 |
| Ley General de Sociedades Mercantiles (273) | En biblioteca | |
| Ley General de Títulos y Operaciones de Crédito | En biblioteca | |
| Ley de Concursos Mercantiles (354) | En biblioteca | |
| Código Federal de Procedimientos Civiles (617) y Código Nacional de Procedimientos Civiles y Familiares (1183) | En biblioteca | Cuál es supletorio y desde cuándo requiere revisión humana (transitorios y vigencia sin verificar) |
| Ley Federal de Protección al Consumidor (180) | En biblioteca | |
| Ley de Instituciones de Crédito, Ley del Mercado de Valores, Ley de Inversión Extranjera, Código Fiscal de la Federación, Ley de Amparo | En biblioteca | |

## Brechas documentales concretas

1. Ley General de Organizaciones y Actividades Auxiliares del Crédito (`MX-FED-LGOAAC`): catalogada, NO está en la biblioteca congelada.
2. Reglamentos: el catálogo lista 163 con enlace, p. ej. `MX-FED-REG-CCOMER_MPSC` (Reglamento del Código de Comercio en materia de prestadores de servicios de certificación). El manifiesto de la biblioteca congelada solo contiene 2 instrumentos titulados reglamento (ambos del Congreso); ese reglamento del Código de Comercio no está. No pude contrastar con `artifacts/legal-library/coverage.json`, que no está en este checkout.
3. Arbitraje comercial: no hay ley específica aparte del Título del Código de Comercio; no hay hueco documental, pero sí una pregunta de cobertura jurídica.
4. Estados: el índice OJN (conteos publicados, no textos) deja 16 entidades como "no publicado en esta captura"; las normas estatales no están como texto. La biblioteca solo tiene selección parcial de Jalisco y Nuevo León. Una demanda mercantil ante tribunal local usa mayormente normas federales, pero la ley orgánica y las reglas de competencia del estado no están cubiertas.
5. Jurisprudencia y tesis: sin cobertura documental en este inventario.
6. Pendientes de exportación (177 extraídos, no congelados): la mayoría fuera de lo mercantil; no se evaluó uno por uno para este demo.

## Lo que esto no prueba

- La demo no usa la biblioteca completa: el servidor de pruebas cargó solo el corpus propio de 21 artículos. Con la biblioteca pública, "artículo 78 del Código de Comercio" se resolvería contra el texto completo; eso no se probó aquí.
- Estar en la biblioteca no prueba que el artículo siga vigente ni que sea la norma aplicable.
- Sin medición contra una referencia externa no hay base para afirmar paridad de cobertura con ningún otro producto.

## Qué se puede hacer y qué bloquea (actualizado)

- Descargas puntuales de texto legislativo oficial están permitidas esta noche (sin cuentas, gasto ni envío de datos privados) y se guardan como candidatas separadas, con procedencia, fecha y hash, sin tocar la biblioteca congelada ni la cuarentena. Hechas: LGOAAC (`resources/legal-candidates/lgoaac-candidate-2026-11-18.json`) y Ley Orgánica del Poder Judicial de Nuevo León (`lopjnl-candidate-2026-11-18.json`). Ninguna está adoptada: falta QA, y la vigencia de ambas no se verificó.
- Reglamentos faltantes: adquirible de la misma forma, uno por uno, si el demo los necesita; no se hizo en masa.
- Jurisprudencia: sin términos oficiales que autoricen reuso masivo del Semanario Judicial; solo consulta puntual por tesis con registro digital.
- CPC de Nuevo León: ya descargado antes y excluido por identidades de artículo ambiguas; es problema de extracción, no de adquisición.
- Probar la biblioteca completa en el demo: existe `public-library.sqlite` (153,014,272 bytes) en la carpeta de Drive del proyecto, pero la herramienta de Drive de esta sesión rechaza descargas de más de 25 MB (error: "download exceeds 26214400 byte limit"). No se verificó su hash. Hasta tener el archivo por otra vía, el demo no usa la biblioteca completa y no se debe presentar como si la usara.
