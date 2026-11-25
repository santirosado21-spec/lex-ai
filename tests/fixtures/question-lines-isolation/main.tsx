import {createRoot} from 'react-dom/client';
import {StrictMode,useState} from 'react';
import IntakeQuestionLines from '../../../src/IntakeQuestionLines';
import '../../../src/styles.css';
import '../../../src/intake-pilot.css';
function Harness() {
 const [review,setReview]=useState('review-a');
 const [selected,setSelected]=useState<string[]>([]);
 return <main className="rp-shell" style={{maxWidth:800,margin:'24px auto',padding:16}}>
  <h1>Soportes de prueba, datos sintéticos</h1>
  <button onClick={()=>{setReview('review-b');setSelected([]);}}>Cambiar revisión</button>
  <p>Revisión activa: {review}</p>
  <section className="rp-question"><IntakeQuestionLines reviewId={review} sources={[{id:'source-1',label:'Soporte sintético'}]} selected={selected} disabled={false} onChange={setSelected}/></section>
 </main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Harness/></StrictMode>);
