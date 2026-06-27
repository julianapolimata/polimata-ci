// nylas-connect — conexão 1-clique do calendário do consultor (Nylas Hosted Auth).
// verify_jwt=false: trata o "start" (com JWT do usuário no header) e o "callback"
// (retorno do Google, sem JWT — validado por state assinado + troca do code).
// Restrito a e-mails @polimatagrc.com.br. Secrets: NYLAS_API_KEY, NYLAS_API_URI, NYLAS_CLIENT_ID, SUPABASE_*
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const NYLAS_URI = Deno.env.get("NYLAS_API_URI") ?? "https://api.us.nylas.com";
const NYLAS_KEY = Deno.env.get("NYLAS_API_KEY") ?? "";
const CLIENT_ID = Deno.env.get("NYLAS_CLIENT_ID") ?? "07a4225f-e7a7-46cb-a29b-9f73471a96b3";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const APP_URL = "https://app.polimatagrc.com.br/mapeamentos";
const DOMINIO = "@polimatagrc.com.br";
const REDIRECT = `${SUPABASE_URL}/functions/v1/nylas-connect`;
const admin = createClient(SUPABASE_URL, SERVICE_KEY);
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// state assinado (perfil_id.HMAC) p/ amarrar o callback ao consultor com segurança
const enc = new TextEncoder();
async function hmac(msg: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(SERVICE_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function signState(perfilId: string) { return `${perfilId}.${await hmac(perfilId)}`; }
async function verifyState(state: string): Promise<string | null> {
  const i = state.lastIndexOf("."); if (i < 0) return null;
  const perfilId = state.slice(0, i), sig = state.slice(i + 1);
  return (await hmac(perfilId)) === sig ? perfilId : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  // ── CALLBACK (retorno do Google) ──
  if (code && state) {
    const perfilId = await verifyState(state);
    if (!perfilId) return new Response("state inválido", { status: 400 });
    const tk = await fetch(`${NYLAS_URI}/v3/connect/token`, {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ client_id: CLIENT_ID, client_secret: NYLAS_KEY, code, redirect_uri: REDIRECT, grant_type: "authorization_code" }),
    });
    const t = await tk.json();
    if (!tk.ok || !t.grant_id) return Response.redirect(`${APP_URL}?cal=erro`, 302);
    const email = (t.email ?? "").toLowerCase();
    if (!email.endsWith(DOMINIO)) {
      // só permite calendários do domínio Polímata
      return Response.redirect(`${APP_URL}?cal=dominio`, 302);
    }
    await admin.from("mapeamento_calendarios").upsert({
      perfil_id: perfilId, email, grant_id: t.grant_id, provider: t.provider ?? "google", status: "valid", atualizado_em: new Date().toISOString(),
    }, { onConflict: "perfil_id" });
    return Response.redirect(`${APP_URL}?cal=ok`, 302);
  }

  // ── START (front autenticado pede a URL de conexão) ──
  if (req.method === "POST") {
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "não autenticado" }, 401);
    const { data: perfil } = await admin.from("perfis").select("id, email, papel").eq("id", u.user.id).maybeSingle();
    if (!perfil || !["admin_polimata", "consultor_polimata"].includes(perfil.papel)) return json({ error: "apenas consultores Polímata" }, 403);
    const st = await signState(perfil.id);
    const auth = `${NYLAS_URI}/v3/connect/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT)}&response_type=code&provider=google&access_type=offline&login_hint=${encodeURIComponent(perfil.email ?? "")}&state=${encodeURIComponent(st)}`;
    return json({ ok: true, url: auth });
  }
  return json({ error: "requisição inválida" }, 400);
});
