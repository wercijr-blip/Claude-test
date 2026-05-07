// Lazy GTM loader — external file to comply with CSP (no inline scripts allowed).
// Loads GTM 2s after page load OR on first user interaction, whichever comes first.
(function() {
  var loadGTM = function() {
    (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-WCF38JBP');
  };
  var fired = false;
  var trigger = function() {
    if (fired) return;
    fired = true;
    loadGTM();
    ['scroll','click','touchstart','keydown'].forEach(function(ev) {
      window.removeEventListener(ev, trigger);
    });
  };
  if (document.readyState === 'complete') {
    setTimeout(trigger, 2000);
  } else {
    window.addEventListener('load', function() { setTimeout(trigger, 2000); });
  }
  ['scroll','click','touchstart','keydown'].forEach(function(ev) {
    window.addEventListener(ev, trigger, {once: true, passive: true});
  });
})();
