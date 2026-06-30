// nylas-webhook — recebe os webhooks da Nylas. Quando a gravação do Notetaker fica
// pronta, busca a transcrição e grava na reunião correspondente (mapeamento_reunioes).
// A estruturação (POP/fluxo/matriz) é disparada manualmente pelo botão "Consolidar".
// Caminho LEGADO preservado: se o notetaker corresponde a mapeamentos.reuniao_notetaker_id
// (agendamentos antigos), mantém o comportamento original (grava transcrição e dispara pipeline).
// verify_jwt=false (chamada externa). Valida challenge e assinatura HMAC (NYLAS_WEBHOOK_SECRET).
// Secrets: NYLAS_API_KEY, NYLAS_API_URI, NYLAS_WEBHOOK_SECRET, SUPABASE_*
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const NYLAS_KEY = Deno.env.get("NYLAS_API_KEY") ?? "";
const WEBHOOK_SECRET = Deno.env.get("NYLAS_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

// Verifica a assinatura HMAC-SHA256 que a Nylas envia em X-Nylas-Signature (hex).
async function assinaturaValida(rawBody: string, signature: string): Promise<boolean> {
  if (!WEBHOOK_SECRET || !signature) return false;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const esperado = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const recebido = signature.trim().toLowerCase();
  if (esperado.length !== recebido.length) return false;
  let diff = 0;
  for (let i = 0; i < esperado.length; i++) diff |= esperado.charCodeAt(i) ^ recebido.charCodeAt(i);
  return diff === 0;
}

async function disparar(mapeamentoId: string, etapa: string) {
  await fetch(`${SUPABASE_URL}/functions/v1/mapeamento-pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ mapeamento_id: mapeamentoId, etapa }),
  });
}

// Busca o texto da transcrição a partir da mídia do Notetaker no payload.
async function obterTranscricao(obj: Record<string, unknown>): Promise<string> {
  try {
    const media = (obj.media ?? {}) as Record<string, unknown>;
    const tUrl = (media.transcript as string) || "";
    if (!tUrl) return "";
    const tr = await fetch(tUrl, { headers: { Authorization: `Bearer ${NYLAS_KEY}` } });
    if (!tr.ok) return "";
    const ct = tr.headers.get("content-type") ?? "";
    if (ct.includes("json")) {
      const j = await tr.json();
      return (j.text ?? (Array.isArray(j) ? j.map((s: { text?: string }) => s.text).join(" ") : "")) as string;
    }
    return await tr.text();
  } catch (_e) { return ""; }
}

async function processar(payload: Record<string, unknown>) {
  const tipo = payload.type as string;
  const obj = ((payload.data as Record<string, unknown>)?.object ?? {}) as Record<string, unknown>;
  const ntId = (obj.id ?? obj.notetaker_id) as string | undefined;
  if (!ntId) return;
  const isMedia = tipo?.includes("media") || (obj.state as string) === "media_available";

  // 1) Nova tabela de reuniões (várias por processo) — grava transcrição por reunião, SEM disparar pipeline.
  const { data: reuniao } = await admin.from("mapeamento_reunioes").select("id, mapeamento_id").eq("notetaker_id", ntId).maybeSingle();
  if (reuniao) {
    if (isMedia) {
      const transcricao = await obterTranscricao(obj);
      const upd: Record<string, unknown> = { status: "gravada", atualizado_em: new Date().toISOString() };
      if (transcricao.trim()) upd.transcricao = transcricao;
      await admin.from("mapeamento_reunioes").update(upd).eq("id", reuniao.id);
      await admin.from("mapeamentos").update({ reuniao_status: "gravada" }).eq("id", reuniao.mapeamento_id);
    }
    return;
  }

  // 2) LEGADO: agendamentos antigos gravados direto no mapeamento — comportamento original.
  const { data: map } = await admin.from("mapeamentos").select("id, reuniao_status").eq("reuniao_notetaker_id", ntId).maybeSingle();
  if (!map) return;
  if (isMedia) {
    const transcricao = await obterTranscricao(obj);
    if (transcricao.trim()) {
      await admin.from("mapeamentos").update({ transcricao, status: "transcrito", reuniao_status: "gravada" }).eq("id", map.id);
      await disparar(map.id, "estruturar");
    } else {
      await admin.from("mapeamentos").update({ reuniao_status: "gravada" }).eq("id", map.id);
    }
  }
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const challenge = url.searchParams.get("challenge");
  if (req.method === "GET" && challenge) return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  if (req.method !== "POST") return new Response("ok", { status: 200 });

  const raw = await req.text();
  const signature = req.headers.get("x-nylas-signature") ?? "";
  if (WEBHOOK_SECRET) {
    const ok = await assinaturaValida(raw, signature);
    if (!ok) {
      console.warn("nylas-webhook: assinatura inválida — requisição rejeitada");
      return new Response("invalid signature", { status: 401 });
    }
  } else {
    console.warn("nylas-webhook: NYLAS_WEBHOOK_SECRET não configurado — verificação de assinatura PULADA");
  }

  let payload: Record<string, unknown>;
  try { payload = JSON.parse(raw); } catch { return new Response("ok", { status: 200 }); }
  // @ts-ignore EdgeRuntime no runtime Supabase
  EdgeRuntime.waitUntil(processar(payload));
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
});
