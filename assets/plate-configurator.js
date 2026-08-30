(function(){
  function num(v){return Math.max(0,Number(String(v||'').replace(',','.'))||0)}
  function money(c,l,curr){return new Intl.NumberFormat(l||'nl-NL',{style:'currency',currency:curr||'EUR'}).format(c/100)}
  function init(root){
    if(root.dataset.ready)return;root.dataset.ready='true';
    var q=function(s){return root.querySelector(s)},qa=function(s){return Array.prototype.slice.call(root.querySelectorAll(s))};
    var width=q('[data-pc-width]'),height=q('[data-pc-height]'),thickness=q('[data-pc-thickness]'),holeToggle=q('[data-pc-holes]'),holeCount=q('[data-pc-holes-count]'),holeDia=q('[data-pc-hole-dia]'),cutoutToggle=q('[data-pc-cutout]');
    var sheetW=num(root.dataset.sheetWidth)||3050,sheetH=num(root.dataset.sheetHeight)||1550,base=num(root.dataset.basePrice)||1000;
    var state={shape:'rectangle',view:'preview',holes:false,cutout:false,finish:'gezaagd',upload:null};
    function draw(){
      var wc=Math.min(Math.max(num(width.value)||10,5),sheetW/10),hc=Math.min(Math.max(num(height.value)||10,5),sheetH/10),w=wc*10,h=hc*10; width.value=wc;height.value=hc;
      var svg=q('.pc-svg'),img=q('.pc-image'),canvas=q('.pc-canvas'),shape=q('.pc-shape'),cutout=q('.pc-cutout'),holes=q('.pc-holes');
      svg.hidden=state.view==='image'; if(img){img.hidden=state.view!=='image';img.style.display=state.view==='image'?'block':'none'}canvas.classList.toggle('is-image',state.view==='image');
      var scale=Math.min(410/w,270/h),rw=w*scale,rh=h*scale,x=320-rw/2,y=195-rh/2;
      if(state.shape==='round'){var r=Math.min(rw,rh)/2;shape.setAttribute('d','M '+(320-r)+' 195 a '+r+' '+r+' 0 1 0 '+(2*r)+' 0 a '+r+' '+r+' 0 1 0 -'+(2*r)+' 0')}
      else if(state.shape==='rounded'){shape.setAttribute('d','M '+(x+20)+' '+y+'H '+(x+rw-20)+'Q '+(x+rw)+' '+y+' '+(x+rw)+' '+(y+20)+'V '+(y+rh-20)+'Q '+(x+rw)+' '+(y+rh)+' '+(x+rw-20)+' '+(y+rh)+'H '+(x+20)+'Q '+x+' '+(y+rh)+' '+x+' '+(y+rh-20)+'V '+(y+20)+'Q '+x+' '+y+' '+(x+20)+' '+y)}
      else if(state.shape==='triangle'){shape.setAttribute('d','M 320 '+y+' L '+(x+rw)+' '+(y+rh)+' L '+x+' '+(y+rh)+' Z')}
      else shape.setAttribute('d','M '+x+' '+y+'H '+(x+rw)+'V '+(y+rh)+'H '+x+'Z');
      cutout.hidden=!state.cutout;if(state.cutout){cutout.setAttribute('x',320-Math.min(rw,rh)*.13);cutout.setAttribute('y',195-Math.min(rw,rh)*.13);cutout.setAttribute('width',Math.min(rw,rh)*.26);cutout.setAttribute('height',Math.min(rw,rh)*.26)}
      holes.innerHTML='';var count=state.holes?Math.min(8,Math.max(1,Math.round(num(holeCount.value)||4))):0,radius=Math.max(3,num(holeDia.value||8)*scale/2);for(var i=0;i<count;i++){var a=i/count*Math.PI*2-Math.PI/2,cx=320+Math.cos(a)*(rw*.36),cy=195+Math.sin(a)*(rh*.36);holes.insertAdjacentHTML('beforeend','<circle class="pc-hole" cx="'+cx+'" cy="'+cy+'" r="'+radius+'"/>')}
      var wy=y+rh+35,hx=x-38,dim=function(s){return q(s)};dim('.pc-dim-w').setAttribute('x1',x);dim('.pc-dim-w').setAttribute('x2',x+rw);dim('.pc-dim-w').setAttribute('y1',wy);dim('.pc-dim-w').setAttribute('y2',wy);[['.pc-w-ext-a',x,y+rh,x,wy+7],['.pc-w-ext-b',x+rw,y+rh,x+rw,wy+7],['.pc-h-ext-a',x,y,hx-7,y],['.pc-h-ext-b',x,y+rh,hx-7,y+rh]].forEach(function(a){var n=dim(a[0]);n.setAttribute('x1',a[1]);n.setAttribute('y1',a[2]);n.setAttribute('x2',a[3]);n.setAttribute('y2',a[4])});dim('.pc-dim-h').setAttribute('x1',hx);dim('.pc-dim-h').setAttribute('x2',hx);dim('.pc-dim-h').setAttribute('y1',y);dim('.pc-dim-h').setAttribute('y2',y+rh);dim('.pc-label-w').setAttribute('x',320);dim('.pc-label-w').setAttribute('y',wy+20);dim('.pc-label-w').textContent=wc+' cm';dim('.pc-label-h').setAttribute('x',hx-9);dim('.pc-label-h').setAttribute('y',195);dim('.pc-label-h').textContent=hc+' cm';
      var p=Math.max(1,Math.round(base*(w*h)/(sheetW*sheetH)+(state.holes?count*125:0)+(state.cutout?450:0)+(state.finish==='gefreesd'?650:0)));qa('[data-pc-price]').forEach(function(n){n.textContent=money(p,root.dataset.locale,root.dataset.currency)});qa('[data-pc-summary]').forEach(function(n){n.textContent=wc+' × '+hc+' cm · '+thickness.value+(count?' · '+count+' boorgaten':'')+(state.cutout?' · uitsnede':'')});q('[data-pc-dimension-summary]').textContent=(state.shape==='rectangle'?'Rechthoek':state.shape==='rounded'?'Afgerond':state.shape==='round'?'Cirkel':'Driehoek')+': '+wc+' cm × '+hc+' cm';
    }
    function preview(){state.view='preview';qa('[data-pc-tab]').forEach(function(b){b.setAttribute('aria-selected',b.dataset.pcTab==='preview'?'true':'false')});draw()}
    qa('[data-shape]').forEach(function(b){b.addEventListener('click',function(){state.shape=b.dataset.shape;qa('[data-shape]').forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false')});q('[data-pc-shape-picker]').hidden=true;preview()})});
    q('[data-pc-open-shapes]').addEventListener('click',function(){q('[data-pc-shape-picker]').hidden=!q('[data-pc-shape-picker]').hidden});
    qa('[data-pc-shape-choice]').forEach(function(b){b.addEventListener('click',function(){state.shape=b.dataset.pcShapeChoice;q('[data-pc-shape-picker]').hidden=true;preview()})});
    q('[data-pc-upload-trigger]').addEventListener('click',function(){q('[data-pc-upload]').click()});
    q('[data-pc-upload]').addEventListener('change',function(e){var file=e.target.files&&e.target.files[0];if(!file)return;var reader=new FileReader();reader.onload=function(){var image=q('.pc-image');image.src=reader.result;state.view='image';q('[data-pc-upload-note]').textContent=file.name;q('[data-pc-upload-note]').hidden=false;qa('[data-pc-tab]').forEach(function(b){b.setAttribute('aria-selected',b.dataset.pcTab==='image'?'true':'false')});draw()};reader.readAsDataURL(file)});
    qa('[data-pc-tab]').forEach(function(b){b.addEventListener('click',function(){state.view=b.dataset.pcTab;qa('[data-pc-tab]').forEach(function(x){x.setAttribute('aria-selected',x===b?'true':'false')});draw()})});
    [width,height,holeCount,holeDia].forEach(function(el){el.addEventListener('input',preview)});thickness.addEventListener('change',preview);holeToggle.addEventListener('change',function(){state.holes=holeToggle.checked;q('[data-pc-holes-extra]').classList.toggle('is-visible',state.holes);preview()});cutoutToggle.addEventListener('change',function(){state.cutout=cutoutToggle.checked;preview()});
    qa('[data-pc-thickness-choice]').forEach(function(b){b.addEventListener('click',function(){qa('[data-pc-thickness-choice]').forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false')});thickness.value=b.dataset.pcThicknessChoice+' mm';q('[data-pc-thickness-summary]').textContent=thickness.value;preview()})});
    qa('[data-finish]').forEach(function(b){b.addEventListener('click',function(){state.finish=b.dataset.finish;qa('[data-finish]').forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false')});preview()})});
    qa('.pc-accord').forEach(function(d){d.addEventListener('toggle',function(){if(d.open)qa('.pc-accord').forEach(function(o){if(o!==d)o.open=false})})});draw();
  }
  document.addEventListener('DOMContentLoaded',function(){document.querySelectorAll('[data-plate-configurator]').forEach(init)});
})();