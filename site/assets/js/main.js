(function () {
  function setViewportVars() {
    var root = document.documentElement;
    var hero = document.querySelector(".hero");
    if (!root || !hero) return;
    var header = document.querySelector(".site-header");
    var headerHeight = header ? Math.round(header.getBoundingClientRect().height) : 72;
    root.style.setProperty("--app-vh", (window.innerHeight * 0.01) + "px");
    root.style.setProperty("--header-offset", headerHeight + "px");
  }

  setViewportVars();
  window.addEventListener("resize", setViewportVars);
  window.addEventListener("orientationchange", setViewportVars);

  var menuBtn = document.querySelector("[data-menu-btn]");
  var nav = document.querySelector("[data-site-nav]");
  if (menuBtn && nav) {
    menuBtn.addEventListener("click", function () {
      var isOpen = nav.classList.toggle("hidden-mobile") === false;
      menuBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
      menuBtn.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
    });
    // Close nav on outside click
    document.addEventListener("click", function (e) {
      if (!nav.classList.contains("hidden-mobile") && !nav.contains(e.target) && e.target !== menuBtn) {
        nav.classList.add("hidden-mobile");
        menuBtn.setAttribute("aria-expanded", "false");
        menuBtn.setAttribute("aria-label", "Open navigation menu");
      }
    });
  }

  var path = window.location.pathname.replace(/\/+$/, "") || "/";
  var current = path.toLowerCase();
  var links = document.querySelectorAll("[data-nav-link]");
  links.forEach(function (link) {
    var href = (link.getAttribute("href") || "").replace(/\/+$/, "") || "/";
    if (href.toLowerCase() === current) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }
  });

  // Auth nav: show dropdown if logged in
  (function () {
    var authLink = document.getElementById("nav-auth-link");
    if (!authLink) return;
    try {
      var raw = localStorage.getItem("gog_session");
      if (!raw) return;
      var session = JSON.parse(raw);
      if (!session || session.expires_at < Date.now()) return;
      // Read user role from Portal if available, else from stored users array
      var role = "customer";
      try {
        var users = JSON.parse(localStorage.getItem("gog_users") || "[]");
        var u = users.find(function (u) { return u.id === session.user_id; });
        if (u) role = u.role;
      } catch (e) {}
      // Build dropdown wrapper
      var isAdmin = role === "admin";
      var wrap = document.createElement("div");
      wrap.className = "nav-auth-wrap";
      wrap.innerHTML =
        '<button class="nav-auth-btn" aria-haspopup="true" aria-expanded="false">' +
          '<span class="nav-auth-label">My Account</span>' +
          '<svg class="nav-auth-caret" viewBox="0 0 10 6" width="10" height="6" aria-hidden="true"><path d="M0 0l5 6 5-6z" fill="currentColor"/></svg>' +
        '</button>' +
        '<div class="nav-auth-dropdown" role="menu">' +
          '<div class="nav-auth-role-badge">' + (isAdmin ? 'Admin' : 'Client') + '</div>' +
          (isAdmin
            ? '<a href="/admin" class="nav-auth-item" role="menuitem">&#9878; Admin Panel</a>'
            : '') +
          '<a href="/dashboard" class="nav-auth-item" role="menuitem">&#128100; Client Portal</a>' +
          '<div class="nav-auth-divider"></div>' +
          '<button class="nav-auth-item nav-auth-signout" id="nav-signout-btn" role="menuitem">&#x2192; Sign Out</button>' +
        '</div>';
      authLink.parentNode.replaceChild(wrap, authLink);
      var btn = wrap.querySelector(".nav-auth-btn");
      var drop = wrap.querySelector(".nav-auth-dropdown");
      wrap.querySelector("#nav-signout-btn").addEventListener("click", function () {
        localStorage.removeItem("gog_session");
        window.location.href = "/login";
      });
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var open = drop.classList.toggle("open");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
      });
      document.addEventListener("click", function () {
        drop.classList.remove("open");
        btn.setAttribute("aria-expanded", "false");
      });
      drop.addEventListener("click", function (e) { e.stopPropagation(); });
    } catch (e) {
      // Parsing failed — leave as Login
    }
  })();

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
        }
      });
    },
    { threshold: 0.18, rootMargin: "0px 0px -40px 0px" }
  );

  document.querySelectorAll(".reveal").forEach(function (el, idx) {
    el.style.transitionDelay = Math.min(idx * 100, 400) + "ms";
    observer.observe(el);
  });

  // Reveal variants + stagger containers
  var revealSelectors = ".reveal-up, .reveal-left, .reveal-right, .reveal-scale, [data-stagger], .svc-check-list, .svc-cta-card";
  document.querySelectorAll(revealSelectors).forEach(function (el) {
    observer.observe(el);
  });

  // Hero h1 word-by-word animation
  document.querySelectorAll(".hero h1, .svc-page-hero h1").forEach(function (h1) {
    var words = h1.textContent.trim().split(/\s+/);
    h1.innerHTML = words.map(function (w, i) {
      return '<span class="hero-title-word" style="animation-delay:' + (120 + i * 90) + 'ms">' + w + '</span>';
    }).join(" ");
  });
  // Typewriter on hero lead
  var typeEl = document.getElementById("hero-typewriter");
  if (typeEl) {
    var typeText = "Covering your grass for a greener tomorrow.";
    var typeIdx = 0;
    var typeSpeed = 42; // ms per character

    function typeNext() {
      if (typeIdx <= typeText.length) {
        typeEl.textContent = typeText.slice(0, typeIdx);
        typeIdx++;
        setTimeout(typeNext, typeSpeed);
      } else {
        // Done — pause, then remove cursor and cascade subcopy + buttons in
        setTimeout(function () {
          typeEl.classList.add("done");
          document.querySelectorAll(".hero-cascade").forEach(function (el) {
            el.style.opacity = "1";
            el.style.transform = "translateY(0)";
          });
        }, 600);
      }
    }

    // Start typing after h1 words have animated in
    setTimeout(typeNext, 900);
  }
  // Parallax on hero media on scroll
  var heroMedia = document.querySelector(".hero-media");
  if (heroMedia) {
    var ticking = false;
    window.addEventListener("scroll", function () {
      if (!ticking) {
        requestAnimationFrame(function () {
          var scrollY = window.scrollY || window.pageYOffset;
          heroMedia.style.transform = "translateY(" + (scrollY * 0.18) + "px)";
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  // ── Scroll-pin: services section card reveal (desktop only) ──
  if (window.innerWidth >= 700) {
  (function () {
    var pinWrap = document.getElementById("services-pin-wrap");
    if (!pinWrap) return;

    var cards = Array.prototype.slice.call(pinWrap.querySelectorAll(".pin-card"));
    var note  = pinWrap.querySelector(".pin-note");
    var CARD_COUNT  = cards.length;
    var START_OFFSET = 220;  // px of translateY card starts from
    var INITIAL_DELAY = 350; // scroll px before card 1 even begins moving
    var TRAVEL_PX    = 500;  // scroll px for one card to fully travel in (~5 wheel notches)
    var GAP_PX       = 420;  // scroll px between each card’s start point
    var NOTE_PX      = 150;  // scroll px for note to fade

    function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
    function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

    function getExtraScroll() {
      return INITIAL_DELAY + (CARD_COUNT - 1) * GAP_PX + TRAVEL_PX + NOTE_PX;
    }

    function setup() {
      var stickyEl = pinWrap.querySelector(".services-showcase");
      if (!stickyEl) return;
      pinWrap.style.height = (stickyEl.offsetHeight + getExtraScroll()) + "px";
    }

    function onScroll() {
      var pinTop = pinWrap.getBoundingClientRect().top + (window.scrollY || window.pageYOffset);
      var headerOffset = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--header-offset")) || 72;
      var scrolled = (window.scrollY || window.pageYOffset) - pinTop + headerOffset;

      cards.forEach(function (card, i) {
        var start = INITIAL_DELAY + i * GAP_PX;
        var end   = start + TRAVEL_PX;
        var p     = easeOutCubic(clamp((scrolled - start) / TRAVEL_PX, 0, 1));
        card.style.transform = "translateY(" + Math.round(START_OFFSET * (1 - p)) + "px)";
        card.style.opacity   = p.toFixed(3);
      });

      if (note) {
        var noteStart = INITIAL_DELAY + (CARD_COUNT - 1) * GAP_PX + TRAVEL_PX;
        note.style.opacity = easeOutCubic(clamp((scrolled - noteStart) / NOTE_PX, 0, 1)).toFixed(3);
      }
    }

    setup();
    window.addEventListener("resize", setup, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  })();
  } // end scroll-pin desktop-only guard

  var filterButtons = document.querySelectorAll("[data-filter]");
  var galleryItems = document.querySelectorAll("[data-gallery-item]");
  if (filterButtons.length > 0 && galleryItems.length > 0) {
    filterButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var filter = btn.getAttribute("data-filter");
        filterButtons.forEach(function (b) {
          b.classList.remove("active");
        });
        btn.classList.add("active");

        galleryItems.forEach(function (item) {
          var category = item.getAttribute("data-category");
          if (filter === "all" || filter === category) {
            item.classList.remove("hidden");
          } else {
            item.classList.add("hidden");
          }
        });
      });
    });
  }

  var form = document.querySelector("[data-contact-form]");
  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var formData = new FormData(form);
      var honeypot = (formData.get("company_website") || "").toString().trim();
      var email = (formData.get("email") || "").toString().trim();
      var name = (formData.get("name") || "").toString().trim();
      var message = (formData.get("message") || "").toString().trim();

      var errorBox = document.querySelector("[data-form-error]");
      var okBox = document.querySelector("[data-form-ok]");
      if (errorBox) {
        errorBox.textContent = "";
        errorBox.classList.add("hidden");
      }
      if (okBox) {
        okBox.textContent = "";
        okBox.classList.add("hidden");
      }

      if (honeypot.length > 0) {
        if (errorBox) {
          errorBox.textContent = "Submission blocked.";
          errorBox.classList.remove("hidden");
        }
        return;
      }

      var hasAt = email.indexOf("@") > 0 && email.indexOf(".") > 2;
      if (!name || !message || !hasAt) {
        if (errorBox) {
          errorBox.textContent = "Please complete name, valid email, and message.";
          errorBox.classList.remove("hidden");
        }
        return;
      }

      if (okBox) {
        okBox.textContent = "Thanks. Your quote request is ready for routing.";
        okBox.classList.remove("hidden");
      }
      form.reset();
    });
  }

  // Services marquee — drag (desktop), swipe (mobile), arrows, auto-scroll
  var svcStage = document.getElementById("svc-stage");
  var svcWrap  = document.getElementById("svc-marquee-wrap");
  var svcTrack = document.getElementById("svc-marquee-track");
  var svcDetailInner = document.getElementById("svc-detail-inner");
  var svcAllCards  = document.querySelectorAll("[data-svc-card]");
  var svcRealCards = document.querySelectorAll("[data-svc-card]:not([aria-hidden])");
  var svcActiveTarget = null;
  var svcDragging = false;
  var svcDragX = 0;
  var svcDragScroll = 0;
  var svcDragMoved = false;
  var svcTouching = false;
  var SVC_SPEED = 0.25;
  var svcScrollAcc = 0;

  function renderSvcPanel(targetId) {
    if (!svcDetailInner || targetId === svcActiveTarget) return;
    svcActiveTarget = targetId;
    var dataEl = document.getElementById(targetId);
    if (!dataEl) return;
    svcAllCards.forEach(function(c) {
      c.classList.toggle("is-active", c.getAttribute("data-target") === targetId);
    });
    var clone = dataEl.cloneNode(true);
    clone.hidden = false;
    svcDetailInner.innerHTML = "";
    svcDetailInner.appendChild(clone);
  }

  function svcLoopCheck() {
    if (!svcWrap || !svcTrack) return;
    var hw = svcTrack.scrollWidth / 2;
    if (hw <= 0) return;
    if (svcWrap.scrollLeft >= hw) svcWrap.scrollLeft -= hw;
    else if (svcWrap.scrollLeft < 0) svcWrap.scrollLeft += hw;
  }

  function svcCenterCard() {
    if (!svcWrap) return null;
    var r = svcWrap.getBoundingClientRect();
    var cx = r.left + r.width / 2;
    var best = null, bestDist = Infinity;
    svcAllCards.forEach(function(c) {
      var cr = c.getBoundingClientRect();
      var d = Math.abs((cr.left + cr.width / 2) - cx);
      if (d < bestDist) { bestDist = d; best = c; }
    });
    return best;
  }

  if (svcStage && svcWrap && svcTrack && svcDetailInner && svcAllCards.length > 0) {
    renderSvcPanel(svcAllCards[0].getAttribute("data-target"));

    // Infinite scroll reset — fires on any scroll (auto, drag, touch)
    svcWrap.addEventListener("scroll", svcLoopCheck, { passive: true });

    // Auto-scroll + panel sync RAF loop
    (function loop() {
      if (!svcDragging && !svcTouching) {
        svcScrollAcc += SVC_SPEED;
        if (svcScrollAcc >= 1) {
          var steps = Math.floor(svcScrollAcc);
          svcWrap.scrollLeft += steps;
          svcScrollAcc -= steps;
        }
      }
      var c = svcCenterCard();
      if (c) renderSvcPanel(c.getAttribute("data-target"));
      requestAnimationFrame(loop);
    })();

    // Desktop drag
    svcWrap.addEventListener("mousedown", function(e) {
      if (e.button !== 0) return;
      svcDragging = true;
      svcDragMoved = false;
      svcDragX = e.pageX;
      svcDragScroll = svcWrap.scrollLeft;
      svcWrap.classList.add("is-dragging");
      e.preventDefault();
    });
    document.addEventListener("mousemove", function(e) {
      if (!svcDragging) return;
      var dx = e.pageX - svcDragX;
      if (Math.abs(dx) > 5) svcDragMoved = true;
      svcWrap.scrollLeft = svcDragScroll - dx;
    });
    document.addEventListener("mouseup", function() {
      if (!svcDragging) return;
      svcDragging = false;
      svcWrap.classList.remove("is-dragging");
    });
    // Suppress button clicks if user was dragging
    svcWrap.addEventListener("click", function(e) {
      if (svcDragMoved) { e.stopPropagation(); e.preventDefault(); }
      svcDragMoved = false;
    }, true);

    // Touch pause (mobile swipe is native via overflow-x: scroll)
    svcWrap.addEventListener("touchstart", function() { svcTouching = true; }, { passive: true });
    svcWrap.addEventListener("touchend",   function() {
      setTimeout(function() { svcTouching = false; }, 600);
    }, { passive: true });

    // Arrow buttons
    var svcPrev = document.getElementById("svc-arrow-prev");
    var svcNext = document.getElementById("svc-arrow-next");
    var STEP = 314;
    if (svcPrev) svcPrev.addEventListener("click", function() { svcWrap.scrollLeft -= STEP; });
    if (svcNext) svcNext.addEventListener("click", function() { svcWrap.scrollLeft += STEP; });

    // Card click — immediately update panel
    svcRealCards.forEach(function(card) {
      card.addEventListener("click", function() {
        if (svcDragMoved) return;
        svcActiveTarget = null; // force re-render
        renderSvcPanel(card.getAttribute("data-target"));
      });
    });
  }

})();
