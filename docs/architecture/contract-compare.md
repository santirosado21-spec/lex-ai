# Comparación determinista de versiones

`server/doc-compare.mjs` compara dos textos localmente y de forma determinista. No llama a un modelo, no usa red y no interpreta el contenido. Los documentos se tratan siempre como datos.

La alineación es por párrafos mediante Myers (LCS), comparando Unicode NFC y espacios normalizados, pero el resultado conserva el texto original. Los párrafos modificados reciben un diff por palabras. Un párrafo movido se muestra como eliminación y adición, no como una conclusión sobre su efecto.

## Límites

- Cada entrada se limita a 400,000 caracteres y 5,000 párrafos.
- La distancia de edición de párrafos se limita a 1,200; diffs por palabras se limitan a 2,000 tokens.
- Si se alcanza cualquiera de estos límites, `truncated:true` identifica una comparación parcial o un fallback determinista. No se intenta una matriz cuadrática ni una operación sin cota.

`criticalChanges` sólo resalta cambios léxicos de cantidades, fechas, porcentajes y palabras como “plazo” o “días”. Es una señal de revisión, no una evaluación de importancia jurídica.

## Alcance y salida

`document.compare` y `document.compare.export` requieren que las dos versiones pertenezcan al mismo asunto del despacho activo. Los metadatos incluyen nombre, SHA-256 y longitud; las auditorías contienen sólo acción e identificador, nunca texto documental. El DOCX usa subrayado verde para adiciones y tachado rojo para eliminaciones, incluye ambos hashes y repite: “Comparación automática léxica; no es análisis jurídico”.

La comparación no determina validez, vigencia, cumplimiento, riesgo, plazos legales, cambios jurídicamente materiales ni asesoría profesional. La persona abogada debe revisar el texto fuente y cualquier diferencia señalada.
