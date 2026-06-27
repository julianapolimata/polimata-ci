// nylas-webhook — recebe os webhooks da Nylas. Quando a gravação do Notetaker fica
// pronta, busca a transcrição, grava no mapeamento e dispara a estruturação (Claude).
// verify_jwt=false (chamada externa da Nylas). Valida challenge na verificação.
// Secrets: NYLAS_API_KEY, NYLAS_API_URI, SUPABASE_*
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const NYLAS_URI = Deno.env.get("NYLAS_API_URI") ?? "https://api.us.nylas.com";
const NYLAS_KEY = Deno.env.get("NYLAS_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

async function disparar(mapeamentoId: string, etapa: string) {
  await fetch(`${SUPABASE_URL}/functions/v1/mapeamento-pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ mapeamento_id: mapeamentoId, etapa }),
  });
}

async function processar(payload: Record<string, unknown>) {
  const tipo = payload.type as string;
  const obj = ((payload.data as Record<string, unknown>)?.object ?? {}) as Record<string, unknown>;
  // estados de mídia pronta do Notetaker
  const ntId = (obj.id ?? obj.notetaker_id) as string | undefined;
  if (!ntId) return;
  const { data: map } = await admin.from("mapeamentos").select("id, reuniao_status").eq("reuniao_notetaker_id", ntId).maybeSingle();
  if (!map) return;

  if (tipo?.includes("media") || (obj.state as string) === "media_available") {
    // tenta obter a transcrição da mídia do Notetaker
    let transcricao = "";
    try {
      const media = (obj.media ?? {}) as Record<string, unknown>;
      const tUrl = (media.transcript as string) || "";
      if (tUrl) {
        const tr = await fetch(tUrl, { headers: { Authorization: `Bearer ${NYLAS_KEY}` } });
        if (tr.ok) {
          const ct = tr.headers.get("content-type") ?? "";
          if (ct.includes("json")) {
            const j = await tr.json();
            transcricao = (j.text ?? (Array.isArray(j) ? j.map((s: { text?: string }) => s.text).join(" ") : "")) as string;
          } else { transcricao = await tr.text(); }
        }
      }
    } catch (_e) { /* segue sem transcrição */ }

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
  // verificação do webhook (Nylas manda ?challenge=...)
  const challenge = url.searchParams.get("challenge");
  if (req.method === "GET" && challenge) return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  if (req.method !== "POST") return new Response("ok", { status: 200 });
  let payload: Record<string, unknown>;
  try { payload = await req.json(); } catch { return new Response("ok", { status: 200 }); }
  // @ts-ignore EdgeRuntime no runtime Supabase
  EdgeRuntime.waitUntil(processar(payload));
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
});
