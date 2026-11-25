# Carta de porte en seguimiento documental

Defecto reproducido en focusFromInstruction: una indicación que pide factura y carta de porte devuelve solo factura; pedir únicamente carta de porte rechaza por documento desconocido; pedir factura, carta de porte y comprobante de pago se acepta como dos documentos, aunque el abogado pidió tres.

Se incorpora carta de porte/cartas de porte al tipo canónico transporte, ya existente. No se crea una skill ni se transmite la indicación libre. Se mantienen canonicalización, límite de dos categorías documentales, negaciones rechazadas y control que exige mencionar cada documento seleccionado en la salida. Las variantes de transporte no cuentan como categorías distintas. La equivalencia no determina régimen, valor probatorio ni suficiencia legal de la carta.

Antes: 3 FAIL. Después: 14 PASS/2 SKIP entre nueva regresión, follow-up, advertencia de edición, soportes y piloto. Los dos skips preexistentes de follow-up necesitan public-library.sqlite, ausente en checkout limpio. No se activó índice para evitarlo. El paquete real de segundo turno conserva factura comercial y documento de transporte, cita/condición originales y rechaza salida que omite transporte. Build sin errores. Test portable conectado a CI.

Sin inferencia, nube ni datos de clientes. La corrección no toca máscaras del caso Qwen, no cambia contrato de privacidad, no habilita skills offline y no prueba calidad jurídica del modelo. No hay cambio visual.
