# Regenerates the two FICTITIOUS trade fixtures (requires reportlab). All names, numbers and amounts are invented.
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
def pedimento():
    c=canvas.Canvas('pedimento-ficticio.pdf',pagesize=letter);W,H=letter
    c.setFont('Helvetica-Bold',12);c.drawString(40,H-40,'PEDIMENTO FICTICIO DE IMPORTACION (documento sintetico, no real)')
    c.setFont('Helvetica',9)
    rows=[('NUM. PEDIMENTO:','26 47 3999 6000123'),('TIPO OPER:','IMP'),('CVE. PEDIMENTO:','A1'),('REGIMEN:','IMD'),('ADUANA:','470 VERACRUZ'),('RFC IMPORTADOR:','MRS260102XY3'),('FECHA ENTRADA:','03/11/2026'),('TIPO CAMBIO:','18.6147'),('VALOR DOLARES:','120,000.00'),('VALOR ADUANA:','2,233,764.00'),('FLETES:','176,839.65'),('SEGUROS:','1,500.00'),('DTA:','7,000.00'),('IVA:','358,302.19')]
    y=H-70
    for a,b in rows: c.drawString(40,y,a);c.drawString(200,y,b);y-=14
    y-=10;c.setFont('Helvetica-Bold',9)
    heads=['SEC','FRACCION','DESCRIPCION','UMC','CANT','VAL.ADU','IGI','IVA']
    xs=[40,75,130,300,340,390,455,510]
    for h,x in zip(heads,xs): c.drawString(x,y,h)
    c.setFont('Helvetica',9);y-=14
    items=[('1','84224001','MAQUINA ENVASADORA FICTICIA','PZA','1','1,900,000.00','95,000.00','320,000.00'),('2','84229099','PARTES Y REFACCIONES FICTICIAS','KGM','350','333,764.00','16,688.00','38,302.19')]
    for it in items:
        for v,x in zip(it,xs): c.drawString(x,y,v)
        y-=14
    y-=10;c.drawString(40,y,'OBSERVACIONES: CUENTA FICTICIA 000111222333444 BANCO MUESTRA. CONTACTO correo-demo@ejemplo.invalid TEL 55 5555 0199');
    c.save()
def factura():
    c=canvas.Canvas('factura-ficticia.pdf',pagesize=letter);W,H=letter
    c.setFont('Helvetica-Bold',12);c.drawString(40,H-40,'COMMERCIAL INVOICE / FACTURA COMERCIAL FICTICIA (sintetica)')
    c.setFont('Helvetica',9);y=H-70
    for t in ['Invoice No: FAC-2026-0457          Date: 2026-10-20','Seller: Verpackung Beispiel GmbH, Beispielstrasse 45, Hamburg','Buyer: Manufacturas Rio Seco, S.A. de C.V., RFC MRS260102XY3','Incoterm: FOB Hamburg    Currency: USD','Payment: wire to account 000111222333444']:
        c.drawString(40,y,t);y-=14
    y-=8;c.setFont('Helvetica-Bold',9)
    for h,x in zip(['Item','Description','Qty','Unit price','Amount'],[40,90,330,400,480]): c.drawString(x,y,h)
    c.setFont('Helvetica',9);y-=14
    for it in [('1','Packaging line model X (fictitious)','1','110,000.00','110,000.00'),('2','Spare parts kit (fictitious)','350','28.57','10,000.00')]:
        for v,x in zip(it,[40,90,330,400,480]): c.drawString(x,y,v)
        y-=14
    c.drawString(400,y-6,'TOTAL USD'); c.drawString(480,y-6,'120,000.00'); c.save()
pedimento();factura()
