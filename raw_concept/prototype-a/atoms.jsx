// =============================================================
// Prototype A — Shared atoms, tokens, chrome
// Honeyglow palette (cream + UT yellow + coral + indigo)
// =============================================================
(function(){
const P = window.UT_PARTS, H = window.UT_HELPERS;

// ─── Tokens ────────────────────────────────────────────────────
// Pearl-white glassmorphism palette
const A = {
  bg:        '#F6F3EE',           // pearl base — sits behind glass cards
  surface:   '#FFFFFF',           // cards (CSS attribute-selector adds glass effect)
  surfaceAlt:'#EDE9E0',
  ink:       '#16110D',
  ink2:      '#6B6256',
  ink3:      '#A39A8A',
  line:      'rgba(27,24,20,0.06)',
  lineStrong:'rgba(27,24,20,0.12)',
  // UT brand · honey/yellow (untuk role UT)
  honey:     '#E8A323',
  honeyDeep: '#B07410',
  honeySoft: '#FFF1D0',
  // KPP brand · hijau elegan (untuk role Plant: Admin/GL/Mekanik)
  green:     '#1F6F4C',
  greenDeep: '#0F4A30',
  greenSoft: '#DCEEE3',
  greenMid:  '#2F7D5C',
  coral:     '#FF7A59',
  coralSoft: '#FFE5DC',
  indigo:    '#5B5BD6',
  indigoSoft:'#E6E6F9',
  aman:      '#16A34A',  amanBg: '#DCFCE7',
  warn:      '#DC2626',  warnBg: '#FCE7E7',
  over:      '#D97706',  overBg: '#FEF3C7',
  max:       '#2563EB',  maxBg:  '#DBEAFE',
  pending:   '#D97706',  pendingBg: '#FEF3C7',
  tersedia:  '#15803D',  tersediaBg:'#DCFCE7',
  tidakAda:  '#B91C1C',  tidakAdaBg:'#FEE2E2',
  partial:   '#6D28D9',  partialBg: '#EDE9FE',
  draft:     '#4B5563',  draftBg:   '#F3F4F6',
};
const FONT = "'Plus Jakarta Sans', system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace";

// ─── Theme helper · KPP vs UT ─────────────────────────────────
// role: 'admin' | 'gl' | 'mekanik'  → KPP green
//       'ut'                         → UT honey/yellow
function themeFor(role) {
  if (role === 'ut') {
    return {
      org:'UT', orgLabel:'United Tractors',
      primary:A.honey, primaryDeep:A.honeyDeep, primarySoft:A.honeySoft,
      onPrimary:A.ink,
    };
  }
  return {
    org:'KPP', orgLabel:'KPP Mining',
    primary:A.green, primaryDeep:A.greenDeep, primarySoft:A.greenSoft,
    onPrimary:'#FFFFFF',
  };
}

// ─── Icons ─────────────────────────────────────────────────────
const Ic = {
  search: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>,
  bell:   () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9z"/><path d="M10 21h4"/></svg>,
  upload: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 3v13"/><path d="m6 9 6-6 6 6"/><path d="M5 21h14"/></svg>,
  check:  () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="m5 12 4 4 10-10"/></svg>,
  arrow:  () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14"/><path d="m13 5 7 7-7 7"/></svg>,
  back:   () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 5-7 7 7 7"/></svg>,
  home:   () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m3 11 9-8 9 8v9a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z"/></svg>,
  cube:   () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="m12 3 9 5v8l-9 5-9-5V8z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v9"/></svg>,
  doc:    () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>,
  user:   () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg>,
  plus:   () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>,
  dot3:   () => <svg width="16" height="4" viewBox="0 0 16 4" fill="currentColor"><circle cx="2" cy="2" r="1.5"/><circle cx="8" cy="2" r="1.5"/><circle cx="14" cy="2" r="1.5"/></svg>,
  filter: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 5h18M6 12h12M10 19h4"/></svg>,
  spark:  () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/></svg>,
  ware:   () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9 12 4l9 5v11H3z"/><path d="M9 20v-7h6v7"/></svg>,
  x:      () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>,
  signal: () => <svg width="16" height="10" viewBox="0 0 16 10" fill="currentColor"><rect x="0" y="6" width="3" height="4" rx="0.5"/><rect x="4" y="4" width="3" height="6" rx="0.5"/><rect x="8" y="2" width="3" height="8" rx="0.5"/><rect x="12" y="0" width="3" height="10" rx="0.5"/></svg>,
  batt:   () => <svg width="20" height="10" viewBox="0 0 22 10" fill="none" stroke="currentColor"><rect x="0.5" y="0.5" width="18" height="9" rx="2"/><rect x="2" y="2" width="14" height="6" rx="1" fill="currentColor"/><rect x="19" y="3.5" width="2" height="3" rx="0.5" fill="currentColor"/></svg>,
};

// ─── Badges ────────────────────────────────────────────────────
const Badge = ({ children, color, bg, dot=true, mono=false }) => (
  <span style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 10px',
    borderRadius:999, background:bg, color, fontSize:11, fontWeight:600,
    letterSpacing:0.4, textTransform:'uppercase', fontFamily: mono?MONO:FONT, lineHeight:1 }}>
    {dot && <span style={{ width:6, height:6, borderRadius:'50%', background:color }}/>}
    {children}
  </span>
);
const STATUS_STYLE = {
  AMAN:    [A.aman, A.amanBg],
  WARNING: [A.warn, A.warnBg],
  OVER:    [A.over, A.overBg],
  MAX:     [A.max,  A.maxBg],
};
const StatusBadge = ({ s }) => {
  const [c,b] = STATUS_STYLE[s] || [A.ink2, A.surfaceAlt];
  return <Badge color={c} bg={b}>{s}</Badge>;
};
const INQ_STYLE = {
  PENDING:    [A.pending, A.pendingBg],      // menunggu UT respond
  VALID:      [A.tersedia, A.tersediaBg],    // UT: tersedia di kode site UT
  INVALID:    [A.tidakAda, A.tidakAdaBg],    // UT: PN diganti
  // legacy aliases (in case any sample inquiry still uses old labels)
  DRAFT:      [A.draft, A.draftBg],
  TERSEDIA:   [A.tersedia, A.tersediaBg],
  "TIDAK ADA":[A.tidakAda, A.tidakAdaBg],
  PARTIAL:    [A.partial, A.partialBg],
  REVIEW:     [A.indigo, A.indigoSoft],
};
const InqBadge = ({ s }) => {
  const [c,b] = INQ_STYLE[s] || [A.ink2, A.surfaceAlt];
  return <Badge color={c} bg={b}>{s}</Badge>;
};

// ─── Gauge ─────────────────────────────────────────────────────
const Gauge = ({ p, h=14 }) => {
  const range = Math.max(p.max * 1.3, p.rtt * 1.1, 1);
  const minPct = (p.min / range) * 100;
  const maxPct = (p.max / range) * 100;
  const rttPct = Math.min((p.rtt / range) * 100, 100);
  const status = H.statusOf(p);
  const fill = STATUS_STYLE[status][0];
  return (
    <div style={{ position:'relative', height:h, borderRadius:h/2, background:A.surfaceAlt, overflow:'visible' }}>
      <div style={{ position:'absolute', left:minPct+'%', width:(maxPct-minPct)+'%', top:0, bottom:0, background:A.honeySoft }}/>
      <div style={{ position:'absolute', left:0, width:rttPct+'%', top:0, bottom:0, background:fill, borderRadius:h/2, opacity:0.92 }}/>
      <div style={{ position:'absolute', left:`calc(${minPct}% - 1px)`, top:-3, bottom:-3, width:2, background:A.ink, opacity:0.45 }}/>
      <div style={{ position:'absolute', left:`calc(${maxPct}% - 1px)`, top:-3, bottom:-3, width:2, background:A.ink, opacity:0.45 }}/>
    </div>
  );
};

// ─── Logo ──────────────────────────────────────────────────────
const Logo = ({ size=16, dark=false, onClick, org='UT' }) => {
  const isKpp = org === 'KPP';
  const c1 = isKpp ? A.green : A.honey;
  const c2 = isKpp ? A.greenMid : A.coral;
  const accentDeep = isKpp ? A.greenDeep : A.honeyDeep;
  return (
    <div data-proto-link={onClick?'true':undefined} onClick={onClick} style={{ display:'flex', alignItems:'center', gap:8, fontFamily:FONT }}>
      <div style={{ width:size+10, height:size+10, borderRadius:8, background:A.ink, display:'grid', placeItems:'center', boxShadow:`inset 0 0 0 1px ${c1}` }}>
        <div style={{ width:size-2, height:size-2, borderRadius:4, background:`linear-gradient(135deg, ${c1}, ${c2})` }}/>
      </div>
      <div style={{ fontSize:size, fontWeight:800, letterSpacing:-0.3, color:dark?A.surface:A.ink, lineHeight:1 }}>
        UT<span style={{ color:accentDeep }}>·</span>STOCK
        <div style={{ fontSize:size-7, fontWeight:500, color:dark?'rgba(255,255,255,0.55)':A.ink2, letterSpacing:1.5, marginTop:2 }}>BY KPP MINING</div>
      </div>
    </div>
  );
};

// ─── Site Badge ────────────────────────────────────────────────
const SiteBadge = ({ site, mono=true }) => {
  const map = {
    AGMR: [A.green, A.greenSoft],
    RANT: [A.indigo, A.indigoSoft],
    SPUT: [A.coral, A.coralSoft],
    ALL:  [A.ink, A.surfaceAlt],
  };
  const [c,b] = map[site] || [A.ink2, A.surfaceAlt];
  return <Badge color={c} bg={b} mono={mono}>{site}</Badge>;
};

// ─── Sidebar (desktop) — interactive ───────────────────────────
const ADMIN_NAV = [
  { k:'dashboard', icon:Ic.home, label:'Dashboard' },
  { k:'katalog', icon:Ic.cube, label:'Readiness Katalog' },
  { k:'inquiry', icon:Ic.doc, label:'Inquiry Kelas G', badgeFn: () => window.PROTO_INQ_PENDING() || null },
  { k:'upload-readiness', icon:Ic.upload, label:'Upload Readiness' },
  { k:'upload-master', icon:Ic.cube, label:'Master Class V/G' },
  { k:'karyawan', icon:Ic.user, label:'Karyawan Plant' },
  { k:'akun', icon:Ic.spark, label:'Akun & Password' },
];
const UT_NAV = [
  { k:'ut-inquiry', icon:Ic.doc, label:'Inquiry Masuk', badgeFn: () => window.PROTO_INQ_PENDING() || null },
  { k:'ut-readiness', icon:Ic.cube, label:'Readiness · Semua Site' },
  { k:'ut-history', icon:Ic.ware, label:'Riwayat Respond' },
  { k:'ut-akun', icon:Ic.user, label:'Akun & Password' },
];
const GL_NAV = [
  { k:'gl-inquiry', icon:Ic.doc, label:'Inquiry Tim Saya' },
  { k:'katalog', icon:Ic.cube, label:'Readiness Katalog' },
  { k:'gl-team', icon:Ic.user, label:'Tim Mekanik' },
];

const Sidebar = ({ active, role='admin', nav, onNavigate, footer, site }) => {
  const items = nav || (role==='ut' ? UT_NAV : role==='gl' ? GL_NAV : ADMIN_NAV);
  const T = themeFor(role);
  return (
    <aside style={{ width:240, padding:'24px 16px', borderRight:`1px solid ${A.line}`, background:A.bg, display:'flex', flexDirection:'column', gap:20, flexShrink:0 }}>
      <div style={{ padding:'4px 8px' }}><Logo size={15} org={T.org} onClick={() => onNavigate?.('landing')}/></div>
      {site && (
        <div style={{ padding:'10px 12px', background:T.primarySoft, borderRadius:10, display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:28, height:28, borderRadius:8, background:T.primary, color:T.onPrimary, display:'grid', placeItems:'center', fontSize:10, fontWeight:800, fontFamily:MONO, letterSpacing:0.4 }}>{site}</div>
          <div style={{ minWidth:0, flex:1 }}>
            <div style={{ fontSize:10, color:T.primaryDeep, fontWeight:700, letterSpacing:0.8, textTransform:'uppercase' }}>Site Aktif</div>
            <div style={{ fontSize:12.5, fontWeight:700, color:A.ink, lineHeight:1.2 }}>{role==='ut' ? 'UT · Multi-Site' : 'KPP Mining · '+site}</div>
          </div>
        </div>
      )}
      <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
        {items.map(it => {
          const on = it.k === active;
          const badge = it.badgeFn?.();
          return (
            <div key={it.k} data-proto-link="true" onClick={() => onNavigate?.(it.k)} style={{
              display:'flex', alignItems:'center', gap:12, padding:'10px 12px', borderRadius:10,
              background: on?A.surface:'transparent',
              color: on?A.ink:A.ink2,
              fontWeight: on?600:500, fontSize:13.5,
              boxShadow: on?`0 1px 2px ${A.line}, inset 0 0 0 1px ${A.line}`:'none',
              position:'relative',
            }}>
              <span style={{ color: on?T.primaryDeep:A.ink3, display:'flex' }}><it.icon/></span>
              {it.label}
              {badge ? <span style={{ marginLeft:'auto', background:T.primary, color:T.onPrimary, fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:6 }}>{badge}</span> : null}
            </div>
          );
        })}
      </div>
      {footer || (
        <div style={{ marginTop:'auto', padding:14, background:A.surface, borderRadius:14, border:`1px solid ${A.line}` }}>
          <div style={{ fontSize:11, color:A.ink3, fontWeight:600, letterSpacing:0.8, textTransform:'uppercase', marginBottom:6 }}>Sync Status</div>
          <div style={{ fontSize:13, fontWeight:600, color:A.ink, marginBottom:6 }}>Up to date</div>
          <div style={{ fontSize:11, color:A.ink2 }}>Terakhir upload<br/>21 Mei · 08:30 WIB</div>
          <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:6, fontSize:11, color:A.aman, fontWeight:600 }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:A.aman, boxShadow:`0 0 0 4px ${A.amanBg}` }}/> all 22 rows valid
          </div>
        </div>
      )}
    </aside>
  );
};

// ─── Topbar ────────────────────────────────────────────────────
const Topbar = ({ title, sub, user='Rina · Admin AGMR', onSearch, role='admin' }) => {
  const T = themeFor(role);
  return (
    <div style={{ display:'flex', alignItems:'center', padding:'18px 32px', borderBottom:`1px solid ${A.line}`, gap:20, background:A.bg, flexShrink:0 }}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:11, color:A.ink3, fontWeight:600, letterSpacing:1, textTransform:'uppercase' }}>{sub}</div>
        <div style={{ fontSize:22, fontWeight:700, color:A.ink, letterSpacing:-0.4, marginTop:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{title}</div>
      </div>
      <div data-proto-link={onSearch?'true':undefined} onClick={onSearch} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', background:A.surface, border:`1px solid ${A.line}`, borderRadius:10, width:300, color:A.ink3, fontSize:13 }}>
        <Ic.search/> Cari PN, deskripsi, inquiry…
        <span style={{ marginLeft:'auto', fontSize:10, fontFamily:MONO, padding:'2px 6px', background:A.surfaceAlt, borderRadius:4, color:A.ink2 }}>⌘K</span>
      </div>
      <button style={{ display:'flex', alignItems:'center', justifyContent:'center', width:36, height:36, borderRadius:10, background:A.surface, border:`1px solid ${A.line}`, color:A.ink2, position:'relative' }}>
        <Ic.bell/>
        <span style={{ position:'absolute', top:6, right:6, width:8, height:8, borderRadius:'50%', background:T.primary, border:`2px solid ${A.surface}` }}/>
      </button>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'4px 12px 4px 4px', borderRadius:999, border:`1px solid ${A.line}`, background:A.surface }}>
        <div style={{ width:28, height:28, borderRadius:'50%', background:T.primary, color:T.onPrimary, display:'grid', placeItems:'center', fontWeight:700, fontSize:11 }}>{user[0]}</div>
        <div style={{ fontSize:12.5, fontWeight:600, color:A.ink, lineHeight:1.2 }}>{user.split('·')[0]}<div style={{ fontSize:10, color:A.ink3, fontWeight:500 }}>{user.split('·')[1]?.trim()}</div></div>
      </div>
    </div>
  );
};

// ─── Mobile chrome ─────────────────────────────────────────────
const MobileStatusBar = () => (
  <div style={{ display:'flex', justifyContent:'space-between', padding:'14px 28px 0', fontSize:13, fontWeight:600, color:A.ink, flexShrink:0 }}>
    <span>9:41</span>
    <span style={{ display:'flex', gap:6, alignItems:'center' }}><Ic.signal/><Ic.batt/></span>
  </div>
);

const MobileBottomNav = ({ active='katalog', onNavigate, badge={} }) => {
  const items = [
    { k:'mek-home', i:Ic.home, l:'Beranda' },
    { k:'mek-katalog', i:Ic.cube, l:'Katalog' },
    { k:'mek-inquiry', i:Ic.doc, l:'Inquiry' },
    { k:'mek-profile', i:Ic.user, l:'Profil' },
  ];
  return (
    <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'8px 14px 22px', background:`linear-gradient(180deg, transparent, ${A.bg} 28%, ${A.bg})`, zIndex:5 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', background:A.surface, borderRadius:18, padding:'8px 4px', border:`1px solid ${A.line}`, boxShadow:`0 8px 24px rgba(27,24,20,0.06)` }}>
        {items.map((n,i)=>{
          const on = n.k === active;
          return (
            <div key={i} data-proto-link="true" onClick={()=>onNavigate?.(n.k)} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, padding:'4px', color: on?A.ink:A.ink3, position:'relative' }}>
              <div style={{ padding:'6px 16px', borderRadius:10, background: on?A.honeySoft:'transparent' }}><n.i/></div>
              <div style={{ fontSize:10.5, fontWeight: on?700:500 }}>{n.l}</div>
              {badge[n.k] ? <span style={{ position:'absolute', top:4, right:'30%', background:A.coral, color:'#fff', fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:6 }}>{badge[n.k]}</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Toast / flash messages ────────────────────────────────────
const Toast = ({ msg, kind='ok', onDismiss }) => {
  React.useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => onDismiss?.(), 3200);
    return () => clearTimeout(t);
  }, [msg]);
  if (!msg) return null;
  const colors = {
    ok:    [A.aman, A.amanBg],
    warn:  [A.over, A.overBg],
    err:   [A.warn, A.warnBg],
    info:  [A.indigo, A.indigoSoft],
  }[kind] || [A.ink, A.surface];
  return (
    <div key={msg} className="toast-in" style={{ position:'fixed', top:24, left:'50%', zIndex:200,
      background:A.surface, border:`1px solid ${A.line}`, borderRadius:12, padding:'12px 18px 12px 14px',
      boxShadow:'0 10px 30px rgba(27,24,20,0.18)', display:'flex', alignItems:'center', gap:12,
      maxWidth:520 }}>
      <span style={{ width:8, height:8, borderRadius:'50%', background:colors[0], boxShadow:`0 0 0 4px ${colors[1]}` }}/>
      <div style={{ fontSize:13, fontWeight:600, color:A.ink }}>{msg}</div>
      <button onClick={onDismiss} style={{ marginLeft:8, color:A.ink3, display:'flex' }}><Ic.x/></button>
    </div>
  );
};

// ─── Modal scaffold ────────────────────────────────────────────
const Modal = ({ open, onClose, children, width=520 }) => {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(15,14,12,0.45)', zIndex:150, display:'grid', placeItems:'center', padding:24 }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ background:A.surface, borderRadius:18, width:'100%', maxWidth:width, maxHeight:'90vh', overflow:'auto', boxShadow:'0 30px 60px rgba(0,0,0,0.3)' }}>
        {children}
      </div>
    </div>
  );
};

// Expose
Object.assign(window, {
  PROTO_A: A, PROTO_FONT: FONT, PROTO_MONO: MONO,
  PROTO_themeFor: themeFor,
  PROTO_Ic: Ic, PROTO_Badge: Badge,
  PROTO_StatusBadge: StatusBadge, PROTO_InqBadge: InqBadge,
  PROTO_SiteBadge: SiteBadge,
  PROTO_Gauge: Gauge, PROTO_Logo: Logo,
  PROTO_Sidebar: Sidebar, PROTO_Topbar: Topbar,
  PROTO_MobileStatusBar: MobileStatusBar, PROTO_MobileBottomNav: MobileBottomNav,
  PROTO_Toast: Toast, PROTO_Modal: Modal,
  PROTO_STATUS_STYLE: STATUS_STYLE, PROTO_INQ_STYLE: INQ_STYLE,
});
})();
