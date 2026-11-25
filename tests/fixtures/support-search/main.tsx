import {createRoot} from 'react-dom/client';
import IntakeCaseDocument from '../../../src/IntakeCaseDocument';
import '../../../src/styles.css';
import '../../../src/intake-pilot.css';
createRoot(document.getElementById('root')!).render(<main className="rp-shell" style={{maxWidth:800,margin:'24px auto',padding:16}}><h1>Soporte sintético</h1><IntakeCaseDocument sources={[{id:'one',label:'Factura sintética',hasFile:false,extension:null},{id:'two',label:'Contrato sintético',hasFile:false,extension:null}]}/></main>);
