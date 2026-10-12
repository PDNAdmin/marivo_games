/* MARIVO site, v3. GSAP + ScrollTrigger drive the motion, Lenis smooths the scroll.
   Everything still works if a library fails to load or the visitor has "reduce motion" on:
   the page just appears without animation, and How to Play becomes a simple swipe-through. */
(function () {
  "use strict";

  var root = document.documentElement;
  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var animate = !!gsap && !!ScrollTrigger && !reduce;
  if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  // Put the wedding car wherever the page asks for one
  var carTpl = $("#car-tpl");
  if (carTpl) $$("[data-car]").forEach(function (slot) { slot.appendChild(carTpl.content.cloneNode(true)); });

  /* ---------- smooth scrolling (Lenis) ---------- */
  var lenis = null;
  if (animate && window.Lenis) {
    lenis = new window.Lenis({ duration: 1.1, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  }
  function scrollToY(y, instant) {
    if (lenis) lenis.scrollTo(y, { immediate: !!instant, duration: 1.1 });
    else window.scrollTo({ top: y, behavior: instant || reduce ? "auto" : "smooth" });
  }
  // Menu and in-page links glide to their section
  document.addEventListener("click", function (e) {
    var link = e.target.closest('a[href^="#"]');
    if (!link) return;
    var target = link.getAttribute("href").length > 1 && $(link.getAttribute("href"));
    if (!target) return;
    e.preventDefault();
    scrollToY(target.getBoundingClientRect().top + window.scrollY - (target.id === "top" ? 0 : 8));
    history.replaceState(null, "", link.getAttribute("href"));
  });

  /* ---------- menu ---------- */
  (function () {
    var nav = $("#nav"), btn = $(".nav__toggle"), menu = $("#menu");
    if (!nav || !btn || !menu) return;

    function setOpen(open) {
      menu.dataset.open = String(open);
      btn.setAttribute("aria-expanded", String(open));
      btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      if (open && animate) gsap.fromTo($$("li", menu), { x: -24, autoAlpha: 0, rotation: -3 }, { x: 0, autoAlpha: 1, rotation: 0, duration: 0.45, ease: "back.out(1.6)", stagger: 0.045, overwrite: true });
    }
    btn.addEventListener("click", function () { setOpen(menu.dataset.open !== "true"); });
    menu.addEventListener("click", function (e) { if (e.target.closest("a")) setOpen(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") setOpen(false); });

    // Hide the bar when scrolling down, bring it back when scrolling up
    var lastY = window.scrollY, ticking = false;
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var y = window.scrollY;
        var down = y > lastY + 4 && y > 240;
        var up = y < lastY - 4;
        if (down && menu.dataset.open !== "true") nav.classList.add("is-hidden");
        else if (up || y <= 240) nav.classList.remove("is-hidden");
        lastY = y;
        ticking = false;
      });
    }, { passive: true });
  })();

  /* ---------- headings: split into words so they can rise in one by one ---------- */
  if (animate) {
    $$("[data-split]").forEach(function (el) {
      var text = el.textContent.trim();
      el.setAttribute("aria-label", text);
      el.innerHTML = text.split(/\s+/).map(function (w) {
        return '<span class="w" aria-hidden="true"><span>' + w + "</span></span>";
      }).join(" ");
    });
  }

  /* ---------- hero entrance ---------- */
  function intro() {
    if (!animate) return;
    gsap.timeline({ defaults: { ease: "power3.out" } })
      .from("#hero-copy h1 .w > span", { yPercent: 118, duration: 1.1, ease: "power4.out", stagger: 0.07 }, 0)
      .from(".board__img", { scale: 0.6, autoAlpha: 0, duration: 1.3, ease: "back.out(1.4)" }, 0.1)
      .from("#hero-copy [data-in], .tour__hint", { y: 28, autoAlpha: 0, duration: 0.9, stagger: 0.1 }, 0.3)
      .from(".tour .float", { scale: 0, autoAlpha: 0, duration: 1, ease: "back.out(1.7)", stagger: 0.08 }, 0.5)
      .from(".tour .pat", { autoAlpha: 0, duration: 1.6 }, 0.2);
  }

  /* ---------- loader: two dice land, then the wedding car drives across the board ---------- */
  (function () {
    var loader = $("#loader");
    function done() {
      if (loader) loader.classList.add("is-done");
      root.classList.remove("is-loading");
      if (lenis) lenis.start();
      if (ScrollTrigger) ScrollTrigger.refresh();
    }
    if (!loader || !animate) { done(); return; }

    var seen = false;
    try { seen = sessionStorage.getItem("marivo-loaded") === "1"; sessionStorage.setItem("marivo-loaded", "1"); } catch (e) {}

    var dice = $("#loader-dice"), dies = $$(".die", dice), board = $("#loader-board"), car = $("#loader-car");
    var text = $(".loader__text", loader), pct = $("#loader-pct"), scene = $("#loader-scene");
    var PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
    function face(die, value) { $$("i", die).forEach(function (pip, i) { pip.classList.toggle("on", PIPS[value].indexOf(i) !== -1); }); }
    var firstScreen = false, waiting = false, finished = false;
    var T = seen ? 2.0 : 3.2; // seconds for the count from 0 to 100. Shorter on later pages in the same visit.
    var count = { v: 0 };
    function W() { return scene.offsetWidth; }

    root.classList.add("is-loading");
    if (lenis) lenis.stop();

    // 0 to 100. The dice land in the first quarter, the board arrives, and the car drives across it for the rest.
    var tumble = setInterval(function () { dies.forEach(function (d) { face(d, 1 + Math.floor(Math.random() * 6)); }); }, 60);
    var tl = gsap.timeline({ onComplete: finish });
    tl.to(count, { v: 100, duration: T, ease: "none", onUpdate: function () { pct.textContent = Math.round(count.v); } }, 0)
      .fromTo(dies, { y: -220, rotation: function (i) { return i ? 260 : -260; }, autoAlpha: 0 }, { y: 0, rotation: 0, autoAlpha: 1, duration: T * 0.2, ease: "bounce.out", stagger: 0.08 }, 0)
      .add(function () { clearInterval(tumble); face(dies[0], 6); face(dies[1], 6); }, T * 0.24)
      .to(dies, { scale: 1.12, duration: 0.1, yoyo: true, repeat: 1 }, T * 0.24)
      .to(dice, { scale: 0.3, autoAlpha: 0, duration: T * 0.08, ease: "power2.in" }, T * 0.36)
      .fromTo(board, { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: T * 0.1, ease: "back.out(1.7)" }, T * 0.38)
      .add(function () { car.classList.add("is-driving"); }, T * 0.46)
      .fromTo(car, { x: function () { return -W() * 0.95; }, autoAlpha: 1 }, { x: function () { return W() * 0.55; }, duration: T * 0.54, ease: "none" }, T * 0.46)
      // near the end, hold the count until the first screen can be drawn (the board picture and the fonts)
      .add(function () { if (!firstScreen) { waiting = true; tl.pause(); } }, T * 0.9);

    function firstScreenReady() { if (firstScreen) return; firstScreen = true; if (waiting) { waiting = false; tl.play(); } }
    var needs = [board.decode ? board.decode().catch(function () {}) : Promise.resolve()];
    if (document.fonts && document.fonts.ready) needs.push(document.fonts.ready);
    Promise.all(needs).then(firstScreenReady);
    setTimeout(firstScreenReady, 4000);

    // at 100 the car drives off and the page comes up behind it
    function finish() {
      if (finished) return;
      finished = true;
      pct.textContent = "100";
      gsap.timeline({ onComplete: done })
        .to(car, { x: window.innerWidth, duration: 0.35, ease: "power2.in" })
        .to([board, text, pct.parentNode], { autoAlpha: 0, duration: 0.2 }, "-=0.15")
        .to(loader, { yPercent: -100, duration: 0.5, ease: "power4.inOut" }, "-=0.2")
        .add(intro, "-=0.35");
    }
    setTimeout(finish, 8000); // never leave anyone stuck on the loader
  })();

  /* ---------- scroll motion ---------- */
  if (animate) {
    // The opening. The board starts tilted beside the headline. Scrolling turns it flat, then rotates it
    // one side at a time while the game piece walks along each side and a caption names that part of the wedding.
    (function () {
      var tour = $("#top"), stage = $("#tour-stage"), board = $("#board"), tilt = $("#board-tilt");
      var piece = $("#tour-piece"), copy = $("#hero-copy"), hint = $(".tour__hint");
      var caps = $$("#tour-caps .cap"), floats = $$(".tour .float");
      if (!tour || !board || caps.length < 5) return;

      // the board breathes a little while it waits
      gsap.to(".board__img", { y: -10, duration: 2.6, ease: "sine.inOut", repeat: -1, yoyo: true });

      gsap.matchMedia().add({ wide: "(min-width: 900px)", narrow: "(max-width: 899px)" }, function (ctx) {
        var wide = ctx.conditions.wide;
        tour.classList.add("is-tour");
        var size = function () { return board.offsetWidth; };

        gsap.set(caps, { autoAlpha: 0, y: 34 });
        gsap.set(piece, { autoAlpha: 0, x: function () { return size() * 0.04; } });

        var tl = gsap.timeline({
          defaults: { ease: "power2.inOut" },
          scrollTrigger: {
            // the section is tall and its stage is sticky (CSS), so nothing is ever taken out of the page
            trigger: tour, start: "top top", end: "bottom bottom", scrub: 0.7, invalidateOnRefresh: true
          }
        });

        // 1. the headline leaves, the board comes to the centre and lies flat
        tl.to(copy, { autoAlpha: 0, y: -70, duration: 0.8 }, 0)
          .to(floats, { autoAlpha: 0, scale: 0.5, duration: 0.7, stagger: 0.04 }, 0)
          .to(hint, { autoAlpha: 0, duration: 0.3 }, 0)
          .fromTo(board, {
            x: function () { return wide ? window.innerWidth * 0.23 : 0; },
            y: function () { return window.innerHeight * (wide ? 0.07 : 0.34); },
            scale: wide ? 1.1 : 0.84
          }, { x: 0, y: 0, scale: 1, duration: 1 }, 0)
          .fromTo(tilt, { rotationX: 54, rotation: -24 }, { rotationX: 0, rotation: 0, duration: 1 }, 0)
          .to(piece, { autoAlpha: 1, duration: 0.3 }, 0.8)
          .to(caps[0], { autoAlpha: 1, y: 0, duration: 0.45 }, 0.8);

        // 2. four sides: walk the side, then turn the board to bring the next one round
        var t = 1.1;
        for (var i = 0; i < 4; i++) {
          tl.to(piece, { x: function () { return size() * 0.8; }, duration: 1.3, ease: "none" }, t);
          t += 1.3;
          tl.to(caps[i], { autoAlpha: 0, y: -34, duration: 0.35 }, t)
            .to(tilt, { rotation: (i + 1) * 90, duration: 0.8 }, t)
            .to(piece, i < 3 ? { x: function () { return size() * 0.04; }, duration: 0.8 } : { autoAlpha: 0, duration: 0.3 }, t)
            .to(caps[i + 1], { autoAlpha: 1, y: 0, duration: 0.45 }, t + 0.45);
          t += 0.8;
        }
        // 3. the board leans back for the last caption: how you win
        tl.to(tilt, { rotationX: 34, duration: 0.8 }, t - 0.8)
          .to({}, { duration: 0.7 });

        return function () {
          tour.classList.remove("is-tour");
          gsap.set([board, tilt, piece, copy, hint].concat(caps, floats), { clearProps: "all" });
        };
      });
    })();

    // Objects lean away from the mouse (desktop only)
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      var movers = $$(".tour .float").map(function (el) {
        return { depth: parseFloat(el.dataset.depth || "0.5"), x: gsap.quickTo(el, "x", { duration: 0.9, ease: "power3.out" }), y: gsap.quickTo(el, "y", { duration: 0.9, ease: "power3.out" }) };
      });
      $("#top").addEventListener("pointermove", function (e) {
        var dx = e.clientX / window.innerWidth - 0.5, dy = e.clientY / window.innerHeight - 0.5;
        movers.forEach(function (m) { m.x(dx * -40 * m.depth); m.y(dy * -26 * m.depth); });
      });
    }

    // Background patterns drift more slowly than the page
    $$(".pat").forEach(function (el) {
      gsap.fromTo(el, { yPercent: -7 }, { yPercent: 7, ease: "none", scrollTrigger: { trigger: el.parentNode, start: "top bottom", end: "bottom top", scrub: true } });
    });

    // Headings rise in word by word
    $$("[data-split]").forEach(function (el) {
      gsap.from($$(".w > span", el), {
        yPercent: 118, duration: 0.95, ease: "power4.out", stagger: 0.06,
        scrollTrigger: { trigger: el, start: "top 90%", once: true }
      });
    });

    // Everything else follows the heading up
    gsap.set("[data-reveal]", { y: 36, autoAlpha: 0 });
    ScrollTrigger.batch("[data-reveal]", {
      start: "top 90%", once: true,
      onEnter: function (batch) { gsap.to(batch, { y: 0, autoAlpha: 1, duration: 0.9, ease: "power3.out", stagger: 0.08, delay: 0.12, overwrite: true }); }
    });

    gsap.to(".about__art", { y: -50, ease: "none", scrollTrigger: { trigger: ".about__intro", start: "top bottom", end: "bottom top", scrub: true } });

    // The 5 Knot Keys are dealt out like cards
    // (a gentler version on phones, where the cards sit in a swipe row and a big swing would be cut off)
    var small = window.matchMedia("(max-width: 860px)").matches;
    gsap.from("#keys .key", {
      scrollTrigger: { trigger: "#keys", start: "top 82%", once: true },
      y: small ? 30 : 90, autoAlpha: 0, rotation: function (i) { return (i - 2) * (small ? 2 : 9); },
      duration: 0.9, ease: small ? "power3.out" : "back.out(1.5)", stagger: 0.1
    });

    // A line of type slides sideways as you scroll, and leans with your speed
    var ticker = $("#ticker");
    if (ticker) {
      var lean = gsap.quickTo(ticker, "skewX", { duration: 0.5, ease: "power3.out" });
      gsap.fromTo(ticker, { x: 0 }, {
        x: function () { return -Math.min(900, ticker.offsetWidth / 4); }, ease: "none",
        scrollTrigger: {
          trigger: ".ticker", start: "top bottom", end: "bottom top", scrub: 0.6, invalidateOnRefresh: true,
          onUpdate: function (self) { lean(clamp(self.getVelocity() / -260, -10, 10)); }
        }
      });
      ScrollTrigger.addEventListener("scrollEnd", function () { lean(0); });
    }

    // What is in the box: the five things are dealt out from the middle, as if lifted out of the box.
    // Each number counts up as its tile lands.
    (function () {
      var list = $("#box-list"), tiles = $$(".box__item", list);
      if (!list || !tiles.length) return;
      ScrollTrigger.create({
        trigger: list, start: "top 78%", once: true,
        onEnter: function () {
          var mid = list.getBoundingClientRect(); mid = mid.left + mid.width / 2;
          tiles.forEach(function (tile, i) {
            var r = tile.getBoundingClientRect(), num = $(".count", tile), target = parseInt(num.dataset.count, 10), o = { v: 0 };
            gsap.from(tile, { x: mid - (r.left + r.width / 2), y: 140, scale: 0.2, rotation: (i - 2) * 14, autoAlpha: 0, duration: 0.8, ease: "back.out(1.5)", delay: i * 0.11 });
            gsap.to(o, { v: target, duration: target > 20 ? 1.2 : 0.6, ease: "power2.out", delay: i * 0.11 + 0.35, onUpdate: function () { num.textContent = Math.round(o.v); } });
          });
        }
      });
      gsap.set(tiles, { autoAlpha: 1 });
    })();

    // Quick facts: each one pops up in turn
    gsap.from(".facts-bar__list li", {
      y: 46, scale: 0.6, rotation: function (i) { return i % 2 ? 7 : -7; }, autoAlpha: 0,
      duration: 0.7, ease: "back.out(1.9)", stagger: 0.09,
      scrollTrigger: { trigger: ".facts-bar", start: "top 92%", once: true }
    });

    // About: the wedding guests walk in
    gsap.from(".about__art", { xPercent: 22, autoAlpha: 0, duration: 1, ease: "power3.out", scrollTrigger: { trigger: ".about__intro", start: "top 78%", once: true } });

    // Questions: they come in from alternate sides
    gsap.from(".faq .qa", {
      x: function (i) { return i % 2 ? 70 : -70; }, rotation: function (i) { return i % 2 ? 2 : -2; }, autoAlpha: 0,
      duration: 0.7, ease: "power3.out", stagger: 0.08,
      scrollTrigger: { trigger: ".faq__list", start: "top 82%", once: true }
    });

    // Word meanings: each row of cards flips up as it comes into view, like cards being turned over
    gsap.set("#terms .term", { rotationX: -80, y: 30, autoAlpha: 0, transformOrigin: "50% 0%", transformPerspective: 700 });
    ScrollTrigger.batch("#terms .term", {
      start: "top 90%", once: true,
      onEnter: function (batch) { gsap.to(batch, { rotationX: 0, y: 0, autoAlpha: 1, duration: 0.7, ease: "power3.out", stagger: 0.07, overwrite: true }); }
    });

    // The rulebook: the cover opens as you scroll to it, then the chapter names drop in
    (function () {
      var cover = $("#book-cover");
      if (!cover) return;
      gsap.fromTo(cover, { rotationY: 0 }, { rotationY: -128, ease: "none", transformPerspective: 1400, scrollTrigger: { trigger: "#book", start: "top 78%", end: "top 32%", scrub: 0.6 } });
      // the back of the cover is blank, so the logo fades before it would show back to front
      gsap.to("#book-cover > *", { autoAlpha: 0, ease: "none", scrollTrigger: { trigger: "#book", start: "top 66%", end: "top 56%", scrub: 0.6 } });
      gsap.from(".book__pages > *", { x: -14, autoAlpha: 0, duration: 0.4, stagger: 0.07, ease: "power2.out", scrollTrigger: { trigger: "#book", start: "top 50%", once: true } });
      gsap.from(".download__inside li", { y: 20, scale: 0.6, autoAlpha: 0, duration: 0.5, ease: "back.out(2)", stagger: 0.06, scrollTrigger: { trigger: ".download__inside", start: "top 90%", once: true } });
      gsap.to("#book", { y: -8, duration: 2.4, ease: "sine.inOut", repeat: -1, yoyo: true });
    })();

    // Footer links arrive one after another
    gsap.from(".footer__links li", { y: 18, autoAlpha: 0, duration: 0.5, ease: "power3.out", stagger: 0.05, scrollTrigger: { trigger: ".footer", start: "top 94%", once: true } });

    $$(".buy__float").forEach(function (el, i) {
      gsap.to(el, { y: i ? -110 : -60, ease: "none", scrollTrigger: { trigger: "#buy", start: "top bottom", end: "bottom top", scrub: true } });
    });

    // Re-measure whenever the page changes height (fonts arriving, pictures loading, a section opening),
    // so nothing is ever animated from a stale position
    ScrollTrigger.config({ ignoreMobileResize: true });
    window.addEventListener("load", function () { ScrollTrigger.refresh(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
    if (window.ResizeObserver) {
      var lastHeight = 0, remeasure;
      new ResizeObserver(function () {
        var h = document.documentElement.scrollHeight;
        if (Math.abs(h - lastHeight) < 2) return;
        lastHeight = h;
        clearTimeout(remeasure);
        remeasure = setTimeout(function () { ScrollTrigger.refresh(); }, 200);
      }).observe(document.body);
    }
  }

  /* ---------- the "keep scrolling" cue ----------
     It appears only after the page has been still for a moment, and only in places that can look like the end:
     the opening screen, the board tour (it holds still while you scroll), and the Buy section.
     How to Play has its own Back and Next buttons and says how to move, so the cue stays out of its way.
     It hides the moment the page moves. */
  (function () {
    var cue = $("#cue"), label = $("#cue-text");
    if (!cue || !animate) return;
    var timer;
    function holding(el) { // a section that is filling the screen, with more of it still to come
      if (!el) return false;
      var r = el.getBoundingClientRect();
      return r.top <= 1 && r.bottom > window.innerHeight + 80;
    }
    function message() {
      if (holding($("#top"))) return window.scrollY < 40 ? "Scroll to walk round the board" : "Keep scrolling";
      var buy = $("#buy").getBoundingClientRect();
      if (buy.top < window.innerHeight * 0.4 && buy.bottom > window.innerHeight * 0.8) return "More below"; // only while the next section is not showing yet
      return "";
    }
    function check() {
      if (root.classList.contains("is-loading")) { timer = setTimeout(check, 600); return; }
      var text = message();
      if (!text) return;
      label.textContent = text;
      cue.classList.add("is-on");
    }
    function moved() {
      cue.classList.remove("is-on");
      clearTimeout(timer);
      timer = setTimeout(check, 1200);
    }
    window.addEventListener("scroll", moved, { passive: true });
    timer = setTimeout(check, 1800);
  })();

  /* ---------- confetti ---------- */
  var PARTY = ["#EA5297", "#00B6ED", "#75B94E", "#F28A3D", "#FFCE3A", "#F7F7F6"];
  function burst(host) {
    if (!animate) return;
    var layer = document.createElement("div");
    layer.className = "burst";
    layer.setAttribute("aria-hidden", "true");
    for (var i = 0; i < 46; i++) {
      var bit = document.createElement("i");
      bit.style.setProperty("--c", PARTY[i % PARTY.length]);
      layer.appendChild(bit);
    }
    host.appendChild(layer);
    gsap.fromTo(layer.children, { x: 0, y: 0, scale: 0, rotation: 0 }, {
      x: function () { return gsap.utils.random(-520, 520); },
      y: function () { return gsap.utils.random(-380, 260); },
      rotation: function () { return gsap.utils.random(-540, 540); },
      scale: function () { return gsap.utils.random(0.6, 1.4); },
      duration: 1.3, ease: "power3.out", stagger: 0.006
    });
    gsap.to(layer, { autoAlpha: 0, duration: 0.6, delay: 1.5, onComplete: function () { layer.remove(); } });
  }

  /* ---------- how do you win: tap the 5 Knot Keys to collect them ---------- */
  (function () {
    var cards = $$("#keys .key"), fill = $("#win-fill"), count = $("#win-n"), done = $("#win-done");
    if (!cards.length) return;
    var got = 0;
    cards.forEach(function (card) {
      var name = (card.getAttribute("aria-label") || "").split(".")[0];
      card.addEventListener("click", function () {
        if (card.classList.contains("is-on")) return;
        card.classList.add("is-on");
        card.setAttribute("aria-pressed", "true");
        card.setAttribute("aria-label", name + ". Collected.");
        got++;
        count.textContent = got;
        fill.style.width = (got / cards.length) * 100 + "%";
        if (got === cards.length) {
          done.hidden = false;
          if (animate) gsap.from(done.children, { y: 24, autoAlpha: 0, duration: 0.6, ease: "power3.out", stagger: 0.12, delay: 0.5 });
          setTimeout(function () { burst($("#win")); }, 450);
          if (ScrollTrigger) ScrollTrigger.refresh();
        }
      });
    });
  })();

  /* ---------- how to play: a play-through on the real board ----------
     The section holds still. Scrolling plays the game one step at a time, and the board shows what each step says.
     Positions on the board (START, the Blessing Time space, the card piles, the three Knot Key corners) are measured from the real board. */
  (function () {
    var play = $("#how-to-play"), pin = $("#play-pin"), scene = $("#scene");
    var beats = $$("#beats .beat"), dots = $$(".dot-btn"), now = $("#step-now"), back = $("#step-back"), next = $("#step-next");
    if (!play || !scene || !beats.length || !animate) return; // without animation the steps stay a plain list
    play.classList.add("is-play");

    function q(sel) { return $(sel, scene); }
    function glow(name) { return q('[data-glow="' + name + '"]'); }
    function W() { return scene.offsetWidth; }
    var N = beats.length;
    var piece = q("#scene-piece"), dim = q("#scene-dim"), piles = $$(".pile", scene);
    var notes = q("#scene-notes"), noteImgs = $$("img", notes), amount = q("#scene-amount");
    var diceA = q("#dice-a"), diceB = q("#dice-b"), draw = q("#scene-draw");
    var tray = q("#scene-tray"), slots = $$(".slot", tray), ido = q("#scene-ido");
    var arrow = q("#scene-arrow"), head = q(".scene__arrowhead"), confetti = q("#confetti");
    var colors = ["#00B6ED", "#75B94E", "#FFCE3A", "#F28A3D", "#EA5297", "#00B6ED", "#75B94E", "#FFCE3A"];

    for (var c = 0; c < 40; c++) {
      var bit = document.createElement("i");
      bit.style.setProperty("--c", PARTY[c % PARTY.length]);
      confetti.appendChild(bit);
    }
    var bits = $$("i", confetti);

    gsap.set(beats, { autoAlpha: 0, y: 26 });
    gsap.set(beats[0], { autoAlpha: 1, y: 0 });
    gsap.set(piles, { autoAlpha: 0, yPercent: -180 });
    gsap.set([piece, head], { autoAlpha: 0 });

    var active = -1;
    function setActive(i) {
      if (i === active) return;
      active = i;
      now.textContent = i + 1;
      back.disabled = i === 0;
      next.textContent = i === N - 1 ? "Finish" : "Next";
      dots.forEach(function (d, k) {
        d.classList.toggle("is-done", k < i);
        d.classList.toggle("is-active", k === i);
        if (k === i) d.setAttribute("aria-current", "step"); else d.removeAttribute("aria-current");
      });
    }

    var money = { v: 0 };
    var tl = gsap.timeline({
      defaults: { ease: "power2.out" },
      scrollTrigger: {
        // #play-run is tall and #play-pin is sticky inside it (CSS), so it can never cover another section
        trigger: "#play-run", start: "top top", end: "bottom bottom", scrub: 0.6, invalidateOnRefresh: true
      }
    });

    // the step counter follows the animation itself, so it is right once the motion settles
    tl.eventCallback("onUpdate", function () { setActive(clamp(Math.floor(tl.time()), 0, N - 1)); });

    // the words and the background colour change at each step
    for (var i = 1; i < N; i++) {
      tl.to(beats[i - 1], { autoAlpha: 0, y: -26, duration: 0.16, ease: "power1.in" }, i - 0.1)
        .to(beats[i], { autoAlpha: 1, y: 0, duration: 0.25 }, i + 0.06)
        .to(play, { backgroundColor: colors[i], duration: 0.3, ease: "none" }, i - 0.1);
    }

    // 1. Set up: the two card piles drop onto their spaces
    tl.to(piles, { autoAlpha: 1, yPercent: 0, duration: 0.5, stagger: 0.16, ease: "bounce.out" }, 0.12);

    // 2. Banker: the money comes out, counting up to 710,000
    tl.to(dim, { autoAlpha: 1, duration: 0.15 }, 1.05)
      .to(notes, { autoAlpha: 1, duration: 0.15 }, 1.08)
      .fromTo(noteImgs, { scale: 0.3, rotation: 0, xPercent: 0 }, {
        scale: 1, rotation: function (k) { return (k - 1) * 15; }, xPercent: function (k) { return (k - 1) * 26; },
        duration: 0.45, stagger: 0.08, ease: "back.out(1.6)"
      }, 1.1)
      .fromTo(money, { v: 0 }, {
        v: 710000, duration: 0.55, ease: "none",
        onUpdate: function () { amount.textContent = "₦" + (Math.round(money.v / 1000) * 1000).toLocaleString("en-NG"); }
      }, 1.2)
      .to([notes, dim], { autoAlpha: 0, duration: 0.12 }, 1.86);

    // 3. START: the piece drops onto the START corner
    tl.to(glow("start"), { autoAlpha: 1, duration: 0.15 }, 2.08)
      .fromTo(piece, { autoAlpha: 0, y: function () { return -W() * 0.28; } }, { autoAlpha: 1, y: 0, duration: 0.5, ease: "bounce.out" }, 2.15)
      .to(glow("start"), { autoAlpha: 0, duration: 0.15 }, 2.84);

    // 4. Who goes first: dice, then the anti-clockwise arrow draws round the board
    tl.fromTo(diceA, { autoAlpha: 0, scale: 0.5, rotation: -30 }, { autoAlpha: 1, scale: 1, rotation: 0, duration: 0.3, ease: "back.out(1.8)" }, 3.08)
      .to(diceA, { autoAlpha: 0, scale: 0.8, duration: 0.12 }, 3.34)
      .fromTo(arrow, { strokeDashoffset: 100 }, { strokeDashoffset: 0, duration: 0.3, ease: "none" }, 3.38)
      .to(head, { autoAlpha: 1, duration: 0.06 }, 3.66)
      .to([arrow, head], { autoAlpha: 0, duration: 0.14 }, 3.94);

    // 5. Roll and move: 3 + 2, so the piece hops five spaces and lands on Blessing Time
    var hops = [];
    for (var h = 0; h < 5; h++) hops.push({ yPercent: -26, duration: 0.5 }, { yPercent: 0, duration: 0.5 });
    tl.fromTo(diceB, { autoAlpha: 0, scale: 0.5, rotation: 30 }, { autoAlpha: 1, scale: 1, rotation: 0, duration: 0.3, ease: "back.out(1.8)" }, 4.08)
      .to(diceB, { autoAlpha: 0, scale: 0.8, duration: 0.1 }, 4.34)
      .to(piece, { x: function () { return W() * 0.387; }, duration: 0.34, ease: "none" }, 4.38)
      .to(piece, { keyframes: hops, duration: 0.34, ease: "none" }, 4.38);

    // 6. Do what the space says: the space lights up, and a card comes off its pile
    tl.to(glow("bless"), { autoAlpha: 1, duration: 0.12 }, 5.06)
      .to(glow("deck"), { autoAlpha: 1, duration: 0.12 }, 5.2)
      .to(dim, { autoAlpha: 1, duration: 0.15 }, 5.34)
      .fromTo(draw, { autoAlpha: 0, scale: 0.3, xPercent: -16, yPercent: 20 }, { autoAlpha: 1, scale: 1, xPercent: 0, yPercent: 0, duration: 0.36, ease: "back.out(1.5)" }, 5.34)
      .to([draw, dim, glow("bless"), glow("deck")], { autoAlpha: 0, duration: 0.12 }, 5.86);

    // 7. The 5 Knot Keys: two from the Blessing Time pile, three from their corners
    function light(slot, at) {
      tl.to(slot, { opacity: 1, filter: "grayscale(0)", scale: 1.16, duration: 0.07 }, at)
        .to(slot, { scale: 1, duration: 0.06 }, at + 0.07);
    }
    tl.fromTo(tray, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.14 }, 6.04)
      .to(glow("deck"), { autoAlpha: 1, duration: 0.06 }, 6.1);
    light(slots[0], 6.16); light(slots[1], 6.26);
    tl.to(glow("deck"), { autoAlpha: 0, duration: 0.05 }, 6.36).to(glow("venue"), { autoAlpha: 1, duration: 0.05 }, 6.36);
    light(slots[2], 6.38);
    tl.to(glow("venue"), { autoAlpha: 0, duration: 0.05 }, 6.47).to(glow("holy"), { autoAlpha: 1, duration: 0.05 }, 6.47);
    light(slots[4], 6.49);
    tl.to(glow("holy"), { autoAlpha: 0, duration: 0.05 }, 6.58).to(glow("officiant"), { autoAlpha: 1, duration: 0.05 }, 6.58);
    light(slots[3], 6.6);
    tl.to(glow("officiant"), { autoAlpha: 0, duration: 0.08 }, 6.92);

    // 8. The payoff: I do!
    tl.to(dim, { autoAlpha: 1, duration: 0.18 }, 7.05)
      .to(tray, { y: function () { return -W() * 0.33; }, duration: 0.3 }, 7.05)
      .set(piece, { zIndex: 8 }, 7.06)
      .to(piece, { x: function () { return W() * 0.425; }, y: function () { return -W() * 0.09; }, scale: 2.3, duration: 0.36, ease: "back.out(1.4)" }, 7.1)
      .fromTo(ido, { autoAlpha: 0, scale: 0.2, rotation: -18 }, { autoAlpha: 1, scale: 1, rotation: 0, duration: 0.36, ease: "back.out(2)" }, 7.14)
      .fromTo(bits, { x: 0, y: 0, scale: 0, rotation: 0 }, {
        x: function (k) { return Math.cos(k * 2.4) * W() * (0.22 + (k % 7) * 0.06); },
        y: function (k) { return Math.sin(k * 2.4) * W() * (0.2 + (k % 5) * 0.07) - W() * 0.06; },
        rotation: function (k) { return (k % 2 ? 1 : -1) * (160 + k * 21); },
        scale: 1, duration: 0.6, ease: "power3.out", stagger: 0.004
      }, 7.2)
      .to({}, { duration: 0.5 }, 8);

    // When scrolling stops part-way between two steps, glide to the nearer one, where its picture is complete.
    // This goes through the smooth scroller, so the two never pull against each other.
    function restY(i) { var st = tl.scrollTrigger; return st.start + (st.end - st.start) * ((i + 0.75) / tl.duration()); }
    ScrollTrigger.addEventListener("scrollEnd", function () {
      var st = tl.scrollTrigger;
      if (!st || !st.isActive) return;
      var t = st.progress * tl.duration();
      if (t < 0.2 || t > N + 0.15) return; // let people scroll in and out freely
      var y = restY(clamp(Math.round(t - 0.75), 0, N - 1));
      if (Math.abs(y - window.scrollY) > 8) scrollToY(y);
    });

    // Every way of moving through the steps ends up here
    function go(i) {
      if (i < 0) return;
      if (i > N - 1) { var after = $("#after-steps"); scrollToY(after.getBoundingClientRect().top + window.scrollY - 8); return; } // past the last step
      scrollToY(restY(i));
    }
    next.addEventListener("click", function () { go(active + 1); });
    back.addEventListener("click", function () { go(active - 1); });
    dots.forEach(function (d) { d.addEventListener("click", function () { go(parseInt(d.dataset.go, 10)); }); });

    // swipe sideways on the steps: left for the next one, right for the one before
    var touch = null;
    pin.addEventListener("touchstart", function (e) { var t = e.changedTouches[0]; touch = { x: t.clientX, y: t.clientY }; }, { passive: true });
    pin.addEventListener("touchend", function (e) {
      if (!touch) return;
      var t = e.changedTouches[0], dx = t.clientX - touch.x, dy = t.clientY - touch.y;
      touch = null;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) go(active + (dx < 0 ? 1 : -1));
    }, { passive: true });

    // arrow keys, while the steps are on screen
    document.addEventListener("keydown", function (e) {
      var st = tl.scrollTrigger;
      if (!st || !st.isActive || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.key === "ArrowRight") { e.preventDefault(); go(active + 1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); go(active - 1); }
    });

    setActive(0);
  })();

  /* ---------- glossary: every word is shown, and the box filters them ---------- */
  (function () {
    var input = $("#glossary-search"), list = $("#terms"), empty = $("#terms-empty");
    if (!input || !list) return;
    var terms = $$(".term", list);

    // "Aso-Ebi", "aso ebi" and "Aso - Ebi" should all match
    function norm(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, ""); }

    input.addEventListener("input", function () {
      var q = norm(input.value), shown = 0;
      terms.forEach(function (t) {
        var match = !q || norm(t.textContent).indexOf(q) !== -1;
        t.hidden = !match;
        if (match) shown++;
      });
      empty.hidden = shown > 0;
      // a match must never stay hidden because its entrance has not played yet
      if (gsap) gsap.set(terms, { rotationX: 0, y: 0, autoAlpha: 1, overwrite: true });
      if (ScrollTrigger) ScrollTrigger.refresh();
    });
  })();

  /* ---------- contact form ---------- */
  (function () {
    // EmailJS sends the letter to marivogames@gmail.com. Paste the three values from the EmailJS dashboard here.
    // (The public key is meant to be public, so it is safe in this file.)
    // While any of them is empty, the form opens the visitor's email app with the message filled in.
    var EMAILJS = {
      publicKey: "iObj3kQUHg9yzuH-9",   // Account > General > Public Key
      serviceId: "service_3uwn8ub",     // Email Services > the service's ID
      templateId: "template_oupzf3l"    // Email Templates > the template's ID
    };
    // The template can use these names: {{name}} {{email}} {{phone}} {{purpose}}
    // The client's confirmation line goes to the visitor from the template's Auto-Reply tab.
    var TO = "marivogames@gmail.com";
    var THANKS = "Thank you for reaching out, we will get back to you shortly.";

    var form = $("#contact-form"), status = $("#form-status");
    if (!form || !status) return;

    function say(text, state) { status.textContent = text; status.dataset.state = state || ""; }

    // Quick picks write a starting sentence into the purpose box
    var purpose = $("#cf-purpose"), picks = $$(".chip-btn", form);
    picks.forEach(function (pick) {
      pick.addEventListener("click", function () {
        var starters = picks.map(function (p) { return p.dataset.purpose; });
        picks.forEach(function (p) { p.setAttribute("aria-pressed", String(p === pick)); });
        // only replace what a quick pick wrote, never something the person typed
        if (!purpose.value.trim() || starters.indexOf(purpose.value) !== -1) purpose.value = pick.dataset.purpose;
        purpose.dispatchEvent(new Event("input", { bubbles: true }));
        purpose.focus();
        purpose.setSelectionRange(purpose.value.length, purpose.value.length);
      });
    });

    // A box stops being red as soon as what is in it is fine
    form.addEventListener("input", function (e) {
      var el = e.target;
      if (el.getAttribute("aria-invalid") === "true" && el.checkValidity()) el.setAttribute("aria-invalid", "false");
      if (status.dataset.state === "error" && !form.querySelector("[aria-invalid=true]")) say("");
    });

    // The stamp lands when the letter comes into view, and thumps again when the letter is sent
    var stamp = $("#letter-stamp");
    function thump() {
      if (!animate || !stamp) return;
      gsap.fromTo(stamp, { scale: 2.2, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.45, ease: "back.out(2.4)", overwrite: true });
    }
    if (animate && stamp) {
      gsap.set(stamp, { autoAlpha: 0 });
      ScrollTrigger.create({ trigger: form, start: "top 72%", once: true, onEnter: thump });
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var bad = null;
      Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.name) return;
        var ok = el.checkValidity();
        el.setAttribute("aria-invalid", String(!ok));
        if (!ok && !bad) bad = el;
      });
      if (bad) {
        say("Please fill in every box, and check your email address.", "error");
        bad.focus();
        return;
      }

      thump();
      var data = {
        name: form.elements.name.value.trim(),
        email: form.elements.email.value.trim(),
        phone: form.elements.phone.value.trim(),
        purpose: form.elements.purpose.value.trim()
      };

      if (!EMAILJS.publicKey || !EMAILJS.serviceId || !EMAILJS.templateId) {
        var body = "Name: " + data.name + "\nEmail: " + data.email + "\nPhone Number: " + data.phone + "\n\nPurpose for reaching out:\n" + data.purpose;
        window.location.href = "mailto:" + TO + "?subject=" + encodeURIComponent("MARIVO website enquiry") + "&body=" + encodeURIComponent(body);
        say("Your email app should open with your message. Press send there to finish.");
        return;
      }

      var sendBtn = form.querySelector("button[type=submit]");
      sendBtn.disabled = true; // one letter per press
      say("Sending…");
      fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: EMAILJS.serviceId,
          template_id: EMAILJS.templateId,
          user_id: EMAILJS.publicKey,
          template_params: data
        })
      })
        .then(function (res) {
          if (!res.ok) throw new Error("Request failed");
          form.reset();
          picks.forEach(function (p) { p.setAttribute("aria-pressed", "false"); });
          say(THANKS);
        })
        .catch(function () {
          say("Your message did not send. Please try again, or email " + TO + ".", "error");
        })
        .then(function () { sendBtn.disabled = false; });
    });
  })();
})();
