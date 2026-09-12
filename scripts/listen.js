(function(){
  var dataEl=document.getElementById('tts'),btn=document.getElementById('listen');
  if(!dataEl||!btn)return;
  var T=JSON.parse(dataEl.textContent),segs=T.s,audio=null,bar=null,cur=-1,follow=true,lastAuto=0;
  var SPEEDS=[1,1.2,1.5,0.8],speed=1;
  try{var sv=parseFloat(localStorage.getItem('tts-speed'));if(SPEEDS.indexOf(sv)>-1)speed=sv}catch(e){}
  var I_PLAY='<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
  var I_PAUSE='<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>';
  function fmt(t){t=Math.max(0,Math.floor(t||0));return Math.floor(t/60)+':'+String(t%60).padStart(2,'0')}
  function els(t){return document.querySelectorAll('[data-t="'+t+'"]')}
  function mark(k){
    if(k===cur)return;
    document.querySelectorAll('.reading').forEach(function(e){e.classList.remove('reading')});
    cur=k;if(k<0)return;
    var list=els(segs[k][0]);list.forEach(function(e){e.classList.add('reading')});
    if(follow&&list.length){
      var e=list[list.length-1],r=e.getBoundingClientRect(),vh=window.innerHeight;
      if(r.top<70||r.bottom>vh-110){lastAuto=Date.now();e.scrollIntoView({behavior:'smooth',block:'center'})}
    }
  }
  function segAt(t){for(var k=segs.length-1;k>=0;k--){if(t>=segs[k][1]-0.05)return k}return 0}
  function setFollow(v){follow=v;if(bar){var f=bar.querySelector('.lb-follow');f.classList.toggle('on',v);f.setAttribute('aria-pressed',v)}}
  function sync(){
    if(!audio)return;
    var t=audio.currentTime,d=audio.duration||T.d;
    bar.querySelector('.lb-range').value=d?t/d*1000:0;
    bar.querySelector('.lb-time').textContent=fmt(t)+' / '+fmt(d);
    var k=segAt(t);
    mark(t>=segs[k][2]+0.02&&k===segs.length-1?-1:k);
  }
  function state(){
    var p=audio&&!audio.paused;
    bar.querySelector('.lb-play').innerHTML=p?I_PAUSE:I_PLAY;
    bar.querySelector('.lb-play').setAttribute('aria-label',p?'멈춤':'재생');
    btn.classList.toggle('on',p);
    btn.querySelector('.l-t').textContent=p?'강의 듣는 중':(audio&&audio.currentTime>0&&!audio.ended?'이어 듣기':'강의 듣기');
    btn.querySelector('.l-i').innerHTML=p?I_PAUSE:I_PLAY;
    if('mediaSession' in navigator)navigator.mediaSession.playbackState=p?'playing':'paused';
  }
  function build(){
    bar=document.createElement('div');bar.className='lbar';bar.setAttribute('role','region');bar.setAttribute('aria-label','강의 재생기');
    bar.innerHTML='<div class="lb-in">'+
      '<button class="lb-play" type="button" aria-label="재생">'+I_PLAY+'</button>'+
      '<div class="lb-mid"><div class="lb-top"><b class="lb-name"></b><span class="lb-time">0:00</span></div>'+
      '<input class="lb-range" type="range" min="0" max="1000" value="0" aria-label="재생 위치"></div>'+
      '<button class="lb-speed" type="button" aria-label="재생 속도"></button>'+
      '<button class="lb-follow on" type="button" aria-pressed="true" title="읽는 곳을 따라 화면 이동">따라가기</button>'+
      '<button class="lb-close" type="button" aria-label="닫기">×</button></div>'+
      '<a class="lb-next" hidden></a>';
    document.body.appendChild(bar);document.body.classList.add('listening');
    bar.querySelector('.lb-name').textContent=T.h+' 강의';
    var sp=bar.querySelector('.lb-speed');sp.textContent=speed+'×';
    bar.querySelector('.lb-play').onclick=toggle;
    sp.onclick=function(){speed=SPEEDS[(SPEEDS.indexOf(speed)+1)%SPEEDS.length];audio.playbackRate=speed;sp.textContent=speed+'×';try{localStorage.setItem('tts-speed',speed)}catch(e){}};
    bar.querySelector('.lb-follow').onclick=function(){setFollow(!follow);if(follow&&cur>-1){var k=cur;cur=-2;mark(k)}};
    bar.querySelector('.lb-close').onclick=function(){audio.pause();mark(-1);bar.remove();bar=null;document.body.classList.remove('listening');audio=null;btn.classList.remove('on');btn.querySelector('.l-t').textContent='강의 듣기';btn.querySelector('.l-i').innerHTML=I_PLAY};
    var rg=bar.querySelector('.lb-range');
    rg.oninput=function(){var d=audio.duration||T.d;audio.currentTime=rg.value/1000*d;sync()};
    var nx=document.querySelector('a[rel=next]');
    if(nx){var a=bar.querySelector('.lb-next');a.href=nx.getAttribute('href');a.textContent='다음 이야기 '+nx.textContent.replace(/\s*→\s*$/,'')+' 듣기 →'}
  }
  function start(){
    audio=new Audio(T.src);audio.preload='auto';audio.playbackRate=speed;
    build();
    audio.addEventListener('timeupdate',sync);
    audio.addEventListener('play',state);audio.addEventListener('pause',state);
    audio.addEventListener('ratechange',function(){if(audio.playbackRate!==speed)audio.playbackRate=speed});
    audio.addEventListener('ended',function(){state();mark(-1);var a=bar&&bar.querySelector('.lb-next');if(a&&a.href)a.hidden=false});
    audio.addEventListener('error',function(){if(bar)bar.querySelector('.lb-name').textContent='음성을 불러오지 못했습니다'});
    if('mediaSession' in navigator){
      try{
        navigator.mediaSession.metadata=new MediaMetadata({title:T.h+'('+T.j+') 강의',artist:'사자성어 이야기',album:'사자성어 이야기'});
        navigator.mediaSession.setActionHandler('play',function(){audio.play()});
        navigator.mediaSession.setActionHandler('pause',function(){audio.pause()});
        navigator.mediaSession.setActionHandler('seekbackward',function(){audio.currentTime=Math.max(0,audio.currentTime-10)});
        navigator.mediaSession.setActionHandler('seekforward',function(){audio.currentTime=Math.min(audio.duration||T.d,audio.currentTime+10)});
      }catch(e){}
    }
  }
  function toggle(){
    if(!audio)start();
    if(audio.paused||audio.ended){if(audio.ended)audio.currentTime=0;var a=bar.querySelector('.lb-next');if(a)a.hidden=true;audio.play().catch(function(){})}
    else audio.pause();
  }
  btn.addEventListener('click',toggle);
  // 사용자가 직접 스크롤하면 따라가기를 잠시 끈다
  function manual(){if(audio&&!audio.paused&&follow&&Date.now()-lastAuto>900)setFollow(false)}
  window.addEventListener('wheel',manual,{passive:true});
  window.addEventListener('touchmove',manual,{passive:true});
  // 재생기가 열려 있을 때 문단을 누르면 그 문단부터 듣기
  document.addEventListener('click',function(e){
    if(!audio)return;
    var el=e.target.closest('[data-t]');if(!el||e.target.closest('a,button'))return;
    if(String(window.getSelection&&window.getSelection())!=='')return;
    var t=el.getAttribute('data-t');
    for(var k=0;k<segs.length;k++){if(segs[k][0]===t){audio.currentTime=segs[k][1];if(audio.paused)audio.play().catch(function(){});setFollow(true);sync();break}}
  });
  document.addEventListener('keydown',function(e){
    if(!audio||e.target.closest('input,textarea'))return;
    if(e.code==='Space'&&!e.target.closest('button')){e.preventDefault();toggle()}
  });
})();
