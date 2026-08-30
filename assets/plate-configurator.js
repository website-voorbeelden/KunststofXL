(function(){
  function money(cents, locale, currency){return new Intl.NumberFormat(locale||'nl-NL',{style:'currency',currency:currency||'EUR'}).format(cents/100)}
  function number(v){return Math.max(0,Number(String(v||'').replace(',','.'))||0)}
  function init(root){
    if(root.dataset.ready)return;root.dataset.ready='true';
    var $=function(s){return root.querySelector(s)}, $$=function(s){return Array.from(root.querySelectorAll(s))};
    var state={shape:'rectangle',holes:false,cutout:false,finish:'gezaagd',view:'preview'};
    var width=$('[data-pc-width]'), height=$('[data-pc-height]'), thickness=$('[data-pc-thickness]'), holes=$('[data-pc-holes]'), holeDia=$('[data-pc-hole-dia]'), cutout=$('[data-pc-cutout]');
    var sheetW=number(root.dataset.sheetWidth)||3050,sheetH=number(root.dataset.sheetHeight)||2050,base=number(root.dataset.basePrice)||0;
    function draw(){
      var w=Math.min(Math.max(number(width.value)||100,1),sheetW),h=Math.min(Math.max(number(height.value)||100,1),sheetH);width.value=w;height.value=h;
      var svg=$('.pc-svg'),image=$('.pc-image'),rect=$('.pc-shape'),holesGroup=$('.pc-holes'),dimW=$('.pc-dim-w'),dimH=$('.pc-dim-h'),labelW=$('.pc-label-w'),labelH=$('.pc-label-h'),wExtA=$('.pc-w-ext-a'),wExtB=$('.pc-w-ext-b'),hExtA=$('.pc-h-ext-a'),hExtB=$('.pc-h-ext-b');
      if(state.view==='image'){svg.hidden=true;image.hidden=false;$('.pc-canvas').classList.add('is-image')}else{svg.hidden=false;image.hidden=true;$('.pc-canvas').classList.remove('is-image')}
      var scale=Math.min(410/w,250/h),rw=w*scale,rh=h*scale,x=320-rw/2,y=170-rh/2;
      if(state.shape==='round'){var r=Math.min(rw,rh)/2;rect.setAttribute('d','M '+(320-r)+' 170 a '+r+' '+r+' 0 1 0 '+(r*2)+' 0 a '+r+' '+r+' 0 1 0 -'+(r*2)+' 0')}else if(state.shape==='rounded'){rect.setAttribute('d','M '+(x+20)+' '+y+' H '+(x+rw-20)+' Q '+(x+rw)+' '+y+' '+(x+rw)+' '+(y+20)+' V '+(y+rh-20)+' Q '+(x+rw)+' '+(y+rh)+' '+(x+rw-20)+' '+(y+rh)+' H '+(x+20)+' Q '+x+' '+(y+rh)+' '+x+' '+(y+rh-20)+' V '+(y+20)+' Q '+x+' '+y+' '+(x+20)+' '+y)}else{rect.setAttribute('d','M '+x+' '+y+' H '+(x+rw)+' V '+(y+rh)+' H '+x+' Z')}
      holesGroup.innerHTML='';
      if(state.holes){var count=Math.min(8,Math.max(1,Math.round(number(holes.value)||4))),rad=Math.max(3,(number(holeDia.value)||8)*scale/2),mx=Math.max(25,rw*.12),my=Math.max(25,rh*.12);for(var i=0;i<count;i++){var a=i/count*Math.PI*2-Math.PI/2,cx=320+Math.cos(a)*(rw/2-mx),cy=170+Math.sin(a)*(rh/2-my);holesGroup.insertAdjacentHTML('beforeend','<circle class="pc-hole" cx="'+cx+'" cy="'+cy+'" r="'+rad+'"/>')}}
      var wy=y+rh+34,hx=x-38;
      dimW.setAttribute('x1',x);dimW.setAttribute('x2',x+rw);dimW.setAttribute('y1',wy);dimW.setAttribute('y2',wy);
      wExtA.setAttribute('x1',x);wExtA.setAttribute('x2',x);wExtA.setAttribute('y1',y+rh);wExtA.setAttribute('y2',wy+7);
      wExtB.setAttribute('x1',x+rw);wExtB.setAttribute('x2',x+rw);wExtB.setAttribute('y1',y+rh);wExtB.setAttribute('y2',wy+7);
      labelW.setAttribute('x',320);labelW.setAttribute('y',wy+20);labelW.textContent=(w/10)+' cm';
      dimH.setAttribute('x1',hx);dimH.setAttribute('x2',hx);dimH.setAttribute('y1',y);dimH.setAttribute('y2',y+rh);
      hExtA.setAttribute('x1',x);hExtA.setAttribute('x2',hx-7);hExtA.setAttribute('y1',y);hExtA.setAttribute('y2',y);
      hExtB.setAttribute('x1',x);hExtB.setAttribute('x2',hx-7);hExtB.setAttribute('y1',y+rh);hExtB.setAttribute('y2',y+rh);
      labelH.setAttribute('x',hx-9);labelH.setAttribute('y',170);labelH.textContent=(h/10)+' cm';
      var area=(w*h)/(sheetW*sheetH), extra=(state.holes?count*125:0)+(state.cutout?450:0)+(state.finish==='gefreesd'?650:0),price=Math.max(1,Math.round(base*area+extra));$('[data-pc-price]').textContent=money(price,root.dataset.locale,root.dataset.currency);$('[data-pc-summary]').textContent=w+' × '+h+' mm · '+thickness.value+(state.holes?' · '+count+' boorgaten':'')+(state.cutout?' · uitsnede':'');
      root.dataset.configuration=JSON.stringify({width:w,height:h,thickness:thickness.value,shape:state.shape,holes:state.holes?count:0,cutout:state.cutout,finish:state.finish,price:price});
    }
    $$('.pc-choice[data-shape]').forEach(function(b){b.addEventListener('click',function(){$$('.pc-choice[data-shape][aria-pressed="true"]').forEach(function(x){x.setAttribute('aria-pressed','false')});b.setAttribute('aria-pressed','true');state.shape=b.dataset.shape;state.view='preview';$('[data-pc-tab="preview"]').click();draw()})});
    $$('.pc-choice[data-finish]').forEach(function(b){b.addEventListener('click',function(){$$('.pc-choice[data-finish][aria-pressed="true"]').forEach(function(x){x.setAttribute('aria-pressed','false')});b.setAttribute('aria-pressed','true');state.finish=b.dataset.finish;draw()})});
    [width,height,thickness,holes,holeDia,cutout].forEach(function(el){el.addEventListener('input',function(){state.view='preview';$('[data-pc-tab="preview"]').click();draw()});el.addEventListener('change',function(){if(el===holes){state.holes=el.checked;$('[data-pc-holes-extra]').classList.toggle('is-visible',state.holes)}if(el===cutout)state.cutout=el.checked;draw()})});
    $$('[data-pc-tab]').forEach(function(b){b.addEventListener('click',function(){$$('[data-pc-tab]').forEach(function(x){x.setAttribute('aria-selected','false')});b.setAttribute('aria-selected','true');state.view=b.dataset.pcTab;draw()})});
    $('[data-pc-cart]').addEventListener('click',function(){var c=JSON.parse(root.dataset.configuration||'{}');document.dispatchEvent(new CustomEvent('plate-configurator:add',{detail:c}));this.textContent='Configuratie opgeslagen';setTimeout(()=>this.textContent='Toevoegen aan winkelwagen',1600)});
    draw();
  } document.addEventListener('DOMContentLoaded',function(){document.querySelectorAll('[data-plate-configurator]').forEach(init)});
})();