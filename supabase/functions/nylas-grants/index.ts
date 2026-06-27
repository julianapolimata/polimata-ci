// nylas-grants — lista os grants (contas conectadas) da app Nylas. Uso: descobrir
// o grant de demo do sandbox e checar conexões. Secrets: NYLAS_API_KEY, NYLAS_API_URI
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const NYLAS_URI = Deno.env.get("NYLAS_API_URI") ?? "https://api.us.nylas.com";
const NYLAS_KEY = Deno.env.get("NYLAS_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  // só admin/consultor Polímata
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return json({ error: "não autenticado" }, 401);
  if (!NYLAS_KEY) return json({ error: "NYLAS_API_KEY não configurada" }, 500);
  const r = await fetch(`${NYLAS_URI}/v3/grants?limit=50`, { headers: { Authorization: `Bearer ${NYLAS_KEY}`, Accept: "application/json" } });
  const body = await r.json();
  if (!r.ok) return json({ error: "Nylas falhou", status: r.status, body }, 502);
  const grants = (body.data ?? []).map((g: Record<string, unknown>) => ({ id: g.id, email: g.email, provider: g.provider, status: g.grant_status }));
  return json({ ok: true, grants });
});
