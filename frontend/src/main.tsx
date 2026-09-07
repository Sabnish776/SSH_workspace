import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { PopupProvider } from './context/PopupContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <PopupProvider>
    <App />
  </PopupProvider>
);

