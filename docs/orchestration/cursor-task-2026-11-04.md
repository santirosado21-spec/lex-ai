# Encargo para Cursor — revisión del validador (2026-11-04)

Pegar en Cursor (carpeta LEX AI, rama `rescate-0.4.13`). Antes de enviar: elegir un modelo explícito (por ejemplo Grok), no Auto. Solo lectura.

---

Revisa, sin modificar archivos ni ejecutar comandos que cambien nada, los commits `f3dfe46` y `019c929` de la rama `rescate-0.4.13` (`git show f3dfe46 019c929`). Contexto: LEX AI es un asistente jurídico local con un modelo pequeño. Para que explique en vez de copiar, relajamos el validador de respuestas con fuentes. Las garantías que **no** deben perderse:

1. Ninguna cifra, artículo, plazo o fecha se muestra si no aparece en la fuente citada.
2. Un identificador de fuente o una cita inventada rechaza toda la respuesta.
3. Una afirmación jurídica en un párrafo de charla (sin cita) provoca abstención.
4. En documentos privados del cliente (IDs `D1`, `D2`…) el número debe estar en la frase citada, no en otra parte del documento.
5. Nada sin respaldo se transmite (stream) ni se guarda.

Archivos clave: `server/grounded-output.mjs` (`numericClaims`, `validateGroundedOutput`), `server/grounded-output-mixed.mjs` (`validateMixedOutput`, `needsEvidence` con `sentenceLevel`), `server/service.mjs` (`citableSentences`, filtro de distractores, aviso de tesis), `server/assistant-router.mjs`.

Entrega: lista de hallazgos con archivo:línea, un caso concreto de entrada que rompa alguna garantía (si existe) y la corrección mínima propuesta. No afirmes haber ejecutado pruebas que no ejecutaste. Máximo 400 palabras.

---

Resultado: pegar la respuesta de Cursor en este archivo o en el chat con Claude para verificarla antes de aplicar nada.

## Para usar Cursor desde la terminal (opcional)

El ciclo autónomo podría delegarle tareas directamente si se instala su herramienta de terminal y se inicia sesión una vez (requiere navegador):

```sh
curl https://cursor.com/install -fsS | bash
cursor-agent login
```
