# LEX AI

Espacio jurídico privado para despachos mexicanos de distintas especialidades. Prototipo local para macOS Apple Silicon (24 GB RAM), Tauri + React/TypeScript, Node/SQLite y Gemma 4 26B-A4B.

Permite crear despacho/asuntos, importar TXT/MD/PDF/DOCX, recuperar documentos y fuentes oficiales, analizar con IA local, exportar DOCX y conservar feedback con propuestas de notas revisables. No es un producto validado para documentación confidencial ni sustituye revisión profesional.

La versión 0.3 incorpora la dirección de diseño de Claude Opus 5.5 inspirada en Harvey y referencias de 21st.dev: navegación por teclado, biblioteca documental, actividad del expediente, tareas manuales, evidencia y progreso real del entrenamiento. La biblioteca federal local contiene 35.452 artículos de 303 instrumentos, con filtros, búsqueda y acceso al texto y su procedencia. El supervisor consulta fuentes y repos públicos y repite las pruebas localmente. Operación: [monitor](docs/orchestration/night-watch.md); procedencia: [biblioteca jurídica](docs/legal-library.md).

## Desarrollo

```bash
npm ci
npm run build
npm run dev
```

El último comando muestra un enlace de sesión local. No compartirlo. Para desarrollo se detecta la instalación existente de Ollama en este Mac y se reutilizan sus pesos; el paquete de escritorio incluye su propio runtime. Datos de desarrollo en `.data/`. No introducir clientes reales durante estas pruebas.

```bash
npm test
npm run test:ui
npm run test:e2e
```

`test:ui` usa inferencia simulada, explícitamente identificada. `test:e2e` usa Gemma REAL, tarda varios minutos y requiere el modelo local; escribe únicamente artefactos sintéticos en `artifacts/`.

## Escritorio

```bash
npm run desktop:build
bash scripts/package-dmg.sh
```

Requiere Rust/Cargo y Command Line Tools solo en la máquina de compilación. `scripts/prepare-desktop.mjs` incluye Node, dependencias de documentos y los recursos redistribuibles del motor Ollama. El origen de empaquetado puede establecerse con `LEX_RUNTIME_SOURCE`; por defecto usa `/Applications/Ollama.app/Contents/Resources`. El usuario final no debe instalar esos runtimes.

En esta sesión Rust está aislado en `/private/tmp/lex-toolchain`; para recompilar con ese toolchain exportar `CARGO_HOME=/private/tmp/lex-toolchain/cargo`, `RUSTUP_HOME=/private/tmp/lex-toolchain/rustup` y añadir `$CARGO_HOME/bin` a PATH. No es una dependencia del instalador.

Al iniciar Gemma, la aplicación reutiliza una instalación local compatible si existe o descarga la versión aprobada (~16 GB), verifica manifiesto y SHA256 de todos los archivos y usa un proceso privado. Se requieren al menos 20 GB libres para descargar. No se admite silenciosamente otra versión del tag. El arranque y el uso del modelo pueden tardar según hardware.

## Documentación

- [PRD y criterios](docs/product/PRD.md)
- [Arquitectura](docs/architecture/overview.md) y [ADRs](docs/architecture/adr/)
- [Auditoría](docs/orchestration/capability-audit.md), [tareas](docs/orchestration/task-board.md), [ejecución](docs/orchestration/execution-log.md)
- [Amenazas](docs/security/threat-model.md), [pruebas](docs/qa/test-plan.md), [límites](docs/qa/known-limitations.md)
- [Fuentes y licencias](docs/architecture/legal-provenance.md)
- [Entrenamiento local reproducible](docs/training-runbook.md) y [distribución del candidato](docs/model-distribution.md)

Los resultados con citas comprobadas son borradores: la comprobación textual no valida razonamiento, aplicabilidad o vigencia. La biblioteca federal incorpora 35.452 artículos de 303 instrumentos; mantiene además un corpus semilla de 21 artículos de siete instrumentos para respaldo y CDMX. No representa todas las leyes estatales ni jurisprudencia mexicana. No hay nube, facturación ni entrenamiento automático con documentos.

## Web y catálogo público

La landing está en `landing/`, separada de la aplicación de escritorio. Incluye el cover original, demostración con datos ficticios, requisitos y límites de la versión experimental. Se puede revisar con `python3 -m http.server 4175 --bind 127.0.0.1 --directory landing` y `node scripts/landing-smoke.mjs`. No recibe expedientes ni ejecuta inferencia. El despliegue Vercel requiere habilitar el acceso del conector al equipo del dueño.

`supabase/` contiene el catálogo público declarativo con RLS; no guarda documentos, asuntos ni contactos. Su creación remota está pendiente de habilitar Supabase. Las pruebas locales SQL se ejecutan con `npm ci --prefix supabase/tests` y `npm test --prefix supabase/tests`; no sustituyen la verificación del servicio remoto.

El repositorio de desarrollo es privado: https://github.com/santirosado21-spec/lex-ai. Pesos, instaladores, índice SQLite generado y credenciales quedan fuera de Git. Los scripts de ingesta y entrenamiento permiten producir artefactos; no se afirma que un clone incluya el corpus completo ni los pesos. Ver [límites nube/local](docs/architecture/public-cloud-boundary.md).

## Entrega actual

Aplicación: `src-tauri/target/release/bundle/macos/LEX AI.app`. Instalador con cover y dock: `artifacts/LEX-AI-0.3.2-arm64.dmg` y SHA256 adyacente. Las versiones 0.3.0 y 0.3.1 anteriores se conservan. El backend empaquetado comprueba la biblioteca real, búsqueda, integridad de módulos y estado de entrenamiento. La UI se verifica en Chromium con fixtures sintéticos y en una prueba separada contra la biblioteca real. El instalador tiene firma ad hoc de desarrollo; no está notarizado y no ha sido probado en un segundo Mac limpio.

El candidato local `artifacts/training/lex-gemma4-lora-v2` completó 400 pasos QLoRA sobre datos públicos depurados. Los pesos completos están en [LEX-Gemma4-Experimental-v2.tar](artifacts/LEX-Gemma4-Experimental-v2.tar) (14,37 GB), con licencia, configuración, informes y SHA256 adyacente. Pasó 32 casos técnicos emparejados y un flujo sintético de contrato → recuperación → citas → DOCX. Este último usa generación sin esquema y normalización acotada de caracteres de control dentro de strings JSON antes de comprobar todas las citas; importar el modelo en otro cliente no incorpora esas validaciones.

El ajuste enseña citas textuales, JSON y abstención; no acredita razonamiento jurídico profesional. El candidato se importa manualmente en Ollama compatible y permanece separado del modelo predeterminado de la aplicación. La continuación v3 no pasó el flujo completo y fue descartada para esta entrega. Evidencia y límites: [informe del ciclo 3](docs/qa/cycle-3-report.md).

## Recursos UI

La versión 0.3.2 integra el dock aportado por el dueño: contraer la navegación activa los accesos rápidos; expandirla recupera la barra lateral. En ventanas web estrechas el dock aparece automáticamente. Mantiene el asunto y el borrador, y Más abre la paleta completa. Implementación, estructura shadcn y Tailwind sin reset global: [integración del dock](docs/ui-resources/dock-integration.md).
