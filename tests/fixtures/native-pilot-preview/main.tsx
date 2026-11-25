import {createRoot} from 'react-dom/client';import NativePilotPreview from '../../../src/NativePilotPreview';import '../../../src/styles.css';import '../../../src/tailwind.css';import '../../../src/macos.css';import '../../../src/design-system.css';
Object.assign(window,{__TAURI_INTERNALS__:{},testNative:{token:0,state:(window as any).previewInitialState||'locked',fail:false,release:null}});
createRoot(document.getElementById('root')!).render(<NativePilotPreview/>);
