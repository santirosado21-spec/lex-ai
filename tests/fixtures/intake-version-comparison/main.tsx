import {createRoot} from 'react-dom/client';
import IntakeSourceFiles from '../../../src/IntakeSourceFiles';
import '../../../src/styles.css';import '../../../src/intake-pilot.css';
createRoot(document.getElementById('root')!).render(<main className="rp-shell" style={{maxWidth:800,margin:'24px auto',padding:16}}><IntakeSourceFiles sources={[{id:'a',label:'Contrato base sintético',hasFile:false,extension:null},{id:'b',label:'Contrato revisado sintético',hasFile:false,extension:null}]} pair={null} disabled={false} onSave={async()=>false} onCompare={async()=>{}} onAsk={()=>{}}/></main>);
