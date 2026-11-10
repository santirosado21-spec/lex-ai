# ADR 0004 — Canal web local para la primera prueba híbrida

Fecha local: 2026-11-09. Estado: decisión de continuación, implementación y validación por cortes; no permiso de datos reales. Mantiene ADR 0003 y los gates H4/H5/H6/H7/H8b.

## Decisión

La primera demo que represente el tratamiento de documentos usará **interfaz de navegador servida por el servicio del propio equipo**, en un origen loopback único. Extracción, detección, minimización, originales, correspondencias y restitución pertenecen al servicio local; la bóveda nativa se integrará mediante broker privado supervisado. No se presupone un almacén SQLCipher dentro del navegador. La página pública alojada en internet puede mostrar contenido público, pero no se habilita allí importación privada hasta tener un canal explícito probado.

Esto reutiliza la arquitectura existente y evita abrir acceso al servicio local desde cualquier dominio público. Una futura página alojada con companion necesita emparejamiento/origen/transporte propios y su aceptación; no se habilita ampliando CORS a `*` ni publicando el token del servicio. La demo inicial usa solo documentos ficticios con identificadores y hechos sensibles inventados.

## Evidencia del canal actual

Inspección independiente Sol `inspect_web_local_boundary`: `server/main.mjs:102` escucha 127.0.0.1; `:92` sirve dist con CSP del mismo origen; `src/api.ts:20` usa URL relativa y token inicial de fragmento. `src/App.tsx:196` envía nombre y bytes originales a document.import; `server/service.mjs:226` extrae en Node. Eso es transporte local únicamente si el servicio corre en la computadora del usuario. Una copia alojada usa el servidor de ese origen, por lo que no prueba privacidad local.

El proceso existente usa bearer por proceso, lista de Origin y límites de cuerpo, pero admite Origin ausente y no comprueba Host expresamente. El token de arranque impreso por herramientas de desarrollo no acredita una sesión de producción. Store activo es SQLite sin cifrado; el detector no se integra actualmente en document.import. Estos límites se conservan como trabajo, sin atribuirlos a la bóveda nueva o declarar egreso permitido.

## Cortes de implementación y aceptación

1. Contrato de ingreso local v2: formatos admitidos text/plain y text/markdown en el primer corte; bytes UTF-8 válidos, procedencia y estado real de extracción. PDF/DOCX solo se incorporan al contrato después de pruebas de extracción local y metadatos; OCR no implementado bloquea escaneos. No alterar importación activa silenciosamente por un prototipo.
2. Borde HTTP: validar Host/origen/sesión en operaciones de datos, pruebas con sitio ajeno, Origin nulo/ausente, preflight, token revocado y límites. Mantener legítimas las llamadas Tauri/locales según contrato explícito; no confundir CORS con autenticación. No registrar tokens/originales/metadatos privados.
3. Bóveda: implementar dominio y puente con aislamiento/transacciones en el canal seleccionado; custodia/bloqueo/recuperación H5b.2 y migración sintética H5b.3. El native spike no cierra ninguno de esos requisitos.
4. Preparación y salida: solicitud completa versionada, doble comprobación de ámbito/política, detector elegible, sustitución local y mapa excluido. Probar bytes reales del transporte mock antes de una ruta remota sintética autorizada; jamás convertir el origen privado en public/synthetic para eludir H2.
5. Navegador: original ficticio sin edición manual, importación local, sobre reducido, retorno/restauración y seguimiento reprotegido. Capturar red y comprobar que no hay subida externa anterior, telemetría privada, mapa o llaves. Entrega identificada por commit/hash, sistema y navegador; falta hardware físico de 8 GB para ese criterio.

Límites experimentales iniciales heredados de privacidad: sobre analizado de 7.000 UTF-16 (sumando textos y paths), máximo 256 segmentos, una operación a la vez, timeout 15 s; árbol app 4 GiB, incremento detector 1 GiB y p95 detector 5 s como techos preregistrados, no garantías medidas de producto. No aumentar M1 por introducir un formato nuevo. Archivos mayores requieren selección/fragmentación local con cobertura explícita o bloqueo, nunca truncamiento silencioso.

## Consecuencias

Preserva el trabajo nativo y separa el broker local de la inferencia remota. La prueba inicial es una experiencia web local, no una URL pública que ya pueda custodiar expedientes. Empaquetado, emparejamiento seguro, detección real, bóveda y proveedor siguen sus aceptaciones. No descargar un modelo grande, registrar proveedor, activar gasto, tocar bases reales o desplegar por esta decisión.
