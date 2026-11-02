# Comparación de modelo — pendiente de ejecución local

Estado: no hay comparación base/adaptador. **No hay candidato entrenado ni legalmente validado.**

La preparación reproducible ya generó un conjunto público/sintético reservado por materia, pero el checkpoint ligero no pudo descargarse: la resolución DNS de Hugging Face falló antes de transferir pesos. Por ello no se presentan números, salidas base, salidas adaptadas ni diez ejemplos inventados.

Cuando el checkpoint esté disponible localmente, `scripts/training-comparison-report.py` generará en este mismo archivo una tabla real de base frente a adaptador y al menos diez pares de salidas textualmente diferentes, cada uno con prompt y URL de fuente pública. El informe seguirá llamando al resultado **candidato experimental** y no implicará validación jurídica.
