# Dirección de diseño propuesta: «Expediente foliado»

## Concepto visual

El tema visual sale de un objeto que conoce cualquier abogado mexicano: el expediente cosido con hilo y foliado a mano. LEX AI trabaja con ese mismo material. Ordena documentos, saca pasajes y comprueba cada cita contra la hoja original. El elemento que debe recordarse es la **línea de verificación**: un trazo fino en azul sello que une la cita de la respuesta con el pasaje exacto en la fuente. Todo lo demás queda callado: papel, piedra y tinta.

**Revisión frente a la propuesta por defecto:** mi primera idea fue un hero oscuro y cinematográfico. Lo descarté por dos razones: se parece demasiado a Harvey y cae en el patrón de fondo negro con un solo acento. Lo cambié por luz de día sobre piedra volcánica. Es más propio, más mexicano y encaja con la UI clara que ya existe.

## Composición del hero y del cover

```
┌───────────────────────────────────────────────────────────┐
│ LEX AI                          Cómo funciona  Requisitos │
│                                                           │
│ [FOTO: expediente cosido   │  Titular serif (2 líneas)    │
│  sobre basalto, luz        │  Subtítulo Plex 18/28        │
│  lateral, ocupa ~45%]      │  [Ver cómo funciona]         │
│                            │                              │
│        ┌───────────────────┴──────────┐                   │
│        │ Preview HTML: respuesta con  │                   │
│        │ cita¹ ───línea azul───┐      │                   │
│        │ Fuente: pasaje marcado◄┘     │                   │
│        └──────────────────────────────┘                   │
└───────────────────────────────────────────────────────────┘
```

- **Texto alineado a la izquierda.** El preview se monta sobre el borde de la foto y así une el objeto físico con el software.
- **El preview es HTML real, no una captura.** Se lee, es accesible y lleva la etiqueta visible «Expediente de ejemplo con datos ficticios».
- **Cover del onboarding de la app:** la misma foto recortada en vertical ocupa el 40 % izquierdo. A la derecha van tres pasos reales: «Preparar el modelo local», «Crear el despacho» y «Abrir el primer expediente». Es una portada, no un icono.

## Paleta

| Nombre | Hex | Uso |
|---|---|---|
| Piedra clara | `#f5f5f4` | Fondo (el actual) |
| Papel | `#fcfcfb` | Superficies del preview |
| Tinta | `#141414` | Texto |
| Azul sello | `#1f4a73` | Acciones y línea de verificación |
| Basalto | `#3a3936` | Texto secundario y diagramas |
| Coincidencia | `#2f6b5a` | Estado «cita verificada» |
| Sin verificar | `#8a5a12` | Estado de advertencia |

No hay degradados ni crema. El color cálido lo pone la fotografía, no la UI.

## Tipografía

- **Source Serif 4** (tamaño óptico display, peso 500, interletrado −1 %) para titulares y citas.
- **IBM Plex Sans** para interfaz y cuerpo de texto.
- **Escala:** 15 / 18 / 24 / 36 / 60 px. Cuerpo a 18/28 con un máximo de 68 caracteres por línea.
- **Las cifras van en Plex con números tabulares**, no en monoespaciada.
- **Tratamiento activo del titular:** se compone como una cita jurídica. Lleva un superíndice¹ que abre su propia nota al margen con la fuente. La tipografía demuestra lo que hace el producto.
- **Nada de mayúsculas en etiquetas**, ni eyebrows, ni flechas en botones.

## Secciones

1. **Hero.**
2. **Cómo funciona.** Flujo interactivo de cinco pasos; aquí sí se numera porque es una secuencia real: importar, recuperar pasajes, responder, verificar la cita, exportar a DOCX.
3. **Qué puedes hacer.** Lista con nota al margen, no tarjetas: expedientes por despacho y asunto, búsqueda de pasajes, citas textuales, exportación a DOCX y retroalimentación.
4. **Dónde vive cada cosa.** Diagrama con un recuadro «Tu Mac» que contiene documentos, índice y modelo. Fuera del recuadro solo queda el catálogo público del sitio.
5. **Corpus.** 35.452 artículos de 303 instrumentos federales, con la fecha de corte visible (falta ese dato: **[fecha de corte]**).
6. **Versión experimental.** Bloque con borde de advertencia, explicado en la sección siguiente.
7. **Requisitos.** Mac con Apple Silicon y 24 GB de memoria unificada.
8. **Preguntas frecuentes.**
9. **Cierre.** Mientras no exista una URL pública, el botón dice «Consultar requisitos». El botón «Descargar» solo aparece cuando haya URL.

## Copy principal

- **Titular:** «Cada respuesta, con el pasaje que la sostiene.¹»
- **Subtítulo:** «LEX AI ordena tus expedientes en tu Mac, encuentra los pasajes relevantes y redacta respuestas cuyas citas se comprueban palabra por palabra contra el texto fuente. Tus documentos y el modelo se quedan en tu equipo.»
- **Nota¹:** «Verificación textual: la cita coincide carácter por carácter con el documento. No sustituye la revisión de un abogado.»
- **Arquitectura:** «El sitio web solo muestra este catálogo. Tus documentos, su búsqueda y el modelo funcionan sin conexión en tu equipo.»
- **Versión experimental:** «Incluimos un modelo Gemma candidato, ajustado durante 400 pasos y probado en 32 casos técnicos. Es un experimento: no tiene validación profesional ni jurídica. El modelo base sigue disponible y puedes volver a él.»
- **Pregunta frecuente:** «¿Es ley vigente? Cada artículo muestra su instrumento y su fecha de corte. LEX AI no garantiza vigencia sin esa evidencia.»
- **Errores, por ejemplo:** «La cita no coincide con la fuente. Revisa el pasaje marcado o quítalo de la respuesta.»

## Interacciones y accesibilidad

- **Un solo momento orquestado:** al cargar la página, la línea de verificación se dibuja en unos 700 ms y el pasaje se marca. Con `prefers-reduced-motion` se muestra el estado final sin animación.
- **Flujo como pestañas:** `role="tablist"`, se recorre con las flechas del teclado y cada paso actualiza el mismo preview. El movimiento solo responde a lo que hace la persona.
- **Enlaces en la línea:** al pasar el cursor o enfocar la cita¹, se resaltan la línea y la fuente, y el par queda unido con `aria-describedby`.
- **Contraste:** AA o superior (azul sello sobre piedra ≈ 8,5:1). Foco visible de 2 px en azul con separación.
- **Responsive:** en móvil la foto queda arriba con recorte 4:5 y el preview va debajo, ya sin superponerse.
- **Texto alternativo de la foto:** «Expediente de papel cosido con hilo sobre piedra oscura».

## Prompt de imagen (sin texto, para overlay HTML)

> Fotografía de producto editorial, en formato medio, objetivo de 80 mm, f/5.6. Vista en tres cuartos desde arriba de un expediente judicial mexicano de papel tamaño oficio: unas 300 hojas, cosidas por el borde izquierdo con hilo de algodón crudo atravesado en dos perforaciones, con las hojas un poco abiertas en abanico para que se vea el grosor. Las páginas están completamente en blanco o con textura de papel sin escritura legible. Reposa sobre una losa de basalto volcánico oscuro con acabado mate y poro fino. Luz natural de mañana entra en rasante desde una ventana arriba a la izquierda y deja sombras largas y suaves. Un trozo de hilo suelto cruza la piedra en diagonal hacia la derecha. Paleta: grises piedra, blanco papel, beige del hilo y un reflejo frío azul grisáceo en la sombra. El objeto ocupa el 45 % izquierdo y los dos tercios derechos quedan como espacio negativo limpio de piedra, con zona segura para recortar en 16:9 y en 4:5. Fotorrealista, grano fino, sin viñeteado. **Excluir:** texto, letras, números, logotipos, sellos con caracteres, mazo, balanza, manos, personas, laptop, pantallas, banderas y sobreexposición.