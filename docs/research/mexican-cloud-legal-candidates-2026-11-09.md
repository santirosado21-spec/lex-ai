# Candidatos mexicanos para agentes jurídicos de nube

Investigación de Codex, 2026-11-09. Fuentes primarias GitHub (README, archivos y API de metadatos/commits). No se ejecutaron repositorios, instalaron skills, conectaron servicios ni consultaron colaboradores externos adicionales. El investigador asignado fue Sol. Los paquetes se leyeron como datos de referencia. Se consultaron PSF, la evaluación local del paquete Legal y la investigación previa de corpus; este documento cubre procesos y agentes, no otra lista de crawlers.

**Resultado:** sí existen skills específicamente mexicanas, incluso una adaptación amplia de procesos jurídicos al estilo del paquete Legal. Ninguna de las inspeccionadas demuestra por sí sola una solución México validada para producción. Las mejores bases para un ensayo son el método abierto de amparo de Consulto, las skills mexicanas de ThomasMoreAI y el caso sintético de arrendamiento de Softlaw; este último tiene condiciones AGPL diferentes de la licencia raíz. No confundir instrucciones en español con adaptación jurisdiccional ni resultados publicados por autores con mediciones nuestras.

## Seis candidatos inspeccionados

### 1. wariomx/claude-for-legal-mexico — el más cercano funcionalmente al paquete Legal

[Repositorio y explicación de licencias](https://github.com/wariomx/claude-for-legal-mexico). Tiene plugins mexicanos civil, corporativo, laboral, litigación, fiscal, privacidad, regulatorio, PI, seguros, gobernanza y conectores. El README describe verificador jurídico, vigilancia de expedientes y plazos, revisión contractual y flujos corporativos. Esto sí es evidencia México, no una traducción aislada.

Fuentes leídas: [revisión de arrendamiento](https://github.com/wariomx/claude-for-legal-mexico/blob/a88558918a9638c93ca879d39bb88925f6011e43/civil-legal-mexico/skills/revision-arrendamiento/SKILL.md), [eval](https://github.com/wariomx/claude-for-legal-mexico/blob/a88558918a9638c93ca879d39bb88925f6011e43/civil-legal-mexico/evals/README.md), [licencia específica](https://github.com/wariomx/claude-for-legal-mexico/blob/a88558918a9638c93ca879d39bb88925f6011e43/civil-legal-mexico/LICENSE) y [excepciones](https://github.com/wariomx/claude-for-legal-mexico/blob/a88558918a9638c93ca879d39bb88925f6011e43/civil-legal-mexico/LICENSE-EXCEPTIONS.md).

La skill exige entidad del inmueble y lado representado; distingue legislación estatal, arrendamiento financiero y transición CNPCF. La tabla de artículos es Jalisco, declarada confirmada por el autor el 22-09-2026; otras entidades quedan pendientes de verificar. El eval contiene contrato sintético Guadalajara y siete defectos sembrados, además de una renuncia de avisos; publica ablation con/sin skill y problemas de carga/juez. Su último resultado con otro juez no tiene brazo sin plugin: no extrapolar el 1.0 declarado a capacidad general ni a otro modelo.

**Licencia:** plugins México AGPL-3.0-or-later; upstream genérico Apache-2.0. Alternativa comercial ofrecida por Softlaw. La API GitHub clasifica raíz Apache: sería incorrecto aplicarla a las skills México. **Uso recomendado:** primero referencia y prueba sintética aislada, revisión de obligaciones antes de incorporar texto/código en nube propietaria. No activar sus MCP de CJJ, credenciales o acciones. Adaptar salidas a hallazgos+cláusula+cita+estado de verificación; devolver borrador al entorno local. Commit observado `a88558918a9638c93ca879d39bb88925f6011e43`, 2026-09-22.

### 2. EmilianoMierUjed/skills_Consulto — amparo con compuerta explícita de fuentes

[Repositorio](https://github.com/EmilianoMierUjed/skills_Consulto), [método](https://github.com/EmilianoMierUjed/skills_Consulto/tree/d8a26e4ffd695aa8f5db057b1c909fa59e715813/skills/amparo), [licencia Apache-2.0](https://github.com/EmilianoMierUjed/skills_Consulto/blob/d8a26e4ffd695aa8f5db057b1c909fa59e715813/LICENSE).

Modos activos fundamentar/viabilidad; separa búsqueda/cotejo de argumentos del abogado, requiere búsqueda adversa y verifica existencia, vigencia, obligatoriedad y literalidad. Sin conector declara falta de motor y no presenta un dossier como aprobado. Los modos armar/romper están planeados. La skill contempla una regla de plazo sin calcular fechas. Es particularmente útil como diseño de estados honestos para el investigador jurídico.

**Límite:** el método abierto no incluye las cinco bases o su motor de vigencia. README anuncia conector de pago separado; sus cifras y precio son declaraciones del autor, no acceso verificado. No activar ni registrar cuenta. **Recomendación:** adaptar método sin conector a expedientes públicos/sintéticos y fuentes oficiales independientes; conservar revisión humana de pertinencia y texto argumentativo, con referencias y pendientes retornados a local. Commit observado `d8a26e4ffd695aa8f5db057b1c909fa59e715813`, 2026-09-07.

### 3. ThomasMoreAI/legal-skills-open, subárbol mx/ — repertorio útil con calidad desigual

[Subárbol México](https://github.com/ThomasMoreAI/legal-skills-open/tree/2896ce4c0ca1632b43efb29647c2811eadc89247/mx). Se enumeraron **14 SKILL.md** mediante árboles de cada subdirectorio; la respuesta recursiva de la raíz es truncada y no sirve para contar México. Incluye contratos, análisis documental/jurisprudencial, investigación, due diligence, concepto jurídico, amparo, escritos civiles, DENUE, telecom y pyme.

Samples leídos: [contratos](https://github.com/ThomasMoreAI/legal-skills-open/blob/2896ce4c0ca1632b43efb29647c2811eadc89247/mx/contracts/skills/creacion-contrato-mexico-orwel/SKILL.md), [licencia de esa skill](https://github.com/ThomasMoreAI/legal-skills-open/blob/2896ce4c0ca1632b43efb29647c2811eadc89247/mx/contracts/skills/creacion-contrato-mexico-orwel/LICENSE), [amparo](https://github.com/ThomasMoreAI/legal-skills-open/blob/2896ce4c0ca1632b43efb29647c2811eadc89247/mx/employment/skills/amparo-emilianomierujed/SKILL.md), [civiles](https://github.com/ThomasMoreAI/legal-skills-open/blob/2896ce4c0ca1632b43efb29647c2811eadc89247/mx/litigation/skills/escritos-civiles-mx/SKILL.md).

**Hallazgos concretos:** contratos ordena leer `normas-base.md`, pero su directorio API contiene solo SKILL.md y LICENSE; referencia no resuelta. Declara federal por defecto, insuficiente para civil local. Amparo atribuye a Consulto y conserva sus dependencias de referencias/conector. Civiles atribuye a MiGaceta, CC-BY-4.0. DENUE declara MIT y deja claro que es directorio estadístico, no registro jurídico; contiene recomendaciones comerciales que no deben heredarse como acciones del agente. Una ubicación bajo employment no demuestra especialidad laboral del método de amparo.

**Licencia:** raíz Apache-2.0, pero revisar por skill y procedencia: contrato sample Apache; civiles CC-BY-4.0; DENUE metadato MIT. **Recomendación:** escoger módulos individuales con dependencias completas y contrastar con originales, no cargar toda la biblioteca. Convertir investigación/contratos en paquetes de tareas evaluables y fuentes fijadas, devolviendo resultados a local. Commit raíz observado `2896ce4c0ca1632b43efb29647c2811eadc89247`, 2026-10-12; no implica actualización jurídica de cada skill.

### 4. migaceta/skills-claude-derecho-mx — prompts, escritos y sanitización como referencia

[Repositorio](https://github.com/migaceta/skills-claude-derecho-mx), [licencia CC BY 4.0](https://github.com/migaceta/skills-claude-derecho-mx/blob/fe85f128d1b8fe2893013e3bf5b61e54cfc41367/LICENSE), [prompt-mx](https://github.com/migaceta/skills-claude-derecho-mx/blob/fe85f128d1b8fe2893013e3bf5b61e54cfc41367/prompt-mx/SKILL.md), [sanitizar-mx](https://github.com/migaceta/skills-claude-derecho-mx/blob/fe85f128d1b8fe2893013e3bf5b61e54cfc41367/sanitizar-mx/SKILL.md), [amparo](https://github.com/migaceta/skills-claude-derecho-mx/blob/fe85f128d1b8fe2893013e3bf5b61e54cfc41367/amparo-redactor/SKILL.md).

Seis archivos de skills con lenguaje/jurisdicción mexicana. README marca prompt/sanitización disponibles y otros en desarrollo; amparo y civiles sí contienen instrucciones sustantivas: existe una inconsistencia editorial de madurez, no ausencia de archivos. Prompt exige jurisdicción sin asumir Federal/CDMX; amparo pide no inventar registros y marca validación humana pendiente.

**Riesgos de adaptación:** sanitizar es prompt, no detector local medido; la tabla reversible contiene originales y nunca debe viajar al modelo remoto. Generalizar fechas/montos puede destruir cálculos jurídicos. La revisión primaria del coordinador detectó además la excepción de no invocar sanitización para escritos ya presentados por considerarlos públicos: **LEX AI no debe heredar esa excepción**. Presentación judicial no acredita publicidad, autorización de transmisión o ausencia de datos personales; persiste riesgo de reidentificación. No sustituye H4/H5 ni otras compuertas. Sus referencias normativas necesitan cotejo temporal independiente. **Recomendación:** reutilizar estructuras de intake y checklist de categorías para pruebas sintéticas, preservando atribución/cambios. No ejecutar la sanitización sobre originales mediante nube ni adoptar su afirmación de cumplimiento como validación. Commit `fe85f128d1b8fe2893013e3bf5b61e54cfc41367`, 2026-05-12.

### 5. panchew/confidential-document-rag — demostración del puente local/nube mexicano

[Repositorio](https://github.com/panchew/confidential-document-rag), [generación y límites](https://github.com/panchew/confidential-document-rag/blob/5ea16c4710351d1b7ea378823194109a65a9b9cc/docs/generation.md), [corpus mexicano](https://github.com/panchew/confidential-document-rag/blob/5ea16c4710351d1b7ea378823194109a65a9b9cc/corpus/mexican-laws.json), `src/confidential_rag/{generation,disclosure,redaction,audit}.py`.

RAG con embeddings locales, BM25+vector, referencia a artículo/página/hash y solicitudes remotas con presupuesto del JSON completo, redacción, preview y auditoría. Relevante para el sistema alrededor del agente, no skill jurídica amplia. Documenta abstención, citas rechazadas, no reintentos y estados de entrega desconocida.

**Límites expresos:** patrones no detectan automáticamente nombres/domicilios; no garantizan confidencialidad, anonimato o ausencia de inyección. Auditoría guarda contenido saliente reversible; sin cifrado, expiración o control independiente. Texto incluye reformas históricas, no razonamiento completo de vigencia. **Licencia:** API no declara licencia y árbol inspeccionado no contiene LICENSE: lectura como referencia; no copiar código al producto sin permiso/licencia aclarada. **Recomendación:** especificaciones independientes inspiradas en preview del request completo y evidencia local, ensayadas solo con público/sintético. No sustituye nuestra custodia local ni gate de privacidad. Commit `5ea16c4710351d1b7ea378823194109a65a9b9cc`, 2026-09-26.

### 6. erniux/consulta-juridica — flujo laboral mexicano con trazabilidad

[Repositorio](https://github.com/erniux/consulta-juridica), [workflow inspeccionado](https://github.com/erniux/consulta-juridica/blob/f0595b1a4febe70b84e6fcc180ec784b86ffd4fd/backend/apps/consultations/services/workflow.py), `backend/apps/legal_indexing/services/{retrieval,jurisprudence_sync}.py`, `backend/apps/consultations/tests.py`.

Pipeline clasifica materia/temas, expande consulta, mezcla documentos/tesis, guarda recuperaciones y citas y falla si no hay citas. Código identifica laboral individual, seguridad social y riesgos de trabajo como materias elegibles. README presenta MVP con proveedor mock y sincronización SJF opcional; no tomarlo como agente jurídico evaluado ni como evidencia de acceso vigente al SJF.

**Licencia:** API null, árbol inspeccionado sin LICENSE: no copiar código. **Riesgo concreto:** sincronización recibe el prompt de consulta; convertirla en buscador remoto sin minimización puede revelar hechos aunque la fuente jurídica sea pública. **Recomendación:** referencia de workflow y conjunto de requisitos para ensayos sintéticos; consulta pública derivada localmente, trazabilidad y borrador devuelto a local. Commit `f0595b1a4febe70b84e6fcc180ec784b86ffd4fd`, 2026-04-14.

## Orden de ensayo y criterio de aceptación

1. Investigación de amparo con Consulto abierto y fuentes oficiales públicas: citas existentes, literalidad, adversos, jurisdicción/ámbito y abstención cuando vigencia no esté verificable.
2. Revisión de arrendamiento sintético Jalisco inspirada en el caso Softlaw: separar lectura documental de verificación de normas; comparar sin skill/con skill bajo el mismo modelo y juez humano, tras resolver licencia si se reutiliza material.
3. Borrador civil/contrato desde módulos seleccionados Thomas/MiGaceta: fuentes completas y normativa estatal explícita; comprobar anexos, hechos no inventados y citas reales. No calcular plazos con instrucciones textuales sin calendario/reglas deterministas versionadas.

En todos los casos el request completo —consulta, historial, metadatos, fuentes y resultados de herramientas— debe pasar la política local. El nombre público del agente o la procedencia pública de la ley no hace público el caso. Originales y mapas reversibles permanecen locales; a nube únicamente público/sintético o contexto seudonimizado autorizado después de las compuertas aplicables. Resultado estructurado con evidencia vuelve a local para restauración autorizada y revisión. Estas recomendaciones no activan rutas, modelos, facturación ni proveedores.

No se localizó en esta búsqueda acotada un benchmark abierto mexicano amplio y validado que cubra conjuntamente contratos, escritos, cálculo de plazos, conversación y citas. El eval de arrendamiento es una semilla concreta, no esa cobertura. No se encontraron pruebas propias de estos repos ni se validó exactitud jurídica, seguridad, rendimiento o disponibilidad de sus servicios.
