# ADR 0001 — Tauri y servicio Node incluido

Estado: aceptado para prototipo, 2026-10-29.

Se usa Tauri/React/TypeScript con un servicio Node 22 incluido, en vez de requerir Python o runtimes instalados por el usuario. Node ofrece SQLite y bibliotecas de DOCX/PDF; Rust conserva el ciclo de vida del proceso y entrega un token efímero. Se incluye el motor Ollama y sus bibliotecas; no se requiere instalar la aplicación Ollama en el flujo empaquetado. La primera versión fija Gemma 4 26B-A4B en macOS arm64 y 24 GB.

Consecuencias: paquete mayor que Tauri puro; Node SQLite aún emite aviso experimental; descarga inicial de unos 16 GB; motor con endpoint loopback sin aislamiento ante otros procesos del usuario. Se pospone migración a IPC/UDS para la inferencia y un modelo menor hasta verificar compatibilidad. Firma, notarización y actualización segura son gates de distribución, no capacidades asumidas.
