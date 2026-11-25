# CI7200bf8: concurrencia OCR acotada, causa aún no confirmada

Log recuperado por conductor: único fallo del paso portable,254tests,
251PASS/1FAIL/2skip, fue registry forceOcr flag widens the OCR trigger.
Tesseract página2, idioma spa, dpi300, falló a30838ms con stderr vacío.
El log no contiene killed/signal/code. Timeout/contención es hipótesis compatible,
NO causa confirmada. El worker reenvía solo error.message; no se modifica aquí.
Los15tests contractuales sí pasaron en CI.

Código observado: execFile tesseract limita cada página a30000ms y4MiB de salida;
OCR procesa hasta3páginas en paralelo, mientras node --test corre33archivos.
No había límite OpenMP por proceso. Cambio: SOLO envOMP_THREAD_LIMIT=1 en ese
pasoCI. Se conserva toda la lista, timeout, tres workers, DPI, idiomas, fixtures,
asserts, cuarentena y calidad. Sin cambio de producto ni workflow de diagnóstico.
No se registran documentos privados, comandos de usuario ni credenciales.

Evidencia local (Ubuntu22.04.5, Node22.23.5,2CPU):
- Sin parche: paso exacto252PASS/2skip/0FAIL. Tras build+UI19/19, mismo resultado.
- Herramienta local tesseract4.1.1: solo eng/osd; CI dispone spa. No se instaló
  idioma ni se fingió equivalencia. Estos resultados NO reproducen el fallo spa.
- Diagnóstico acotado:3procesos concurrentes sobre misma página2 de fixture
  sintético, timeout30s. Sin límite:902/1143/1080ms; límite1:667/624/757ms.
  Retorno0/stderr vacío/texto idéntico en6procesos. Apoya acotar sobremultiplicación,
  NO demuestra por qué falló el runnerCI. No se reprodujo error para medir
  killed/signal/code; no se afirman esos valores.
- Con env1: OCR4/4PASS,3.46s; paso portable254tests252PASS/2skip/0FAIL,23.79s.
  No se retiró cobertura ni se añadieron reintentos.

Propuesta mínima de estabilización para revisión, no arreglo causal probado.
Solo una futura ejecuciónCI puede observar si reaparece el fallo en spa. Si
reaparece, recuperar error concreto; no subir timeout ni declarar flakiness
sin evidencia. Sin modelo/B0/heldout, instalación, GUI o publicación propia.
