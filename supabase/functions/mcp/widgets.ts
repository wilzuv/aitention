// ChatGPT Apps SDK widgets.
//
// A widget is an HTML+JS bundle served as an MCP resource with mimeType
// "text/html+skybridge". ChatGPT renders it in a sandboxed iframe when a
// tool whose _meta["openai/outputTemplate"] points at the resource returns.
// The iframe reads the tool's structuredContent via window.openai.toolOutput
// and can call other tools on this server via window.openai.callTool —
// those calls go through the normal tools/call path, so auth and user
// scoping are inherited.
//
// The bundle must be fully self-contained: the iframe CSP blocks external
// scripts, styles, and fetches. No backticks or ${ in the HTML below — it
// lives inside a TS template literal.
//
// Other MCP clients (claude.ai, Claude Desktop) ignore _meta and the
// ui:// resource; nothing here changes their behavior.

import { MCP_TOOL_PREFIX } from "./toolTypes.ts";

export const WIDGET_MIME_TYPE = "text/html+skybridge";

export const HYPOTHESES_WIDGET_URI = "ui://widget/hypotheses.html";

export interface WidgetDef {
  uri: string;
  // Trim the raw tool result into the payload the widget (and the model —
  // ChatGPT reads structuredContent too) receives. Keep it lean: every
  // field costs tokens on the model side.
  structuredContent: (result: unknown) => unknown;
}

interface EvidenceRow {
  note?: string;
  prior_credence?: number;
  posterior_credence?: number;
  created_at?: string;
}

interface HypothesisRow {
  id: string;
  statement?: string;
  current_credence?: number;
  agent_credence?: number | null;
  agent_revision?: string | null;
  basis?: string | null;
  updated_at?: string;
  evidence?: EvidenceRow[];
}

function trimHypotheses(result: unknown): unknown {
  const rows = ((result as { hypotheses?: HypothesisRow[] })?.hypotheses) ?? [];
  return {
    hypotheses: rows.map((h) => ({
      id: h.id,
      statement: h.statement ?? "",
      current_credence: h.current_credence ?? null,
      agent_credence: h.agent_credence ?? null,
      agent_revision: h.agent_revision ?? null,
      basis: h.basis ?? null,
      updated_at: h.updated_at ?? null,
      evidence_count: (h.evidence ?? []).length,
      // Last 5 entries, oldest first (matches the read order upstream).
      evidence: (h.evidence ?? []).slice(-5).map((e) => ({
        note: e.note ?? "",
        prior_credence: e.prior_credence ?? null,
        posterior_credence: e.posterior_credence ?? null,
        created_at: e.created_at ?? null,
      })),
    })),
  };
}

// Widgets keyed by the tool whose output they render.
export const WIDGETS_BY_TOOL: Record<string, WidgetDef> = {
  [`${MCP_TOOL_PREFIX}get_hypotheses`]: {
    uri: HYPOTHESES_WIDGET_URI,
    structuredContent: trimHypotheses,
  },
};

export const WIDGET_HTML: Record<string, string> = {
  [HYPOTHESES_WIDGET_URI]: `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 4px 2px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    font-size: 14px; line-height: 1.45;
    color: #1a1a1a; background: transparent;
  }
  .card {
    border: 1px solid rgba(0,0,0,0.12); border-radius: 12px;
    padding: 12px 14px; margin-bottom: 10px; background: rgba(255,255,255,0.65);
  }
  .head { display: flex; align-items: flex-start; gap: 10px; }
  .badge {
    flex: none; min-width: 44px; text-align: center;
    font-weight: 600; font-size: 13px; padding: 3px 6px;
    border-radius: 8px; background: rgba(59,130,246,0.12); color: #1d4ed8;
  }
  .statement { font-weight: 600; }
  .track {
    height: 4px; border-radius: 2px; background: rgba(0,0,0,0.08);
    margin: 8px 0 6px;
  }
  .fill { height: 100%; border-radius: 2px; background: #3b82f6; }
  .meta { font-size: 12px; color: rgba(0,0,0,0.55); }
  .lastev { font-size: 12px; color: rgba(0,0,0,0.7); margin-top: 4px; }
  .shift { font-variant-numeric: tabular-nums; font-weight: 600; }
  .actions { margin-top: 8px; display: flex; gap: 8px; }
  button {
    font: inherit; font-size: 13px; cursor: pointer;
    border-radius: 8px; padding: 5px 12px;
    border: 1px solid rgba(0,0,0,0.15); background: rgba(0,0,0,0.03); color: inherit;
  }
  button.primary { background: #3b82f6; border-color: #3b82f6; color: #fff; }
  button:disabled { opacity: 0.5; cursor: default; }
  .form { margin-top: 10px; display: none; }
  .form.open { display: block; }
  textarea {
    width: 100%; min-height: 56px; resize: vertical;
    font: inherit; font-size: 13px; padding: 8px 10px;
    border-radius: 8px; border: 1px solid rgba(0,0,0,0.15);
    background: transparent; color: inherit;
  }
  .credrow { display: flex; align-items: center; gap: 10px; margin: 8px 0; }
  .credrow input[type=range] { flex: 1; accent-color: #3b82f6; }
  .credval { min-width: 76px; font-size: 13px; font-variant-numeric: tabular-nums; }
  .error { color: #dc2626; font-size: 12px; margin-top: 6px; }
  .empty { padding: 16px; text-align: center; color: rgba(0,0,0,0.55); }
  @media (prefers-color-scheme: dark) {
    body { color: #ececec; }
    .card { border-color: rgba(255,255,255,0.14); background: rgba(255,255,255,0.05); }
    .badge { background: rgba(96,165,250,0.18); color: #93c5fd; }
    .track { background: rgba(255,255,255,0.12); }
    .meta { color: rgba(255,255,255,0.55); }
    .lastev { color: rgba(255,255,255,0.72); }
    .empty { color: rgba(255,255,255,0.55); }
    button { border-color: rgba(255,255,255,0.2); background: rgba(255,255,255,0.06); }
    button.primary { background: #3b82f6; border-color: #3b82f6; color: #fff; }
    textarea { border-color: rgba(255,255,255,0.2); }
  }
</style>
</head>
<body>
<div id="root"></div>
<script>
(function () {
  var root = document.getElementById("root");
  var TOOL_APPEND = "aitention_append_hypothesis_evidence";

  function oai() { return window.openai || {}; }

  // Widget state survives re-renders and conversation navigation.
  // applied: optimistic evidence rows logged from this widget, per
  // hypothesis id — toolOutput never refreshes after callTool, so we merge
  // these into the display ourselves.
  var state = oai().widgetState || { expandedId: null, drafts: {}, applied: {} };
  function saveState() { if (oai().setWidgetState) oai().setWidgetState(state); }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function hypotheses() {
    var out = oai().toolOutput;
    return (out && Array.isArray(out.hypotheses)) ? out.hypotheses : [];
  }

  function displayCredence(h) {
    var applied = state.applied[h.id];
    if (applied && applied.length) {
      return applied[applied.length - 1].posterior_credence;
    }
    return h.current_credence;
  }

  function lastEvidence(h) {
    var applied = state.applied[h.id];
    if (applied && applied.length) return applied[applied.length - 1];
    var ev = h.evidence || [];
    return ev.length ? ev[ev.length - 1] : null;
  }

  function evidenceCount(h) {
    var applied = state.applied[h.id] || [];
    return (h.evidence_count != null ? h.evidence_count : (h.evidence || []).length) + applied.length;
  }

  function cardHtml(h) {
    var cred = displayCredence(h);
    var credText = cred == null ? "—" : cred + "%";
    var open = state.expandedId === h.id;
    var draft = state.drafts[h.id] || {};
    var draftCred = draft.credence != null ? draft.credence : (cred == null ? 50 : cred);
    var last = lastEvidence(h);
    var count = evidenceCount(h);

    var html = "";
    html += '<div class="card" data-id="' + esc(h.id) + '">';
    html += '<div class="head"><span class="badge">' + esc(credText) + '</span>';
    html += '<span class="statement">' + esc(h.statement) + "</span></div>";
    html += '<div class="track"><div class="fill" style="width:' + (cred == null ? 0 : cred) + '%"></div></div>';
    if (h.basis) html += '<div class="meta">Basis: ' + esc(h.basis) + "</div>";
    html += '<div class="meta">' + count + (count === 1 ? " evidence entry" : " evidence entries") + "</div>";
    if (last) {
      html += '<div class="lastev">Last: ' + esc(last.note) + " ";
      html += '<span class="shift">(' + esc(last.prior_credence) + "% \\u2192 " + esc(last.posterior_credence) + "%)</span></div>";
    }
    html += '<div class="actions">';
    html += '<button type="button" data-act="toggle">' + (open ? "Cancel" : "Log evidence") + "</button>";
    html += '<button type="button" data-act="discuss">Discuss in chat</button>';
    html += "</div>";
    html += '<div class="form' + (open ? " open" : "") + '">';
    html += '<textarea data-role="note" placeholder="What changed and why?">' + esc(draft.note || "") + "</textarea>";
    html += '<div class="credrow"><input type="range" min="0" max="100" step="1" data-role="cred" value="' + draftCred + '">';
    html += '<span class="credval">' + esc(credText) + " \\u2192 <b data-role=\\"credlabel\\">" + draftCred + "%</b></span></div>";
    html += '<button type="button" class="primary" data-act="submit">Append evidence</button>';
    html += '<div class="error" data-role="error"></div>';
    html += "</div></div>";
    return html;
  }

  function render() {
    var list = hypotheses();
    if (!list.length) {
      root.innerHTML = '<div class="empty">No active hypotheses.</div>';
      return;
    }
    var html = "";
    for (var i = 0; i < list.length; i++) html += cardHtml(list[i]);
    root.innerHTML = html;
    wire(list);
  }

  function wire(list) {
    var byId = {};
    for (var i = 0; i < list.length; i++) byId[list[i].id] = list[i];

    var cards = root.querySelectorAll(".card");
    for (var c = 0; c < cards.length; c++) {
      (function (card) {
        var hid = card.getAttribute("data-id");
        var h = byId[hid];
        var note = card.querySelector('[data-role="note"]');
        var cred = card.querySelector('[data-role="cred"]');
        var credLabel = card.querySelector('[data-role="credlabel"]');
        var errEl = card.querySelector('[data-role="error"]');

        card.querySelector('[data-act="toggle"]').addEventListener("click", function () {
          state.expandedId = state.expandedId === hid ? null : hid;
          saveState();
          render();
        });

        card.querySelector('[data-act="discuss"]').addEventListener("click", function () {
          if (oai().sendFollowUpMessage) {
            oai().sendFollowUpMessage({
              prompt: 'Let\\'s examine my hypothesis: "' + h.statement + '" \\u2014 what evidence should update it?'
            });
          }
        });

        function saveDraft() {
          state.drafts[hid] = { note: note.value, credence: Number(cred.value) };
          saveState();
        }
        note.addEventListener("input", saveDraft);
        cred.addEventListener("input", function () {
          credLabel.textContent = cred.value + "%";
          saveDraft();
        });

        card.querySelector('[data-act="submit"]').addEventListener("click", function () {
          var text = note.value.trim();
          if (!text) { errEl.textContent = "Add a note explaining what changed."; return; }
          if (!oai().callTool) { errEl.textContent = "callTool is unavailable in this host."; return; }
          var btn = this;
          btn.disabled = true;
          errEl.textContent = "";
          var prior = displayCredence(h);
          var posterior = Number(cred.value);
          oai().callTool(TOOL_APPEND, { id: hid, note: text, posterior_credence: posterior })
            .then(function () {
              if (!state.applied[hid]) state.applied[hid] = [];
              state.applied[hid].push({ note: text, prior_credence: prior, posterior_credence: posterior });
              delete state.drafts[hid];
              state.expandedId = null;
              saveState();
              render();
            })
            .catch(function (e) {
              btn.disabled = false;
              errEl.textContent = "Failed to log evidence: " + ((e && e.message) || "unknown error");
            });
        });
      })(cards[c]);
    }
  }

  // The host re-hydrates globals (toolOutput, theme, displayMode) via this
  // event; re-render so late-arriving tool output shows up.
  window.addEventListener("openai:set_globals", render);
  render();
})();
</script>
</body>
</html>
`,
};
