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
    this.life = 0; this.maxLife = Math.random() * 20 + 20;
    this.color = color; this.size = Math.random() * 3 + 1;
  }
  update(canvasHeight: number) {
    this.x += this.vx; 
    this.y += this.vy; 
    this.vy += 0.2; // gravity
    
    // Floor bounce
    if (this.y > canvasHeight - 20) {
      this.y = canvasHeight - 20;
      this.vy *= -0.5;
      this.vx *= 0.8;
    }
    
    this.life++;
  }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.globalAlpha = Math.max(0, 1 - this.life / this.maxLife);
    ctx.fillStyle = this.color;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
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
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.fillStyle = '#bae6fd';
    ctx.beginPath(); ctx.arc(this.x, this.y, 4, 0, Math.PI * 2); ctx.fill();
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

class Enemy {
  x: number; y: number; vx: number; vy: number; size: number = 15; hp: number = 3;
  constructor(x: number, y: number) {
    this.x = x; this.y = y;
    this.vx = (Math.random() - 0.5) * 2;
    this.vy = (Math.random() - 0.5) * 2;
  }
  update(targetX: number, targetY: number) {
    const dx = targetX - this.x; const dy = targetY - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0) {
      this.vx += (dx / dist) * 0.1;
      this.vy += (dy / dist) * 0.1;
    }
    this.vx *= 0.95; this.vy *= 0.95;
    this.x += this.vx; this.y += this.vy;
  }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'white';
    ctx.fillRect(this.x - 10, this.y - 20, 20, 4);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(this.x - 10, this.y - 20, 20 * (this.hp / 3), 4);
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
  const [stiffness, setStiffness] = useState(0.05);
  const [surfaceTension, setSurfaceTension] = useState(0.1);
  const [viscosity, setViscosity] = useState(0.05);
  const [gravity, setGravity] = useState(0.5);
  const [bounciness, setBounciness] = useState(0.9);
  const [drag, setDrag] = useState(0.01);
  const [eyes, setEyes] = useState(true);
  const [gameMode, setGameMode] = useState(false);
  const [wasdMode, setWasdMode] = useState(false);
  const [size, setSize] = useState(100);
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
      enemies: Enemy[] = [];
      shockwaves: Shockwave[] = [];
      trail: {x: number, y: number}[] = [];
      baseRadii: number[] = [];
      shape: string = 'circle';
      lastShootTime: number = 0;
      gunRecoil: number = 0;
      screenShake: number = 0;
      blinkTimer: number = 0;
      isBlinking: boolean = false;
      
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
        this.enemies = [];
        this.shockwaves = [];
        this.trail = [];
        this.screenShake = 0;
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
        if (now - this.lastShootTime < 200) return;
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

        this.bullets.push(new Bullet(gunTipX, gunTipY, vx, vy));
        
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
        const { drag, gravity, bounciness, wasdMode, color } = paramsRef.current;
        const friction = 1 - drag;

        // WASD Control
        if (wasdMode) {
          const speed = 1.5;
          if (keysRef.current['w'] || keysRef.current['arrowup']) this.centerPoint.oldY += speed;
          if (keysRef.current['s'] || keysRef.current['arrowdown']) this.centerPoint.oldY -= speed;
          if (keysRef.current['a'] || keysRef.current['arrowleft']) this.centerPoint.oldX += speed;
          if (keysRef.current['d'] || keysRef.current['arrowright']) this.centerPoint.oldX -= speed;
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
              }
              break;
            }
          }
          if (hit) {
            this.bullets.splice(i, 1);
          }
        }

        // Spawn enemies
        if (paramsRef.current.gameMode && Math.random() < 0.02 && this.enemies.length < 10) {
          const side = Math.floor(Math.random() * 4);
          let ex = 0, ey = 0;
          if (side === 0) { ex = Math.random() * canvas.width; ey = -30; }
          else if (side === 1) { ex = canvas.width + 30; ey = Math.random() * canvas.height; }
          else if (side === 2) { ex = Math.random() * canvas.width; ey = canvas.height + 30; }
          else { ex = -30; ey = Math.random() * canvas.height; }
          this.enemies.push(new Enemy(ex, ey));
        }

        // Update enemies
        if (paramsRef.current.gameMode) {
          for (const e of this.enemies) {
            e.update(this.centerPoint.x, this.centerPoint.y);
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
            }
          }
        }
        
        this.gunRecoil *= 0.8;
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

        // Draw enemies
        if (paramsRef.current.gameMode) {
          for (const e of this.enemies) e.draw(ctx);
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
    <div className="relative w-full h-screen overflow-hidden bg-slate-900" style={{
      backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.1) 1px, transparent 0)',
      backgroundSize: '40px 40px'
    }}>
      <canvas ref={canvasRef} className="absolute inset-0 cursor-grab active:cursor-grabbing" />
      
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
        
        <Card className="w-80 bg-white/90 backdrop-blur shadow-xl border-0 rounded-r-none rounded-l-none max-h-[calc(100vh-2rem)] flex flex-col">
          <CardHeader className="pb-4 shrink-0">
            <CardTitle className="text-xl font-bold text-slate-800">Slime Lab</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 overflow-y-auto pb-6 scrollbar-thin flex-1">
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <Label>Color</Label>
              </div>
              <div className="flex gap-2">
                {['#10b981', '#3b82f6', '#ec4899', '#f59e0b', '#8b5cf6'].map(c => (
                  <button
                    key={c}
                    className={`w-8 h-8 rounded-full border-2 ${color === c ? 'border-slate-800 scale-110' : 'border-transparent'}`}
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
              <Label>Shape</Label>
              <div className="flex gap-2 flex-wrap">
                {['circle', 'cubical', 'tetrahedral', 'amorphous'].map(s => (
                  <button
                    key={s}
                    onClick={() => {
                      const actualShape = s === 'cubical' ? 'square' : s === 'tetrahedral' ? 'triangle' : s;
                      setShape(actualShape);
                      physicsRef.current?.reset(actualShape);
                    }}
                    className={`px-3 py-1 text-xs rounded-full capitalize ${
                      (shape === s || (shape === 'square' && s === 'cubical') || (shape === 'triangle' && s === 'tetrahedral')) 
                        ? 'bg-slate-800 text-white' 
                        : 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <Label>Size</Label>
                <span className="text-xs text-slate-500">{size}</span>
              </div>
              <Slider 
                value={[size]} 
                min={50} max={200} step={1}
                onValueChange={([v]) => setSize(v)} 
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <Label>Internal Stiffness</Label>
                <span className="text-xs text-slate-500">{stiffness.toFixed(2)}</span>
              </div>
              <Slider 
                value={[stiffness]} 
                min={0.01} max={0.2} step={0.01}
                onValueChange={([v]) => setStiffness(v)} 
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <Label>Surface Tension</Label>
                <span className="text-xs text-slate-500">{surfaceTension.toFixed(2)}</span>
              </div>
              <Slider 
                value={[surfaceTension]} 
                min={0.01} max={0.5} step={0.01}
                onValueChange={([v]) => setSurfaceTension(v)} 
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <Label>Viscosity</Label>
                <span className="text-xs text-slate-500">{viscosity.toFixed(2)}</span>
              </div>
              <Slider 
                value={[viscosity]} 
                min={0} max={0.2} step={0.01}
                onValueChange={([v]) => setViscosity(v)} 
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <Label>Gravity</Label>
                <span className="text-xs text-slate-500">{gravity.toFixed(2)}</span>
              </div>
              <Slider 
                value={[gravity]} 
                min={0} max={2} step={0.1}
                onValueChange={([v]) => setGravity(v)} 
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <Label>Bounciness</Label>
                <span className="text-xs text-slate-500">{bounciness.toFixed(2)}</span>
              </div>
              <Slider 
                value={[bounciness]} 
                min={0} max={1} step={0.05}
                onValueChange={([v]) => setBounciness(v)} 
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <Label>Air Drag</Label>
                <span className="text-xs text-slate-500">{drag.toFixed(2)}</span>
              </div>
              <Slider 
                value={[drag]} 
                min={0} max={0.1} step={0.01}
                onValueChange={([v]) => setDrag(v)} 
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <Label>Googly Eyes</Label>
              <Switch checked={eyes} onCheckedChange={setEyes} />
            </div>

            <div className="flex items-center justify-between pt-2">
              <Label>Game Mode (Guns & Enemies)</Label>
              <Switch checked={gameMode} onCheckedChange={setGameMode} />
            </div>

            <div className="flex items-center justify-between pt-2">
              <Label>WASD Control Mode</Label>
              <Switch checked={wasdMode} onCheckedChange={setWasdMode} />
            </div>

            <button 
              onClick={() => physicsRef.current?.reset()}
              className="w-full py-2 mt-4 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-medium transition-colors"
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
