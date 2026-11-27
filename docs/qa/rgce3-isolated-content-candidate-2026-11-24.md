# Candidato acotado de contenido RGCE, revisión pendiente

24nov2026, 10:00 America/Mexico_City. Ejecutado, no es solo plan. No integrado ni adoptable.

## Contenido producido

`rgce3-isolated-content-candidate.json`: nueve registros extraídos de la impresión DOF final: regla 3.1.43, artículo segundo que modifica el transitorio décimo primero, cinco transitorios de la tercera resolución y dos filas del Anexo 22 (Tulum 53/4 y CL). Cada registro conserva texto fuente, hash, offsets en una derivación limpia, hash del HTML original, prefijo/sufijo y condiciones separadas. Scripts y estilos se excluyen de la derivación; no se cambian palabras/puntuación del texto candidato.

Los offsets son puntos de código Unicode del texto derivado, NO bytes del HTML. La receta de derivación y el HTML original permiten reproducirlos. `legalSearchEnabled:false` es declaración del experimento, no barrera de seguridad contra lectura directa del JSON. No hay consumidor activo ni permiso de integración.

## Cotejo ejecutado y corrección de límites

Se compararon los bloques AVC y manifestación de valor con segunda anticipada. El bloque AVC se delimita antes del encabezado de tránsito interoceánico y regla 4.6.28, no simplemente hasta el artículo SEGUNDO. Una primera extracción local había absorbido esa regla vecina; fue corregida antes de empaquetar, con prueba de exclusión 4.6.28. No se alteró fuente.

AVC: no hay diferencias tras normalización tipográfica declarada (comillas, espacios ante puntuación, limpieza de márgenes/versiones de anticipada). No se afirma igualdad binaria. MVE: queda una diferencia de un espacio junto al marcador de omisión, conservada como operación de diff; fechas y palabras no resultaron diferentes en ese cotejo. Ambos bloques crudos y operaciones están en JSON para revisión independiente. No equivale a comparar resolución íntegra.

La limpieza de anticipada quita pies repetidos y etiquetas marginales identificadas, y está visible en el script. El revisor debe comprobar que no elimina contenido normativo. No usar una igualdad normalizada para justificar efectos jurídicos.

## Pruebas ejecutadas

Ocho pruebas pasan: nueve IDs únicos; todos los offsets/hashes recuperan texto exacto; ninguna habilitación activa; sin CSS/script en registros; límite AVC excluye SEGUNDO y 4.6.28; filas Tulum/CL; orden de cinco transitorios; seis fechas de MVE. Estas pruebas comprueban mecánica y límites conocidos, no exactitud jurídica ni cobertura integral.

Reproducir desde `artifacts/library-expansion-20261124/experiment/`:

```sh
python build-rgce3-content-candidate.py
```

Requiere Python 3 y BeautifulSoup4. El paquete conserva estructura de directorios y todas las entradas usadas: HTML final, anticipada2, fuentes operativas y sus manifiestos.

## Gate sustantivo solicitado

Revisar nueve textos, sus límites y filas contra HTML original; cotejar limpieza/diff anticipada; verificar correspondencia de condiciones con final y avisos. En particular, artículo SEGUNDO es modificación parcial, no todo transitorio consolidado; Tulum/CL son filas modificadas, no apéndices completos. AVC conserva cinco categorías/funciones habilitadas y contingencias. VUTCE estimado y marítimo sin activación probada no se convierten en fecha general. Ni registro de condiciones ni PASS mecánico autorizan adopción.

Fuente: https://dof.gob.mx/nota_detalle.php?codigo=5804604&fecha=23/11/2026&print=true
