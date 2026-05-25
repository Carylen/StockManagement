// =============================================================
// Prototype A — Mekanik Mobile screens (390px wide, in phone bezel)
// Site-aware (AGMR/RANT/SPUT) · login via NRP
// MekSubmit: hybrid Class G picker (search + commodity chips + list)
// =============================================================
(function(){
const A = window.PROTO_A, FONT = window.PROTO_FONT, MONO = window.PROTO_MONO;
const Ic = window.PROTO_Ic;
const Logo = window.PROTO_Logo;
const Badge = window.PROTO_Badge;
const StatusBadge = window.PROTO_StatusBadge, InqBadge = window.PROTO_InqBadge;
const SiteBadge = window.PROTO_SiteBadge, themeFor = window.PROTO_themeFor;
const Gauge = window.PROTO_Gauge;
const StatusBar = window.PROTO_MobileStatusBar, BottomNav = window.PROTO_MobileBottomNav;
const H = window.UT_HELPERS;
const STATUS_STYLE = window.PROTO_STATUS_STYLE;

const T = themeFor('mekanik');         // KPP green for plant
const partsFor = (site) => window.UT_READINESS[site || 'AGMR'] || window.UT_READINESS.AGMR;
const empByName = (who) => window.UT_EMPLOYEES.find(e => e.name === who || who?.includes(e.name)) || window.UT_EMPLOYEES.find(e => e.name === 'BUDI SANTOSO');

// =============================================================
// HOME — Mekanik beranda
// =============================================================
const MekHome = ({ navigate, site='AGMR', who='BUDI SANTOSO' }) => {
  const P = partsFor(site);
  const sum = H.summary(P);
  const emp = empByName(who);
  const myInq = window.PROTO_MY_INQUIRIES(emp?.nrp);
  const firstName = (emp?.name || who).split(' ')[0];
  return (
    <div className="screen-fade" style={{ width:'100%', height:'100%', fontFamily:FONT, background:A.bg, color:A.ink, display:'flex', flexDirection:'column', overflow:'hidden', position:'relative' }}>
      <StatusBar/>

      <div style={{ flex:1, overflowY:'auto', padding:'18px 20px 110px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:18 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
              <SiteBadge site={site}/>
              <span style={{ fontSize:11, color:A.ink3, fontWeight:600 }}>· {emp?.shift || 'Pagi'}</span>
            </div>
            <div style={{ fontSize:24, fontWeight:800, color:A.ink, letterSpacing:-0.6, textTransform:'capitalize' }}>Hai, {firstName.toLowerCase()} 👋</div>
            <div style={{ fontSize:12.5, color:A.ink2, marginTop:2 }}>Selasa, 21 Mei 2026 · 09:41 WIB</div>
          </div>
          <div style={{ width:42, height:42, borderRadius:12, background:T.primary, color:T.onPrimary, display:'grid', placeItems:'center', fontWeight:700, fontSize:13 }}>{firstName[0]}</div>
        </div>

        {/* Hero card */}
        <div data-proto-link="true" onClick={() => navigate('mek-katalog')} style={{ background:A.ink, color:'#fff', borderRadius:20, padding:20, position:'relative', overflow:'hidden', marginBottom:14 }}>
          <div style={{ position:'absolute', top:-50, right:-50, width:180, height:180, borderRadius:'50%', background:`radial-gradient(circle, ${T.primary}66 0%, transparent 70%)` }}/>
          <div style={{ position:'relative' }}>
            <div style={{ fontSize:10, color:T.primary, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', marginBottom:6 }}>Readiness {site} · hari ini</div>
            <div style={{ fontSize:22, fontWeight:800, letterSpacing:-0.6, marginBottom:4, lineHeight:1.2 }}>{sum.AMAN} part aman,<br/>{sum.WARNING} butuh perhatian.</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,0.65)', marginBottom:14 }}>Last sync 08:30 · Admin {site} upload otomatis</div>
            <div style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:12, color:T.primary, fontWeight:700 }}>Buka readiness <Ic.arrow/></div>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:18 }}>
          <div data-proto-link="true" onClick={() => navigate('mek-submit')} style={{ padding:'18px 16px', background:A.surface, borderRadius:16, border:`1px solid ${A.line}` }}>
            <div style={{ width:32, height:32, borderRadius:8, background:A.honeySoft, color:A.honeyDeep, display:'grid', placeItems:'center', marginBottom:10 }}><Ic.plus/></div>
            <div style={{ fontSize:13.5, fontWeight:700, color:A.ink, letterSpacing:-0.2 }}>Tanya Class G</div>
            <div style={{ fontSize:11, color:A.ink2, marginTop:2 }}>Part di luar VHS → ke UT</div>
          </div>
          <div data-proto-link="true" onClick={() => navigate('mek-inquiry')} style={{ padding:'18px 16px', background:A.surface, borderRadius:16, border:`1px solid ${A.line}`, position:'relative' }}>
            <div style={{ width:32, height:32, borderRadius:8, background:T.primarySoft, color:T.primaryDeep, display:'grid', placeItems:'center', marginBottom:10 }}><Ic.doc/></div>
            <div style={{ fontSize:13.5, fontWeight:700, color:A.ink, letterSpacing:-0.2 }}>Inquiry saya</div>
            <div style={{ fontSize:11, color:A.ink2, marginTop:2 }}>{myInq.length} total · {myInq.filter(q=>q.status==='VALID').length} valid</div>
            {myInq.filter(q=>q.status==='VALID').length > 0 && <span style={{ position:'absolute', top:14, right:14, width:8, height:8, borderRadius:'50%', background:A.aman }}/>}
          </div>
        </div>

        <div style={{ marginBottom:14, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:11, color:A.ink3, fontWeight:700, letterSpacing:0.8, textTransform:'uppercase' }}>Inquiry terakhir</div>
          <div data-proto-link="true" onClick={() => navigate('mek-inquiry')} style={{ fontSize:12, color:A.ink2, fontWeight:600 }}>Lihat semua →</div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:24 }}>
          {myInq.slice(0,2).map(q => (
            <div key={q.id} data-proto-link="true" onClick={() => navigate('mek-inquiry', { inquiryId: q.id })} style={{ padding:14, background:A.surface, borderRadius:14, border:`1px solid ${A.line}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                <span style={{ fontSize:10, fontFamily:MONO, color:A.ink3 }}>{q.id}</span>
                <InqBadge s={q.status}/>
              </div>
              <div style={{ fontSize:13.5, fontWeight:700, color:A.ink, letterSpacing:-0.2 }}>{q.part}</div>
              <div style={{ fontSize:11, color:A.ink2, marginTop:2 }}>{q.qty} pcs · {q.unit} · {q.date.split(' ').slice(0,2).join(' ')}</div>
            </div>
          ))}
          {myInq.length === 0 && (
            <div style={{ padding:'20px 14px', background:A.surface, borderRadius:14, border:`1px solid ${A.line}`, fontSize:12, color:A.ink3, textAlign:'center' }}>
              Belum ada inquiry. <span data-proto-link="true" onClick={() => navigate('mek-submit')} style={{ color:T.primaryDeep, fontWeight:600 }}>Ajukan satu</span>.
            </div>
          )}
        </div>

        <div data-proto-link="true" onClick={() => navigate('mek-katalog')} style={{ padding:'14px 16px', background:T.primarySoft, borderRadius:14, display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:T.primary, color:T.onPrimary, display:'grid', placeItems:'center' }}><Ic.cube/></div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:700, color:A.ink }}>Cek readiness {P.length} part</div>
            <div style={{ fontSize:11, color:A.ink2 }}>Sebelum tanya class G, cek VHS dulu</div>
          </div>
          <Ic.arrow/>
        </div>
      </div>

      <BottomNav active="mek-home" onNavigate={navigate} badge={{ 'mek-inquiry': myInq.filter(q=>q.status==='VALID').length || null }}/>
    </div>
  );
};

// =============================================================
// KATALOG (mobile) — site-aware
// =============================================================
const MekKatalog = ({ navigate, site='AGMR' }) => {
  const P = partsFor(site);
  const [f, setF] = React.useState('all');
  const [q, setQ] = React.useState('');
  const filtered = P.filter(p => {
    if (f !== 'all' && H.statusOf(p) !== f) return false;
    if (q && !`${p.pn} ${p.desc} ${p.comm}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="screen-fade" style={{ width:'100%', height:'100%', fontFamily:FONT, background:A.bg, color:A.ink, display:'flex', flexDirection:'column', overflow:'hidden', position:'relative' }}>
      <StatusBar/>

      <div style={{ padding:'18px 20px 14px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
              <SiteBadge site={site}/>
              <span style={{ fontSize:11, color:A.ink3, fontWeight:600 }}>· Readiness</span>
            </div>
            <div style={{ fontSize:26, fontWeight:800, color:A.ink, letterSpacing:-0.8, marginTop:2 }}>Cari Part</div>
          </div>
          <div style={{ width:38, height:38, borderRadius:10, background:A.surface, border:`1px solid ${A.line}`, display:'grid', placeItems:'center', position:'relative' }}>
            <Ic.bell/>
            <span style={{ position:'absolute', top:8, right:8, width:7, height:7, borderRadius:'50%', background:T.primary, border:`2px solid ${A.surface}` }}/>
          </div>
        </div>
      </div>

      <div style={{ padding:'0 20px 12px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', background:A.surface, border:`1px solid ${A.line}`, borderRadius:14, color:A.ink3 }}>
          <Ic.search/>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Cari PN, deskripsi…" style={{ border:'none', outline:'none', background:'transparent', flex:1, fontSize:14, color:A.ink }}/>
          {q ? <button onClick={()=>setQ('')} style={{ color:A.ink3, display:'flex' }}><Ic.x/></button> : <span style={{ padding:'4px 8px', background:A.surfaceAlt, borderRadius:6, fontSize:11, fontWeight:600, color:A.ink2 }}>{P.length}</span>}
        </div>
      </div>

      <div style={{ padding:'4px 20px 4px', overflowX:'auto', whiteSpace:'nowrap', display:'flex', gap:8 }}>
        {[['all','Semua',null],['WARNING','WARNING','warn'],['AMAN','AMAN','aman'],['OVER','OVER','over']].map(([k,l,kind])=>{
          const styles = { warn:[A.warn,A.warnBg], aman:[A.aman,A.amanBg], over:[A.over,A.overBg] }[kind] || [A.ink2, A.surfaceAlt];
          const on = f === k;
          return (
            <button key={k} onClick={() => setF(k)} style={{
              padding:'7px 12px', borderRadius:999, fontSize:12, fontWeight:600,
              background: on?A.ink:styles[1], color: on?'#fff':styles[0],
              flexShrink:0,
            }}>{l}</button>
          );
        })}
      </div>

      <div style={{ padding:'0 20px 4px', fontSize:11, color:A.ink3, fontWeight:600 }}>
        <b style={{ color:A.ink2, fontFamily:MONO }}>{filtered.length}</b> dari {P.length} part
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'8px 20px 110px', display:'flex', flexDirection:'column', gap:10 }}>
        {filtered.length === 0 ? <div style={{ padding:'40px 20px', textAlign:'center', color:A.ink3, fontSize:13 }}>Tidak ada part yang cocok.</div> : filtered.map(p=>{
          const status = H.statusOf(p);
          const [c,b] = STATUS_STYLE[status];
          return (
            <div key={p.pn} data-proto-link="true" onClick={() => navigate('mek-detail', { partId: p.pn })} style={{ background:A.surface, border:`1px solid ${A.line}`, borderRadius:16, padding:14, position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', left:0, top:0, bottom:0, width:3, background:c }}/>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8, marginBottom:8 }}>
                <div>
                  <div style={{ fontFamily:MONO, fontSize:11.5, fontWeight:600, color:A.ink, letterSpacing:0.3 }}>{p.pn}</div>
                  <div style={{ fontSize:14.5, fontWeight:700, color:A.ink, letterSpacing:-0.2, marginTop:2 }}>{p.desc}</div>
                  <div style={{ fontSize:11, color:A.ink2, marginTop:2 }}>{p.prod} · {p.comm}</div>
                </div>
                <Badge color={c} bg={b}>{status}</Badge>
              </div>
              <div style={{ display:'flex', gap:14, fontSize:11.5, color:A.ink2, marginBottom:8 }}>
                <span>RTT <b style={{ color:A.ink, fontFamily:MONO, fontWeight:700, marginLeft:4 }}>{p.rtt}</b></span>
                <span>TBD <b style={{ color:A.ink, fontFamily:MONO, fontWeight:700, marginLeft:4 }}>{p.tbd}</b></span>
                <span style={{ marginLeft:'auto' }}>Min <b style={{ color:A.ink, fontFamily:MONO, fontWeight:700, marginLeft:4 }}>{p.min}</b> · Max <b style={{ color:A.ink, fontFamily:MONO, fontWeight:700, marginLeft:4 }}>{p.max}</b></span>
              </div>
              <Gauge p={p} h={6}/>
              {p.estimasi > 0 && <div style={{ fontSize:11, color:A.indigo, fontWeight:600, marginTop:6 }}>📦 +{p.estimasi} dalam perjalanan</div>}
            </div>
          );
        })}
      </div>

      <BottomNav active="mek-katalog" onNavigate={navigate}/>
    </div>
  );
};

// =============================================================
// PART DETAIL (mobile) — site-aware
// =============================================================
const MekDetail = ({ navigate, partId, site='AGMR' }) => {
  const P = partsFor(site);
  const p = P.find(x => x.pn === partId) || P[0];
  const status = H.statusOf(p);
  const range = Math.max(p.max*1.3, p.rtt*1.1, 1);
  return (
    <div className="screen-fade" style={{ width:'100%', height:'100%', fontFamily:FONT, background:A.bg, color:A.ink, display:'flex', flexDirection:'column', overflow:'hidden', position:'relative' }}>
      <StatusBar/>

      <div style={{ padding:'14px 20px 0', display:'flex', alignItems:'center', gap:14 }}>
        <div data-proto-link="true" onClick={() => navigate('mek-katalog')} style={{ width:38, height:38, borderRadius:10, background:A.surface, border:`1px solid ${A.line}`, display:'grid', placeItems:'center' }}><Ic.back/></div>
        <div style={{ flex:1, fontSize:11, color:A.ink3, fontWeight:600, letterSpacing:0.8, textTransform:'uppercase' }}>Detail Part · {site}</div>
        <div style={{ width:38, height:38, borderRadius:10, background:A.surface, border:`1px solid ${A.line}`, display:'grid', placeItems:'center', color:A.ink2 }}><Ic.dot3/></div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'18px 20px 110px' }}>
        <div style={{ background:`linear-gradient(135deg, ${T.primarySoft} 0%, ${A.bg} 100%)`, borderRadius:20, padding:'22px 20px', position:'relative', overflow:'hidden' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
            <div style={{ fontFamily:MONO, fontSize:11, color:A.ink, opacity:0.7, fontWeight:600 }}>{p.pn}</div>
            <StatusBadge s={status}/>
          </div>
          <div style={{ fontSize:24, fontWeight:800, color:A.ink, letterSpacing:-0.6, lineHeight:1.15 }}>{p.desc}</div>
          <div style={{ fontSize:12.5, color:A.ink2, marginTop:6 }}>{p.prod === 'KOMAT' ? 'Komatsu' : 'Scania'} · {p.comm} · Kelas V</div>
          <div style={{ position:'absolute', bottom:-30, right:-30, width:120, height:120, borderRadius:'50%', background:`radial-gradient(circle, ${T.primary}55 0%, transparent 70%)` }}/>
        </div>

        <div style={{ marginTop:16, background:A.surface, borderRadius:18, border:`1px solid ${A.line}`, padding:18 }}>
          <div style={{ fontSize:11, color:A.ink3, fontWeight:600, letterSpacing:0.8, textTransform:'uppercase', marginBottom:14 }}>Stok UT saat ini</div>
          {[
            ['RTT', 'Rantau Warehouse', p.rtt, T.primary],
            ['TBD', 'Banjarmasin Depot', p.tbd, A.indigo],
          ].map(([k,l,v,col],i)=>{
            const total = p.rtt + p.tbd || 1;
            return (
              <div key={i} style={{ marginBottom:i===0?14:0 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:6 }}>
                  <div>
                    <span style={{ fontFamily:MONO, fontSize:11, fontWeight:700, color:A.ink, padding:'3px 8px', background:A.surfaceAlt, borderRadius:6, marginRight:8 }}>{k}</span>
                    <span style={{ fontSize:12, color:A.ink2 }}>{l}</span>
                  </div>
                  <div style={{ fontSize:22, fontWeight:700, color:A.ink, fontFamily:MONO, letterSpacing:-0.5, fontFeatureSettings:'"tnum"' }}>{v}<span style={{ fontSize:11, color:A.ink3, marginLeft:3 }}>pcs</span></div>
                </div>
                <div style={{ height:10, background:A.surfaceAlt, borderRadius:5, overflow:'hidden' }}>
                  <div style={{ width:(v/total*100)+'%', height:'100%', background:col, borderRadius:5 }}/>
                </div>
              </div>
            );
          })}
          <div style={{ marginTop:14, paddingTop:14, borderTop:`1px solid ${A.line}`, display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
            <div style={{ fontSize:11, color:A.ink2, fontWeight:600, letterSpacing:0.6, textTransform:'uppercase' }}>Total</div>
            <div style={{ fontSize:30, fontWeight:800, color:A.ink, letterSpacing:-1, fontFamily:MONO, fontFeatureSettings:'"tnum"' }}>{p.rtt + p.tbd}<span style={{ fontSize:13, color:A.ink3, marginLeft:4, fontWeight:600 }}>pcs</span></div>
          </div>
          {p.estimasi > 0 && (
            <div style={{ marginTop:14, padding:'12px 14px', background:A.indigoSoft, borderRadius:12, display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ fontSize:22 }}>📦</div>
              <div>
                <div style={{ fontSize:11, color:A.indigo, fontWeight:700, letterSpacing:0.6, textTransform:'uppercase' }}>Estimasi in-transit</div>
                <div style={{ fontSize:14, fontWeight:700, color:A.ink, marginTop:2 }}>{p.estimasi} pcs dalam perjalanan</div>
              </div>
            </div>
          )}
        </div>

        <div style={{ marginTop:14, background:A.surface, borderRadius:18, border:`1px solid ${A.line}`, padding:18 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:14 }}>
            <div style={{ fontSize:11, color:A.ink3, fontWeight:600, letterSpacing:0.8, textTransform:'uppercase' }}>vs Kebutuhan {site}</div>
            <div style={{ fontSize:11, color: status==='WARNING'?A.warn:A.aman, fontWeight:700 }}>
              {status==='WARNING' ? `${p.min - p.rtt} di bawah MIN` : status==='OVER' ? `+${p.rtt-p.max} di atas MAX` : `+${p.rtt - p.min} di atas MIN`}
            </div>
          </div>
          <div style={{ position:'relative', padding:'24px 0 28px' }}>
            <Gauge p={p} h={16}/>
            <div style={{ position:'absolute', left:`${(p.min/range)*100}%`, top:0, fontSize:10, color:A.ink2, fontWeight:600, transform:'translateX(-50%)', fontFamily:MONO }}>MIN {p.min}</div>
            <div style={{ position:'absolute', left:`${(p.max/range)*100}%`, top:0, fontSize:10, color:A.ink2, fontWeight:600, transform:'translateX(-50%)', fontFamily:MONO }}>MAX {p.max}</div>
          </div>
        </div>
      </div>

      <BottomNav active="mek-katalog" onNavigate={navigate}/>
    </div>
  );
};

// =============================================================
// SUBMIT KELAS G — Hybrid Class G picker
// =============================================================
const MekSubmit = ({ navigate, flash, site='AGMR', who='BUDI SANTOSO', prefillPart }) => {
  const emp = empByName(who);
  const classG = H.classG();
  const COMMODITIES = ['ALL','ISP','ENG','GET','HOS','GEN','U/C','COL'];
  const PRODS = ['ALL','KOMATSU','SCANIA','HENSLEY'];

  const [step, setStep] = React.useState(prefillPart ? 2 : 1);  // 1 pick part, 2 fill form, 3 review
  const [pickedPart, setPickedPart] = React.useState(null);
  const [searchQ, setSearchQ] = React.useState('');
  const [comm, setComm] = React.useState('ALL');
  const [prod, setProd] = React.useState('ALL');
  const [qty, setQty] = React.useState(2);
  const [unit, setUnit] = React.useState('PC200 #07');

  // Filter Class G master
  const filteredG = classG.filter(p => {
    if (comm !== 'ALL' && !p.comm.includes(comm)) return false;
    if (prod !== 'ALL' && p.prod !== prod) return false;
    if (searchQ && !`${p.pn} ${p.desc}`.toLowerCase().includes(searchQ.toLowerCase())) return false;
    return true;
  }).slice(0, 30);

  const canSubmit = pickedPart && qty > 0 && unit.trim().length > 0;

  return (
    <div className="screen-fade" style={{ width:'100%', height:'100%', fontFamily:FONT, background:A.bg, color:A.ink, display:'flex', flexDirection:'column', overflow:'hidden', position:'relative' }}>
      <StatusBar/>

      <div style={{ padding:'14px 20px 0', display:'flex', alignItems:'center', gap:14 }}>
        <div data-proto-link="true" onClick={() => step===1 ? navigate('mek-home') : setStep(step-1)} style={{ width:38, height:38, borderRadius:10, background:A.surface, border:`1px solid ${A.line}`, display:'grid', placeItems:'center' }}><Ic.back/></div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, color:A.ink3, fontWeight:600, letterSpacing:0.8, textTransform:'uppercase' }}>Tanya UT · Class G</div>
          <div style={{ fontSize:16, fontWeight:700, color:A.ink, letterSpacing:-0.3 }}>{step===1 ? 'Pilih part' : step===2 ? 'Detail kebutuhan' : 'Review & kirim'}</div>
        </div>
        <div style={{ fontSize:11, color:A.ink3, fontWeight:600, fontFamily:MONO }}>{step}/3</div>
      </div>

      <div style={{ padding:'14px 20px 0', display:'flex', gap:6 }}>
        {[1,2,3].map(s => <div key={s} style={{ flex:1, height:4, borderRadius:2, background: step>=s ? T.primary : A.surfaceAlt }}/>)}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'14px 20px 24px' }}>

        {/* STEP 1 — Hybrid Class G picker */}
        {step === 1 && (
          <>
            <div style={{ padding:'12px 14px', background:T.primarySoft, borderRadius:12, marginBottom:14, fontSize:12, color:A.ink, lineHeight:1.5 }}>
              <b style={{ color:T.primaryDeep }}>Class G</b> = part di luar VHS UT. Hanya {window.UT_CLASS_MASTER_META.fullCountG.toLocaleString('id-ID')} part terdaftar yang bisa di-inquiry — pilih dari dropdown di bawah.
            </div>

            {/* Search */}
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', background:A.surface, border:`1.5px solid ${T.primary}33`, borderRadius:14, color:A.ink3, marginBottom:10 }}>
              <Ic.search/>
              <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Ketik PN atau nama part…" autoFocus style={{ border:'none', outline:'none', background:'transparent', flex:1, fontSize:14, color:A.ink }}/>
              {searchQ && <button onClick={()=>setSearchQ('')} style={{ color:A.ink3, display:'flex' }}><Ic.x/></button>}
            </div>

            {/* Commodity chips */}
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:10, color:A.ink3, fontWeight:700, letterSpacing:0.6, textTransform:'uppercase', marginBottom:6 }}>Kategori</div>
              <div style={{ overflowX:'auto', whiteSpace:'nowrap', display:'flex', gap:6, margin:'0 -20px', padding:'0 20px' }}>
                {COMMODITIES.map(c => {
                  const on = comm === c;
                  return (
                    <button key={c} onClick={()=>setComm(c)} style={{
                      padding:'6px 12px', borderRadius:999, fontSize:11.5, fontWeight:700, fontFamily:MONO,
                      background: on?A.ink:A.surface, color: on?'#fff':A.ink2,
                      border: on?'none':`1px solid ${A.line}`, flexShrink:0,
                    }}>{c}</button>
                  );
                })}
              </div>
            </div>

            {/* Producer chips */}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10, color:A.ink3, fontWeight:700, letterSpacing:0.6, textTransform:'uppercase', marginBottom:6 }}>Merk</div>
              <div style={{ overflowX:'auto', whiteSpace:'nowrap', display:'flex', gap:6, margin:'0 -20px', padding:'0 20px' }}>
                {PRODS.map(c => {
                  const on = prod === c;
                  return (
                    <button key={c} onClick={()=>setProd(c)} style={{
                      padding:'6px 12px', borderRadius:999, fontSize:11.5, fontWeight:700,
                      background: on?T.primary:A.surface, color: on?T.onPrimary:A.ink2,
                      border: on?'none':`1px solid ${A.line}`, flexShrink:0,
                    }}>{c}</button>
                  );
                })}
              </div>
            </div>

            <div style={{ fontSize:11, color:A.ink3, fontWeight:600, marginBottom:8 }}>{filteredG.length} hasil {filteredG.length>=30 && '· tampilkan 30 teratas'}</div>

            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {filteredG.length === 0 ? (
                <div style={{ padding:'30px 14px', textAlign:'center', color:A.ink3, fontSize:13, background:A.surface, borderRadius:14, border:`1px dashed ${A.line}` }}>
                  Tidak ada part Class G yang cocok. Coba ubah kata kunci atau filter.
                </div>
              ) : filteredG.map(p => (
                <div key={p.pn} data-proto-link="true" onClick={() => { setPickedPart(p); setStep(2); }} style={{
                  padding:'12px 14px', background:A.surface, borderRadius:12, border:`1px solid ${A.line}`,
                  display:'flex', alignItems:'center', gap:12,
                }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background: p.prod==='SCANIA'?A.coral:p.prod==='HENSLEY'?A.indigo:T.primary, flexShrink:0 }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:MONO, fontSize:11.5, color:A.ink2, fontWeight:600 }}>{p.pn}</div>
                    <div style={{ fontSize:14, fontWeight:700, color:A.ink, letterSpacing:-0.2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.desc}</div>
                    <div style={{ fontSize:11, color:A.ink3, marginTop:1 }}>{p.prod} · {p.comm}</div>
                  </div>
                  <Badge color={A.honeyDeep} bg={A.honeySoft} mono dot={false}>G</Badge>
                </div>
              ))}
            </div>
          </>
        )}

        {/* STEP 2 — Detail kebutuhan */}
        {step === 2 && (
          <>
            {pickedPart && (
              <div style={{ padding:'14px 16px', background:T.primarySoft, borderRadius:14, marginBottom:16, display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:36, height:36, borderRadius:10, background:T.primary, color:T.onPrimary, display:'grid', placeItems:'center', fontSize:13, fontWeight:800 }}>G</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:MONO, fontSize:11, color:T.primaryDeep, fontWeight:600 }}>{pickedPart.pn}</div>
                  <div style={{ fontSize:14, fontWeight:800, color:A.ink, letterSpacing:-0.2 }}>{pickedPart.desc}</div>
                  <div style={{ fontSize:10.5, color:A.ink2, marginTop:1 }}>{pickedPart.prod} · {pickedPart.comm}</div>
                </div>
                <button data-proto-link="true" onClick={() => setStep(1)} style={{ fontSize:11, fontWeight:700, color:T.primaryDeep, padding:'6px 10px', borderRadius:8, background:'rgba(255,255,255,0.6)' }}>Ganti</button>
              </div>
            )}

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
              <div>
                <div style={{ fontSize:11, color:A.ink3, fontWeight:700, letterSpacing:0.6, textTransform:'uppercase', marginBottom:6 }}>Quantity *</div>
                <div style={{ display:'flex', alignItems:'center', gap:0, background:A.surface, borderRadius:12, border:`1px solid ${A.line}` }}>
                  <button onClick={() => setQty(Math.max(1, qty-1))} style={{ padding:'14px 16px', color:A.ink2, fontSize:18, fontWeight:700, borderRadius:'12px 0 0 12px' }}>−</button>
                  <input value={qty} onChange={e=>setQty(parseInt(e.target.value)||0)} type="number" style={{ flex:1, padding:'14px 0', border:'none', background:'transparent', textAlign:'center', fontSize:18, fontWeight:700, color:A.ink, fontFamily:MONO, outline:'none', width:'40px' }}/>
                  <button onClick={() => setQty(qty+1)} style={{ padding:'14px 16px', color:A.ink, fontSize:18, fontWeight:700, borderRadius:'0 12px 12px 0' }}>+</button>
                </div>
              </div>
              <div>
                <div style={{ fontSize:11, color:A.ink3, fontWeight:700, letterSpacing:0.6, textTransform:'uppercase', marginBottom:6 }}>Unit *</div>
                <select value={unit} onChange={e=>setUnit(e.target.value)} style={{ width:'100%', padding:'14px 14px', borderRadius:12, border:`1px solid ${A.line}`, background:A.surface, fontSize:13, color:A.ink, outline:'none', appearance:'none', fontWeight:600 }}>
                  <option>PC200 #07</option><option>PC2000 #01</option><option>HD785 #03</option><option>HD785 #14</option><option>GD825 #04</option><option>P460-HD #12</option>
                </select>
              </div>
            </div>

          </>
        )}

        {/* STEP 3 — Review */}
        {step === 3 && (
          <>
            <div style={{ padding:14, background:T.primarySoft, borderRadius:14, marginBottom:18 }}>
              <div style={{ fontSize:11, color:T.primaryDeep, fontWeight:700, letterSpacing:1, textTransform:'uppercase', marginBottom:4 }}>Sebelum kirim</div>
              <div style={{ fontSize:13, color:A.ink, fontWeight:600, lineHeight:1.45 }}>Inquiry langsung masuk ke PIC UT Rantau. UT akan respond <b>VALID</b> (kasih kode WH UT) atau <b>INVALID</b> (PN diganti + kode WH UT).</div>
            </div>

            <div style={{ background:A.surface, borderRadius:16, border:`1px solid ${A.line}`, padding:18, marginBottom:14 }}>
              <div style={{ fontSize:11, color:A.ink3, fontWeight:700, letterSpacing:0.6, textTransform:'uppercase', marginBottom:14 }}>Detail inquiry</div>
              {[
                ['Part', pickedPart ? `${pickedPart.desc} (${pickedPart.pn})` : '—'],
                ['Kategori', pickedPart ? `${pickedPart.prod} · ${pickedPart.comm}` : '—'],
                ['Quantity', `${qty} pcs`],
                ['Unit', unit],
                ['Site asal', site],
              ].map(([k,v],i)=>(
                <div key={i} style={{ display:'flex', flexDirection:'column', gap:2, padding:'10px 0', borderTop: i?`1px solid ${A.line}`:'none' }}>
                  <div style={{ fontSize:10, color:A.ink3, fontWeight:700, letterSpacing:0.6, textTransform:'uppercase' }}>{k}</div>
                  <div style={{ fontSize:13.5, color:A.ink, fontWeight: k==='Part'?700:500, lineHeight:1.4, fontFamily:k==='Site asal'?MONO:FONT }}>{v}</div>
                </div>
              ))}
            </div>

            <div style={{ background:A.surface, borderRadius:16, border:`1px solid ${A.line}`, padding:18 }}>
              <div style={{ fontSize:11, color:A.ink3, fontWeight:700, letterSpacing:0.6, textTransform:'uppercase', marginBottom:10 }}>Flow respond UT</div>
              <div style={{ position:'relative', paddingLeft:18 }}>
                <div style={{ position:'absolute', left:5, top:8, bottom:8, width:1.5, background:A.line }}/>
                {[
                  ['Submit oleh ' + (emp?.name || who), 'sekarang', T.primary, 'now'],
                  ['Diterima PIC UT Rantau', 'tidak perlu approval GL', A.honey, 'next'],
                  ['Respond: VALID / INVALID', 'UT isi kode WH UT (+ PN pengganti kalau invalid)', A.indigo, 'wait'],
                  ['Update status di app', 'kamu dapat notifikasi', A.aman, 'wait'],
                ].map(([l,sub,c,stage],i)=>(
                  <div key={i} style={{ padding:'6px 0', position:'relative' }}>
                    <div style={{ position:'absolute', left:-18, top:8, width:12, height:12, borderRadius:'50%', background: stage==='now' ? c : A.surfaceAlt, border:`2px solid ${A.surface}` }}/>
                    <div style={{ fontSize:12.5, fontWeight:600, color: stage==='now' ? A.ink : A.ink2 }}>{l}</div>
                    <div style={{ fontSize:11, color:A.ink3 }}>{sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom action */}
      <div style={{ padding:'14px 20px 24px', background:A.bg, borderTop:`1px solid ${A.line}`, display:'flex', gap:10 }}>
        {step === 1 ? (
          <button data-btn="ghost" onClick={() => navigate('mek-home')} style={{ flex:1, padding:'15px', borderRadius:12, background:A.surfaceAlt, color:A.ink, fontSize:13, fontWeight:700 }}>Batal</button>
        ) : step === 2 ? (
          <>
            <button data-btn="ghost" onClick={() => setStep(1)} style={{ padding:'15px 22px', borderRadius:12, background:A.surfaceAlt, color:A.ink, fontSize:13, fontWeight:700 }}>Ganti part</button>
            <button data-btn="primary" data-proto-link={canSubmit?'true':undefined} onClick={() => canSubmit && setStep(3)} disabled={!canSubmit} style={{
              flex:1, padding:'15px', borderRadius:12, background: canSubmit?A.ink:A.surfaceAlt, color: canSubmit?'#fff':A.ink3,
              fontSize:14, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              cursor: canSubmit?'pointer':'not-allowed',
            }}>Review <Ic.arrow/></button>
          </>
        ) : (
          <>
            <button data-btn="ghost" onClick={() => setStep(2)} style={{ padding:'15px 22px', borderRadius:12, background:A.surfaceAlt, color:A.ink, fontSize:13, fontWeight:700 }}>Edit</button>
            <button data-btn="confirm" data-proto-link="true" onClick={() => {
              window.PROTO_ADD_INQUIRY({
                site, part: pickedPart.desc, pn: pickedPart.pn,
                qty, unit,
                by: emp?.name || who, nrp: emp?.nrp, role: 'Mekanik',
              });
              flash('Inquiry langsung dikirim ke PIC UT · menunggu respond', 'ok');
              navigate('mek-inquiry');
            }} style={{ flex:1, padding:'15px', borderRadius:12, background:A.aman, color:'#fff', fontSize:14, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              <Ic.check/> Kirim ke UT
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// =============================================================
// MY INQUIRIES (mobile)
// =============================================================
const MekInquiry = ({ navigate, inquiryId, site='AGMR', who='BUDI SANTOSO' }) => {
  const emp = empByName(who);
  const inquiries = window.PROTO_MY_INQUIRIES(emp?.nrp);
  const [activeId, setActiveId] = React.useState(inquiryId || null);
  const active = inquiries.find(q => q.id === activeId);

  React.useEffect(() => { if (inquiryId) setActiveId(inquiryId); }, [inquiryId]);

  if (active) {
    return (
      <div className="screen-fade" style={{ width:'100%', height:'100%', fontFamily:FONT, background:A.bg, color:A.ink, display:'flex', flexDirection:'column', overflow:'hidden', position:'relative' }}>
        <StatusBar/>
        <div style={{ padding:'14px 20px 0', display:'flex', alignItems:'center', gap:14 }}>
          <div data-proto-link="true" onClick={() => setActiveId(null)} style={{ width:38, height:38, borderRadius:10, background:A.surface, border:`1px solid ${A.line}`, display:'grid', placeItems:'center' }}><Ic.back/></div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:11, color:A.ink3, fontWeight:600, letterSpacing:0.8, textTransform:'uppercase' }}>Inquiry</div>
            <div style={{ fontSize:14, fontWeight:700, color:A.ink, letterSpacing:-0.2, fontFamily:MONO }}>{active.id}</div>
          </div>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'18px 20px 110px' }}>
          <div style={{ background:`linear-gradient(135deg, ${T.primarySoft}, ${A.bg})`, borderRadius:18, padding:'22px 20px', position:'relative', overflow:'hidden', marginBottom:14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
              <InqBadge s={active.status}/>
              <span style={{ fontSize:11, color:A.ink2, fontWeight:600 }}>{active.date}</span>
            </div>
            <div style={{ fontSize:22, fontWeight:800, color:A.ink, letterSpacing:-0.4, lineHeight:1.2 }}>{active.part}</div>
            {active.pn && <div style={{ fontFamily:MONO, fontSize:12, color:A.ink2, marginTop:4 }}>{active.pn}</div>}
            <div style={{ fontSize:12.5, color:A.ink2, marginTop:6 }}>{active.qty} pcs · untuk {active.unit}</div>
          </div>

          {(active.status === 'VALID' || active.status === 'INVALID') && (
            <div style={{ background: active.status==='VALID'?A.tersediaBg:A.tidakAdaBg, borderRadius:18, padding:18, marginBottom:14, border:`1.5px solid ${active.status==='VALID'?A.tersedia:A.tidakAda}33` }}>
              <div style={{ fontSize:11, color:active.status==='VALID'?A.tersedia:A.tidakAda, fontWeight:800, letterSpacing:0.6, textTransform:'uppercase', marginBottom:8 }}>📬 Respond dari UT</div>
              {active.replacementPn && (
                <div style={{ marginBottom:12, padding:'10px 12px', background:'rgba(255,255,255,0.7)', borderRadius:10 }}>
                  <div style={{ fontSize:10, color:A.tidakAda, fontWeight:700, letterSpacing:0.6, textTransform:'uppercase' }}>PN Pengganti</div>
                  <div style={{ fontSize:15, fontWeight:800, color:A.ink, fontFamily:MONO, marginTop:2 }}>{active.replacementPn}</div>
                  <div style={{ fontSize:12, color:A.ink2, marginTop:2 }}>{active.replacementDesc}</div>
                </div>
              )}
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                <span style={{ fontSize:10, color:A.ink2, fontWeight:700, letterSpacing:0.6, textTransform:'uppercase' }}>Kode WH UT</span>
                <Badge color={A.honeyDeep} bg={A.honeySoft} mono>{active.utSiteCode}</Badge>
              </div>
              <div style={{ fontSize:13, color:A.ink, lineHeight:1.5, marginTop:8, fontStyle:'italic' }}>"{active.utNote}"</div>
              <div style={{ fontSize:11, color:A.ink3, marginTop:8 }}>— {active.respondedBy} · {active.respondedAt}</div>
            </div>
          )}

          <div style={{ background:A.surface, borderRadius:18, border:`1px solid ${A.line}`, padding:18, marginBottom:14 }}>
            <div style={{ fontSize:11, color:A.ink3, fontWeight:700, letterSpacing:0.6, textTransform:'uppercase', marginBottom:12 }}>Progress</div>
            <div style={{ position:'relative', paddingLeft:18 }}>
              <div style={{ position:'absolute', left:5, top:8, bottom:8, width:1.5, background:A.line }}/>
              {[
                { l:'Disubmit oleh kamu', sub:active.date, c:T.primary, done:true },
                { l:'Diterima PIC UT', sub:'tanpa step approval GL', c:A.honey, done: true },
                { l:'Respond UT', sub: active.status==='PENDING' ? 'menunggu respond' : `${active.status} · ${active.utSiteCode}`, c: active.status==='VALID'?A.aman:active.status==='INVALID'?A.warn:A.ink3, done: active.status!=='PENDING' },
              ].map((t,i)=>(
                <div key={i} style={{ padding:'8px 0', position:'relative' }}>
                  <div style={{ position:'absolute', left:-18, top:10, width:12, height:12, borderRadius:'50%', background: t.done ? t.c : A.surfaceAlt, border:`2px solid ${A.surface}` }}/>
                  <div style={{ fontSize:13, fontWeight:600, color: t.done ? A.ink : A.ink3 }}>{t.l}</div>
                  <div style={{ fontSize:11, color:A.ink3 }}>{t.sub}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background:A.surface, borderRadius:18, border:`1px solid ${A.line}`, padding:18 }}>
            <div style={{ fontSize:11, color:A.ink3, fontWeight:700, letterSpacing:0.6, textTransform:'uppercase', marginBottom:8 }}>Catatan kamu</div>
            <div style={{ fontSize:13, color:A.ink, lineHeight:1.55, padding:12, background:A.bg, borderRadius:10 }}>"{active.notes || '—'}"</div>
          </div>
        </div>

        <BottomNav active="mek-inquiry" onNavigate={navigate}/>
      </div>
    );
  }

  return (
    <div className="screen-fade" style={{ width:'100%', height:'100%', fontFamily:FONT, background:A.bg, color:A.ink, display:'flex', flexDirection:'column', overflow:'hidden', position:'relative' }}>
      <StatusBar/>

      <div style={{ padding:'18px 20px 14px', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div style={{ fontSize:11, color:A.ink3, fontWeight:600, letterSpacing:0.8, textTransform:'uppercase' }}>Inquiry Class G</div>
          <div style={{ fontSize:24, fontWeight:800, color:A.ink, letterSpacing:-0.6, marginTop:4 }}>Pengajuan saya</div>
        </div>
        <div data-proto-link="true" onClick={() => navigate('mek-submit')} style={{ width:38, height:38, borderRadius:12, background:A.ink, color:'#fff', display:'grid', placeItems:'center' }}><Ic.plus/></div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'4px 20px 110px', display:'flex', flexDirection:'column', gap:10 }}>
        {inquiries.length === 0 ? (
          <div style={{ padding:'40px 20px', textAlign:'center', background:A.surface, borderRadius:16, border:`1px dashed ${A.line}` }}>
            <div style={{ fontSize:32, marginBottom:10 }}>📭</div>
            <div style={{ fontSize:14, fontWeight:700, color:A.ink, marginBottom:6 }}>Belum ada inquiry</div>
            <div style={{ fontSize:12, color:A.ink2, lineHeight:1.5, marginBottom:14 }}>Kalau butuh part Class G (di luar VHS), ajukan di sini — langsung ke UT.</div>
            <button data-btn="primary" data-proto-link="true" onClick={() => navigate('mek-submit')} style={{ padding:'10px 18px', borderRadius:10, background:A.ink, color:'#fff', fontSize:13, fontWeight:800 }}>Tanya UT pertama</button>
          </div>
        ) : inquiries.map(q => (
          <div key={q.id} data-proto-link="true" onClick={() => setActiveId(q.id)} style={{ background:A.surface, borderRadius:16, padding:'14px 14px', border:`1px solid ${A.line}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
              <span style={{ fontSize:10, fontFamily:MONO, color:A.ink3, fontWeight:600 }}>{q.id}</span>
              <InqBadge s={q.status}/>
            </div>
            <div style={{ fontSize:14, fontWeight:700, color:A.ink, letterSpacing:-0.2, lineHeight:1.3, marginBottom:4 }}>{q.part}</div>
            <div style={{ fontSize:11.5, color:A.ink2 }}>{q.qty} pcs · {q.unit} · {q.date.split(' ').slice(0,2).join(' ')}</div>
            {q.status === 'PENDING' && <div style={{ marginTop:8, fontSize:11, color:A.pending, fontWeight:600 }}>● Menunggu respond UT</div>}
            {q.status === 'VALID' && <div style={{ marginTop:8, fontSize:11, color:A.aman, fontWeight:600 }}>✓ Tersedia di {q.utSiteCode}</div>}
            {q.status === 'INVALID' && <div style={{ marginTop:8, fontSize:11, color:A.warn, fontWeight:600 }}>↻ PN diganti: {q.replacementPn}</div>}
          </div>
        ))}
      </div>

      <BottomNav active="mek-inquiry" onNavigate={navigate} badge={{ 'mek-inquiry': inquiries.filter(q=>q.status==='VALID').length || null }}/>
    </div>
  );
};

// Profile screen — pulls real data from employee record
const MekProfile = ({ navigate, site='AGMR', who='BUDI SANTOSO' }) => {
  const emp = empByName(who);
  return (
    <div className="screen-fade" style={{ width:'100%', height:'100%', fontFamily:FONT, background:A.bg, color:A.ink, display:'flex', flexDirection:'column', overflow:'hidden', position:'relative' }}>
      <StatusBar/>
      <div style={{ padding:'18px 20px 14px' }}>
        <div style={{ fontSize:11, color:A.ink3, fontWeight:600, letterSpacing:0.8, textTransform:'uppercase' }}>Profil</div>
        <div style={{ fontSize:24, fontWeight:800, color:A.ink, letterSpacing:-0.6, marginTop:4 }}>Akun saya</div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'8px 20px 110px' }}>
        <div style={{ background:A.surface, borderRadius:18, border:`1px solid ${A.line}`, padding:24, textAlign:'center', marginBottom:14 }}>
          <div style={{ width:72, height:72, borderRadius:'50%', background:T.primary, color:T.onPrimary, display:'grid', placeItems:'center', fontSize:24, fontWeight:800, margin:'0 auto 12px' }}>{(emp?.name || who).split(' ').map(w=>w[0]).slice(0,2).join('')}</div>
          <div style={{ fontSize:18, fontWeight:800, color:A.ink, letterSpacing:-0.3 }}>{emp?.name || who}</div>
          <div style={{ fontSize:12, color:A.ink2, marginTop:2 }}>{emp?.role || 'Mekanik'} · Site {emp?.site || site} · Shift {emp?.shift || 'Pagi'}</div>
          <div style={{ fontSize:11, color:A.ink3, marginTop:8, fontFamily:MONO }}>NRP {emp?.nrp || '—'}</div>
        </div>

        <div style={{ padding:'14px 16px', background:T.primarySoft, borderRadius:14, marginBottom:14, fontSize:12, color:A.ink, lineHeight:1.5 }}>
          <b style={{ color:T.primaryDeep }}>Login passwordless</b> · NRP saja, mirip kartu absen. Kalau NRP ganti, hubungi Admin Site untuk bulk re-upload.
        </div>

        <div style={{ background:A.surface, borderRadius:18, border:`1px solid ${A.line}`, overflow:'hidden' }}>
          {[
            ['Notifikasi', 'aktif untuk respond UT'],
            ['Bahasa', 'Indonesia'],
            ['Tema', 'Mengikuti sistem'],
            ['Bantuan & support', null],
            ['Keluar', null, A.warn],
          ].map(([l,sub,c],i)=>(
            <div key={i} data-proto-link={l==='Keluar'?'true':undefined} onClick={l==='Keluar' ? () => navigate('landing') : undefined} style={{ padding:'16px 18px', display:'flex', alignItems:'center', borderTop: i?`1px solid ${A.line}`:'none' }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13.5, fontWeight:600, color: c||A.ink }}>{l}</div>
                {sub && <div style={{ fontSize:11, color:A.ink3, marginTop:2 }}>{sub}</div>}
              </div>
              <Ic.arrow/>
            </div>
          ))}
        </div>
      </div>

      <BottomNav active="mek-profile" onNavigate={navigate}/>
    </div>
  );
};

Object.assign(window, {
  PROTO_MekHome: MekHome,
  PROTO_MekKatalog: MekKatalog,
  PROTO_MekDetail: MekDetail,
  PROTO_MekSubmit: MekSubmit,
  PROTO_MekInquiry: MekInquiry,
  PROTO_MekProfile: MekProfile,
});
})();
