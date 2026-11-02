# Corpus piloto y condiciones de acceso

Se descargaron directamente dos PDFs públicos HTTPS sin autenticación ni elusión de controles, para un corpus pequeño, no un rastreador masivo:

- Código Civil Federal: https://www.diputados.gob.mx/LeyesBiblio/pdf/CCF.pdf — el PDF declara reforma 2025-11-14.
- Código Civil para el Distrito Federal: https://www.congresocdmx.gob.mx/archivo-750c763f50e26a46afd73e40dca4c4bc8a4cb741.pdf — declara reforma 2024-09-27. La portada incluye texto ajeno al código; se conserva y advierte la anomalía, sin asumir validez editorial o vigencia.

Se extrajeron artículos 1796, 1797 y 1832 de cada fuente. `scripts/build-corpus.mjs` permite reproducir la extracción desde resources/legal-snapshots. `legal-corpus.json` conserva texto, SHA256 del fragmento y del PDF, autoridad, jurisdicción, artículo, fecha de consulta y versión. Publicación/entrada en vigor desconocidas permanecen nulas. El archivo original permite contrastar errores de extracción.

Para la revisión inicial de reutilización se consultó el PDF oficial de la Ley Federal del Derecho de Autor (https://www.diputados.gob.mx/LeyesBiblio/pdf/LFDA.pdf, reforma declarada 2026-05-14), art.14 VIII: distingue textos legislativos de comentarios/estudios originales y exige apego al texto oficial al publicarlos. Se incluye texto legislativo, no análisis editoriales protegidos. Esto no constituye una validación jurídica de la distribución comercial; revisar avisos/condiciones de cada fuente antes de ampliar la colección.

La versión local de evaluación 0.4.0 usa Qwen3.5 2B Q4_K_M, con licencia Apache-2.0 según su ficha oficial y la capa de licencia del manifiesto verificado. Copia exacta en `resources/licenses/Qwen3.5-Apache-2.0.txt`; procedencia y SHA del modelo en `resources/model-catalog.json`.

El entrenamiento ligero separado usa Gemma 3 1B bajo **Gemma Terms of Use**, no Apache-2.0. Sus términos se conservaron desde la capa verificada en `resources/licenses/Gemma-3-Terms.txt`. El adaptador experimental no está activado en el catálogo de la app.

Histórico: Gemma 4 de versiones anteriores usa Apache-2.0 según https://ai.google.dev/gemma/apache_2 y su blob de licencia. Copia en `resources/licenses/GEMMA.txt`. Node y Ollama tienen avisos propios conservados; también se incluyen los avisos de bibliotecas del runtime. No generalizar esta licencia a otras variantes Gemma.
