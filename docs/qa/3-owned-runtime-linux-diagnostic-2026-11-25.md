# Diagnostico Linux de procesos sinteticos, sin modelo

Base: a492b6b. Preparacion independiente del producto. No importa inference ni construye el lector; solo importa el medidor processTreeRss existente. Python crea procesos pequenos, sin red ni archivos de cliente. No descarga ni arranca modelos. El comando es:

```sh
node --test tests/owned-runtime-linux-diagnostic.test.mjs
```

En plataformas distintas de Linux las seis pruebas se omiten expresamente. Requiere Python3 y /proc. El workflow Ubuntu existente las incluye, sin crear workflows adicionales ni pasos manuales.

## Que discrimina

1. El medidor RSS real ve lider y descendiente con 24MiB asignados cada uno. En una corrida: arbol 71,106,560 bytes, hoja 35,549,184 bytes. Incluye interpretes y paginas compartidas posiblemente duplicadas, no es memoria incremental del modelo.
2. TERM por grupo detiene lider y descendiente que conserva PGID.
3. Dos procesos que ignoran TERM siguen ejecutandose tras TERM y dejan de ejecutar tras KILL por grupo.
4. Control negativo de aislamiento: un descendiente con nueva sesion/PGID sobrevive al KILL del grupo del lider. Tras morir el lider el medidor rechaza medir ese PID, aunque la hoja sigue viva. El arnes mata explicitamente esa hoja despues.
5. RLIMIT_AS de kernel a 96MiB permite asignar 16MiB y rechaza 160MiB con MemoryError. Es espacio virtual por proceso, NO limite RSS ni limite agregado de arbol.
6. Dos descendientes con el limite heredado asignan simultaneamente 64MiB cada uno, superando 96MiB agregados. Este control evita presentar RLIMIT_AS como sustituto de un presupuesto de arbol.

## Seguridad del arnes y alcance

Cada fixture de arbol tiene alarma de salida de 15s. El runner tiene deadlines y cleanup de todos los PIDs conocidos, incluso en negativos. El helper considera zombies como procesos que ya no ejecutan; no afirma recoleccion por PID1 ni desaparicion inmediata de /proc. La lectura de /proc acepta ENOENT y ESRCH como carreras normales de salida. No crea ni modifica cgroups: en el entorno donde se corrio, el montaje es rw pero sus controles pertenecen a root y no estan delegados al usuario. No se generaliza este hecho al runner CI.

Las pruebas de senal usan directamente la primitiva de grupo de Linux, no el lifecycle de inference. No acreditan que stop del runtime completo cumpla esos resultados, ni eliminan las carreras de PGID/PID, reparenting o reserva-puerto/bind. No atestan PID-endpoint. La prueba de grupo se limita a dos procesos conocidos, no a adversarios arbitrarios.

Nada de esto prueba Mac, sandbox de datos, red denegada, 1GiB incremental/4GiB total, rendimiento, p95 ni cese fisico del modelo antes de 15s. No se cambia presupuesto, catalogo ni contrato de activacion. C real sigue detenido.

## Evidencia local

- Seis pruebas PASS; cinco repeticiones adicionales PASS antes del ultimo endurecimiento de timers, y corrida final de seis PASS despues.
- Combinado final con inference e intake-owned-runtime: 57/57 PASS, sin cambio de producto.
- Conjunto exacto de 56 archivos del workflow: 353 tests, 350 PASS, 3 SKIP, 0 FAIL. API workflow smoke PASS.
- Negativo RSS: sustituir suma de descendientes por solo lider falla la primera prueba con arbol y hoja del mismo tamano.
- Negativo senal: sustituir TERM al grupo por TERM solo al lider falla por supervivencia de hoja. Cleanup posterior completo.
- Build PASS. No procesos fixture ejecutandose tras las corridas. Pendiente revision del conductor y publicacion; no confundir evidencia local con CI remoto.

Siguiente control necesario para Linux seria un contenedor/cgroup realmente delegado que imponga limite agregado y eliminacion del grupo, con el descendiente escapado como negativo obligatorio. Para Mac hace falta mecanismo nativo propio y medirlo alli; ni RLIMIT_AS ni estas pruebas son portables como garantia.
