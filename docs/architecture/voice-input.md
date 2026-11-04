# Dictado local

El dictado es una entrada local: el WebView solicita el micrófono, reduce el audio a WAV PCM mono de 16 kHz y lo entrega al servicio local autenticado. El servicio escribe un archivo temporal `0600`, ejecuta el binario empaquetado con argumentos fijos y borra el WAV al terminar. Solo devuelve texto saneado; el cliente lo inserta en el compositor para revisión y nunca envía una consulta automáticamente.

## Límites y seguridad

- El audio no se envía a una API web ni a otro equipo. La única descarga es, bajo acción explícita, un artefacto público aprobado de dictado; se reanuda, se limita por tamaño y se verifica con SHA-256 antes de usarse.
- Hay una sola transcripción simultánea, máximo 4 MB WAV y 60 segundos de ejecución. La captura se detiene a los 120 segundos.
- Antes de ejecutar se consulta `availableMemory` de `runtime-memory.mjs`: el modo recomendado requiere 1.5 GB disponibles y la opción ligera 1 GB. No es una promesa de rendimiento en equipos de 8 GB.
- El proceso se inicia sin shell y con `GGML_BACKEND_PATH` y `DYLD_LIBRARY_PATH` apuntando exclusivamente a `resources/runtime/whisper`. Selecciona el backend CPU que corresponde a la familia Apple Silicon para priorizar compatibilidad; el backend Metal y el opcional BLAS se incluyen también para evolución medida. Sus bibliotecas se parchean para no conservar rutas de Homebrew.

## Empaquetado y permisos macOS

`scripts/prepare-whisper.mjs` copia el ejecutable, bibliotecas y backends de la instalación local de Homebrew, reescribe rutas de carga, firma ad-hoc cada binario y falla si `otool` encuentra una ruta `/opt/homebrew/`. Las licencias MIT de los componentes se incluyen en `resources/licenses/`.

El bundle declara `NSMicrophoneUsageDescription` y `com.apple.security.device.audio-input`. Apple exige la clave de uso antes de capturar y conserva la decisión del usuario; sin ella puede terminar la app. [Apple](https://developer.apple.com/documentation/bundleresources/requesting-authorization-for-media-capture-on-macos)

Tauri 2.12.5 usa Wry 0.57.1. En macOS Wry implementa `WKUIDelegate` para la solicitud de captura y, cuando la app no instala un manejador Rust propio, concede la solicitud de WebKit para que macOS/TCC sea el control de autorización. [Implementación de Wry](https://github.com/tauri-apps/wry/blob/dev/src/wkwebview/class/wry_web_view_ui_delegate.rs) La configuración de este proyecto no expone un delegado Rust por origen; por eso el límite de seguridad es intencionalmente estricto: solo se carga contenido local, el CSP no permite navegación remota y el flujo solicita únicamente `audio`. Si una futura versión carga orígenes remotos o requiere decisiones por origen, debe añadir un manejador nativo que niegue todo salvo el origen local; no basta con configuración JSON de Tauri.
