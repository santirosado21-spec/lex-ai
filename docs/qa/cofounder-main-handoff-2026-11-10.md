# Guía de trabajo desde `main` para Lorenzo y Pedro

El repositorio en `main` es el **código experimental de integración**. Permite revisar y proponer cambios; no es una versión lista para expedientes reales. El producto que hoy arranca usa inferencia local y SQLite sin cifrado. Los prototipos de detector, recuperación y router no convierten esa aplicación en la demo híbrida completa.

Para evitar trabajo duplicado, consultar y actualizar el [tablero de responsables y archivos](../notes/cofounder-workboard-2026-11-10.md) antes de empezar. El adaptador OpenRouter H6a está reservado a Codex en este corte; la revisión jurídica S2b.2 queda propuesta a Lorenzo y Pedro sin adjudicarles cambios de código automáticamente.

## Arranque para colaboración técnica

1. Clonar `main` y anotar el SHA con `git rev-parse HEAD`. Crear una rama corta desde ese punto para cada cambio; subir un PR con archivos y pruebas acotados. No editar o sustituir las evidencias históricas de experimentos fallidos.
2. Usar sólo datos inventados o fuentes públicas. No importar documentos de clientes, credenciales, mapas de identidad reales ni fotos/capturas privadas en issues o PRs.
3. Con Node compatible con `package.json`, ejecutar `npm ci` y `npm run build`. El CI de `main` ejecuta seis archivos de contratos portables; `npm test` completo requiere FTS5 y activos generados (entre ellos `resources/public-library.sqlite`) que no vienen en un clon limpio, por lo que su fallo por esos prerequisitos no significa que la prueba jurídica se haya ejecutado. `npm run dev` sirve para inspeccionar la aplicación local. `npm run test:e2e` usa inferencia real y requiere un modelo configurado; no es el primer paso en un clon limpio.
4. Para revisar experiencia jurídica, usar el [guion sintético](cofounder-hybrid-beta-2026-11-09.md). Guardar por caso la respuesta completa, fuente/versiones, resultado esperado, utilidad sin/con corrección e incidencia concreta. La revisión de un abogado no valida por sí sola el límite de privacidad.

## Canales y decisiones de prueba

| Canal | Estado comprobado | Trabajo posible ahora |
| --- | --- | --- |
| Código `main` | Suite y build automatizados, sin credenciales de producto | Revisión y PRs pequeños con datos sintéticos |
| Mac Apple Silicon | Landing enlaza el DMG experimental 0.4.3 **anterior** | Probar sólo la experiencia local histórica, registrando versión; no evaluar flujo híbrido con ese DMG |
| Mac Intel | Tarjeta visible, sin URL de instalador verificado | Revisar código/UX; esperar build e instalación limpia |
| Windows | Tarjeta visible, sin URL de instalador verificado | Revisar código/UX; medición de árbol/instalación pendientes |

Si ven un problema que involucre fuga entre asuntos, envío del original, hecho jurídico inventado, cita falsa o acción sin autorización, registrarlo como bloqueo con un caso ficticio reproducible. No publicar contenido privado en GitHub. Los criterios para la prueba integrada con ellos siguen en el [plan por fases](../orchestration/main-cofounder-execution-plan-2026-11-10.md).
