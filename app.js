/* PC Software Shop v1 — English edition. Flat $1 per paid product. */
(function () {
  "use strict";
  function fmtSize(b) {
    b = +b || 0;
    if (b >= 1 << 30) return (b / (1 << 30)).toFixed(1) + " GB";
    if (b >= 1 << 20) return Math.round(b / (1 << 20)) + " MB";
    if (b >= 1 << 10) return Math.round(b / (1 << 10)) + " KB";
    return b + " B";
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtPrice(p) {
    return p.free ? "Free" : "$" + (p.p || PRICE_USD);
  }

  var CATS = [
    ["all", "All", null],
    ["free", "Free", "FREE"],
    ["win", "Windows / Office", ["windows", "office", "kms", "activator", "winrar"]],
    ["adobe", "Adobe", ["adobe"]],
    ["va", "Video & Audio", ["video", "audio", "music", "filmora", "camtasia", "obs", "fl studio", "ableton"]],
    ["photo", "Photo & Graphics", ["photo", "photoshop", "lightroom", "graphic", "design", "luminar", "topaz"]],
    ["util", "Utilities", ["driver", "vpn", "antivirus", "downloader", "idm", "rufus", "cleaner", "backup"]],
    ["other", "Other", null]
  ];
  function catOf(name) {
    var n = (name || "").toLowerCase();
    for (var i = 2; i < CATS.length - 1; i++) {
      var kws = CATS[i][2];
      for (var j = 0; j < kws.length; j++) {
        if (n.indexOf(kws[j]) !== -1) return CATS[i][0];
      }
    }
    return "other";
  }

  var CAT_COLORS = {
    all: "#35c5d8", free: "#ffd84d", win: "#4da3ff", adobe: "#ff6b6b",
    va: "#c586ff", photo: "#ffb84d", util: "#4dd08a", other: "#9db2c4"
  };
  function catLabel(key) {
    for (var i = 0; i < CATS.length; i++) if (CATS[i][0] === key) return CATS[i][1];
    return key;
  }

  var DATA = null, state = { q: "", cat: "all", shown: 0 };
  var PAGE = 60;
  var view = document.getElementById("view");
  var tabs = document.getElementById("catTabs");
  var qInput = document.getElementById("q");

  CATS.forEach(function (c, i) {
    var b = document.createElement("button");
    b.textContent = c[1];
    b.dataset.cat = c[0];
    b.style.setProperty("--catc", CAT_COLORS[c[0]]);
    if (i === 0) b.className = "active";
    b.onclick = function () {
      state.cat = c[0]; state.shown = 0;
      Array.prototype.forEach.call(tabs.children, function (x) {
        x.classList.toggle("active", x === b);
      });
      renderList();
    };
    tabs.appendChild(b);
  });

  function filtered() {
    var q = state.q.trim().toLowerCase();
    var toks = q.split(/\s+/).filter(Boolean);
    var list = DATA.products.filter(function (p) {
      if (state.cat === "free") {
        if (!p.free) return false;
      } else {
        if (p.free) return false;
        if (state.cat !== "all" && catOf(p.n) !== state.cat) return false;
      }
      if (state.cat === "all" && !toks.length && !p.latest) return false;
      if (state.cat === "free" && !toks.length && !p.frep) return false;
      if (!toks.length) return true;
      var hay = p.n.toLowerCase();
      return toks.every(function (t) { return hay.indexOf(t) !== -1; });
    });
    if (state.cat === "all" || state.cat === "free") {
      list.sort(function (a, b) {
        return (b.pop - a.pop) || (b.s - a.s);
      });
    }
    return list;
  }

  function thumbHtml(p, cls) {
    cls = cls || "thumb";
    if (p.cover) {
      return '<img class="' + cls + ' cover" src="' + esc(p.cover) +
        '" alt="" loading="lazy" onerror="this.outerHTML=\'<span class=&quot;' + cls + ' fallback&quot;>💿</span>\'">';
    }
    if (p.i) {
      return '<img class="' + (cls || "thumb") + '" src="' + esc(p.i) +
        '" alt="" loading="lazy" onerror="this.outerHTML=\'<span class=&quot;' + (cls || "thumb") + ' fallback&quot;>💿</span>\'">';
    }
    return '<span class="' + (cls || "thumb") + ' fallback">💿</span>';
  }

  // --- Website cart -----------------------------------------------------
  // Paid items collect in the browser, then checkout hands them to the
  // bot in batches: Telegram's ?start= payload caps at 64 chars, and one
  // product id packs into 8 base64url chars, so ~7 items ride per link.
  // Free items skip the cart — their 🆓 button delivers them directly.
  var CART_KEY = "leo_cart_v1", SENT_KEY = "leo_cart_sent_v1";
  var BATCH_N = 7;
  var cartJustSent = false;
  function cartLoad(key, dflt) {
    try { return JSON.parse(localStorage.getItem(key)) || dflt; }
    catch (e) { return dflt; }
  }
  function cartSave(key, v) {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {}
  }
  function cartItems() { return cartLoad(CART_KEY, []); }
  function cartSent() { return cartLoad(SENT_KEY, []); }
  function cartPending() {
    var sent = {};
    cartSent().forEach(function (id) { sent[id] = 1; });
    return cartItems().filter(function (it) { return !sent[it.id]; });
  }
  function cartTotal() {
    return cartItems().reduce(function (a, it) { return a + (+it.price || 0); }, 0);
  }
  function updateCartBadge() {
    var b = document.getElementById("cartBadge");
    if (!b) return;
    var n = cartItems().length;
    b.textContent = n ? String(n) : "";
    b.style.display = n ? "inline-flex" : "none";
  }
  function flashBtn(btn, txt) {
    if (!btn) return;
    var old = btn.textContent;
    btn.textContent = txt;
    setTimeout(function () { btn.textContent = old; }, 1200);
  }
  window.addToCart = function (id, btn) {
    var p = null;
    for (var i = 0; i < DATA.products.length; i++) {
      if (DATA.products[i].id === id) { p = DATA.products[i]; break; }
    }
    if (!p || p.free) return;
    var items = cartItems();
    for (var j = 0; j < items.length; j++) {
      if (items[j].id === id) { flashBtn(btn, "✓ In cart"); return; }
    }
    items.push({ id: p.id, name: p.n, price: +(p.p || PRICE_USD),
                 files: p.c, cover: p.cover || "", size: p.s || 0 });
    cartSave(CART_KEY, items);
    updateCartBadge();
    flashBtn(btn, "✓ Added");
  };
  window.cartRemove = function (id) {
    cartSave(CART_KEY,
             cartItems().filter(function (it) { return it.id !== id; }));
    cartSave(SENT_KEY,
             cartSent().filter(function (x) { return x !== id; }));
    updateCartBadge();
    renderCartPage();
  };
  window.cartClearAll = function () {
    cartSave(CART_KEY, []);
    cartSave(SENT_KEY, []);
    updateCartBadge();
    renderCartPage();
  };
  // a batch the buyer tapped but never finished in the bot can be
  // re-sent: unlock those items so the checkout button comes back
  window.cartUnlockSent = function () {
    cartSave(SENT_KEY, []);
    updateCartBadge();
    renderCartPage();
  };
  function pidChunk(pid) {
    var bytes = pid.match(/.{2}/g).map(function (h) {
      return parseInt(h, 16);
    });
    var bin = "";
    for (var i = 0; i < bytes.length; i++) {
      bin += String.fromCharCode(bytes[i]);
    }
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_")
      .replace(/=+$/, "");
  }
  function cartBatchURL(batch, total) {
    var blob = batch.map(function (it) { return pidChunk(it.id); }).join("");
    return "https://t.me/" + BOT_USERNAME + "?start=w" + total + "-" + blob;
  }
  window.cartCheckoutSent = function () {
    // mark the batch on the clicked link as handed to the bot; when that
    // was the last batch, the site cart has done its job (the bot keeps
    // the real cart), so clear it — the returning buyer starts fresh.
    var sent = cartSent();
    cartPending().slice(0, BATCH_N).forEach(function (it) {
      if (sent.indexOf(it.id) === -1) sent.push(it.id);
    });
    cartSave(SENT_KEY, sent);
    if (!cartPending().length) {
      cartSave(CART_KEY, []);
      cartSave(SENT_KEY, []);
      cartJustSent = true;
    }
    setTimeout(renderCartPage, 500);
  };

  function renderCartPage() {
    var items = cartItems(), pending = cartPending();
    updateCartBadge();
    var html = '<a class="back" href="#/">← Back</a>' +
      '<h2 class="section-title">🧺 Cart</h2>';
    if (!items.length) {
      if (cartJustSent) {
        cartJustSent = false;
        html += '<div class="dbox">✅ Your items were sent to the Telegram ' +
          "bot — this cart is cleared. Pay in the bot to get your " +
          "files.</div>" +
          '<a class="checkoutbtn" href="https://t.me/' + BOT_USERNAME +
          '" target="_blank" rel="noopener">Open the Telegram bot</a>';
      } else {
        html += '<div class="empty">Your cart is empty.<br>Pick a ' +
          "software and tap ＋ Cart.</div>";
      }
    } else {
      var sentMap = {};
      cartSent().forEach(function (id) { sentMap[id] = 1; });
      html += '<div class="res-list">' + items.map(function (it) {
        var tail = sentMap[it.id]
          ? '<span class="sent-tag">✅ Sent to bot</span>'
          : '<div class="rprice">$' + (+it.price || 0) + "</div>" +
            '<button class="rmbtn" onclick="window.cartRemove(\'' +
            it.id + '\')" aria-label="Remove">✕</button>';
        var thumb = it.cover
          ? '<img class="rthumb cover" src="' + esc(it.cover) + '" alt="" ' +
            'loading="lazy" onerror="this.outerHTML=\'<span ' +
            'class=&quot;rthumb fallback&quot;>💿</span>\'">'
          : '<span class="rthumb fallback">💿</span>';
        return '<div class="res-item">' + thumb +
          '<div class="rbody"><div class="rname">' + esc(it.name) +
          '</div><div class="rmeta">' + (it.files || 0) + " files · " +
          esc(fmtSize(it.size)) + "</div></div>" + tail + "</div>";
      }).join("") + "</div>";
      html += '<div class="carttotal">Total: <b>$' + cartTotal() +
        "</b> (" + items.length + " item" +
        (items.length === 1 ? "" : "s") + ")</div>";
      if (pending.length) {
        var batch = pending.slice(0, BATCH_N);
        var label = pending.length > batch.length
          ? "Checkout in Telegram (first " + batch.length + " items)"
          : "Checkout in Telegram";
        html += '<a class="checkoutbtn" href="' +
          cartBatchURL(batch, items.length) +
          '" target="_blank" rel="noopener" ' +
          'onclick="window.cartCheckoutSent()">' + label + "</a>";
        if (pending.length > batch.length) {
          html += '<div class="buy-note">Large cart — items are sent in ' +
            "batches. After opening the bot, come back here and tap " +
            "Checkout again for the next batch.</div>";
        }
        html += '<button class="clearbtn" onclick="window.cartClearAll()">' +
          "🧺 Clear the whole cart</button>";
      } else {
        html += '<div class="dbox">✅ Everything has been sent to the ' +
          "Telegram bot. Pay there to get your files.</div>" +
          '<a class="checkoutbtn" href="https://t.me/' + BOT_USERNAME +
          '" target="_blank" rel="noopener">Open the Telegram bot</a>' +
          '<button class="clearbtn" onclick="window.cartUnlockSent()">' +
          "↩️ Item didn't arrive? Resend to the bot</button>" +
          '<button class="clearbtn" onclick="window.cartClearAll()">' +
          "🧺 Clear the whole cart</button>";
      }
    }
    view.innerHTML = html;
    window.scrollTo(0, 0);
  }

  function cardHtml(p) {
    var linkUrl = "https://t.me/" + BOT_USERNAME + "?start=" +
      (p.free ? "free_" : "buy_") + p.id;
    var btn = p.free
      ? '<a class="buy free" href="' + linkUrl + '" target="_blank" rel="noopener">🆓 Get it free</a>'
      : '<a class="buy" href="' + linkUrl + '" target="_blank" rel="noopener">Buy 🛒</a>';
    var addBtn = p.free ? "" :
      '<button class="cadd" type="button" onclick="window.addToCart(\'' +
      p.id + '\',this)">＋ Cart</button>';
    var teaser = p.d ? '<div class="teaser">' + esc(p.d) + "</div>" : "";
    var ck = p.free ? "free" : catOf(p.n);
    var chip = '<span class="catchip" style="background:' + CAT_COLORS[ck] + '">' +
      esc(catLabel(ck)) + "</span>";
    var dl = DL[p.id];
    var dlnote = typeof dl === "number"
      ? ' <span class="dlc">⬇ ' + dl + " downloads</span>" : "";
    return '<div class="card" data-pid="' + p.id + '">' +
      '<div class="chead">' + thumbHtml(p) +
      "<h3>" + esc(p.n) + '</h3><span class="chev">›</span></div>' +
      teaser +
      '<div class="cmeta">' + chip + p.c + " files · " + esc(fmtSize(p.s)) +
      dlnote + "</div>" +
      '<div class="crow"><span class="price">' + fmtPrice(p) + "</span>" +
      '<span class="cactions">' + addBtn + btn + "</span></div>" +
      "</div>";
  }

  var heroTimer = null;
  function heroHtml() {
    var cands = DATA.products.filter(function (p) { return p.cover; });
    if (!cands.length) return "";
    cands.sort(function (a, b) { return (b.pop - a.pop) || (b.s - a.s); });
    var slides = cands.slice(0, 5);
    function slide(p) {
      var linkUrl = "https://t.me/" + BOT_USERNAME + "?start=" +
        (p.free ? "free_" : "buy_") + p.id;
      var btn = p.free
        ? '<a class="buy free" href="' + linkUrl + '" target="_blank" rel="noopener">🆓 Get it free</a>'
        : '<a class="buy" href="' + linkUrl + '" target="_blank" rel="noopener">Buy 🛒</a>';
      var teaser = p.d ? '<div class="hero-d">' + esc(p.d) + "</div>" : "";
      return '<div class="hero-slide" data-pid="' + p.id + '">' +
        '<img class="hero-img" src="' + esc(p.cover) + '" alt="" loading="lazy">' +
        '<div class="hero-body"><div class="hero-tag">⭐ Featured</div>' +
        "<h2>" + esc(p.n) + "</h2>" + teaser +
        '<div class="crow"><span class="price">' + fmtPrice(p) + "</span>" +
        '<span class="cactions">' +
        (p.free ? "" : '<button class="cadd" type="button" onclick="event.stopPropagation();window.addToCart(\'' +
          p.id + '\',this)">＋ Cart</button>') + btn + "</span></div>" +
        "</div></div>";
    }
    var dots = "";
    slides.forEach(function (_, i) {
      dots += '<button class="hero-dot' + (i === 0 ? " on" : "") +
        '" type="button" data-i="' + i + '" aria-label="slide ' + (i + 1) + '"></button>';
    });
    return '<div class="hero-slider"><div class="hero-track" id="heroTrack">' +
      slides.map(slide).join("") + "</div>" +
      '<button class="hero-nav prev" type="button" id="heroPrev">‹</button>' +
      '<button class="hero-nav next" type="button" id="heroNext">›</button>' +
      '<div class="hero-dots">' + dots + "</div></div>";
  }

  function initHero() {
    var track = document.getElementById("heroTrack");
    if (!track || track.children.length < 2) return;
    var slides = track.children.length, idx = 0;
    var dots = track.parentElement.querySelectorAll(".hero-dot");
    function go(i) {
      idx = (i + slides) % slides;
      track.style.transform = "translateX(-" + idx * 100 + "%)";
      Array.prototype.forEach.call(dots, function (d, j) {
        d.classList.toggle("on", j === idx);
      });
    }
    function auto() {
      clearInterval(heroTimer);
      heroTimer = setInterval(function () {
        if (!document.body.contains(track)) { clearInterval(heroTimer); return; }
        go(idx + 1);
      }, 4500);
    }
    var prev = document.getElementById("heroPrev");
    var next = document.getElementById("heroNext");
    if (prev) prev.onclick = function () { go(idx - 1); auto(); };
    if (next) next.onclick = function () { go(idx + 1); auto(); };
    Array.prototype.forEach.call(dots, function (d) {
      d.onclick = function () { go(+d.dataset.i); auto(); };
    });
    var x0 = null;
    track.addEventListener("touchstart", function (e) {
      x0 = e.touches[0].clientX;
    }, { passive: true });
    track.addEventListener("touchend", function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) { go(idx + (dx < 0 ? 1 : -1)); auto(); }
      x0 = null;
    }, { passive: true });
    auto();
  }

  function renderList() {
    var list = filtered();
    state.shown = Math.min(state.shown || PAGE, list.length) || Math.min(PAGE, list.length);
    var html = (state.cat === "all" && !state.q.trim()) ? heroHtml() : "";
    html += '<div class="count">' + list.length + " products found</div>";
    if (!list.length) {
      html += '<div class="empty">Nothing found 😅<br>Try searching the software name in English.</div>';
    } else {
      html += '<div class="grid">';
      for (var i = 0; i < state.shown; i++) html += cardHtml(list[i]);
      html += "</div>";
      if (state.shown < list.length) {
        html += '<button class="more" id="moreBtn">Show more (' +
          (list.length - state.shown) + " left)</button>";
      }
    }
    view.innerHTML = html;
    initHero();
    view.onclick = function (e) {
      if (e.target.closest(".buy")) return; // Buy button -> Telegram, not detail
      var card = e.target.closest(".card, .hero-slide");
      if (card && card.getAttribute("data-pid")) {
        location.hash = "#/p/" + card.getAttribute("data-pid");
      }
    };
    var more = document.getElementById("moreBtn");
    if (more) more.onclick = function () {
      state.shown = Math.min(state.shown + PAGE, list.length);
      renderList();
    };
    view.scrollIntoView();
  }

  window.toggleFiles = function (btn) {
    var u = btn.nextElementSibling;
    var show = u.style.display === "none";
    u.style.display = show ? "" : "none";
    btn.textContent = show ? "📁 Hide files" : "📁 Show files";
  };

  function renderDetail(pid) {
    view.innerHTML = '<div class="count">Loading…</div>';
    fetch("data/products/" + pid + ".json")
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (d) {
        var rows = d.items.map(function (f) {
          return "<li><span>" + esc(f.n) + '</span><span class="fs">' +
            esc(fmtSize(f.s)) + "</span></li>";
        }).join("");
        var icon = "";
        if (DATA) {
          for (var i = 0; i < DATA.products.length; i++) {
            if (DATA.products[i].id === pid) {
              icon = thumbHtml(DATA.products[i], "thumb big");
              break;
            }
          }
        }
        var vers = "";
        if (d.vers && d.vers.length) {
          vers = '<div class="vers"><div class="vers-t">Other versions</div>' +
            d.vers.map(function (v) {
              return '<a href="#/p/' + v.id + '">' + esc(v.n) + "</a>";
            }).join("") + "</div>";
        }
        view.innerHTML =
          '<a class="back" href="#/">← Back</a>' +
          '<div class="detail"><div class="chead">' + icon +
          "<h2>" + esc(d.name) + "</h2></div>" +
          '<div class="dbox">' + d.count + " files · total <b>" +
          esc(fmtSize(d.size)) + "</b></div>" +
          '<button class="ftoggle" type="button" onclick="toggleFiles(this)">📁 Show files</button>' +
          '<ul class="flist" style="display:none">' + rows + "</ul>" +
          vers +
          (d.free
            ? '<div class="buyrow"><span class="price" style="font-size:18px">Free</span>' +
              '<a class="buy big free" href="https://t.me/' + BOT_USERNAME + "?start=free_" + d.id +
              '" target="_blank" rel="noopener">🆓 Download free</a></div>'
            : '<div class="buyrow"><span class="price" style="font-size:18px">$' +
              (d.price || PRICE_USD) + "</span>" +
              '<span class="cactions">' +
              '<button class="cadd big2" type="button" onclick="window.addToCart(\'' +
              d.id + '\',this)">＋ Cart</button>' +
              '<a class="buy big" href="' + esc(d.buy_url) +
              '" target="_blank" rel="noopener">Buy 🛒</a></span></div>') +
          '<div class="note">Tapping Buy opens our Telegram bot. ' +
          "Or collect items with ＋ Cart and check out once from the 🧺 " +
          "Cart button above. " +
          "We accept crypto payments only — pay with USDT, USDC, USDe, USD1, BNB, ETH, XRP, TON, BTC or TRX " +
          "and receive your files right in the chat.</div></div>";
        window.scrollTo(0, 0);
      })
      .catch(function () {
        view.innerHTML = '<a class="back" href="#/">← Back</a>' +
          '<div class="empty">Software not found.</div>';
      });
  }

  // --- downloads data (seed + brokered real counts) --------------------
  var DL = {};
  function applyDownloads(d) {
    DL = {};
    var pl = (DATA && DATA.products) || [];
    var byId = {};
    pl.forEach(function (p) { byId[p.id] = p; });
    // seed: deterministic base per product (kept under 100), same
    // algorithm as the Myanmar software store.
    pl.forEach(function (p) {
      var seed = 0;
      if (p.latest) seed = 55 + (pidSeed(p.id) % 40);
      else if (p.pop >= 4) seed = 35 + (pidSeed(p.id) % 25);
      else if (p.pop >= 2) seed = 15 + (pidSeed(p.id) % 20);
      else seed = 5 + (pidSeed(p.id) % 12);
      DL[p.id] = seed;
    });
    Object.keys(d || {}).forEach(function (pid) {
      DL[pid] = (DL[pid] || 0) + (+d[pid] || 0);
    });
    var h = (location.hash || "#/").slice(1);
    if ((h === "" || h === "/") && state.cat === "all" && !state.q.trim()) {
      renderList();
    }
  }

  function route() {
    var h = location.hash || "#/";
    if (h === "#/cart") { renderCartPage(); return; }
    var m = h.match(/^#\/p\/([0-9a-f]+)$/);
    if (m) renderDetail(m[1]);
    else {
      if (!state.shown) state.shown = PAGE;
      renderList();
    }
  }

  function listHash() {
    var h = (location.hash || "#/").slice(1);
    return h === "" || h === "/";
  }

  document.getElementById("searchForm").addEventListener("submit", function (e) {
    e.preventDefault();
    state.q = qInput.value; state.shown = PAGE;
    if ((location.hash || "#/") !== "#/") location.hash = "#/";
    else renderList();
  });
  qInput.addEventListener("input", function () {
    state.q = qInput.value; state.shown = PAGE;
    if (DATA && (location.hash || "#/") === "#/") renderList();
  });
  window.addEventListener("hashchange", route);

  fetch("data/products.json")
    .then(function (r) { return r.json(); })
    .then(function (d) { DATA = d; route(); })
    .catch(function () {
      view.innerHTML = '<div class="empty">Could not load data. Please try again shortly.</div>';
    });
  updateCartBadge();
  fetch("data/downloads.json")
    .then(function (r) { if (!r.ok) throw 0; return r.json(); })
    .then(applyDownloads)
    .catch(function () { applyDownloads({}); });
})();
