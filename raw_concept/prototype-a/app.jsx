// =============================================================
// Prototype A — App router, persona switcher, inquiry store
// Multi-site (AGMR/RANT/SPUT) — no GL approval step.
// =============================================================
(function(){
const { useState, useEffect, useMemo } = React;
const A = window.PROTO_A, FONT = window.PROTO_FONT, MONO = window.PROTO_MONO;
const Ic = window.PROTO_Ic, Toast = window.PROTO_Toast, Logo = window.PROTO_Logo;
const SiteBadge = window.PROTO_SiteBadge, themeFor = window.PROTO_themeFor;

// ─── Inquiry store ────────────────────────────────────────────
const seed = window.UT_INQUIRIES.map(q => ({ ...q }));
let INQUIRIES = [...seed];
let listeners = new Set();
const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach(fn => fn());

window.PROTO_ALL_INQUIRIES = () => INQUIRIES;
window.PROTO_MY_INQUIRIES = (nrp) => INQUIRIES.filter(q => q.nrp === nrp || q.nrp === 'KM19142' /* default demo: Budi */);
window.PROTO_INQ_PENDING = () => INQUIRIES.filter(q => q.status === 'PENDING').length;
window.PROTO_INQ_PENDING_FOR_SITE = (site) => INQUIRIES.filter(q => q.status === 'PENDING' && q.site === site).length;

window.PROTO_ADD_INQUIRY = ({ site, part, pn, qty, unit, notes, urgency, by, nrp, role }) => {
  const n = INQUIRIES.length + 43;
  const id = `INQ-2026-${String(n).padStart(4,'0')}`;
  INQUIRIES = [{
    id, site: site || 'AGMR',
    part, pn: pn || null,
    by: by || 'BUDI SANTOSO', nrp: nrp || 'KM19142', role: role || 'Mekanik',
    qty, unit, notes, urgency,
    date: new Date().toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric'}),
    dateNeeded: new Date(Date.now()+4*86400000).toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric'}),
    status: 'PENDING',
  }, ...INQUIRIES];
  emit();
};
window.PROTO_RESPOND_VALID = (id, utSiteCode, utNote) => {
  INQUIRIES = INQUIRIES.map(q => q.id === id ? {
    ...q, status:'VALID', utSiteCode, utNote: utNote || `Tersedia di ${utSiteCode}.`,
    respondedBy: 'Hendro Susanto', respondedAt: new Date().toLocaleString('id-ID', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }),
  } : q);
  emit();
};
window.PROTO_RESPOND_INVALID = (id, replacementPn, utSiteCode, utNote) => {
  const repl = window.UT_CLASS_MASTER.find(m => m.pn.toLowerCase() === (replacementPn||'').toLowerCase());
  INQUIRIES = INQUIRIES.map(q => q.id === id ? {
    ...q, status:'INVALID',
    replacementPn, replacementDesc: repl?.desc || '—',
    utSiteCode, utNote: utNote || `PN diganti dengan ${replacementPn}.`,
    respondedBy: 'Hendro Susanto', respondedAt: new Date().toLocaleString('id-ID', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }),
  } : q);
  emit();
};

// ─── Hook for store subscription ──────────────────────────────
const useInquiryStore = () => {
  const [, force] = useState(0);
  useEffect(() => subscribe(() => force(n => n+1)), []);
};

// ─── Router state (hash-based) ────────────────────────────────
const parseHash = () => {
  const h = window.location.hash.slice(1);
  if (!h) return { screen:'landing' };
  const [path, qs] = h.split('?');
  const params = Object.fromEntries(new URLSearchParams(qs || ''));
  return { screen: path, ...params };
};
const writeHash = (route) => {
  const { screen, ...rest } = route;
  const qs = new URLSearchParams(rest).toString();
  const newHash = '#' + screen + (qs ? '?' + qs : '');
  if (window.location.hash !== newHash) window.location.hash = newHash;
};

// ─── Persona switcher ─────────────────────────────────────────
const PERSONAS = [
  { k:'admin-AGMR',  label:'Admin AGMR',  initials:'A',  who:'Rina Mahardhika', site:'AGMR', screen:'dashboard',  color:A.green,   role:'admin'   },
  { k:'admin-RANT',  label:'Admin RANT',  initials:'A',  who:'Tono Wijaya',     site:'RANT', screen:'dashboard',  color:A.green,   role:'admin'   },
  { k:'admin-SPUT',  label:'Admin SPUT',  initials:'A',  who:'Sari Pratiwi',    site:'SPUT', screen:'dashboard',  color:A.green,   role:'admin'   },
  { k:'gl-AGMR',     label:'GL AGMR',     initials:'GL', who:'YUSUF FENDY',     site:'AGMR', screen:'gl-inquiry', color:A.greenMid,role:'gl'      },
  { k:'mek-AGMR',    label:'Mekanik AGMR',initials:'M',  who:'BUDI SANTOSO',    site:'AGMR', screen:'mek-home',   color:A.coral,   role:'mekanik', mobile:true },
  { k:'mek-RANT',    label:'Mekanik RANT',initials:'M',  who:'ANDI WIJAYA',     site:'RANT', screen:'mek-home',   color:A.coral,   role:'mekanik', mobile:true },
  { k:'ut',          label:'PIC UT',      initials:'UT', who:'Hendro Susanto',  site:null,   screen:'ut-inquiry', color:A.honey,   role:'ut'      },
];

const PersonaSwitcher = ({ route, navigate }) => {
  const [open, setOpen] = useState(false);
  if (route.screen === 'landing' || route.screen === 'login') return null;

  // Infer current persona from route + site param
  const role = inferRole(route.screen);
  const cur = PERSONAS.find(p => p.role === role && (p.site === route.site || (p.role==='ut' && !route.site))) || PERSONAS[0];

  return (
    <div style={{ position:'fixed', bottom:20, left:20, zIndex:120, fontFamily:FONT }}>
      {open && (
        <div style={{ background:A.surface, border:`1px solid ${A.lineStrong}`, borderRadius:16, padding:8, marginBottom:8, boxShadow:'0 12px 36px rgba(15,14,12,0.18)', minWidth:280, maxHeight:'70vh', overflowY:'auto' }}>
          <div style={{ padding:'10px 12px 8px', fontSize:10, color:A.ink3, fontWeight:700, letterSpacing:1, textTransform:'uppercase' }}>Demo · Pengalih Peran &amp; Site</div>
          {PERSONAS.map(p => {
            const on = p.k === cur.k;
            return (
              <div key={p.k} data-proto-link="true" onClick={() => {
                const patch = { site: p.site || undefined, who: p.who };
                navigate(p.screen, patch);
                setOpen(false);
              }} style={{
                display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:10,
                background: on ? A.surfaceAlt : 'transparent', cursor:'pointer',
              }}>
                <div style={{ width:30, height:30, borderRadius:'50%', background:p.color, color: p.role==='ut'?A.ink:'#fff', display:'grid', placeItems:'center', fontSize:11, fontWeight:800 }}>{p.initials}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12.5, fontWeight:700, color:A.ink }}>{p.label}{p.mobile?' · mobile':''}</div>
                  <div style={{ fontSize:10.5, color:A.ink2 }}>{p.who}</div>
                </div>
                {p.site && <SiteBadge site={p.site}/>}
                {on && <span style={{ marginLeft:6, color:A.aman }}><Ic.check/></span>}
              </div>
            );
          })}
          <div style={{ borderTop:`1px solid ${A.line}`, marginTop:6, paddingTop:6 }}>
            <div data-proto-link="true" onClick={() => { navigate('landing'); setOpen(false); }} style={{ padding:'8px 10px', fontSize:12, color:A.ink2, fontWeight:600, borderRadius:10, display:'flex', alignItems:'center', gap:8 }}>
              <Ic.back/> Ke landing
            </div>
          </div>
        </div>
      )}
      <button data-btn="primary" onClick={() => setOpen(o => !o)} style={{
        display:'flex', alignItems:'center', gap:10, padding:'10px 14px 10px 10px',
        background:A.ink, color:'#fff', borderRadius:999, boxShadow:'0 8px 24px rgba(15,14,12,0.28)',
        fontSize:12, fontWeight:700,
      }}>
        <div style={{ width:28, height:28, borderRadius:'50%', background:cur.color, color: cur.role==='ut'?A.ink:'#fff', display:'grid', placeItems:'center', fontSize:10, fontWeight:800 }}>{cur.initials}</div>
        <span style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', lineHeight:1.15, gap:2 }}>
          <span style={{ fontSize:9, color: cur.role==='ut'?A.honey:A.green, letterSpacing:1, textTransform:'uppercase', fontWeight:800 }}>Demo · view as</span>
          <span>{cur.label} · {cur.who.split(' ')[0]}</span>
        </span>
        <span style={{ marginLeft:6, opacity:0.6, fontSize:13 }}>{open ? '×' : '↕'}</span>
      </button>
    </div>
  );
};

function inferRole(screen) {
  if (screen?.startsWith('mek-')) return 'mekanik';
  if (screen?.startsWith('ut-')) return 'ut';
  if (screen?.startsWith('gl-')) return 'gl';
  return 'admin';
}

const MOBILE_SCREENS = ['mek-home','mek-katalog','mek-detail','mek-submit','mek-inquiry','mek-profile'];

// ─── App ──────────────────────────────────────────────────────
function App() {
  useInquiryStore();
  const [route, setRoute] = useState(parseHash);
  const [flash, setFlash] = useState(null);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => { writeHash(route); }, [route]);
  useEffect(() => { window.scrollTo({ top:0 }); }, [route.screen]);

  const navigate = (screen, patch = {}) => {
    setRoute(prev => {
      // For mekanik & GL & admin screens, keep site sticky
      const next = { screen, ...prev, ...patch };
      delete next.partId; delete next.inquiryId; delete next.prefillPart; delete next.filter;
      Object.assign(next, patch);
      next.screen = screen;
      return next;
    });
  };
  const doFlash = (msg, kind='ok') => setFlash({ msg, kind });

  // Set stage data-frame for mobile screens
  useEffect(() => {
    const stage = document.getElementById('stage');
    if (MOBILE_SCREENS.includes(route.screen)) {
      stage.setAttribute('data-frame', 'phone');
      stage.setAttribute('data-screen-label', `Mekanik · ${route.site || 'AGMR'} · ${route.screen.replace('mek-','')}`);
    } else {
      stage.removeAttribute('data-frame');
      stage.setAttribute('data-screen-label', `${route.screen || 'landing'}${route.site?` · ${route.site}`:''}`);
    }
  }, [route.screen, route.site]);

  const screen = renderScreen(route, navigate, doFlash);

  if (MOBILE_SCREENS.includes(route.screen)) {
    return (
      <>
        <div className="phone-bezel">
          <div className="phone-notch"/>
          <div className="phone-screen">{screen}</div>
        </div>
        <PersonaSwitcher route={route} navigate={navigate}/>
        <Toast msg={flash?.msg} kind={flash?.kind} onDismiss={() => setFlash(null)}/>
        <MobileHint/>
      </>
    );
  }

  return (
    <>
      {screen}
      <PersonaSwitcher route={route} navigate={navigate}/>
      <Toast msg={flash?.msg} kind={flash?.kind} onDismiss={() => setFlash(null)}/>
    </>
  );
}

function renderScreen(route, navigate, flash) {
  const site = route.site || 'AGMR';
  const who = route.who;
  switch (route.screen) {
    case 'landing':         return <window.PROTO_Landing navigate={navigate}/>;
    case 'login':           return <window.PROTO_Login navigate={navigate} hint={route.hint}/>;
    // ── Admin Site ──
    case 'dashboard':       return <window.PROTO_AdminDashboard navigate={navigate} role="admin" site={site} who={who}/>;
    case 'katalog':         return <window.PROTO_Katalog navigate={navigate} role={inferRole(route.from || 'admin')} site={site} who={who} filter={route.filter || 'all'}/>;
    case 'part':            return <window.PROTO_PartDetail navigate={navigate} role="admin" site={site} who={who} partId={route.partId}/>;
    case 'upload-readiness':return <window.PROTO_UploadReadiness navigate={navigate} role="admin" site={site} who={who} flash={flash}/>;
    case 'upload-master':   return <window.PROTO_UploadMaster navigate={navigate} role="admin" site={site} who={who} flash={flash}/>;
    case 'karyawan':        return <window.PROTO_Karyawan navigate={navigate} role="admin" site={site} who={who} flash={flash}/>;
    case 'akun':            return <window.PROTO_AdminAkun navigate={navigate} role="admin" site={site} who={who}/>;
    case 'inquiry':         return <window.PROTO_InquiryList navigate={navigate} role="admin" site={site} who={who}/>;
    // ── GL ──
    case 'gl-inquiry':      return <window.PROTO_GLInquiry navigate={navigate} site={site} who={who}/>;
    case 'gl-team':         return <PlaceholderScreen role="gl" site={site} navigate={navigate} title="Tim Mekanik" sub="Roster & performance · coming soon"/>;
    // ── UT ──
    case 'ut-inquiry':      return <window.PROTO_UTInquiry navigate={navigate} flash={flash} who={who}/>;
    case 'ut-readiness':    return <window.PROTO_UTReadiness navigate={navigate} who={who}/>;
    case 'ut-history':      return <PlaceholderScreen role="ut" navigate={navigate} title="Riwayat Respond" sub="Semua respond yang sudah dikirim · coming soon"/>;
    case 'ut-akun':         return <window.PROTO_AdminAkun navigate={navigate} role="ut" who={who}/>;
    // ── Mekanik ──
    case 'mek-home':        return <window.PROTO_MekHome navigate={navigate} site={site} who={who}/>;
    case 'mek-katalog':     return <window.PROTO_MekKatalog navigate={navigate} site={site} who={who}/>;
    case 'mek-detail':      return <window.PROTO_MekDetail navigate={navigate} site={site} who={who} partId={route.partId}/>;
    case 'mek-submit':      return <window.PROTO_MekSubmit navigate={navigate} site={site} who={who} flash={flash} prefillPart={route.prefillPart}/>;
    case 'mek-inquiry':     return <window.PROTO_MekInquiry navigate={navigate} site={site} who={who} inquiryId={route.inquiryId}/>;
    case 'mek-profile':     return <window.PROTO_MekProfile navigate={navigate} site={site} who={who}/>;
    default:                return <window.PROTO_Landing navigate={navigate}/>;
  }
}

const PlaceholderScreen = ({ role, navigate, title, sub, site }) => {
  const Sidebar = window.PROTO_Sidebar, Topbar = window.PROTO_Topbar;
  const T = themeFor(role);
  return (
    <div className="screen-fade" style={{ minHeight:'100vh', fontFamily:FONT, background:A.bg, color:A.ink, display:'flex' }}>
      <Sidebar role={role} active={title.toLowerCase().split(' ')[0]} onNavigate={navigate} site={site}/>
      <main style={{ flex:1, display:'flex', flexDirection:'column' }}>
        <Topbar role={role} sub={role.toUpperCase()} title={title}/>
        <div style={{ flex:1, display:'grid', placeItems:'center', padding:48 }}>
          <div style={{ textAlign:'center', maxWidth:480 }}>
            <div style={{ width:96, height:96, borderRadius:'50%', background:T.primarySoft, color:T.primaryDeep, display:'grid', placeItems:'center', margin:'0 auto 18px' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v6l3 2"/></svg>
            </div>
            <div style={{ fontSize:11, color:T.primaryDeep, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', marginBottom:8 }}>Belum di scope v2.0</div>
            <div style={{ fontSize:28, fontWeight:700, color:A.ink, letterSpacing:-0.6, marginBottom:8 }}>{title}</div>
            <div style={{ fontSize:14, color:A.ink2, lineHeight:1.6, marginBottom:24 }}>{sub}. Fokus alur sudah ada di tab lain — pilih dari sidebar atau pengalih peran di pojok kiri-bawah.</div>
            <button data-btn="primary" data-proto-link="true" onClick={() => navigate(role==='admin'?'dashboard':role==='gl'?'gl-inquiry':'ut-inquiry')} style={{ padding:'12px 22px', borderRadius:10, background:A.ink, color:'#fff', fontSize:13, fontWeight:800, display:'inline-flex', alignItems:'center', gap:8 }}>
              <Ic.back/> Kembali ke home {role.toUpperCase()}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

const MobileHint = () => {
  const [show, setShow] = useState(() => !localStorage.getItem('proto_a_mobile_hint_v2'));
  if (!show) return null;
  return (
    <div style={{ position:'fixed', top:24, right:24, zIndex:130, background:A.surface, border:`1px solid ${A.lineStrong}`, borderRadius:14, padding:'14px 16px', maxWidth:280, boxShadow:'0 10px 30px rgba(0,0,0,0.25)', fontFamily:FONT }}>
      <div style={{ fontSize:10, color:A.green, fontWeight:700, letterSpacing:1, textTransform:'uppercase', marginBottom:4 }}>Tampilan mekanik</div>
      <div style={{ fontSize:13, color:A.ink, fontWeight:600, lineHeight:1.4, marginBottom:8 }}>Aplikasi mekanik di-render dalam frame ponsel — login via NRP saja, dipakai di lapangan.</div>
      <button onClick={() => { localStorage.setItem('proto_a_mobile_hint_v2','1'); setShow(false); }} style={{ fontSize:11, color:A.ink2, fontWeight:700 }}>Mengerti ✓</button>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('stage')).render(<App/>);
})();
