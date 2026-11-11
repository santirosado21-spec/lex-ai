# D1g — resultado del diagnóstico Windows


Run [42872682039](https://github.com/santirosado21-spec/lex-ai/actions/runs/42872682039), commit `7fb989e`, completó el diagnóstico. Ambas variantes terminaron en `TIMEOUT_LOOKUP_UTILITY`: mínimo 10.017,9007 ms; builtin 10.021,6379 ms. No alcanzaron búsqueda CIM, lectura, JSON o consulta; cero muestras RSS. Las listas tenían seis y dos entradas, con pertenencia del directorio builtin en ambas; esto no acredita existencia o lectura de sus módulos. Ambos procesos terminaron observadamente tras cancelación y el fixture salió con código 0. Total 20.085,7884 ms dentro de 27 s.

Revisor independiente Sol verificó las cinco huellas del freeze y el log (`21b4a3303d26cfa71633a4da5744c412a01f7b9710c7484f2ccf5b7c6621ff3a`): APPROVE de hechos. La frontera apunta a búsqueda/importación de comandos; causa exacta y rendimiento siguen sin demostrar. La comparación tiene confusión por orden. El manifest previo no se sobrescribe: resultado separado en `windows-cim-env-D1g-result-2026-11-10.json`. No cuarto arreglo a ciegas ni deadlines ampliados.
