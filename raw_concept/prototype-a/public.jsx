// =============================================================
// Prototype A — Public screens (Landing, Login)
// Login: NRP-only for Plant (Mekanik/GL), email+password for
//        Admin Site & PIC UT — plus change password modal.
// =============================================================
(function(){
const A = window.PROTO_A, FONT = window.PROTO_FONT, MONO = window.PROTO_MONO;
const Ic = window.PROTO_Ic, Logo = window.PROTO_Logo;
const SiteBadge = window.PROTO_SiteBadge, themeFor = window.PROTO_themeFor;
const H = window.UT_HELPERS;
const SITES = window.UT_SITES;

// ─── Landing ───────────────────────────────────────────────────
const Landing = ({ navigate }) => {
  // Aggregate readiness across 3 sites
  const summaries = SITES.map(s => ({ site:s.code, ...H.summary(window.UT_READINESS[s.code]) }));
  const totalParts = summaries.reduce((a,b) => a + b.total, 0);
  const totalWarning = summaries.reduce((a,b) => a + b.WARNING, 0);
  const avgMin = Math.round(summaries.reduce((a,b) => a + b.min_pct, 0) / summaries.length);
  const classG = window.UT_CLASS_MASTER_META.fullCountG;

  return (
    <div className="screen-fade" style={{ minHeight:'100vh', fontFamily:FONT, background:A.bg, color:A.ink, position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:-200, right:-200, width:700, height:700, borderRadius:'50%',
        background:`radial-gradient(circle, ${A.honeySoft} 0%, transparent 60%)`, pointerEvents:'none' }}/>
      <div style={{ position:'absolute', top:200, left:-200, width:500, height:500, borderRadius:'50%',
        background:`radial-gradient(circle, ${A.greenSoft} 0%, transparent 60%)`, pointerEvents:'none' }}/>

      <div style={{ maxWidth:1280, margin:'0 auto', position:'relative' }}>
        {/* Nav */}
        <nav style={{ display:'flex', alignItems:'center', padding:'24px 48px', gap:32, flexWrap:'wrap' }}>
          <Logo size={16} org="KPP"/>
          <div style={{ display:'flex', gap:24, fontSize:14, color:A.ink2, fontWeight:500, marginLeft:24 }}>
            <span>Produk</span><span>Alur kerja</span><span>Untuk siapa</span><span>Dokumentasi</span>
          </div>
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:12 }}>
            <span data-proto-link="true" onClick={() => navigate('login')} style={{ fontSize:13, color:A.ink2, fontWeight:600 }}>Masuk</span>
            <button data-btn="primary" data-proto-link="true" onClick={() => navigate('login')} style={{ padding:'10px 18px', borderRadius:10, background:A.ink, color:'#fff', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', gap:8 }}>
              Hubungi tim KPP <Ic.arrow/>
            </button>
          </div>
        </nav>

        {/* Hero */}
        <section style={{ padding:'48px 48px 0' }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'6px 12px 6px 6px', background:A.surface, border:`1px solid ${A.line}`, borderRadius:999, fontSize:12, color:A.ink2, fontWeight:500 }}>
            <span style={{ padding:'3px 8px', borderRadius:999, background:A.green, color:'#fff', fontSize:10.5, fontWeight:700, letterSpacing:0.4 }}>v2.0 · 3 site KPP</span>
            Vendor Held Stock realtime — <b style={{ color:A.green }}>KPP Mining</b> × <b style={{ color:A.honeyDeep }}>United Tractors</b>
          </div>
          <h1 style={{ fontSize:'clamp(48px, 7vw, 80px)', fontWeight:800, letterSpacing:-3, lineHeight:0.98, margin:'28px 0 24px', maxWidth:980, textWrap:'pretty' }}>
            Stok part <span style={{ background:`linear-gradient(120deg, ${A.green}, ${A.greenMid})`, WebkitBackgroundClip:'text', color:'transparent' }}>3 site KPP,</span><br/>
            satu pintu ke <span style={{ background:`linear-gradient(120deg, ${A.honey}, ${A.honeyDeep})`, WebkitBackgroundClip:'text', color:'transparent' }}>UT.</span>
          </h1>
          <p style={{ fontSize:19, color:A.ink2, maxWidth:680, lineHeight:1.5, marginBottom:36 }}>
            Site <b>AGMR · RANT · SPUT</b> upload readiness harian masing-masing. UT Rantau lihat semua dalam satu dashboard, respond inquiry Kelas G dengan PN pengganti dan kode warehouse UT.
          </p>
          <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
            <button data-btn="primary" data-proto-link="true" onClick={() => navigate('login')} style={{ padding:'14px 22px', borderRadius:12, background:A.ink, color:'#fff', fontSize:14, fontWeight:700, display:'flex', alignItems:'center', gap:10 }}>
              Masuk ke sistem <Ic.arrow/>
            </button>
            <button data-btn="ghost" style={{ padding:'14px 22px', borderRadius:12, background:'transparent', border:`1px solid ${A.lineStrong}`, color:A.ink, fontSize:14, fontWeight:600 }}>
              Lihat tour produk · 3 min
            </button>
            <div style={{ marginLeft:16, fontSize:12, color:A.ink2 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}><span style={{ width:6, height:6, borderRadius:'50%', background:A.aman }}/> 3 admin site aktif · sinkron tiap upload</div>
            </div>
          </div>

          <div data-stagger="true" style={{ marginTop:64, display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:1, background:A.line, border:`1px solid ${A.line}`, borderRadius:18, overflow:'hidden' }}>
            {[
              ['Site KPP terlayani', '3', 'AGMR · RANT · SPUT', A.green],
              ['Total readiness', totalParts, 'baris Kelas V tersinkron', A.green],
              ['Master Class G', classG.toLocaleString('id-ID'), 'part inquiry-able', A.honey],
              ['Warning aktif', totalWarning, 'di 3 site · butuh review', A.warn],
            ].map(([l,v,sub,c],i)=>(
              <div key={i} data-reveal="true" style={{ background:A.bg, padding:'24px', position:'relative' }}>
                <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:c }}/>
                <div style={{ fontSize:11, color:A.ink3, fontWeight:600, letterSpacing:0.8, textTransform:'uppercase' }}>{l}</div>
                <div style={{ fontSize:42, fontWeight:700, letterSpacing:-1.5, color:A.ink, marginTop:6, fontFeatureSettings:'"tnum"' }}>{v}</div>
                <div style={{ fontSize:12, color:A.ink2, marginTop:2 }}>{sub}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Site grid */}
        <section data-reveal="true" style={{ padding:'80px 48px 0' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:24, flexWrap:'wrap', gap:16 }}>
            <div>
              <div style={{ fontSize:11, color:A.green, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase' }}>Sites · KPP Mining</div>
              <h2 style={{ fontSize:44, fontWeight:700, letterSpacing:-1.2, margin:'4px 0 0', maxWidth:680 }}>Tiap site punya admin sendiri.</h2>
            </div>
            <div style={{ fontSize:13, color:A.ink2, maxWidth:340 }}>
              Admin AGMR cuma lihat AGMR. UT Rantau lihat semuanya — bisa filter per-site atau konsolidasi.
            </div>
          </div>
          <div data-stagger="true" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
            {summaries.map((s,i)=>{
              const site = SITES.find(x => x.code === s.site);
              return (
                <div key={s.site} data-reveal="true" style={{ background:A.surface, borderRadius:18, padding:24, border:`1px solid ${A.line}`, position:'relative', overflow:'hidden' }}>
                  <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:A.green }}/>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
                    <SiteBadge site={s.site}/>
                    <span style={{ fontSize:11, color:A.ink3, fontFamily:MONO }}>UT WH · {site.utWh.join(' + ')}</span>
                  </div>
                  <div style={{ fontSize:22, fontWeight:800, color:A.ink, letterSpacing:-0.5, lineHeight:1.15 }}>{site.name}</div>
                  <div style={{ fontSize:12, color:A.ink2, marginTop:4 }}>{site.region}</div>
                  <div style={{ marginTop:18, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                    {[['Total', s.total, A.ink],['Aman', s.AMAN, A.aman],['Warning', s.WARNING, A.warn]].map(([l,v,c],j)=>(
                      <div key={j} style={{ padding:'10px 12px', background:A.bg, borderRadius:10 }}>
                        <div style={{ fontSize:10, color:A.ink3, fontWeight:700, letterSpacing:0.6 }}>{l}</div>
                        <div style={{ fontSize:24, fontWeight:700, color:c, fontFamily:MONO, marginTop:2, lineHeight:1, fontFeatureSettings:'"tnum"' }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop:14, paddingTop:14, borderTop:`1px solid ${A.line}` }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:A.ink2, marginBottom:6 }}>
                      <span>Readyness MIN</span>
                      <span style={{ fontWeight:700, color:A.ink, fontFamily:MONO }}>{s.min_pct}%</span>
                    </div>
                    <div style={{ height:6, background:A.surfaceAlt, borderRadius:3, overflow:'hidden' }}>
                      <div style={{ width:s.min_pct+'%', height:'100%', background:`linear-gradient(90deg, ${A.green}, ${A.greenMid})` }}/>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Roles · 4 steps */}
        <section data-reveal="true" style={{ padding:'80px 48px 0' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:24, flexWrap:'wrap', gap:16 }}>
            <div>
              <div style={{ fontSize:11, color:A.honeyDeep, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase' }}>Cara kerja</div>
              <h2 style={{ fontSize:44, fontWeight:700, letterSpacing:-1.2, margin:'4px 0 0', maxWidth:680 }}>Empat peran. Tanpa step approval yang menggantung.</h2>
            </div>
            <div style={{ fontSize:13, color:A.ink2, maxWidth:340 }}>
              Mekanik & GL inquiry langsung masuk ke UT — UT respond <b>valid</b> (isi kode warehouse) atau <b>invalid</b> (PN pengganti + kode warehouse).
            </div>
          </div>

          <div data-stagger="true" style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:16 }}>
            {[
              { step:'01', who:'Admin Site',     what:'Upload readiness harian', detail:'Per site sendiri — kolom PN, MIN, MAX, RTT, TBD, estimasi (in-transit). Tanpa kolom AGMR/RANT/SPUT.', color:A.green, role:'admin' },
              { step:'02', who:'Mekanik / GL',   what:'Cek readiness · Inquiry Kelas G', detail:'Dropdown hybrid: search + filter kategori. Hanya part Class G yang bisa di-inquiry (~9.356).', color:A.greenMid, role:'mekanik' },
              { step:'03', who:'PIC UT Rantau',  what:'Respond valid / invalid', detail:'Valid → isi kode warehouse UT (RTT/SMR/BTL/TBD). Invalid → isi PN pengganti + kode warehouse.', color:A.honey, role:'ut' },
              { step:'04', who:'Semua peran',    what:'Lihat readiness terupdate', detail:'Hasil respond UT tampil di mekanik & GL. UT bisa toggle view all-sites / per-site.', color:A.ink, role:'mekanik' },
            ].map((s,i)=>(
              <div key={i} data-reveal="true" data-proto-link="true" onClick={() => navigate('login', { hint: s.role })} style={{ background:A.surface, borderRadius:18, padding:24, border:`1px solid ${A.line}`, position:'relative' }}>
                <div style={{ fontSize:11, fontWeight:700, color:s.color, letterSpacing:1, fontFamily:MONO }}>STEP · {s.step}</div>
                <div style={{ fontSize:13, color:A.ink2, marginTop:18, marginBottom:6, fontWeight:500 }}>{s.who}</div>
                <div style={{ fontSize:18, fontWeight:700, color:A.ink, letterSpacing:-0.3, lineHeight:1.2, marginBottom:10 }}>{s.what}</div>
                <div style={{ fontSize:13, color:A.ink2, lineHeight:1.5 }}>{s.detail}</div>
                <div style={{ position:'absolute', top:24, right:24, width:36, height:36, borderRadius:10, background:A.bg, color:s.color, display:'grid', placeItems:'center' }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:s.color }}/>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Dual brand split panel */}
        <section data-reveal="true" style={{ padding:'80px 48px 0' }}>
          <div style={{ background:A.ink, borderRadius:24, padding:'48px', position:'relative', overflow:'hidden', minHeight:380 }}>
            <div style={{ position:'absolute', top:-100, left:-100, width:400, height:400, borderRadius:'50%', background:`radial-gradient(circle, ${A.green}44 0%, transparent 60%)` }}/>
            <div style={{ position:'absolute', bottom:-100, right:-100, width:400, height:400, borderRadius:'50%', background:`radial-gradient(circle, ${A.honey}33 0%, transparent 60%)` }}/>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:48, position:'relative' }}>
              <div>
                <div style={{ fontSize:11, color:A.green, fontWeight:700, letterSpacing:1.4, textTransform:'uppercase' }}>KPP Mining · sisi kami</div>
                <h3 style={{ fontSize:34, fontWeight:700, color:'#fff', letterSpacing:-0.8, margin:'8px 0 14px', lineHeight:1.1 }}>Admin AGMR · RANT · SPUT punya dashboard masing-masing.</h3>
                <p style={{ color:'rgba(255,255,255,0.65)', fontSize:14, lineHeight:1.6, marginBottom:24 }}>
                  Upload readiness harian site sendiri. GL & Mekanik di-bulk-upload pakai NRP — login passwordless seperti clock-in card.
                </p>
                <button data-btn="primary" data-proto-link="true" onClick={() => navigate('login', { hint:'admin' })} style={{ padding:'12px 18px', borderRadius:10, background:A.green, color:'#fff', fontSize:13, fontWeight:800 }}>Masuk sebagai Admin KPP</button>
              </div>
              <div>
                <div style={{ fontSize:11, color:A.honey, fontWeight:700, letterSpacing:1.4, textTransform:'uppercase' }}>United Tractors · sisi mereka</div>
                <h3 style={{ fontSize:34, fontWeight:700, color:'#fff', letterSpacing:-0.8, margin:'8px 0 14px', lineHeight:1.1 }}>PIC UT Rantau respond 3 site dari 1 inbox.</h3>
                <p style={{ color:'rgba(255,255,255,0.65)', fontSize:14, lineHeight:1.6, marginBottom:24 }}>
                  Inquiry Class G masuk dengan tag site. Respond: valid + kode warehouse UT, atau invalid + PN pengganti + kode warehouse UT.
                </p>
                <button data-btn="primary" data-proto-link="true" onClick={() => navigate('login', { hint:'ut' })} style={{ padding:'12px 18px', borderRadius:10, background:A.honey, color:A.ink, fontSize:13, fontWeight:800 }}>Masuk sebagai PIC UT</button>
              </div>
            </div>
          </div>
        </section>

        <footer data-reveal="true" style={{ padding:'80px 48px 32px', display:'flex', justifyContent:'space-between', alignItems:'flex-end', flexWrap:'wrap', gap:24 }}>
          <div>
            <Logo size={14} org="KPP"/>
            <div style={{ fontSize:12, color:A.ink3, marginTop:18, maxWidth:300, lineHeight:1.5 }}>
              Sistem internal KPP Mining untuk monitoring Vendor Held Stock dari United Tractors. v2.0 · multi-site (AGMR · RANT · SPUT).
            </div>
          </div>
          <div style={{ display:'flex', gap:48, fontSize:12, color:A.ink2 }}>
            <div><div style={{ fontWeight:700, color:A.ink, marginBottom:8 }}>Produk</div>Readiness · Inquiry · Upload · Dashboard</div>
            <div><div style={{ fontWeight:700, color:A.ink, marginBottom:8 }}>Login</div>NRP (plant) · email+pwd (admin/UT)</div>
            <div><div style={{ fontWeight:700, color:A.ink, marginBottom:8 }}>Sites</div>AGMR · RANT · SPUT</div>
          </div>
        </footer>
      </div>
    </div>
  );
};

// ─── Login ─────────────────────────────────────────────────────
// Hint maps to a track:
//   'mekanik' / 'gl'   → Plant NRP track
//   'admin'            → Admin Site (email+pwd)
//   'ut'               → PIC UT (email+pwd)
const TRACKS = [
  { k:'plant', label:'Mekanik / GL', sub:'Plant KPP — login pakai NRP',  color:A.green },
  { k:'admin', label:'Admin Site',   sub:'AGMR · RANT · SPUT — email + password', color:A.greenMid },
  { k:'ut',    label:'PIC UT Rantau',sub:'United Tractors — email + password',    color:A.honey },
];

const Login = ({ navigate, hint }) => {
  const initTrack = hint === 'ut' ? 'ut' : hint === 'admin' ? 'admin' : 'plant';
  const [track, setTrack] = React.useState(initTrack);
  const [nrp, setNrp] = React.useState('KM19142');         // Budi
  const [email, setEmail] = React.useState(initTrack==='ut' ? 'hendro.pic@unitedtractors.com' : 'rina.adm@kpp.co.id');
  const [pwd, setPwd] = React.useState('demo1234');
  const [showPwd, setShowPwd] = React.useState(false);
  const [showChange, setShowChange] = React.useState(false);

  // Match NRP to employee
  const emp = window.UT_EMPLOYEES.find(e => e.nrp.toLowerCase() === nrp.toLowerCase());
  const acc = window.UT_ACCOUNTS.find(a => a.email.toLowerCase() === email.toLowerCase());

  const T = track === 'ut' ? themeFor('ut') : themeFor('admin');

  const submit = () => {
    if (track === 'plant') {
      if (!emp) return;
      if (emp.role === 'GL') navigate('gl-inquiry', { site: emp.site, who: emp.name });
      else navigate('mek-home', { site: emp.site, who: emp.name });
    } else if (track === 'admin') {
      if (!acc || acc.role !== 'Admin Site') return;
      navigate('dashboard', { site: acc.site, who: acc.name });
    } else {
      if (!acc || acc.role !== 'PIC UT') return;
      navigate('ut-inquiry', { who: acc.name });
    }
  };

  return (
    <div className="screen-fade" style={{ minHeight:'100vh', fontFamily:FONT, background:A.bg, color:A.ink, display:'grid', gridTemplateColumns:'1fr 1fr', position:'relative' }}>
      {/* Left — context / brand */}
      <div style={{ padding:'48px 56px', background:A.ink, color:'#fff', position:'relative', overflow:'hidden', display:'flex', flexDirection:'column' }}>
        <div style={{ position:'absolute', top:-200, right:-200, width:600, height:600, borderRadius:'50%', background:`radial-gradient(circle, ${T.primary}22 0%, transparent 60%)` }}/>
        <div data-proto-link="true" onClick={() => navigate('landing')} style={{ position:'relative' }}><Logo size={16} dark org={T.org}/></div>
        <div style={{ marginTop:'auto', position:'relative' }}>
          <div style={{ fontSize:11, color:T.primary, fontWeight:700, letterSpacing:1.4, textTransform:'uppercase', marginBottom:14 }}>{T.orgLabel} · masuk</div>
          <div style={{ fontSize:42, fontWeight:700, letterSpacing:-1.2, lineHeight:1.05, marginBottom:18, maxWidth:520 }}>
            {track === 'plant' ? <>NRP saja.<br/>Sisanya kami yang urus.</> :
             track === 'ut'    ? <>Email + password,<br/>dengan ganti password kapan saja.</> :
             <>Akun admin dibuat<br/>oleh Super Admin KPP.</>}
          </div>
          <p style={{ fontSize:14, color:'rgba(255,255,255,0.65)', lineHeight:1.6, maxWidth:440, marginBottom:24 }}>
            {track === 'plant'
              ? 'Mekanik & GL diupload massal via Excel oleh admin site. Login tinggal ketik NRP — tanpa password, mirip kartu absen. Bisa hanya melihat data dari site sendiri.'
              : track === 'ut'
              ? 'PIC UT Rantau punya 1 akun untuk semua site KPP. Bisa filter inbox per AGMR/RANT/SPUT atau lihat konsolidasi.'
              : 'Admin Site dibuat oleh Super Admin KPP. Setiap admin terkait 1 site (AGMR, RANT, atau SPUT) — tidak bisa lihat data site lain.'}
          </p>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, fontSize:11, color:'rgba(255,255,255,0.55)' }}>
            <span style={{ padding:'4px 10px', background:'rgba(255,255,255,0.08)', borderRadius:6 }}>3 site KPP</span>
            <span style={{ padding:'4px 10px', background:'rgba(255,255,255,0.08)', borderRadius:6 }}>1 PIC UT</span>
            <span style={{ padding:'4px 10px', background:'rgba(255,255,255,0.08)', borderRadius:6 }}>Bulk upload Excel</span>
          </div>
        </div>
      </div>

      {/* Right — form */}
      <div style={{ padding:'48px 56px', display:'flex', flexDirection:'column', justifyContent:'center', maxWidth:680 }}>
        <div style={{ fontSize:11, color:T.primaryDeep, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', marginBottom:8 }}>Login · pilih jenis akun</div>
        <h2 style={{ fontSize:34, fontWeight:700, letterSpacing:-1, margin:'0 0 24px' }}>Masuk sebagai…</h2>

        {/* Track switcher */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, padding:4, background:A.surfaceAlt, borderRadius:14, marginBottom:24 }}>
          {TRACKS.map(t => {
            const on = track === t.k;
            return (
              <button key={t.k} onClick={() => setTrack(t.k)} style={{
                padding:'10px 8px', borderRadius:10, fontSize:12.5, fontWeight:700,
                background: on?A.surface:'transparent',
                color: on?A.ink:A.ink2,
                boxShadow: on?`0 2px 6px rgba(27,24,20,0.08)`:'none',
                display:'flex', flexDirection:'column', alignItems:'center', gap:2,
              }}>
                {t.label}
                <span style={{ fontSize:10, fontWeight:500, color: on?A.ink2:A.ink3, lineHeight:1.2 }}>{t.sub}</span>
              </button>
            );
          })}
        </div>

        {/* Form per track */}
        {track === 'plant' ? (
          <>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, color:A.ink3, fontWeight:700, letterSpacing:0.6, textTransform:'uppercase', marginBottom:6 }}>NRP Karyawan *</div>
              <input value={nrp} onChange={e=>setNrp(e.target.value)} placeholder="contoh: KM19142" style={{ width:'100%', padding:'16px 18px', borderRadius:12, border:`1.5px solid ${emp?T.primary:A.lineStrong}`, background:A.surface, fontSize:18, color:A.ink, outline:'none', fontFamily:MONO, fontWeight:700, letterSpacing:1 }}/>
              <div style={{ fontSize:11, color:A.ink3, marginTop:6, display:'flex', justifyContent:'space-between' }}>
                <span>Cek kartu karyawan kamu. Demo: <b style={{ color:A.ink, fontFamily:MONO }}>KM19142</b> · <b style={{ color:A.ink, fontFamily:MONO }}>KB13269</b> · <b style={{ color:A.ink, fontFamily:MONO }}>KR20188</b></span>
              </div>
            </div>
            {emp ? (
              <div style={{ padding:'14px 16px', background:A.greenSoft, borderRadius:12, marginBottom:18, display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ width:42, height:42, borderRadius:'50%', background:A.green, color:'#fff', display:'grid', placeItems:'center', fontWeight:800, fontSize:14 }}>{emp.name.split(' ').map(w=>w[0]).slice(0,2).join('')}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:800, color:A.ink }}>{emp.name}</div>
                  <div style={{ fontSize:11.5, color:A.ink2 }}>{emp.role} · Site {emp.site} · Shift {emp.shift}</div>
                </div>
                <SiteBadge site={emp.site}/>
              </div>
            ) : (
              <div style={{ padding:'12px 14px', background:A.warnBg, borderRadius:12, marginBottom:18, fontSize:12, color:A.warn, fontWeight:600 }}>
                NRP tidak ditemukan. Hubungi admin site untuk bulk-upload data karyawan.
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, color:A.ink3, fontWeight:700, letterSpacing:0.6, textTransform:'uppercase', marginBottom:6 }}>Email kantor *</div>
              <input value={email} onChange={e=>setEmail(e.target.value)} placeholder={track==='ut' ? 'pic@unitedtractors.com' : 'admin@kpp.co.id'} style={{ width:'100%', padding:'14px 16px', borderRadius:12, border:`1.5px solid ${acc?T.primary:A.lineStrong}`, background:A.surface, fontSize:14, color:A.ink, outline:'none' }}/>
            </div>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, color:A.ink3, fontWeight:700, letterSpacing:0.6, textTransform:'uppercase', marginBottom:6, display:'flex', justifyContent:'space-between' }}>
                <span>Password *</span>
                <span data-proto-link="true" onClick={() => setShowChange(true)} style={{ fontSize:11, color:T.primaryDeep, fontWeight:700, textTransform:'none', letterSpacing:0, cursor:'pointer' }}>Ubah password →</span>
              </div>
              <div style={{ position:'relative' }}>
                <input value={pwd} onChange={e=>setPwd(e.target.value)} type={showPwd?'text':'password'} style={{ width:'100%', padding:'14px 50px 14px 16px', borderRadius:12, border:`1.5px solid ${A.lineStrong}`, background:A.surface, fontSize:14, color:A.ink, outline:'none', fontFamily:MONO }}/>
                <button onClick={() => setShowPwd(s=>!s)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', padding:'6px 10px', background:A.surfaceAlt, color:A.ink2, fontSize:11, fontWeight:600, borderRadius:6 }}>{showPwd?'sembunyi':'lihat'}</button>
              </div>
              <div style={{ fontSize:11, color:A.ink3, marginTop:6 }}>
                Demo: <b style={{ color:A.ink, fontFamily:MONO }}>{track==='ut' ? 'hendro.pic@unitedtractors.com' : 'rina.adm@kpp.co.id'}</b> · pwd: <b style={{ color:A.ink, fontFamily:MONO }}>demo1234</b>
              </div>
            </div>
            {acc && (
              <div style={{ padding:'14px 16px', background: track==='ut'?A.honeySoft:A.greenSoft, borderRadius:12, marginBottom:18, display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ width:42, height:42, borderRadius:'50%', background:T.primary, color:T.onPrimary, display:'grid', placeItems:'center', fontWeight:800, fontSize:14 }}>{acc.name.split(' ').map(w=>w[0]).slice(0,2).join('')}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:800, color:A.ink }}>{acc.name}</div>
                  <div style={{ fontSize:11.5, color:A.ink2 }}>{acc.role} · {acc.site === 'ALL' ? 'Semua site KPP' : 'Site ' + acc.site}</div>
                </div>
                {acc.site !== 'ALL' && <SiteBadge site={acc.site}/>}
              </div>
            )}
          </>
        )}

        <button data-btn="confirm" data-proto-link={(track==='plant'?!!emp:!!acc)?'true':undefined} onClick={submit} disabled={!(track==='plant'?!!emp:!!acc)} style={{
          width:'100%', padding:'16px', borderRadius:12, background: (track==='plant'?!!emp:!!acc) ? T.primary : A.surfaceAlt,
          color: (track==='plant'?!!emp:!!acc) ? T.onPrimary : A.ink3,
          fontSize:14, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', gap:10,
          cursor: (track==='plant'?!!emp:!!acc) ? 'pointer' : 'not-allowed',
        }}>
          {track==='plant' ? `Masuk sebagai ${emp?.name?.split(' ')[0] || 'karyawan'}` :
           track==='ut'    ? 'Masuk · PIC UT Rantau' :
                              'Masuk · Admin Site'} <Ic.arrow/>
        </button>

        <div style={{ marginTop:18, fontSize:12, color:A.ink3, lineHeight:1.6, textAlign:'center' }}>
          <div data-proto-link="true" onClick={() => navigate('landing')} style={{ fontWeight:700, color:A.ink }}>← kembali ke landing</div>
        </div>
      </div>

      {showChange && <ChangePasswordModal onClose={() => setShowChange(false)} email={email} theme={T}/>}
    </div>
  );
};

// ─── Change password modal ─────────────────────────────────────
const ChangePasswordModal = ({ onClose, email, theme }) => {
  const T = theme;
  const [oldP, setOldP] = React.useState('');
  const [newP, setNewP] = React.useState('');
  const [conf, setConf] = React.useState('');
  const [show, setShow] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const score = (p) => {
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^a-zA-Z0-9]/.test(p)) s++;
    return s;
  };
  const sc = score(newP);
  const ok = oldP && newP.length >= 8 && newP === conf;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(15,14,12,0.45)', zIndex:150, display:'grid', placeItems:'center', padding:24, backdropFilter:'blur(2px)' }}>
      <div className="modal-content" onClick={e=>e.stopPropagation()} style={{ background:A.surface, borderRadius:18, width:'100%', maxWidth:480, padding:28, boxShadow:'0 30px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:18 }}>
          <div>
            <div style={{ fontSize:11, color:T.primaryDeep, fontWeight:700, letterSpacing:1, textTransform:'uppercase' }}>Keamanan akun</div>
            <div style={{ fontSize:22, fontWeight:700, color:A.ink, letterSpacing:-0.4, marginTop:4 }}>Ubah password</div>
            <div style={{ fontSize:12, color:A.ink2, marginTop:4 }}>Untuk {email}</div>
          </div>
          <button onClick={onClose} style={{ color:A.ink3 }}><Ic.x/></button>
        </div>

        {done ? (
          <>
            <div style={{ padding:'20px 18px', background:A.amanBg, borderRadius:12, marginBottom:18, display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ width:38, height:38, borderRadius:'50%', background:A.aman, color:'#fff', display:'grid', placeItems:'center' }}><Ic.check/></div>
              <div>
                <div style={{ fontSize:13, fontWeight:800, color:A.aman }}>Password berhasil diubah</div>
                <div style={{ fontSize:11.5, color:A.ink2 }}>Login ulang dengan password baru.</div>
              </div>
            </div>
            <button data-btn="primary" onClick={onClose} style={{ width:'100%', padding:'13px', borderRadius:10, background:A.ink, color:'#fff', fontSize:13, fontWeight:700 }}>Tutup</button>
          </>
        ) : (
          <>
            {[
              ['Password lama', oldP, setOldP],
              ['Password baru', newP, setNewP],
              ['Konfirmasi password baru', conf, setConf],
            ].map(([l,v,set],i)=>(
              <div key={i} style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, color:A.ink3, fontWeight:700, letterSpacing:0.6, textTransform:'uppercase', marginBottom:6 }}>{l}</div>
                <div style={{ position:'relative' }}>
                  <input value={v} onChange={e=>set(e.target.value)} type={show?'text':'password'} style={{ width:'100%', padding:'12px 50px 12px 14px', borderRadius:10, border:`1px solid ${A.lineStrong}`, background:A.bg, fontSize:13, color:A.ink, outline:'none', fontFamily:MONO }}/>
                  {i===0 && <button onClick={() => setShow(s=>!s)} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', padding:'4px 8px', background:A.surfaceAlt, color:A.ink2, fontSize:10, fontWeight:600, borderRadius:5 }}>{show?'sembunyi':'lihat'}</button>}
                </div>
                {i===1 && newP && (
                  <div style={{ display:'flex', gap:4, marginTop:8 }}>
                    {[0,1,2,3].map(j => (
                      <div key={j} style={{ flex:1, height:4, borderRadius:2, background: j < sc ? (sc<=1?A.warn:sc<=2?A.over:sc<=3?A.honey:A.aman) : A.surfaceAlt }}/>
                    ))}
                    <span style={{ fontSize:10, color:A.ink2, fontWeight:600, marginLeft:6 }}>{sc<=1?'lemah':sc<=2?'sedang':sc<=3?'kuat':'sangat kuat'}</span>
                  </div>
                )}
              </div>
            ))}

            <div style={{ padding:'10px 14px', background:A.bg, borderRadius:10, marginBottom:16, fontSize:11, color:A.ink2, lineHeight:1.6 }}>
              Minimum 8 karakter · kombinasi huruf, angka, dan simbol untuk keamanan terbaik.
            </div>

            <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button data-btn="ghost" onClick={onClose} style={{ padding:'10px 16px', borderRadius:10, color:A.ink, fontSize:13, fontWeight:600 }}>Batal</button>
              <button data-btn="confirm" disabled={!ok} onClick={() => setDone(true)} style={{ padding:'10px 18px', borderRadius:10, background: ok?A.aman:A.surfaceAlt, color: ok?'#fff':A.ink3, fontSize:13, fontWeight:800, cursor:ok?'pointer':'not-allowed', display:'flex', alignItems:'center', gap:6 }}>
                <Ic.check/> Simpan password baru
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

Object.assign(window, { PROTO_Landing: Landing, PROTO_Login: Login, PROTO_ChangePasswordModal: ChangePasswordModal });
})();
