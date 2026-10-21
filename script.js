'use strict';

const SIZE = 9;
const INITIAL_TIME = 90;
const WALLS = [
  [0,0],[0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[0,7],[0,8],
  [8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,6],[8,7],[8,8],
  [1,0],[2,0],[3,0],[4,0],[5,0],[6,0],[7,0],
  [1,8],[2,8],[3,8],[4,8],[5,8],[6,8],[7,8],
  [2,2],[2,4],[2,6],[4,2],[4,4],[4,6],[6,2],[6,4],[6,6]
];
const INITIAL_CRATES = [[1,3],[1,6],[2,3],[3,2],[3,4],[3,6],[4,5],[5,2],[5,4],[5,6],[6,3],[7,5]];
const INITIAL_HAZARDS = [
  {x:1,y:7,icon:'💍',name:'Joya en producción',tip:'Las joyas pueden desprenderse y convertirse en cuerpos extraños. Deben retirarse antes de entrar al área.'},
  {x:3,y:7,icon:'🦠',name:'Contaminación cruzada',tip:'Separa utensilios, materias primas y superficies de acuerdo con el riesgo del proceso.'},
  {x:5,y:7,icon:'🌡️',name:'Temperatura fuera de control',tip:'Verifica, registra y reporta cualquier temperatura que esté fuera de la especificación definida.'},
  {x:7,y:7,icon:'📦',name:'Empaque dañado',tip:'Aísla el producto, evita su liberación y reporta la desviación para evaluación.'},
  {x:7,y:3,icon:'🥜',name:'Alérgeno sin controlar',tip:'Mantén la segregación e implementa la limpieza definida para evitar contacto cruzado.'}
];

const $ = id => document.getElementById(id);
const key = (x,y) => `${x}-${y}`;
const same = (a,b) => a.x === b.x && a.y === b.y;
const wallSet = new Set(WALLS.map(([x,y]) => key(x,y)));
let state;
let timerId;
let feedbackId;

function freshState(){
  return {
    player:{x:1,y:1}, crates:INITIAL_CRATES.map(c=>[...c]),
    hazards:INITIAL_HAZARDS.map(h=>({...h})), charges:[], blasts:[],
    lives:3, score:0, time:INITIAL_TIME, running:false, neutralized:[]
  };
}

function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  $(id).classList.add('active');
}

function startGame(){
  clearInterval(timerId);
  state=freshState(); state.running=true;
  const name=$('playerName').value.trim() || 'Guardián de Calidad';
  $('playerGreeting').textContent=`Jugador: ${name}`;
  showScreen('gameScreen'); render();
  timerId=setInterval(()=>{
    if(!state.running) return;
    state.time--;
    updateStatus();
    if(state.time<=0) endGame(false,'Se agotó el tiempo y aún quedan riesgos activos.');
  },1000);
}

function blocked(x,y){
  return wallSet.has(key(x,y)) || state.crates.some(([cx,cy])=>cx===x&&cy===y);
}

function move(dx,dy){
  if(!state?.running) return;
  const next={x:state.player.x+dx,y:state.player.y+dy};
  if(next.x<0||next.y<0||next.x>=SIZE||next.y>=SIZE||blocked(next.x,next.y)) return;
  const hazard=state.hazards.find(h=>same(h,next));
  if(hazard){
    state.lives--; state.score=Math.max(0,state.score-100);
    showFeedback('bad','¡Riesgo detectado!',`${hazard.name}. Neutralízalo antes de avanzar.`);
    $('board').classList.add('shake'); setTimeout(()=>$('board').classList.remove('shake'),320);
    if(state.lives<=0){ render(); endGame(false,'Te quedaste sin vidas al entrar en zonas de riesgo.'); return; }
  } else state.player=next;
  render();
}

function placeCharge(){
  if(!state?.running || state.charges.some(c=>same(c,state.player))) return;
  const charge={...state.player,id:Date.now()};
  state.charges.push(charge); render();
  setTimeout(()=>detonate(charge),800);
}

function detonate(charge){
  if(!state?.running) return;
  const area=[[0,0],[1,0],[-1,0],[0,1],[0,-1]]
    .map(([dx,dy])=>({x:charge.x+dx,y:charge.y+dy}))
    .filter(p=>p.x>=0&&p.y>=0&&p.x<SIZE&&p.y<SIZE&&!wallSet.has(key(p.x,p.y)));
  state.charges=state.charges.filter(c=>c.id!==charge.id);
  state.blasts=area;
  const hits=state.hazards.filter(h=>area.some(a=>same(a,h)));
  if(hits.length){
    state.score+=hits.length*200;
    hits.forEach(h=>state.neutralized.push(h));
    state.hazards=state.hazards.filter(h=>!hits.some(hit=>same(hit,h)));
    showFeedback('good',`Riesgo neutralizado: ${hits[0].name}`,hits[0].tip);
  }
  state.crates=state.crates.filter(([x,y])=>!area.some(a=>a.x===x&&a.y===y));
  if(area.some(a=>same(a,state.player))){
    state.lives--; state.score=Math.max(0,state.score-50);
    if(!hits.length) showFeedback('bad','¡Cuidado con la carga!','Debes colocarla y alejarte. Planificar también hace parte de trabajar con seguridad.');
  }
  render();
  setTimeout(()=>{state.blasts=[];render();if(state.hazards.length===0) endGame(true);else if(state.lives<=0) endGame(false,'Te quedaste sin vidas durante la misión.');},430);
}

function render(){
  const board=$('board'); board.innerHTML='';
  for(let y=0;y<SIZE;y++) for(let x=0;x<SIZE;x++){
    const cell=document.createElement('div'); cell.className='cell';
    if(wallSet.has(key(x,y))) cell.classList.add('wall');
    const crate=state.crates.some(([cx,cy])=>cx===x&&cy===y);
    const hazard=state.hazards.find(h=>h.x===x&&h.y===y);
    const charge=state.charges.find(c=>c.x===x&&c.y===y);
    const blast=state.blasts.some(b=>b.x===x&&b.y===y);
    if(crate) addEntity(cell,'📦','crate','Caja que bloquea el camino');
    if(hazard) addEntity(cell,hazard.icon,'hazard',hazard.name);
    if(charge) addEntity(cell,'🧴','charge','Carga de saneamiento activa');
    if(state.player.x===x&&state.player.y===y) addEntity(cell,'🧑‍🔬','player','Jugador');
    if(blast){const b=document.createElement('div');b.className='entity blast';cell.appendChild(b);}
    board.appendChild(cell);
  }
  updateStatus();
}

function addEntity(cell,content,className,label){
  const span=document.createElement('span'); span.className=`entity ${className}`;
  span.textContent=content; span.title=label; span.setAttribute('aria-label',label); cell.appendChild(span);
}

function updateStatus(){
  $('livesValue').textContent=state.lives; $('scoreValue').textContent=state.score;
  $('timeValue').textContent=state.time; $('remainingValue').textContent=state.hazards.length;
  const done=INITIAL_HAZARDS.length-state.hazards.length;
  $('progressText').textContent=`${done}/${INITIAL_HAZARDS.length}`;
  $('progressBar').style.width=`${(done/INITIAL_HAZARDS.length)*100}%`;
}

function showFeedback(type,title,text){
  clearTimeout(feedbackId);
  const box=$('feedback'); box.className=`feedback show ${type==='bad'?'bad':''}`;
  box.innerHTML=`<strong>${escapeHtml(title)}</strong>${escapeHtml(text)}`;
  feedbackId=setTimeout(()=>box.classList.remove('show'),3300);
}

function escapeHtml(text){
  const div=document.createElement('div'); div.textContent=text; return div.innerHTML;
}

function endGame(win,reason=''){
  if(!state.running) return;
  state.running=false; clearInterval(timerId);
  if(win) state.score+=state.time*5+state.lives*100;
  $('endIcon').textContent=win?'🏆':'🚨';
  $('endTitle').textContent=win?'¡Planta protegida!':'Misión incompleta';
  $('endMessage').textContent=win?'Neutralizaste los riesgos de calidad y protegiste al consumidor.':reason;
  $('finalScore').textContent=state.score;
  const learned=state.neutralized.length?state.neutralized:INITIAL_HAZARDS.slice(0,3);
  $('learningSummary').innerHTML=`<h3>Aprendizajes de la misión</h3><ul>${learned.map(h=>`<li><b>${escapeHtml(h.name)}:</b> ${escapeHtml(h.tip)}</li>`).join('')}</ul>`;
  showScreen('endScreen');
}

document.addEventListener('keydown',event=>{
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(event.key)) event.preventDefault();
  const k=event.key.toLowerCase();
  if(k==='arrowup'||k==='w') move(0,-1);
  else if(k==='arrowdown'||k==='s') move(0,1);
  else if(k==='arrowleft'||k==='a') move(-1,0);
  else if(k==='arrowright'||k==='d') move(1,0);
  else if(event.code==='Space') placeCharge();
});
$('startButton').addEventListener('click',startGame);
$('restartButton').addEventListener('click',startGame);
$('sanitizeButton').addEventListener('click',placeCharge);
$('mobileSanitize').addEventListener('click',placeCharge);
document.querySelectorAll('[data-move]').forEach(button=>button.addEventListener('click',()=>{
  const moves={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}; move(...moves[button.dataset.move]);
}));
$('playerName').addEventListener('keydown',e=>{if(e.key==='Enter') startGame();});
