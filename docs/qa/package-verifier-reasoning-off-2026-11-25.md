# Verificador de paquete alineado con razonamiento local deshabilitado

Base cb6f2cf. No cambia app, lector, modelos, biblioteca ni UI.

El verificador mantenía una espera de ready de hasta 120 s si encontraba modelo empaquetado, aunque el backend actual devuelve unavailable y no autoarranca. El flag LEX_VERIFY_CHAT=1 además conservaba preguntas de razonamiento local de la arquitectura anterior.

Se conserva comprobación de versión, firma ad-hoc, arquitectura, inventario/hashes de recursos, blobs empaquetados y consultas autenticadas de biblioteca/servicios. Se reemplaza la espera obsoleta por comprobación del contrato unavailable de la superficie de razonamiento. El flag de chat se rechaza antes de validación de plataforma, lectura del bundle, escritura o spawn. Se retiran las llamadas históricas a analyze.

El informe separa inventario comprobado y contrato observado. localReaderRuntimeValidated=false siempre en este corte. El verificador no solicita inicialización ni inferencia. No afirma que un estado unavailable ateste ausencia de procesos o seguridad del runtime.

Medido: cuatro pruebas pasan, incluida llamada HTTP real a startServer en directorio temporal sintético, autoInitialize=true y motor inyectado que registra inicialización/generación: cero llamadas. La prueba del flag ejecuta el entrypoint en un subproceso y verifica rechazo temprano. Build pasa. No se ejecutó el verificador completo sobre bundle Mac; no se afirma paquete nativo validado ni runtime detenido físicamente. Requiere revisión independiente antes de publicación.
