// Small, one-time entrances. Content remains readable without JavaScript or animation support.
(() => {
  const revealCollection = () => {
    const collection = document.getElementById(location.hash.slice(1));
    if (collection?.matches("details.shop-collection")) collection.open = true;
  };
  revealCollection();
  window.addEventListener("hashchange", revealCollection);
  const menu = document.querySelector(".site-menu");
  if (menu) {
    const summary = menu.querySelector("summary");
    document.addEventListener("pointerdown", event => {
      if (menu.open && !menu.contains(event.target)) menu.open = false;
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && menu.open) {
        menu.open = false;
        summary.focus();
      }
    });
    menu.addEventListener("click", event => {
      if (event.target.closest("a")) menu.open = false;
    });
    menu.addEventListener("focusout", event => {
      if (event.relatedTarget && !menu.contains(event.relatedTarget)) menu.open = false;
    });
  }
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reducedMotion.matches || !window.IntersectionObserver || !Element.prototype.animate) return;

  const active = new Map();
  const seen = new WeakSet();
  const targets = [
    ".hero-copy > *", ".hero-art", ".story-grid > .eyebrow", ".story-copy",
    ".section-heading", ".mission-carousel", ".signup-card", ".support-section > div",
    ".vision-intro", ".vision-photo", ".vision-themes > *", ".training-section > h2",
    ".school-card", ".shop-intro", ".shop-collection-heading", ".shop-product-card",
    ".giving-intro", ".monthly-goal", ".partnership-explanation", ".budget-card",
    ".link-list", ".shop-coming-collections > h2", ".shop-coming-soon",
    ".letter-archive-heading > *", ".letter-current > .letter-card",
    ".letter-archive-dropdown", ".letter-heading > *", ".letter-cover",
    ".letter-body > p", ".letter-section > h2", ".letter-section > p",
    ".letter-section > blockquote", ".letter-prayers", ".letter-gallery > figure",
    ".letter-subscribe", ".privacy-page > h1", ".privacy-page > p",
  ].join(",");

  const observer = new IntersectionObserver(entries => {
    for (const { target, isIntersecting } of entries) {
      if (!isIntersecting) continue;
      observer.unobserve(target);
      if (seen.has(target)) continue;
      seen.add(target);
      // Never hide a keyboard user's current destination or a fragment-link destination.
      const fragment = document.getElementById(location.hash.slice(1));
      if (target.contains(document.activeElement) || (fragment && target.contains(fragment))) continue;
      // A card's expanding content must keep its own height animation, without a nested entrance.
      if (target.closest("details")) continue;
      const hero = target.closest(".hero");
      const index = hero && target.matches(".hero-copy > *")
        ? [...target.parentElement.children].indexOf(target) : 0;
      const animation = target.animate([
        { opacity: 0, transform: `translateY(${hero ? 16 : 20}px)` },
        { opacity: 1, transform: "translateY(0)" },
      ], {
        duration: 560,
        delay: hero ? Math.min(index * 55, 220) : 0,
        easing: "cubic-bezier(.22, 1, .36, 1)",
        fill: "backwards",
      });
      active.set(target, animation);
      animation.finished.then(() => {
        if (active.get(target) === animation) active.delete(target);
      }).catch(() => {});
    }
  }, { threshold: 0, rootMargin: "0px 0px -24px 0px" });

  document.querySelectorAll(targets).forEach(target => observer.observe(target));
  // Focus and in-page navigation should always reveal their destination immediately.
  const finishAll = () => {
    for (const animation of active.values()) animation.cancel();
    active.clear();
  };
  document.addEventListener("focusin", event => {
    for (const [target, animation] of active) {
      if (target.contains(event.target)) {
        animation.cancel();
        active.delete(target);
      }
    }
  });
  window.addEventListener("hashchange", finishAll);
  reducedMotion.addEventListener("change", event => {
    if (event.matches) {
      observer.disconnect();
      finishAll();
    }
  });
})();
