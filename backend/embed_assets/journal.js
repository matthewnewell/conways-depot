/**
 * Conway's Depot's embeddable Journal widget — a framework-free drawer any sibling app can drop
 * in with one <script> tag, so journaling doesn't require alt-tabbing to the Depot. Renders into
 * a Shadow DOM so it never fights the host app's CSS (and vice versa).
 *
 * Two ways to configure it:
 *   1. Static: data-* attributes on the <script> tag itself (depot-url, person-id, project-id,
 *      application-id, application-name, projects — a JSON array of {id, name}).
 *   2. Dynamic (SPA hosts, e.g. React apps where the active person loads async): call
 *      window.JournalWidget.configure({...}) with the same fields, any time — e.g. whenever the
 *      host's own persona changes.
 *
 * `personId` + `projects` together enable a "My day (personal)" feed alongside a picker for
 * each of that person's projects — the personal/shared split this widget exists to carry: a
 * project-less note is queried back filtered to person_id only (routes/notes.py's
 * /api/people/<id>/notes), a project note is the same merged, shared feed every connected app's
 * entries land in (/api/projects/<id>/journal). `projectId` alone (no personId) fixes the widget
 * to one project — for a host with no notion of "person" of its own.
 *
 * `applicationId` (this app's own Depot application id) unlocks a "This app / Whole project"
 * filter on a project's feed — omit it and the widget just always shows the whole project.
 *
 * A third mode, for a host with no "person" AND no Depot project id of its own (e.g. Value
 * Stream, which stays deliberately Depot-unaware — see its models.py): pass `applicationId` +
 * `externalRef` (this app's own resource id, e.g. a map id) with no `projectId`/`personId`. The
 * widget resolves the Depot project itself via GET /api/applications/<id>/project-link — the
 * reverse of the crosswalk the summary/journal proxies already use — so the host never has to
 * learn a Depot id to embed this. No match (resource not linked to any project yet) is a normal
 * state, shown as such, not an error.
 */
(function () {
  "use strict";

  var STATE = {
    depotUrl: "http://localhost:8090",
    personId: null,
    projectId: null,
    projects: [],
    applicationId: null,
    externalRef: null,
    selected: null,
    scopeFilter: "whole",
    resolving: false,
    noLinkFound: false,
  };

  var drawerOpen = false;
  var root = null;
  var shadow = null;
  var els = {};

  function el(tag, attrs) {
    var e = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        if (k === "class") e.className = attrs[k];
        else if (k === "text") e.textContent = attrs[k];
        else e.setAttribute(k, attrs[k]);
      }
    }
    return e;
  }

  function fmtTime(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch (e) {
      return iso;
    }
  }

  var CSS =
    ":host { all: initial; }" +
    ".dj-toggle { position: fixed; right: 20px; bottom: 20px; width: 48px; height: 48px; " +
    "border-radius: 24px; background: #1f2733; color: #fff; border: none; font-size: 20px; " +
    "cursor: pointer; z-index: 999998; box-shadow: 0 2px 10px rgba(0,0,0,.25); }" +
    ".dj-drawer { position: fixed; top: 0; right: -360px; width: 340px; height: 100%; " +
    "background: #fff; border-left: 1px solid #e2e2e2; box-shadow: -2px 0 12px rgba(0,0,0,.12); " +
    "transition: right .2s ease; z-index: 999999; display: flex; flex-direction: column; " +
    "font-family: system-ui, -apple-system, sans-serif; font-size: 13px; color: #1a1a1a; " +
    "padding: 16px; box-sizing: border-box; }" +
    ".dj-drawer--open { right: 0; }" +
    ".dj-drawer__header { display: flex; justify-content: space-between; align-items: center; " +
    "margin-bottom: 8px; }" +
    ".dj-drawer__title { margin: 0; font-size: 15px; }" +
    ".dj-drawer__close { background: none; border: none; font-size: 20px; cursor: pointer; color: #666; }" +
    ".dj-picker { width: 100%; margin-bottom: 8px; padding: 6px; border-radius: 6px; " +
    "border: 1px solid #ccc; font-family: inherit; box-sizing: border-box; }" +
    ".dj-scope-toggle { display: flex; gap: 4px; margin-bottom: 8px; }" +
    ".dj-scope-btn { flex: 1; padding: 4px; border: 1px solid #ccc; background: #f5f5f5; " +
    "border-radius: 6px; cursor: pointer; font-size: 12px; font-family: inherit; }" +
    ".dj-scope-btn--active { background: #1f2733; color: #fff; border-color: #1f2733; }" +
    ".dj-list { flex: 1; overflow-y: auto; margin-bottom: 8px; }" +
    ".dj-entry { padding: 8px 0; border-bottom: 1px solid #eee; }" +
    ".dj-entry__meta { display: flex; gap: 6px; font-size: 11px; color: #888; margin-bottom: 2px; flex-wrap: wrap; }" +
    ".dj-entry__source { background: #eef1f5; padding: 1px 6px; border-radius: 4px; }" +
    ".dj-entry__body { margin: 0; color: #1a1a1a; text-decoration: none; }" +
    "a.dj-entry__body { color: #2b6cb0; cursor: pointer; }" +
    ".dj-empty { color: #999; font-style: italic; }" +
    ".dj-composer { display: flex; flex-direction: column; gap: 6px; }" +
    ".dj-composer__input { width: 100%; padding: 6px; border-radius: 6px; border: 1px solid #ccc; " +
    "font-family: inherit; font-size: 13px; box-sizing: border-box; resize: vertical; }" +
    ".dj-composer__submit { align-self: flex-end; background: #1f2733; color: #fff; border: none; " +
    "padding: 6px 14px; border-radius: 6px; cursor: pointer; font-family: inherit; }" +
    ".dj-composer__submit:disabled { opacity: .5; cursor: default; }";

  function mount() {
    root = document.createElement("div");
    root.id = "depot-journal-widget-root";
    document.body.appendChild(root);
    shadow = root.attachShadow({ mode: "open" });
    shadow.appendChild(el("style", { text: CSS }));

    els.toggle = el("button", { class: "dj-toggle", title: "Journal", text: "📝" });
    els.toggle.addEventListener("click", function () {
      setOpen(!drawerOpen);
    });
    shadow.appendChild(els.toggle);

    els.drawer = el("aside", { class: "dj-drawer" });
    shadow.appendChild(els.drawer);
  }

  function setOpen(open) {
    drawerOpen = open;
    els.drawer.classList.toggle("dj-drawer--open", open);
    if (open) refresh();
  }

  function currentFeedUrl() {
    if (STATE.selected === "personal") {
      return STATE.depotUrl + "/api/people/" + STATE.personId + "/notes";
    }
    return STATE.depotUrl + "/api/projects/" + STATE.selected + "/journal";
  }

  function currentPostUrl() {
    if (STATE.selected === "personal") {
      return STATE.depotUrl + "/api/people/" + STATE.personId + "/notes";
    }
    return STATE.depotUrl + "/api/projects/" + STATE.selected + "/notes";
  }

  function refresh() {
    if (!STATE.selected || !els.list) return;
    els.list.textContent = "Loading…";
    fetch(currentFeedUrl())
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        var entries = data.entries || [];
        if (STATE.selected !== "personal" && STATE.scopeFilter === "mine" && STATE.applicationId) {
          entries = entries.filter(function (e) {
            return e.source_type === "note" || e.application_id === STATE.applicationId;
          });
        }
        renderEntries(entries);
      })
      .catch(function () {
        els.list.textContent = "Could not reach the Depot.";
      });
  }

  function renderEntries(entries) {
    els.list.innerHTML = "";
    if (entries.length === 0) {
      els.list.appendChild(el("p", { class: "dj-empty", text: "Nothing here yet." }));
      return;
    }
    entries.forEach(function (en) {
      var row = el("div", { class: "dj-entry" });
      var meta = el("div", { class: "dj-entry__meta" });
      meta.appendChild(el("span", { text: fmtTime(en.timestamp) }));
      if (en.author) meta.appendChild(el("span", { text: en.author }));
      if (en.application_name) meta.appendChild(el("span", { class: "dj-entry__source", text: en.application_name }));
      row.appendChild(meta);
      if (en.href) {
        var a = el("a", { class: "dj-entry__body", href: en.href, target: "_blank", text: en.summary });
        row.appendChild(a);
      } else {
        row.appendChild(el("p", { class: "dj-entry__body", text: en.summary }));
      }
      els.list.appendChild(row);
    });
  }

  function renderDrawer() {
    els.drawer.innerHTML = "";

    var header = el("div", { class: "dj-drawer__header" });
    header.appendChild(el("h3", { class: "dj-drawer__title", text: "Journal" }));
    var close = el("button", { class: "dj-drawer__close", text: "×" });
    close.addEventListener("click", function () {
      setOpen(false);
    });
    header.appendChild(close);
    els.drawer.appendChild(header);

    if (STATE.resolving) {
      els.drawer.appendChild(el("p", { class: "dj-empty", text: "Looking up this project…" }));
      return;
    }
    if (STATE.noLinkFound) {
      els.drawer.appendChild(
        el("p", { class: "dj-empty", text: "This isn't connected to a Conway's Depot project yet." }),
      );
      return;
    }

    var picker = el("select", { class: "dj-picker" });
    if (STATE.projectId) {
      var fixed = STATE.projects.filter(function (p) {
        return p.id === STATE.projectId;
      })[0];
      picker.appendChild(el("option", { value: STATE.projectId, text: fixed ? fixed.name : "This project" }));
    } else {
      if (STATE.personId) {
        picker.appendChild(el("option", { value: "personal", text: "My day (personal)" }));
      }
      STATE.projects.forEach(function (p) {
        picker.appendChild(el("option", { value: p.id, text: p.name }));
      });
    }
    picker.value = STATE.selected || picker.value;
    picker.addEventListener("change", function () {
      STATE.selected = picker.value;
      renderDrawer();
    });
    els.drawer.appendChild(picker);

    if (STATE.applicationId && STATE.selected !== "personal") {
      var toggle = el("div", { class: "dj-scope-toggle" });
      var mineBtn = el("button", {
        class: "dj-scope-btn" + (STATE.scopeFilter === "mine" ? " dj-scope-btn--active" : ""),
        text: "This app",
      });
      var wholeBtn = el("button", {
        class: "dj-scope-btn" + (STATE.scopeFilter === "whole" ? " dj-scope-btn--active" : ""),
        text: "Whole project",
      });
      mineBtn.addEventListener("click", function () {
        STATE.scopeFilter = "mine";
        renderDrawer();
      });
      wholeBtn.addEventListener("click", function () {
        STATE.scopeFilter = "whole";
        renderDrawer();
      });
      toggle.appendChild(mineBtn);
      toggle.appendChild(wholeBtn);
      els.drawer.appendChild(toggle);
    }

    els.list = el("div", { class: "dj-list" });
    els.drawer.appendChild(els.list);

    var composer = el("div", { class: "dj-composer" });
    var textarea = el("textarea", { class: "dj-composer__input", placeholder: "Log a note…", rows: "2" });
    var submit = el("button", { class: "dj-composer__submit", text: "Add" });
    submit.addEventListener("click", function () {
      var body = textarea.value.trim();
      if (!body || !STATE.selected) return;
      submit.disabled = true;
      fetch(currentPostUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body, person_id: STATE.personId }),
      })
        .then(function () {
          textarea.value = "";
          refresh();
        })
        .finally(function () {
          submit.disabled = false;
        });
    });
    composer.appendChild(textarea);
    composer.appendChild(submit);
    els.drawer.appendChild(composer);

    if (drawerOpen) refresh();
  }

  function resolveProjectLink() {
    STATE.resolving = true;
    STATE.noLinkFound = false;
    if (!root) mount();
    renderDrawer();
    fetch(
      STATE.depotUrl +
        "/api/applications/" +
        STATE.applicationId +
        "/project-link?external_ref=" +
        encodeURIComponent(STATE.externalRef),
    )
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        STATE.resolving = false;
        if (data.project_id) {
          STATE.projectId = data.project_id;
          STATE.projects = [{ id: data.project_id, name: data.project_name }];
          STATE.selected = data.project_id;
        } else {
          STATE.noLinkFound = true;
        }
        renderDrawer();
      })
      .catch(function () {
        STATE.resolving = false;
        STATE.noLinkFound = true;
        renderDrawer();
      });
  }

  function applyConfig(cfg) {
    cfg = cfg || {};
    if (cfg.depotUrl) STATE.depotUrl = cfg.depotUrl;
    if ("personId" in cfg) STATE.personId = cfg.personId || null;
    if ("projectId" in cfg) STATE.projectId = cfg.projectId || null;
    if ("projects" in cfg) STATE.projects = cfg.projects || [];
    if ("applicationId" in cfg) STATE.applicationId = cfg.applicationId || null;
    if ("externalRef" in cfg) STATE.externalRef = cfg.externalRef || null;

    // Reverse-lookup mode: no projectId/personId given directly, just this app's own identity
    // + resource id — resolve the Depot project ourselves rather than asking the host to know it.
    if (!STATE.projectId && !STATE.personId && STATE.applicationId && STATE.externalRef) {
      resolveProjectLink();
      return;
    }

    if (STATE.projectId) {
      STATE.selected = STATE.projectId;
    } else if (!STATE.selected) {
      STATE.selected = STATE.personId ? "personal" : STATE.projects[0] ? STATE.projects[0].id : null;
    }

    if (!root) mount();
    renderDrawer();
  }

  window.JournalWidget = { configure: applyConfig };

  var scriptTag = document.currentScript;
  if (scriptTag && scriptTag.dataset) {
    var ds = scriptTag.dataset;
    if (ds.depotUrl || ds.personId || ds.projectId || ds.externalRef) {
      applyConfig({
        depotUrl: ds.depotUrl,
        personId: ds.personId,
        projectId: ds.projectId,
        applicationId: ds.applicationId,
        externalRef: ds.externalRef,
        projects: ds.projects ? JSON.parse(ds.projects) : [],
      });
    }
  }
})();
