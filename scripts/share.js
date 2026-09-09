(function(){
  var bar=document.querySelector('.share');if(!bar)return;
  var d=bar.dataset,msg=bar.querySelector('.share-msg'),timer;
  var isIdiom=!!d.h;
  function url(){return location.href.split('#')[0]+(isIdiom?'':location.hash);}
  function title(){return isIdiom?(d.h+'('+d.j+') 뜻과 유래 — 사자성어 이야기'):document.title;}
  function text(){
    if(isIdiom)return d.h+'('+d.j+')\n'+d.m+'\n출전 · '+d.o+'\n— 사자성어 이야기\n'+url();
    return document.title+'\n'+url();
  }
  function say(t){msg.textContent=t;clearTimeout(timer);timer=setTimeout(function(){msg.textContent=''},2200);}
  function copy(t,ok){
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(function(){say(ok)},function(){fallback(t,ok)});}
    else fallback(t,ok);
  }
  function fallback(t,ok){var ta=document.createElement('textarea');ta.value=t;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');say(ok)}catch(e){say('복사가 막혀 있습니다. 주소창에서 복사해 주세요.')}document.body.removeChild(ta);}

  // ── 이미지 카드 ──
  function wrap(ctx,s,x,y,maxW,lh,font,color,maxLines){
    ctx.font=font;ctx.fillStyle=color;var line='',lines=[];
    for(var i=0;i<s.length;i++){var t=line+s[i];if(ctx.measureText(t).width>maxW&&line){lines.push(line);line=s[i]}else line=t}
    if(line)lines.push(line);
    if(maxLines&&lines.length>maxLines){lines=lines.slice(0,maxLines);lines[maxLines-1]=lines[maxLines-1].replace(/.$/,'…')}
    lines.forEach(function(l,k){ctx.fillText(l,x,y+k*lh)});return y+lines.length*lh;
  }
  function draw(){
    var W=1200,H=630,c=document.createElement('canvas');c.width=W;c.height=H;var x=c.getContext('2d');
    var g=x.createRadialGradient(240,60,20,240,60,900);g.addColorStop(0,'#F4F6F2');g.addColorStop(1,'#E9ECE6');
    x.fillStyle=g;x.fillRect(0,0,W,H);
    x.strokeStyle='#1F2A2E';x.lineWidth=3;x.strokeRect(36,36,W-72,H-72);
    x.fillStyle='#4F5C61';x.font='400 24px "Noto Serif KR",serif';x.textBaseline='top';
    x.fillText('사자성어 이야기 · '+d.c,80,72);
    // 한자
    var hf='900 150px "Noto Serif KR",serif';x.font=hf;x.fillStyle='#1F2A2E';
    x.fillText(d.j,76,130);
    var jw=x.measureText(d.j).width;
    // 도장
    var sx=76+jw+28,sy=150;x.fillStyle='#B8312F';x.fillRect(sx,sy,58,4*44+22);
    x.fillStyle='#fff';x.font='600 30px "Noto Serif KR",serif';x.textAlign='center';
    for(var i=0;i<4;i++)x.fillText(d.h[i],sx+29,sy+12+i*44);
    x.textAlign='left';
    // 훈음
    x.fillStyle='#4F5C61';x.font='400 26px "Noto Serif KR",serif';x.fillText(d.l,80,312);
    // 뜻
    var yy=wrap(x,d.m,80,364,W-160,50,'400 34px "Noto Serif KR",serif','#1F2A2E',3);
    // 출전
    x.fillStyle='#4F5C61';x.font='400 22px "Noto Serif KR",serif';x.fillText('출전 · '+d.o,80,Math.min(yy+18,H-130));
    // 아래 줄
    x.fillStyle='#B9C2BE';x.fillRect(80,H-96,W-160,1);
    var shown=url();try{shown=decodeURIComponent(shown)}catch(e){}
    x.fillStyle='#4F5C61';x.font='400 22px "Noto Serif KR",serif';x.fillText(shown.replace(/^https?:\/\//,''),80,H-80);
    return c;
  }
  function toBlob(c){return new Promise(function(r){c.toBlob(r,'image/png')})}
  function image(){
    say('이미지를 만드는 중…');
    var loads=[document.fonts?document.fonts.load('900 150px "Noto Serif KR"'):null,document.fonts?document.fonts.load('400 34px "Noto Serif KR"'):null,document.fonts?document.fonts.load('600 30px "Noto Serif KR"'):null].filter(Boolean);
    Promise.all(loads).catch(function(){}).then(function(){
      var c=draw();
      var box=document.createElement('div');box.className='share-modal';
      box.innerHTML='<div class="share-card"><img alt="'+d.h+' 공유 이미지"><div class="share-card-b"><button data-k="save">이미지 저장</button><button data-k="share" hidden>이미지 공유</button><button data-k="close">닫기</button></div><p class="share-hint">길게 눌러 저장하거나, 저장 버튼을 누르세요.</p></div>';
      box.querySelector('img').src=c.toDataURL('image/png');
      document.body.appendChild(box);
      var name=d.h+'_'+d.j+'.png';
      toBlob(c).then(function(b){
        var f=new File([b],name,{type:'image/png'});
        var sb=box.querySelector('[data-k=share]');
        if(navigator.canShare&&navigator.canShare({files:[f]})){sb.hidden=false;sb.onclick=function(){navigator.share({files:[f],title:title(),text:d.h+'('+d.j+') '+d.m,url:url()}).catch(function(){})}}
        box.querySelector('[data-k=save]').onclick=function(){var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();document.body.removeChild(a);say('이미지를 저장했습니다.')};
      });
      box.querySelector('[data-k=close]').onclick=function(){box.remove()};
      box.addEventListener('click',function(e){if(e.target===box)box.remove()});
      say('');
    });
  }

  // ── 버튼 ──
  var nb=bar.querySelector('[data-act=native]');
  if(navigator.share){nb.hidden=false}
  bar.addEventListener('click',function(e){
    var b=e.target.closest('[data-act]');if(!b)return;
    var act=b.dataset.act;
    if(act==='native'){navigator.share({title:title(),text:isIdiom?(d.h+'('+d.j+') '+d.m):document.title,url:url()}).catch(function(){});}
    else if(act==='link')copy(url(),'링크를 복사했습니다.');
    else if(act==='text')copy(text(),'글을 복사했습니다. 붙여넣기 하세요.');
    else if(act==='image')image();
    else if(act==='x')window.open('https://twitter.com/intent/tweet?text='+encodeURIComponent(isIdiom?(d.h+'('+d.j+') '+d.m):document.title)+'&url='+encodeURIComponent(url()),'_blank','noopener');
    else if(act==='fb')window.open('https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(url()),'_blank','noopener');
  });
})();
