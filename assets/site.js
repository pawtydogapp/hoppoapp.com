
(function(){
  var rm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!rm && 'IntersectionObserver' in window){
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
    },{threshold:0,rootMargin:'0px 0px -40px 0px'});
    document.querySelectorAll('.reveal').forEach(function(el){ io.observe(el); });
  } else {
    document.querySelectorAll('.reveal').forEach(function(el){ el.classList.add('in'); });
  }
  var nums = document.querySelectorAll('.stat .n[data-to]');
  if(nums.length){
    var run = function(el){
      var to = parseInt(el.dataset.to,10), suf = el.dataset.suffix||'', t0 = null;
      if(rm){ el.textContent = to + suf; return; }
      var step = function(t){
        if(!t0) t0 = t;
        var p = Math.min((t-t0)/1100, 1), e = 1-Math.pow(1-p,3);
        el.textContent = Math.round(to*e) + suf;
        if(p<1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    if('IntersectionObserver' in window){
      var io2 = new IntersectionObserver(function(es){
        es.forEach(function(e){ if(e.isIntersecting){ run(e.target); io2.unobserve(e.target); } });
      },{threshold:.5});
      nums.forEach(function(n){ io2.observe(n); });
    } else { nums.forEach(run); }
  }
  // pause offscreen videos so nothing burns battery
  if('IntersectionObserver' in window){
    var io3 = new IntersectionObserver(function(es){
      es.forEach(function(e){
        var v = e.target;
        if(e.isIntersecting){ var p = v.play(); if(p&&p.catch) p.catch(function(){}); } else { v.pause(); }
      });
    },{threshold:.25});
    document.querySelectorAll('video[data-auto]').forEach(function(v){ io3.observe(v); });
  }
})();


(function(){
  function closeAll(except){ document.querySelectorAll('details.lang[open]').forEach(function(d){ if(d!==except) d.removeAttribute('open'); }); }
  document.addEventListener('click',function(e){ var d=e.target.closest && e.target.closest('details.lang'); closeAll(d); });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'){ var d=document.querySelector('details.lang[open]'); if(d){ d.removeAttribute('open'); d.querySelector('summary').focus(); } } });
})();

(function(){
  /* "Print this" buttons print only their own .printable block. */
  document.querySelectorAll('.printbtn').forEach(function(b){
    b.addEventListener('click', function(){
      var box = b.closest('.printable'); if(!box) { window.print(); return; }
      var c = box.cloneNode(true); c.className = 'printable printclone';
      document.body.appendChild(c);
      document.body.classList.add('pr1');
      window.print();
      setTimeout(function(){ document.body.classList.remove('pr1'); c.remove(); }, 800);
    });
  });
})();
