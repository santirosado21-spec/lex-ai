import {createRoot} from 'react-dom/client';
import {useState} from 'react';
import IntakeTradeWorksheet from '../../../src/IntakeTradeWorksheet';
import '../../../src/styles.css';
import '../../../src/intake-pilot.css';
function Harness(){
 const [dirty,setDirty]=useState(false);
 return <main className="rp-shell" style={{maxWidth:800,margin:'24px auto',padding:16}}><h1>Control de prueba sintético</h1>
 <p>Edición: {dirty?'sin guardar':'guardada'}</p>
 <IntakeTradeWorksheet task="lectura-valoracion" disabled={false} onDirty={setDirty} onSave={()=>{}}/></main>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
