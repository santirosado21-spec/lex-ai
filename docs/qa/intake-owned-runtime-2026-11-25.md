# Transporte propio del lector, preparado y apagado

Base: 5020769. No conectado a main, HTTP, preview nativa ni UI. No se ejecutaron modelo, daemon real ni nube.

## Implementado

- createOwnedIntakeContractualOllama compone el candidato existente con una capacidad interna readerRequest. Construir no arranca nada; initialize es explícito. No acepta URL ni selección de modelo.
- Reutiliza el lifecycle de inference, sin usar generate. Verifica manifiesto y blobs antes de arrancar; modelo fijado por catálogo. Sin descarga, copia de modelos ni registro remoto. El almacén es dataDir/models, sin heredar LEX_MODELS_DIR.
- Puerto efímero loopback validado, nunca11434; redirecciones HTTP denegadas. El cuerpo admite solo modelo, mensajes y opciones del contrato8192/4096 o256, sin sustituir por los presupuestos de generación jurídica.
- Cancelación/timeout/error de petición cierra el runtime propio y vuelve terminal esa instancia. Stop aborta inicialización y petición, deniega reinicio y espera cierre del hijo. No se suelta una referencia cuya salida no se confirma: error cleanup=unconfirmed, no stopped exitoso. La API antigua también deja de ocultar ese fallo.
- Headers y cuerpo de arranque/lector tienen cancelación y capacidad limitada. Una respuesta tardía de un transporte que ignora abort no puede activar peticiones nuevas.
- CI portátil incluye inference e intake-owned-runtime.

## Medido con dobles y archivos sintéticos

53 pruebas focales PASS. Suite portátil40archivos324tests:321PASS/3SKIP/0FAIL. Build y API workflow smoke PASS.

Casos: constructor apagado, modelo/opciones/endpoint fijos; archivos ausentes o corruptos antes del spawn; rechazo11434; concurrencia; cancelación durante fetch y cuerpo; stop durante arranque que ignora abort; respuesta tardía; hijo que ignora TERM/KILL; respuesta sobredimensionada; composición contractual completa sin fetch compartido.

Estos procesos son EventEmitter, pesos son bytes sintéticos, fetch está simulado. No acreditan procesos reales, aislamiento, RSS, privacidad de red ni calidad del modelo en Mac.

## Límites que bloquean activación real

- No hay enforcement acreditado de1GiB incremental/4GiB total ni p95. El timer lógico15s puede sumar hasta2.5s de intento de cierre, no garantiza cese físico a15s.
- Una salida del padre no prueba que todos los descendientes hayan muerto. TERM/KILL por grupo tiene carreras y posibles cambios de grupo. Cleanup confirmado aquí significa solo salida del hijo observado.
- La reserva de puerto cierra el socket antes de spawn: persiste carrera de ocupación y no hay atestación de que la respuesta pertenezca al PID propio. Fallo de bind/daemon debe revisarse antes de enviar texto real. No afirmar exclusividad probada del endpoint por el nombre de la fábrica.
- runtimePath es ruta explícita de servidor, no una identidad binaria verificada en este corte. No se cambia inventario/firma del bundle.
- Mantiene keep_alive30s contractual; éxito no implica descarga inmediata de memoria. Stop explícito es necesario al cerrar el ciclo completo.
- El verificador heredado acepta rutas del almacén; no es sandbox ni bloqueo de modificaciones concurrentes/symlinks. dataDir debe ser dedicado y validado antes de una integración real.
- El contrato solicita8192 pese a default de daemon4096: petición preservada, comportamiento efectivo no medido.
- El adaptador anterior compartido sigue disponible por compatibilidad histórica, pero la nueva composición no lo usa. Ninguno se incorpora al producto.

C real sigue detenido. No elegir otra envolvente ni arrancar para evaluar este corte. Revisión del conductor y revisiones específicas antes de proponer una prueba real con riesgos concretos.

## Revisión Sol6.2 y corrección posterior

Se trataron los reportes estáticos como hipótesis. Casos sintéticos añadidos reproducen: lifetime del candidato sin aborto al cerrar; cancelación de reader bloqueado; exit durante memoria final que publicaba ready; statfs pendiente que colgaba stop; cierre no recuperable tras exit tardío; generate reanudado después de stop; monitor RSS antiguo que mataba reemplazo. Todos tienen regresión positiva. Además cancelación solicitante durante memoria y cuerpo; stop en reposo y antes del spawn.

Seis negativos selectivos fallan como esperado: retirar lifetime de composición; volver a cancelar Response en vez del reader bloqueado; retirar guardia terminal y aborto init en exit; quitar carrera abortable de statfs; no reconciliar cleanupFailed al confirmar exit; permitir al catch RSS tardío actuar sobre nuevo hijo. Se restauró código y42/42 pasan. Las primeras variantes de algunos negativos no aislaron el defecto por guardias redundantes; se corrigieron los negativos, no se cuentan como evidencia independiente.

La composición combina señal de lifetime con la del candidato. El lector de cuerpos posee getReader y cancela ese reader. El preflight espera operaciones cancelables lógicamente, comprueba cancelación antes de spawn y antes de ready. Las operaciones de filesystem subyacentes pueden terminar tarde; ninguna continuación autorizada puede arrancar daemon o publicar ready tras cierre. Un exit tardío permite confirmar limpieza del hijo, pero la instancia de lector sigue terminal. Las continuaciones de generate y RSS quedan ligadas a hijo/controlador inicial, no a reemplazos.

No se amplió al cierre HTTP general de main ni a acreditación del árbol real. La carrera reserva→bind y atestación PID↔endpoint siguen pendientes, por lo que este código continúa apagado y no es una garantía de exclusividad apta para datos reales.

## Delta V3 tras segunda revisión

- El generador legado comprueba identidad/cancelación antes de muestrear y después de cada reanudación de yield. Stop cancela sus timers aun si el consumidor mantiene suspendido el iterador. No entrega fragmentos antiguos ni mide el PID nuevo.
- Las lecturas y avisos de memoria capturan la época de inicialización: ni éxito ni rechazo tardíos alteran el siguiente arranque.
- Un líder ya muerto antes de nuestra señalización conserva cleanup=unconfirmed-tree y stop rechaza. No se afirma cierre de auxiliares. No se intenta matar un PGID que pudo reciclarse. Una salida del hijo después de señal propia solo se llama confirmed-child-exit, nunca prueba del árbol completo.
- Cada intento fallido retira el listener temporal de exit. El lector por líneas legado permite cancelar el reader de api/pull con cuerpo no cooperativo.
- Nuevas pruebas: generador suspendido con chunk viejo buffer; memoria obsoleta; líder muerto; listeners; initialize concurrente antes del spawn; puerto ocupado representado por hijo con bind fallido; pull legado pendiente. La prueba de colisión solo cubre fallo de bind ya observable, NO resuelve carrera antes de que ese fallo se conozca ni atesta endpoint.
- Cuatro negativos delta fallan retirando guardia de yield, rechazo líder muerto, época de memoria y limpieza listener. Restauradas defensas. Riesgos reales, endpoint sin atestación y C detenido sin cambios.

## Delta V4, cierre de las regresiones concretas de NDJSON/señal

- records recibe la señal combinada de generación, cancela SU reader en finally también ante parse error/return. La guarda tras yield consulta también señal del solicitante, incluso si texto y done pertenecen al mismo registro. Stop retira controlador/busy antiguos; una continuación vieja no limpia ni usa generación nueva.
- La señal de proceso solo se registra si process.kill/child.kill devuelve true. Si devuelve false y el líder sale espontáneamente, stop conserva unconfirmed-tree en vez de atribuir esa salida a señal propia.
- Cuatro pruebas y cuatro negativos específicos: cuerpo abierto/pending next tras stop; aborto caller con chunk buffered y texto+done; parse error/return cancelan stream; kill false más salida natural. Todos pasan y cada negativo falla al retirar su defensa.
- El cambio records manual de V3 introducía la fuga parse/return frente al for-await original, corregida aquí. Los huecos de aborto de generación eran heredados, pero tocaban el lifecycle compartido reutilizado; se acotan a cancelación/identidad de esa API, sin reactivar razonamiento ni abrir otra evaluación.
- La prueba de puerto bind fallido es cobertura de estado, no prueba negativa que discrimine V2 ni garantía PID↔endpoint. No se presenta como cierre de ese riesgo.
- Conjuntos: focales53; portátil40archivos324tests321PASS3SKIP; build y API smoke PASS. La corrida del conductor sobre V3 incluyó UI y otro conjunto55archivos342tests336PASS1FAIL5SKIP, con antiword ausente reproducido en base. No sumar conjuntos ni llamar a ambas cifras el mismo total.

## Delta V5, contraejemplo de reintento propuesto por Muse

Reproducido en V4 final: primer stop con TERM/KILL true sin salida termina unconfirmed; segundo stop empieza con líder vivo, TERM false y salida natural, pero WeakSet histórico permitía stopped/confirmed-child-exit. La promesa cleanupTask sí se elimina entre intentos. No era un caso inalcanzable.

V5 distingue intento iniciado con hijo vivo, que requiere una señal aceptada en ESE intento, de reintento iniciado con salida ya observada tras un intento previo. Este último confirma solamente salida del hijo, nunca árbol. Regresión de dos stop reproduce el caso y exige error/unconfirmed-tree en el segundo; un tercer stop solo reconcilia el hecho child-exit ya conocido, sin reactivar la instancia. La regresión anterior de salida tardía sigue vigente. Negativo: volver a exigir solo WeakSet histórico falla la nueva prueba.

Validación final V5:54 focales PASS.55archivos exactos del workflow347tests344PASS3SKIP0FAIL, build y API workflow smoke PASS. Sin modelo, Mac, nube de documentos ni activación de producto. V4 queda supersedida; revisar solo delta de intento vigente, no abrir otra auditoría.
