import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { loadKakaoMaps } from './lib/kakaoSdk';
import './styles.css';

// The map waits on the SDK; start fetching it now rather than after the
// first render mounts the map (the load is shared, see loadKakaoMaps).
void loadKakaoMaps();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
