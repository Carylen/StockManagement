// =============================================================
// Prototype A — Login sidebar mining animations
// Four bright, lively visualisations rendered behind the dark
// brand panel. User picks via a tiny mono switcher; selection
// persists in localStorage.
// =============================================================
(function(){

const LOGIN_ANIMS = [
  { k:'haul',    label:'Haul cycle' },
  { k:'seism',   label:'Seismic'    },
  { k:'strata',  label:'Strata'     },
  { k:'convey',  label:'Conveyor'   },
];

// ─── Haul cycle ────────────────────────────────────────────────
// Open-pit scene: a sun glow, drifting clouds, birds, a working
// excavator loading at the bench, and a 3-truck convoy hauling
// across the graded ground line, kicking up dust.
const HaulAnim = ({ accent }) => (
  <div className="anim-layer" style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }}>
    {/* sky wash + sun */}
    <div style={{ position:'absolute', inset:0, background:`radial-gradient(ellipse 90% 60% at 70% 100%, ${accent}33 0%, transparent 60%), radial-gradient(circle at 78% 16%, ${accent}26 0%, transparent 34%)` }}/>
    <div style={{ position:'absolute', top:'10%', right:'14%', width:90, height:90, borderRadius:'50%',
      background:`radial-gradient(circle, ${accent} 0%, ${accent}66 38%, transparent 70%)`, animation:'sun-glow 5s ease-in-out infinite' }}/>

    {/* drifting clouds */}
    <div style={{ position:'absolute', top:'18%', left:'12%', animation:'cloud-drift 9s ease-in-out infinite alternate' }}>
      <Cloud o={0.16}/>
    </div>
    <div style={{ position:'absolute', top:'30%', left:'46%', animation:'cloud-drift 12s ease-in-out infinite alternate-reverse' }}>
      <Cloud o={0.11}/>
    </div>

    {/* birds */}
    <div style={{ position:'absolute', top:'24%', left:'30%', animation:'birds-fly 11s linear infinite' }}>
      <Birds accent="#fff"/>
    </div>

    {/* ridge lines */}
    <svg width="100%" height="100%" viewBox="0 0 600 800" preserveAspectRatio="none" style={{ position:'absolute', inset:0, opacity:0.28 }}>
      <polyline points="0,560 80,540 160,548 240,520 320,536 400,512 480,528 560,508 600,520" fill="none" stroke="#fff" strokeWidth="1.4"/>
      <polyline points="0,600 100,580 180,592 260,572 340,584 420,560 500,576 600,560" fill="none" stroke="#fff" strokeWidth="1"/>
    </svg>

    {/* ground line + tick marks */}
    <div style={{ position:'absolute', left:0, right:0, bottom:'20%', height:2, background:`${accent}88`, boxShadow:`0 0 10px ${accent}55` }}/>
    <div style={{ position:'absolute', left:0, right:0, bottom:'18.8%', height:6, opacity:0.5,
      backgroundImage:'repeating-linear-gradient(90deg, rgba(255,255,255,0.30) 0 1px, transparent 1px 26px)' }}/>

    {/* working excavator at the loading bench (right side) */}
    <div style={{ position:'absolute', bottom:'20%', right:'8%' }}>
      <Excavator accent={accent}/>
    </div>

    {/* truck convoy — three at staggered scale/phase */}
    <div style={{ position:'absolute', bottom:'20%', left:0, animation:'haul-drive 11s linear infinite' }}>
      <HaulTruck accent={accent} scale={1}/>
    </div>
    <div style={{ position:'absolute', bottom:'20%', left:0, animation:'haul-drive 11s linear infinite -4s', opacity:0.85 }}>
      <HaulTruck accent={accent} scale={0.82}/>
    </div>
    <div style={{ position:'absolute', bottom:'20%', left:0, animation:'haul-drive 11s linear infinite -7.5s', opacity:0.6 }}>
      <HaulTruck accent={accent} scale={0.64}/>
    </div>
  </div>
);

const Cloud = ({ o }) => (
  <svg width="120" height="44" viewBox="0 0 120 44" fill="#fff" fillOpacity={o}>
    <circle cx="34" cy="28" r="16"/>
    <circle cx="56" cy="22" r="20"/>
    <circle cx="82" cy="28" r="15"/>
    <rect x="30" y="30" width="58" height="12" rx="6"/>
  </svg>
);

const Birds = ({ accent }) => (
  <svg width="60" height="20" viewBox="0 0 60 20" fill="none" stroke={accent} strokeOpacity="0.7" strokeWidth="1.4" strokeLinecap="round">
    <path d="M2 10 Q8 2 14 10 Q20 2 26 10"/>
    <path d="M30 14 Q35 7 40 14 Q45 7 50 14"/>
  </svg>
);

const HaulTruck = ({ accent, scale }) => {
  const W = 150 * scale, H = 78 * scale;
  return (
    <div style={{ position:'relative', width:W, height:H, transform:'translateY(-100%)' }}>
      {/* dust puffs trailing left */}
      <div style={{ position:'absolute', left:-8*scale, bottom:0, width:20*scale, height:20*scale, borderRadius:'50%',
        background:'rgba(248,228,190,0.30)', animation:'haul-dust 1.5s ease-out infinite' }}/>
      <div style={{ position:'absolute', left:-24*scale, bottom:2*scale, width:16*scale, height:16*scale, borderRadius:'50%',
        background:'rgba(248,228,190,0.22)', animation:'haul-dust 1.5s ease-out -0.5s infinite' }}/>
      <div style={{ position:'absolute', left:-40*scale, bottom:5*scale, width:12*scale, height:12*scale, borderRadius:'50%',
        background:'rgba(248,228,190,0.14)', animation:'haul-dust 1.5s ease-out -1s infinite' }}/>

      <svg width={W} height={H} viewBox="0 0 150 78" style={{ position:'absolute', inset:0, filter:`drop-shadow(0 0 6px ${accent}44)` }}>
        {/* dump bed — angled trapezoid */}
        <polygon points="42,18 138,18 132,46 36,46" fill={accent} opacity="1"/>
        <line x1="42" y1="18" x2="138" y2="18" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.4"/>
        {/* ore load peeking over bed */}
        <path d="M50 18 q10 -8 20 0 q12 -7 22 0 q10 -6 20 0 z" fill="#fff" opacity="0.32"/>
        {/* chassis */}
        <rect x="22" y="46" width="116" height="10" fill="#1B1814" stroke={accent} strokeOpacity="0.8" strokeWidth="1"/>
        {/* cabin */}
        <rect x="22" y="22" width="22" height="26" fill="#0F0E0C" stroke={accent} strokeWidth="1.4"/>
        <rect x="26" y="26" width="14" height="10" fill={accent} opacity="0.9"/>
        <circle cx="22" cy="44" r="2.4" fill={accent}/>
        {/* wheels */}
        <g style={{ transformOrigin:'40px 64px', animation:'wheel-spin 0.6s linear infinite' }}>
          <circle cx="40" cy="64" r="11" fill="#0F0E0C" stroke={accent} strokeWidth="2.6"/>
          <line x1="29" y1="64" x2="51" y2="64" stroke={accent} strokeWidth="1.3"/>
          <line x1="40" y1="53" x2="40" y2="75" stroke={accent} strokeWidth="1.3"/>
        </g>
        <g style={{ transformOrigin:'110px 64px', animation:'wheel-spin 0.6s linear infinite' }}>
          <circle cx="110" cy="64" r="11" fill="#0F0E0C" stroke={accent} strokeWidth="2.6"/>
          <line x1="99" y1="64" x2="121" y2="64" stroke={accent} strokeWidth="1.3"/>
          <line x1="110" y1="53" x2="110" y2="75" stroke={accent} strokeWidth="1.3"/>
        </g>
      </svg>
    </div>
  );
};

// Excavator that swings its boom + bucket on a loop, ejecting dirt
const Excavator = ({ accent }) => (
  <div style={{ position:'relative', width:96, height:92, transform:'translateY(-100%)' }}>
    {/* spoil particles flung from bucket */}
    <div style={{ position:'absolute', left:8, top:6, width:6, height:6, borderRadius:'50%', background:'rgba(248,228,190,0.5)', ['--sx']:'-16px', ['--sy']:'-10px', animation:'spark-fly 1.6s ease-out infinite' }}/>
    <div style={{ position:'absolute', left:12, top:10, width:5, height:5, borderRadius:'50%', background:'rgba(248,228,190,0.4)', ['--sx']:'-22px', ['--sy']:'-4px', animation:'spark-fly 1.6s ease-out -0.6s infinite' }}/>

    <svg width="96" height="92" viewBox="0 0 96 92" style={{ position:'absolute', inset:0, filter:`drop-shadow(0 0 6px ${accent}44)` }}>
      {/* tracks */}
      <rect x="40" y="74" width="52" height="14" rx="7" fill="#0F0E0C" stroke={accent} strokeWidth="1.6"/>
      <circle cx="50" cy="81" r="4" fill="none" stroke={accent} strokeWidth="1.2"/>
      <circle cx="82" cy="81" r="4" fill="none" stroke={accent} strokeWidth="1.2"/>
      {/* house / cab */}
      <rect x="52" y="50" width="34" height="24" rx="4" fill={accent}/>
      <rect x="56" y="54" width="14" height="12" fill="#0F0E0C" opacity="0.85"/>
      {/* boom + arm + bucket — animated group, pivots at cab shoulder */}
      <g style={{ transformOrigin:'56px 56px', animation:'exc-boom 3.4s ease-in-out infinite' }}>
        <rect x="20" y="48" width="40" height="8" rx="4" fill={accent} transform="rotate(-32 56 56)"/>
        <g style={{ transformOrigin:'24px 30px', animation:'exc-bucket 3.4s ease-in-out infinite' }}>
          <rect x="14" y="26" width="8" height="26" rx="4" fill={accent}/>
          <path d="M6 50 L24 50 L22 64 L10 64 Z" fill="#0F0E0C" stroke={accent} strokeWidth="1.6"/>
        </g>
      </g>
    </svg>
  </div>
);

// ─── Seismic ───────────────────────────────────────────────────
// Survey scope: concentric rings pulsing out, a rotating sweep
// beam, and target blips flashing across the grid.
const SeismAnim = ({ accent }) => (
  <div className="anim-layer" style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }}>
    {/* grid backdrop (brighter) */}
    <div style={{ position:'absolute', inset:0, opacity:0.12,
      backgroundImage:`linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px),
                       linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)`,
      backgroundSize:'38px 38px',
      maskImage:'radial-gradient(circle at 50% 50%, #000 35%, transparent 78%)',
      WebkitMaskImage:'radial-gradient(circle at 50% 50%, #000 35%, transparent 78%)',
    }}/>

    <div style={{ position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)', width:620, height:620 }}>
      {/* rotating sweep beam */}
      <div style={{ position:'absolute', inset:0, borderRadius:'50%', animation:'seism-sweep 3.6s linear infinite',
        background:`conic-gradient(from 0deg, ${accent}00 0deg, ${accent}00 300deg, ${accent}55 350deg, ${accent}aa 360deg)`,
        maskImage:'radial-gradient(circle, #000 0%, #000 49%, transparent 50%)',
        WebkitMaskImage:'radial-gradient(circle, #000 0%, #000 49%, transparent 50%)' }}/>
      {/* pulsing rings (more + brighter) */}
      {[0,1,2,3,4,5].map(i => (
        <div key={i} style={{
          position:'absolute', inset:0, borderRadius:'50%',
          border:`1.4px solid ${accent}`,
          boxShadow:`0 0 14px ${accent}55`,
          animation:`seism-ring 4.8s cubic-bezier(.2,.7,.3,1) ${i * 0.8}s infinite`,
          opacity:0,
        }}/>
      ))}
      {/* center crosshair */}
      <div style={{ position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)' }}>
        <div style={{ width:64, height:64, borderRadius:'50%', border:`1.4px solid ${accent}88`, position:'relative' }}>
          <div style={{ position:'absolute', left:'50%', top:-10, bottom:-10, width:1, background:`${accent}aa`, transform:'translateX(-50%)' }}/>
          <div style={{ position:'absolute', top:'50%', left:-10, right:-10, height:1, background:`${accent}aa`, transform:'translateY(-50%)' }}/>
          <div style={{ position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)', width:8, height:8, borderRadius:'50%', background:accent, boxShadow:`0 0 16px ${accent}` }}/>
        </div>
      </div>
      {/* target blips */}
      {[
        { x:'24%', y:'34%', d:'0s'   },
        { x:'72%', y:'28%', d:'1.1s' },
        { x:'66%', y:'70%', d:'2.0s' },
        { x:'30%', y:'66%', d:'2.8s' },
        { x:'82%', y:'52%', d:'1.6s' },
      ].map((b,i) => (
        <div key={i} style={{ position:'absolute', left:b.x, top:b.y, width:12, height:12, borderRadius:'50%',
          background:accent, boxShadow:`0 0 14px ${accent}`, animation:`blip-flash 3.6s ease-out ${b.d} infinite` }}/>
      ))}
    </div>

    <div style={{ position:'absolute', bottom:24, right:24, fontFamily:window.PROTO_MONO || 'monospace', fontSize:10, color:`${accent}cc`, letterSpacing:1, lineHeight:1.7, textAlign:'right' }}>
      <div>SURVEY · RANTAU</div>
      <div>02°41′S · 115°20′E</div>
      <div>5 ANOMALI · SCAN</div>
    </div>
  </div>
);

// ─── Strata ────────────────────────────────────────────────────
// Active drilling: two boreholes, a spinning drill bit bobbing into
// a bright coal seam, ejecting cuttings, with a scan line sweeping.
const StrataAnim = ({ accent }) => {
  const layers = [
    { y:62,  h:6,  o:0.16, color:'#fff'   },
    { y:68,  h:10, o:0.26, color:accent   },
    { y:78,  h:4,  o:0.16, color:'#fff'   },
    { y:82,  h:14, o:0.36, color:accent   },
    { y:96,  h:6,  o:0.18, color:'#fff'   },
    { y:102, h:18, o:0.46, color:accent   },
    { y:120, h:10, o:0.26, color:'#fff'   },
  ];
  return (
    <div className="anim-layer" style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }}>
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.03) 65%, rgba(255,255,255,0.07) 100%)' }}/>

      <div style={{ position:'absolute', left:0, right:0, bottom:0, height:'62%' }}>
        {layers.map((l, i) => (
          <div key={i} style={{
            position:'absolute', left:0, right:0,
            top:`${l.y - 60}%`, height:`${l.h}%`,
            background:l.color, opacity:l.o,
            animation:`strata-pulse 4s ease-in-out ${i * 0.35}s infinite`,
          }}/>
        ))}

        {/* derrick + spinning drill on borehole A (30%) */}
        <div style={{ position:'absolute', left:'30%', top:'-14%', transform:'translateX(-50%)', width:36, height:'40%' }}>
          {/* mast */}
          <div style={{ position:'absolute', left:'50%', top:0, bottom:0, width:2, background:`${accent}aa`, transform:'translateX(-50%)', boxShadow:`0 0 8px ${accent}66` }}/>
          {/* drill string + bit, bobbing */}
          <div style={{ position:'absolute', left:'50%', top:'10%', transform:'translateX(-50%)', animation:'drill-bob 2.2s ease-in-out infinite' }}>
            <div style={{ width:3, height:48, background:`${accent}`, margin:'0 auto' }}/>
            <div style={{ width:16, height:14, margin:'0 auto', animation:'drill-spin 0.4s linear infinite' }}>
              <svg width="16" height="14" viewBox="0 0 16 14"><polygon points="0,0 16,0 8,14" fill={accent}/></svg>
            </div>
          </div>
          {/* cuttings ejected */}
          <div style={{ position:'absolute', left:'40%', top:'58%', width:5, height:5, borderRadius:'50%', background:`${accent}`, ['--sx']:'-14px', ['--sy']:'-12px', animation:'spark-fly 1.4s ease-out infinite' }}/>
          <div style={{ position:'absolute', left:'60%', top:'58%', width:4, height:4, borderRadius:'50%', background:'rgba(255,255,255,0.6)', ['--sx']:'14px', ['--sy']:'-10px', animation:'spark-fly 1.4s ease-out -0.5s infinite' }}/>
        </div>

        {/* static probe on borehole B (72%) */}
        <div style={{ position:'absolute', left:'72%', top:'8%', bottom:0, width:1.5, background:`${accent}66` }}/>
        <div style={{ position:'absolute', left:'72%', top:'8%', transform:'translate(-50%,-50%)', width:11, height:11, borderRadius:'50%', border:`1.4px solid ${accent}`, background:'#1B1814', boxShadow:`0 0 8px ${accent}55` }}/>

        {/* scan line sweeping down */}
        <div style={{
          position:'absolute', left:0, right:0, height:2,
          background:`linear-gradient(90deg, transparent 0%, ${accent} 50%, transparent 100%)`,
          boxShadow:`0 0 22px ${accent}, 0 0 44px ${accent}88`,
          animation:'strata-scan 5s ease-in-out infinite',
        }}/>
      </div>

      <div style={{ position:'absolute', right:18, bottom:'58%', fontFamily:window.PROTO_MONO || 'monospace', fontSize:10, color:`${accent}cc`, letterSpacing:1, textAlign:'right', lineHeight:1.7 }}>
        <div>DRILL B-204 · ON</div>
        <div>SEAM A · 14.2 m</div>
      </div>
    </div>
  );
};

// ─── Conveyor ──────────────────────────────────────────────────
// Two-belt transfer: a hopper drops chunks onto an upper belt that
// feeds a lower belt; both run fast with rotating pulleys, sparks at
// the transfer point, and a growing discharge pile.
const ConveyAnim = ({ accent }) => (
  <div className="anim-layer" style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }}>
    <div style={{ position:'absolute', left:'8%', top:'56%', width:260, height:260, borderRadius:'50%',
      background:`radial-gradient(circle, ${accent}2e 0%, transparent 60%)`, filter:'blur(8px)' }}/>

    <svg width="100%" height="100%" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice" style={{ position:'absolute', inset:0 }}>
      <defs>
        <linearGradient id="belt-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0.16"/>
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.30"/>
          <stop offset="1" stopColor="#fff" stopOpacity="0.16"/>
        </linearGradient>
        <path id="belt-path"  d="M 120 332 L 520 188"/>
        <path id="belt-path2" d="M 80 632 L 470 372"/>
      </defs>

      {/* hopper at top-right feeding upper belt */}
      <g>
        <path d="M508 120 L560 120 L548 168 L520 168 Z" fill="#0F0E0C" stroke={accent} strokeWidth="2"/>
        <line x1="508" y1="120" x2="560" y2="120" stroke={accent} strokeWidth="2.4"/>
      </g>

      {/* support legs */}
      <line x1="160" y1="318" x2="160" y2="780" stroke="#fff" strokeOpacity="0.16" strokeWidth="2"/>
      <line x1="470" y1="200" x2="470" y2="372" stroke="#fff" strokeOpacity="0.14" strokeWidth="2"/>
      <line x1="120" y1="620" x2="120" y2="780" stroke="#fff" strokeOpacity="0.16" strokeWidth="2"/>
      <line x1="300" y1="500" x2="300" y2="780" stroke="#fff" strokeOpacity="0.10" strokeWidth="1.5"/>

      {/* upper belt */}
      <line x1="120" y1="344" x2="520" y2="200" stroke="url(#belt-grad)" strokeWidth="20"/>
      <line x1="120" y1="344" x2="520" y2="200" stroke="#fff" strokeOpacity="0.32" strokeWidth="1"/>
      {/* lower belt */}
      <line x1="80" y1="644" x2="470" y2="384" stroke="url(#belt-grad)" strokeWidth="22"/>
      <line x1="80" y1="644" x2="470" y2="384" stroke="#fff" strokeOpacity="0.32" strokeWidth="1"/>

      {/* hopper-dropped chunks falling into upper belt */}
      {[0,1,2].map(i => (
        <rect key={'h'+i} x="528" y="150" width="14" height="14" rx="3" fill={accent}
          style={{ animation:`hopper-drop 1.8s ease-in ${-i * 0.6}s infinite` }}/>
      ))}

      {/* chunks on upper belt */}
      {[0,1,2,3,4].map(i => (
        <rect key={'u'+i} x="-10" y="-10" width="20" height="20" rx="5" fill={accent} opacity="0.95">
          <animateMotion dur="3.2s" repeatCount="indefinite" begin={`${-i * 0.64}s`} rotate="0">
            <mpath href="#belt-path"/>
          </animateMotion>
        </rect>
      ))}
      {/* chunks on lower belt */}
      {[0,1,2,3,4,5].map(i => (
        <rect key={'l'+i} x="-11" y="-11" width="22" height="22" rx="5" fill={accent} opacity="0.95">
          <animateMotion dur="3.4s" repeatCount="indefinite" begin={`${-i * 0.56}s`} rotate="0">
            <mpath href="#belt-path2"/>
          </animateMotion>
        </rect>
      ))}

      {/* transfer sparks where upper belt feeds lower */}
      <g transform="translate(498,196)">
        <circle r="3" fill={accent} style={{ ['--sx']:'-12px', ['--sy']:'14px', animation:'spark-fly 1.2s ease-out infinite' }}/>
        <circle r="2.4" fill="#fff" fillOpacity="0.7" style={{ ['--sx']:'-18px', ['--sy']:'8px', animation:'spark-fly 1.2s ease-out -0.4s infinite' }}/>
      </g>

      {/* pulleys — upper */}
      <g style={{ transformOrigin:'120px 344px', animation:'conv-roll 1.6s linear infinite' }}>
        <circle cx="120" cy="344" r="20" fill="#0F0E0C" stroke={accent} strokeWidth="2.6"/>
        <line x1="100" y1="344" x2="140" y2="344" stroke={accent} strokeWidth="1.5"/>
        <line x1="120" y1="324" x2="120" y2="364" stroke={accent} strokeWidth="1.5"/>
      </g>
      <g style={{ transformOrigin:'520px 200px', animation:'conv-roll 1.6s linear infinite' }}>
        <circle cx="520" cy="200" r="20" fill="#0F0E0C" stroke={accent} strokeWidth="2.6"/>
        <line x1="500" y1="200" x2="540" y2="200" stroke={accent} strokeWidth="1.5"/>
        <line x1="520" y1="180" x2="520" y2="220" stroke={accent} strokeWidth="1.5"/>
      </g>
      {/* pulleys — lower */}
      <g style={{ transformOrigin:'80px 644px', animation:'conv-roll 1.8s linear infinite' }}>
        <circle cx="80" cy="644" r="22" fill="#0F0E0C" stroke={accent} strokeWidth="2.6"/>
        <line x1="58" y1="644" x2="102" y2="644" stroke={accent} strokeWidth="1.5"/>
        <line x1="80" y1="622" x2="80" y2="666" stroke={accent} strokeWidth="1.5"/>
      </g>
      <g style={{ transformOrigin:'470px 384px', animation:'conv-roll 1.8s linear infinite' }}>
        <circle cx="470" cy="384" r="20" fill="#0F0E0C" stroke={accent} strokeWidth="2.6"/>
        <line x1="450" y1="384" x2="490" y2="384" stroke={accent} strokeWidth="1.5"/>
        <line x1="470" y1="364" x2="470" y2="404" stroke={accent} strokeWidth="1.5"/>
      </g>
    </svg>

    {/* discharge pile — stacked rounded chunks at base */}
    <div style={{ position:'absolute', left:'7%', bottom:'12%' }}>
      {[
        { x:0, y:0,  s:20, o:0.7 }, { x:20, y:2, s:18, o:0.75 }, { x:36, y:-2, s:16, o:0.7 },
        { x:11, y:-15, s:16, o:0.6 }, { x:27, y:-17, s:14, o:0.55 }, { x:18, y:-30, s:12, o:0.5 },
      ].map((p, i) => (
        <div key={i} style={{ position:'absolute', left:p.x, bottom:p.y, width:p.s, height:p.s, borderRadius:4, background:accent, opacity:p.o }}/>
      ))}
    </div>

    <div style={{ position:'absolute', bottom:24, right:24, fontFamily:window.PROTO_MONO || 'monospace', fontSize:10, color:`${accent}cc`, letterSpacing:1, lineHeight:1.7, textAlign:'right' }}>
      <div>BELT CV-07 · CV-08</div>
      <div>1 850 t/h · NORM</div>
    </div>
  </div>
);

// ─── Picker UI (bottom-left, mono caps) ────────────────────────
const AnimPicker = ({ kind, onPick, accent }) => (
  <div style={{
    position:'absolute', left:56, bottom:48, zIndex:5,
    display:'flex', alignItems:'center', gap:10,
    fontFamily:window.PROTO_MONO || 'monospace',
    fontSize:10, letterSpacing:1.4, color:'rgba(255,255,255,0.5)',
    textTransform:'uppercase',
  }}>
    <span>VIS</span>
    <span style={{ width:14, height:1, background:'rgba(255,255,255,0.2)' }}/>
    <div style={{ display:'flex', gap:4, padding:3, background:'rgba(255,255,255,0.05)', borderRadius:8, border:'1px solid rgba(255,255,255,0.08)' }}>
      {LOGIN_ANIMS.map(a => {
        const on = a.k === kind;
        return (
          <button
            key={a.k}
            data-proto-link="true"
            onClick={() => onPick(a.k)}
            title={a.label}
            style={{
              padding:'6px 10px', borderRadius:5,
              background: on ? accent : 'transparent',
              color: on ? '#1B1814' : 'rgba(255,255,255,0.65)',
              fontSize:10, fontWeight:700, letterSpacing:1.2,
              fontFamily:'inherit', textTransform:'uppercase',
              cursor:'pointer',
              transition:'background 0.18s ease, color 0.18s ease',
            }}
          >
            {a.label}
          </button>
        );
      })}
    </div>
  </div>
);

// ─── Wrapper exposed to public.jsx ─────────────────────────────
const LoginSidebarAnim = ({ accent }) => {
  const [kind, setKind] = React.useState(() => {
    try { return localStorage.getItem('uts-login-anim') || 'haul'; }
    catch { return 'haul'; }
  });
  const pick = (k) => {
    setKind(k);
    try { localStorage.setItem('uts-login-anim', k); } catch {}
  };
  return (
    <>
      <div style={{ position:'absolute', inset:0, zIndex:0, overflow:'hidden' }}>
        {kind === 'haul'   && <HaulAnim   accent={accent}/>}
        {kind === 'seism'  && <SeismAnim  accent={accent}/>}
        {kind === 'strata' && <StrataAnim accent={accent}/>}
        {kind === 'convey' && <ConveyAnim accent={accent}/>}
      </div>
      <AnimPicker kind={kind} onPick={pick} accent={accent}/>
    </>
  );
};

Object.assign(window, { PROTO_LoginSidebarAnim: LoginSidebarAnim });
})();
