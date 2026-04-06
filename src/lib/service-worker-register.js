// Registrar service worker e forçar reload após deploy
export function registerServiceWorker() {
  if ('serviceWorker' in navigator && 'window' in typeof window) {
    try {
      navigator.serviceWorker
        .register('/service-worker.js', { scope: '/' })
        .then((registration) => {
          console.log('[SW] Registered:', registration)

          // Verificar updates a cada 60 segundos
          setInterval(() => {
            registration.update()
          }, 60000)

          // Listener para nova versão
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'activated') {
                  console.log('[SW] New version available!')
                  window.location.reload()
                }
              })
            }
          })
        })
        .catch((error) => {
          console.warn('[SW] Registration failed:', error)
        })

      // Listener para mensagem do SW
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SKIP_WAITING') {
          window.location.reload()
        }
      })
    } catch (err) {
      console.warn('[SW] Error:', err)
    }
  }
}
