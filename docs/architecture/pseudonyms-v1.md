# H3: correspondencias sintéticas en memoria

Fecha: 2026-11-09. Prototipo local optativo, sin detector ni conexión al producto. No persiste correspondencias privadas ni implementa cifrado. La sustitución reversible es seudonimización, no anonimización garantizada.

## Ámbito y entradas

El ámbito identifica `workspaceId`, `matterId` y `threadId`. Las correspondencias pertenecen al par despacho/asunto y pueden reutilizarse entre hilos del mismo asunto. La autorización de cada hilo sigue correspondiendo a H2 y al servicio local.

Las entidades son literales declarados explícitamente por el fixture o aplicación confiable. El módulo no encuentra nombres por sí mismo, no decide qué datos son privados ni autoriza salidas. La comparación es exacta, sin normalización Unicode; ante coincidencias superpuestas se escoge primero la coincidencia más a la izquierda y después la más larga. Esto exige una selección correcta de entidades por el futuro detector; no demuestra conservación semántica para documentos reales.

## Protección y restitución

`createPseudonymStore()` crea un almacén aislado en memoria. `protect({scope,messages,entities,provenance?})` devuelve mensajes protegidos, versión de correspondencias y procedencia separada. Se protegen contenidos y valores de texto de metadatos; las claves que contienen una entidad se rechazan, para no dejar ese texto sin tratar.

Los marcadores contienen un espacio de nombres aleatorio por asunto y un identificador opaco aleatorio por entidad. No codifican el nombre original. Un literal con el prefijo reservado se rechaza para evitar confundir texto de entrada con marcadores del sistema. Las correspondencias permanecen locales.

`restore({scope,text,mappingVersion})` reconoce únicamente marcadores conocidos de la versión activa y el asunto solicitados. Añadir correspondencias cambia la versión activa; para consultar una versión anterior retenida hay que seleccionarla mediante `rollback`. No reemplaza palabras libres ni interpreta instrucciones en el texto. Marcadores desconocidos, malformados o ajenos bloquean la restitución. Un seguimiento que usa texto ya restituido debe volver a pasar por `protect` antes de H2.

La procedencia y las citas originales se conservan por separado de la representación de salida. Ese objeto es local y puede contener originales: nunca debe añadirse automáticamente a la solicitud remota. H3V comprobará posteriormente la composición de recuperación, protección, puerta de salida, simulador y restitución.

## Versiones y fragmentos

Las instantáneas y la reversión sirven para probar un reinicio de sesión en memoria sintética. No deben escribirse en disco con datos privados: eso requiere H5. La importación comprueba ámbito, estructura y colisiones. Las versiones también son identificadores opacos aleatorios de 32 caracteres hexadecimales; no son números de secuencia. Se conservan los marcadores conocidos de una instantánea, pero cada alta posterior crea identificadores nuevos: restaurar una instantánea antigua no puede reutilizar el marcador de una identidad añadida después. No hay contadores que se reinicien al importar. La reversión dentro de una instancia selecciona versiones retenidas; una instantánea exporta únicamente la versión activa.

La restitución de fragmentos espera a reunir una respuesta completa dentro de un límite de 32.768 unidades UTF-16 y emite el texto restituido de forma atómica. Así no expone marcadores divididos ni una respuesta parcial cuando aparece un marcador desconocido después. Esta versión no ofrece visualización incremental. La cancelación mediante `AbortSignal` y los errores impiden la emisión. Las comprobaciones rodean la recepción de fragmentos; no pueden forzar que una fuente asíncrona arbitraria que está detenida resuelva su espera.

## Fuera de alcance

Detección real, política de acceso, autenticación, cifrado, persistencia, HTTP y validación jurídica pertenecen a otras tareas. Un snapshot es información local sensible, no una prueba criptográfica de autenticidad. La combinación H1–H3 no equivale a integración completa del producto ni valida equipos físicos de 8 GB.
