# Dos casos legales inéditos sobre varias obligaciones y excepciones (valor en aduana)

**20 de noviembre de 2026.** Estado: **anotados y congelados, NO probados.** No se corrieron en el piloto: faltan `resources/public-library.sqlite` y el modelo local (bloqueos ya reportados).

`eval/legal-b0/casos-valor-aduana-b0-20261120.json`, SHA-256 `91b240bce8bcc5b8d2f35bdebefd2e073ce52c4f6d8e571ab83ea541624bc0f8`.

Cubren los artículos 65 y 66 de la Ley Aduanera (ajustes que se suman al precio pagado y conceptos que no integran el valor si se desglosan). Cada caso trae la fecha de operación, la pregunta, los resultados esperados con fracción e inciso y las trampas. Las respuestas esperadas salen del texto de la Cámara (última reforma DOF 19-11-2025), leído en `resources/trade/ley-aduanera-2025.pdf`; no las revisó un abogado.

## Fecha de operación
- Caso A, 10-mar-2026: posterior a la edición de la Ley en el repositorio.
- Caso B, 15-jun-2025: anterior a la reforma del 19-11-2025. En los artículos 64 a 67 la edición sólo marca «Párrafo reformado DOF 25-06-2018» (art. 66). Esa ausencia de otras marcas no prueba que el texto de 2025 fuera idéntico; la versión del 15-jun-2025 no se verificó.
- El Reglamento antes del 24-feb-2026 no tiene texto previo en el repositorio (ver `reglamento-vigencia-por-fecha-20261120.md`).

## Cómo usarlos
Reserva: no ajustar prompts ni recuperación con estos casos. Cuando existan la biblioteca y el modelo, medir por separado si el piloto (a) recupera los incisos correctos, (b) separa lo que se suma de lo que no y (c) advierte la fecha. Sin respuestas esperadas en el prompt.
