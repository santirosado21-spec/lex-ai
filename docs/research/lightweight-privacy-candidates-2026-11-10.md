# Alternativas pequeñas para desarrollo del detector

Consulta primaria del10nov2026, después del baseline GLiNER inadecuado. No cambia el experimento predeclarado3vs5etiquetas ni activa rutas. Sólo se leyeron fichas y metadatos públicos: no se descargaron nuevos pesos o dependencias. Los tamaños pequeños no prueban calidad mexicana o memoria del producto.

| Candidato | Evidencia observada | Uso siguiente propuesto |
| --- | --- | --- |
| [Rampart](https://huggingface.co/nationaldesignstudio/rampart/tree/b1993e4e68b082835b80ffc65acc03325ea2e501) | Q4ONNX14.693.379B, tokenizer441.954B; licencia declarada CC-BY4.0. [Ficha del autor](https://github.com/nationaldesignstudio/rampart/blob/master/MODEL_CARD.md) declara español y17tipos BIO. | Primer adaptador alternativo por tamaño si el diagnóstico actual confirma insuficiencia. Revisar licencia/procedencia y etiquetas antes de preparación explícita. |
| [Nym-small](https://huggingface.co/Wismut/nym-pii-multilingual-small/tree/4348999cd3c2e20c49615e9af7c6bbb45b64cd85/int8) | Variante int8 con pesos138.730.982B +tokenizer12.389.891B; MIT declarada,40tipos según [ficha](https://huggingface.co/Wismut/nym-pii-multilingual-small). | Segundo candidato; separar variantes y medir memoria/offsets y exportación, sin asumir equivalencia de cuantización. |
| [ScienceSoft-small](https://huggingface.co/ScienceSoft/scnsoft-pii-encoder-small) | El autor declara licencia propietaria y107MB; reconoce precisión insuficiente para su propia meta de publicación. | No incorporar por inferencia de permiso comercial o por tamaño. |
| [Piiranha-v1](https://huggingface.co/iiiorg/piiranha-v1-detect-personal-information) | La ficha actual declara CC-BY-NC-ND4.0 y español. | Excluido de propuesta comercial por ahora; no usar referencias antiguas a MIT como permiso actual. |

Rampart documenta límites decisivos: escritura no latina, ataques e identificadores indirectos. Su política conserva geografía general y su pipeline incluye regex y reparación de spans: copiar sólo pesos no reproduce sus métricas. No adoptar su política de conservación, tabla reversible o cargas por defecto como sustituto de nuestros gates. [README primario](https://github.com/nationaldesignstudio/rampart/blob/master/README.md).

Los números publicados de estos autores son evidencia de su propio arnés, no comparaciones de LEXAI. Cada candidato necesita etiquetas mapeadas sin oráculo, UTF16original sin truncamiento, límites de proceso/red, configuración congelada y desarrollo separado. Sólo un candidato adecuado en desarrollo pasa a revisión y examen independiente; el corpus300 no se usa para elegir arquitectura. Si se preparan pesos será una acción explícita acotada, con hashes/licencias, nunca autodescarga de la aplicación.

Metadatos API guardados en artifacts/privacy/candidate-discovery-20261110. No se instaló el runtime npm de terceros ni se ejecutó código remoto. Los modelos aquí son detectores locales; no son los LLMs de razonamiento en nube ni completan anonimización garantizada, recuperación, integración o validación8GB.
