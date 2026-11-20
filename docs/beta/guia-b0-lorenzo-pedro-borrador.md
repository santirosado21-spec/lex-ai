# Guía B0 · Prueba del piloto Rejon con datos ficticios (BORRADOR para Santiago)

Estado: borrador preparado para Santiago. **No enviado a Lorenzo ni a Pedro.** No se afirma que la prueba física se haya hecho. Usar sólo datos ficticios.

## Antes de empezar
1. Descomprime el ZIP del piloto en una carpeta local propia. Necesitas Node.js 22 con SQLite FTS5 y, para leer documentos, Ollama con `qwen3.5:2b-q4_K_M` (el paquete no lo descarga).
2. Abre `Abrir Rejon.command` (Mac) o `Abrir Rejon.cmd` (Windows). Elige tu perfil y un código de ejercicio, y crea una frase local de al menos 12 caracteres. Guárdala: sin ella no se reabre el asunto.
3. No introduzcas documentos ni nombres de clientes reales.

## Recorrido (unos 45 minutos)
**Asunto 1, café.** Añade `piloto/minutas-cafe-ficticias.txt`. Abre «Revisar protección local» y recorre cada sustitución con las flechas. Busca el renglón 09.01 del Anexo 4-B del T-MEC, elige las dos líneas de las minutas como soporte, revisa el mensaje antes de enviar y exporta Word, Excel o PowerPoint.
**Asunto 2, flete.** Añade `piloto/carta-porte-practica.txt` y `piloto/recibo-porte-practica.txt`. Pregunta: «¿Qué comprobante acredita quién pagó el flete de CPV-904153?». Elige el artículo 65, fracción I, inciso d), de la Ley Aduanera.
**Edición.** En un borrador, edita el texto, inserta un marcador con «Insertar marcador», guarda y reabre el asunto con el mismo perfil, código y frase.
**Restitución.** En «Datos originales» comprueba que el folio y tus líneas vuelven a su forma original.
**Exportación.** Descarga los tres formatos y ábrelos. Verifica cliente, folio, cita jurídica y tus ediciones.
(El envío a OpenAI consume la cuenta elegida; hazlo sólo si Santiago lo autoriza y con su clave.)

## Qué queremos que juzguen
- ¿Alguna sustitución deja reconocible el lugar, el suceso o a la persona? Anota la frase exacta.
- ¿Se perdió un hecho técnico que necesitas (valor, cantidad, fracción, fecha)?
- ¿El fundamento citado es el pertinente para la operación y su fecha? ¿Falta alguna excepción o condición?
- ¿Puedes verificar cada afirmación del borrador en los documentos exportados?
- ¿Qué tardó demasiado o fue confuso? ¿Funcionó en tu equipo (SO, RAM)?
- ¿Usarías este borrador como punto de partida? ¿Qué falta antes de usarlo con un asunto real?

## Límites
Sin clientes reales. Sin validar vigencia jurídica por esta prueba. El resultado es opinión de uso, no validación del detector.
