(function () {
  "use strict";
  var D = window.RADAR;
  if (!D) return;
  var root = document.getElementById("app"),
    state = {
      q: "",
      category: "all",
      chain: "all",
      watch: false,
      min: 0,
      sort: "value",
      gw: 0.5,
      mf: 0.6,
      scale: 1,
    };
  function formatUsd(n) {
    if (n == null) return "—";
    if (Math.abs(n) >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
    if (Math.abs(n) >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
    if (Math.abs(n) >= 1e3) return "$" + Math.round(n / 1e3) + "K";
    return "$" + Math.round(n);
  }
  function escapeText(x) {
    return String(x == null ? "—" : x).replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c];
    });
  }
  function formatPercent(n) {
    return n == null ? "—" : (n > 0 ? "+" : "") + n.toFixed(1) + "%";
  }
  function formatAge(n) {
    return n == null
      ? "unknown"
      : n >= 365
        ? (n / 365).toFixed(1) + "y"
        : n + "d";
  }
  function sandboxValue(r) {
    var g = Math.max(-60, Math.min(120, r.change_7d || 0)),
      gm = 1 + (g / 100) * state.gw,
      agev = r.age_days == null ? 365 : r.age_days,
      mat = state.mf + (Math.min(agev, 1095) / 1095) * (1 - state.mf),
      m = r.model.category_multiple * state.scale;
    return Math.max(
      1,
      Math.round(r.tvl_usd * m * gm * mat * r.model.chain_multiplier),
    );
  }
  function readRoute() {
    var h = location.hash.replace(/^#\/?/, ""),
      q = h.indexOf("?");
    var path = q < 0 ? h : h.slice(0, q),
      params = new URLSearchParams(q < 0 ? "" : h.slice(q + 1));
    if (!params.get("category")) {
      var m = path.match(/category=([^&]+)/);
      if (m) params.set("category", decodeURIComponent(m[1]));
    }
    return { path: path, params: params };
  }
  function renderHeader() {
    return '<header class="top"><div class="wrap topin"><div class="brand"><i class="mark"></i><div><strong>TOKEN RADAR</strong><span class="sub">Pre-token protocols, ranked by implied launch value</span></div></div><nav class="nav"><button onclick="location.hash=&quot;#/&quot;">Board</button><button onclick="location.hash=&quot;#/live&quot;">Already launched</button><button onclick="document.getElementById(\'method\').scrollIntoView()">Methodology</button></nav></div></header>';
  }
  function renderFooter() {
    return (
      '<footer class="footer"><span>DefiLlama snapshot as of ' +
      escapeText(D.as_of) +
      " (sealed input)</span><span>Built for make.fun token-radar-01</span></footer>"
    );
  }
  function renderSelect(name, items, value) {
    return (
      '<select id="' +
      name +
      '">' +
      items
        .map(function (x) {
          return (
            '<option value="' +
            escapeText(x[0]) +
            '" ' +
            (value === x[0] ? "selected" : "") +
            ">" +
            escapeText(x[1]) +
            "</option>"
          );
        })
        .join("") +
      "</select>"
    );
  }
  function renderBoard() {
    var h = readRoute();
    if (h.params.has("category")) state.category = h.params.get("category");
    var cats = [
        ...new Set(D.rows.map((r) => r.category || "Uncategorized")),
      ].sort(),
      chains = [...new Set(D.rows.flatMap((r) => r.chains || []))].sort();
    var rs = D.rows
      .map((r) => Object.assign({}, r, { display: sandboxValue(r) }))
      .filter(
        (r) =>
          (state.category === "all" ||
            (r.category || "Uncategorized") === state.category) &&
          (state.chain === "all" || r.chains.includes(state.chain)) &&
          (!state.watch || r.on_watchlist) &&
          r.tvl_usd >= state.min &&
          (r.name + " " + r.slug).toLowerCase().includes(state.q.toLowerCase()),
      );
    rs.sort(function (a, b) {
      var k = state.sort;
      if (k === "name") return a.name.localeCompare(b.name);
      if (k === "tvl") return b.tvl_usd - a.tvl_usd;
      if (k === "growth") return (b.change_7d ?? -999) - (a.change_7d ?? -999);
      if (k === "age") return (b.age_days ?? 0) - (a.age_days ?? 0);
      return b.display - a.display || a.slug.localeCompare(b.slug);
    });
    var total = rs.reduce((a, r) => a + r.tvl_usd, 0),
      vals = rs.map((r) => r.display).sort((a, b) => a - b),
      med = vals.length ? vals[Math.floor(vals.length / 2)] : 0,
      by = {};
    rs.forEach(
      (r) =>
        (by[r.category || "Uncategorized"] =
          (by[r.category || "Uncategorized"] || 0) + r.tvl_usd),
    );
    var topcat = Object.keys(by).sort((a, b) => by[b] - by[a])[0] || "—",
      max = Math.max.apply(null, rs.map((r) => r.display).concat([1]));
    var body = rs
      .map(
        (r) =>
          "<tr onclick=\"location.hash='#/detail/" +
          encodeURIComponent(r.slug) +
          '\'"><td class="rank">' +
          String(r.rank).padStart(2, "0") +
          '</td><td class="proto"><strong>' +
          escapeText(r.name) +
          '</strong><span class="slug">' +
          escapeText(r.slug) +
          '</span><div class="tags">' +
          escapeText(r.category || "Uncategorized") +
          " · " +
          escapeText((r.chains || []).slice(0, 3).join(", ") || "chain n/a") +
          '</div></td><td class="num">' +
          formatUsd(r.tvl_usd) +
          '</td><td class="num ' +
          ((r.change_7d || 0) >= 0 ? "positive" : "negative") +
          '">' +
          formatPercent(r.change_7d) +
          '</td><td class="num">' +
          formatAge(r.age_days) +
          '</td><td class="num"><div class="barval">' +
          formatUsd(r.display) +
          '<i class="bar" style="width:' +
          Math.max(2, Math.round((r.display / max) * 96)) +
          'px"></i></div></td><td class="open">6 steps ↗</td></tr>',
      )
      .join("");
    return (
      renderHeader() +
      '<main class="wrap"><div class="titleline"><div><div class="eyebrow">Launch value radar / ' +
      D.model_version +
      '</div><h1>Pre-token board</h1><div class="counts">Snapshot ' +
      escapeText(D.as_of) +
      " · watchlist " +
      D.watchlist_size +
      " · board " +
      D.board_size +
      " · live set " +
      D.live.length +
      '</div></div><div class="date">MODEL CLAIM · USD</div></div><div class="stats"><div class="stat"><label>Board TVL</label><strong>' +
      formatUsd(total) +
      '</strong><small>current filtered set</small></div><div class="stat"><label>Median implied</label><strong>' +
      formatUsd(med) +
      '</strong><small>display assumptions</small></div><div class="stat"><label>Top category by TVL</label><strong>' +
      escapeText(topcat) +
      "</strong><small>" +
      formatUsd(by[topcat] || 0) +
      ' represented</small></div><div class="stat"><label>Rank #1</label><strong>' +
      escapeText(D.rows[0].name) +
      "</strong><small>" +
      formatUsd(D.rows[0].implied_value_usd) +
      ' submitted value</small></div></div><div class="controls"><input id="search" placeholder="Search name or slug" value="' +
      escapeText(state.q) +
      '">' +
      renderSelect(
        "category",
        [["all", "All categories"], ...cats.map((x) => [x, x])],
        state.category,
      ) +
      renderSelect(
        "chain",
        [["all", "All chains"], ...chains.map((x) => [x, x])],
        state.chain,
      ) +
      '<label class="check"><input id="watch" type="checkbox" ' +
      (state.watch ? "checked" : "") +
      ">Watchlist only</label>" +
      renderSelect(
        "min",
        [
          ["0", "Any TVL"],
          ["50000000", "$50M+"],
          ["100000000", "$100M+"],
          ["1000000000", "$1B+"],
          ["5000000000", "$5B+"],
        ],
        String(state.min),
      ) +
      renderSelect(
        "sort",
        [
          ["value", "Implied value"],
          ["tvl", "TVL"],
          ["growth", "7-day change"],
          ["age", "Age"],
          ["name", "Name"],
        ],
        state.sort,
      ) +
      '<button id="reset">Reset</button></div><div class="sandbox"><b>Model sandbox</b><span>Recompute the display with your own assumptions — the submitted board uses the stated constants.</span><label>Growth <input id="gw" type="range" min="0" max="1" step=".05" value="' +
      state.gw +
      '"><output>' +
      state.gw.toFixed(2) +
      '</output></label><label>Maturity floor <input id="mf" type="range" min=".3" max=".8" step=".05" value="' +
      state.mf +
      '"><output>' +
      state.mf.toFixed(2) +
      '</output></label><label>Global multiple <input id="scale" type="range" min=".5" max="2" step=".05" value="' +
      state.scale +
      '"><output>' +
      state.scale.toFixed(2) +
      '×</output></label></div><div class="tablebox"><div class="tablehead"><span><b>Ranked protocols</b> · implied value desc</span><span>' +
      rs.length +
      " of " +
      D.board_size +
      " protocols</span></div><table><thead><tr><th>Rank</th><th>Protocol</th><th>TVL</th><th>7d %</th><th>Age</th><th>Implied value</th><th>Farm</th></tr></thead><tbody>" +
      body +
      "</tbody></table></div>" +
      renderMethod() +
      renderFooter() +
      "</main>"
    );
  }
  function renderMethod() {
    return (
      '<section id="method" class="section method"><h2>Methodology</h2><p>For each pre-token protocol, implied value = TVL × category median mcap/TVL × growth multiplier × maturity multiplier × chain multiplier, rounded to whole dollars. Category median uses live-token protocols in the same category when at least three qualify; otherwise it uses the overall live-token median. Multiples cap at 2.0.</p><p>Growth = 1 + clamp(7-day change, −60%, 120%) × 0.5. Maturity = 0.6 + min(age in days, 1095) / 1095 × 0.4; unknown age uses 365 days. Chain factor = 1 + 0.02 × min(chains − 1, 4). These are model constants, not forecasts.</p><p>The watchlist starts at $' +
      D.floor_usd / 1e6 +
      "M TVL and excludes wrapped, staked, bridge and exchange records under the house rule. A protocol <b>records no token</b> when its snapshot entry has no market cap, Gecko id or symbol; this is not proof. Implied value is this entry’s model, not a prediction that a token will launch.</p><p><button onclick=\"location.hash='#/live'\">Open already-launched comparables</button></p></section>"
    );
  }
  function renderDetail(slug) {
    var r = D.rows.find((x) => x.slug === slug);
    if (!r) return renderBoard();
    var peers = D.live.filter((x) => x.category === r.category).slice(0, 3),
      m = r.model,
      formula =
        formatUsd(r.tvl_usd) +
        " × " +
        m.category_multiple.toFixed(4) +
        " category × " +
        m.growth_multiplier.toFixed(3) +
        " growth × " +
        m.maturity_multiplier.toFixed(3) +
        " maturity × " +
        m.chain_multiplier.toFixed(3) +
        " chains = " +
        formatUsd(r.implied_value_usd);
    return (
      renderHeader() +
      '<main class="wrap"><button onclick="location.hash=\'#/\'">← Back to board</button><div class="titleline" style="margin-top:22px"><div><div class="eyebrow">Rank #' +
      r.rank +
      " · " +
      escapeText(r.category || "Uncategorized") +
      "</div><h1>" +
      escapeText(r.name) +
      '</h1><div class="counts">' +
      escapeText(r.slug) +
      " · " +
      escapeText((r.chains || []).join(", ")) +
      ' · snapshot records no token</div></div><div class="date">AS OF ' +
      escapeText(D.as_of) +
      '</div></div><div class="detailgrid"><div class="stat"><label>Implied value</label><strong>' +
      formatUsd(r.implied_value_usd) +
      '</strong></div><div class="stat"><label>TVL</label><strong>' +
      formatUsd(r.tvl_usd) +
      '</strong></div><div class="stat"><label>7-day change</label><strong>' +
      formatPercent(r.change_7d) +
      '</strong></div><div class="stat"><label>Tracked age</label><strong>' +
      formatAge(r.age_days) +
      '</strong></div></div><section class="section"><h2>Model breakdown · radar-2</h2><div class="formula">' +
      formula +
      '<br><small>Category multiple is derived from the sealed snapshot’s live-token market caps and TVL.</small></div></section><section class="section"><h2>Why it ranks here</h2><p>' +
      escapeText(r.name) +
      " ranks #" +
      r.rank +
      " because its " +
      formatUsd(r.tvl_usd) +
      " TVL is scaled by a " +
      m.category_multiple.toFixed(3) +
      " category multiple, " +
      m.growth_multiplier.toFixed(3) +
      " growth factor, " +
      m.maturity_multiplier.toFixed(3) +
      " maturity factor and " +
      m.chain_multiplier.toFixed(3) +
      ' chain factor. This is a model claim from the snapshot, not a launch prediction.</p></section><section class="section"><h2>Farm plan · six steps</h2><ol class="steps">' +
      r.farm_steps.map((x) => "<li>" + escapeText(x) + "</li>").join("") +
      '</ol></section><section class="section"><h2>Live comparables · ' +
      escapeText(r.category || "same category") +
      '</h2><div class="livegrid">' +
      (peers.length
        ? peers
            .map(
              (x) =>
                '<div class="livecard"><strong>' +
                escapeText(x.name) +
                "</strong><span>" +
                formatUsd(x.mcap_usd) +
                " mcap / " +
                formatUsd(x.tvl_usd) +
                " TVL</span></div>",
            )
            .join("")
        : '<div class="livecard">No same-category live comparables in the top 24.</div>') +
      "</div></section>" +
      renderMethod() +
      renderFooter() +
      "</main>"
    );
  }
  function renderLive() {
    return (
      renderHeader() +
      '<main class="wrap"><div class="titleline"><div><div class="eyebrow">Separate market view</div><h1>Already launched</h1><div class="counts">Market cap is the market’s own figure; these protocols are not ranked on the pre-token board.</div></div><button onclick="location.hash=\'#/\'">← Back to board</button></div><div class="livegrid">' +
      D.live
        .map(
          (x) =>
            '<div class="livecard"><strong>' +
            escapeText(x.name) +
            "</strong><span>" +
            escapeText(x.category || "Uncategorized") +
            " · " +
            escapeText((x.chains || []).join(", ")) +
            '</span><p class="num">' +
            formatUsd(x.mcap_usd) +
            " market cap / " +
            formatUsd(x.tvl_usd) +
            " TVL</p></div>",
        )
        .join("") +
      "</div>" +
      renderFooter() +
      "</main>"
    );
  }
  function attachControls() {
    var q = document.getElementById("search");
    if (q)
      q.oninput = function () {
        state.q = this.value;
        renderRoute();
      };
    [
      ["category", "category"],
      ["chain", "chain"],
      ["min", "min"],
      ["sort", "sort"],
    ].forEach(function (pair) {
      var x = document.getElementById(pair[0]);
      if (x)
        x.onchange = function () {
          state[pair[1]] = pair[0] === "min" ? Number(this.value) : this.value;
          renderRoute();
        };
    });
    var w = document.getElementById("watch");
    if (w)
      w.onchange = function () {
        state.watch = this.checked;
        renderRoute();
      };
    [
      ["gw", "gw"],
      ["mf", "mf"],
      ["scale", "scale"],
    ].forEach(function (p) {
      var x = document.getElementById(p[0]);
      if (x)
        x.oninput = function () {
          state[p[1]] = Number(this.value);
          renderRoute();
        };
    });
    var reset = document.getElementById("reset");
    if (reset)
      reset.onclick = function () {
        state = {
          q: "",
          category: "all",
          chain: "all",
          watch: false,
          min: 0,
          sort: "value",
          gw: 0.5,
          mf: 0.6,
          scale: 1,
        };
        location.hash = "#/";
        renderRoute();
      };
  }
  function renderRoute() {
    var x = readRoute();
    root.innerHTML =
      x.path.indexOf("detail/") === 0
        ? renderDetail(decodeURIComponent(x.path.slice(7)))
        : x.path === "live"
          ? renderLive()
          : renderBoard();
    attachControls();
  }
  window.addEventListener("hashchange", renderRoute);
  renderRoute();
})();
