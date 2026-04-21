import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = "https://polimata-ci.vercel.app";
const LOGO_URL = "https://polimata-ci.vercel.app/logotipo-2cores.png";
const NAVY = "#00203E";
const COPPER = "#C8895C";
const CREAM = "#F3EEE4";
const WHITE = "#FFFFFF";

// ── Cores da metodologia (INTOCÁVEIS) ──
const COR_EFETIVO = "#22D4A0";
const COR_INEFETIVO = "#F5B942";
const COR_GAP = "#F05656";
const BG_EFETIVO = "rgba(34,212,160,0.10)";
const BG_INEFETIVO = "rgba(245,185,66,0.10)";
const BG_GAP = "rgba(240,86,86,0.10)";

// ── Cores de criticidade (mapa de calor) ──
const CRIT_CORES: Record<number, string> = { 4: "#EF4444", 3: "#F97316", 2: "#EAB308", 1: "#22C55E" };
const CRIT_BG: Record<number, string> = { 4: "#fef2f2", 3: "#fff7ed", 2: "#fefce8", 1: "#f0fdf4" };

// ── Cores da régua de maturidade N1-N5 ──
const NIVEL_CORES: Record<string, string> = { N1: "#DC2626", N2: "#EA580C", N3: "#EAB308", N4: "#16A34A", N5: "#15803D" };

function isLastBusinessDay(): boolean {
  const now = new Date();
  const brt = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const year = brt.getFullYear();
  const month = brt.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  let lastBizDay = lastDay;
  while (true) {
    const d = new Date(year, month, lastBizDay);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) break;
    lastBizDay--;
  }
  return brt.getDate() === lastBizDay;
}

async function sendEmail(to: string | string[], subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + RESEND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Polímata GRC <noreply@polimatagrc.com.br>", to, subject, html }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("Email failed for " + to + ": " + err);
  }
  return res;
}

serve(async (req: Request) => {
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "true";

  if (!force && !isLastBusinessDay()) {
    return new Response(JSON.stringify({ skipped: true, reason: "Not last business day" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ── Fetch all active profiles ──
  const { data: allPerfis } = await supabase
    .from("perfis")
    .select("email, nome, papel, id, cliente_id, clientes(nome)")
    .in("papel", ["admin_polimata", "consultor_polimata", "gestor_cliente", "usuario_cliente"])
    .eq("ativo", true);

  if (!allPerfis || allPerfis.length === 0) {
    return new Response(JSON.stringify({ error: "No active recipients found" }), { status: 404 });
  }

  // ── Fetch active projects with gerente ──
  const { data: projetos } = await supabase
    .from("projetos")
    .select("id, nome, gerente_id, clientes(nome)")
    .eq("ativo", true);

  // ── Fetch all active controls with consultor name ──
  const { data: controles } = await supabase
    .from("mrc")
    .select("*, areas(nome, id), projetos(nome), consultor:consultor_id(nome)")
    .eq("ativo", true);

  if (!controles || controles.length === 0) {
    return new Response(JSON.stringify({ error: "No active controls" }), { status: 404 });
  }

  // ── Build user -> area map for usuario_cliente ──
  const userAreaMap: Record<string, string[]> = {};
  const clienteUsers = allPerfis.filter(function(d: any) { return d.papel === "usuario_cliente"; });
  if (clienteUsers.length > 0) {
    const { data: perms } = await supabase
      .from("permissoes_area")
      .select("perfil_id, area_id, areas(nome)")
      .in("perfil_id", clienteUsers.map(function(u: any) { return u.id; }));
    for (const p of (perms || [])) {
      if (!userAreaMap[p.perfil_id]) userAreaMap[p.perfil_id] = [];
      userAreaMap[p.perfil_id].push((p as any).areas?.nome || "");
    }
  }

  // ── Helpers ──
  var meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  var now = new Date();
  var brt = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  var mesNome = meses[brt.getMonth()];
  var ano = brt.getFullYear();

  function critLabel(c: number) { return c === 4 ? "Crítico" : c === 3 ? "Significativo" : c === 2 ? "Moderado" : "Baixo"; }

  function statusLabel(s: string) {
    if (s === "nao_iniciado") return "Não iniciado";
    if (s === "em_revisao") return "Em revisão";
    if (s === "em_analise") return "Em análise";
    if (s === "teste_pendente") return "Teste pendente";
    if (s === "aprovado") return "Aprovado";
    if (s === "reprovado") return "Devolvido";
    return s;
  }
  function statusColor(s: string) {
    if (s === "nao_iniciado") return "#64748b";
    if (s === "em_revisao") return "#7c3aed";
    if (s === "em_analise") return "#2563eb";
    if (s === "teste_pendente") return "#d97706";
    if (s === "aprovado") return "#16a34a";
    if (s === "reprovado") return "#dc2626";
    return "#64748b";
  }

  function computeStats(ctrls: any[]) {
    var t = ctrls.length;
    var ef = ctrls.filter(function(c: any) { return (c.r1 || "").toUpperCase() === "EFETIVO"; }).length;
    var ine = ctrls.filter(function(c: any) { return (c.r1 || "").toUpperCase() === "INEFETIVO"; }).length;
    var gap = ctrls.filter(function(c: any) { return (c.r1 || "").toUpperCase() === "GAP"; }).length;
    return { total: t, efetivo: ef, inefetivo: ine, gap: gap };
  }

  // ── Pending review items ──
  var pendingItems = controles
    .filter(function(c: any) { return ["em_revisao", "em_analise", "teste_pendente"].indexOf(c.status_workflow) >= 0; })
    .sort(function(a: any, b: any) {
      var order: Record<string, number> = { em_revisao: 0, teste_pendente: 1, em_analise: 2 };
      return (order[a.status_workflow] ?? 9) - (order[b.status_workflow] ?? 9);
    });

  // ══════════════════════════════════════════
  //  buildHtml — gera o email completo
  // ══════════════════════════════════════════
  function buildHtml(opts: {
    nome: string;
    greeting: string;
    stats: { total: number; efetivo: number; inefetivo: number; gap: number };
    matIndice: number;
    matNivel: string;
    matNome: string;
    matLabel: string;
    showAreaTable: boolean;
    showPendingReview: boolean;
    showSubprocessTable: boolean;
    areasMaturity: any[];
    pendingItems: any[];
    subprocessos: any[];
  }) {
    var nome = opts.nome;
    var greeting = opts.greeting;
    var stats = opts.stats;
    var matIndice = opts.matIndice;
    var matNivel = opts.matNivel;
    var matNome = opts.matNome;
    var matLabel = opts.matLabel || "N\u00edvel de Maturidade";
    var showAreaTable = opts.showAreaTable;
    var showPendingReview = opts.showPendingReview;
    var showSubprocessTable = opts.showSubprocessTable;
    var areasM = opts.areasMaturity;
    var items = opts.pendingItems;
    var subs = opts.subprocessos || [];

    var nivelCor = NIVEL_CORES[matNivel] || "#DC2626";
    var matPct = Math.round(matIndice * 100);

    // ── Area Table HTML ──
    var areaTableHtml = "";
    if (showAreaTable && areasM.length > 0) {
      var rows = "";
      for (var i = 0; i < areasM.length; i++) {
        var a = areasM[i];
        var bgRow = i % 2 === 0 ? WHITE : CREAM;
        var aNivelCor = NIVEL_CORES[a.nivel] || "#DC2626";

        // Criticidade badges
        var critBadges = "";
        if (a.crit4 > 0) critBadges += '<span style="display:inline-block;background:' + CRIT_BG[4] + ';color:' + CRIT_CORES[4] + ';border-radius:4px;padding:1px 5px;font-size:10px;font-weight:bold;margin:0 1px;">' + a.crit4 + '</span>';
        if (a.crit3 > 0) critBadges += '<span style="display:inline-block;background:' + CRIT_BG[3] + ';color:' + CRIT_CORES[3] + ';border-radius:4px;padding:1px 5px;font-size:10px;font-weight:bold;margin:0 1px;">' + a.crit3 + '</span>';
        if (a.crit2 > 0) critBadges += '<span style="display:inline-block;background:' + CRIT_BG[2] + ';color:' + CRIT_CORES[2] + ';border-radius:4px;padding:1px 5px;font-size:10px;font-weight:bold;margin:0 1px;">' + a.crit2 + '</span>';
        if (a.crit1 > 0) critBadges += '<span style="display:inline-block;background:' + CRIT_BG[1] + ';color:' + CRIT_CORES[1] + ';border-radius:4px;padding:1px 5px;font-size:10px;font-weight:bold;margin:0 1px;">' + a.crit1 + '</span>';

        rows += '<tr style="background:' + bgRow + ';">';
        rows += '<td style="padding:7px 6px;color:' + NAVY + ';border-bottom:1px solid #e8e0d4;font-weight:500;">' + a.area_nome + '</td>';
        rows += '<td style="padding:7px 4px;text-align:center;color:' + COR_EFETIVO + ';font-weight:bold;border-bottom:1px solid #e8e0d4;">' + a.efetivos + '</td>';
        rows += '<td style="padding:7px 4px;text-align:center;color:' + COR_INEFETIVO + ';font-weight:bold;border-bottom:1px solid #e8e0d4;">' + a.inefetivos + '</td>';
        rows += '<td style="padding:7px 4px;text-align:center;color:' + COR_GAP + ';font-weight:bold;border-bottom:1px solid #e8e0d4;">' + a.gaps + '</td>';
        rows += '<td style="padding:7px 4px;text-align:center;border-bottom:1px solid #e8e0d4;">' + critBadges + '</td>';
        rows += '<td style="padding:7px 4px;text-align:center;border-bottom:1px solid #e8e0d4;">';
        rows += '<span style="font-weight:bold;color:' + aNivelCor + ';">' + a.nivel + '</span>';
        rows += '<span style="font-size:10px;color:#94a3b8;margin-left:2px;">(' + a.percentual + '%)</span>';
        rows += '</td>';
        rows += '</tr>';
      }

      areaTableHtml = '<tr><td style="padding:20px 32px 8px;">';
      areaTableHtml += '<h2 style="margin:0 0 12px;font-size:15px;color:' + NAVY + ';font-family:Raleway,Arial,sans-serif;font-weight:600;">Por Área</h2>';
      areaTableHtml += '<table width="100%" cellpadding="0" cellspacing="0" style="font-size:12px;border-collapse:collapse;font-family:Montserrat,Arial,sans-serif;">';
      areaTableHtml += '<tr style="background:' + CREAM + ';">';
      areaTableHtml += '<th style="padding:8px 6px;text-align:left;color:' + NAVY + ';font-weight:600;border-bottom:2px solid ' + COPPER + ';">Área</th>';
      areaTableHtml += '<th style="padding:8px 4px;text-align:center;color:' + COR_EFETIVO + ';font-weight:600;border-bottom:2px solid ' + COPPER + ';">Efetivo</th>';
      areaTableHtml += '<th style="padding:8px 4px;text-align:center;color:' + COR_INEFETIVO + ';font-weight:600;border-bottom:2px solid ' + COPPER + ';">Inefetivo</th>';
      areaTableHtml += '<th style="padding:8px 4px;text-align:center;color:' + COR_GAP + ';font-weight:600;border-bottom:2px solid ' + COPPER + ';">Gap</th>';
      areaTableHtml += '<th style="padding:8px 4px;text-align:center;color:' + NAVY + ';font-weight:600;border-bottom:2px solid ' + COPPER + ';">Criticidade</th>';
      areaTableHtml += '<th style="padding:8px 4px;text-align:center;color:' + NAVY + ';font-weight:600;border-bottom:2px solid ' + COPPER + ';">Maturidade</th>';
      areaTableHtml += '</tr>';
      areaTableHtml += rows;
      areaTableHtml += '</table>';
      areaTableHtml += '<div style="margin-top:8px;font-size:10px;color:#94a3b8;font-family:Montserrat,Arial,sans-serif;">';
      areaTableHtml += '<span>Criticidade: </span>';
      areaTableHtml += '<span style="color:' + CRIT_CORES[4] + ';">&#9632; Crítico</span>&nbsp;';
      areaTableHtml += '<span style="color:' + CRIT_CORES[3] + ';">&#9632; Significativo</span>&nbsp;';
      areaTableHtml += '<span style="color:' + CRIT_CORES[2] + ';">&#9632; Moderado</span>&nbsp;';
      areaTableHtml += '<span style="color:' + CRIT_CORES[1] + ';">&#9632; Baixo</span>';
      areaTableHtml += '</div>';
      areaTableHtml += '</td></tr>';
    }

    // ── Pending Review HTML ──
    var pendingHtml = "";
    if (showPendingReview && items.length > 0) {
      var pRows = "";
      for (var j = 0; j < items.length; j++) {
        var c = items[j];
        var bgP = j % 2 === 0 ? "#ffffff" : "#faf5ff";
        var consultorNome = (c as any).consultor?.nome || "\u2014";
        var showConsultor = c.status_workflow === "em_analise" || c.status_workflow === "teste_pendente";
        var sc = statusColor(c.status_workflow);

        pRows += '<tr style="background:' + bgP + ';">';
        pRows += '<td style="padding:5px 4px;border-bottom:1px solid #f3e8ff;color:#334155;font-weight:500;">' + ((c.rc || c.rr || "-").substring(0, 12)) + '</td>';
        pRows += '<td style="padding:5px 4px;border-bottom:1px solid #f3e8ff;color:#64748b;">' + ((c as any).areas?.nome || "-") + '</td>';
        pRows += '<td style="padding:5px 4px;border-bottom:1px solid #f3e8ff;text-align:center;">';
        pRows += '<span style="background:' + sc + '15;color:' + sc + ';border-radius:4px;padding:2px 6px;font-size:10px;font-weight:bold;">' + statusLabel(c.status_workflow) + '</span>';
        pRows += '</td>';
        pRows += '<td style="padding:5px 4px;border-bottom:1px solid #f3e8ff;color:#64748b;">' + (showConsultor ? consultorNome : "\u2014") + '</td>';
        pRows += '</tr>';
      }

      pendingHtml = '<tr><td style="padding:20px 32px 8px;">';
      pendingHtml += '<div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:16px;">';
      pendingHtml += '<h3 style="margin:0 0 4px;font-size:14px;color:#581c87;font-family:Raleway,Arial,sans-serif;">&#128203; Pauta de Revisão</h3>';
      pendingHtml += '<p style="margin:0 0 12px;font-size:11px;color:#7c3aed;font-family:Montserrat,Arial,sans-serif;">' + items.length + ' controle' + (items.length > 1 ? 's' : '') + ' pendente' + (items.length > 1 ? 's' : '') + ' de ação:</p>';
      pendingHtml += '<table width="100%" cellpadding="0" cellspacing="0" style="font-size:11px;border-collapse:collapse;font-family:Montserrat,Arial,sans-serif;">';
      pendingHtml += '<tr style="background:#f3e8ff;">';
      pendingHtml += '<th style="padding:6px 4px;text-align:left;color:#581c87;font-weight:600;border-bottom:1px solid #e9d5ff;">Ref.</th>';
      pendingHtml += '<th style="padding:6px 4px;text-align:left;color:#581c87;font-weight:600;border-bottom:1px solid #e9d5ff;">Área</th>';
      pendingHtml += '<th style="padding:6px 4px;text-align:center;color:#581c87;font-weight:600;border-bottom:1px solid #e9d5ff;">Status</th>';
      pendingHtml += '<th style="padding:6px 4px;text-align:left;color:#581c87;font-weight:600;border-bottom:1px solid #e9d5ff;">Consultor</th>';
      pendingHtml += '</tr>';
      pendingHtml += pRows;
      pendingHtml += '</table>';
      pendingHtml += '</div>';
      pendingHtml += '</td></tr>';
    }

    // ── Gradient for maturity bar ──
    var barGradient = "linear-gradient(90deg, #DC2626 0%, #EF4444 10%, #EA580C 25%, #F97316 40%, #EAB308 50%, #84CC16 65%, #22C55E 80%, #15803D 100%)";

    // ── Full HTML ──
    var h = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">';
    h += '<style>@import url("https://fonts.googleapis.com/css2?family=Raleway:wght@300;600;700&family=Montserrat:wght@400;500;600;700&display=swap");</style>';
    h += '</head><body style="margin:0;padding:0;background:' + CREAM + ';font-family:Montserrat,Arial,sans-serif;"><!--' + Date.now() + '-->';
    h += '<table width="100%" cellpadding="0" cellspacing="0" style="background:' + CREAM + ';padding:32px 16px;"><tr><td align="center">';
    h += '<table width="600" cellpadding="0" cellspacing="0" style="background:' + WHITE + ';border-radius:12px;overflow:hidden;">';

    // Header
    h += '<tr><td style="background:' + NAVY + ';padding:28px 32px;text-align:center;">';
    h += '<img src="' + LOGO_URL + '" alt="Polímata GRC" width="180" style="display:block;margin:0 auto;" />';
    h += '<p style="margin:12px 0 0;color:rgba(255,255,255,0.6);font-size:12px;font-family:Montserrat,Arial,sans-serif;">Relatório Mensal de Controles Internos \u2014 ' + mesNome + ' ' + ano + '</p>';
    h += '</td></tr>';

    // Greeting
    h += '<tr><td style="padding:28px 32px 8px;">';
    h += '<h2 style="margin:0 0 8px;color:' + NAVY + ';font-size:18px;font-family:Raleway,Arial,sans-serif;font-weight:600;">Olá, ' + nome + '.</h2>';
    h += '<p style="margin:0;color:#666;font-size:14px;line-height:1.6;font-family:Montserrat,Arial,sans-serif;">' + greeting + '</p>';
    h += '</td></tr>';

    // Overview Cards — Maturity + Counts
    h += '<tr><td style="padding:16px 32px;">';
    h += '<table width="100%" cellpadding="0" cellspacing="0"><tr>';

    // Card: Total de Riscos (destaque)
    h += '<td width="25%" style="padding:4px;">';
    h += '<div style="background:' + CREAM + ';border-radius:8px;padding:14px 8px;text-align:center;">';
    h += '<div style="font-size:24px;font-weight:bold;color:' + NAVY + ';font-family:Raleway,Arial,sans-serif;">' + stats.total + '</div>';
    h += '<div style="font-size:10px;color:#888;margin-top:2px;font-family:Montserrat,Arial,sans-serif;">Total de Riscos</div>';
    h += '</div></td>';

    // Card: Efetivo
    h += '<td width="25%" style="padding:4px;">';
    h += '<div style="background:' + BG_EFETIVO + ';border-radius:8px;padding:14px 8px;text-align:center;">';
    h += '<div style="font-size:22px;font-weight:bold;color:' + COR_EFETIVO + ';font-family:Raleway,Arial,sans-serif;">' + stats.efetivo + '</div>';
    h += '<div style="font-size:10px;color:' + COR_EFETIVO + ';margin-top:2px;font-family:Montserrat,Arial,sans-serif;">Efetivos</div>';
    h += '</div></td>';

    // Card: Inefetivo
    h += '<td width="25%" style="padding:4px;">';
    h += '<div style="background:' + BG_INEFETIVO + ';border-radius:8px;padding:14px 8px;text-align:center;">';
    h += '<div style="font-size:22px;font-weight:bold;color:' + COR_INEFETIVO + ';font-family:Raleway,Arial,sans-serif;">' + stats.inefetivo + '</div>';
    h += '<div style="font-size:10px;color:' + COR_INEFETIVO + ';margin-top:2px;font-family:Montserrat,Arial,sans-serif;">Inefetivos</div>';
    h += '</div></td>';

    // Card: Gap
    h += '<td width="25%" style="padding:4px;">';
    h += '<div style="background:' + BG_GAP + ';border-radius:8px;padding:14px 8px;text-align:center;">';
    h += '<div style="font-size:22px;font-weight:bold;color:' + COR_GAP + ';font-family:Raleway,Arial,sans-serif;">' + stats.gap + '</div>';
    h += '<div style="font-size:10px;color:' + COR_GAP + ';margin-top:2px;font-family:Montserrat,Arial,sans-serif;">Gaps</div>';
    h += '</div></td>';

    h += '</tr></table>';

    // Maturity gradient bar (linear-gradient works in Gmail)
    h += '<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;"><tr>';
    h += '<td style="background:linear-gradient(90deg, #DC2626 0%, #EF4444 10%, #EA580C 25%, #F97316 40%, #EAB308 50%, #84CC16 65%, #22C55E 80%, #15803D 100%);border-radius:6px;height:12px;font-size:0;line-height:0;">';
    h += '&nbsp;</td></tr></table>';

    // Arrow indicator (table-based, email-safe)
    var pctLeft = Math.max(1, Math.min(matPct, 99));
    var pctRight = 100 - pctLeft;
    h += '<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:0;"><tr>';
    h += '<td style="width:' + pctLeft + '%;font-size:0;line-height:0;height:1px;"></td>';
    h += '<td style="text-align:center;font-size:12px;line-height:14px;color:' + NAVY + ';white-space:nowrap;">&#9660;</td>';
    h += '<td style="width:' + pctRight + '%;font-size:0;line-height:0;height:1px;"></td>';
    h += '</tr></table>';

    // Maturity label under bar
    h += '<p style="margin:4px 0 0;text-align:center;font-size:12px;color:#888;font-family:Montserrat,Arial,sans-serif;">';
    h += matLabel + ': <strong style="color:' + nivelCor + ';">' + matNivel + ' \u2014 ' + matNome + ' (' + matPct + '%)</strong>';
    h += '</p>';
    h += '</td></tr>';

    // Area table
    h += areaTableHtml;

    // Subprocesso table
    if (showSubprocessTable && subs.length > 0) {
      var subRows = "";
      for (var si = 0; si < subs.length; si++) {
        var s = subs[si];
        var bgSub = si % 2 === 0 ? WHITE : CREAM;
        subRows += '<tr style="background:' + bgSub + ';">';
        subRows += '<td style="padding:6px;color:' + NAVY + ';border-bottom:1px solid #e8e0d4;font-weight:500;">' + (s.nome || "-") + '</td>';
        subRows += '<td style="padding:6px 4px;text-align:center;color:' + NAVY + ';border-bottom:1px solid #e8e0d4;font-weight:bold;">' + s.total + '</td>';
        subRows += '<td style="padding:6px 4px;text-align:center;color:' + COR_EFETIVO + ';font-weight:bold;border-bottom:1px solid #e8e0d4;">' + s.efetivo + '</td>';
        subRows += '<td style="padding:6px 4px;text-align:center;color:' + COR_INEFETIVO + ';font-weight:bold;border-bottom:1px solid #e8e0d4;">' + s.inefetivo + '</td>';
        subRows += '<td style="padding:6px 4px;text-align:center;color:' + COR_GAP + ';font-weight:bold;border-bottom:1px solid #e8e0d4;">' + s.gap + '</td>';
        subRows += '</tr>';
      }

      h += '<tr><td style="padding:20px 32px 8px;">';
      h += '<h2 style="margin:0 0 12px;font-size:15px;color:' + NAVY + ';font-family:Raleway,Arial,sans-serif;font-weight:600;">Por Subprocesso</h2>';
      h += '<table width="100%" cellpadding="0" cellspacing="0" style="font-size:11px;border-collapse:collapse;font-family:Montserrat,Arial,sans-serif;">';
      h += '<tr style="background:' + CREAM + ';">';
      h += '<th style="padding:8px 6px;text-align:left;color:' + NAVY + ';font-weight:600;border-bottom:2px solid ' + COPPER + ';">Subprocesso</th>';
      h += '<th style="padding:8px 4px;text-align:center;color:' + NAVY + ';font-weight:600;border-bottom:2px solid ' + COPPER + ';">Total</th>';
      h += '<th style="padding:8px 4px;text-align:center;color:' + COR_EFETIVO + ';font-weight:600;border-bottom:2px solid ' + COPPER + ';">Efetivo</th>';
      h += '<th style="padding:8px 4px;text-align:center;color:' + COR_INEFETIVO + ';font-weight:600;border-bottom:2px solid ' + COPPER + ';">Inefetivo</th>';
      h += '<th style="padding:8px 4px;text-align:center;color:' + COR_GAP + ';font-weight:600;border-bottom:2px solid ' + COPPER + ';">Gap</th>';
      h += '</tr>';
      h += subRows;
      h += '</table>';
      h += '</td></tr>';
    }

    // Pending review
    h += pendingHtml;

    // CTA Button
    h += '<tr><td style="padding:24px 32px;text-align:center;">';
    h += '<table cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr><td style="background:' + COPPER + ';border-radius:999px;padding:12px 32px;">';
    h += '<a href="' + APP_URL + '" style="color:' + WHITE + ';text-decoration:none;font-size:14px;font-weight:600;font-family:Montserrat,Arial,sans-serif;">Acessar o Sistema \u2192</a>';
    h += '</td></tr></table>';
    h += '</td></tr>';

    // Footer
    h += '<tr><td style="background:' + NAVY + ';padding:20px 32px;text-align:center;">';
    h += '<p style="margin:0;color:rgba(255,255,255,0.5);font-size:11px;font-family:Montserrat,Arial,sans-serif;">Este é um e-mail automático enviado no último dia útil de cada mês.<br>Polímata GRC \u2014 Controles Internos</p>';
    h += '</td></tr>';

    h += '</table></td></tr></table></body></html>';
    return h;
  }

  // ══════════════════════════════════════════
  //  SEND EMAILS — role-based
  // ══════════════════════════════════════════
  var subject = "Relatório Mensal de Controles Internos \u2014 " + mesNome + " " + ano;
  var results: any[] = [];
  var alreadySent = new Set<string>();

  // ── 1. GERENTE DO PROJETO (Polímata) — one email per project ──
  for (const proj of (projetos || [])) {
    if (!proj.gerente_id) continue;

    var gerente = allPerfis.find(function(p: any) { return p.id === proj.gerente_id; });
    if (!gerente) continue;

    var clienteNome = (proj as any).clientes?.nome || "seu projeto";
    var projControles = controles.filter(function(c: any) { return c.projeto_id === proj.id; });
    var projStats = computeStats(projControles);

    // ── Fetch maturity from DB ──
    var matData: any = null;
    try {
      var rpcRes = await supabase.rpc("calcular_maturidade_projeto", { p_projeto_id: proj.id });
      matData = rpcRes.data?.[0] || null;
    } catch (e) {
      console.error("Maturity RPC error: " + e);
    }
    var matIndice = matData ? Number(matData.indice) : 0;
    var matNivel = matData?.nivel || "N1";
    var matNome = matData?.nome || "Não confiável";
    var detalheAreas: any[] = matData?.detalhe_areas || [];

    // Merge maturity data with control counts per area
    var projAreasMap: Record<string, any> = {};
    for (const c of projControles) {
      var areaNome = (c as any).areas?.nome || "Sem Área";
      if (!projAreasMap[areaNome]) {
        projAreasMap[areaNome] = { crit1: 0, crit2: 0, crit3: 0, crit4: 0 };
      }
      var pa = projAreasMap[areaNome];
      var crit = (c as any).crit || 0;
      if (crit === 1) pa.crit1++;
      else if (crit === 2) pa.crit2++;
      else if (crit === 3) pa.crit3++;
      else if (crit === 4) pa.crit4++;
    }

    // Build final areas array merging DB maturity + control counts
    var areasMaturity: any[] = [];
    for (var da of detalheAreas) {
      if (da.total_controles === 0) continue;
      var critData = projAreasMap[da.area_nome] || { crit1: 0, crit2: 0, crit3: 0, crit4: 0 };
      areasMaturity.push({
        area_nome: da.area_nome,
        efetivos: da.efetivos,
        inefetivos: da.inefetivos,
        gaps: da.gaps,
        percentual: da.percentual,
        nivel: da.nivel,
        nome_nivel: da.nome_nivel,
        total_controles: da.total_controles,
        crit1: critData.crit1,
        crit2: critData.crit2,
        crit3: critData.crit3,
        crit4: critData.crit4,
      });
    }
    // Sort by maturity ascending (worst first)
    areasMaturity.sort(function(a: any, b: any) { return a.percentual - b.percentual; });

    // Pending items for THIS project
    var projPending = projControles
      .filter(function(c: any) { return ["em_revisao", "em_analise", "teste_pendente"].indexOf(c.status_workflow) >= 0; })
      .sort(function(a: any, b: any) {
        var order: Record<string, number> = { em_revisao: 0, teste_pendente: 1, em_analise: 2 };
        return (order[a.status_workflow] ?? 9) - (order[b.status_workflow] ?? 9);
      });

    var gerenteNome = gerente.nome || gerente.email.split("@")[0];
    var html = buildHtml({
      nome: gerenteNome,
      greeting: "Confira o resumo mensal dos controles internos da " + clienteNome + ".",
      stats: projStats,
      matIndice: matIndice,
      matNivel: matNivel,
      matNome: matNome,
      matLabel: "N\u00edvel de Maturidade",
      showAreaTable: true,
      showPendingReview: true,
      showSubprocessTable: false,
      areasMaturity: areasMaturity,
      pendingItems: projPending,
      subprocessos: [],
    });

    // Build recipient list: gerente + admin CC (if different)
    var toList: string[] = [gerente.email];
    alreadySent.add(gerente.email);

    var admins = allPerfis.filter(function(p: any) { return p.papel === "admin_polimata" && p.id !== proj.gerente_id; });
    for (const adm of admins) {
      if (!alreadySent.has(adm.email)) {
        toList.push(adm.email);
        alreadySent.add(adm.email);
      }
    }

    var res = await sendEmail(toList, subject, html);
    results.push({ email: toList, papel: "gerente_projeto", projeto: proj.nome, status: res.status });
  }

  // ── 2. GESTOR CLIENTE — sees area table + maturity, NO pending review ──
  var gestores = allPerfis.filter(function(d: any) { return d.papel === "gestor_cliente"; });
  for (const dest of gestores) {
    if (alreadySent.has(dest.email)) continue;
    var clienteNome2 = (dest as any).clientes?.nome || "seu projeto";
    var nome2 = dest.nome || dest.email.split("@")[0];

    // Find project for this gestor's client
    var gestorProjeto = (projetos || []).find(function(p: any) { return p.clientes?.nome === clienteNome2; });
    var gestorMatData: any = null;
    if (gestorProjeto) {
      try {
        var rpcRes2 = await supabase.rpc("calcular_maturidade_projeto", { p_projeto_id: gestorProjeto.id });
        gestorMatData = rpcRes2.data?.[0] || null;
      } catch (e) { console.error("Maturity RPC error gestor: " + e); }
    }

    var gMatIndice = gestorMatData ? Number(gestorMatData.indice) : 0;
    var gMatNivel = gestorMatData?.nivel || "N1";
    var gMatNome = gestorMatData?.nome || "Não confiável";
    var gDetalheAreas: any[] = gestorMatData?.detalhe_areas || [];

    // Build areas with crit data
    var gAreasMaturity: any[] = [];
    var gestorControles = controles.filter(function(c: any) { return gestorProjeto && c.projeto_id === gestorProjeto.id; });
    var gAreasMap: Record<string, any> = {};
    for (const c of gestorControles) {
      var aN = (c as any).areas?.nome || "Sem Área";
      if (!gAreasMap[aN]) gAreasMap[aN] = { crit1: 0, crit2: 0, crit3: 0, crit4: 0 };
      var ga = gAreasMap[aN];
      var cr = (c as any).crit || 0;
      if (cr === 1) ga.crit1++; else if (cr === 2) ga.crit2++; else if (cr === 3) ga.crit3++; else if (cr === 4) ga.crit4++;
    }
    for (var gda of gDetalheAreas) {
      if (gda.total_controles === 0) continue;
      var gc = gAreasMap[gda.area_nome] || { crit1: 0, crit2: 0, crit3: 0, crit4: 0 };
      gAreasMaturity.push({ area_nome: gda.area_nome, efetivos: gda.efetivos, inefetivos: gda.inefetivos, gaps: gda.gaps, percentual: gda.percentual, nivel: gda.nivel, nome_nivel: gda.nome_nivel, total_controles: gda.total_controles, crit1: gc.crit1, crit2: gc.crit2, crit3: gc.crit3, crit4: gc.crit4 });
    }
    gAreasMaturity.sort(function(a: any, b: any) { return a.percentual - b.percentual; });

    var gStats = computeStats(gestorControles);

    var html2 = buildHtml({
      nome: nome2,
      greeting: "Confira o status atual do ambiente de controles internos da " + clienteNome2 + ".",
      stats: gStats,
      matIndice: gMatIndice,
      matNivel: gMatNivel,
      matNome: gMatNome,
      matLabel: "N\u00edvel de Maturidade",
      showAreaTable: true,
      showPendingReview: false,
      showSubprocessTable: false,
      areasMaturity: gAreasMaturity,
      pendingItems: [],
      subprocessos: [],
    });

    var res2 = await sendEmail(dest.email, subject, html2);
    results.push({ email: dest.email, papel: dest.papel, status: res2.status });
    alreadySent.add(dest.email);
  }

  // ── 3. USUARIO CLIENTE — sees area data + subprocesso breakdown ──
  for (const dest of clienteUsers) {
    if (alreadySent.has(dest.email)) continue;
    var clienteNome3 = (dest as any).clientes?.nome || "seu projeto";
    var nome3 = dest.nome || dest.email.split("@")[0];
    var userAreas = userAreaMap[dest.id] || [];
    var areaLabel = userAreas.length === 1 ? userAreas[0] : userAreas.join(", ") || "sua \u00e1rea";
    var userControles = controles.filter(function(c: any) { return userAreas.indexOf((c as any).areas?.nome) >= 0; });
    var userStats = computeStats(userControles);

    // Build subprocesso breakdown from user's controls
    var subMap: Record<string, { total: number; efetivo: number; inefetivo: number; gap: number }> = {};
    for (const uc of userControles) {
      var subNome = (uc as any).sub || "Sem subprocesso";
      if (!subMap[subNome]) subMap[subNome] = { total: 0, efetivo: 0, inefetivo: 0, gap: 0 };
      subMap[subNome].total++;
      var r1Val = ((uc as any).r1 || "").toUpperCase();
      if (r1Val === "EFETIVO") subMap[subNome].efetivo++;
      else if (r1Val === "INEFETIVO") subMap[subNome].inefetivo++;
      else if (r1Val === "GAP") subMap[subNome].gap++;
    }
    // Convert to array sorted by total descending
    var subArray: any[] = [];
    for (var subKey in subMap) {
      subArray.push({ nome: subKey, total: subMap[subKey].total, efetivo: subMap[subKey].efetivo, inefetivo: subMap[subKey].inefetivo, gap: subMap[subKey].gap });
    }
    subArray.sort(function(a: any, b: any) { return b.total - a.total; });

    // Get maturity for user's area(s)
    var uMatIndice = 0;
    var uMatNivel = "N1";
    var uMatNome = "N\u00e3o confi\u00e1vel";
    if (userAreas.length > 0) {
      var areaIds = new Set<string>();
      for (const uc of userControles) {
        if ((uc as any).areas?.id) areaIds.add((uc as any).areas.id);
      }
      var sumMat = 0;
      var countMat = 0;
      for (const aid of areaIds) {
        try {
          var rpcA = await supabase.rpc("calcular_maturidade_area", { p_area_id: aid });
          if (rpcA.data?.[0]) {
            sumMat += Number(rpcA.data[0].percentual);
            countMat++;
          }
        } catch (e) { /* skip */ }
      }
      if (countMat > 0) {
        uMatIndice = sumMat / countMat;
        var uPct = Math.round(uMatIndice * 100);
        if (uPct <= 10) { uMatNivel = "N1"; uMatNome = "N\u00e3o confi\u00e1vel"; }
        else if (uPct <= 25) { uMatNivel = "N2"; uMatNome = "Informal"; }
        else if (uPct <= 50) { uMatNivel = "N3"; uMatNome = "Padronizado"; }
        else if (uPct <= 80) { uMatNivel = "N4"; uMatNome = "Monitorado"; }
        else { uMatNivel = "N5"; uMatNome = "Otimizado"; }
      }
    }

    var html3 = buildHtml({
      nome: nome3,
      greeting: "Confira o status atual do ambiente de controles internos da \u00e1rea " + areaLabel + " da " + clienteNome3 + ".",
      stats: userStats,
      matIndice: uMatIndice,
      matNivel: uMatNivel,
      matNome: uMatNome,
      matLabel: "Maturidade da \u00c1rea",
      showAreaTable: false,
      showPendingReview: false,
      showSubprocessTable: true,
      areasMaturity: [],
      pendingItems: [],
      subprocessos: subArray,
    });

    var res3 = await sendEmail(dest.email, subject, html3);
    results.push({ email: dest.email, papel: dest.papel, status: res3.status });
    alreadySent.add(dest.email);
  }

  return new Response(JSON.stringify({ success: true, sent: results.length, results }), {
    headers: { "Content-Type": "application/json" },
  });
});
