# Adquisicion de reglamentos federales (diputados.gob.mx) - 2026-11-13

Programa de adquisicion publica autorizada de reglamentos federales vigentes desde el
indice oficial de la Camara de Diputados. Todo el material queda en CUARENTENA
(textReview/legalReview pendientes, published=false, indexed=false): extraccion
estructural verificada, SIN revision independiente de contenido.

## Fuente y universo

- Indice: https://www.diputados.gob.mx/LeyesBiblio/regla.htm
  sha256 40c9e8a4cc7c2b0225b5c6733f1bb177950f64bc8432cdaa5109ae84a9207156 (424,660 bytes),
  re-verificado al inicio del programa.
- 150 filas PDF en el indice; 138 vigentes tras excluir 12 marcadas "Abrogado"
  (lista de excluidos preservada en los registros del programa).
- Registros (registry): resources/legal-acquisition-fed-reglamentos-NN-2026-11-13.json
  (lotes 1-14) mas lote 10b de excepcion documentada.
- Disciplina por lote: sha del indice re-verificado, HEAD por PDF (200 application/pdf),
  robots por lote, reanudacion idempotente sin regenerar registry (probada en lote 4).

## Resultado

- 137 de 138 documentos vigentes extraidos estructuralmente: 15,640 registros.
- 1 documento fall-closed permanente (ver incidentes).
- 0 publicados, 0 indexados; cuarentena completa.

## Incidentes y excepciones

1. reg-lgs-mcsaeps-orig-18ene88_ima (lote 10, errorCategory document-byte-budget):
   PDF oficial de 18,551,500 bytes (HEAD 200 application/pdf verificado 2026-11-13).
   maxDocumentBytes es un presupuesto interno conservador de recursos, NO una
   restriccion del titular ni de seguridad ni de terminos. Excepcion documentada
   solo para este registro en el registry del lote 10b, elevando el tope
   por documento a 20,971,520 bytes (techo duro de ACQUISITION_LIMITS, mismo
   precedente que ligie-2022 en fed-expansion-34). Limites globales de los demas
   registros sin cambio. Adquirido y extraido en el lote 10b.
2. reg-lfgfaga-fe-16may55 (lote 13, errorCategory extraction-invalid): FALLO
   PERMANENTE documentado. El PDF oficial (200 application/pdf, sha256
   f23efe8cbf020c7e6ce5b8bc99de45d04b72b291bd5621e96a8dd77ca0718b0e) es un
   escaneo de papel de 1 pagina sin capa de texto (metadatos: HP Commercial
   Scanjet 5590 TWAIN / captura de papel Adobe Acrobat 6.0, PDF 1.5). pdftotext
   extrae 0 palabras. El pipeline no aplica OCR; no se adquiere contenido no
   extraible de forma verificable. Queda registrado fail-closed, sin reintento
   y sin inclusion en el corpus.

## Estado

Programa cerrado: 137/138 vigentes en cuarentena, 1 exclusion permanente
documentada. La activacion del corpus en producto sigue prohibida; cualquier
uso posterior requiere revision de contenido independiente.
