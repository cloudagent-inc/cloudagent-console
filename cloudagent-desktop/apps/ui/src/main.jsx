import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import LocalAuthGate from './components/LocalAuthGate.jsx';
import './index.css';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store';
import AppErrorBoundary from './components/AppErrorBoundary.jsx';
import { installStaleAssetRecovery } from './lib/staleAssetRecovery.js';

installStaleAssetRecovery(window);

createRoot(document.getElementById('root')).render(
  <AppErrorBoundary>
    <Provider store={store}>
      <BrowserRouter>
        <LocalAuthGate><App /></LocalAuthGate>
      </BrowserRouter>
    </Provider>
  </AppErrorBoundary>
);
