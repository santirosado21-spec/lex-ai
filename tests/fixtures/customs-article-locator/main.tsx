import {createRoot} from 'react-dom/client';
import IntakeCustomsLaw from '../../../src/IntakeCustomsLaw';
import '../../../src/styles.css';
import '../../../src/intake-pilot.css';
createRoot(document.getElementById('root')!).render(<main className="rp-shell" style={{maxWidth:800,margin:'24px auto',padding:16}}><IntakeCustomsLaw onAsk={()=>{}}/></main>);
