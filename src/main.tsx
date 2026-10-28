import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { loadKakaoMaps } from './lib/kakaoSdk';
import { isNativeApp } from './lib/native';
import { startNativeDeepLinks } from './lib/nativeDeepLinks';
import AppLinkEntry from './components/AppLinkEntry';
import './styles.css';

// The map waits on the SDK; start fetching it now rather than after the
// first render mounts the map (the load is shared, see loadKakaoMaps).
void loadKakaoMaps();

if (isNativeApp()) {
  const links = startNativeDeepLinks().catch(() => () => {});
  if (import.meta.hot) import.meta.hot.dispose(() => { void links.then((stop) => stop()); });
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppLinkEntry><App /></AppLinkEntry>
  </React.StrictMode>,
);
