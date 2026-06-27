// mapeamento-agendar — agenda a entrevista no Google Calendar (via Nylas), cria
// link do Meet, envia convite ao entrevistado e anexa o Notetaker (bot que grava).
// Body: { mapeamento_id, grant_id, inicio (ISO), duracao_min, participantes: string[], titulo? }
// Secrets: NYLAS_API_KEY, NYLAS_API_URI, SUPABASE_*
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const NYLAS_URI = Deno.env.get("NYLAS_API_URI") ?? "https://api.us.nylas.com";
const NYLAS_KEY = Deno.env.get("NYLAS_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não suportado" }, 405);
  if (!NYLAS_KEY) return json({ error: "NYLAS_API_KEY não configurada" }, 500);

  let body: { mapeamento_id?: string; grant_id?: string; inicio?: string; duracao_min?: number; participantes?: string[]; titulo?: string };
  try { body = await req.json(); } catch { return json({ error: "Body inválido" }, 400); }
  const { mapeamento_id, grant_id, inicio, duracao_min, participantes, titulo } = body;
  if (!mapeamento_id || !grant_id || !inicio) return json({ error: "mapeamento_id, grant_id e inicio são obrigatórios" }, 400);

  // Autorização: usuário precisa enxergar o mapeamento (RLS)
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: map } = await userClient.from("mapeamentos").select("id, nome_processo").eq("id", mapeamento_id).maybeSingle();
  if (!map) return json({ error: "Sem acesso a este mapeamento" }, 403);

  const start = Math.floor(new Date(inicio).getTime() / 1000);
  const end = start + (Number(duracao_min) || 60) * 60;
  const evt = {
    title: titulo || `Entrevista de mapeamento — ${map.nome_processo ?? "Processo"}`,
    when: { start_time: start, end_time: end },
    participants: (participantes ?? []).filter(Boolean).map((e) => ({ email: e })),
    conferencing: { provider: "Google Meet", autocreate: {} },
    notetaker: { name: "Polímata Notetaker", meeting_settings: { audio_recording: true, video_recording: false, transcription: true } },
  };
  const r = await fetch(`${NYLAS_URI}/v3/grants/${grant_id}/events?calendar_id=primary&notify_participants=true`, {
    method: "POST",
    headers: { Authorization: `Bearer ${NYLAS_KEY}`, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(evt),
  });
  const out = await r.json();
  if (!r.ok) return json({ error: "Nylas falhou ao criar evento", status: r.status, body: out }, 502);
  const d = out.data ?? {};
  const meetUrl = d?.conferencing?.details?.url ?? null;
  const notetakerId = d?.notetaker?.id ?? d?.notetaker_id ?? null;

  await admin.from("mapeamentos").update({
    reuniao_event_id: d.id ?? null,
    reuniao_grant_id: grant_id,
    reuniao_meet_url: meetUrl,
    reuniao_notetaker_id: notetakerId,
    reuniao_inicio: inicio,
    reuniao_status: "agendada",
  }).eq("id", mapeamento_id);

  return json({ ok: true, event_id: d.id ?? null, meet_url: meetUrl, notetaker_id: notetakerId });
});
