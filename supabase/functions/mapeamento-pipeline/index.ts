// ═══════════════════════════════════════════════════════════════════════════
// mapeamento-pipeline — Módulo Mapeamento de Processos
// Pipeline: áudio (Storage) → Whisper (transcrição) → Claude (estruturação)
// Body: { mapeamento_id: uuid, etapa?: 'completo' | 'transcrever' | 'estruturar' }
// Retorna 202 imediatamente; processa em background (EdgeRuntime.waitUntil).
// O frontend acompanha pelo campo `status` da tabela mapeamentos.
// Secrets necessários: OPENAI_API_KEY, ANTHROPIC_API_KEY
// ═══════════════════════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

async function setStatus(id: string, fields: Record<string, unknown>) {
  await admin.from("mapeamentos").update(fields).eq("id", id);
}

// ── Transcrição (Whisper) ──────────────────────────────────────────────────
async function whisperUm(blob: Blob, nome: string) {
  if (blob.size > 25 * 1024 * 1024) throw new Error("Parte de áudio acima de 25 MB (limite do Whisper).");
  const form = new FormData();
  form.append("file", blob, nome);
  form.append("model", "whisper-1");
  form.append("language", "pt");
  form.append("response_format", "verbose_json");
  form.append("prompt", "Entrevista de mapeamento de processos. Termos: GRC, COSO, ISO 31000, RACI, BPMN, compliance, requisição, alçada, workflow, SAP, ERP, NF, conciliação.");
  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}` },
    body: form,
  });
  if (!r.ok) throw new Error(`Whisper falhou (${r.status}): ${(await r.text()).slice(0, 400)}`);
  const t = await r.json();
  return { text: (t.text ?? "") as string, duration: t.duration ? Math.round(t.duration) : 0 };
}

async function transcrever(map: Record<string, unknown>) {
  const id = map.id as string;
  if (!OPENAI_KEY) throw new Error("Secret OPENAI_API_KEY não configurado no Supabase.");
  const partes = (Array.isArray(map.audio_parts) && (map.audio_parts as string[]).length)
    ? (map.audio_parts as string[])
    : (map.audio_path ? [map.audio_path as string] : []);
  if (!partes.length) throw new Error("Mapeamento sem áudio enviado.");

  await setStatus(id, { status: "transcrevendo", erro: null });

  let texto = "";
  let dur = 0;
  for (let i = 0; i < partes.length; i++) {
    const { data: blob, error: dlErr } = await admin.storage.from("mapeamentos").download(partes[i]);
    if (dlErr || !blob) throw new Error("Falha ao baixar áudio: " + (dlErr?.message ?? "arquivo não encontrado"));
    const nome = (map.audio_nome as string) || `audio_${i + 1}`;
    const r = await whisperUm(blob, partes.length > 1 ? `parte_${i + 1}_${nome}` : nome);
    texto += (texto ? "\n\n" : "") + r.text;
    dur += r.duration;
  }

  await setStatus(id, {
    status: "transcrito",
    transcricao: texto,
    audio_duracao_seg: dur || (map.audio_duracao_seg as number ?? null),
  });
  return texto;
}

// ── Estruturação (Claude) ──────────────────────────────────────────────────
const PROMPT_SISTEMA = `Você é um consultor sênior de GRC da Polímata Consultoria, especialista em mapeamento de processos baseado em risco (ABPMP BPM CBOK, BPMN 2.0, COSO ERM 2017, COSO ICFR 2013, ISO 31000:2018).
Sua tarefa: a partir da transcrição de uma entrevista de levantamento de processo, extrair e estruturar TODO o conteúdo num JSON único, fiel ao que foi dito, sem inventar fatos. Onde a transcrição for omissa em algo essencial, registre em "lacunas" (perguntas a fazer ao entrevistado) em vez de inventar.
Regras:
- Português do Brasil, redação clara e profissional, sem itálico, sem jargão desnecessário.
- Riscos no formato causa → evento → consequência, classificados por categoria COSO ERM (Estratégico, Operacional, Financeiro/Reporte, Conformidade) e fonte ISO 31000. Probabilidade e impacto de 1 a 5.
- Codificação sequencial: atividades A01, A02...; riscos R-001...; pontos de atenção P-001... com severidade Alta/Média/Baixa.
- RACI consistente: exatamente um A por atividade; R obrigatório.
- O fluxo BPMN deve cobrir todas as atividades, com lanes por ator e gateways para decisões mencionadas.
Responda APENAS com o JSON, sem markdown, sem comentários.`;

const SCHEMA_JSON = `{
  "processo": {
    "nome": "", "objetivo": "", "contexto": "",
    "escopo_incluido": [""], "escopo_excluido": [""],
    "visao_geral_passos": [""],
    "area_responsavel": "", "frequencia": "", "volume": ""
  },
  "atores": [{ "nome": "", "cargo_area": "", "papel_resumo": "" }],
  "sistemas": [{ "nome": "", "uso": "" }],
  "glossario": [{ "termo": "", "definicao": "" }],
  "subprocessos": [{
    "id": "D.1", "nome": "", "resumo_uma_frase": "",
    "passos": [{ "id": "A01", "titulo": "", "descricao": "", "ator": "", "sistema": "" }],
    "excecoes": [{ "situacao": "", "tratamento": "" }],
    "pontos_atencao": [{ "id": "P-001", "descricao": "", "severidade": "Alta|Média|Baixa", "recomendacao": "" }],
    "indicadores": [{ "nome": "", "tipo": "KPI|KRI", "descricao": "" }]
  }],
  "riscos": [{
    "id": "R-001", "atividade_ref": "A01", "descricao": "",
    "causa": "", "evento": "", "consequencia": "",
    "categoria_coso": "", "fonte_iso": "",
    "probabilidade": 3, "impacto": 3,
    "controles_existentes": "", "tipo_controle": "Preventivo|Detectivo|Corretivo",
    "natureza_controle": "Manual|Automático|Híbrido",
    "avaliacao_controle": "Efetivo|Inefetivo|GAP",
    "plano_acao": ""
  }],
  "raci": [{ "atividade": "A01", "titulo": "", "matriz": { "NomeDoAtor": "R|A|C|I" } }],
  "fluxo": {
    "lanes": [{ "ator": "", "atividades": ["A01"] }],
    "sequencia": [{ "de": "inicio|A01|G1", "para": "A02|G1|fim_ok|fim_nok", "condicao": "" }],
    "gateways": [{ "id": "G1", "pergunta": "", "apos": "A02" }]
  },
  "lacunas": [""]
}`;

async function estruturar(map: Record<string, unknown>, transcricao: string) {
  const id = map.id as string;
  if (!ANTHROPIC_KEY) throw new Error("Secret ANTHROPIC_API_KEY não configurado no Supabase.");
  if (!transcricao?.trim()) throw new Error("Sem transcrição para estruturar.");

  await setStatus(id, { status: "estruturando", erro: null });

  const respList = Array.isArray(map.respostas_lacunas)
    ? (map.respostas_lacunas as Array<{ pergunta?: string; resposta?: string }>).filter((r) => (r?.resposta ?? "").trim())
    : [];
  const blocoRespostas = respList.length
    ? `\n\nESCLARECIMENTOS DO CONSULTOR (respostas às perguntas/lacunas levantadas antes — trate como fatos confirmados e NÃO as repita em "lacunas"):\n${respList.map((r) => `- P: ${r.pergunta ?? ""}\n  R: ${r.resposta}`).join("\n")}`
    : "";

  const userMsg = `Processo declarado: ${map.nome_processo ?? "(não informado)"}
Sigla do processo: ${map.sigla_processo ?? "(definir)"}

TRANSCRIÇÃO DA ENTREVISTA:
"""
${transcricao}
"""${blocoRespostas}

Estruture conforme exatamente este schema JSON:
${SCHEMA_JSON}`;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 32000,
      temperature: 0.2,
      system: PROMPT_SISTEMA,
      messages: [{ role: "user", content: userMsg }],
    }),
  });
  if (!r.ok) throw new Error(`Claude falhou (${r.status}): ${(await r.text()).slice(0, 400)}`);
  const resp = await r.json();
  let texto = (resp.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
  texto = texto.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const ini = texto.indexOf("{");
  const fim = texto.lastIndexOf("}");
  if (ini < 0 || fim < ini) throw new Error("Claude não retornou JSON válido.");
  const estrutura = JSON.parse(texto.slice(ini, fim + 1));

  await setStatus(id, { status: "estruturado", estrutura });
}

// ── Orquestração ───────────────────────────────────────────────────────────
async function processar(id: string, etapa: string) {
  try {
    const { data: map, error } = await admin.from("mapeamentos").select("*").eq("id", id).single();
    if (error || !map) throw new Error("Mapeamento não encontrado.");

    let transcricao = map.transcricao as string;
    if (etapa === "transcrever" || (etapa === "completo" && !transcricao?.trim())) {
      transcricao = await transcrever(map);
    }
    if (etapa === "estruturar" || etapa === "completo") {
      await estruturar(map, transcricao);
    }
  } catch (e) {
    console.error("mapeamento-pipeline:", e);
    await setStatus(id, { status: "erro", erro: String((e as Error).message ?? e).slice(0, 800) });
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não suportado" }, 405);

  let body: { mapeamento_id?: string; etapa?: string };
  try { body = await req.json(); } catch { return json({ error: "Body inválido" }, 400); }
  const id = body.mapeamento_id;
  const etapa = body.etapa ?? "completo";
  if (!id) return json({ error: "mapeamento_id obrigatório" }, 400);
  if (!["completo", "transcrever", "estruturar"].includes(etapa)) return json({ error: "etapa inválida" }, 400);

  // Autorização: o JWT já foi validado pela plataforma (verify_jwt).
  // Confirma via RLS que o usuário enxerga este mapeamento.
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: visivel } = await userClient.from("mapeamentos").select("id").eq("id", id).maybeSingle();
  if (!visivel) return json({ error: "Sem acesso a este mapeamento" }, 403);

  // @ts-ignore EdgeRuntime disponível no runtime da Supabase
  EdgeRuntime.waitUntil(processar(id, etapa));
  return json({ ok: true, mapeamento_id: id, etapa, mensagem: "Processamento iniciado" }, 202);
});
