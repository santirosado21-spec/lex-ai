# Identidad de producto — 0.3.5

- Build TypeScript/Vite y Tauri: PASS.
- 94 pruebas Node: PASS. El test de inicialización cerrada conserva su rechazo; se actualizó la expectativa al nuevo mensaje «Prepara LEX AI».
- Prueba de identidad: PASS. Datos deliberados con nombres de modelo/runtime, IDs, rutas y mensajes técnicos no aparecen en el DOM de las pantallas del producto. Cubre estados desconocidos, fallo de preparación, estado de evaluación, paleta y 390 px. El primer intento corrigió un selector del test: el paso de onboarding contiene su número, por lo que se consulta el contenedor semántico, no una coincidencia de texto exacta aislada.
- Flujo completo de UI: PASS, con inferencia simulada y datos sintéticos.
- Landing local: PASS, incluida ausencia de nombres de proveedores en texto y catálogo público preparado, tabs, enlaces, privacidad y responsive. No se ha desplegado una nueva versión remota.
- Inferencia local real: PASS el 30/10/2026, 15:59:37 UTC; generación en 35.6 segundos. Verificación del modelo fijado, consulta sintética con citas a contrato y fuente oficial, DOCX, feedback y aprobación/reversión sintética. Se ejecutó con bloqueo GPU exclusivo. No constituye validación jurídica.

Evidencia en `artifacts/product-identity/`. Se revisó visualmente Configuración. Los detalles técnicos permanecen en materiales de diagnóstico y procedencia, no en las pantallas de uso ordinario. No se censuran documentos ni citas y no se promete confidencialidad del runtime frente al dueño del equipo. El instalador sigue firmado ad hoc, sin notarización ni prueba en un segundo Mac limpio.

Paquete nativo: PASS (versión, firma de desarrollo, backend/recursos, biblioteca real y estado de entrenamiento). Imagen DMG verificada con hdiutil y SHA256 conservado en el manifiesto de versión.
