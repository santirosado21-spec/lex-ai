# Corpus piloto y condiciones de acceso

Se descargaron directamente dos PDFs públicos HTTPS sin autenticación ni elusión de controles, para un corpus pequeño, no un rastreador masivo:

- Código Civil Federal: https://www.diputados.gob.mx/LeyesBiblio/pdf/CCF.pdf — el PDF declara reforma 2025-11-14.
- Código Civil para el Distrito Federal: https://www.congresocdmx.gob.mx/archivo-750c763f50e26a46afd73e40dca4c4bc8a4cb741.pdf — declara reforma 2024-09-27. La portada incluye texto ajeno al código; se conserva y advierte la anomalía, sin asumir validez editorial o vigencia.

Se extrajeron artículos 1796, 1797 y 1832 de cada fuente. `scripts/build-corpus.mjs` permite reproducir la extracción desde resources/legal-snapshots. `legal-corpus.json` conserva texto, SHA256 del fragmento y del PDF, autoridad, jurisdicción, artículo, fecha de consulta y versión. Publicación/entrada en vigor desconocidas permanecen nulas. El archivo original permite contrastar errores de extracción.

Para la revisión inicial de reutilización se consultó el PDF oficial de la Ley Federal del Derecho de Autor (https://www.diputados.gob.mx/LeyesBiblio/pdf/LFDA.pdf, reforma declarada 2026-05-14), art.14 VIII: distingue textos legislativos de comentarios/estudios originales y exige apego al texto oficial al publicarlos. Se incluye texto legislativo, no análisis editoriales protegidos. Esto no constituye una validación jurídica de la distribución comercial; revisar avisos/condiciones de cada fuente antes de ampliar la colección.

Gemma 4: licencia Apache-2.0 según https://ai.google.dev/gemma/apache_2 y el blob de licencia del modelo instalado. Copia en resources/licenses/GEMMA.txt. Node y Ollama tienen avisos propios conservados; también se incluyen los avisos de bibliotecas del runtime. No generalizar esta licencia a otras variantes Gemma.
