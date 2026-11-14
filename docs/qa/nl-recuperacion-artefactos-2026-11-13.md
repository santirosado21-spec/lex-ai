# Recuperacion de artefactos de Nuevo Leon (pilot-mx-nle-2026-11-11) - 2026-11-13

Los 8 artefactos de Nuevo Leon adquiridos originalmente el 2026-11-11
(pilot-mx-nle-2026-11-11) no estaban presentes en el arbol actual ni en
MANIFEST-RESPALDO.sha256 (brecha detectada en la reconciliacion de conteos
2026-11-13). Se re-adquirieron desde la fuente oficial permitida y se
contrastaron con los hashes conservados. Todo el material queda en CUARENTENA
(textReview/legalReview pendientes, published=false, indexed=false).

## Metodo y evidencia

- Registry: resources/legal-acquisition-nl-recuperacion-2026-11-13.json
  (mismas 8 URLs oficiales hcnl.gob.mx del registry pilot original).
- Verificacion previa 2026-11-13: robots.txt `User-agent: * Allow: /`;
  HEAD 8/8 HTTP 200 application/pdf, 227,221-1,779,177 bytes, bajo limites.
- Base documentada: LFDA art. 14 frac. VIII (base documentada, no conclusion
  legal); la ausencia de terminos NO se presenta como autorizacion expresa.

## Contraste con hashes conservados

- nuevo-leon-pending-01 (Codigo Civil): sha256 =
  a517709dd10664bbf7fc4ee77e32e4a0da7fdfbce45b662166dc706ead3c8af7.
  COINCIDE con el freeze (C1b4).
- nuevo-leon-pending-02 (Codigo Penal): sha256 =
  440f28ca7515f63c35e5e9034086e843e126bed75f6d07dfe1067537607c3d76.
  COINCIDE con el freeze (C1b4).
- Los otros 6 no tenian pdfSha256 conservado: se contrastan contra los conteos
  testigo de la auditoria 2026-11-11 (extractor v12): 03 1,202 = 1,202,
  04 211 = 211, 05 64 = 64 (coinciden); 01 3,088 = 3,088 coincide;
  02 589 -> 593 difiere por el extractor vigente (v24 vs v12), diferencia de
  version de parser, no de fuente (el sha256 del PDF coincide).
  Sin hash conservado no se afirma identidad bit a bit de esos 6.

## Resultado

8/8 documentos re-adquiridos y cuarentenados: 5,614 registros con el extractor
vigente. Estado: brecha NL cerrada con evidencia; inventario global presente:
1,383 + 8 = 1,391 ids unicos, 142,153 registros.
