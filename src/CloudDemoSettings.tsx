import {useState} from 'react';
import {api} from './api';

export default function CloudDemoSettings() {
 const [busy, setBusy] = useState(false);
 const [message, setMessage] = useState('');

 async function run() {
  setBusy(true);
  setMessage('Comprobando la conexión con un mensaje de prueba…');
  try {
   const result = await api<{connected:boolean}>('cloudDemo.run');
   setMessage(result.connected ? 'Conexión con OpenAI verificada.' : 'La prueba de nube no se completó.');
  } catch (error) {
   setMessage(error instanceof Error ? error.message : 'La prueba de nube no se completó.');
  } finally {
   setBusy(false);
  }
 }

 return <section className="settings-section">
  <div>
   <h2>Modo nube de prueba</h2>
   <p>Envía a OpenAI un mensaje ficticio predefinido. No envía tus consultas ni documentos. El razonamiento del despacho sigue sin activar.</p>
  </div>
  <div className="settings-panel">
   <button className="secondary" type="button" disabled={busy} onClick={() => void run()}>Probar modo nube</button>
   <p role="status">{message}</p>
  </div>
 </section>;
}
