(function () {
  var menuBtn = document.querySelector("[data-menu-btn]");
  var nav = document.querySelector("[data-site-nav]");
  if (menuBtn && nav) {
    menuBtn.addEventListener("click", function () {
      nav.classList.toggle("hidden-mobile");
    });
  }

  var current = window.location.pathname.split("/").pop() || "index.html";
  var links = document.querySelectorAll("[data-nav-link]");
  links.forEach(function (link) {
    var href = link.getAttribute("href");
    if (href === current) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }
  });

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
        }
      });
    },
    { threshold: 0.12 }
  );

  document.querySelectorAll(".reveal").forEach(function (el, idx) {
    el.style.transitionDelay = Math.min(idx * 60, 300) + "ms";
    observer.observe(el);
  });

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

})();
