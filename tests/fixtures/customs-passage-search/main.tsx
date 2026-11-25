import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import IntakeCustomsLaw from '../../../src/IntakeCustomsLaw';
import '../../../src/styles.css';
import '../../../src/intake-pilot.css';
function App(){const [selection,setSelection]=useState('');return <main className="rp-shell" style={{maxWidth:800,margin:'24px auto',padding:16}}><IntakeCustomsLaw onAsk={(article,topic)=>setSelection(JSON.stringify({article,topic}))}/><output aria-label="Consulta preparada">{selection}</output></main>;}
createRoot(document.getElementById('root')!).render(<App/>);
