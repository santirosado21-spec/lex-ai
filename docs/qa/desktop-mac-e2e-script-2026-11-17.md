# Guion de prueba real en Mac (para Codex vía el puente GitHub ya autorizado)

Estado: **PENDIENTE, sin resultado.** Este guion no es una corrida en Mac. Nada de lo de abajo se ha ejecutado en un Mac. La UI se verificó solo con Chromium en Linux y inferencia simulada.

Reglas: ninguna instalación nueva sin preguntar antes (si falta Rust target, Ollama o modelo, parar y reportar). Datos solo sintéticos. Nada de red hacia OpenAI. Nada de claves. No publicar. Reportar cada paso con evidencia (captura o salida), y marcar "no ejecutado" lo que no se corrió.

## Entorno a registrar primero
`sw_vers`, `uname -m`, memoria, commit exacto (`git rev-parse HEAD`), `node --version`, `cargo --version`, `rustup target list --installed`, presencia de `/Applications/Ollama.app`. Si algo falta, parar ahí.

## A. Pruebas de código que ya existen (no requieren instalar)
1. `npm ci` solo si `node_modules` falta y ya está autorizado; si no, preguntar.
2. `npm run build` -> esperado: sale 0.
3. `npm run test:ui` -> esperado: status PASS (mock de inferencia).
4. `node scripts/e2e.mjs` solo si Ollama y el modelo ya están instalados: inferencia local real con datos sintéticos. Registrar tiempo y RSS. Si falta el modelo, parar, no descargar.

## B. App de escritorio (Tauri)
5. `npm run desktop:build` solo si cargo y el target Rust ya están instalados (el script no instala nada y falla claro si faltan). Registrar la ruta del `.app` resultante.
6. Abrir el `.app`. Capturas, tamaño ventana 1440x900 y al menor tamaño permitido:
   - portada/onboarding (panel izquierdo café oscuro, "Rejon" sin ".AI" en el wordmark)
   - crear despacho sintético, "Preparar Rejon.AI" y estado listo
   - Asistente, Asuntos, Escritos, Biblioteca, Configuración
   - paleta de comandos y diálogo "Nuevo asunto"
   - un error del asistente (pregunta sin evidencia)
7. Café: sin azul visible en ninguna captura (fondo de diálogos incluido). Si aparece, anotar vista y píxel.
8. Modo claro y oscuro del sistema. El oscuro lo derivó Instinct y no está validado por el diseñador: solo capturar.
9. Onboarding completo con teclado (Tab/Enter), VoiceOver encendido al menos en la portada, y ventana pequeña sin desborde horizontal.

## C. Nube (debe seguir apagada)
10. Confirmar que Configuración NO ofrece activar nube y que no hay tráfico saliente a `api.openai.com` durante A y B (por ejemplo con `nettop` o Little Snitch si ya existe; si no existe, reportar "no verificado").
11. No introducir ninguna clave. La custodia de clave de OpenAI en Keychain no existe aún en el código.

## Salida esperada del reporte
Tabla paso, resultado (OK/FALLA/no ejecutado), evidencia. Sin interpretar nada como "aprobado" fuera de estos pasos.
