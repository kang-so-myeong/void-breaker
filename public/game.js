// ═══════════════════════════════════════════
// VOID BREAKER - Neon Space Shooter
// ═══════════════════════════════════════════

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ── Config ──
const CFG = {
  PLAYER_SPEED: 320, DASH_SPEED: 900, DASH_DUR: 0.15, DASH_CD: 1.5,
  BULLET_SPEED: 700, FIRE_RATE: 0.12, ENEMY_SPAWN_BASE: 1.5,
  MAX_HP: 100, INVULN_TIME: 1.0,
  STAR_LAYERS: 3, STARS_PER_LAYER: 80,
};

// ── Resize ──
function resize() {
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize); resize();

// ── Util ──
const rand = (a,b) => Math.random()*(b-a)+a;
const randInt = (a,b) => Math.floor(rand(a,b+1));
const dist = (a,b) => Math.hypot(a.x-b.x, a.y-b.y);
const lerp = (a,b,t) => a+(b-a)*t;
const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
const TAU = Math.PI*2;

// ── Color helpers ──
function hsl(h,s,l,a=1){ return `hsla(${h},${s}%,${l}%,${a})`; }
const COLORS = {
  cyan:'#00ffff', magenta:'#ff00ff', yellow:'#ffff00', orange:'#ff8800',
  red:'#ff0044', green:'#00ff88', white:'#ffffff', pink:'#ff66aa',
};

// ═══════ SOUND SYSTEM (Web Audio) ═══════
class SoundSys {
  constructor(){ this.ctx=null; this.vol=null; }
  init(){
    this.ctx=new (window.AudioContext||window.webkitAudioContext)();
    this.vol=this.ctx.createGain(); this.vol.gain.value=0.3; this.vol.connect(this.ctx.destination);
  }
  play(type){
    if(!this.ctx) return;
    const t=this.ctx.currentTime;
    const o=this.ctx.createOscillator(); const g=this.ctx.createGain();
    o.connect(g); g.connect(this.vol);
    switch(type){
      case'shoot': o.frequency.setValueAtTime(880,t); o.frequency.exponentialRampToValueAtTime(440,t+0.06);
        g.gain.setValueAtTime(0.15,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.06); o.type='square'; o.start(t); o.stop(t+0.06); break;
      case'hit': o.frequency.setValueAtTime(200,t); o.frequency.exponentialRampToValueAtTime(60,t+0.15);
        g.gain.setValueAtTime(0.3,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.15); o.type='sawtooth'; o.start(t); o.stop(t+0.15); break;
      case'explode': o.frequency.setValueAtTime(150,t); o.frequency.exponentialRampToValueAtTime(30,t+0.3);
        g.gain.setValueAtTime(0.4,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.3); o.type='sawtooth'; o.start(t); o.stop(t+0.3); break;
      case'powerup': o.frequency.setValueAtTime(440,t); o.frequency.exponentialRampToValueAtTime(1760,t+0.2);
        g.gain.setValueAtTime(0.2,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.25); o.type='sine'; o.start(t); o.stop(t+0.25); break;
      case'dash': o.frequency.setValueAtTime(300,t); o.frequency.exponentialRampToValueAtTime(900,t+0.1);
        g.gain.setValueAtTime(0.15,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.1); o.type='triangle'; o.start(t); o.stop(t+0.1); break;
      case'boss': o.frequency.setValueAtTime(80,t); o.frequency.exponentialRampToValueAtTime(40,t+0.8);
        g.gain.setValueAtTime(0.5,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.8); o.type='sawtooth'; o.start(t); o.stop(t+0.8); break;
      case'combo': o.frequency.setValueAtTime(660,t); o.frequency.exponentialRampToValueAtTime(1320,t+0.08);
        g.gain.setValueAtTime(0.12,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.1); o.type='sine'; o.start(t); o.stop(t+0.1); break;
    }
  }
}
const snd = new SoundSys();

// ═══════ PARTICLE SYSTEM ═══════
class Particle {
  constructor(x,y,vx,vy,life,size,color,glow=0){
    Object.assign(this,{x,y,vx,vy,life,maxLife:life,size,color,glow,active:true});
  }
  update(dt){
    this.x+=this.vx*dt; this.y+=this.vy*dt;
    this.life-=dt; if(this.life<=0) this.active=false;
    this.vx*=0.98; this.vy*=0.98;
  }
  draw(ctx){
    const a=this.life/this.maxLife;
    ctx.globalAlpha=a;
    if(this.glow>0){ ctx.shadowBlur=this.glow*a; ctx.shadowColor=this.color; }
    ctx.fillStyle=this.color;
    ctx.beginPath(); ctx.arc(this.x,this.y,this.size*a,0,TAU); ctx.fill();
    ctx.shadowBlur=0; ctx.globalAlpha=1;
  }
}

const particles=[];
function spawnParticles(x,y,count,color,speed=200,life=0.6,size=3,glow=10){
  for(let i=0;i<count;i++){
    const a=rand(0,TAU), s=rand(speed*0.3,speed);
    particles.push(new Particle(x,y,Math.cos(a)*s,Math.sin(a)*s,rand(life*0.5,life),rand(size*0.5,size),color,glow));
  }
}
function explosion(x,y,size=1){
  spawnParticles(x,y,Math.floor(20*size),COLORS.orange,300*size,0.8,4*size,15);
  spawnParticles(x,y,Math.floor(15*size),COLORS.yellow,200*size,0.5,3*size,10);
  spawnParticles(x,y,Math.floor(10*size),COLORS.white,100*size,0.3,2*size,8);
}

// ═══════ STAR FIELD ═══════
const stars=[];
function initStars(){
  stars.length=0;
  for(let layer=0;layer<CFG.STAR_LAYERS;layer++){
    for(let i=0;i<CFG.STARS_PER_LAYER;i++){
      stars.push({x:rand(0,canvas.width),y:rand(0,canvas.height),
        size:rand(0.5,2)*(layer+1)*0.5, speed:(layer+1)*15,
        brightness:rand(0.3,1), layer, twinkle:rand(0,TAU)});
    }
  }
}

function updateStars(dt){
  stars.forEach(s=>{
    s.y+=s.speed*dt; s.twinkle+=dt*2;
    if(s.y>canvas.height){s.y=0;s.x=rand(0,canvas.width);}
  });
}
function drawStars(ctx){
  stars.forEach(s=>{
    const a=s.brightness*(0.7+0.3*Math.sin(s.twinkle));
    ctx.globalAlpha=a;
    ctx.fillStyle=s.layer===2?'#aaddff':s.layer===1?'#ddeeff':'#ffffff';
    ctx.beginPath(); ctx.arc(s.x,s.y,s.size,0,TAU); ctx.fill();
  });
  ctx.globalAlpha=1;
}

// ═══════ PLAYER ═══════
class Player {
  constructor(){
    this.x=canvas.width/2; this.y=canvas.height*0.75;
    this.hp=CFG.MAX_HP; this.maxHp=CFG.MAX_HP;
    this.angle=0; this.vx=0; this.vy=0;
    this.fireTimer=0; this.firing=false;
    this.dashTimer=0; this.dashCd=0; this.dashing=false; this.dashAngle=0;
    this.invuln=0; this.weapon='normal'; this.weaponTimer=0;
    this.trailTimer=0;
  }
  update(dt,keys,mouse){
    // Movement
    let mx=0,my=0;
    if(keys['w']||keys['arrowup']) my=-1;
    if(keys['s']||keys['arrowdown']) my=1;
    if(keys['a']||keys['arrowleft']) mx=-1;
    if(keys['d']||keys['arrowright']) mx=1;
    const len=Math.hypot(mx,my)||1;
    mx/=len; my/=len;

    if(this.dashing){
      this.dashTimer-=dt;
      this.x+=Math.cos(this.dashAngle)*CFG.DASH_SPEED*dt;
      this.y+=Math.sin(this.dashAngle)*CFG.DASH_SPEED*dt;
      this.trailTimer-=dt;
      if(this.trailTimer<=0){
        this.trailTimer=0.015;
        spawnParticles(this.x,this.y,3,COLORS.cyan,100,0.3,4,12);
      }
      if(this.dashTimer<=0) this.dashing=false;
    } else {
      this.x+=mx*CFG.PLAYER_SPEED*dt; this.y+=my*CFG.PLAYER_SPEED*dt;
    }
    this.x=clamp(this.x,20,canvas.width-20);
    this.y=clamp(this.y,20,canvas.height-20);

    // Aim at mouse
    this.angle=Math.atan2(mouse.y-this.y, mouse.x-this.x);

    // Dash cooldown
    if(this.dashCd>0) this.dashCd-=dt;
    if(this.invuln>0) this.invuln-=dt;
    if(this.weaponTimer>0){this.weaponTimer-=dt; if(this.weaponTimer<=0) this.weapon='normal';}

    // Firing
    this.fireTimer-=dt;
    if(this.firing && this.fireTimer<=0){
      this.fireTimer=this.weapon==='spread'?0.18:this.weapon==='rapid'?0.05:CFG.FIRE_RATE;
      this.shoot();
    }

    // Engine trail
    this.trailTimer-=dt;
    if(!this.dashing && this.trailTimer<=0){
      this.trailTimer=0.04;
      const bx=this.x-Math.cos(this.angle)*18, by=this.y-Math.sin(this.angle)*18;
      particles.push(new Particle(bx+rand(-3,3),by+rand(-3,3),
        -Math.cos(this.angle)*rand(30,80),-Math.sin(this.angle)*rand(30,80)+rand(-20,20),
        rand(0.15,0.3),rand(1.5,3),rand(0,1)>0.5?COLORS.cyan:COLORS.magenta,6));
    }
  }
  shoot(){
    const bx=this.x+Math.cos(this.angle)*22, by=this.y+Math.sin(this.angle)*22;
    snd.play('shoot');
    if(this.weapon==='spread'){
      for(let i=-1;i<=1;i++){
        const a=this.angle+i*0.15;
        game.bullets.push({x:bx,y:by,vx:Math.cos(a)*CFG.BULLET_SPEED,vy:Math.sin(a)*CFG.BULLET_SPEED,
          dmg:8,size:4,color:COLORS.yellow,glow:8,player:true});
      }
    } else if(this.weapon==='rapid'){
      const a=this.angle+rand(-0.05,0.05);
      game.bullets.push({x:bx,y:by,vx:Math.cos(a)*CFG.BULLET_SPEED*1.2,vy:Math.sin(a)*CFG.BULLET_SPEED*1.2,
        dmg:5,size:3,color:COLORS.green,glow:6,player:true});
    } else {
      game.bullets.push({x:bx,y:by,vx:Math.cos(this.angle)*CFG.BULLET_SPEED,vy:Math.sin(this.angle)*CFG.BULLET_SPEED,
        dmg:12,size:5,color:COLORS.cyan,glow:10,player:true});
    }
  }
  dash(keys){
    if(this.dashCd>0||this.dashing) return;
    let dx=0,dy=0;
    if(keys['w']||keys['arrowup']) dy=-1;
    if(keys['s']||keys['arrowdown']) dy=1;
    if(keys['a']||keys['arrowleft']) dx=-1;
    if(keys['d']||keys['arrowright']) dx=1;
    if(dx===0&&dy===0) dx=Math.cos(this.angle),dy=Math.sin(this.angle);
    this.dashAngle=Math.atan2(dy,dx);
    this.dashing=true; this.dashTimer=CFG.DASH_DUR; this.dashCd=CFG.DASH_CD;
    this.invuln=CFG.DASH_DUR+0.1;
    snd.play('dash');
  }
  takeDmg(dmg){
    if(this.invuln>0||this.dashing) return;
    this.hp-=dmg; this.invuln=CFG.INVULN_TIME;
    snd.play('hit');
    spawnParticles(this.x,this.y,12,COLORS.red,150,0.4,3,8);
    game.shake(6,0.2);
  }
  draw(ctx){
    ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(this.angle);
    // Flash when invulnerable
    if(this.invuln>0 && Math.sin(this.invuln*30)>0){ ctx.globalAlpha=0.4; }
    // Ship body
    ctx.shadowBlur=15; ctx.shadowColor=COLORS.cyan;
    ctx.fillStyle=COLORS.cyan; ctx.strokeStyle=COLORS.white; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(22,0); ctx.lineTo(-14,-12); ctx.lineTo(-8,0); ctx.lineTo(-14,12); ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Cockpit
    ctx.fillStyle=COLORS.magenta; ctx.shadowColor=COLORS.magenta;
    ctx.beginPath(); ctx.arc(2,0,4,0,TAU); ctx.fill();
    ctx.shadowBlur=0; ctx.globalAlpha=1; ctx.restore();

    // Shield indicator
    if(this.dashing){
      ctx.save(); ctx.globalAlpha=0.3;
      ctx.strokeStyle=COLORS.cyan; ctx.lineWidth=3; ctx.shadowBlur=20; ctx.shadowColor=COLORS.cyan;
      ctx.beginPath(); ctx.arc(this.x,this.y,28,0,TAU); ctx.stroke();
      ctx.restore();
    }
  }
}

// ═══════ ENEMY TYPES ═══════
function createEnemy(type, wave){
  const W=canvas.width, H=canvas.height;
  const side=randInt(0,3);
  let x,y;
  if(side===0){x=rand(0,W);y=-30;} else if(side===1){x=W+30;y=rand(0,H);}
  else if(side===2){x=rand(0,W);y=H+30;} else {x=-30;y=rand(0,H);}

  const base={x,y,type,active:true,fireTimer:rand(0.5,2),shootCd:2,angle:0,time:0};
  const sc=1+wave*0.08; // scale difficulty

  switch(type){
    case'drifter': return {...base,hp:15*sc,maxHp:15*sc,speed:80+wave*5,size:14,color:COLORS.green,score:100,
      dmg:10,pattern:'sine',amp:60,freq:2};
    case'chaser': return {...base,hp:20*sc,maxHp:20*sc,speed:120+wave*8,size:12,color:COLORS.orange,score:150,dmg:15};
    case'shooter': return {...base,hp:25*sc,maxHp:25*sc,speed:50+wave*3,size:16,color:COLORS.magenta,score:200,
      dmg:10,shootCd:Math.max(0.6,2-wave*0.05)};
    case'tank': return {...base,hp:80*sc,maxHp:80*sc,speed:35,size:22,color:COLORS.red,score:350,dmg:20};
    case'spinner': return {...base,hp:30*sc,maxHp:30*sc,speed:60,size:15,color:COLORS.yellow,score:250,
      dmg:10,shootCd:Math.max(0.4,1.5-wave*0.04),spinSpeed:3};
    default: return {...base,hp:15*sc,maxHp:15*sc,speed:70,size:14,color:COLORS.green,score:100,dmg:10};
  }
}

function updateEnemy(e,dt,px,py){
  e.time+=dt;
  const a=Math.atan2(py-e.y, px-e.x);
  e.angle=a;

  switch(e.type){
    case'drifter':{
      const perp=a+Math.PI/2;
      e.x+=Math.cos(a)*e.speed*dt + Math.cos(perp)*Math.sin(e.time*e.freq)*e.amp*dt;
      e.y+=Math.sin(a)*e.speed*dt + Math.sin(perp)*Math.sin(e.time*e.freq)*e.amp*dt;
      break;}
    case'chaser':
      e.x+=Math.cos(a)*e.speed*dt; e.y+=Math.sin(a)*e.speed*dt; break;
    case'shooter':{
      const d=dist(e,{x:px,y:py});
      if(d>250){e.x+=Math.cos(a)*e.speed*dt; e.y+=Math.sin(a)*e.speed*dt;}
      e.fireTimer-=dt;
      if(e.fireTimer<=0){
        e.fireTimer=e.shootCd;
        game.bullets.push({x:e.x,y:e.y,vx:Math.cos(a)*350,vy:Math.sin(a)*350,
          dmg:8,size:4,color:COLORS.magenta,glow:6,player:false});
      } break;}
    case'tank':
      e.x+=Math.cos(a)*e.speed*dt; e.y+=Math.sin(a)*e.speed*dt; break;
    case'spinner':{
      const d=dist(e,{x:px,y:py});
      if(d>200){e.x+=Math.cos(a)*e.speed*dt; e.y+=Math.sin(a)*e.speed*dt;}
      e.fireTimer-=dt;
      if(e.fireTimer<=0){
        e.fireTimer=e.shootCd;
        for(let i=0;i<6;i++){
          const sa=e.time*e.spinSpeed+i*TAU/6;
          game.bullets.push({x:e.x,y:e.y,vx:Math.cos(sa)*250,vy:Math.sin(sa)*250,
            dmg:6,size:3,color:COLORS.yellow,glow:5,player:false});
        }
      } break;}
  }
}

function drawEnemy(ctx,e){
  ctx.save(); ctx.translate(e.x,e.y);
  ctx.shadowBlur=12; ctx.shadowColor=e.color;
  ctx.fillStyle=e.color; ctx.strokeStyle='#fff'; ctx.lineWidth=1;

  switch(e.type){
    case'drifter':
      ctx.rotate(e.time*2);
      ctx.beginPath(); for(let i=0;i<5;i++){const a=i*TAU/5-Math.PI/2;
        ctx.lineTo(Math.cos(a)*e.size,Math.sin(a)*e.size);
        const b=a+TAU/10; ctx.lineTo(Math.cos(b)*e.size*0.5,Math.sin(b)*e.size*0.5);}
      ctx.closePath(); ctx.fill(); ctx.stroke(); break;
    case'chaser':
      ctx.rotate(e.angle);
      ctx.beginPath(); ctx.moveTo(e.size,0); ctx.lineTo(-e.size*0.7,-e.size*0.8);
      ctx.lineTo(-e.size*0.7,e.size*0.8); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
    case'shooter':
      ctx.beginPath(); ctx.arc(0,0,e.size,0,TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#000'; ctx.beginPath(); ctx.arc(0,0,e.size*0.5,0,TAU); ctx.fill();
      ctx.fillStyle=e.color; ctx.beginPath(); ctx.arc(0,0,e.size*0.3,0,TAU); ctx.fill(); break;
    case'tank':
      ctx.rotate(e.angle);
      ctx.beginPath(); ctx.rect(-e.size,-e.size,e.size*2,e.size*2);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle='#fff'; ctx.beginPath(); ctx.rect(e.size*0.3,-3,e.size*0.8,6); ctx.fill(); break;
    case'spinner':
      ctx.rotate(e.time*e.spinSpeed);
      ctx.beginPath(); for(let i=0;i<3;i++){const a=i*TAU/3;
        ctx.lineTo(Math.cos(a)*e.size,Math.sin(a)*e.size);}
      ctx.closePath(); ctx.fill(); ctx.stroke(); break;
  }

  // HP bar
  if(e.hp<e.maxHp){
    ctx.shadowBlur=0; ctx.rotate(-e.angle+(e.type==='drifter'?-e.time*2:e.type==='spinner'?-e.time*e.spinSpeed:0));
    const bw=e.size*2, bh=3;
    ctx.fillStyle='rgba(255,255,255,0.2)'; ctx.fillRect(-bw/2,-e.size-8,bw,bh);
    ctx.fillStyle=e.color; ctx.fillRect(-bw/2,-e.size-8,bw*(e.hp/e.maxHp),bh);
  }
  ctx.restore();
}

// ═══════ BOSS ═══════
function createBoss(wave){
  return {x:canvas.width/2,y:-80,targetY:120,hp:300+wave*100,maxHp:300+wave*100,
    size:50,active:true,time:0,phase:0,fireTimer:0,score:2000+wave*500,
    color:COLORS.magenta,entered:false,dmg:25};
}

function updateBoss(b,dt,px,py){
  b.time+=dt;
  if(!b.entered){
    b.y=lerp(b.y,b.targetY,dt*1.5);
    if(Math.abs(b.y-b.targetY)<5) b.entered=true;
    return;
  }
  // Move side to side
  b.x=canvas.width/2+Math.sin(b.time*0.8)*300;

  b.fireTimer-=dt;
  if(b.fireTimer<=0){
    b.phase=(b.phase+1)%3;
    switch(b.phase){
      case 0: // Aimed burst
        b.fireTimer=1.5;
        for(let i=-2;i<=2;i++){
          const a=Math.atan2(py-b.y,px-b.x)+i*0.12;
          game.bullets.push({x:b.x,y:b.y,vx:Math.cos(a)*300,vy:Math.sin(a)*300,
            dmg:10,size:6,color:COLORS.magenta,glow:8,player:false});
        } break;
      case 1: // Spiral
        b.fireTimer=0.15;
        for(let i=0;i<3;i++){
          const a=b.time*4+i*TAU/3;
          game.bullets.push({x:b.x,y:b.y,vx:Math.cos(a)*220,vy:Math.sin(a)*220,
            dmg:8,size:4,color:COLORS.pink,glow:6,player:false});
        } break;
      case 2: // Shotgun
        b.fireTimer=2;
        const ba=Math.atan2(py-b.y,px-b.x);
        for(let i=0;i<12;i++){
          const a=ba+rand(-0.5,0.5);
          game.bullets.push({x:b.x,y:b.y,vx:Math.cos(a)*rand(200,400),vy:Math.sin(a)*rand(200,400),
            dmg:8,size:5,color:COLORS.red,glow:7,player:false});
        } break;
    }
  }
}

function drawBoss(ctx,b){
  ctx.save(); ctx.translate(b.x,b.y);
  // Core
  ctx.shadowBlur=30; ctx.shadowColor=b.color;
  ctx.fillStyle=b.color;
  ctx.beginPath();
  for(let i=0;i<8;i++){
    const a=i*TAU/8+b.time*0.5;
    const r=i%2===0?b.size:b.size*0.6;
    ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);
  }
  ctx.closePath(); ctx.fill();
  // Inner glow
  ctx.shadowBlur=20; ctx.shadowColor=COLORS.white;
  ctx.fillStyle=COLORS.white; ctx.globalAlpha=0.3;
  ctx.beginPath(); ctx.arc(0,0,b.size*0.35,0,TAU); ctx.fill();
  ctx.globalAlpha=1;
  // HP bar
  ctx.shadowBlur=0;
  const bw=b.size*2.5,bh=6;
  ctx.fillStyle='rgba(255,255,255,0.2)'; ctx.fillRect(-bw/2,b.size+12,bw,bh);
  ctx.fillStyle=b.hp/b.maxHp>0.3?COLORS.magenta:COLORS.red;
  ctx.fillRect(-bw/2,b.size+12,bw*(b.hp/b.maxHp),bh);
  // Boss label
  ctx.fillStyle='#fff'; ctx.font='bold 11px Orbitron,monospace'; ctx.textAlign='center';
  ctx.fillText('⚠ BOSS ⚠',0,b.size+28);
  ctx.restore();
}

// ═══════ POWER-UPS ═══════
function createPowerUp(x,y){
  const types=['heal','spread','rapid','dash'];
  const type=types[randInt(0,types.length-1)];
  const colors={heal:COLORS.green,spread:COLORS.yellow,rapid:COLORS.cyan,dash:COLORS.magenta};
  return{x,y,type,color:colors[type],size:12,time:0,active:true};
}

function drawPowerUp(ctx,p){
  p.time+=0.016;
  ctx.save(); ctx.translate(p.x,p.y);
  ctx.shadowBlur=15; ctx.shadowColor=p.color;
  ctx.fillStyle=p.color; ctx.globalAlpha=0.6+0.4*Math.sin(p.time*4);
  ctx.rotate(p.time*2);
  ctx.beginPath();
  for(let i=0;i<6;i++){const a=i*TAU/6; ctx.lineTo(Math.cos(a)*p.size,Math.sin(a)*p.size);}
  ctx.closePath(); ctx.fill();
  ctx.rotate(-p.time*2);
  ctx.fillStyle='#fff'; ctx.font='bold 10px Orbitron'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.globalAlpha=1;
  const labels={heal:'♥',spread:'W',rapid:'R',dash:'D'};
  ctx.fillText(labels[p.type],0,1);
  ctx.restore();
}

// ═══════ MAIN GAME ═══════
class Game {
  constructor(){
    this.state='menu'; this.score=0; this.combo=1; this.comboTimer=0;
    this.wave=1; this.enemies=[]; this.bullets=[]; this.powerups=[];
    this.boss=null; this.bossWave=false;
    this.spawnTimer=0; this.enemiesLeft=0;
    this.player=null; this.keys={}; this.mouse={x:0,y:0};
    this.shakeX=0; this.shakeY=0; this.shakeDur=0; this.shakeInt=0;
    this.waveAnnounce=''; this.waveAnnounceTimer=0;
    this.bestScore=parseInt(localStorage.getItem('voidbreaker_best')||'0');
    this.lastTime=0;
    this.setupInput();
  }

  setupInput(){
    window.addEventListener('keydown',e=>{
      this.keys[e.key.toLowerCase()]=true;
      if(e.key===' '&&this.state==='playing'){e.preventDefault(); this.player?.dash(this.keys);}
      if(e.key==='Escape'){
        if(this.state==='playing') this.pause();
        else if(this.state==='paused') this.resume();
      }
    });
    window.addEventListener('keyup',e=>this.keys[e.key.toLowerCase()]=false);
    canvas.addEventListener('mousemove',e=>{this.mouse.x=e.clientX;this.mouse.y=e.clientY;});
    canvas.addEventListener('mousedown',()=>{if(this.player) this.player.firing=true;});
    canvas.addEventListener('mouseup',()=>{if(this.player) this.player.firing=false;});
  }

  start(){
    snd.init();
    this.score=0; this.combo=1; this.comboTimer=0;
    this.wave=0; this.enemies=[]; this.bullets=[]; this.powerups=[];
    this.boss=null; this.bossWave=false;
    this.player=new Player(); particles.length=0;
    initStars();
    this.nextWave();
    this.state='playing';
    this.showScreen('none');
    document.getElementById('hud').classList.add('active');
    this.lastTime=performance.now();
    requestAnimationFrame(t=>this.loop(t));
  }

  restart(){ this.start(); }
  pause(){ this.state='paused'; this.showScreen('pause-screen'); }
  resume(){ this.state='playing'; this.showScreen('none');
    this.lastTime=performance.now(); requestAnimationFrame(t=>this.loop(t)); }

  showScreen(id){
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    if(id!=='none') document.getElementById(id)?.classList.add('active');
  }

  nextWave(){
    this.wave++;
    this.bossWave=(this.wave%5===0);
    if(this.bossWave){
      this.boss=createBoss(this.wave);
      this.enemiesLeft=0;
      this.waveAnnounce=`⚠ WAVE ${this.wave} - BOSS ⚠`;
      snd.play('boss');
    } else {
      this.enemiesLeft=5+this.wave*2;
      this.spawnTimer=0.5;
      this.waveAnnounce=`WAVE ${this.wave}`;
    }
    this.waveAnnounceTimer=2;
    const el=document.getElementById('wave-announce');
    el.textContent=this.waveAnnounce; el.classList.remove('hidden');
    setTimeout(()=>el.classList.add('hidden'),2000);
    document.getElementById('hud-wave').textContent=this.wave;
  }

  shake(intensity,dur){ this.shakeInt=intensity; this.shakeDur=dur; }

  addScore(pts){
    this.score+=pts*this.combo;
    this.comboTimer=2;
    this.combo=Math.min(this.combo+1,20);
    snd.play('combo');
  }

  spawnEnemy(){
    const types=['drifter','chaser','shooter'];
    if(this.wave>=3) types.push('tank');
    if(this.wave>=5) types.push('spinner');
    const type=types[randInt(0,types.length-1)];
    this.enemies.push(createEnemy(type,this.wave));
  }

  loop(time){
    if(this.state!=='playing') return;
    const dt=Math.min((time-this.lastTime)/1000, 0.05);
    this.lastTime=time;
    this.update(dt);
    this.render();
    requestAnimationFrame(t=>this.loop(t));
  }

  update(dt){
    const p=this.player;
    p.update(dt,this.keys,this.mouse);

    // Combo decay
    this.comboTimer-=dt;
    if(this.comboTimer<=0){this.combo=Math.max(1,this.combo-1);this.comboTimer=1.5;}

    // Spawn enemies
    if(!this.bossWave && this.enemiesLeft>0){
      this.spawnTimer-=dt;
      if(this.spawnTimer<=0){
        this.spawnTimer=Math.max(0.3, CFG.ENEMY_SPAWN_BASE-this.wave*0.05);
        this.spawnEnemy(); this.enemiesLeft--;
      }
    }

    // Update enemies
    this.enemies.forEach(e=>{if(e.active) updateEnemy(e,dt,p.x,p.y);});

    // Update boss
    if(this.boss?.active) updateBoss(this.boss,dt,p.x,p.y);

    // Update bullets
    this.bullets.forEach(b=>{
      b.x+=b.vx*dt; b.y+=b.vy*dt;
      if(b.x<-50||b.x>canvas.width+50||b.y<-50||b.y>canvas.height+50) b.dead=true;
    });
    this.bullets=this.bullets.filter(b=>!b.dead);

    // Bullet-Enemy collision
    this.bullets.filter(b=>b.player).forEach(b=>{
      this.enemies.filter(e=>e.active).forEach(e=>{
        if(dist(b,e)<e.size+b.size){
          e.hp-=b.dmg; b.dead=true;
          spawnParticles(b.x,b.y,5,e.color,100,0.2,2,6);
          if(e.hp<=0){
            e.active=false; explosion(e.x,e.y,e.size/14);
            this.addScore(e.score); snd.play('explode');
            if(rand(0,1)<0.2) this.powerups.push(createPowerUp(e.x,e.y));
          }
        }
      });
      // Boss hit
      if(this.boss?.active && dist(b,this.boss)<this.boss.size+b.size){
        this.boss.hp-=b.dmg; b.dead=true;
        spawnParticles(b.x,b.y,5,COLORS.white,80,0.2,2,5);
        if(this.boss.hp<=0){
          this.boss.active=false;
          explosion(this.boss.x,this.boss.y,3);
          this.addScore(this.boss.score); snd.play('explode');
          this.shake(12,0.5); this.boss=null;
        }
      }
    });

    // Enemy bullets hit player
    this.bullets.filter(b=>!b.player).forEach(b=>{
      if(dist(b,p)<18+b.size){
        p.takeDmg(b.dmg); b.dead=true; this.shake(4,0.15);
      }
    });

    // Enemy body collision with player
    this.enemies.filter(e=>e.active).forEach(e=>{
      if(dist(e,p)<e.size+15){ p.takeDmg(e.dmg); e.active=false;
        explosion(e.x,e.y,0.8); snd.play('explode'); }
    });
    // Boss collision
    if(this.boss?.active && this.boss.entered && dist(this.boss,p)<this.boss.size+15){
      p.takeDmg(this.boss.dmg); this.shake(8,0.3);
    }

    // Power-up pickup
    this.powerups.forEach(pw=>{
      if(pw.active && dist(pw,p)<pw.size+15){
        pw.active=false; snd.play('powerup');
        spawnParticles(pw.x,pw.y,15,pw.color,120,0.4,3,10);
        switch(pw.type){
          case'heal': p.hp=Math.min(p.maxHp,p.hp+30); break;
          case'spread': p.weapon='spread'; p.weaponTimer=8; break;
          case'rapid': p.weapon='rapid'; p.weaponTimer=8; break;
          case'dash': p.dashCd=0; break;
        }
      }
    });
    this.powerups=this.powerups.filter(p=>p.active);
    this.enemies=this.enemies.filter(e=>e.active);

    // Check wave complete
    if(!this.bossWave && this.enemies.length===0 && this.enemiesLeft<=0) this.nextWave();
    if(this.bossWave && !this.boss) this.nextWave();

    // Particles
    particles.forEach(p=>p.update(dt));
    for(let i=particles.length-1;i>=0;i--) if(!particles[i].active) particles.splice(i,1);

    // Stars
    updateStars(dt);

    // Screen shake
    if(this.shakeDur>0){
      this.shakeDur-=dt;
      this.shakeX=rand(-this.shakeInt,this.shakeInt);
      this.shakeY=rand(-this.shakeInt,this.shakeInt);
    } else { this.shakeX=0; this.shakeY=0; }

    // Player death
    if(p.hp<=0) this.gameOver();

    // HUD
    document.getElementById('hud-score').textContent=this.score.toLocaleString();
    document.getElementById('hud-combo').textContent=`x${this.combo}`;
    document.getElementById('hud-combo').style.color=this.combo>5?COLORS.yellow:this.combo>10?COLORS.red:'#fff';
    document.getElementById('hp-fill').style.width=`${(p.hp/p.maxHp)*100}%`;
    document.getElementById('dash-fill').style.width=`${Math.max(0,(1-p.dashCd/CFG.DASH_CD))*100}%`;
  }

  render(){
    ctx.save();
    ctx.translate(this.shakeX,this.shakeY);

    // Background
    const grad=ctx.createLinearGradient(0,0,0,canvas.height);
    grad.addColorStop(0,'#050510'); grad.addColorStop(0.5,'#0a0a2e'); grad.addColorStop(1,'#10051a');
    ctx.fillStyle=grad; ctx.fillRect(-10,-10,canvas.width+20,canvas.height+20);

    drawStars(ctx);
    particles.forEach(p=>p.draw(ctx));

    // Power-ups
    this.powerups.forEach(p=>drawPowerUp(ctx,p));

    // Bullets
    this.bullets.forEach(b=>{
      ctx.shadowBlur=b.glow; ctx.shadowColor=b.color;
      ctx.fillStyle=b.color;
      ctx.beginPath(); ctx.arc(b.x,b.y,b.size,0,TAU); ctx.fill();
      ctx.shadowBlur=0;
    });

    // Enemies
    this.enemies.forEach(e=>drawEnemy(ctx,e));

    // Boss
    if(this.boss?.active) drawBoss(ctx,this.boss);

    // Player
    this.player.draw(ctx);

    ctx.restore();
  }

  gameOver(){
    this.state='gameover';
    if(this.score>this.bestScore){this.bestScore=this.score;localStorage.setItem('voidbreaker_best',this.score);}
    document.getElementById('hud').classList.remove('active');
    document.getElementById('final-stats').innerHTML=
      `<p>SCORE: <b>${this.score.toLocaleString()}</b></p>
       <p>WAVE: <b>${this.wave}</b></p>
       <p>MAX COMBO: <b>x${this.combo}</b></p>
       <p>BEST SCORE: <b>${this.bestScore.toLocaleString()}</b></p>`;
    this.showScreen('gameover-screen');
  }
}

const game = new Game();
