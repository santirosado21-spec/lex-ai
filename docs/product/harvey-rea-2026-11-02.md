# Harvey con REA y consecuencias para LEX AI

Observación del 2 de noviembre de 2026, sin sesión autenticada, credenciales ni datos de clientes. Se aplicó `reverse-engineer-anything` y la guía de observación de runtime. La consulta original del dueño incluía unificar conversación y trabajo jurídico y analizar alternativas mexicanas si Harvey no permitía entrar.

## Evidencia directa

REA lanzó un Chromium con perfil vacío hacia [Harvey](https://app.harvey.ai/). La captura terminó correctamente en la pantalla «Sign in to Harvey», con campo de correo, continuar, ayuda y selector regional. No se introdujeron datos ni se intentó superar el acceso.

Evidencia `ev_661fc78f8748e62850bb1a0ae1bb4bc28dc5aa84dfe5d04470f46897d35dd6b7`; accesibilidad SHA-256 `ec730945fca0c7e9163852535c02a5e51a980449cf0ebe3121431e17e6c119d1`. Bundle completo exportado a `artifacts/competitor-rea/evidence-2026-11-02.json` (un registro). Las peticiones observadas pertenecen a esa ventana temporal, no acreditan comportamiento del asistente ni arquitectura del backend. No se descompilaron modelos ni se recuperaron instrucciones internas.

Los artículos oficiales de ayuda sobre Harvey II y búsqueda web redirigieron a autenticación al abrirlos directamente. Sus extractos indexados sirven como pistas, no como observación del producto. No se afirma haber probado selección automática de herramientas, precisión de citas, Word o consultas jurídicas.

## Fuentes públicas del fabricante

El [anuncio de integración con Tirant](https://www.harvey.ai/blog/tirant-now-live-in-harvey), del 1 de junio de 2026, describe contenido para México y otras jurisdicciones, atribución de fuentes y continuidad entre investigación, borradores y Word. Es una descripción del proveedor; no se verificaron cobertura o calidad en una cuenta de Harvey. La [actualización de agosto](https://www.harvey.ai/blog/the-brief-august-2026) menciona contenido de Tirant para España/México e interfaz en español.

La investigación histórica del proyecto decía que Harvey no tenía internet en tiempo real. No debe conservarse esa frase como conclusión actual: el índice público contiene documentación más reciente de una función web opcional. Su disponibilidad y configuración en una cuenta concreta quedaron sin verificar.

## Alternativa mexicana ejecutada

Se observaron mediante REA IUX, IUDEX e Iurexia, y un recorrido público funcional de IANM: catálogo → Código Penal Federal → artículo. Sus límites, diez evidencias, enlaces oficiales y oportunidades concretas están en [el informe mexicano](mexico-rea-2026-11-02.md). No se probaron los modelos autenticados de esos proveedores. No se incorporó contenido editorial ni código de competidores al entrenamiento.

## Decisiones propias aplicadas

- Un solo compositor e historial: el usuario pide trabajo y LEX AI selecciona conversación, recuperación jurídica, análisis documental o solicitud de contexto.
- La selección del asunto limita datos privados; el ordenamiento solicitado determina fuentes públicas. Las fuentes de una entidad no disponible no se sustituyen silenciosamente por otras.
- Cada respuesta muestra el estado real de sus referencias. La coincidencia de una cita no acredita aplicabilidad, vigencia ni corrección de la interpretación.
- Entrenar Qwen y recuperar textos oficiales versionados son complementarios. Incluir un corpus en la biblioteca o describir comercialmente una IA como entrenada no prueba ajuste de pesos.

Estas son decisiones de implementación propias, no una reconstrucción del software propietario. No se copiaron interfaz, textos de producto, assets, prompts ni datos privados.
