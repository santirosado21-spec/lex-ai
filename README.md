# Rejon.AI

Nombre público vigente desde el 10 de noviembre de 2026. Los identificadores internos, el repositorio `lex-ai`, las rutas de datos y los instaladores anteriores conservan el nombre LEX AI para no romper compatibilidad ni atribuir la nueva marca a un binario antiguo. No hay instalador Rejon.AI verificado todavía.

**Estado de `main` (10 de noviembre de 2026): integración experimental para colaboradores.** La aplicación activa aún usa inferencia local y SQLite sin cifrado; los módulos de privacidad, recuperación y nube en desarrollo no forman un flujo privado validado. Usar sólo datos públicos o sintéticos. [Plan de lo que falta](docs/orchestration/main-cofounder-execution-plan-2026-11-10.md) · [Guía para Lorenzo y Pedro](docs/qa/cofounder-main-handoff-2026-11-10.md). La landing muestra Mac Silicon, Intel y Windows; sólo ofrece el DMG ARM **anterior** 0.4.3 como descarga real.

Diálogo por defecto **0.4.13**: chat con contexto propio; las fuentes se usan para consultas jurídicas/documentales y sus seguimientos. La naturalidad sigue en evaluación, con fallos conservados. [Comparación e instalación](docs/qa/dialogue-routing-context-0.4.13.md).

Conversación base **0.4.12**: corrige peticiones de fuentes al responder listas, cálculos y correos, y evita convertir operaciones aritméticas en consultas de leyes. [Pruebas reales e instalación](docs/qa/general-chat-base-0.4.12.md).

Agente conversacional **0.4.11**: Nuevo chat, búsqueda e historial local por asunto; menú lateral en ventanas pequeñas. Instalador universal Intel / Apple Silicon y pruebas: [informe de entrega](docs/qa/conversational-native-fix-0.4.11.md).

El código local declara **0.4.8** y tiene cambios sin commit. El instalador conservado es **0.4.6**, disponible en `artifacts/LEX-AI-0.4.6-arm64.dmg`; su informe cubre edición de respuestas, correo aprobado, seguimientos locales y complementos de Microsoft 365. [Memoria, entrenamiento e interfaz actuales](docs/qa/memory-training-ui-2026-11-03.md) · [Corte de integración](docs/qa/continuity-budget-2026-11-03.md) · [Verificación del paquete 0.4.6](docs/qa/desktop-0.4.6.md).

Espacio jurídico privado para despachos mexicanos de distintas especialidades. Prototipo local para macOS Apple Silicon con Tauri + React/TypeScript y Node/SQLite. El objetivo actual es 8 GB de RAM; las mediciones se realizan en una Mac de 24 GB y no certifican todavía un equipo físico de 8 GB.

Permite crear despacho/asuntos, importar TXT/MD/PDF/DOCX, recuperar documentos y fuentes oficiales, analizar con IA local, exportar DOCX y conservar feedback con propuestas de notas revisables. No es un producto validado para documentación confidencial ni sustituye revisión profesional.

La versión 0.3 incorpora la dirección de diseño de Claude Opus 5.5 inspirada en Harvey y referencias de 21st.dev: navegación por teclado, biblioteca documental, actividad del expediente, tareas manuales, evidencia y progreso real del entrenamiento. La biblioteca federal local contiene 35.452 artículos de 303 instrumentos, con filtros, búsqueda y acceso al texto y su procedencia. El supervisor consulta fuentes y repos públicos y repite las pruebas localmente. Operación: [monitor](docs/orchestration/night-watch.md); procedencia: [biblioteca jurídica](docs/legal-library.md).

## Desarrollo

```bash
npm ci
npm run build
npm run dev
```

El último comando muestra un enlace de sesión local. No compartirlo. La app no está publicada en internet (Vercel sólo sirve la landing); cada persona la abre en su equipo. Detalles, convenciones de interfaz y qué no está medido: [guía para abrir la app](docs/qa/run-app-locally-2026-11-10.md). Para desarrollo se detecta la instalación existente de Ollama en este Mac y se reutilizan sus pesos; el paquete de escritorio incluye su propio runtime. Datos de desarrollo en `.data/`. No introducir clientes reales durante estas pruebas.

```bash
npm test
npm run test:ui
npm run test:e2e
```

`test:ui` usa inferencia simulada, explícitamente identificada. `test:e2e` usa inferencia local REAL, tarda varios minutos y requiere el modelo configurado; escribe únicamente artefactos sintéticos en `artifacts/`. La comparación de habilidades y recursos está documentada en [evaluación ligera](docs/lightweight-evaluation.md).

## Escritorio

La versión 0.4.5 ofrece un solo asistente: conversación, consulta jurídica con fuentes automáticas y análisis documental en un mismo hilo. Habilidad inicial Automática, sin selector de modos. [Pruebas y límites](docs/qa/desktop-0.4.5.md); [distribución autónoma](docs/architecture/offline-desktop.md).

```bash
npm run desktop:build
bash scripts/package-dmg.sh
```

Requiere Rust/Cargo y Command Line Tools solo en la máquina de compilación. `scripts/prepare-desktop.mjs` incluye Node, dependencias de documentos y los recursos redistribuibles del motor Ollama. El origen de empaquetado puede establecerse con `LEX_RUNTIME_SOURCE`; por defecto usa `/Applications/Ollama.app/Contents/Resources`. El usuario final no debe instalar esos runtimes.

En esta sesión Rust está aislado en `/private/tmp/lex-toolchain`; para recompilar con ese toolchain exportar `CARGO_HOME=/private/tmp/lex-toolchain/cargo`, `RUSTUP_HOME=/private/tmp/lex-toolchain/rustup` y añadir `$CARGO_HOME/bin` a PATH. No es una dependencia del instalador.

La distribución 0.4.4 incluye el modelo ligero junto con el motor privado: el usuario no instala programas extra ni descarga pesos después de obtener la app. Al abrirla, se preparan y verifican localmente el manifiesto y SHA256 fijados en `resources/model-catalog.json`; los pesos se cargan para inferencia solo al preguntar. El flujo de desarrollo conserva la descarga explícita, limitada a 2 GB. El motor privado admite una consulta simultánea, limita el contexto y libera el modelo después de responder. Los pesos grandes anteriores se conservan sin reutilizarse automáticamente. Los límites y la incertidumbre de las mediciones están en [ADR 0002](docs/architecture/adr/0002-lightweight-local-runtime.md).

La interfaz actual usa tres destinos principales —Asistente, Asuntos y Escritos— y el [logo editable de Figma](https://www.figma.com/design/4O4XgcaSNSMEvAQjUQbc0C?node-id=2-22). Claude Code revisó la dirección conforme a Apple HIG; [alcance y pruebas](docs/architecture/apple-hig-identity.md). La investigación recupera leyes locales sin exigir importar documentos; los escritos y originales se abren desde su asunto.

## Documentación

- [PRD y criterios](docs/product/PRD.md)
- [Arquitectura](docs/architecture/overview.md) y [ADRs](docs/architecture/adr/)
- [Auditoría](docs/orchestration/capability-audit.md), [tareas](docs/orchestration/task-board.md), [ejecución](docs/orchestration/execution-log.md)
- [Workflow de desarrollo con Kimi y Cursor](docs/orchestration/desktop-collaborators.md)
- [dsystem: Groq, OpenRouter, Hugging Face y Mistral](docs/orchestration/remote-collaborators.md)
- [Amenazas](docs/security/threat-model.md), [pruebas](docs/qa/test-plan.md), [límites](docs/qa/known-limitations.md)
- [Fuentes y licencias](docs/architecture/legal-provenance.md)
- [Entrenamiento local reproducible](docs/training-runbook.md) y [distribución del candidato](docs/model-distribution.md)

Los resultados con citas comprobadas son borradores: la comprobación textual no valida razonamiento, aplicabilidad o vigencia. La biblioteca federal incorpora 35.452 artículos de 303 instrumentos; mantiene además un corpus semilla de 21 artículos de siete instrumentos para respaldo y CDMX. No representa todas las leyes estatales ni jurisprudencia mexicana. No hay nube, facturación ni entrenamiento automático con documentos.

## Web y catálogo público

La landing está en `landing/`, separada de la aplicación de escritorio. Incluye el cover original, demostración con datos ficticios, requisitos y límites de la versión experimental. Se puede revisar con `python3 -m http.server 4175 --bind 127.0.0.1 --directory landing` y `node scripts/landing-smoke.mjs`. No recibe expedientes ni ejecuta inferencia. El despliegue Vercel requiere habilitar el acceso del conector al equipo del dueño.

`supabase/` contiene el catálogo público declarativo con RLS; no guarda documentos, asuntos ni contactos. Su creación remota está pendiente de habilitar Supabase. Las pruebas locales SQL se ejecutan con `npm ci --prefix supabase/tests` y `npm test --prefix supabase/tests`; no sustituyen la verificación del servicio remoto.

El repositorio de desarrollo es privado: https://github.com/santirosado21-spec/lex-ai. Pesos, instaladores, índice SQLite generado y credenciales quedan fuera de Git. Los scripts de ingesta y entrenamiento permiten producir artefactos; no se afirma que un clone incluya el corpus completo ni los pesos. Ver [límites nube/local](docs/architecture/public-cloud-boundary.md).

## Entrega actual

[Evidencia de entrega y límites](docs/qa/8gb-delivery-2026-11-01.md).

Al corte del 3 de noviembre de 2026, `package.json` y el plist de `/Applications/LEX AI.app` declaran **0.4.8**, pero el router instalado difiere del árbol de trabajo. No se ha instalado la corrección de continuidad de este corte ni se ha repetido el smoke nativo. El instalador conservado es `artifacts/LEX-AI-0.4.6-arm64.dmg`, **2.189.000.727 bytes**; su evidencia histórica está en [el informe 0.4.6](docs/qa/desktop-0.4.6.md). Las versiones y hashes se registran por separado en [el corte actual](docs/qa/continuity-budget-2026-11-03.md). El piloto conductual ya completó dos pasos y guardó un checkpoint verificado; el candidato permanece inactivo. La continuación supervisada espera recursos según [el estado de entrenamiento](docs/qa/memory-training-ui-2026-11-03.md). La firma ad hoc histórica no equivale a notarización. No se verificó la publicación web en este corte.

El catálogo actual fija Qwen3.5 2B Q4_K_M (1.945.781.358 bytes), incluido en el instalador 0.4.4; el entorno de desarrollo también puede obtenerlo mediante preparación explícita. Se eligió para evaluación local por su resultado relativo en la [comparación controlada](docs/qa/lightweight-runtime-comparison-2026-11-01.md): 28/30 casos técnicamente aceptados con instrucciones de habilidad; **no demostró mejora por habilidades ni calidad jurídica suficiente para distribución profesional**. El [candidato entrenado grounded-v2](docs/qa/grounded-training-v2-2026-11-01.md) ya tiene pesos exportados de 1.02 GB; permanece separado e inactivo porque no ha superado la evaluación.

La verificación del paquete y de la instalación comprueba biblioteca, búsqueda, versiones, firma, icono y hashes de los módulos. El runtime incluido pasó una consulta real sin importar documentos y exportación DOCX usando pesos previamente verificados en un caché de evaluación. La UI pasó navegación, teclado y varios tamaños de ventana en Chromium con datos sintéticos. macOS aceptó abrir un TXT y un DOCX mediante el servicio real; la herramienta de inspección nativa no pudo iniciar, por lo que no se afirma revisión visual del editor o de la ventana Tauri.

### Historial del entrenamiento grande, fuera del objetivo de 8 GB

El candidato local `artifacts/training/lex-gemma4-lora-v2` completó 400 pasos QLoRA sobre datos públicos depurados. Los pesos completos están en [LEX-Gemma4-Experimental-v2.tar](artifacts/LEX-Gemma4-Experimental-v2.tar) (14,37 GB), con licencia, configuración, informes y SHA256 adyacente. Pasó 32 casos técnicos emparejados y un flujo sintético de contrato → recuperación → citas → DOCX. Este último usa generación sin esquema y normalización acotada de caracteres de control dentro de strings JSON antes de comprobar todas las citas; importar el modelo en otro cliente no incorpora esas validaciones.

El ajuste enseña citas textuales, JSON y abstención; no acredita razonamiento jurídico profesional. El candidato se importa manualmente en Ollama compatible y permanece separado del modelo predeterminado de la aplicación. La continuación v3 no pasó el flujo completo y fue descartada para esta entrega. Evidencia y límites: [informe del ciclo 3](docs/qa/cycle-3-report.md).

## Recursos UI

La versión 0.3.2 integra el dock aportado por el dueño: contraer la navegación activa los accesos rápidos; expandirla recupera la barra lateral. En ventanas web estrechas el dock aparece automáticamente. Mantiene el asunto y el borrador, y Más abre la paleta completa. Implementación, estructura shadcn y Tailwind sin reset global: [integración del dock](docs/ui-resources/dock-integration.md).

La versión 0.3.3 adapta el bento aportado por el dueño al Inicio: asunto activo, documentos y consultas de ese asunto, asuntos recientes y estado real del motor. Conserva el compositor y añade foco luminoso con teclado y movimiento reducido. [Integración del bento](docs/ui-resources/bento-integration.md).

La versión 0.3.4 integra el avatar aportado por el dueño como identidad visual del Asistente: estático al iniciar y en respuestas, animado solo durante la consulta y compatible con movimiento reducido. [Integración del avatar y skills consultadas](docs/ui-resources/avatar-integration.md).

La versión 0.3.5 presenta el asistente como LEX AI en onboarding, estado, configuración, evaluación y landing. Los diagnósticos técnicos del runtime no se muestran directamente. [Criterio de identidad del producto](docs/architecture/product-identity.md).

La versión 0.3.6 integra el loader circular aportado por el dueño dentro de la consulta: anillo alrededor del avatar estático, letras escalonadas, Cancelar accesible y movimiento reducido. [Integración del loader](docs/ui-resources/loader-integration.md).

La versión 0.3.7 integra la barra de chat MetalPromptBar: adjuntos por asunto, habilidad real, crecimiento hasta seis líneas, atajos y conservación del borrador ante error o cancelación. El efecto metálico es local y opcional. [Integración del chat](docs/ui-resources/chat-composer-integration.md).

La versión 0.3.8 añade Dashboard: indicadores reales del despacho, ámbito independiente del asunto activo, gráfica y tabla semanal de tareas, asuntos con seguimiento manual y actividad reciente. Disponible en la navegación lateral, Inicio y Más en móvil. [Integración del dashboard](docs/ui-resources/dashboard-integration.md).

Landing pública: https://lex-ai-rust.vercel.app/ (Vercel, verificada el 1 de noviembre de 2026). Publica únicamente información del producto; documentos e inferencia siguen locales. [Estado del despliegue](deployment/README.md).
