// ═══════════════════════════════════════════════════════════════════════════
// mapeamento-notificar — notificações de aprovação do Mapeamento de Processos
// Body: { mapeamento_id: uuid, acao: 'enviar_aprovacao'|'aprovar'|'solicitar_ajustes'|'voltar_producao', comentario?: string }
// Dispara e-mail (Resend) para o lado certo (cliente ou consultor) conforme a ação.
// Autorização: confirma via RLS (JWT do usuário) que ele enxerga o mapeamento.
// Secrets: RESEND_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
// ═══════════════════════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const APP_URL = "https://app.polimatagrc.com.br";
const LOGO_URL = "https://app.polimatagrc.com.br/logotipo-2cores.png";
const NAVY = "#00203E", COPPER = "#C8895C", CREAM = "#F3EEE4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

async function sendEmail(to: string[], subject: string, html: string) {
  if (!RESEND_API_KEY) { console.error("RESEND_API_KEY ausente"); return; }
  const dest = [...new Set(to.filter(Boolean))];
  if (!dest.length) { console.warn("Sem destinatários para", subject); return; }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + RESEND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Polímata GRC <noreply@polimatagrc.com.br>", to: dest, subject, html }),
  });
  if (!res.ok) console.error("Resend falhou:", await res.text());
}

function layout(titulo: string, corpo: string, ctaLabel = "Abrir no Polímata") {
  return `<div style="background:${CREAM};padding:32px 0;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid rgba(0,32,62,0.08)">
      <div style="background:${NAVY};padding:22px 28px">
        <img src="${LOGO_URL}" alt="Polímata" height="30" style="display:block"/>
      </div>
      <div style="padding:28px">
        <div style="font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:${COPPER}">Mapeamento de Processos</div>
        <h1 style="font-size:19px;font-weight:600;color:${NAVY};margin:6px 0 16px">${titulo}</h1>
        ${corpo}
        <a href="${APP_URL}" style="display:inline-block;margin-top:22px;background:${COPPER};color:#fff;text-decoration:none;font-weight:600;font-size:13px;padding:12px 22px;border-radius:8px">${ctaLabel}</a>
      </div>
      <div style="padding:16px 28px;background:${CREAM};font-size:11px;color:#6B7280">Polímata Consultoria GRC · este é um aviso automático.</div>
    </div>
  </div>`;
}

async function emails(ids: (string | null | undefined)[]): Promise<string[]> {
  const clean = [...new Set(ids.filter(Boolean) as string[])];
  if (!clean.length) return [];
  const { data } = await admin.from("perfis").select("email").in("id", clean).eq("ativo", true);
  return (data ?? []).map((p: { email: string }) => p.email).filter(Boolean);
}

async function processar(id: string, acao: string, comentario?: string) {
  const { data: map } = await admin.from("mapeamentos")
    .select("id,nome_processo,sigla_processo,projeto_id,criado_por,etapa").eq("id", id).single();
  if (!map) return;
  const { data: proj } = await admin.from("projetos")
    .select("nome,cliente_id,consultor_responsavel_id,sponsor_email").eq("id", map.projeto_id).single();
  const projNome = proj?.nome ?? "seu projeto";
  const proc = map.nome_processo ?? "Procedimento";

  if (acao === "enviar_aprovacao") {
    // → CLIENTE
    const { data: clientes } = await admin.from("perfis").select("email")
      .in("papel", ["gestor_cliente", "usuario_cliente"]).eq("ativo", true)
      .or(`projeto_id.eq.${map.projeto_id},cliente_id.eq.${proj?.cliente_id}`);
    const to = [...(clientes ?? []).map((p: { email: string }) => p.email), proj?.sponsor_email].filter(Boolean) as string[];
    await sendEmail(to, `Pronto para sua aprovação — ${proc}`,
      layout(`${proc} está pronto para sua aprovação`,
        `<p style="font-size:14px;color:#1F2937;line-height:1.6">O procedimento <b>${proc}</b> do projeto <b>${projNome}</b> foi finalizado pela equipe Polímata e está aguardando a sua análise. Acesse o sistema para revisar os documentos e <b>aprovar</b> ou <b>solicitar ajustes</b>.</p>`,
        "Revisar e aprovar"));
  } else {
    // → CONSULTOR / ADMIN
    const { data: admins } = await admin.from("perfis").select("id").eq("papel", "admin_polimata").eq("ativo", true);
    const to = await emails([map.criado_por, proj?.consultor_responsavel_id, ...((admins ?? []).map((a: { id: string }) => a.id))]);
    const mapa: Record<string, { t: string; c: string }> = {
      aprovar: { t: `Aprovado pelo cliente — ${proc}`, c: `<p style="font-size:14px;color:#1F2937;line-height:1.6">O cliente <b>aprovou</b> o procedimento <b>${proc}</b> (projeto <b>${projNome}</b>). Ele agora consta como <b>vigente</b>.</p>` },
      solicitar_ajustes: { t: `Ajustes solicitados — ${proc}`, c: `<p style="font-size:14px;color:#1F2937;line-height:1.6">O cliente <b>solicitou ajustes</b> no procedimento <b>${proc}</b> (projeto <b>${projNome}</b>).</p>${comentario ? `<div style="margin-top:12px;background:rgba(0,32,62,0.04);border-left:3px solid ${COPPER};padding:10px 14px;font-size:13px;color:#1F2937">“${comentario}”</div>` : ""}` },
      voltar_producao: { t: `Reaberto para ajustes — ${proc}`, c: `<p style="font-size:14px;color:#1F2937;line-height:1.6">O procedimento <b>${proc}</b> (projeto <b>${projNome}</b>) foi reaberto para ajustes.</p>` },
    };
    const m = mapa[acao]; if (!m) return;
    await sendEmail(to, m.t, layout(m.t, m.c));
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não suportado" }, 405);
  let body: { mapeamento_id?: string; acao?: string; comentario?: string };
  try { body = await req.json(); } catch { return json({ error: "Body inválido" }, 400); }
  const id = body.mapeamento_id, acao = body.acao;
  if (!id || !acao) return json({ error: "mapeamento_id e acao obrigatórios" }, 400);
  if (!["enviar_aprovacao", "aprovar", "solicitar_ajustes", "voltar_producao"].includes(acao))
    return json({ error: "acao inválida" }, 400);

  // Autorização via RLS com o JWT do usuário
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: visivel } = await userClient.from("mapeamentos").select("id").eq("id", id).maybeSingle();
  if (!visivel) return json({ error: "Sem acesso a este mapeamento" }, 403);

  // @ts-ignore EdgeRuntime no runtime Supabase
  EdgeRuntime.waitUntil(processar(id, acao, body.comentario));
  return json({ ok: true }, 202);
});
