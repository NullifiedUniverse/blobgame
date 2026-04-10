import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Slider } from './components/ui/slider';
import { Label } from './components/ui/label';
import { Switch } from './components/ui/switch';
import { RotateCcw, Settings } from 'lucide-react';

class Point {
  x: number;
  y: number;
  oldX: number;
  oldY: number;
  mass: number;
  pinned: boolean;

  constructor(x: number, y: number, mass: number = 1) {
    this.x = x;
    this.y = y;
    this.oldX = x;
    this.oldY = y;
    this.mass = mass;
    this.pinned = false;
  }
}

class Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; color: string; size: number;
  constructor(x: number, y: number, vx: number, vy: number, color: string) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.life = 0; this.maxLife = Math.random() * 30 + 20;
    this.color = color; this.size = Math.random() * 5 + 2;
  }
  update(canvasHeight: number) {
    this.x += this.vx; 
    this.y += this.vy; 
    this.vy += 0.3; // gravity
    this.vx *= 0.98; // air friction
    
    // Floor bounce
    if (this.y > canvasHeight - 20) {
      this.y = canvasHeight - 20;
      this.vy *= -0.6;
      this.vx *= 0.8;
    }
    
    this.life++;
  }
  draw(ctx: CanvasRenderingContext2D) {
    const progress = this.life / this.maxLife;
    ctx.globalAlpha = Math.max(0, 1 - progress);
    ctx.fillStyle = this.color;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.size * (1 - progress * 0.5), 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

class Bullet {
  x: number; y: number; vx: number; vy: number; life: number = 0;
  history: {x: number, y: number}[] = [];
  constructor(x: number, y: number, vx: number, vy: number) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
  }
  update() { 
    this.history.push({x: this.x, y: this.y});
    if (this.history.length > 10) this.history.shift();
    this.x += this.vx; this.y += this.vy; this.life++; 
  }
  draw(ctx: CanvasRenderingContext2D) {
    if (this.history.length > 0) {
      ctx.beginPath();
      ctx.moveTo(this.history[0].x, this.history[0].y);
      for (let i = 1; i < this.history.length; i++) {
        ctx.lineTo(this.history[i].x, this.history[i].y);
      }
      ctx.lineTo(this.x, this.y);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(this.x, this.y, 5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }
}

class Shockwave {
  x: number; y: number; radius: number = 0; maxRadius: number; alpha: number = 1; color: string;
  constructor(x: number, y: number, maxRadius: number = 50, color: string = '255, 255, 255') {
    this.x = x; this.y = y; this.maxRadius = maxRadius; this.color = color;
  }
  update() {
    this.radius += 6;
    this.alpha -= 0.04;
  }
  draw(ctx: CanvasRenderingContext2D) {
    if (this.alpha <= 0) return;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${this.color}, ${this.alpha})`;
    ctx.lineWidth = 2 + this.alpha * 10;
    ctx.stroke();
  }
}

class FloatingText {
  x: number; y: number; text: string; color: string; life: number = 0; maxLife: number = 60;
  constructor(x: number, y: number, text: string, color: string = 'white') {
    this.x = x; this.y = y; this.text = text; this.color = color;
  }
  update() { this.y -= 1; this.life++; }
  draw(ctx: CanvasRenderingContext2D) {
    const alpha = 1 - (this.life / this.maxLife);
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    if (this.color === 'red') ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
    if (this.color === 'green') ctx.fillStyle = `rgba(34, 197, 94, ${alpha})`;
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.text, this.x, this.y);
  }
}

class EnemyBullet {
  x: number; y: number; vx: number; vy: number; life: number = 0;
  constructor(x: number, y: number, vx: number, vy: number) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
  }
  update() { this.x += this.vx; this.y += this.vy; this.life++; }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#f97316';
    ctx.beginPath(); ctx.arc(this.x, this.y, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'white';
    ctx.beginPath(); ctx.arc(this.x, this.y, 2, 0, Math.PI * 2); ctx.fill();
  }
}

class Enemy {
  x: number; y: number; vx: number; vy: number; size: number; hp: number; maxHp: number;
  type: 'chaser' | 'shooter' | 'tank';
  shootTimer: number = 0;
  constructor(x: number, y: number, type: 'chaser' | 'shooter' | 'tank' = 'chaser') {
    this.x = x; this.y = y; this.type = type;
    this.vx = (Math.random() - 0.5) * 2;
    this.vy = (Math.random() - 0.5) * 2;
    if (type === 'tank') { this.size = 25; this.hp = 15; this.maxHp = 15; }
    else if (type === 'shooter') { this.size = 12; this.hp = 2; this.maxHp = 2; }
    else { this.size = 15; this.hp = 4; this.maxHp = 4; }
  }
  update(physics: any) {
    const targetX = physics.centerPoint.x;
    const targetY = physics.centerPoint.y;
    const dx = targetX - this.x; const dy = targetY - this.y;
    const dist = Math.hypot(dx, dy);
    
    let speedMult = this.type === 'tank' ? 0.03 : this.type === 'shooter' ? 0.08 : 0.1;
    
    if (this.type === 'shooter' && dist < 300) {
      // Keep distance
      this.vx -= (dx / dist) * 0.05;
      this.vy -= (dy / dist) * 0.05;
      this.shootTimer++;
      if (this.shootTimer > 100) {
        this.shootTimer = 0;
        const bx = (dx / dist) * 8;
        const by = (dy / dist) * 8;
        physics.enemyBullets.push(new EnemyBullet(this.x, this.y, bx, by));
      }
    } else if (dist > 0) {
      this.vx += (dx / dist) * speedMult;
      this.vy += (dy / dist) * speedMult;
    }
    
    this.vx *= 0.95; this.vy *= 0.95;
    this.x += this.vx; this.y += this.vy;
  }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);
    
    // Aura/Glow
    ctx.shadowColor = this.type === 'tank' ? '#a855f7' : this.type === 'shooter' ? '#f97316' : '#ef4444';
    ctx.shadowBlur = 15;
    
    // Body
    ctx.fillStyle = this.type === 'tank' ? '#a855f7' : this.type === 'shooter' ? '#f97316' : '#ef4444';
    ctx.beginPath(); ctx.arc(0, 0, this.size, 0, Math.PI * 2); ctx.fill();
    
    // Inner core
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.arc(0, 0, this.size * 0.6, 0, Math.PI * 2); ctx.fill();
    
    // Eyes
    const angle = Math.atan2(this.vy, this.vx);
    ctx.rotate(angle);
    ctx.fillStyle = 'white';
    ctx.beginPath(); ctx.arc(this.size * 0.4, -this.size * 0.3, this.size * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(this.size * 0.4, this.size * 0.3, this.size * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'black';
    ctx.beginPath(); ctx.arc(this.size * 0.5, -this.size * 0.3, this.size * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(this.size * 0.5, this.size * 0.3, this.size * 0.1, 0, Math.PI * 2); ctx.fill();
    
    ctx.restore();
    
    // HP Bar
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(this.x - 15, this.y - this.size - 12, 30, 4);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(this.x - 15, this.y - this.size - 12, 30 * (this.hp / this.maxHp), 4);
  }
}

class Platform {
  x: number; y: number; w: number; h: number;
  constructor(x: number, y: number, w: number, h: number) {
    this.x = x; this.y = y; this.w = w; this.h = h;
  }
  draw(ctx: CanvasRenderingContext2D) {
    // Main body
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(this.x, this.y, this.w, this.h, 8);
    ctx.fill();
    
    // Top highlight
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.roundRect(this.x, this.y, this.w, this.h * 0.3, {tl: 8, tr: 8, bl: 0, br: 0});
    ctx.fill();
    
    // Border
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(this.x, this.y, this.w, this.h, 8);
    ctx.stroke();
  }
}

class Lava extends Platform {
  life: number = 0;
  constructor(x: number, y: number, w: number, h: number) {
    super(x, y, w, h);
  }
  draw(ctx: CanvasRenderingContext2D) {
    this.life += 0.05;
    ctx.fillStyle = '#7f1d1d';
    ctx.beginPath(); ctx.roundRect(this.x, this.y, this.w, this.h, 4); ctx.fill();
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2; ctx.stroke();
    
    // Animated bubbling/wave effect
    ctx.fillStyle = 'rgba(239, 68, 68, 0.6)';
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    for (let i = 0; i <= this.w; i += 10) {
      ctx.lineTo(this.x + i, this.y - 5 + Math.sin(this.life + i * 0.1) * 5);
    }
    ctx.lineTo(this.x + this.w, this.y + this.h);
    ctx.lineTo(this.x, this.y + this.h);
    ctx.fill();
  }
}

class PowerUp {
  x: number; y: number; type: 'multishot' | 'rapidfire' | 'heal' | 'shield' | 'speed';
  bobOffset: number = 0; life: number = 0;
  constructor(x: number, y: number, type: 'multishot' | 'rapidfire' | 'heal' | 'shield' | 'speed') {
    this.x = x; this.y = y; this.type = type;
  }
  update() { this.life += 0.05; this.bobOffset = Math.sin(this.life) * 10; }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y + this.bobOffset);
    
    const color = this.type === 'heal' ? '#22c55e' : this.type === 'rapidfire' ? '#facc15' : this.type === 'shield' ? '#06b6d4' : this.type === 'speed' ? '#3b82f6' : '#a855f7';
    
    // Glow
    ctx.shadowColor = color;
    ctx.shadowBlur = 15;
    
    // Outer ring
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.stroke();
    
    // Inner circle
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
    
    // Text
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'white'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 16px sans-serif';
    ctx.fillText(this.type === 'heal' ? 'H' : this.type === 'rapidfire' ? 'R' : this.type === 'shield' ? 'S' : this.type === 'speed' ? '>>' : 'M', 0, 0);
    
    ctx.restore();
  }
}

class Portal {
  x: number; y: number; rotation: number = 0; scale: number = 0;
  constructor(x: number, y: number) { this.x = x; this.y = y; }
  update() { 
    this.rotation += 0.05; 
    if (this.scale < 1) this.scale += 0.05;
  }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.rotation); ctx.scale(this.scale, this.scale);
    ctx.strokeStyle = '#c084fc'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([10, 10]); ctx.strokeStyle = '#e879f9';
    ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.stroke();
    
    // Inner glow
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 30);
    gradient.addColorStop(0, 'rgba(232, 121, 249, 0.8)');
    gradient.addColorStop(1, 'rgba(232, 121, 249, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill();
    
    ctx.restore();
  }
}

class Spring {
  p1: Point;
  p2: Point;
  restLength: number;
  stiffness: number;
  damping: number = 0;
  type: 'perimeter' | 'radial' | 'cross' | 'smooth';

  constructor(p1: Point, p2: Point, type: 'perimeter' | 'radial' | 'cross' | 'smooth', restLength?: number, stiffness: number = 0.5) {
    this.p1 = p1;
    this.p2 = p2;
    this.type = type;
    this.restLength = restLength !== undefined ? restLength : Math.hypot(p2.x - p1.x, p2.y - p1.y);
    this.stiffness = stiffness;
  }

  update() {
    const dx = this.p2.x - this.p1.x;
    const dy = this.p2.y - this.p1.y;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) return;

    const nx = dx / dist;
    const ny = dy / dist;

    const vx1 = this.p1.x - this.p1.oldX;
    const vy1 = this.p1.y - this.p1.oldY;
    const vx2 = this.p2.x - this.p2.oldX;
    const vy2 = this.p2.y - this.p2.oldY;

    const rvx = vx2 - vx1;
    const rvy = vy2 - vy1;
    const rvProj = rvx * nx + rvy * ny;

    const scalarForce = (this.restLength - dist) * this.stiffness - rvProj * this.damping;

    const forceX = nx * scalarForce * 0.5;
    const forceY = ny * scalarForce * 0.5;

    if (!this.p1.pinned) {
      this.p1.x -= forceX;
      this.p1.y -= forceY;
    }
    if (!this.p2.pinned) {
      this.p2.x += forceX;
      this.p2.y += forceY;
    }
  }
}

export default function SlimeApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Customizations
  const [color, setColor] = useState('#10b981');
  const [shape, setShape] = useState('circle');
  const [stiffness, setStiffness] = useState(0.08);
  const [surfaceTension, setSurfaceTension] = useState(0.2);
  const [viscosity, setViscosity] = useState(0.05);
  const [gravity, setGravity] = useState(0.8);
  const [bounciness, setBounciness] = useState(0.3);
  const [drag, setDrag] = useState(0.02);
  const [eyes, setEyes] = useState(true);
  const [gameMode, setGameMode] = useState(true);
  const [wasdMode, setWasdMode] = useState(true);
  const [size, setSize] = useState(60);
  const [uiExpanded, setUiExpanded] = useState(false);

  const paramsRef = useRef({ color, stiffness, surfaceTension, viscosity, gravity, bounciness, drag, eyes, gameMode, wasdMode, size });
  useEffect(() => {
    paramsRef.current = { color, stiffness, surfaceTension, viscosity, gravity, bounciness, drag, eyes, gameMode, wasdMode, size };
  }, [color, stiffness, surfaceTension, viscosity, gravity, bounciness, drag, eyes, gameMode, wasdMode, size]);

  const physicsRef = useRef<any>(null);
  const keysRef = useRef<{ [key: string]: boolean }>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { keysRef.current[e.key.toLowerCase()] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keysRef.current[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    // Physics Engine
    class SlimePhysics {
      points: Point[] = [];
      springs: Spring[] = [];
      centerPoint: Point;
      dragPoint: Point | null = null;
      mouse = { x: 0, y: 0, vx: 0, vy: 0, isDown: false };
      mouseHistory: {x: number, y: number, time: number}[] = [];
      particles: Particle[] = [];
      bullets: Bullet[] = [];
      enemyBullets: EnemyBullet[] = [];
      enemies: Enemy[] = [];
      platforms: Platform[] = [];
      lavas: Lava[] = [];
      powerups: PowerUp[] = [];
      portal: Portal | null = null;
      shockwaves: Shockwave[] = [];
      trail: {x: number, y: number}[] = [];
      floatingTexts: FloatingText[] = [];
      baseRadii: number[] = [];
      shape: string = 'circle';
      lastDashTime: number = 0;
      gunRecoil: number = 0;
      screenShake: number = 0;
      blinkTimer: number = 0;
      isBlinking: boolean = false;
      
      // Game State
      level: number = 1;
      score: number = 0;
      hp: number = 100;
      maxHp: number = 100;
      invulnTimer: number = 0;
      hasShield: boolean = false;
      activePowerups: { [key: string]: number } = {};
      isGrounded: boolean = false;
      
      constructor(cx: number, cy: number, radius: number, numPoints: number, shape: string) {
        this.shape = shape;
        this.centerPoint = new Point(cx, cy, 3);
        this.points.push(this.centerPoint);

        const angleStep = (Math.PI * 2) / numPoints;
        for (let i = 0; i < numPoints; i++) {
          const angle = i * angleStep;
          const r = this.getShapeRadius(angle, 100, shape);
          this.baseRadii.push(r);
          const px = cx + Math.cos(angle) * r * (radius / 100);
          const py = cy + Math.sin(angle) * r * (radius / 100);
          this.points.push(new Point(px, py, 1));
        }

        // Radial springs (to center)
        for (let i = 1; i <= numPoints; i++) {
          this.springs.push(new Spring(this.centerPoint, this.points[i], 'radial', radius, paramsRef.current.stiffness));
        }

        // Perimeter springs
        for (let i = 1; i <= numPoints; i++) {
          const p1 = this.points[i];
          const p2 = this.points[i === numPoints ? 1 : i + 1];
          this.springs.push(new Spring(p1, p2, 'perimeter', undefined, paramsRef.current.stiffness));
        }

        // Smooth springs (i to i+2)
        for (let i = 1; i <= numPoints; i++) {
          const p1 = this.points[i];
          let next2 = i + 2;
          if (next2 > numPoints) next2 -= numPoints;
          const p2 = this.points[next2];
          this.springs.push(new Spring(p1, p2, 'smooth', undefined, paramsRef.current.stiffness));
        }

        // Cross springs
        const halfPoints = Math.floor(numPoints / 2);
        for (let i = 1; i <= numPoints; i++) {
          let opposite = i + halfPoints;
          if (opposite > numPoints) opposite -= numPoints;
          if (i < opposite) {
            this.springs.push(new Spring(this.points[i], this.points[opposite], 'cross', radius * 2, paramsRef.current.stiffness));
          }
        }
      }

      getShapeRadius(angle: number, radius: number, shape: string) {
        if (shape === 'square') {
          const absCos = Math.abs(Math.cos(angle + Math.PI/4));
          const absSin = Math.abs(Math.sin(angle + Math.PI/4));
          return radius / Math.max(absCos, absSin) * 0.8;
        } else if (shape === 'triangle') {
          const a = (angle + Math.PI/2) % ((Math.PI * 2) / 3);
          return radius / Math.cos(a - Math.PI / 3) * 0.6;
        } else if (shape === 'amorphous') {
          return radius * (0.6 + Math.random() * 0.8);
        }
        return radius;
      }

      loadLevel(levelIndex: number) {
        this.level = levelIndex;
        this.platforms = [];
        this.lavas = [];
        this.enemies = [];
        this.powerups = [];
        this.portal = null;
        this.bullets = [];
        this.enemyBullets = [];
        this.particles = [];
        this.shockwaves = [];
        this.trail = [];
        
        const cw = window.innerWidth;
        const ch = window.innerHeight;
        
        // Reset slime position to start
        const cx = 100;
        const cy = ch - 150;
        const dx = cx - this.centerPoint.x;
        const dy = cy - this.centerPoint.y;
        
        for (const p of this.points) {
          p.x += dx; p.y += dy;
          p.oldX = p.x; p.oldY = p.y;
        }

        if (levelIndex === 1) {
          this.platforms.push(new Platform(cw/2 - 150, ch - 150, 300, 20));
          this.platforms.push(new Platform(cw/2 + 250, ch - 300, 200, 20));
          this.enemies.push(new Enemy(cw/2, ch - 200, 'chaser'));
          this.enemies.push(new Enemy(cw/2 + 300, ch - 350, 'chaser'));
          this.powerups.push(new PowerUp(cw/2, ch - 200, 'rapidfire'));
        } else if (levelIndex === 2) {
          this.platforms.push(new Platform(200, ch - 200, 150, 20));
          this.platforms.push(new Platform(450, ch - 350, 150, 20));
          this.platforms.push(new Platform(700, ch - 500, 150, 20));
          this.enemies.push(new Enemy(250, ch - 250, 'chaser'));
          this.enemies.push(new Enemy(500, ch - 400, 'shooter'));
          this.enemies.push(new Enemy(750, ch - 550, 'chaser'));
          this.powerups.push(new PowerUp(500, ch - 400, 'shield'));
        } else if (levelIndex === 3) {
          this.platforms.push(new Platform(100, ch - 200, 200, 20));
          this.lavas.push(new Lava(300, ch - 200, 200, 20));
          this.platforms.push(new Platform(500, ch - 200, 200, 20));
          this.platforms.push(new Platform(cw/2 - 100, ch - 450, 200, 20));
          this.enemies.push(new Enemy(cw/2, ch - 500, 'tank'));
          this.enemies.push(new Enemy(150, ch - 250, 'shooter'));
          this.enemies.push(new Enemy(600, ch - 250, 'shooter'));
          this.powerups.push(new PowerUp(cw/2, ch - 500, 'multishot'));
          this.powerups.push(new PowerUp(150, ch - 250, 'speed'));
        } else if (levelIndex >= 4) {
          // Procedural generation for higher levels
          const numPlats = 3 + Math.floor(Math.random() * 4);
          let lastPy = ch - 150;
          for (let i = 0; i < numPlats; i++) {
            const px = 200 + Math.random() * (cw - 400);
            // Ensure platforms don't overlap vertically too much
            const py = lastPy - 100 - Math.random() * 150;
            lastPy = py;
            
            if (Math.random() > 0.8) {
              this.lavas.push(new Lava(px, py, 150 + Math.random() * 100, 20));
            } else {
              this.platforms.push(new Platform(px, py, 150 + Math.random() * 100, 20));
            }
            
            if (Math.random() > 0.3) {
              const r = Math.random();
              const type = r > 0.8 ? 'tank' : r > 0.5 ? 'shooter' : 'chaser';
              this.enemies.push(new Enemy(px + 75, py - 50, type));
            }
            if (Math.random() > 0.8) {
              const types: ('multishot'|'rapidfire'|'heal'|'shield'|'speed')[] = ['multishot', 'rapidfire', 'heal', 'shield', 'speed'];
              this.powerups.push(new PowerUp(px + 75, py - 100, types[Math.floor(Math.random()*types.length)]));
            }
          }
        }
      }

      reset(newShape?: string) {
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const { size } = paramsRef.current;
        if (newShape) this.shape = newShape;
        
        this.centerPoint.x = cx;
        this.centerPoint.y = cy;
        this.centerPoint.oldX = cx;
        this.centerPoint.oldY = cy;

        const numPoints = this.points.length - 1;
        const angleStep = (Math.PI * 2) / numPoints;
        
        if (newShape) {
          this.baseRadii = [];
          for (let i = 0; i < numPoints; i++) {
            this.baseRadii.push(this.getShapeRadius(i * angleStep, 100, this.shape));
          }
        }

        for (let i = 1; i <= numPoints; i++) {
          const angle = (i - 1) * angleStep;
          const r = this.baseRadii[i - 1] * (size / 100);
          const px = cx + Math.cos(angle) * r;
          const py = cy + Math.sin(angle) * r;
          this.points[i].x = px;
          this.points[i].y = py;
          this.points[i].oldX = px;
          this.points[i].oldY = py;
        }
        this.particles = [];
        this.bullets = [];
        this.enemyBullets = [];
        this.enemies = [];
        this.platforms = [];
        this.lavas = [];
        this.powerups = [];
        this.portal = null;
        this.shockwaves = [];
        this.floatingTexts = [];
        this.trail = [];
        this.screenShake = 0;
        this.hp = this.maxHp;
        this.score = 0;
        this.hasShield = false;
        this.activePowerups = {};
        if (paramsRef.current.gameMode) {
          this.loadLevel(1);
        }
      }

      updateParams() {
        const { stiffness, surfaceTension, viscosity, size } = paramsRef.current;
        const numPerimeterPoints = this.points.length - 1;
        const sizeScale = size / 100;
        
        for (const spring of this.springs) {
          spring.damping = viscosity;
          if (spring.type === 'radial') {
            const ptIdx = this.points.indexOf(spring.p2) - 1;
            spring.stiffness = stiffness;
            spring.restLength = this.baseRadii[ptIdx] * sizeScale;
          } else if (spring.type === 'perimeter') {
            const idx1 = this.points.indexOf(spring.p1) - 1;
            const idx2 = this.points.indexOf(spring.p2) - 1;
            const angleStep = (Math.PI * 2) / numPerimeterPoints;
            const r1 = this.baseRadii[idx1] * sizeScale;
            const r2 = this.baseRadii[idx2] * sizeScale;
            const restLen = Math.sqrt(r1*r1 + r2*r2 - 2*r1*r2*Math.cos(angleStep));
            spring.stiffness = surfaceTension;
            spring.restLength = restLen;
          } else if (spring.type === 'smooth') {
            const idx1 = this.points.indexOf(spring.p1) - 1;
            const idx2 = this.points.indexOf(spring.p2) - 1;
            const angleStep = (Math.PI * 2) / numPerimeterPoints * 2;
            const r1 = this.baseRadii[idx1] * sizeScale;
            const r2 = this.baseRadii[idx2] * sizeScale;
            const restLen = Math.sqrt(r1*r1 + r2*r2 - 2*r1*r2*Math.cos(angleStep));
            spring.stiffness = surfaceTension * 0.5;
            spring.restLength = restLen;
          } else if (spring.type === 'cross') {
            const idx1 = this.points.indexOf(spring.p1) - 1;
            const idx2 = this.points.indexOf(spring.p2) - 1;
            spring.stiffness = stiffness * 0.5;
            spring.restLength = (this.baseRadii[idx1] + this.baseRadii[idx2]) * sizeScale;
          }
        }
      }

      spawnSplatter(x: number, y: number, baseVx: number, baseVy: number, color: string) {
        for (let i = 0; i < 5; i++) {
          this.particles.push(new Particle(
            x, y,
            baseVx * 0.3 + (Math.random() - 0.5) * 5,
            baseVy * 0.3 + (Math.random() - 0.5) * 5,
            color
          ));
        }
      }

      shoot() {
        if (!paramsRef.current.gameMode) return;
        const now = Date.now();
        const cooldown = this.activePowerups['rapidfire'] && this.activePowerups['rapidfire'] > now ? 50 : 200;
        if (now - this.lastShootTime < cooldown) return;
        this.lastShootTime = now;
        this.gunRecoil = 15;
        this.screenShake = Math.max(this.screenShake, 5);
        
        const cx = this.centerPoint.x;
        const cy = this.centerPoint.y;
        const dx = this.mouse.x - cx;
        const dy = this.mouse.y - cy;
        const dist = Math.hypot(dx, dy);
        if (dist === 0) return;
        
        const vx = (dx / dist) * 15;
        const vy = (dy / dist) * 15;
        
        this.centerPoint.oldX += vx * 0.5;
        this.centerPoint.oldY += vy * 0.5;

        const gunTipX = cx + (dx/dist)*70;
        const gunTipY = cy + (dy/dist)*70;

        if (this.activePowerups['multishot'] && this.activePowerups['multishot'] > now) {
          const angle = Math.atan2(vy, vx);
          const spread = 0.2;
          for (let i = -1; i <= 1; i++) {
            const a = angle + i * spread;
            this.bullets.push(new Bullet(gunTipX, gunTipY, Math.cos(a) * 15, Math.sin(a) * 15));
          }
        } else {
          this.bullets.push(new Bullet(gunTipX, gunTipY, vx, vy));
        }
        
        // Muzzle flash
        for (let i = 0; i < 3; i++) {
          this.particles.push(new Particle(
            gunTipX, gunTipY,
            vx * 0.5 + (Math.random() - 0.5) * 5,
            vy * 0.5 + (Math.random() - 0.5) * 5,
            '#facc15'
          ));
        }
      }

      hexToRgb(hex: string) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '255, 255, 255';
      }

      update() {
        this.updateParams();
        const { drag, gravity, bounciness, wasdMode, color, gameMode } = paramsRef.current;
        const friction = 1 - drag;
        const now = Date.now();

        this.isGrounded = false;

        // WASD Control
        if (wasdMode) {
          const speed = this.activePowerups['speed'] && this.activePowerups['speed'] > now ? 2.5 : 1.5;
          if (keysRef.current['s'] || keysRef.current['arrowdown']) this.centerPoint.oldY -= speed;
          if (keysRef.current['a'] || keysRef.current['arrowleft']) {
            for(const p of this.points) p.oldX += speed * 0.5;
          }
          if (keysRef.current['d'] || keysRef.current['arrowright']) {
            for(const p of this.points) p.oldX -= speed * 0.5;
          }
        }

        this.screenShake *= 0.9;
        if (this.screenShake < 0.1) this.screenShake = 0;

        // Update trail
        const speed = Math.hypot(this.centerPoint.x - this.centerPoint.oldX, this.centerPoint.y - this.centerPoint.oldY);
        if (speed > 5) {
          this.trail.push({x: this.centerPoint.x, y: this.centerPoint.y});
        }
        if (this.trail.length > 20 || (speed <= 5 && this.trail.length > 0)) {
          this.trail.shift();
        }

        // Dragging
        if (this.mouse.isDown && this.dragPoint) {
          this.dragPoint.oldX = this.dragPoint.x;
          this.dragPoint.oldY = this.dragPoint.y;
          this.dragPoint.x = this.mouse.x;
          this.dragPoint.y = this.mouse.y;
        }

        // Verlet integration
        for (const p of this.points) {
          if (p.pinned || (this.mouse.isDown && p === this.dragPoint)) continue;

          const vx = (p.x - p.oldX) * friction;
          const vy = (p.y - p.oldY) * friction;

          p.oldX = p.x;
          p.oldY = p.y;

          p.x += vx;
          p.y += vy + gravity * p.mass;

          // Platform collision
          for (const plat of this.platforms) {
            // AABB check with a small margin to prevent getting stuck
            if (p.x > plat.x - 2 && p.x < plat.x + plat.w + 2 && p.y > plat.y - 2 && p.y < plat.y + plat.h + 2) {
              const distLeft = Math.abs(p.x - plat.x);
              const distRight = Math.abs((plat.x + plat.w) - p.x);
              const distTop = Math.abs(p.y - plat.y);
              const distBottom = Math.abs((plat.y + plat.h) - p.y);
              const minDist = Math.min(distLeft, distRight, distTop, distBottom);
              
              if (minDist === distTop) { 
                p.y = plat.y; p.oldY = p.y + vy * bounciness; p.oldX = p.x - vx * 0.8; 
                this.isGrounded = true; 
              } else if (minDist === distBottom) { 
                p.y = plat.y + plat.h; p.oldY = p.y + vy * bounciness; p.oldX = p.x - vx * 0.8; 
              } else if (minDist === distLeft) { 
                p.x = plat.x; p.oldX = p.x + vx * bounciness; p.oldY = p.y - vy * 0.8; 
              } else if (minDist === distRight) { 
                p.x = plat.x + plat.w; p.oldX = p.x + vx * bounciness; p.oldY = p.y - vy * 0.8; 
              }
            }
          }

          // Lava collision
          for (const lava of this.lavas) {
            if (p.x > lava.x && p.x < lava.x + lava.w && p.y > lava.y && p.y < lava.y + lava.h) {
              const distTop = p.y - lava.y;
              p.y = lava.y; p.oldY = p.y + vy * bounciness; p.oldX = p.x - vx * 0.8; 
              this.isGrounded = true;
              
              if (now - this.invulnTimer > 1000) {
                this.takeDamage(15);
                this.centerPoint.oldY += 20; // Bounce off lava
              }
            }
          }

          // Floor collision
          if (p.y > canvas.height - 20) {
            if (vy > 10) {
              this.spawnSplatter(p.x, canvas.height - 20, vx, -vy * 0.5, paramsRef.current.color);
              this.shockwaves.push(new Shockwave(p.x, canvas.height - 20, vy * 2, this.hexToRgb(color)));
              this.screenShake = Math.max(this.screenShake, Math.min(vy * 0.5, 15));
            }
            p.y = canvas.height - 20;
            p.oldY = p.y + vy * bounciness;
            p.oldX = p.x - vx * 0.8; // Floor friction
            this.isGrounded = true;
          }
          // Walls
          if (p.x < 20) {
            if (vx < -10) {
              this.spawnSplatter(20, p.y, -vx * 0.5, vy, paramsRef.current.color);
              this.shockwaves.push(new Shockwave(20, p.y, -vx * 2, this.hexToRgb(color)));
              this.screenShake = Math.max(this.screenShake, Math.min(-vx * 0.5, 15));
            }
            p.x = 20;
            p.oldX = p.x + vx * bounciness;
            p.oldY = p.y - vy * 0.8; // Wall friction
          }
          if (p.x > canvas.width - 20) {
            if (vx > 10) {
              this.spawnSplatter(canvas.width - 20, p.y, -vx * 0.5, vy, paramsRef.current.color);
              this.shockwaves.push(new Shockwave(canvas.width - 20, p.y, vx * 2, this.hexToRgb(color)));
              this.screenShake = Math.max(this.screenShake, Math.min(vx * 0.5, 15));
            }
            p.x = canvas.width - 20;
            p.oldX = p.x + vx * bounciness;
            p.oldY = p.y - vy * 0.8; // Wall friction
          }
          // Ceiling
          if (p.y < 20) {
            if (vy < -10) {
              this.spawnSplatter(p.x, 20, vx, -vy * 0.5, paramsRef.current.color);
              this.shockwaves.push(new Shockwave(p.x, 20, -vy * 2, this.hexToRgb(color)));
              this.screenShake = Math.max(this.screenShake, Math.min(-vy * 0.5, 15));
            }
            p.y = 20;
            p.oldY = p.y + vy * bounciness;
            p.oldX = p.x - vx * 0.8; // Ceiling friction
          }
        }

        // Dash logic
        if (wasdMode && keysRef.current['shift'] && now - (this as any).lastDashTime > 1000) {
          (this as any).lastDashTime = now;
          const dashForce = 30;
          let dx = 0; let dy = 0;
          if (keysRef.current['a'] || keysRef.current['arrowleft']) dx = -dashForce;
          if (keysRef.current['d'] || keysRef.current['arrowright']) dx = dashForce;
          if (keysRef.current['w'] || keysRef.current['arrowup']) dy = -dashForce;
          if (keysRef.current['s'] || keysRef.current['arrowdown']) dy = dashForce;
          
          if (dx !== 0 || dy !== 0) {
            for (const p of this.points) {
              p.oldX = p.x - dx;
              p.oldY = p.y - dy;
            }
            this.spawnSplatter(this.centerPoint.x, this.centerPoint.y, -dx*0.5, -dy*0.5, paramsRef.current.color);
            this.shockwaves.push(new Shockwave(this.centerPoint.x, this.centerPoint.y, 40, this.hexToRgb(color)));
          }
        }

        // Jump logic
        if (wasdMode && (keysRef.current['w'] || keysRef.current['arrowup']) && this.isGrounded) {
          const jumpForce = this.activePowerups['speed'] && this.activePowerups['speed'] > now ? 25 : 20;
          for (const p of this.points) {
            p.oldY = p.y + jumpForce; // Upward impulse
          }
          this.isGrounded = false;
          this.spawnSplatter(this.centerPoint.x, this.centerPoint.y + paramsRef.current.size, 0, 5, paramsRef.current.color);
        }

        // Relax springs
        for (let i = 0; i < 8; i++) {
          for (const spring of this.springs) {
            spring.update();
          }
        }

        // Update shockwaves
        for (let i = this.shockwaves.length - 1; i >= 0; i--) {
          this.shockwaves[i].update();
          if (this.shockwaves[i].alpha <= 0) {
            this.shockwaves.splice(i, 1);
          }
        }

        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
          this.particles[i].update(canvas.height);
          if (this.particles[i].life >= this.particles[i].maxLife) {
            this.particles.splice(i, 1);
          }
        }

        // Update powerups
        for (let i = this.powerups.length - 1; i >= 0; i--) {
          const pu = this.powerups[i];
          pu.update();
          const dist = Math.hypot(this.centerPoint.x - pu.x, this.centerPoint.y - pu.y);
          if (dist < paramsRef.current.size + 15) {
            if (pu.type === 'heal') {
              this.hp = Math.min(this.maxHp, this.hp + 30);
              this.floatingTexts.push(new FloatingText(this.centerPoint.x, this.centerPoint.y - 40, '+30', 'green'));
            } else if (pu.type === 'shield') {
              this.hasShield = true;
            } else {
              this.activePowerups[pu.type] = now + 10000; // 10 seconds
            }
            this.score += 50;
            this.spawnSplatter(pu.x, pu.y, 0, 0, pu.type === 'heal' ? '#22c55e' : pu.type === 'shield' ? '#06b6d4' : '#facc15');
            this.powerups.splice(i, 1);
          }
        }

        // Update portal
        if (gameMode && this.enemies.length === 0 && !this.portal) {
          this.portal = new Portal(canvas.width / 2, 100);
        }
        if (this.portal) {
          this.portal.update();
          const dist = Math.hypot(this.centerPoint.x - this.portal.x, this.centerPoint.y - this.portal.y);
          if (dist < paramsRef.current.size + 30) {
            this.score += 500;
            this.floatingTexts.push(new FloatingText(this.centerPoint.x, this.centerPoint.y - 40, '+500', 'green'));
            this.loadLevel(this.level + 1);
            return;
          }
        }

        // Update bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
          this.bullets[i].update();
          if (this.bullets[i].life > 100 || 
              this.bullets[i].x < 0 || this.bullets[i].x > canvas.width ||
              this.bullets[i].y < 0 || this.bullets[i].y > canvas.height) {
            this.bullets.splice(i, 1);
            continue;
          }
          
          // Check collision with enemies
          let hit = false;
          for (let j = this.enemies.length - 1; j >= 0; j--) {
            const e = this.enemies[j];
            const dist = Math.hypot(this.bullets[i].x - e.x, this.bullets[i].y - e.y);
            if (dist < e.size + 4) {
              e.hp--;
              hit = true;
              this.spawnSplatter(e.x, e.y, this.bullets[i].vx * 0.5, this.bullets[i].vy * 0.5, '#ef4444');
              if (e.hp <= 0) {
                this.spawnSplatter(e.x, e.y, 0, 0, '#ef4444');
                this.spawnSplatter(e.x, e.y, 0, 0, '#ef4444');
                this.shockwaves.push(new Shockwave(e.x, e.y, 60, '239, 68, 68'));
                this.screenShake = Math.max(this.screenShake, 8);
                this.enemies.splice(j, 1);
                this.score += 100;
                this.floatingTexts.push(new FloatingText(e.x, e.y - 20, '+100', 'white'));
              }
              break;
            }
          }
          if (hit) {
            this.bullets.splice(i, 1);
          }
        }

        // Spawn enemies (only if not in a level or if we want continuous spawning)
        if (gameMode && Math.random() < 0.01 && this.enemies.length < 5 && this.level < 1) {
          const side = Math.floor(Math.random() * 4);
          let ex = 0, ey = 0;
          if (side === 0) { ex = Math.random() * canvas.width; ey = -30; }
          else if (side === 1) { ex = canvas.width + 30; ey = Math.random() * canvas.height; }
          else if (side === 2) { ex = Math.random() * canvas.width; ey = canvas.height + 30; }
          else { ex = -30; ey = Math.random() * canvas.height; }
          this.enemies.push(new Enemy(ex, ey, 'chaser'));
        }

        // Update enemy bullets
        for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
          const b = this.enemyBullets[i];
          b.update();
          if (b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height || b.life > 200) {
            this.enemyBullets.splice(i, 1);
            continue;
          }
          const dist = Math.hypot(this.centerPoint.x - b.x, this.centerPoint.y - b.y);
          if (dist < paramsRef.current.size + 5) {
            this.takeDamage(10);
            this.floatingTexts.push(new FloatingText(this.centerPoint.x, this.centerPoint.y - 40, '-10', 'red'));
            this.enemyBullets.splice(i, 1);
          }
        }

        // Update floating texts
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
          const ft = this.floatingTexts[i];
          ft.update();
          if (ft.life >= ft.maxLife) this.floatingTexts.splice(i, 1);
        }

        // Update enemies
        if (gameMode) {
          for (const e of this.enemies) {
            e.update(this);
            // Collision with slime
            const dist = Math.hypot(this.centerPoint.x - e.x, this.centerPoint.y - e.y);
            if (dist < paramsRef.current.size + e.size) {
              // Bounce
              const dx = e.x - this.centerPoint.x;
              const dy = e.y - this.centerPoint.y;
              const ndist = Math.hypot(dx, dy);
              if (ndist > 0) {
                e.vx += (dx / ndist) * 5;
                e.vy += (dy / ndist) * 5;
                this.centerPoint.oldX -= (dx / ndist) * 2;
                this.centerPoint.oldY -= (dy / ndist) * 2;
              }
              
              // Damage player
              if (now - this.invulnTimer > 1000) {
                this.takeDamage(15);
                this.floatingTexts.push(new FloatingText(this.centerPoint.x, this.centerPoint.y - 40, '-15', 'red'));
              }
            }
          }
        }
        
        this.gunRecoil *= 0.8;
      }

      takeDamage(amount: number) {
        const now = Date.now();
        if (now - this.invulnTimer < 1000) return;
        
        if (this.hasShield) {
          this.hasShield = false;
          this.invulnTimer = now;
          this.screenShake = Math.max(this.screenShake, 5);
          this.shockwaves.push(new Shockwave(this.centerPoint.x, this.centerPoint.y, 100, '6, 182, 212'));
          return;
        }

        this.hp -= amount;
        this.invulnTimer = now;
        this.screenShake = Math.max(this.screenShake, 10);
        this.spawnSplatter(this.centerPoint.x, this.centerPoint.y, 0, 0, paramsRef.current.color);
        if (this.hp <= 0) {
          this.loadLevel(1); // Restart
          this.hp = this.maxHp;
          this.score = 0;
          this.hasShield = false;
          this.activePowerups = {};
        }
      }

      draw(ctx: CanvasRenderingContext2D) {
        if (this.points.length < 2) return;
        const { color, eyes } = paramsRef.current;

        ctx.save();
        if (this.screenShake > 0) {
          const dx = (Math.random() - 0.5) * this.screenShake;
          const dy = (Math.random() - 0.5) * this.screenShake;
          ctx.translate(dx, dy);
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw platforms
        for (const plat of this.platforms) plat.draw(ctx);

        // Draw lava
        for (const lava of this.lavas) lava.draw(ctx);

        // Draw portal
        if (this.portal) this.portal.draw(ctx);

        // Draw powerups
        for (const pu of this.powerups) pu.draw(ctx);

        // Draw trail
        if (this.trail.length > 1) {
          ctx.beginPath();
          ctx.moveTo(this.trail[0].x, this.trail[0].y);
          for (let i = 1; i < this.trail.length; i++) {
            ctx.lineTo(this.trail[i].x, this.trail[i].y);
          }
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.3;
          ctx.lineWidth = paramsRef.current.size * 0.8;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        // Draw slime body
        const numPoints = this.points.length - 1;
        ctx.beginPath();
        const p1 = this.points[1];
        const p2 = this.points[2];
        ctx.moveTo((p1.x + p2.x) / 2, (p1.y + p2.y) / 2);

        for (let i = 2; i <= numPoints; i++) {
          const curr = this.points[i];
          const next = this.points[i === numPoints ? 1 : i + 1];
          const midX = (curr.x + next.x) / 2;
          const midY = (curr.y + next.y) / 2;
          ctx.quadraticCurveTo(curr.x, curr.y, midX, midY);
        }
        
        // Close the shape
        const first = this.points[1];
        const second = this.points[2];
        const midX = (first.x + second.x) / 2;
        const midY = (first.y + second.y) / 2;
        ctx.quadraticCurveTo(first.x, first.y, midX, midY);

        // Draw aura
        ctx.beginPath();
        ctx.arc(this.centerPoint.x, this.centerPoint.y, paramsRef.current.size * 1.5, 0, Math.PI * 2);
        const gradient = ctx.createRadialGradient(this.centerPoint.x, this.centerPoint.y, paramsRef.current.size * 0.5, this.centerPoint.x, this.centerPoint.y, paramsRef.current.size * 1.5);
        const rgb = this.hexToRgb(color);
        gradient.addColorStop(0, `rgba(${rgb}, 0.2)`);
        gradient.addColorStop(1, `rgba(${rgb}, 0)`);
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.fillStyle = color;
        ctx.fill();
        
        // Highlight edge
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.stroke();

        // Draw eyes
        if (eyes) {
          this.blinkTimer++;
          if (this.isBlinking && this.blinkTimer > 10) {
            this.isBlinking = false;
            this.blinkTimer = 0;
          } else if (!this.isBlinking && this.blinkTimer > Math.random() * 200 + 100) {
            this.isBlinking = true;
            this.blinkTimer = 0;
          }

          const cx = this.centerPoint.x;
          const cy = this.centerPoint.y;
          
          // Calculate angle to mouse
          const dx = this.mouse.x - cx;
          const dy = this.mouse.y - cy;
          const angle = Math.atan2(dy, dx);
          const dist = Math.min(Math.hypot(dx, dy) * 0.05, 4);
          
          const eyeOffsetX = 20;
          const eyeOffsetY = -10;
          
          const drawEye = (ox: number, oy: number) => {
            if (this.isBlinking) {
              ctx.beginPath();
              ctx.moveTo(cx + ox - 12, cy + oy);
              ctx.lineTo(cx + ox + 12, cy + oy);
              ctx.lineWidth = 4;
              ctx.strokeStyle = '#0f172a';
              ctx.lineCap = 'round';
              ctx.stroke();
              return;
            }

            ctx.beginPath();
            ctx.arc(cx + ox, cy + oy, 12, 0, Math.PI * 2);
            ctx.fillStyle = 'white';
            ctx.fill();
            
            // Pupil
            const pupilX = cx + ox + Math.cos(angle) * dist;
            const pupilY = cy + oy + Math.sin(angle) * dist;
            ctx.beginPath();
            ctx.arc(pupilX, pupilY, 5, 0, Math.PI * 2);
            ctx.fillStyle = 'black';
            ctx.fill();
          };

          drawEye(-eyeOffsetX, eyeOffsetY);
          drawEye(eyeOffsetX, eyeOffsetY);
        }

        // Draw shockwaves
        for (const s of this.shockwaves) s.draw(ctx);

        // Draw particles
        for (const p of this.particles) p.draw(ctx);
        
        // Draw bullets
        for (const b of this.bullets) b.draw(ctx);
        for (const b of this.enemyBullets) b.draw(ctx);

        // Draw enemies
        if (paramsRef.current.gameMode) {
          for (const e of this.enemies) e.draw(ctx);
        }

        // Draw shield
        if (this.hasShield) {
          ctx.beginPath();
          ctx.arc(this.centerPoint.x, this.centerPoint.y, paramsRef.current.size + 15, 0, Math.PI * 2);
          ctx.strokeStyle = '#06b6d4';
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.fillStyle = 'rgba(6, 182, 212, 0.2)';
          ctx.fill();
        }

        // Draw gun
        if (paramsRef.current.gameMode) {
          const cx = this.centerPoint.x;
          const cy = this.centerPoint.y;
          const dx = this.mouse.x - cx;
          const dy = this.mouse.y - cy;
          const angle = Math.atan2(dy, dx);
          const distToMouse = Math.hypot(dx, dy);
          
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(angle);
          
          // Laser sight
          if (!this.dragPoint && distToMouse > 0) {
            ctx.beginPath();
            ctx.moveTo(40, 0);
            ctx.lineTo(distToMouse, 0);
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
          }

          // Recoil offset
          ctx.translate(-this.gunRecoil, 0);

          // Gun body
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.roundRect(15, -8, 35, 16, 6);
          ctx.fill();

          // Gun barrel
          ctx.fillStyle = '#334155';
          ctx.beginPath();
          ctx.roundRect(50, -4, 20, 8, 3);
          ctx.fill();

          // Barrel tip
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.roundRect(65, -5, 8, 10, 2);
          ctx.fill();

          // Glowing core (cooldown indicator)
          const now = Date.now();
          const cooldownRatio = Math.min(1, (now - this.lastShootTime) / 200);
          
          ctx.fillStyle = `rgba(56, 189, 248, ${cooldownRatio})`;
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 10 * cooldownRatio;
          ctx.beginPath();
          ctx.roundRect(25, -3, 20 * cooldownRatio, 6, 3);
          ctx.fill();
          ctx.shadowBlur = 0;

          ctx.restore();
        }

        // Damage flash overlay (draw before HUD)
        const nowTime = Date.now();
        if (nowTime - this.invulnTimer < 100) {
          ctx.save();
          ctx.resetTransform();
          ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.restore();
        }

        // Draw floating texts
        for (const ft of this.floatingTexts) ft.draw(ctx);

        // Draw HUD
        if (paramsRef.current.gameMode) {
          ctx.save();
          ctx.resetTransform(); // Reset any screen shake for HUD
          
          // HUD Glassmorphism Background
          ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
          ctx.beginPath();
          ctx.roundRect(10, 10, 220, 100 + Object.keys(this.activePowerups).length * 25, 12);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Top left: HP & Score
          ctx.fillStyle = 'white';
          ctx.font = 'bold 20px sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(`Score: ${this.score}`, 20, 20);
          ctx.fillStyle = '#94a3b8';
          ctx.font = 'bold 16px sans-serif';
          ctx.fillText(`Level ${this.level}`, 20, 45);

          // HP Bar
          ctx.fillStyle = '#334155';
          ctx.beginPath(); ctx.roundRect(20, 70, 180, 12, 6); ctx.fill();
          ctx.fillStyle = this.hp > 30 ? '#22c55e' : '#ef4444';
          ctx.beginPath(); ctx.roundRect(20, 70, 180 * (this.hp / this.maxHp), 12, 6); ctx.fill();

          // Active Powerups
          let puY = 95;
          for (const [type, expiry] of Object.entries(this.activePowerups)) {
            if (expiry > nowTime) {
              const remaining = Math.ceil((expiry - nowTime) / 1000);
              ctx.fillStyle = type === 'rapidfire' ? '#facc15' : '#a855f7';
              ctx.font = 'bold 16px sans-serif';
              ctx.fillText(`${type.toUpperCase()}: ${remaining}s`, 20, puY);
              puY += 25;
            }
          }

          ctx.restore();
        }

        ctx.restore(); // Restore screen shake translation
      }
    }

    const slime = new SlimePhysics(canvas.width / 2, canvas.height / 2, size, 20, shape);
    physicsRef.current = slime;

    // Interaction
    const getMousePos = (e: MouseEvent | TouchEvent) => {
      if ('touches' in e) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
      return { x: e.clientX, y: e.clientY };
    };

    const handleDown = (e: MouseEvent | TouchEvent) => {
      const pos = getMousePos(e);
      slime.mouse.x = pos.x;
      slime.mouse.y = pos.y;
      slime.mouse.isDown = true;

      // Find closest point
      let minDist = 50;
      let closest = null;
      for (const p of slime.points) {
        const dist = Math.hypot(p.x - pos.x, p.y - pos.y);
        if (dist < minDist) {
          minDist = dist;
          closest = p;
        }
      }
      slime.dragPoint = closest;

      if (!closest) {
        slime.shoot();
      }
    };

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const pos = getMousePos(e);
      const now = Date.now();
      slime.mouseHistory.push({ x: pos.x, y: pos.y, time: now });
      if (slime.mouseHistory.length > 10) slime.mouseHistory.shift();
      
      slime.mouse.vx = pos.x - slime.mouse.x;
      slime.mouse.vy = pos.y - slime.mouse.y;
      slime.mouse.x = pos.x;
      slime.mouse.y = pos.y;
    };

    const handleUp = () => {
      if (slime.dragPoint) {
        // Calculate velocity from history
        const now = Date.now();
        const validHistory = slime.mouseHistory.filter(h => now - h.time < 100);
        if (validHistory.length > 1) {
          const oldest = validHistory[0];
          const newest = validHistory[validHistory.length - 1];
          const dt = Math.max(1, newest.time - oldest.time);
          const vx = ((newest.x - oldest.x) / dt) * 15;
          const vy = ((newest.y - oldest.y) / dt) * 15;
          
          slime.dragPoint.oldX = slime.dragPoint.x - vx;
          slime.dragPoint.oldY = slime.dragPoint.y - vy;
          slime.centerPoint.oldX -= vx * 0.5;
          slime.centerPoint.oldY -= vy * 0.5;
        }
      }
      slime.mouse.isDown = false;
      slime.dragPoint = null;
      slime.mouseHistory = [];
    };

    canvas.addEventListener('mousedown', handleDown);
    canvas.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    
    canvas.addEventListener('touchstart', handleDown, { passive: false });
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); handleMove(e); }, { passive: false });
    window.addEventListener('touchend', handleUp);

    const loop = () => {
      slime.update();
      slime.draw(ctx);
      animationFrameId = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousedown', handleDown);
      canvas.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      canvas.removeEventListener('touchstart', handleDown);
      canvas.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
      cancelAnimationFrame(animationFrameId);
    };
  }, []); // Empty dep array, we update params via refs

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-950" style={{
      backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)',
      backgroundSize: '40px 40px'
    }}>
      <canvas ref={canvasRef} className={`absolute inset-0 ${gameMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`} />
      
      <div 
        className={`absolute top-4 right-0 transition-transform duration-300 flex items-start z-10 ${uiExpanded ? 'translate-x-0' : 'translate-x-[calc(100%-3rem)]'}`}
        onMouseEnter={() => setUiExpanded(true)}
        onMouseLeave={() => setUiExpanded(false)}
      >
        <div 
          className="bg-white/90 backdrop-blur shadow-xl rounded-l-xl p-3 cursor-pointer mt-4 flex items-center justify-center hover:bg-white transition-colors" 
          onClick={() => setUiExpanded(!uiExpanded)}
        >
          <Settings className="w-6 h-6 text-slate-700" />
        </div>
        
        <Card className="w-80 bg-white/10 backdrop-blur-md shadow-2xl border-white/20 rounded-r-none rounded-l-none max-h-[calc(100vh-2rem)] flex flex-col text-white">
          <CardHeader className="pb-4 shrink-0 border-b border-white/10">
            <CardTitle className="text-xl font-bold text-white">Slime Lab</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 overflow-y-auto pb-6 scrollbar-thin flex-1 pt-4">
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <Label className="text-white">Color</Label>
              </div>
              <div className="flex gap-2">
                {['#10b981', '#3b82f6', '#ec4899', '#f59e0b', '#8b5cf6'].map(c => (
                  <button
                    key={c}
                    className={`w-8 h-8 rounded-full border-2 ${color === c ? 'border-white scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
                <input 
                  type="color" 
                  value={color} 
                  onChange={(e) => setColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-white">Shape</Label>
              <div className="flex gap-2 flex-wrap">
                {['circle', 'cubical', 'tetrahedral', 'amorphous'].map(s => (
                  <button
                    key={s}
                    onClick={() => {
                      const actualShape = s === 'cubical' ? 'square' : s === 'tetrahedral' ? 'triangle' : s;
                      setShape(actualShape);
                      physicsRef.current?.reset(actualShape);
                    }}
                    className={`px-3 py-1 text-xs rounded-full capitalize transition-colors ${
                      (shape === s || (shape === 'square' && s === 'cubical') || (shape === 'triangle' && s === 'tetrahedral')) 
                        ? 'bg-white text-slate-900 font-bold' 
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <Label className="text-white">Size</Label>
                <span className="text-xs text-slate-300">{size}</span>
              </div>
              <Slider 
                value={[size]} 
                min={30} max={150} step={1}
                onValueChange={([v]) => setSize(v)} 
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <Label className="text-white">Internal Stiffness</Label>
                <span className="text-xs text-slate-300">{stiffness.toFixed(2)}</span>
              </div>
              <Slider 
                value={[stiffness]} 
                min={0.01} max={0.2} step={0.01}
                onValueChange={([v]) => setStiffness(v)} 
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <Label className="text-white">Surface Tension</Label>
                <span className="text-xs text-slate-300">{surfaceTension.toFixed(2)}</span>
              </div>
              <Slider 
                value={[surfaceTension]} 
                min={0.01} max={0.5} step={0.01}
                onValueChange={([v]) => setSurfaceTension(v)} 
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <Label className="text-white">Viscosity</Label>
                <span className="text-xs text-slate-300">{viscosity.toFixed(2)}</span>
              </div>
              <Slider 
                value={[viscosity]} 
                min={0} max={0.2} step={0.01}
                onValueChange={([v]) => setViscosity(v)} 
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <Label className="text-white">Gravity</Label>
                <span className="text-xs text-slate-300">{gravity.toFixed(2)}</span>
              </div>
              <Slider 
                value={[gravity]} 
                min={0} max={2} step={0.1}
                onValueChange={([v]) => setGravity(v)} 
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <Label className="text-white">Bounciness</Label>
                <span className="text-xs text-slate-300">{bounciness.toFixed(2)}</span>
              </div>
              <Slider 
                value={[bounciness]} 
                min={0} max={1} step={0.05}
                onValueChange={([v]) => setBounciness(v)} 
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <Label className="text-white">Air Drag</Label>
                <span className="text-xs text-slate-300">{drag.toFixed(2)}</span>
              </div>
              <Slider 
                value={[drag]} 
                min={0} max={0.1} step={0.01}
                onValueChange={([v]) => setDrag(v)} 
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <Label className="text-white">Googly Eyes</Label>
              <Switch checked={eyes} onCheckedChange={setEyes} />
            </div>

            <div className="flex items-center justify-between pt-2">
              <Label className="text-white">Game Mode (Guns & Enemies)</Label>
              <Switch checked={gameMode} onCheckedChange={setGameMode} />
            </div>

            <div className="flex items-center justify-between pt-2">
              <Label className="text-white">WASD Control Mode</Label>
              <Switch checked={wasdMode} onCheckedChange={setWasdMode} />
            </div>

            <button 
              onClick={() => physicsRef.current?.reset()}
              className="w-full py-2 mt-4 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors border border-white/20"
            >
              <RotateCcw className="w-4 h-4" />
              Reset Slime
            </button>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
