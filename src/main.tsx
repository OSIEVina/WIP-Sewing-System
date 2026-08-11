import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Global error handlers to prevent unhandled rejection crashes
window.addEventListener('unhandledrejection', (event) => {
  console.warn('Unhandled Promise Rejection caught:', event.reason);
  event.preventDefault();
});

window.addEventListener('error', (event) => {
  console.warn('Global uncaught error caught:', event.error || event.message);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

