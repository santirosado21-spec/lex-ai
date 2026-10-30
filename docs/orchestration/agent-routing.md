# Reparto dsystem

Codex (plan declarado USD100) conserva objetivo, contexto, implementación, herramientas, integración y validación. Claude Opus 5.5 (USD20) tiene prioridad para diseño y revisiones complejas; se agrupan preguntas para conservar cuota. Gemini Pro básico aporta críticas independientes; Gemma local procesa texto simple o ejecuta evaluación real, sin delegarle decisiones críticas ni código que se entrega.

Todos consultan skills/repositorios pertinentes. Si el delegado no dispone de herramientas, Codex consulta y transmite las instrucciones y fuente. No asumir acceso a contexto, archivos, cuota o identidad de modelo. Una tarea corta no necesita llamada externa. No enviar datos de clientes a agentes de desarrollo.

En este ciclo: Claude produjo docs/architecture/design-brief.md; Gemini produjo docs/qa/gemini-review.md; trabajadores Codex construyeron backend e interfaz y revisaron el runtime; el principal integró y corrigió. Gemma se probó con contratos sintéticos y respuestas reales. Los dobles de prueba están únicamente en tests/scripts de verificación y se identifican en los informes.
