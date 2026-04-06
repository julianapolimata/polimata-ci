// src/hooks/useServiceWorkerCleanup.js
import { useEffect } from 'react';

export const useServiceWorkerCleanup = () => {
  useEffect(() => {
    // Limpar SW antigos quando a app monta
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister().then(() => {
            console.log('[App] Service Worker desregistrado:', registration);
          });
        });
      });
    }

    // Limpar localStorage de versionamento (se usar)
    const storedVersion = localStorage.getItem('app-version');
    const currentVersion = import.meta.env.VITE_APP_VERSION || 'latest';
    
    if (storedVersion !== currentVersion) {
      console.log(`[App] Versão mudou: ${storedVersion} → ${currentVersion}`);
      localStorage.setItem('app-version', currentVersion);
      
      // Limpar cache da API se tiver
      if ('caches' in window) {
        caches.keys().then((cacheNames) => {
          cacheNames.forEach((name) => {
            if (!name.includes(currentVersion)) {
              caches.delete(name).then(() => {
                console.log(`[Cache] Deletado: ${name}`);
              });
            }
          });
        });
      }
    }
  }, []);
};
