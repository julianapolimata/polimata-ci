// Estilos do ModalRevisar — extraído em 22/mai/2026 (fatiamento Etapa 10).
export const S = {
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 },
  modal: { background: 'white', borderRadius: 12, width: '90vw', maxWidth: 700, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' },
  header: { background: '#00203E', color: 'white', padding: '20px 24px', borderBottom: '1px solid #e5e7eb' },
  body: { padding: 24, overflowY: 'auto', flex: 1, fontFamily: "'Montserrat', sans-serif" },
  footer: { background: '#fafbfc', borderTop: '1px solid #e5e7eb', padding: 24, display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' },
  label: { fontSize: 11, fontWeight: 700, color: '#7A8B9C', textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 13, color: '#00203E', fontWeight: 500, marginTop: 2 },
  btn: { padding: '0.7rem 1.2rem', fontSize: 12, fontWeight: 700, borderRadius: 6, cursor: 'pointer', fontFamily: "'Montserrat', sans-serif", textTransform: 'uppercase', letterSpacing: 0.3 },
  section: { background: '#F9F7F3', border: '1px solid #E8E2D8', borderRadius: 6, padding: '1rem', marginBottom: '1rem' },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: '#00203E', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid #E0D5C7' },
}
