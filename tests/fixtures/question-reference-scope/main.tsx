import {createRoot} from 'react-dom/client';
import IntakeQuestion from '../../../src/IntakeQuestion';
import '../../../src/styles.css';
import '../../../src/intake-pilot.css';
createRoot(document.getElementById('root')!).render(<main className="rp-shell" style={{maxWidth:800,margin:'24px auto',padding:16}}><h1>Consulta sintética</h1><IntakeQuestion disabled={false} reservationRevision={0} onPermit={async()=>{throw Error('No permit in this fixture');}} onSelect={async selection=>{document.getElementById('chosen')!.textContent=JSON.stringify(selection);}}/><output id="chosen" aria-label="Selección preparada"/></main>);
