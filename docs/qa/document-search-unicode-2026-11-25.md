# Búsqueda del lector: offsets Unicode originales

Base 1946762. Caso reproducido en componente real con harness existente,
Chrome local, soporte sintético: İSTANBUL. El contrato termina mañana.
Antes buscar contrato resalta ontrato más espacio. La minúscula de İ expande
a i + punto combinante y desplaza el índice aplicado erróneamente al original.
El soporte no se modificaba, pero el resaltado no correspondía a lo buscado.

Arreglo: búsqueda mantiene locale es, mayúsculas/minúsculas, acentos y signos,
coincidencias no solapadas, navegación circular y máximo 500. Retorna inicio/fin
UTF-16 del original mediante fronteras de caracteres del texto plegado. No
selecciona medio carácter expandido: buscar i no marca una fracción de İ;
buscar İ sí la encuentra íntegra. No normaliza, reescribe ni guarda texto.
No toca citas/servidor/biblioteca/modelos ni el buscador exacto del soporte.
Mapea solo candidatos necesarios, sin una tabla por cada carácter del documento;
cuando lowercase no cambia longitud usa offsets directos existentes.

Pruebas en Linux Node22.23.5: documento selección/búsqueda 2/2 PASS; regresión
con UI de ficha y comparación 3/3 PASS antes del último ajuste del helper,
repetida después como 4/4 PASS (incluye nuevo test unitario). Build PASS.
Harness real verifica dos coincidencias/navegación circular, límite 500,
texto original intacto, selección del resaltado y extracción literal, offsets
originales medidos con Range DOM y equivalencia del slice. Unitario cubre
expansión dentro/antes, emoji UTF-16, acentos combinantes, sigma contextual,
puntuación literal y no-solapamiento. No backend ni inferencia necesarios.

Capturas antes/después del MISMO caso inspeccionadas: antes excluye c e incluye
espacio; después cubre contrato completo. Es evidencia del lector en harness,
no app nativa ni contrato real. No evaluación legal ni del modelo.
