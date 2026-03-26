import { useState, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function Perfil() {
  const { perfil, setPerfil } = useAuth()
  const [nome, setNome] = useState(perfil?.nome || '')
  const [saving, setSaving] = useState(false)
  const [sucesso, setSucesso] = useState('')
  const [erro, setErro] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()

  // ── Senha
  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmaSenha, setConfirmaSenha] = useState('')
  const [showSenhas, setShowSenhas] = useState(false)
  const [savingSenha, setSavingSenha] = useState(false)
  const [sucessoSenha, setSucessoSenha] = useState('')
  const [erroSenha, setErroSenha] = useState('')

  const requisitos = [
    { ok: novaSenha.length >= 8,          txt: 'Mínimo 8 caracteres' },
    { ok: /[A-Z]/.test(novaSenha),         txt: 'Uma letra maiúscula' },
    { ok: /[a-z]/.test(novaSenha),         txt: 'Uma letra minúscula' },
    { ok: /[0-9]/.test(novaSenha),         txt: 'Um número' },
    { ok: /[^A-Za-z0-9]/.test(novaSenha),  txt: 'Um caractere especial' },
    { ok: novaSenha && novaSenha === confirmaSenha, txt: 'Senhas coincidem' },
  ]

  async function salvarPerfil() {
    if (!nome.trim()) { setErro('Nome é obrigatório'); return }
    setSaving(true); setErro(''); setSucesso('')
    const { error } = await supabase
      .from('perfis')
      .update({ nome: nome.trim() })
      .eq('id', perfil.id)
    if (error) { setErro(error.message) }
    else {
      setSucesso('Perfil atualizado com sucesso!')
      if (setPerfil) setPerfil(p => ({ ...p, nome: nome.trim() }))
      setTimeout(() => setSucesso(''), 3000)
    }
    setSaving(false)
  }

  async function uploadFoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { setErro('Imagem deve ter no máximo 2MB'); return }
    setUploading(true); setErro('')
    const ext = file.name.split('.').pop()
    const path = `avatars/${perfil.id}.${ext}`
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (upErr) { setErro('Erro ao fazer upload: ' + upErr.message); setUploading(false); return }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    const url = data.publicUrl + '?t=' + Date.now()
    await supabase.from('perfis').update({ avatar_url: url }).eq('id', perfil.id)
    if (setPerfil) setPerfil(p => ({ ...p, avatar_url: url }))
    setSucesso('Foto atualizada!')
    setTimeout(() => setSucesso(''), 3000)
    setUploading(false)
  }

  async function salvarSenha() {
    setErroSenha(''); setSucessoSenha('')
    if (!requisitos.every(r => r.ok)) { setErroSenha('Corrija os requisitos da senha'); return }
    setSavingSenha(true)
    // Verificar senha atual fazendo signIn
    const { error: signErr } = await supabase.auth.signInWithPassword({
      email: perfil.email,
      password: senhaAtual
    })
    if (signErr) { setErroSenha('Senha atual incorreta'); setSavingSenha(false); return }
    const { error } = await supabase.auth.updateUser({ password: novaSenha })
    if (error) { setErroSenha(error.message) }
    else {
      setSucessoSenha('Senha alterada com sucesso!')
      setSenhaAtual(''); setNovaSenha(''); setConfirmaSenha('')
      setTimeout(() => setSucessoSenha(''), 3000)
    }
    setSavingSenha(false)
  }

  return (
    <div className="cfg-wrap">
      <div className="cfg-hdr">
        <div>
          <h1 className="page-title">Meu Perfil</h1>
          <p className="page-subtitle">Gerencie suas informações pessoais e segurança da conta</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 600 }}>

        {/* ── FOTO E NOME ── */}
        <div className="cfg-group">
          <div className="cfg-group-title">Informações pessoais</div>

          {/* Avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 8 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--gold-md), var(--gold))',
                color: 'var(--navy-900)', fontSize: 28, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', border: '2px solid var(--brd2)'
              }}>
                {perfil?.avatar_url
                  ? <img src={perfil.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : perfil?.nome?.[0]?.toUpperCase() || '?'
                }
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                style={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: 26, height: 26, borderRadius: '50%',
                  background: 'var(--gold)', border: '2px solid var(--bg2)',
                  color: 'var(--navy-900)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700
                }}
              >
                {uploading ? '…' : '✎'}
              </button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadFoto} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt1)' }}>{perfil?.nome}</div>
              <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 2 }}>{perfil?.email}</div>
              <div style={{ fontSize: 10, color: 'var(--gold)', marginTop: 4 }}>
                {perfil?.papel === 'admin_polimata' ? 'Admin Polímata' :
                 perfil?.papel === 'consultor_polimata' ? 'Consultor Polímata' :
                 perfil?.papel === 'gestor_cliente' ? 'Gestor do Cliente' : 'Usuário Cliente'}
              </div>
            </div>
          </div>

          <div className="cfg-field">
            <label>Nome completo</label>
            <input className="input-light" value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome" />
          </div>

          <div className="cfg-field">
            <label>Email</label>
            <input className="input-light" value={perfil?.email || ''} disabled
              style={{ opacity: 0.5, cursor: 'not-allowed' }} />
            <span style={{ fontSize: 10, color: 'var(--txt3)' }}>O email não pode ser alterado</span>
          </div>

          {erro && <div className="cfg-erro">{erro}</div>}
          {sucesso && <div className="cfg-sucesso">{sucesso}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn-cfg-save" onClick={salvarPerfil} disabled={saving}>
              {saving ? 'Salvando...' : '✓ Salvar alterações'}
            </button>
          </div>
        </div>

        {/* ── ALTERAR SENHA ── */}
        <div className="cfg-group">
          <div className="cfg-group-hdr">
            <div className="cfg-group-title">Segurança</div>
            <button className="btn-cfg-sm" onClick={() => setShowSenhas(v => !v)}>
              {showSenhas ? 'Cancelar' : 'Alterar senha'}
            </button>
          </div>

          {!showSenhas && (
            <div style={{ fontSize: 12, color: 'var(--txt3)' }}>
              Sua senha foi definida. Clique em "Alterar senha" para criar uma nova.
            </div>
          )}

          {showSenhas && (
            <>
              <div className="cfg-field">
                <label>Senha atual</label>
                <input className="input-light" type="password" value={senhaAtual} onChange={e => setSenhaAtual(e.target.value)} placeholder="••••••••" />
              </div>
              <div className="cfg-field">
                <label>Nova senha</label>
                <input className="input-light" type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} placeholder="••••••••" />
              </div>
              <div className="cfg-field">
                <label>Confirmar nova senha</label>
                <input className="input-light" type="password" value={confirmaSenha} onChange={e => setConfirmaSenha(e.target.value)} placeholder="••••••••" />
              </div>

              {/* Requisitos visuais */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {requisitos.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: r.ok ? '#22C55E' : 'var(--txt3)' }}>
                    <span>{r.ok ? '✓' : '○'}</span>{r.txt}
                  </div>
                ))}
              </div>

              {erroSenha && <div className="cfg-erro">{erroSenha}</div>}
              {sucessoSenha && <div className="cfg-sucesso">{sucessoSenha}</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn-cfg-save" onClick={salvarSenha} disabled={savingSenha || !requisitos.every(r => r.ok)}>
                  {savingSenha ? 'Salvando...' : '✓ Alterar senha'}
                </button>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  )
}
