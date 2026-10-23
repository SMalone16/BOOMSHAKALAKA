'use strict';
const $=id=>document.getElementById(id);
const views=['home','multiplayer','soloSelect','lobby','draft','play'];
let ws=null,room=null,me=null,token=null,code=null,browse=0,selected=null,support=null,game=null,connected=false,lastEvent=-1,eventCall=null;
let soloMyIndex=0,soloOppIndex=1,soloConfirmed=false,homeTeams=null;
window.arcadeAudioEnabled=localStorage.getItem('boom-audio')!=='off';
const keys={up:false,down:false,left:false,right:false,shoot:false,pass:false,sprint:false,jump:false,switch:false};
const icons={pallet:'✦',pewter:'◆',cerulean:'≋',vermillion:'ϟ',lavender:'☾',saffron:'✿',cinnabar:'♨'};
const descriptions={pallet:'All-around versatility, hustle and fearless finishes.',pewter:'Paint protection and dominant rebounding.',cerulean:'Fast breaks and deep-range splashes.',vermillion:'Thunderous dunks and electric steals.',lavender:'Elusive guards and perimeter defense.',saffron:'High-IQ team play and surgical shooting.',cinnabar:'Scorching jumpers and explosive finishes.'};
let toastTimer;
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const keyFor=code=>'boomshakalaka-session-'+code;
const show=name=>views.forEach(v=>$(v).classList.toggle('active',v===name));
function toast(s){$('toast').textContent=s;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3000)}
function send(obj){if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(obj))}
function connect(){
  ws=new WebSocket((location.protocol==='https:'?'wss:':'ws:')+'//'+location.host+'/ws');
  ws.onopen=()=>{
    connected=true;$('connectionText').textContent='SERVER ONLINE';$('connectionDot').classList.add('online');
    if(code)send({t:'join',code,token:localStorage.getItem(keyFor(code))||undefined});
  };
  ws.onmessage=e=>{
    let data;try{data=JSON.parse(e.data)}catch{return}
    if(data.t==='error')return toast(data.message);
    if(data.t==='joined'){
      code=data.code;me=data.me;token=data.token;
      localStorage.setItem(keyFor(code),token);
      history.replaceState(null,'',location.pathname+'?room='+code);
      $('lobbyCode').textContent='LOBBY '+code;
      $('inviteUrl').value=location.origin+location.pathname+'?room='+code;
    }
    if(data.t==='room'){
      const oldTeam=room?.myTeam,oldPhase=room?.phase;room=data;
      if(data.solo&&location.search)history.replaceState(null,'',location.pathname);
      if(data.phase==='lobby'){show('lobby');renderLobby()}
      if(data.phase==='draft'){
        if(data.solo&&(!soloConfirmed||data.myTeam!==data.roster[soloMyIndex].id||data.soloOpponent!==data.roster[soloOppIndex].id)){
          show('soloSelect');renderSoloSelect();return;
        }
        if(oldPhase!=='draft'||oldTeam!==data.myTeam){selected=null;support=null;
          const i=data.roster.findIndex(t=>t.id===data.myTeam);if(i>=0)browse=i}
        const self=data.ownPicks.find(p=>p.id===data.me);
        if(self?.pick){selected=self.pick;support=self.support||null}
        renderDraft();show('draft');
      }
      if(data.phase==='game'){show('play');$('gameMatchLabel').textContent=data.code+' · LIVE ARENA';$('pauseBtn').style.display=data.isHost?'':'none'}
    }
    if(data.t==='game'){
      if(room)room.control=data.control;
      game=data.game;
      if(game?.teams)SpriteArt.preloadMatch(game.teams);
      if(game?.event?.id&&game.event.id!==lastEvent){
        lastEvent=game.event.id;eventCall={...game.event,until:performance.now()+1400};
        if(typeof arcadeSound==='function')arcadeSound(game.event.kind);
        if(typeof makeBurst==='function')makeBurst(game.event.kind);
      }
      const overlay=$('gameOverlay');
      if(game?.phase==='OVER'){
        const labels=(game.teams||[]).map(id=>room.roster.find(t=>t.id===id)?.name||'TEAM');
        const winner=game.scores[0]===game.scores[1]?'TIE GAME':game.scores[0]>game.scores[1]?labels[0]+' WIN!':labels[1]+' WIN!';
        overlay.innerHTML='<div>'+escapeHTML(winner)+'<div style="font-size:30px;color:white;margin-top:12px">'+game.scores.join(' — ')+'</div>'+
          (data.host?'<button class="btn primary" data-action="rematch" style="margin-top:20px">REMATCH / NEW DRAFT</button>':'<p style="font:700 15px monospace">WAIT FOR HOST</p>')+'</div>';
        overlay.classList.remove('hidden');
      }else if(game?.pause||game?.phase==='BREAK'){
        overlay.textContent=game.pause?'PAUSED':game.quarter===2?'HALFTIME!':'END OF QUARTER';
        overlay.classList.remove('hidden');
      }else overlay.classList.add('hidden');
    }
  };
  ws.onclose=()=>{
    connected=false;$('connectionText').textContent='SERVER OFFLINE · RECONNECTING';$('connectionDot').classList.remove('online');
    Object.keys(keys).forEach(k=>keys[k]=false);setTimeout(connect,2000);
  };
}
function bind(id,fn){$(id).addEventListener('click',fn)}
bind('soloBtn',()=>{soloConfirmed=false;send({t:'solo'})});
bind('multiplayerBtn',()=>show('multiplayer'));
bind('backFromMulti',()=>show('home'));
bind('leaveLobby',()=>location.assign('/'));
bind('soloExit',()=>location.assign('/'));
bind('draftBackSolo',()=>{if(room?.solo){soloConfirmed=false;selected=null;support=null;show('soloSelect');renderSoloSelect()}});
bind('hostBtn',()=>send({t:'create'}));
bind('joinBtn',()=>{
  const value=$('joinCode').value.trim().toUpperCase();
  if(!/^[A-F0-9]{8}$/.test(value))return toast('Enter an 8-character lobby code.');
  code=value;send({t:'join',code,token:localStorage.getItem(keyFor(code))||undefined});
});
bind('setInitials',()=>send({t:'initials',value:$('initials').value.trim()}));
bind('copyLink',()=>{
  const field=$('inviteUrl'),fallback=()=>{
    field.focus();field.select();
    try{if(document.execCommand('copy'))return toast('INVITE LINK COPIED!')}catch{}
    toast('Select and copy the highlighted invitation link.');
  };
  if(navigator.clipboard?.writeText)navigator.clipboard.writeText(field.value).then(()=>toast('INVITE LINK COPIED!')).catch(fallback);
  else fallback();
});
const captain=()=>room?.ownPicks[0]?.id===me;
bind('prevTeam',()=>{if(!room.myTeam||captain()){browse=(browse+room.roster.length-1)%room.roster.length;renderDraft()}});
bind('nextTeam',()=>{if(!room.myTeam||captain()){browse=(browse+1)%room.roster.length;renderDraft()}});
bind('lockTeam',()=>send({t:'team',id:room.roster[browse].id}));
bind('readyBtn',()=>{
  const self=room.ownPicks.find(m=>m.id===me);
  if(self?.ready)return send({t:'ready',value:false});
  if(!selected||room.ownPicks.length===1&&!support)return toast('Choose both players first.');
  send({t:'pick',pick:selected,support:room.ownPicks.length===1?support:undefined});
  send({t:'ready',value:true});
});
bind('pauseBtn',()=>send({t:'pause'}));
$('gameOverlay').addEventListener('click',e=>{if(e.target.closest('[data-action="rematch"]'))send({t:'rematch'})});
function renderLobby(){
  const self=room.members.find(p=>p.id===me);
  if(self?.initials)$('initials').value=self.initials;
  $('lobbyPlayers').innerHTML=Array.from({length:4},(_,i)=>{
    const m=room.members[i];
    return '<div class="seat '+(m?'occupied':'')+'"><div class="seatName">'+(m?escapeHTML(m.initials||'???'):'---')+'</div><small>'+
       (m?(m.id===me?'YOU · ':'')+(m.connected?'ONLINE':'OFFLINE')+' · '+(m.side===0?'LEFT':'RIGHT'):'OPEN SLOT')+'</small></div>';
  }).join('');
  if(!room.isHost){
    $('hostOptions').innerHTML='<h3>WAITING FOR THE HOST</h3><p class="muted">The host will assign teams and open the character draft.</p>';return;
  }
  let html='<h3>3. CHOOSE TEAM ASSIGNMENT</h3><div class="radioRow">';
  for(const [type,label] of [['random','RANDOM TEAMS'],['assigned','HOST ASSIGNS']]){
    html+='<label><input type="radio" name="mode" value="'+type+'" '+(room.mode===type?'checked':'')+'> '+label+'</label>';
  }
  html+='</div>';
  if(room.mode==='assigned'){
    html+='<h3>4. SORT PLAYERS INTO SIDES</h3>';
    for(const m of room.members){
      html+='<div class="assignLine"><b>'+escapeHTML(m.initials||'???')+'</b><div>'+
        '<button data-action="assign" data-id="'+m.id+'" data-side="0" '+(m.side===0?'disabled':'')+'>LEFT</button> '+
        '<button data-action="assign" data-id="'+m.id+'" data-side="1" '+(m.side===1?'disabled':'')+'>RIGHT</button></div></div>';
    }
  }
  const allowed=room.members.length>=2&&room.members.every(m=>m.initials);
  html+='<button class="btn primary full" data-action="advance" '+(!allowed?'disabled':'')+'>START TEAM DRAFT →</button>'+
    '<p class="muted tiny">With 4 players, drafting begins as soon as all initials are set. Otherwise the host starts the draft.</p>';
  $('hostOptions').innerHTML=html;
}
$('hostOptions').addEventListener('change',e=>{if(e.target.name==='mode')send({t:'mode',mode:e.target.value})});
$('hostOptions').addEventListener('click',e=>{
  const el=e.target.closest('[data-action]');if(!el)return;
  if(el.dataset.action==='advance')send({t:'advance'});
  if(el.dataset.action==='assign')send({t:'assign',id:el.dataset.id,side:Number(el.dataset.side)});
});
function renderDraft(){
  if(!room)return;
  if(room.myTeam&&!captain()){const i=room.roster.findIndex(t=>t.id===room.myTeam);if(i>=0)browse=i}
  const team=room.roster[browse],mine=room.ownPicks.find(p=>p.id===me),locked=room.myTeam===team.id;
  SpriteArt.preloadTeam(team.id);
  const isSoloSide=room.ownPicks.length===1;
  $('teamName').textContent=team.name;$('teamName').style.color=team.primary;
  $('teamIcon').innerHTML=TeamBrand.crest(team,108);$('teamIcon').style.color=team.primary;
  $('draft').style.setProperty('--team-accent',team.primary);
  $('draftBackSolo').hidden=!room.solo;
  $('teamDesc').textContent=descriptions[team.id]||'Original arena squad';
  $('draftInfo').textContent=room.solo?'VS '+(room.roster.find(t=>t.id===room.soloOpponent)?.name||'CPU'):
    isSoloSide?'CHOOSE YOUR DUO':'CHOOSE YOUR PLAYER';
  $('lockTeam').style.display=room.solo?'none':captain()?'':'none';
  $('prevTeam').disabled=!!room.solo||!captain();$('nextTeam').disabled=!!room.solo||!captain();
  $('lockTeam').textContent=locked?'✓ TEAM SELECTED':'CHOOSE '+team.name;
  $('lockTeam').disabled=!!mine?.ready;
  const allowed=!!room.myTeam&&locked&&!mine?.ready;
  $('teamHelp').textContent=allowed?'Pick '+(isSoloSide?'your athlete and CPU partner.':'the athlete you will control.'):'Team captain selects a team first.';
  const partner=room.ownPicks.filter(p=>p.id!==me);
  $('pickSummary').innerHTML='YOU: '+escapeHTML(team.players.find(p=>p.id===selected)?.name||'NOT PICKED')+
    (isSoloSide?'<br>CPU PARTNER: '+escapeHTML(team.players.find(p=>p.id===support)?.name||'NOT PICKED'):'')+
    partner.map(p=>'<br>'+escapeHTML(p.initials)+': '+escapeHTML(team.players.find(q=>q.id===p.pick)?.name||'CHOOSING…')).join('')+
    '<br>OPPOSING PLAYERS READY: '+room.otherTeamReady;
  $('rosterCards').innerHTML=team.players.map(p=>{
    const taken=partner.some(m=>m.pick===p.id),own=selected===p.id,second=support===p.id;
    return '<button class="charCard '+(own?'selected':second?'support':'')+'" data-pick="'+p.id+'" '+(!allowed||taken?'disabled':'')+'>'+
      '<canvas width="112" height="134" data-portrait="'+p.id+'"></canvas>'+
      '<strong>'+escapeHTML(p.name)+'</strong><small>'+escapeHTML(p.archetype)+'</small><span class="pickTag">'+
      (own?'★ STARTER':second?'◆ PARTNER':taken?'TEAMMATE PICK':'TAP TO DRAFT')+'</span></button>';
  }).join('');
  for(const portrait of $('rosterCards').querySelectorAll('canvas')){
    const p=team.players.find(p=>p.id===portrait.dataset.portrait),c=portrait.getContext('2d');
    c.imageSmoothingEnabled=false;
    if(!SpriteArt.draw(c,p,56,128,1.88,0,'idle',{face:1,direction:3}))drawAvatar(c,p,team,56,120,2.2,0,'idle',false);
  }
  $('readyBtn').disabled=!allowed&&!mine?.ready||!selected||(isSoloSide&&!support);
  $('readyBtn').textContent=mine?.ready?'✓ READY — TAP TO CHANGE':room.solo?'🏀 TIP OFF · PLAY NOW':'CONFIRM PLAYER · READY';
  const focus=team.players.find(p=>p.id===support)||team.players.find(p=>p.id===selected)||team.players[0];
  $('scoutName').textContent=focus.name.toUpperCase();$('scoutType').textContent=focus.archetype;
  drawRadar(focus,team);
}
$('rosterCards').addEventListener('click',e=>{
  const element=e.target.closest('[data-pick]');if(!element||!room)return;
  const id=element.dataset.pick;
  if(room.ownPicks.some(p=>p.id!==me&&p.pick===id))return toast('Your teammate has picked that player.');
  const isSoloSide=room.ownPicks.length===1;
  if(selected===id){selected=null;support=null}
  else if(isSoloSide&&selected&&!support)support=id;
  else if(isSoloSide&&selected&&support){selected=id;support=null}
  else selected=id;
  if(selected&&(!isSoloSide||support))send({t:'pick',pick:selected,support:support||undefined});
  renderDraft();
});
function drawRadar(p,team){
  const c=$('radar').getContext('2d'),W=370,H=315,cx=185,cy=152,R=100;
  c.clearRect(0,0,W,H);
  const keys=['speed','three','dunk','block','steal','pass'],labels=['SPEED','3PT','DUNK','BLK/REB','STEAL','PASS'];
  const pt=(i,r)=>[cx+Math.sin(i*Math.PI/3)*r,cy-Math.cos(i*Math.PI/3)*r];
  for(let r=1;r<=5;r++){
    c.beginPath();for(let i=0;i<6;i++){const a=pt(i,R*r/5);if(i===0)c.moveTo(...a);else c.lineTo(...a)}
    c.closePath();c.strokeStyle=r===5?'#778eb6':'#2b3e63';c.lineWidth=r===5?2:1;c.stroke();
  }
  for(let i=0;i<6;i++){c.beginPath();c.moveTo(cx,cy);c.lineTo(...pt(i,R));c.strokeStyle='#495d86';c.stroke()}
  c.beginPath();keys.forEach((key,i)=>{const xy=pt(i,R*p.stats[key]/100);i?c.lineTo(...xy):c.moveTo(...xy)});
  c.closePath();c.fillStyle=team.primary+'88';c.fill();c.strokeStyle=team.primary;c.lineWidth=3;c.stroke();
  c.textAlign='center';c.textBaseline='middle';
  keys.forEach((key,i)=>{
    const point=pt(i,R*p.stats[key]/100),label=pt(i,R+27);
    c.beginPath();c.arc(...point,3,0,7);c.fillStyle='white';c.fill();
    c.font='bold 11px monospace';c.fillStyle='#b4ffd9';c.fillText(labels[i],label[0],label[1]-6);
    c.font='bold 14px monospace';c.fillStyle='#ffe09e';c.fillText(p.stats[key],label[0],label[1]+9);
  });
}
const keyMap={KeyW:'up',ArrowUp:'up',KeyS:'down',ArrowDown:'down',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',KeyJ:'shoot',KeyK:'pass',KeyI:'jump',KeyL:'sprint',KeyQ:'switch'};
function keyChange(k,val){if(keys[k]===val)return;keys[k]=val;if(room?.phase==='game')send({t:'input',keys})}
addEventListener('keydown',e=>{if(room?.phase!=='game'||!keyMap[e.code]||['INPUT','TEXTAREA'].includes(document.activeElement?.tagName))return;
  e.preventDefault();keyChange(keyMap[e.code],true)});
addEventListener('keyup',e=>{if(keyMap[e.code]){if(room?.phase==='game')e.preventDefault();keyChange(keyMap[e.code],false)}});
addEventListener('blur',()=>{Object.keys(keys).forEach(k=>keys[k]=false);if(room?.phase==='game')send({t:'input',keys})});
for(const button of $('touchControls').querySelectorAll('[data-key]')){
  const k=button.dataset.key;
  button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);keyChange(k,true)});
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(ev,e=>{e.preventDefault();keyChange(k,false)});
}
SpriteArt.onChange(id=>{
  if(room?.phase==='draft'&&room.roster[browse]?.players.some(p=>p.id===id)&&$('draft').classList.contains('active'))renderDraft();
  if(room?.solo&&$('soloSelect').classList.contains('active'))renderSoloSelect();
  drawHomeAthletes();
});

function paintAthlete(canvas,player,team,scale=1.9){
  const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);
  c.imageSmoothingEnabled=false;
  const x=canvas.width/2,y=canvas.height-7;
  if(!SpriteArt.draw(c,player,x,y,scale,0,'idle',{direction:3,face:1})){
    if(typeof drawAvatar==='function')drawAvatar(c,player,team,x,y,Math.min(2.4,scale),0,'idle',false);
  }
}
function drawHomeAthletes(){
  const leaf=$('homeLeaf'),brock=$('homeBrock');
  if(!leaf||!brock)return;
  const teams=room?.roster||homeTeams;
  if(!teams)return;
  for(const [canvas,team,player] of [[leaf,teams[0],teams[0].players[3]],[brock,teams[1],teams[1].players[0]]]){
    SpriteArt.preloadTeam(team.id);paintAthlete(canvas,player,team,2.7);
  }
}
function renderMiniRoster(team,id){
  const holder=$(id);
  holder.innerHTML=team.players.map(p=>'<div class="miniAthlete"><canvas width="76" height="84" data-athlete="'+p.id+'"></canvas><span>'+escapeHTML(p.name)+'</span></div>').join('');
  SpriteArt.preloadTeam(team.id);
  for(const canvas of holder.querySelectorAll('canvas')){
    const player=team.players.find(p=>p.id===canvas.dataset.athlete);
    paintAthlete(canvas,player,team,1.13);
  }
}
function renderSoloSelect(){
  if(!room?.solo)return;
  const own=room.roster[soloMyIndex],opponent=room.roster[soloOppIndex];
  $('soloOwnPanel').style.setProperty('--team-accent',own.primary);
  $('soloOppPanel').style.setProperty('--team-accent',opponent.primary);
  $('soloMyLogo').innerHTML=TeamBrand.crest(own,120);
  $('soloOppLogo').innerHTML=TeamBrand.crest(opponent,120);
  $('soloMyName').textContent=own.name;
  $('soloOppName').textContent=opponent.name;
  $('soloMyTag').textContent=TeamBrand.motto(own.id);
  $('soloOppTag').textContent=TeamBrand.motto(opponent.id);
  renderMiniRoster(own,'soloMyRoster');
  renderMiniRoster(opponent,'soloOppRoster');
}
for(const [id,which,step] of [
  ['soloMyPrev','my',-1],['soloMyNext','my',1],
  ['soloOppPrev','opponent',-1],['soloOppNext','opponent',1]
]){
  bind(id,()=>{
    if(!room?.solo)return;
    if(which==='my')soloMyIndex=(soloMyIndex+step+room.roster.length)%room.roster.length;
    else soloOppIndex=(soloOppIndex+step+room.roster.length)%room.roster.length;
    renderSoloSelect();
  });
}
bind('soloContinue',()=>{
  if(!room?.solo)return;
  soloConfirmed=true;
  send({t:'team',id:room.roster[soloMyIndex].id});
  send({t:'opponent-team',id:room.roster[soloOppIndex].id});
  toast('MATCHUP SET — CHOOSE YOUR TWO ATHLETES');
});
function showModal(title,body){
  $('modalTitle').textContent=title;$('modalBody').innerHTML=body;
  $('modal').classList.remove('hidden');$('closeModal').focus();
}
function closeModal(){$('modal').classList.add('hidden')}
bind('closeModal',closeModal);
$('modal').addEventListener('click',e=>{if(e.target===$('modal'))closeModal()});
addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('modal').classList.contains('hidden'))closeModal()});
bind('howBtn',()=>showModal('HOW TO PLAY',
  '<p>Pick a team, choose two athletes, then outscore your opponent in 2-on-2 arcade basketball.</p>'+
  '<p><b>WASD</b> — Move · <b>J</b> — Hold and release to shoot · <b>K</b> — Pass / Steal · <b>I</b> — Block · <b>L</b> — Sprint · <b>Q</b> — Switch your solo player.</p>'+
  '<p>Play solo against CPU athletes or share a multiplayer lobby link with friends. Both teams field two athletes.</p>'));
bind('optionsBtn',()=>showModal('SETTINGS',
  '<label class="settingToggle"><input type="checkbox" id="settingSound" '+(window.arcadeAudioEnabled?'checked':'')+'> ENABLE ARCADE SOUND EFFECTS</label>'+
  '<p>Changes take effect immediately and are saved on this device.</p>'));
$('modalBody').addEventListener('change',e=>{
  if(e.target.id==='settingSound'){window.arcadeAudioEnabled=e.target.checked;
    localStorage.setItem('boom-audio',e.target.checked?'on':'off')}
});

code=new URLSearchParams(location.search).get('room')?.toUpperCase()||null;
if(code)$('joinCode').value=code;
fetch('/api/roster').then(r=>{if(!r.ok)throw Error('Roster not available');return r.json()})
  .then(roster=>{homeTeams=roster;drawHomeAthletes()}).catch(()=>{});
connect();
