# H2: contrato de salida sin red

Fecha: 2026-11-09. Módulo optativo para pruebas sintéticas. No se conecta al arranque de producción ni sustituye el motor local. La puerta no es un detector de datos personales ni una garantía de anonimización.

## Autoridad y límites

La configuración de la aplicación aporta un registro cerrado de destinos/proveedores, una política local y un clasificador local confiable. Un mensaje, documento, respuesta de modelo o metadato no puede conceder permisos. El ámbito usa `workspaceId`, `matterId` y `threadId`: `workspaceId` representa el despacho en el código existente.

La política tiene la forma `{version, grants:[{scope,destination,allowedCategories}]}` y autoriza tuplas exactas de despacho, asunto, hilo y destino. Solo categorías `public` o `synthetic` pueden salir en H2. La ausencia de política, clasificación o prueba de pertenencia al ámbito bloquea. Las futuras categorías privadas requieren un contrato y evaluación adicionales; no basta llamar sintético a un texto.

`getPolicy` y `classify` son dependencias confiables del servicio local, no parámetros controlados por la UI o el modelo. El registro del proveedor también es confiable: H2 no impide que código de aplicación ajeno invoque directamente otro transporte. H7 debe integrar todas las rutas; H6 debe verificar los bytes finales HTTP y el destino real.

## Solicitud y clasificación

`createEgressPolicy({destinations,getPolicy,classify})` construye la puerta. `generate(messages,{scope,destination,responseFormat,outputSchema,signal})` devuelve fragmentos asíncronos. No habilita herramientas remotas. Las propiedades operativas desconocidas se rechazan; los metadatos y el esquema forman parte del sobre completo que se clasifica.

La solicitud se copia y serializa con el mismo formato canónico del simulador H1. El clasificador recibe una instantánea local con el ámbito, destino, versión de política, sobre y cadena serializada. Debe devolver `{serialized,scope,destination,policyVersion,reliable:true,scopeVerified:true,category}` ligado a esa misma instantánea. Este contrato impide reutilizar por accidente una clasificación de otra solicitud; no demuestra la calidad de un detector futuro.

La política se vuelve a consultar tras la clasificación asíncrona, antes de invocar el proveedor y antes/después de cada avance del flujo. Cualquier cambio de la política completa invalida la operación en curso, incluso si afecta a otra concesión; es una restricción conservadora del prototipo. La revocación no puede deshacer una solicitud ya enviada, pero debe detener el avance posterior y bloquear nuevas operaciones. No se reintenta ni se elige otro destino ante errores o cancelación.

## Auditoría

El historial de auditoría en memoria contiene exclusivamente categoría, ámbito, destino, fecha, resultado y versión de política. Los errores se convierten en categorías fijas. No se guardan prompts, esquemas, metadatos, correspondencias, respuestas ni mensajes de excepción en la auditoría. Los identificadores de política deben ser opacos, nunca nombres de clientes o credenciales.

Las capturas completas del simulador son un instrumento de pruebas con datos sintéticos; no son la auditoría del producto. No conectar esa captura de texto a datos reales. Persistencia cifrada, autenticación, detector, transporte real y validación en 8 GB siguen pendientes.
