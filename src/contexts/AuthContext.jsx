import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [loading, setLoading] = useState(true)
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false)

  useEffect(() => {
    // Sessão inicial
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null)
        if (session?.user) loadPerfil(session.user.id)
        else setLoading(false)
      })
      .catch((err) => {
        console.error('Erro ao obter sessão:', err)
        setLoading(false)
      })

    // Listener de mudanças
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setNeedsPasswordSetup(true)
      }
      setUser(session?.user ?? null)
      if (session?.user) loadPerfil(session.user.id)
      else { setPerfil(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadPerfil(userId) {
    try {
      const { data } = await supabase
        .from('perfis')
        .select('*, clientes(*)')
        .eq('id', userId)
        .single()
      setPerfil(data)
    } catch (err) {
      console.error('Erro ao carregar perfil:', err)
    } finally {
      setLoading(false)
    }
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (!error) setNeedsPasswordSetup(false)
    return { error }
  }

  return (
    <AuthContext.Provider value={{ user, perfil, setPerfil, loading, signIn, signOut, needsPasswordSetup, updatePassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
