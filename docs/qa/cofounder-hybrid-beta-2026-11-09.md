# Prueba interna híbrida de Lorenzo y Pedro

Fecha: 2026-11-09. Estado: **guion preparado, no ejecutado ni instalador entregado**. El dueño confirma mínimo 8 GB de RAM y aclara que busca el mínimo cómputo local: detector pequeño entrenado para proteger datos, razonamiento por tarea en nube. No se enviaron mensajes/archivos a los participantes ni se autorizó gasto por este documento.

## Producto que debe representar la prueba

Local: detectar entidades y hechos reidentificables, minimizar/sustituir contenido, conservar correspondencias reversibles y originales privados, comprobar ámbito/política y restituir la respuesta. El detector entrenado no decide permisos ni maneja claves: esos controles son deterministas. No iniciar entrenamiento conversacional o cargar un LLM local grande como solución a esta prueba.

Nube: conversación, análisis, investigación y borradores mediante modelos por tarea. Todo el sobre debe revisarse antes de salir: instrucciones, texto/historial, metadatos, claves/esquema, selección de fuentes y herramientas. Cambiar nombres no elimina por sí solo identificación por hechos/contexto. El mapa reversible queda local; es seudonimización, no garantía de anonimato. La recuperación de identidad también se prueba en seguimientos, errores y cancelación.

La versión local anterior puede aportar feedback de interfaz; sus respuestas no evalúan el razonamiento remoto objetivo. M1 contiene cuatro candidatos, no ganadores medidos. H6 conserva dependencias H4/H5; esta propuesta no las salta ni activa proveedores.

## Dos momentos de revisión

**A. Evaluación temprana pública/sintética:** preparar un banco separado, sin acceso a expedientes, historial privado, correo o cuentas de clientes, con las mismas tareas para los modelos candidatos. Puede preparar evidencia de calidad antes de completar la bóveda. Las llamadas reales requieren acceso de producto y presupuesto explícito si hay cobro; credenciales PSF no se reutilizan. Mientras esas condiciones estén pendientes, se prepara el conjunto/harness y no se simulan resultados reales. No se presenta como beta confidencial ni como H6/H8 completos.

**B. Beta integrada del producto:** detector/cifrado aprobados, proveedor/configuración autorizados e integración de todas las rutas. Empezar igualmente con datos inventados y públicos. Cualquier uso de datos reales necesita la autorización específica y tratamiento verificado del piloto H8b; este pedido no los concede.

## Antes de entregar el paquete

1. Confirmar sistema/arquitectura de cada participante (pendientes); RAM mínima declarada 8 GB. Prueba física de 8 GB aún necesaria. Windows no tiene paquete probado en este corte.
2. Fijar commit, versión, canal y hash del candidato. Código declara 0.4.14 y existen DMG del 2026-11-05, pero no se verificaron aquí contra el checkout actual. README contiene cortes históricos contradictorios: corregir onboarding en la entrega. Un DMG local anterior no prueba integración híbrida.
3. Construir/verificar el paquete elegido, fuentes/runtime/corpus incluido, firma/Gatekeeper y arranque nativo desde perfil temporal limpio. Instalación en otro equipo compatible sin herramientas de desarrollo. No instruir a desactivar protecciones. Build web/552 tests no bastan.
4. Registrar proveedor/modelo/endpoint efectivos, política de datos, contexto máximo, consumo/coste y manejo de fallo. Banco público y beta integrada tienen alcances distintos. No fallbacks, herramientas o envíos externos silenciosos.
5. Fixtures inequívocamente inventados, espacio vacío y separado, sin documentos/cuentas del desarrollador. Obtener autorización concreta antes de cualquier gasto o ampliación de tratamiento.

## Guion para ambos abogados

Primero ambos hacen las mismas tareas; después cada uno propone dos casos de su práctica redactados desde cero con hechos ficticios/fuentes públicas. Reparto sugerido sujeto a su disponibilidad: Lorenzo observa conversación/escritos; Pedro contrasta evidencia/jurisdicción/documentos. No se afirma que ya aceptaron o validaron el producto.

| Tarea | Evidencia que necesitamos |
| --- | --- |
| Conversar, corregir una instrucción y cambiar de tema | Respuestas completas: escucha, tono, formato y continuidad sin menús no pedidos |
| Abrir dos chats y dos asuntos ficticios | Continuidad correcta y ausencia de datos del otro ámbito |
| Importar contrato ficticio TXT/DOCX/PDF seleccionable y resumirlo | Extracción íntegra o limitación clara; fechas/importes/hechos sin alteración, sin asumir OCR |
| Preguntar sobre material jurídico público recuperable | Fuente/versión pertinente y razonamiento contrastados por abogado; cita existente no basta |
| Omitir hechos esenciales o cambiar jurisdicción | Pregunta útil/abstención; cero norma/plazo/hecho inventado |
| Preparar/editar/exportar y reabrir un escrito DOCX | Estructura, citas, fidelidad y edición conservadas |
| En beta integrada, inspeccionar preparación y retorno sobre datos ficticios | Sobre completo reducido/sustituido, mapa local, restitución y seguimiento; no solo nombres cambiados |
| Desconectar/cancelar/agotar presupuesto ficticio | Sin envío alternativo ni respuesta parcial guardada; archivos/búsqueda/horas disponibles |
| Registrar tiempo ficticio, pausar/reanudar y reiniciar | Persistencia/cálculo contrastados con datos/cronómetro |

Por caso: participante, versión/hash, equipo, entrada pública/ficticia, respuesta completa, esperado por abogado, fuentes/versiones, duración y **útil sin corrección / útil con corrección / inaceptable**, con motivo. Clasificar incidencias de instalación, funcionamiento, experiencia y sustancia jurídica. No publicar datos privados/capturas en GitHub público. No enviar correo ni presentar escritos como parte de esta prueba.

Mezcla de asuntos, acción sin consentimiento o corrupción detiene el recorrido afectado; cita/norma/hecho inventado queda como fallo sustantivo y bloquea aprobar esa capacidad. Cierre: diez fallos priorizados por impacto/frecuencia, tres trabajos más útiles y criterios concretos para siguiente ronda. No convertir satisfacción media en precisión jurídica.

## Trabajo de implementación pendiente

- H4b: detector de reglas falló. Falta candidato pequeño entrenado/adaptado para entidades/contexto, contrato operativo v2, examen independiente y recursos medidos.
- H5b: SQLCipher aislado funciona; 24 APIs ausentes y 5 parciales de 32. Faltan paridad/IPC, claves, temporales/bloqueo, recuperación y migración; almacén activo sin cifrado.
- H6/M1: adaptador, autorización/presupuesto y políticas; comparar modelos antes de elegir ganadores.
- H7: integrar todos los llamadores/UI con ámbitos, control de salida/restitución, fallos/revocación.
- H8: evaluación jurídica/conversacional por abogados y flujo completo físico de 8 GB, piloto delimitado después.
- H9: respaldo externo/colaboración posteriores. Cobertura nacional, calidad por área e instalación/firma/release tienen evidencia/puertas propias.

Referencias: [backlog](../orchestration/hybrid-development-backlog.md), [contrato de producto](../architecture/conversational-product-contract-2026-11-03.md), [plan de pruebas](test-plan.md).
