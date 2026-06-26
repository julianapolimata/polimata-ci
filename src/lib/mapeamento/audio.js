// ═══════════════════════════════════════════════════════════════════════════
// audio.js — preparação do áudio antes do upload (superar o limite de 25 MB).
// Se o arquivo já cabe, sobe como está. Se não, decodifica (Web Audio),
// converte para MONO e recomprime em MP3 ~32 kbps; se ainda exceder, fatia em
// partes < limite. O pipeline transcreve cada parte e junta o texto.
// ═══════════════════════════════════════════════════════════════════════════
import lamejs from '@breezystack/lamejs'

const LIMITE = 24 * 1024 * 1024 // margem sob os 25 MB do Whisper
const KBPS = 32

async function decodificar(blob) {
  const Ctx = window.AudioContext || window.webkitAudioContext
  const ac = new Ctx()
  try {
    const buf = await ac.decodeAudioData(await blob.arrayBuffer())
    return buf
  } finally { ac.close?.() }
}

function paraMono(buf) {
  const n = buf.length
  if (buf.numberOfChannels === 1) return buf.getChannelData(0)
  const out = new Float32Array(n)
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const ch = buf.getChannelData(c)
    for (let i = 0; i < n; i++) out[i] += ch[i]
  }
  for (let i = 0; i < n; i++) out[i] /= buf.numberOfChannels
  return out
}

function encodeMp3(float32, sampleRate, kbps = KBPS) {
  const enc = new lamejs.Mp3Encoder(1, sampleRate, kbps)
  const int16 = new Int16Array(float32.length)
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]))
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  const bloco = 1152
  const data = []
  for (let i = 0; i < int16.length; i += bloco) {
    const mp3 = enc.encodeBuffer(int16.subarray(i, i + bloco))
    if (mp3.length) data.push(mp3)
  }
  const fim = enc.flush()
  if (fim.length) data.push(fim)
  return new Blob(data, { type: 'audio/mpeg' })
}

/**
 * Prepara o áudio para upload.
 * @returns {{ parts: Blob[], ext: string, contentType: string, duracaoSeg: number|null, reencoded: boolean }}
 */
export async function prepararAudio(blob) {
  if (blob.size <= LIMITE) {
    return { parts: [blob], ext: null, contentType: blob.type || 'audio/webm', duracaoSeg: null, reencoded: false }
  }
  const buf = await decodificar(blob)
  const mono = paraMono(buf)
  const sr = buf.sampleRate
  const dur = mono.length / sr
  const estBytes = (KBPS * 1000 / 8) * dur
  const n = Math.max(1, Math.ceil(estBytes / LIMITE))
  const por = Math.ceil(mono.length / n)
  const parts = []
  for (let i = 0; i < n; i++) {
    const seg = mono.subarray(i * por, Math.min((i + 1) * por, mono.length))
    parts.push(encodeMp3(seg, sr))
  }
  return { parts, ext: 'mp3', contentType: 'audio/mpeg', duracaoSeg: Math.round(dur), reencoded: true }
}
