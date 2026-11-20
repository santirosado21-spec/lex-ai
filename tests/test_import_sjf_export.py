import csv
import importlib.util
import io
from pathlib import Path
import sqlite3
import tempfile
import unittest
from zipfile import ZipFile

spec=importlib.util.spec_from_file_location("sjf",Path(__file__).parents[1]/"scripts/import-sjf-export.py")
sjf=importlib.util.module_from_spec(spec)
spec.loader.exec_module(sjf)


class ExportTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
        self.db=self.root/"investigacion.sqlite"

    def fixture(self,name,rows,encoding="utf-8-sig",receipt=b"%PDF-1.4\nAcuse ficticio"):
        data=io.StringIO(newline="")
        writer=csv.writer(data,delimiter=";")
        writer.writerow(["Registro digital","Rubro (título y subtítulo)","Texto","Tipo","Órgano","Nota de Publicación"])
        for rid,title,body in rows:
            writer.writerow([rid,title,body,"Jurisprudencia","Órgano ficticio","Prueba técnica"])
        file=self.root/name
        with ZipFile(file,"w") as z:
            z.writestr("carpeta/tesis.csv",data.getvalue().encode(encoding))
            z.writestr("carpeta/acuse.pdf",receipt)
        return file

    def test_replay_versions_and_private_original(self):
        row=("9123456","Cotejo ficticio","Valoración de prueba; revisar la factura.\nOtro renglón.")
        source=self.fixture("uno.zip",[row]);result=sjf.ingest(source,self.db)
        self.assertEqual(result["versiones_nuevas"],1)
        self.assertEqual(sjf.ingest(source,self.db)["versiones_nuevas"],0)
        repeated=self.fixture("dos.zip",[row],encoding="utf-16")
        self.assertEqual(sjf.ingest(repeated,self.db)["versiones_nuevas"],0)
        revised=self.fixture("tres.zip",[(row[0],row[1],row[2]+" Cambió el texto.")])
        self.assertEqual(sjf.ingest(revised,self.db)["versiones_nuevas"],1)
        self.assertEqual(len(sjf.search(self.db,"valoracion factura")),2)
        self.assertEqual(len(sjf.search(self.db,row[0])),2)
        db=sqlite3.connect(self.db)
        try:
            self.assertEqual(db.execute("select original_zip from sjf_export where sha=?",(result["archivo"],)).fetchone()[0],source.read_bytes())
            self.assertEqual(db.execute("select count(*) from sjf_export_row").fetchone()[0],3)
        finally:db.close()
        self.assertEqual(self.db.stat().st_mode & 0o077,0)

    def test_invalid_batches_never_partially_import(self):
        good=("9123456","Ficticio","Cotejo de prueba")
        sjf.ingest(self.fixture("base.zip",[good]),self.db)
        for name,rows,receipt in [("duplicado.zip",[good,good],b"%PDF-1.0"),
                                  ("sintexto.zip",[("9123457","Otro","")],b"%PDF-1.0"),
                                  ("malacuse.zip",[good],b"html"),
                                  ("demasiados.zip",[(str(9200000+i),"T","texto") for i in range(101)],b"%PDF-1.0")]:
            with self.assertRaises(ValueError):
                sjf.ingest(self.fixture(name,rows,receipt=receipt),self.db)
        with sqlite3.connect(self.db) as db:
            self.assertEqual(db.execute("select count(*) from sjf_export").fetchone()[0],1)
        self.assertFalse(sjf.search(self.db,"inexistente"))


if __name__=="__main__":
    unittest.main()
