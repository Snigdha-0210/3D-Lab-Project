import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment";
import { PMREMGenerator } from "three";
import "./App.css";

// ── Constants ──────────────────────────────────────────────────────────────
const PHASE = { INTRO:'intro', SETUP:'setup', STRETCH:'stretch', HELD:'held', RELEASE:'release', COMPLETE:'complete' };
const LEFT_PIN  = new THREE.Vector3(-3, 0, 0);
const RIGHT_PIN = new THREE.Vector3( 3, 0, 0);
const MAX_STRETCH = 3.2;
const HOLD_SECONDS = 3;
const COLOR_RELAX = new THREE.Color('#FF8C42');
const COLOR_TENSE = new THREE.Color('#FF1744');

const STEPS = [
  { id:1, phase:'setup',   label:'Initial Setup',    desc:'Hold the rubber band at both ends firmly.' },
  { id:2, phase:'stretch', label:'Stretch the Band',  desc:'Drag the handle ↓ to store elastic energy.' },
  { id:3, phase:'held',    label:'Hold Position',     desc:'Feel the elastic potential energy stored.' },
  { id:4, phase:'release', label:'Release & Observe', desc:'Watch PE convert to Kinetic Energy!' },
];

// ── Build bezier TubeGeometry ──────────────────────────────────────────────
function makeTube(p0, ctrl, p1, r = 0.07) {
  const pts = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60, mt = 1 - t;
    pts.push(new THREE.Vector3(
      mt*mt*p0.x + 2*mt*t*ctrl.x + t*t*p1.x,
      mt*mt*p0.y + 2*mt*t*ctrl.y + t*t*p1.y,
      mt*mt*p0.z + 2*mt*t*ctrl.z + t*t*p1.z
    ));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, r, 10, false);
}

// ── Particle burst system ──────────────────────────────────────────────────
function createParticles(scene) {
  const count = 250;
  const geo   = new THREE.BufferGeometry();
  const pos   = new Float32Array(count * 3);
  const vel   = new Float32Array(count * 3);
  const col   = new Float32Array(count * 3);
  const palette = [[1,.55,.26],[1,.1,.27],[1,.85,0],[1,.4,0],[.7,.2,1]];
  for (let i = 0; i < count; i++) {
    pos[i*3]=pos[i*3+1]=pos[i*3+2]=0;
    const spd = 0.04 + Math.random()*0.18, ang = Math.random()*Math.PI*2, el = (Math.random()-.5)*Math.PI;
    vel[i*3]   = Math.cos(ang)*Math.cos(el)*spd;
    vel[i*3+1] = Math.sin(el)*spd;
    vel[i*3+2] = Math.sin(ang)*Math.cos(el)*spd;
    const c = palette[Math.floor(Math.random()*palette.length)];
    col[i*3]=c[0]; col[i*3+1]=c[1]; col[i*3+2]=c[2];
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));
  const mat  = new THREE.PointsMaterial({ size:.18, vertexColors:true, transparent:true, opacity:0 });
  const pts2 = new THREE.Points(geo, mat);
  pts2.userData = { velocity:vel, alive:false, age:0 };
  scene.add(pts2);
  return pts2;
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  const mountRef     = useRef(null);
  const sceneRef     = useRef(null);
  const rendRef      = useRef(null);
  const camRef       = useRef(null);
  const frameRef     = useRef(null);
  const topBandRef   = useRef(null);
  const botBandRef   = useRef(null);
  const handleSphere = useRef(null);
  const leftPinRef   = useRef(null);
  const rightPinRef  = useRef(null);
  const glbRef       = useRef(null);
  const particlesRef = useRef(null);
  const stressPts    = useRef([]);
  const stretchYRef  = useRef(0);
  const isDragging   = useRef(false);
  const stretchPlane = useRef(new THREE.Plane(new THREE.Vector3(0,0,1), 0));
  const raycaster    = useRef(new THREE.Raycaster());
  const mouse        = useRef(new THREE.Vector2());
  const phaseRef     = useRef(PHASE.INTRO);

  const [phase,          setPhase]          = useState(PHASE.INTRO);
  const [stretchPct,     setStretchPct]     = useState(0);
  const [score,          setScore]          = useState(0);
  const [holdLeft,       setHoldLeft]       = useState(HOLD_SECONDS);
  const [ke,             setKe]             = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [snapText,       setSnapText]       = useState(false);
  const storedStretchRef = useRef(0);

  const setPhaseS = (p) => { phaseRef.current = p; setPhase(p); };

  // ────── THREE.JS INIT ──────────────────────────────────────────────────
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias:true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    mount.appendChild(renderer.domElement);
    rendRef.current = renderer;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#06091a');
    scene.fog = new THREE.FogExp2('#06091a', 0.035);
    sceneRef.current = scene;

    // Env map
    const pmrem  = new PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;

    // Camera
    const cam = new THREE.PerspectiveCamera(55, mount.clientWidth/mount.clientHeight, 0.1, 200);
    cam.position.set(0, 1.5, 10);
    cam.lookAt(0, -1, 0);
    camRef.current = cam;

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(5, 10, 5);
    dir.castShadow = true;
    scene.add(dir);
    const pl1 = new THREE.PointLight(0x4488ff, 0.6, 40);
    pl1.position.set(-6, 4, 4);
    scene.add(pl1);

    const pl2 = new THREE.PointLight(0xff6600, 0.4, 30);
    pl2.position.set(6, 3, -2);
    scene.add(pl2);

    // Grid floor
    const grid = new THREE.GridHelper(50, 50, 0x112244, 0x0a1428);
    grid.position.y = -5;
    scene.add(grid);

    // Helper: make a pin mesh
    const makePinMat = () => new THREE.MeshStandardMaterial({ color:0x4ecdc4, metalness:.85, roughness:.15, emissive:0x0a3030, emissiveIntensity:.4 });
    const pinGeo  = new THREE.CylinderGeometry(.14,.14,1.6,20);
    const capGeo  = new THREE.SphereGeometry(.2,20,20);
    const ringGeo = new THREE.TorusGeometry(.26,.035,8,32);
    const capMat  = new THREE.MeshStandardMaterial({ color:0x84fab0, metalness:.9, roughness:.1, emissive:0x84fab0, emissiveIntensity:.5 });

    [LEFT_PIN, RIGHT_PIN].forEach((pos, idx) => {
      const pin = new THREE.Mesh(pinGeo, makePinMat());
      pin.position.set(pos.x, -.2, 0);
      pin.castShadow = true;
      const cap  = new THREE.Mesh(capGeo, capMat.clone());
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({ color:0x84fab0, emissive:0x84fab0, emissiveIntensity:.9 }));
      cap.position.y  = .8; ring.position.y = .8; ring.rotation.x = Math.PI/2;
      pin.add(cap); pin.add(ring);
      scene.add(pin);
      if (idx === 0) leftPinRef.current  = pin;
      else           rightPinRef.current = pin;
    });

    // Band material factory
    const bandMat = () => new THREE.MeshStandardMaterial({
      color: COLOR_RELAX.clone(), emissive: new THREE.Color('#aa2200'), emissiveIntensity:.2, roughness:.65, metalness:0
    });

    // Top band
    const topBand = new THREE.Mesh(makeTube(LEFT_PIN, new THREE.Vector3(0,.55,0), RIGHT_PIN, .065), bandMat());
    topBand.castShadow = true; topBand.visible = false;
    scene.add(topBand); topBandRef.current = topBand;

    // Bottom band
    const botBand = new THREE.Mesh(makeTube(LEFT_PIN, new THREE.Vector3(0,-.3,0), RIGHT_PIN, .065), bandMat());
    botBand.castShadow = true; botBand.visible = false;
    scene.add(botBand); botBandRef.current = botBand;

    // Drag handle
    const hMat = new THREE.MeshStandardMaterial({ color:0xFFD700, emissive:0xFF8800, emissiveIntensity:.6, roughness:.3, metalness:.5 });
    const hSphere = new THREE.Mesh(new THREE.SphereGeometry(.28,24,24), hMat);
    hSphere.position.set(0,-.3,.06); hSphere.castShadow = true; hSphere.visible = false;
    scene.add(hSphere); handleSphere.current = hSphere;

    // GLB intro model
    let isMounted = true;
    new GLTFLoader().load('/rubber_band.glb', (gltf) => {
      if (!isMounted) return;
      const m = gltf.scene;
      m.name = "IntroBand";
      const box = new THREE.Box3().setFromObject(m);
      const sz  = new THREE.Vector3(); box.getSize(sz);
      const sc  = 3.5 / Math.max(sz.x, sz.y, sz.z);
      m.scale.setScalar(sc);
      m.traverse(c => { if (c.isMesh) { c.material.envMap = envTex; c.material.needsUpdate = true; } });
      scene.add(m);
    });

    // Particles
    particlesRef.current = createParticles(scene);

    // Stress dots along band
    for (let i = 0; i < 18; i++) {
      const sp = new THREE.Mesh(new THREE.SphereGeometry(.045,8,8), new THREE.MeshBasicMaterial({ color:0xff4400, transparent:true, opacity:0 }));
      scene.add(sp); stressPts.current.push(sp);
    }

    // Resize
    const onResize = () => {
      if (!mount || !rendRef.current) return;
      const w = mount.clientWidth, h = mount.clientHeight;
      camRef.current.aspect = w/h; camRef.current.updateProjectionMatrix();
      rendRef.current.setSize(w,h);
    };
    window.addEventListener('resize', onResize);

    // Animate loop
    const clock = new THREE.Clock();
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const ph = phaseRef.current;
      const inExp = ph !== PHASE.INTRO && ph !== PHASE.COMPLETE;

      // GLB spin in intro
      const introBand = scene.getObjectByName("IntroBand");
      if (introBand) {
        introBand.visible = ph === PHASE.INTRO;
        introBand.rotation.y = t * .55;
        introBand.position.y = Math.sin(t * .9) * .18;
      }

      // Band + pins visibility
      if (topBandRef.current) topBandRef.current.visible = inExp;
      if (botBandRef.current) botBandRef.current.visible = inExp;
      if (leftPinRef.current)  leftPinRef.current.visible  = inExp;
      if (rightPinRef.current) rightPinRef.current.visible = inExp;

      // Handle pulse
      if (handleSphere.current) {
        handleSphere.current.visible = ph === PHASE.STRETCH;
        if (ph === PHASE.STRETCH) {
          const p = .88 + Math.sin(t*5)*.14;
          handleSphere.current.scale.setScalar(p);
          handleSphere.current.material.emissiveIntensity = .4 + Math.sin(t*5)*.35;
        }
      }

      // Stress particles along stretched bottom band
      const sY = stretchYRef.current;
      if (inExp && sY > .25) {
        stressPts.current.forEach((sp, i) => {
          const u = i / stressPts.current.length, mu = 1-u;
          const ctrl = new THREE.Vector3(0,-sY,0);
          sp.position.set(
            mu*mu*LEFT_PIN.x+2*mu*u*ctrl.x+u*u*RIGHT_PIN.x,
            mu*mu*LEFT_PIN.y+2*mu*u*ctrl.y+u*u*RIGHT_PIN.y + Math.sin(t*6+i)*.045,
            mu*mu*LEFT_PIN.z+2*mu*u*ctrl.z+u*u*RIGHT_PIN.z
          );
          const op = Math.min(1, sY/MAX_STRETCH)*.65;
          sp.material.opacity = op;
          sp.material.color.lerpColors(new THREE.Color(0xff8844), new THREE.Color(0xff0000), sY/MAX_STRETCH);
          sp.scale.setScalar(.7+Math.sin(t*7+i*.6)*.35);
        });
      } else {
        stressPts.current.forEach(sp => { sp.material.opacity = 0; });
      }

      // Particle burst tick
      const prt = particlesRef.current;
      if (prt?.userData.alive) {
        prt.userData.age++;
        const pa = prt.geometry.attributes.position.array, vel = prt.userData.velocity;
        for (let i = 0; i < vel.length/3; i++) {
          pa[i*3]   += vel[i*3];
          pa[i*3+1] += vel[i*3+1];
          pa[i*3+2] += vel[i*3+2];
          vel[i*3+1] -= .0015;
        }
        prt.geometry.attributes.position.needsUpdate = true;
        prt.material.opacity = Math.max(0, 1 - prt.userData.age/90);
        if (prt.userData.age > 90) { prt.userData.alive = false; prt.material.opacity = 0; }
      }

      renderer.render(scene, cam);
    };
    animate();

    return () => {
      isMounted = false;
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);

  // ────── Pointer interaction (stretch) ─────────────────────────────────
  useEffect(() => {
    const canvas = rendRef.current?.domElement;
    if (!canvas) return;

    const getNDC = (e) => {
      const r = canvas.getBoundingClientRect();
      mouse.current.set(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1);
    };

    const onDown = (e) => {
      if (phaseRef.current !== PHASE.STRETCH) return;
      getNDC(e);
      raycaster.current.setFromCamera(mouse.current, camRef.current);
      if (raycaster.current.intersectObject(handleSphere.current).length > 0) {
        isDragging.current = true;
        canvas.setPointerCapture(e.pointerId);
      }
    };

    const onMove = (e) => {
      if (!isDragging.current || phaseRef.current !== PHASE.STRETCH) return;
      getNDC(e);
      raycaster.current.setFromCamera(mouse.current, camRef.current);
      const hit = new THREE.Vector3();
      raycaster.current.ray.intersectPlane(stretchPlane.current, hit);
      const newY = Math.max(0, Math.min(MAX_STRETCH, -hit.y));
      stretchYRef.current = newY;

      if (handleSphere.current) handleSphere.current.position.set(0, -newY, .06);

      if (botBandRef.current) {
        const ctrl = new THREE.Vector3(0,-newY,0);
        const thin = Math.max(.04, .068 - (newY/MAX_STRETCH)*.028);
        const g = makeTube(LEFT_PIN, ctrl, RIGHT_PIN, thin);
        botBandRef.current.geometry.dispose();
        botBandRef.current.geometry = g;
        const pct = newY/MAX_STRETCH;
        const c   = new THREE.Color().lerpColors(COLOR_RELAX, COLOR_TENSE, pct);
        botBandRef.current.material.color.copy(c);
        botBandRef.current.material.emissiveIntensity = .15 + pct*.65;
        botBandRef.current.material.emissive.copy(c);
        topBandRef.current.material.color.copy(c);
        topBandRef.current.material.emissiveIntensity = .1 + pct*.4;
      }
      setStretchPct(Math.round((newY/MAX_STRETCH)*100));
    };

    const onUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      if (stretchYRef.current >= MAX_STRETCH*.45 && phaseRef.current === PHASE.STRETCH) {
        storedStretchRef.current = Math.round((stretchYRef.current/MAX_STRETCH)*100);
        setPhaseS(PHASE.HELD);
        setCompletedSteps(p => [...new Set([...p,2])]);
        setScore(p => p+30);
      }
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup',   onUp);
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup',   onUp);
    };
  }, []);

  // ────── Hold countdown ────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== PHASE.HELD) return;
    setHoldLeft(HOLD_SECONDS);
    const iv = setInterval(() => {
      setHoldLeft(prev => {
        if (prev <= 1) {
          clearInterval(iv);
          setPhaseS(PHASE.RELEASE);
          setCompletedSteps(p => [...new Set([...p,3])]);
          setScore(p => p+20);
          return 0;
        }
        return prev-1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [phase]);

  // ────── KE surge animation after complete ────────────────────────────
  useEffect(() => {
    if (phase !== PHASE.COMPLETE) return;
    let v = 0;
    const iv = setInterval(() => { v+=4; setKe(Math.min(100,v)); if(v>=100) clearInterval(iv); }, 25);
    return () => clearInterval(iv);
  }, [phase]);

  // ────── Actions ───────────────────────────────────────────────────────
  const handleStart = () => setPhaseS(PHASE.SETUP);

  const handleHold = () => {
    setPhaseS(PHASE.STRETCH);
    setCompletedSteps([1]);
    setScore(10);
    if (handleSphere.current) handleSphere.current.visible = true;
  };

  const handleRelease = () => {
    const bonus = Math.round(storedStretchRef.current * .5);
    // Trigger particles from handle position
    const prt  = particlesRef.current;
    const hPos = handleSphere.current?.position ?? new THREE.Vector3(0,-stretchYRef.current,0);
    if (prt) {
      const pa = prt.geometry.attributes.position.array;
      for (let i=0; i<pa.length/3; i++) {
        pa[i*3]  =hPos.x+(Math.random()-.5)*.6;
        pa[i*3+1]=hPos.y+(Math.random()-.5)*.6;
        pa[i*3+2]=hPos.z;
      }
      prt.geometry.attributes.position.needsUpdate = true;
      Object.assign(prt.userData, { alive:true, age:0 });
      prt.material.opacity = 1;
    }
    // Snap band back
    setTimeout(() => {
      stretchYRef.current = 0;
      setStretchPct(0);
      if (handleSphere.current) handleSphere.current.position.set(0,-.3,.06);
      if (botBandRef.current) {
        const g = makeTube(LEFT_PIN, new THREE.Vector3(0,-.3,0), RIGHT_PIN, .065);
        botBandRef.current.geometry.dispose(); botBandRef.current.geometry = g;
        botBandRef.current.material.color.copy(COLOR_RELAX); botBandRef.current.material.emissiveIntensity=.2;
        topBandRef.current.material.color.copy(COLOR_RELAX); topBandRef.current.material.emissiveIntensity=.2;
      }
    }, 80);

    setSnapText(true);
    setTimeout(() => setSnapText(false), 1800);
    setCompletedSteps(p => [...new Set([...p,4])]);
    setScore(p => p + 50 + bonus);
    setPhaseS(PHASE.COMPLETE);
  };

  const handleRestart = () => {
    setPhaseS(PHASE.INTRO);
    setScore(0); setStretchPct(0); setKe(0); setCompletedSteps([]); setSnapText(false);
    stretchYRef.current = 0;
    storedStretchRef.current = 0;
    if (handleSphere.current) { handleSphere.current.visible=false; handleSphere.current.position.set(0,-.3,.06); }
    if (botBandRef.current) {
      const g = makeTube(LEFT_PIN, new THREE.Vector3(0,-.3,0), RIGHT_PIN, .065);
      botBandRef.current.geometry.dispose(); botBandRef.current.geometry = g;
      botBandRef.current.material.color.copy(COLOR_RELAX); botBandRef.current.material.emissiveIntensity=.2;
    }
    if (topBandRef.current) { topBandRef.current.material.color.copy(COLOR_RELAX); topBandRef.current.material.emissiveIntensity=.2; }
  };

  // Derived values
  const inExp  = phase !== PHASE.INTRO && phase !== PHASE.COMPLETE;
  const workDone  = stretchPct;
  const elasticPE = (phase === PHASE.HELD || phase === PHASE.RELEASE) ? storedStretchRef.current : (phase === PHASE.COMPLETE ? 0 : stretchPct);
  const kineticE  = phase === PHASE.COMPLETE ? ke : 0;
  const holdPct   = Math.round(((HOLD_SECONDS - holdLeft)/HOLD_SECONDS)*100);

  // ────── RENDER ────────────────────────────────────────────────────────
  return (
    <div className="app-shell">
      {/* Canvas */}
      <div ref={mountRef} className="canvas-shell" />

      {/* SNAP text */}
      {snapText && <div className="snap-text">⚡ SNAP! PE → KE!</div>}

      {/* ── INTRO ── */}
      {phase === PHASE.INTRO && (
        <div className="intro-overlay">
          <div className="intro-card">
            <div className="intro-badge">⚡ PHYSICS LAB</div>
            <h1 className="intro-title">Elastic Potential Energy</h1>
            <p className="intro-sub">Discover how a rubber band stores and releases energy through hands-on 3D simulation.</p>
            <div className="intro-concepts">
              <div className="concept-chip">💪 Work Done</div>
              <div className="concept-chip">🔶 Elastic PE</div>
              <div className="concept-chip">🚀 Kinetic Energy</div>
            </div>
            <div className="intro-formula">W → PE → KE</div>
            <button className="btn-primary btn-glow" onClick={handleStart}>🔬 Start Experiment</button>
          </div>
        </div>
      )}

      {/* ── HUD ── */}
      {inExp && (
        <>
          {/* Top bar */}
          <div className="hud-top">
            <div className="phase-steps">
              {STEPS.map(s => (
                <div key={s.id} className={`pstep ${completedSteps.includes(s.id)?'done':''} ${phase===s.phase?'active':''}`}>
                  <div className="pstep-dot">{completedSteps.includes(s.id)?'✓':s.id}</div>
                  <div className="pstep-label">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="score-badge">⭐ {score} pts</div>
          </div>

          {/* Procedure panel (left) */}
          <div className="procedure-panel">
            <div className="panel-title">📋 Procedure</div>
            {STEPS.map(s => (
              <div key={s.id} className={`step-row ${completedSteps.includes(s.id)?'done':''} ${phase===s.phase?'active':''}`}>
                <div className="step-num">{completedSteps.includes(s.id)?'✓':s.id}</div>
                <div className="step-info">
                  <div className="step-name">{s.label}</div>
                  <div className="step-desc">{s.desc}</div>
                </div>
              </div>
            ))}
            <div className="concept-box">
              <div className="concept-title">⚛️ Core Concept</div>
              <p>Stretching stores <strong>Elastic PE</strong>. Releasing converts it to <strong>Kinetic Energy</strong>.</p>
            </div>
          </div>

          {/* Energy panel (right) */}
          <div className="energy-panel">
            <div className="panel-title">⚡ Energy Monitor</div>

            <div className="emeter">
              <div className="emeter-row"><span>💪 Work Done</span><span className="emeter-val">{workDone}%</span></div>
              <div className="ebar-track"><div className="ebar work-bar" style={{width:`${workDone}%`}} /></div>
            </div>

            <div className="emeter">
              <div className="emeter-row"><span>🔶 Elastic PE</span><span className="emeter-val">{elasticPE}%</span></div>
              <div className="ebar-track"><div className="ebar pe-bar" style={{width:`${elasticPE}%`}} /></div>
            </div>

            <div className="emeter">
              <div className="emeter-row"><span>🚀 Kinetic E</span><span className="emeter-val">{kineticE}%</span></div>
              <div className="ebar-track"><div className="ebar ke-bar" style={{width:`${kineticE}%`}} /></div>
            </div>

            <div className="energy-law">⚡ Conservation of Energy<br/><span>W → PE → KE</span></div>
          </div>

          {/* Action bar (bottom) */}
          <div className="action-bar">
            {phase === PHASE.SETUP && (
              <div className="action-content">
                <p className="instruction">🖐️ Hold the rubber band firmly at <strong>both ends</strong> — feel the natural tension.</p>
                <button className="btn-primary" onClick={handleHold}>✅ I'm Holding It!</button>
              </div>
            )}
            {phase === PHASE.STRETCH && (
              <div className="action-content">
                <p className="instruction">
                  👇 Drag the <strong style={{color:'#FFD700'}}>golden handle</strong> downward to stretch the band.&nbsp;
                  {stretchPct < 45 && '⬇️ Pull harder!'} {stretchPct >= 45 && stretchPct < 75 && '🔥 Keep going!'} {stretchPct >= 75 && '💥 Release when ready!'}
                </p>
                <div className="stretch-bar-wrap">
                  <div className="stretch-fill" style={{width:`${stretchPct}%`, background:`hsl(${30-stretchPct*.3},100%,50%)`}} />
                  <span className="stretch-label">{stretchPct}% stretched</span>
                </div>
              </div>
            )}
            {phase === PHASE.HELD && (
              <div className="action-content">
                <p className="instruction">⏳ Hold the stretch! <strong>Elastic PE = {storedStretchRef.current}%</strong> is stored inside the band! ({holdLeft}s)</p>
                <div className="stretch-bar-wrap">
                  <div className="stretch-fill" style={{width:`${holdPct}%`, background:'#FF8C42'}} />
                  <span className="stretch-label">Storing energy...</span>
                </div>
              </div>
            )}
            {phase === PHASE.RELEASE && (
              <div className="action-content">
                <p className="instruction">⚡ Elastic PE <strong>{storedStretchRef.current}%</strong> stored — click to convert ALL of it into Kinetic Energy!</p>
                <button className="btn-release" onClick={handleRelease}>🚀 RELEASE THE BAND!</button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── COMPLETE ── */}
      {phase === PHASE.COMPLETE && (
        <div className="complete-overlay">
          <div className="complete-card">
            <div className="complete-badge">🎉 Experiment Complete!</div>
            <h2>Energy Transformation Observed</h2>

            <div className="flow-diagram">
              <div className="flow-node work-node">
                <div className="flow-icon">💪</div>
                <div className="flow-title">Work Done</div>
                <div className="flow-val">{storedStretchRef.current}%</div>
              </div>
              <div className="flow-arrow">→</div>
              <div className="flow-node pe-node">
                <div className="flow-icon">🔶</div>
                <div className="flow-title">Elastic PE</div>
                <div className="flow-val">Stored</div>
              </div>
              <div className="flow-arrow">→</div>
              <div className="flow-node ke-node">
                <div className="flow-icon">🚀</div>
                <div className="flow-title">Kinetic E</div>
                <div className="flow-val ke-animated">{ke}%</div>
              </div>
            </div>

            <div className="conclusions">
              <div className="conclusion-title">📝 Conclusions</div>
              <ul>
                <li>Stretching the band does <strong>work against elasticity</strong>.</li>
                <li>This work is stored as <strong>Elastic Potential Energy</strong>.</li>
                <li>On release, PE converts to <strong>Kinetic Energy</strong> — the band snaps back.</li>
                <li>This proves <strong>Energy Conservation</strong> in elastic materials.</li>
              </ul>
            </div>

            <div className="final-score">⭐ Final Score: <strong>{score}</strong> pts</div>
            <button className="btn-primary btn-glow" onClick={handleRestart}>🔄 Try Again</button>
          </div>
        </div>
      )}
    </div>
  );
}
