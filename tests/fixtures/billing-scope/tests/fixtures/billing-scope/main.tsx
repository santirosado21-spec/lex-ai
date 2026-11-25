import '@fontsource/schibsted-grotesk/400.css';
import '@fontsource/newsreader/400.css';
import '../../../src/styles.css';
import '../../../src/tailwind.css';
import '../../../src/macos.css';
import '../../../src/design-system.css';
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import TimeBillingView from '../../../src/TimeBillingView';
const matters=[{id:'a',title:'Asunto A sintético',client:'Cliente A',jurisdiction:'MX-FED'},{id:'b',title:'Asunto B sintético',client:'Cliente B',jurisdiction:'MX-FED'}];
function Fixture(){const [matter,setMatter]=useState(matters[0]);return <><button onClick={()=>setMatter(matters[0])}>Abrir A externo</button><button onClick={()=>setMatter(matters[1])}>Abrir B externo</button><TimeBillingView matter={matter} matters={matters}/></>;}
createRoot(document.getElementById('root')!).render(<Fixture/>);
