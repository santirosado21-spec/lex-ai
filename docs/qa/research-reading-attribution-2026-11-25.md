# Atribución del encabezado de lectura

## Hallazgo reproducido sin modelos

`createIntakeGenerator` usa el adaptador OpenAI en la ruta por defecto del piloto. `createService` también permite inyectar `intakeGenerate`, como hacen las pruebas. `renderResearchNote` solo recibe respuesta y fuente; no recibe recibo ni identidad del proveedor. Sus dos rótulos fijos atribuían a OpenAI incluso una respuesta simulada y una abstención local de prueba. No se encontró una ruta normal que encargue respuestas jurídicas al modelo local. No se afirma que exista tal uso en producción.

## Corrección acotada

El encabezado pasa a `Lectura preliminar para revisión` y la abstención a `La respuesta indicó...`. Se retira la atribución no demostrable en este renderizador, sin inventar proveedor, inferirlo del JSON del modelo ni cambiar cómo se genera la respuesta. No se modifica el adaptador, el modelo, el destino, el prompt, los sobres, las citas, las anotaciones del artículo 117, el historial de borradores previos ni los recibos. Los borradores ya guardados no se reescriben.

## Medido

- Reproducción anterior: respuesta y abstención conocidas como simulación mostraban las dos etiquetas OpenAI.
- Tres pruebas nuevas aprobadas sin omisiones: renderización neutral; adaptador real con transporte simulado hacia su destino OpenAI sin inferencia; inyección simulada en servicio del piloto con guardado cifrado y exportación DOCX.
- El contrato del adaptador comprueba una sola llamada, URL, mensajes sin cambios y respuesta sin cambios. No sale tráfico a proveedor.
- Batería relacionada disponible: 27 pruebas, 24 aprobadas, tres omisiones por índices SQLite no instalados. La prueba unitaria de hechos protegidos afectada por el cambio del rótulo también pasa por separado.
- Batería ampliada incluyendo todo `intake-question-facts`: 29 pruebas, 25 aprobadas, tres omisiones y un fallo ENOENT por `resources/public-library.sqlite` ausente. Se reprodujo ese mismo fallo en la base anterior, una aprobada y una fallida. No se oculta como éxito ni se cambia la prueba para hacerlo pasar.
- Compilación aprobada, advertencia de tamaño de chunks existente.
- Exportación convertida a PDF e inspeccionada en sus dos páginas: encabezado neutral legible, literal `36- A` y nota editorial presentes. El propio fixture dice `SIMULACIÓN · Sin inferencia real`. No es evidencia de calidad de un modelo.

## Fuera de alcance

No activa modelos, corpus ni proveedores. No verifica calidad jurídica o vigencia. La duplicación de metadatos en tabla y el nombre del evento de auditoría `intake.cloud.draft` para generadores inyectados son oportunidades separadas. Este cambio tampoco demuestra atribución de proveedor por recibo ni migra documentos históricos. Pendiente revisión independiente antes de publicar.
