// =============================================================
// Prototype A — Admin Site screens (site-scoped per AGMR/RANT/SPUT)
// Dashboard · Katalog · Part Detail · Upload(3 types) · Karyawan · Akun · Inquiry
// =============================================================
(function(){
const A = window.PROTO_A, FONT = window.PROTO_FONT, MONO = window.PROTO_MONO;
const Ic = window.PROTO_Ic, Sidebar = window.PROTO_Sidebar, Topbar = window.PROTO_Topbar;
const StatusBadge = window.PROTO_StatusBadge, InqBadge = window.PROTO_InqBadge;
const SiteBadge = window.PROTO_SiteBadge, themeFor = window.PROTO_themeFor;
const Badge = window.PROTO_Badge, Gauge = window.PROTO_Gauge;
const Modal = window.PROTO_Modal, ChangePwd = window.PROTO_ChangePasswordModal;
const H = window.UT_HELPERS;

// Resolver — site is passed via route, default AGMR
const partsFor = (site) => window.UT_READINESS[site || 'AGMR'] || window.UT_READINESS.AGMR;
const inqFor = (site) => window.PROTO_ALL_INQUIRIES().filter(q => q.site === site);

// =============================================================
// 1. DASHBOARD — site-aware
// =============================================================
const AdminDashboard = ({ navigate, role='admin', site='AGMR', who }) => {
  const T = themeFor(role);
  const P = partsFor(site);
  const sum = H.summary(P);
  const warnList = P.filter(p => H.statusOf(p)==='WARNING').slice(0,5);
  const myInq = inqFor(site);
  const pendingCount = myInq.filter(q => q.status === 'PENDING').length;
  const validCount = myInq.filter(q => q.status === 'VALID').length;
  const invalidCount = myInq.filter(q => q.status === 'INVALID').length;
  const user = `${who || 'Rina'} · Admin ${site}`;
  return (
    <div className="screen-fade" style={{ minHeight:'100vh', fontFamily:FONT, background:A.bg, color:A.ink, display:'flex' }}>
      <Sidebar role={role} active="dashboard" onNavigate={navigate} site={site}/>
      <main style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        <Topbar role={role} sub={`Site ${site} · 21 Mei 2026 · 08:30 WIB`} title={`Selamat pagi, ${(who||'Rina').split(' ')[0]} 👋`} user={user} onSearch={() => navigate('katalog')}/>
        <div style={{ padding:'24px 32px 80px', flex:1 }}>

          {/* KPI cards */}
          <div data-stagger="true" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:20 }}>
            {[
              { label:`Readiness · Site ${site}`, value:sum.total, sub:`KOMAT + SCNIA · Kelas V`, accent:T.primary, tag:'baris aktif', filter:'all' },
              { label:'WARNING',            value:sum.WARNING, sub:'RTT di bawah MIN', accent:A.warn,  tag:'butuh review',  filter:'WARNING' },
              { label:'AMAN',               value:sum.AMAN,    sub:'di rentang Min–Max', accent:A.aman, tag:'stabil',            filter:'AMAN' },
              { label:'OVER',               value:sum.OVER,    sub:'RTT melebihi MAX',  accent:A.over,  tag:'cek over-stock',  filter:'OVER' },
            ].map((c,i)=>(
              <div key={i} data-reveal="true" data-lift="true" data-proto-link="true" onClick={() => navigate('katalog', { filter: c.filter })} style={{ background:A.surface, borderRadius:16, padding:'18px 20px', border:`1px solid ${A.line}`, position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:c.accent }}/>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ fontSize:11, color:A.ink2, fontWeight:600, letterSpacing:0.8, textTransform:'uppercase' }}>{c.label}</div>
                  <span style={{ fontSize:10, color:A.ink3, fontWeight:500 }}>{c.tag}</span>
                </div>
                <div style={{ fontSize:48, fontWeight:700, letterSpacing:-2, color:A.ink, marginTop:8, lineHeight:1, fontFeatureSettings:'"tnum"' }}>{c.value}</div>
                <div style={{ fontSize:12, color:A.ink2, marginTop:4 }}>{c.sub}</div>
              </div>
            ))}
          </div>

          <div data-stagger="true" style={{ display:'grid', gridTemplateColumns:'1fr 1.4fr', gap:16, marginBottom:20 }}>
            {/* Readyness */}
            <div data-reveal="true" style={{ background:A.surface, borderRadius:16, padding:24, border:`1px solid ${A.line}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
                <div>
                  <div style={{ fontSize:11, color:A.ink2, fontWeight:600, letterSpacing:0.8, textTransform:'uppercase' }}>Readyness {site}</div>
                  <div style={{ fontSize:18, fontWeight:700, color:A.ink, marginTop:4 }}>Snapshot stok harian</div>
                </div>
                <Badge color={T.primaryDeep} bg={T.primarySoft} dot={false} mono>21·05</Badge>
              </div>
              {[
                { k:'OH', v:sum.oh_pct, lbl:'RTT > 0' },
                { k:'MIN', v:sum.min_pct, lbl:'RTT ≥ MIN' },
                { k:'FB', v:sum.fb_pct, lbl:'Total ≥ MIN' },
              ].map((r,i)=>(
                <div key={i} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 0', borderTop:i?`1px solid ${A.line}`:'none' }}>
                  <div style={{ width:42 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:A.ink, fontFamily:MONO }}>{r.k}</div>
                    <div style={{ fontSize:10, color:A.ink3, marginTop:2 }}>{r.lbl}</div>
                  </div>
                  <div style={{ flex:1, height:10, background:A.surfaceAlt, borderRadius:5, overflow:'hidden' }}>
                    <div style={{ width:r.v+'%', height:'100%', background:`linear-gradient(90deg, ${T.primary}, ${T.primaryDeep})`, borderRadius:5 }}/>
                  </div>
                  <div style={{ fontSize:22, fontWeight:700, color:A.ink, width:62, textAlign:'right', letterSpacing:-0.6, fontFeatureSettings:'"tnum"' }}>{r.v}<span style={{ fontSize:12, color:A.ink2, marginLeft:2 }}>%</span></div>
                </div>
              ))}
            </div>

            {/* Inquiry pulse — site only */}
            <div data-reveal="true" style={{ background:A.surface, borderRadius:16, padding:24, border:`1px solid ${A.line}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
                <div>
                  <div style={{ fontSize:11, color:A.ink2, fontWeight:600, letterSpacing:0.8, textTransform:'uppercase' }}>Inquiry Kelas G · {site}</div>
                  <div style={{ fontSize:18, fontWeight:700, color:A.ink, marginTop:4 }}>Status respond UT</div>
                </div>
                <button data-proto-link="true" onClick={() => navigate('inquiry')} style={{ padding:'6px 12px', borderRadius:8, background:A.surfaceAlt, fontSize:12, color:A.ink2, fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>Lihat semua <Ic.arrow/></button>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12 }}>
                {[
                  ['Pending UT', pendingCount, A.pending, 'menunggu respond'],
                  ['Valid', validCount, A.tersedia, 'isi kode WH UT'],
                  ['Invalid', invalidCount, A.tidakAda, 'PN diganti'],
                ].map(([l,v,c,sub],i)=>(
                  <div key={i} style={{ padding:14, borderRadius:12, background:A.bg, position:'relative', overflow:'hidden' }}>
                    <div style={{ position:'absolute', top:0, left:0, bottom:0, width:3, background:c }}/>
                    <div style={{ fontSize:11, color:A.ink2, fontWeight:600, letterSpacing:0.4, marginBottom:4 }}>{l}</div>
                    <div style={{ fontSize:30, fontWeight:700, color:c, fontFeatureSettings:'"tnum"', lineHeight:1 }}>{v}</div>
                    <div style={{ fontSize:11, color:A.ink3, marginTop:4 }}>{sub}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:14, paddingTop:14, borderTop:`1px solid ${A.line}`, display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12 }}>
                <span style={{ color:A.ink2 }}>Total inquiry dari {site}: <b style={{ color:A.ink, fontFamily:MONO }}>{myInq.length}</b></span>
                <span style={{ color:A.ink3 }}>SLA respond UT: 2-3 hari kerja</span>
              </div>
            </div>
          </div>

          {/* Warning list */}
          <div data-reveal="true" style={{ background:A.surface, borderRadius:16, border:`1px solid ${A.line}`, overflow:'hidden' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'18px 24px', borderBottom:`1px solid ${A.line}` }}>
              <div>
                <div style={{ fontSize:11, color:A.ink2, fontWeight:600, letterSpacing:0.8, textTransform:'uppercase' }}>Perlu Perhatian · {site}</div>
                <div style={{ fontSize:18, fontWeight:700, color:A.ink, marginTop:4 }}>Stok di bawah MIN</div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button data-btn="ghost" style={{ padding:'8px 14px', borderRadius:10, background:A.surfaceAlt, fontSize:12, color:A.ink, fontWeight:600 }}>Export CSV</button>
                <button data-btn="primary" data-proto-link="true" onClick={() => navigate('katalog', { filter:'WARNING' })} style={{ padding:'8px 14px', borderRadius:10, background:A.ink, color:'#fff', fontSize:12, fontWeight:700, display:'flex', alignItems:'center', gap:6 }}><Ic.arrow/> Buka katalog</button>
              </div>
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:A.bg, color:A.ink2, fontSize:11, letterSpacing:0.6, textTransform:'uppercase' }}>
                  <th style={{ textAlign:'left', padding:'10px 24px', fontWeight:600 }}>Part Number</th>
                  <th style={{ textAlign:'left', padding:'10px 16px', fontWeight:600 }}>Deskripsi</th>
                  <th style={{ textAlign:'left', padding:'10px 16px', fontWeight:600 }}>Kategori</th>
                  <th style={{ textAlign:'right', padding:'10px 16px', fontWeight:600 }}>RTT</th>
                  <th style={{ textAlign:'right', padding:'10px 16px', fontWeight:600 }}>TBD</th>
                  <th style={{ textAlign:'right', padding:'10px 16px', fontWeight:600 }}>MIN</th>
                  <th style={{ textAlign:'right', padding:'10px 16px', fontWeight:600 }}>Estimasi</th>
                  <th style={{ padding:'10px 16px' }}/>
                  <th style={{ textAlign:'right', padding:'10px 24px', fontWeight:600 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {warnList.length === 0 ? (
                  <tr><td colSpan="9" style={{ padding:'40px 24px', textAlign:'center', color:A.ink3 }}>Tidak ada part WARNING di {site} 🎉</td></tr>
                ) : warnList.map(p=>(
                  <tr key={p.pn} data-proto-link="true" onClick={() => navigate('part', { partId: p.pn })} style={{ borderTop:`1px solid ${A.line}` }}>
                    <td style={{ padding:'14px 24px', fontFamily:MONO, fontWeight:600, color:A.ink, fontSize:12.5 }}>{p.pn}</td>
                    <td style={{ padding:'14px 16px', fontWeight:600, color:A.ink }}>{p.desc}</td>
                    <td style={{ padding:'14px 16px', color:A.ink2 }}>{p.prod} · {p.comm}</td>
                    <td style={{ padding:'14px 16px', textAlign:'right', fontFamily:MONO, color:A.warn, fontWeight:700, fontFeatureSettings:'"tnum"' }}>{p.rtt}</td>
                    <td style={{ padding:'14px 16px', textAlign:'right', fontFamily:MONO, color:A.ink, fontFeatureSettings:'"tnum"' }}>{p.tbd}</td>
                    <td style={{ padding:'14px 16px', textAlign:'right', fontFamily:MONO, color:A.ink, fontFeatureSettings:'"tnum"' }}>{p.min}</td>
                    <td style={{ padding:'14px 16px', textAlign:'right', fontFamily:MONO, color:p.estimasi>0?A.indigo:A.ink3, fontFeatureSettings:'"tnum"' }}>{p.estimasi>0?`+${p.estimasi}`:'—'}</td>
                    <td style={{ padding:'14px 16px', width:140 }}><Gauge p={p} h={8}/></td>
                    <td style={{ padding:'14px 24px', textAlign:'right' }}><StatusBadge s="WARNING"/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

// =============================================================
// 2. KATALOG (readiness) — site-aware
// =============================================================
const Katalog = ({ navigate, role='admin', filter='all', site='AGMR', who }) => {
  const T = themeFor(role);
  const P = partsFor(site);
  const [f, setF] = React.useState(filter);
  const [prod, setProd] = React.useState('all');
  const [q, setQ] = React.useState('');
  const user = `${who||'Rina'} · ${role==='gl'?'Group Leader':role==='ut'?'PIC UT':'Admin '+site}`;

  React.useEffect(() => setF(filter), [filter]);

  const filtered = P.filter(p => {
    if (f !== 'all' && H.statusOf(p) !== f) return false;
    if (prod !== 'all' && p.prod !== prod) return false;
    if (q && !`${p.pn} ${p.desc} ${p.comm}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="screen-fade" style={{ minHeight:'100vh', fontFamily:FONT, background:A.bg, color:A.ink, display:'flex' }}>
      <Sidebar role={role} active="katalog" onNavigate={navigate} site={site}/>
      <main style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        <Topbar role={role} sub={`Readiness · ${P.length} part Kelas V`} title={`Katalog ${site}`} user={user}/>
        <div style={{ padding:'24px 32px 80px' }}>
          {/* Filter bar */}
          <div style={{ display:'flex', gap:12, marginBottom:18, alignItems:'center', flexWrap:'wrap' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', background:A.surface, border:`1px solid ${A.line}`, borderRadius:10, width:340, color:A.ink3 }}>
              <Ic.search/>
              <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Cari PN, deskripsi, kategori…" style={{ border:'none', outline:'none', background:'transparent', flex:1, fontSize:13, color:A.ink }}/>
              {q && <button onClick={()=>setQ('')} style={{ color:A.ink3, display:'flex' }}><Ic.x/></button>}
            </div>
            <div style={{ display:'flex', gap:6 }}>
              {[
                ['all', 'Semua', null],
                ['WARNING', 'Warning', A.warn],
                ['AMAN', 'Aman', A.aman],
                ['OVER', 'Over', A.over],
              ].map(([k,l,c])=>{
                const on = f === k;
                return (
                  <button key={k} onClick={()=>setF(k)} style={{
                    padding:'8px 14px', borderRadius:999, fontSize:12.5, fontWeight:600,
                    background: on?A.ink:A.surface, color: on?'#fff':A.ink2,
                    border: on?'none':`1px solid ${A.line}`,
                    display:'flex', alignItems:'center', gap:6,
                  }}>
                    {c && <span style={{ width:6, height:6, borderRadius:'50%', background:c }}/>}
                    {l}
                  </button>
                );
              })}
            </div>
            <div style={{ display:'flex', gap:6, marginLeft:'auto' }}>
              {['all','KOMAT','SCNIA'].map(k=>{
                const on = prod === k;
                return (
                  <button key={k} onClick={()=>setProd(k)} style={{
                    padding:'8px 14px', borderRadius:999, fontSize:11.5, fontWeight:700, fontFamily:k==='all'?FONT:MONO,
                    background: on?T.primary:A.surface, color: on?T.onPrimary:A.ink2,
                    border: on?'none':`1px solid ${A.line}`,
                  }}>{k==='all'?'Semua merk':k}</button>
                );
              })}
            </div>
          </div>

          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, padding:'0 4px' }}>
            <div style={{ fontSize:13, color:A.ink2 }}>
              <b style={{ color:A.ink, fontWeight:700, fontFamily:MONO }}>{filtered.length}</b> dari {P.length} part {f!=='all' && <span>· filter <b>{f}</b></span>} {prod!=='all' && <span>· {prod}</span>}
            </div>
            {role==='admin' && <button style={{ fontSize:12, color:A.ink2, fontWeight:600, display:'flex', alignItems:'center', gap:6 }}><Ic.upload/> Export {filtered.length} baris</button>}
          </div>

          <div style={{ background:A.surface, borderRadius:16, border:`1px solid ${A.line}`, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:A.bg, color:A.ink2, fontSize:11, letterSpacing:0.6, textTransform:'uppercase' }}>
                  <th style={{ textAlign:'left', padding:'12px 24px', fontWeight:600 }}>Part Number</th>
                  <th style={{ textAlign:'left', padding:'12px 16px', fontWeight:600 }}>Deskripsi</th>
                  <th style={{ textAlign:'left', padding:'12px 16px', fontWeight:600 }}>Kategori</th>
                  <th style={{ textAlign:'right', padding:'12px 16px', fontWeight:600 }}>RTT</th>
                  <th style={{ textAlign:'right', padding:'12px 16px', fontWeight:600 }}>TBD</th>
                  <th style={{ textAlign:'right', padding:'12px 16px', fontWeight:600 }}>Total</th>
                  <th style={{ textAlign:'right', padding:'12px 16px', fontWeight:600 }}>MIN</th>
                  <th style={{ textAlign:'right', padding:'12px 16px', fontWeight:600 }}>MAX</th>
                  <th style={{ textAlign:'right', padding:'12px 16px', fontWeight:600 }}>Estimasi</th>
                  <th style={{ textAlign:'right', padding:'12px 24px', fontWeight:600 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan="10" style={{ padding:'60px 24px', textAlign:'center', color:A.ink3 }}>Tidak ada part yang cocok dengan filter ini.</td></tr>
                ) : filtered.map(p=>(
                  <tr key={p.pn} data-proto-link="true" onClick={() => navigate('part', { partId: p.pn })} style={{ borderTop:`1px solid ${A.line}` }}>
                    <td style={{ padding:'14px 24px', fontFamily:MONO, fontWeight:600, color:A.ink, fontSize:12.5 }}>{p.pn}</td>
                    <td style={{ padding:'14px 16px', fontWeight:600, color:A.ink }}>{p.desc}</td>
                    <td style={{ padding:'14px 16px', color:A.ink2 }}>{p.prod} · {p.comm}</td>
                    <td style={{ padding:'14px 16px', textAlign:'right', fontFamily:MONO, color:A.ink, fontWeight:600, fontFeatureSettings:'"tnum"' }}>{p.rtt}</td>
                    <td style={{ padding:'14px 16px', textAlign:'right', fontFamily:MONO, color:A.ink2, fontFeatureSettings:'"tnum"' }}>{p.tbd}</td>
                    <td style={{ padding:'14px 16px', textAlign:'right', fontFamily:MONO, color:A.ink, fontWeight:700, fontFeatureSettings:'"tnum"' }}>{p.rtt+p.tbd}</td>
                    <td style={{ padding:'14px 16px', textAlign:'right', fontFamily:MONO, color:A.ink2, fontFeatureSettings:'"tnum"' }}>{p.min}</td>
                    <td style={{ padding:'14px 16px', textAlign:'right', fontFamily:MONO, color:A.ink2, fontFeatureSettings:'"tnum"' }}>{p.max}</td>
                    <td style={{ padding:'14px 16px', textAlign:'right', fontFamily:MONO, color:p.estimasi>0?A.indigo:A.ink3, fontFeatureSettings:'"tnum"' }}>{p.estimasi>0?`+${p.estimasi}`:'—'}</td>
                    <td style={{ padding:'14px 24px', textAlign:'right' }}><StatusBadge s={H.statusOf(p)}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

// =============================================================
// 3. PART DETAIL — site-aware
// =============================================================
const PartDetail = ({ navigate, role='admin', partId, site='AGMR', who }) => {
  const T = themeFor(role);
  const P = partsFor(site);
  const p = P.find(x => x.pn === partId) || P[0];
  const status = H.statusOf(p);
  const total = p.rtt + p.tbd;
  const user = `${who||'Rina'} · Admin ${site}`;

  return (
    <div className="screen-fade" style={{ minHeight:'100vh', fontFamily:FONT, background:A.bg, color:A.ink, display:'flex' }}>
      <Sidebar role={role} active="katalog" onNavigate={navigate} site={site}/>
      <main style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        <Topbar role={role} sub={<span><span data-proto-link="true" onClick={() => navigate('katalog')} style={{ cursor:'pointer' }}>Katalog {site}</span> · {p.prod} · {p.comm}</span>} title={p.desc} user={user}/>
        <div style={{ padding:'24px 32px 80px' }}>

          <button data-proto-link="true" onClick={() => navigate('katalog')} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:A.ink2, fontWeight:600, marginBottom:18 }}>
            <Ic.back/> Kembali ke katalog
          </button>

          {/* Header card */}
          <div data-reveal="true" style={{ background:`linear-gradient(135deg, ${T.primarySoft} 0%, ${A.bg} 100%)`, borderRadius:20, padding:'32px 36px', position:'relative', overflow:'hidden', marginBottom:20 }}>
            <div style={{ position:'absolute', bottom:-60, right:-60, width:240, height:240, borderRadius:'50%', background:`radial-gradient(circle, ${T.primary}55 0%, transparent 70%)` }}/>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', position:'relative' }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                  <span style={{ fontFamily:MONO, fontSize:14, color:A.ink, fontWeight:700 }}>{p.pn}</span>
                  <StatusBadge s={status}/>
                  <SiteBadge site={site}/>
                </div>
                <div style={{ fontSize:36, fontWeight:800, color:A.ink, letterSpacing:-1, lineHeight:1.1, maxWidth:680 }}>{p.desc}</div>
                <div style={{ fontSize:14, color:A.ink2, marginTop:10 }}>{p.prod === 'KOMAT' ? 'Komatsu' : 'Scania'} · Commodity <b>{p.comm}</b> · Kelas V</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:11, color:A.ink2, fontWeight:600, letterSpacing:0.8, textTransform:'uppercase' }}>Total stok UT</div>
                <div style={{ fontSize:56, fontWeight:800, color:A.ink, fontFamily:MONO, letterSpacing:-2, lineHeight:1, marginTop:4, fontFeatureSettings:'"tnum"' }}>{total}<span style={{ fontSize:16, color:A.ink2, marginLeft:6, fontWeight:600 }}>pcs</span></div>
                <div style={{ fontSize:12, color:A.ink2, marginTop:6 }}>RTT {p.rtt} + TBD {p.tbd}{p.estimasi>0 && <span style={{ color:A.indigo, marginLeft:6 }}>· +{p.estimasi} dalam perjalanan</span>}</div>
              </div>
            </div>
          </div>

          <div data-stagger="true" style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:16, marginBottom:20 }}>
            <div data-reveal="true" style={{ background:A.surface, borderRadius:16, border:`1px solid ${A.line}`, padding:24 }}>
              <div style={{ fontSize:11, color:A.ink3, fontWeight:600, letterSpacing:0.8, textTransform:'uppercase', marginBottom:14 }}>Stok per Warehouse UT</div>
              {[
                ['RTT', 'Rantau Warehouse · dekat AGMR', p.rtt, T.primary],
                ['TBD', 'Banjarmasin Depot · transit',   p.tbd, A.indigo],
              ].map(([k,l,v,col],i)=>(
                <div key={i} style={{ padding:'14px 0', borderTop:i?`1px solid ${A.line}`:'none' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:8 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{ fontFamily:MONO, fontSize:11, fontWeight:700, color:A.ink, padding:'3px 8px', background:A.surfaceAlt, borderRadius:6 }}>{k}</span>
                      <span style={{ fontSize:13, color:A.ink, fontWeight:600 }}>{l}</span>
                    </div>
                    <div style={{ fontSize:26, fontWeight:700, color:A.ink, fontFamily:MONO, letterSpacing:-0.6, fontFeatureSettings:'"tnum"' }}>{v}</div>
                  </div>
                  <div style={{ height:10, background:A.surfaceAlt, borderRadius:5, overflow:'hidden' }}>
                    <div style={{ width: total ? (v/total*100)+'%' : '0%', height:'100%', background:col, borderRadius:5 }}/>
                  </div>
                </div>
              ))}
              {p.estimasi > 0 && (
                <div style={{ marginTop:14, padding:'14px 16px', background:A.indigoSoft, borderRadius:12, display:'flex', alignItems:'center', gap:14 }}>
                  <div style={{ width:38, height:38, borderRadius:10, background:A.indigo, color:'#fff', display:'grid', placeItems:'center', fontSize:20 }}>📦</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, color:A.indigo, fontWeight:700, letterSpacing:0.6, textTransform:'uppercase' }}>Estimasi dalam perjalanan</div>
                    <div style={{ fontSize:14, fontWeight:700, color:A.ink, marginTop:2 }}>{p.estimasi} pcs sedang dalam pengiriman ke RTT</div>
                  </div>
                </div>
              )}
            </div>

            <div data-reveal="true" style={{ background:A.surface, borderRadius:16, border:`1px solid ${A.line}`, padding:24 }}>
              <div style={{ fontSize:11, color:A.ink3, fontWeight:600, letterSpacing:0.8, textTransform:'uppercase', marginBottom:14 }}>vs Kebutuhan {site}</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:18 }}>
                {[
                  ['MIN', p.min, A.ink2],
                  ['MAX', p.max, A.ink2],
                  ['RTT', p.rtt, status==='WARNING'?A.warn:A.aman],
                ].map(([l,v,c],i)=>(
                  <div key={i} style={{ padding:'12px 14px', background:A.bg, borderRadius:10 }}>
                    <div style={{ fontSize:10, color:A.ink3, fontWeight:700, letterSpacing:0.6 }}>{l}</div>
                    <div style={{ fontSize:24, fontWeight:700, color:c, fontFamily:MONO, lineHeight:1.1, marginTop:4, fontFeatureSettings:'"tnum"' }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ padding:'14px 0 6px' }}><Gauge p={p} h={16}/></div>
              <div style={{ fontSize:12, color: status==='WARNING' ? A.warn : A.aman, marginTop:14, fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:'currentColor' }}/>
                {status==='WARNING' ? `Kurang ${p.min - p.rtt} pcs untuk mencapai MIN` : status==='OVER' ? `Kelebihan ${p.rtt - p.max} pcs di atas MAX` : `Aman · ${p.rtt - p.min} pcs di atas MIN`}
              </div>
            </div>
          </div>

          {/* Related inquiries for this part */}
          <div data-reveal="true" style={{ background:A.surface, borderRadius:16, border:`1px solid ${A.line}`, padding:24 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <div>
                <div style={{ fontSize:11, color:A.ink3, fontWeight:600, letterSpacing:0.8, textTransform:'uppercase' }}>Inquiry terkait · {site}</div>
                <div style={{ fontSize:16, fontWeight:700, color:A.ink, marginTop:4 }}>Inquiry Kelas G dari site ini</div>
              </div>
              <button data-proto-link="true" onClick={() => navigate('inquiry')} style={{ fontSize:12, color:A.ink2, fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>Semua inquiry <Ic.arrow/></button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {inqFor(site).slice(0,3).map(q => (
                <div key={q.id} data-proto-link="true" onClick={() => navigate('inquiry', { inquiryId: q.id })} style={{ padding:'14px 16px', borderRadius:12, background:A.bg, display:'flex', alignItems:'center', gap:16 }}>
                  <div style={{ fontFamily:MONO, fontSize:11, color:A.ink2, fontWeight:600, width:130 }}>{q.id}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:A.ink }}>{q.part}</div>
                    <div style={{ fontSize:11, color:A.ink3 }}>{q.by} · {q.role} · {q.unit}</div>
                  </div>
                  <div style={{ fontFamily:MONO, fontSize:12, color:A.ink, fontWeight:700 }}>{q.qty} pcs</div>
                  <InqBadge s={q.status}/>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

// =============================================================
// 4. UPLOAD READINESS — daily CSV (per site, NEW format)
// =============================================================
const UploadReadiness = ({ navigate, role='admin', site='AGMR', who, flash }) => {
  const T = themeFor(role);
  const [stage, setStage] = React.useState('preview'); // idle | preview | publishing
  return (
    <div className="screen-fade" style={{ minHeight:'100vh', fontFamily:FONT, background:A.bg, color:A.ink, display:'flex' }}>
      <Sidebar role={role} active="upload-readiness" onNavigate={navigate} site={site}/>
      <main style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        <Topbar role={role} sub={`Admin ${site} · Upload`} title="Upload Readiness Harian" user={`${who||'Rina'} · Admin ${site}`}/>
        <div style={{ padding:'24px 32px 80px', display:'flex', flexDirection:'column', gap:20 }}>

          <div style={{ background:T.primarySoft, borderRadius:14, padding:'16px 20px', display:'flex', gap:14, alignItems:'center' }}>
            <div style={{ width:42, height:42, borderRadius:12, background:T.primary, color:T.onPrimary, display:'grid', placeItems:'center', fontSize:18 }}>i</div>
            <div style={{ flex:1, fontSize:12.5, color:A.ink, lineHeight:1.5 }}>
              <b style={{ color:T.primaryDeep }}>Site {site} saja.</b> File ini tidak punya kolom AGMR/RANT/SPUT — kamu cukup upload data site sendiri. Kolom: <span style={{ fontFamily:MONO, fontSize:11, background:A.surface, padding:'2px 6px', borderRadius:4 }}>part_number, description, min, max, status, rtt, tbd, total, estimasi</span>
            </div>
          </div>

          <div style={{ background:A.surface, borderRadius:18, border:`1.5px dashed ${T.primary}`, padding:'32px', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:-100, right:-100, width:300, height:300, borderRadius:'50%', background:`radial-gradient(circle, ${T.primarySoft} 0%, transparent 70%)` }}/>
            <div style={{ display:'flex', alignItems:'center', gap:32, position:'relative', flexWrap:'wrap' }}>
              <div style={{ width:80, height:80, borderRadius:20, background:`linear-gradient(135deg, ${T.primary}, ${T.primaryDeep})`, display:'grid', placeItems:'center', color:T.onPrimary, flexShrink:0 }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 3v13"/><path d="m6 9 6-6 6 6"/><path d="M5 21h14"/></svg>
              </div>
              <div style={{ flex:1, minWidth:280 }}>
                <div style={{ fontSize:22, fontWeight:700, color:A.ink, letterSpacing:-0.3 }}>Tarik file readiness {site} ke sini</div>
                <div style={{ fontSize:14, color:A.ink2, marginTop:6 }}>Format: <span style={{ fontFamily:MONO, padding:'2px 6px', background:A.surfaceAlt, borderRadius:4 }}>READINESS_{site}_DDMMYY.csv</span> · max 10MB</div>
                <div style={{ marginTop:14, display:'flex', gap:10, alignItems:'center' }}>
                  <button data-btn="primary" style={{ padding:'10px 18px', borderRadius:10, background:A.ink, color:'#fff', fontSize:13, fontWeight:700 }}>Pilih file</button>
                  <span style={{ fontSize:12, color:A.ink3 }}>atau drop di area ini</span>
                </div>
              </div>
              <div style={{ borderLeft:`1px solid ${A.line}`, paddingLeft:32 }}>
                <div style={{ fontSize:11, color:A.ink3, fontWeight:600, letterSpacing:0.8, textTransform:'uppercase', marginBottom:6 }}>Last sync · {site}</div>
                <div style={{ fontSize:15, fontWeight:700, color:A.ink, lineHeight:1.3 }}>20 Mei 2026<br/>08:15 WIB</div>
                <div style={{ fontSize:11, color:A.ink2, marginTop:8, fontFamily:MONO }}>READINESS_{site}<br/>_200526.csv</div>
                <div style={{ display:'flex', gap:10, marginTop:10, fontSize:11 }}>
                  <span style={{ color:A.aman, fontWeight:700 }}>✓ 22 valid</span>
                  <span style={{ color:A.ink3, fontWeight:700 }}>0 error</span>
                </div>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div style={{ background:A.surface, borderRadius:18, border:`1px solid ${A.line}`, overflow:'hidden' }}>
            <div style={{ padding:'18px 24px', borderBottom:`1px solid ${A.line}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:11, color:A.ink2, fontWeight:600, letterSpacing:0.8, textTransform:'uppercase' }}>Preview Validasi · sudah disepakati UT</div>
                <div style={{ fontSize:18, fontWeight:700, color:A.ink, marginTop:4 }}>READINESS_{site}_210526.csv</div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button data-btn="ghost" style={{ padding:'10px 16px', borderRadius:10, background:'transparent', border:`1px solid ${A.lineStrong}`, color:A.ink, fontSize:12.5, fontWeight:600 }}>Batalkan</button>
                <button data-btn="confirm" data-proto-link="true" onClick={() => {
                  setStage('publishing');
                  setTimeout(() => {
                    flash(`Readiness ${site} dipublish · 22 baris ter-update`, 'ok');
                    navigate('dashboard');
                  }, 800);
                }} style={{ padding:'10px 18px', borderRadius:10, background:A.aman, color:'#fff', fontSize:12.5, fontWeight:800, display:'flex', alignItems:'center', gap:8 }}>
                  {stage==='publishing' ? 'Publishing…' : <><Ic.check/> Publish ke database</>}
                </button>
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:1, background:A.line }}>
              {[
                { v:22, l:'Baris valid', c:A.aman },
                { v:0,  l:'Di-skip · PN tidak ada di Master', c:A.over },
                { v:0,  l:'Baris error', c:A.ink3 },
                { v:3,  l:'Estimasi terisi (in-transit)', c:A.indigo },
              ].map((r,i)=>(
                <div key={i} style={{ background:A.surface, padding:'18px 24px' }}>
                  <div style={{ display:'flex', alignItems:'baseline', gap:10 }}>
                    <div style={{ fontSize:38, fontWeight:700, color:r.c, letterSpacing:-1.5, fontFeatureSettings:'"tnum"' }}>{r.v}</div>
                    <div style={{ fontSize:11, color:A.ink2, fontWeight:600 }}>rows</div>
                  </div>
                  <div style={{ fontSize:12, color:A.ink2, marginTop:2 }}>{r.l}</div>
                </div>
              ))}
            </div>

            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:A.bg, color:A.ink2, fontSize:11, letterSpacing:0.6, textTransform:'uppercase' }}>
                  <th style={{ textAlign:'left', padding:'10px 24px', fontWeight:600 }}>Part Number</th>
                  <th style={{ textAlign:'left', padding:'10px 16px', fontWeight:600 }}>Description</th>
                  <th style={{ textAlign:'right', padding:'10px 16px', fontWeight:600 }}>MIN</th>
                  <th style={{ textAlign:'right', padding:'10px 16px', fontWeight:600 }}>MAX</th>
                  <th style={{ textAlign:'right', padding:'10px 16px', fontWeight:600 }}>RTT</th>
                  <th style={{ textAlign:'right', padding:'10px 16px', fontWeight:600 }}>TBD</th>
                  <th style={{ textAlign:'right', padding:'10px 16px', fontWeight:600 }}>Total</th>
                  <th style={{ textAlign:'right', padding:'10px 16px', fontWeight:600 }}>Estimasi</th>
                  <th style={{ textAlign:'right', padding:'10px 24px', fontWeight:600 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {partsFor(site).slice(0,6).map(p=>(
                  <tr key={p.pn} style={{ borderTop:`1px solid ${A.line}` }}>
                    <td style={{ padding:'12px 24px', fontFamily:MONO, fontWeight:600, color:A.ink, fontSize:12.5 }}>{p.pn}</td>
                    <td style={{ padding:'12px 16px', color:A.ink, fontWeight:500 }}>{p.desc}</td>
                    <td style={{ padding:'12px 16px', textAlign:'right', fontFamily:MONO, color:A.ink2, fontFeatureSettings:'"tnum"' }}>{p.min}</td>
                    <td style={{ padding:'12px 16px', textAlign:'right', fontFamily:MONO, color:A.ink2, fontFeatureSettings:'"tnum"' }}>{p.max}</td>
                    <td style={{ padding:'12px 16px', textAlign:'right', fontFamily:MONO, color:A.ink, fontWeight:600, fontFeatureSettings:'"tnum"' }}>{p.rtt}</td>
                    <td style={{ padding:'12px 16px', textAlign:'right', fontFamily:MONO, color:A.ink2, fontFeatureSettings:'"tnum"' }}>{p.tbd}</td>
                    <td style={{ padding:'12px 16px', textAlign:'right', fontFamily:MONO, color:A.ink, fontWeight:700, fontFeatureSettings:'"tnum"' }}>{p.rtt+p.tbd}</td>
                    <td style={{ padding:'12px 16px', textAlign:'right', fontFamily:MONO, color:p.estimasi>0?A.indigo:A.ink3, fontFeatureSettings:'"tnum"' }}>{p.estimasi>0?`+${p.estimasi}`:'—'}</td>
                    <td style={{ padding:'12px 24px', textAlign:'right' }}><StatusBadge s={H.statusOf(p)}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

// =============================================================
// 5. UPLOAD MASTER CLASS V/G — one-time, shared across sites
// =============================================================
const UploadMaster = ({ navigate, role='admin', site='AGMR', who, flash }) => {
  const T = themeFor(role);
  const meta = window.UT_CLASS_MASTER_META;

  // ── Autocomplete state (sample-master scoped) ──
  const allMaster = window.UT_CLASS_MASTER;
  const [q, setQ] = React.useState('');
  const [clsF, setClsF] = React.useState('all');           // all | V | G
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);            // keyboard highlight index
  const inputRef = React.useRef(null);
  const wrapRef = React.useRef(null);

  // matches the typed query against PN / desc / mnemonic / commodity
  const matches = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return allMaster.filter(p => {
      if (clsF !== 'all' && p.cls !== clsF) return false;
      if (!needle) return false;
      return (
        p.pn.toLowerCase().includes(needle) ||
        p.desc.toLowerCase().includes(needle) ||
        p.prod.toLowerCase().includes(needle) ||
        p.comm.toLowerCase().includes(needle)
      );
    }).slice(0, 8);
  }, [q, clsF, allMaster]);

  // table rows: when q empty → first 12 sample rows respecting class filter; when q present → all matches in master
  const tableRows = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    const pool = clsF === 'all' ? allMaster : allMaster.filter(p => p.cls === clsF);
    if (!needle) return pool.slice(0, 12);
    return pool.filter(p =>
      p.pn.toLowerCase().includes(needle) ||
      p.desc.toLowerCase().includes(needle) ||
      p.prod.toLowerCase().includes(needle) ||
      p.comm.toLowerCase().includes(needle)
    );
  }, [q, clsF, allMaster]);

  // close dropdown on outside click
  React.useEffect(() => {
    const onDown = (ev) => {
      if (wrapRef.current && !wrapRef.current.contains(ev.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // reset active when matches change
  React.useEffect(() => { setActive(0); }, [q, clsF]);

  const pickMatch = (p) => {
    setQ(p.pn);
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKey = (e) => {
    if (!open || !matches.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); pickMatch(matches[active]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  // highlight matched substring in label
  const hi = (text) => {
    const needle = q.trim();
    if (!needle) return text;
    const i = text.toLowerCase().indexOf(needle.toLowerCase());
    if (i < 0) return text;
    return (
      <>
        {text.slice(0, i)}
        <mark style={{ background:T.primarySoft, color:T.primaryDeep, padding:'0 1px', borderRadius:3 }}>{text.slice(i, i + needle.length)}</mark>
        {text.slice(i + needle.length)}
      </>
    );
  };

  return (
    <div className="screen-fade" style={{ minHeight:'100vh', fontFamily:FONT, background:A.bg, color:A.ink, display:'flex' }}>
      <Sidebar role={role} active="upload-master" onNavigate={navigate} site={site}/>
      <main style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        <Topbar role={role} sub="Admin · Master Data" title="Master Part Class V & G" user={`${who||'Rina'} · Admin ${site}`}/>
        <div style={{ padding:'24px 32px 80px', display:'flex', flexDirection:'column', gap:20 }}>

          {/* Status of current master */}
          <div style={{ background:A.surface, borderRadius:16, border:`1px solid ${A.line}`, padding:24 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:18, flexWrap:'wrap', gap:14 }}>
              <div>
                <div style={{ fontSize:11, color:A.ink3, fontWeight:600, letterSpacing:0.8, textTransform:'uppercase' }}>Master Aktif</div>
                <div style={{ fontSize:24, fontWeight:800, color:A.ink, marginTop:4, letterSpacing:-0.4 }}>{meta.fileName}</div>
                <div style={{ fontSize:12, color:A.ink2, marginTop:4 }}>Diupload {meta.uploadedAt} oleh {meta.uploadedBy}</div>
              </div>
              <Badge color={A.aman} bg={A.amanBg}>Active</Badge>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:1, background:A.line, border:`1px solid ${A.line}`, borderRadius:12, overflow:'hidden' }}>
              {[
                ['Class V', meta.fullCountV.toLocaleString('id-ID'), 'stok di WH UT', A.green],
                ['Class G', meta.fullCountG.toLocaleString('id-ID'), 'inquiry-able', A.honey],
                ['Komatsu', meta.byProd.KOMATSU.toLocaleString('id-ID'), 'KOMAT', A.coral],
                ['Scania + Hensley', (meta.byProd.SCANIA + meta.byProd.HENSLEY).toLocaleString('id-ID'), 'SCNIA + HEN', A.indigo],
              ].map(([l,v,sub,c],i)=>(
                <div key={i} style={{ background:A.bg, padding:'18px 20px', position:'relative' }}>
                  <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:c }}/>
                  <div style={{ fontSize:11, color:A.ink2, fontWeight:600, letterSpacing:0.6, textTransform:'uppercase' }}>{l}</div>
                  <div style={{ fontSize:30, fontWeight:700, color:A.ink, fontFamily:MONO, marginTop:6, letterSpacing:-1, fontFeatureSettings:'"tnum"' }}>{v}</div>
                  <div style={{ fontSize:11, color:A.ink3, marginTop:2 }}>{sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Replace master */}
          <div style={{ background:A.surface, borderRadius:18, border:`1.5px dashed ${A.lineStrong}`, padding:'32px', position:'relative' }}>
            <div style={{ display:'flex', alignItems:'center', gap:32, flexWrap:'wrap' }}>
              <div style={{ width:80, height:80, borderRadius:20, background:`linear-gradient(135deg, ${T.primary}, ${T.primaryDeep})`, display:'grid', placeItems:'center', color:T.onPrimary, flexShrink:0 }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 3v13"/><path d="m6 9 6-6 6 6"/><path d="M5 21h14"/></svg>
              </div>
              <div style={{ flex:1, minWidth:280 }}>
                <div style={{ fontSize:22, fontWeight:700, color:A.ink, letterSpacing:-0.3 }}>Ganti master Class V & G</div>
                <div style={{ fontSize:13, color:A.ink2, marginTop:6, lineHeight:1.5, maxWidth:520 }}>
                  Master ini menentukan Part mana yang masuk Kelas V (readiness) dan Kelas G (inquiry-able). Wajib diupload <b>sebelum</b> readiness harian agar sistem bisa cek Part Number-nya valid. Kolom: <span style={{ fontFamily:MONO, fontSize:11, background:A.surfaceAlt, padding:'2px 6px', borderRadius:4 }}>No, Stockcode, Part Number, Description, Mnemonic, Class</span>
                </div>
                <div style={{ marginTop:14, display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                  <button data-btn="primary" data-proto-link="true" onClick={() => flash('Master ter-update · 9.752 part dimuat', 'ok')} style={{ padding:'10px 18px', borderRadius:10, background:A.ink, color:'#fff', fontSize:13, fontWeight:700 }}>Pilih file Excel</button>
                  <button data-btn="ghost" style={{ padding:'10px 16px', borderRadius:10, background:A.surfaceAlt, color:A.ink, fontSize:12, fontWeight:600 }}>Download template</button>
                  <span style={{ fontSize:11, color:A.over, fontWeight:600 }}>⚠ Ini akan replace master saat ini</span>
                </div>
              </div>
            </div>
          </div>

          {/* Preview existing classification */}
          <div style={{ background:A.surface, borderRadius:18, border:`1px solid ${A.line}`, overflow:'visible' }}>
            <div style={{ padding:'18px 24px', borderBottom:`1px solid ${A.line}`, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:14 }}>
              <div>
                <div style={{ fontSize:11, color:A.ink2, fontWeight:600, letterSpacing:0.8, textTransform:'uppercase' }}>Sample Master Aktif</div>
                <div style={{ fontSize:16, fontWeight:700, color:A.ink, marginTop:2 }}>
                  {q.trim() ? <>Hasil pencarian · <span style={{ fontFamily:MONO, color:T.primaryDeep }}>{tableRows.length}</span> dari {allMaster.length} sample</>
                            : <>Preview {Math.min(12, tableRows.length)} baris pertama</>}
                </div>
              </div>
              <span style={{ fontSize:11, color:A.ink3 }}>Total master: {(meta.fullCountV + meta.fullCountG).toLocaleString('id-ID')} part</span>
            </div>

            {/* Autocomplete search bar — same vibe as Karyawan Plant */}
            <div style={{ padding:'14px 20px', display:'flex', alignItems:'center', gap:12, borderBottom:`1px solid ${A.line}`, flexWrap:'wrap' }}>
              <div ref={wrapRef} style={{ position:'relative', width:380, maxWidth:'100%' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 12px', background:A.bg, border:`1.5px solid ${open || q ? T.primary : A.line}`, borderRadius:10, transition:'border-color 0.15s ease' }}>
                  <span style={{ color: open || q ? T.primaryDeep : A.ink3, display:'flex' }}><Ic.search/></span>
                  <input
                    ref={inputRef}
                    value={q}
                    onChange={e=>{ setQ(e.target.value); setOpen(true); }}
                    onFocus={()=>setOpen(true)}
                    onKeyDown={onKey}
                    placeholder="Cari Part Number, deskripsi, mnemonic…"
                    style={{ border:'none', outline:'none', background:'transparent', flex:1, fontSize:13, color:A.ink, fontFamily: q ? MONO : FONT }}
                  />
                  {q && <button onClick={()=>{ setQ(''); inputRef.current?.focus(); }} style={{ color:A.ink3, display:'flex' }}><Ic.x/></button>}
                </div>

                {/* Floating dropdown of suggestions */}
                {open && q.trim() && (
                  <div style={{
                    position:'absolute', top:'calc(100% + 6px)', left:0, right:0, zIndex:30,
                    background:A.surface, border:`1px solid ${A.lineStrong}`, borderRadius:12,
                    boxShadow:'0 18px 48px rgba(27,24,20,0.18), 0 4px 12px rgba(27,24,20,0.06)',
                    overflow:'hidden', animation:'popIn 0.18s cubic-bezier(.2,.7,.3,1)',
                  }}>
                    {matches.length === 0 ? (
                      <div style={{ padding:'18px 16px', fontSize:12.5, color:A.ink3, textAlign:'center' }}>
                        Tidak ada part yang cocok dengan "<b style={{ color:A.ink2 }}>{q}</b>"
                        <div style={{ fontSize:11, marginTop:4, color:A.ink3 }}>Coba kata kunci lain, atau cek di master lengkap.</div>
                      </div>
                    ) : (
                      <>
                        <div style={{ padding:'8px 14px', fontSize:10, color:A.ink3, fontWeight:700, letterSpacing:0.8, textTransform:'uppercase', background:A.bg, borderBottom:`1px solid ${A.line}` }}>
                          {matches.length} saran · ↑↓ navigasi · Enter pilih
                        </div>
                        {matches.map((p, i) => {
                          const on = i === active;
                          return (
                            <div key={p.pn + i}
                              onMouseEnter={()=>setActive(i)}
                              onMouseDown={(ev)=>{ ev.preventDefault(); pickMatch(p); }}
                              style={{
                                display:'grid', gridTemplateColumns:'auto 1fr auto', gap:10, alignItems:'center',
                                padding:'10px 14px', cursor:'pointer',
                                background: on ? T.primarySoft : 'transparent',
                                borderTop: i === 0 ? 'none' : `1px solid ${A.line}`,
                                transition:'background-color 0.12s ease',
                              }}>
                              <Badge color={p.cls==='V'?A.green:A.honeyDeep} bg={p.cls==='V'?A.greenSoft:A.honeySoft} mono>{p.cls}</Badge>
                              <div style={{ minWidth:0 }}>
                                <div style={{ fontFamily:MONO, fontSize:12.5, fontWeight:700, color:A.ink, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{hi(p.pn)}</div>
                                <div style={{ fontSize:11, color:A.ink2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginTop:1 }}>{hi(p.desc)}</div>
                              </div>
                              <div style={{ fontSize:10, fontFamily:MONO, color:A.ink3, textAlign:'right', whiteSpace:'nowrap' }}>
                                <div>{p.prod}</div>
                                <div style={{ marginTop:1 }}>{p.comm}</div>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Class chip filter — V / G / all (mirror Karyawan posisi filter) */}
              <div style={{ display:'flex', gap:6 }}>
                {[['all','Semua',null],['V','Class V',A.green],['G','Class G',A.honey]].map(([k,l,c])=>{
                  const on = clsF === k;
                  return (
                    <button key={k} onClick={()=>setClsF(k)} style={{
                      padding:'7px 12px', borderRadius:999, fontSize:12, fontWeight:600,
                      background: on?A.ink:A.bg, color: on?'#fff':A.ink2,
                      border: on?'none':`1px solid ${A.line}`,
                      display:'flex', alignItems:'center', gap:6,
                    }}>
                      {c && <span style={{ width:6, height:6, borderRadius:'50%', background:c }}/>}
                      {l}
                    </button>
                  );
                })}
              </div>

              <div style={{ marginLeft:'auto', fontSize:12, color:A.ink2 }}>
                {tableRows.length} {q.trim() ? 'hasil' : 'baris'}
              </div>
            </div>

            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:A.bg, color:A.ink2, fontSize:11, letterSpacing:0.6, textTransform:'uppercase' }}>
                  <th style={{ textAlign:'left', padding:'10px 24px', fontWeight:600 }}>Part Number</th>
                  <th style={{ textAlign:'left', padding:'10px 16px', fontWeight:600 }}>Description</th>
                  <th style={{ textAlign:'left', padding:'10px 16px', fontWeight:600 }}>Mnemonic</th>
                  <th style={{ textAlign:'left', padding:'10px 16px', fontWeight:600 }}>Commodity</th>
                  <th style={{ textAlign:'right', padding:'10px 24px', fontWeight:600 }}>Class</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.length === 0 ? (
                  <tr><td colSpan="5" style={{ padding:'40px 24px', textAlign:'center', color:A.ink3 }}>
                    Tidak ada part di sample master yang cocok dengan "<b style={{ color:A.ink2 }}>{q}</b>".
                  </td></tr>
                ) : tableRows.map((p,i)=>(
                  <tr key={p.pn + i} style={{ borderTop:`1px solid ${A.line}` }}>
                    <td style={{ padding:'12px 24px', fontFamily:MONO, fontWeight:600, color:A.ink, fontSize:12.5 }}>{hi(p.pn)}</td>
                    <td style={{ padding:'12px 16px', color:A.ink, fontWeight:500 }}>{hi(p.desc)}</td>
                    <td style={{ padding:'12px 16px', color:A.ink2 }}>{hi(p.prod)}</td>
                    <td style={{ padding:'12px 16px', color:A.ink2, fontFamily:MONO }}>{hi(p.comm)}</td>
                    <td style={{ padding:'12px 24px', textAlign:'right' }}>
                      <Badge color={p.cls==='V'?A.green:A.honey} bg={p.cls==='V'?A.greenSoft:A.honeySoft} mono>{p.cls}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

// =============================================================
// 6. KARYAWAN — bulk upload + table management
// =============================================================
const Karyawan = ({ navigate, role='admin', site='AGMR', who, flash }) => {
  const T = themeFor(role);
  const allEmp = H.empBySite(site);
  const [showAdd, setShowAdd] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [posF, setPosF] = React.useState('all');

  const filtered = allEmp.filter(e => {
    if (posF !== 'all' && e.role !== posF) return false;
    if (q && !`${e.nrp} ${e.name}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="screen-fade" style={{ minHeight:'100vh', fontFamily:FONT, background:A.bg, color:A.ink, display:'flex' }}>
      <Sidebar role={role} active="karyawan" onNavigate={navigate} site={site}/>
      <main style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        <Topbar role={role} sub={`Admin ${site} · ${allEmp.length} karyawan terdaftar`} title="Karyawan Plant" user={`${who||'Rina'} · Admin ${site}`}/>
        <div style={{ padding:'24px 32px 80px', display:'flex', flexDirection:'column', gap:20 }}>

          {/* Stat row */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
            {[
              ['Total Karyawan', allEmp.length, T.primary, 'GL + Mekanik'],
              ['Group Leader', allEmp.filter(e=>e.role==='GL').length, A.indigo, 'roster shift'],
              ['Mekanik', allEmp.filter(e=>e.role==='Mekanik').length, A.coral, 'aktif lapangan'],
              ['Bulk Upload Terakhir', '20 Mei', A.honey, 'oleh Rina'],
            ].map(([l,v,c,sub],i)=>(
              <div key={i} style={{ background:A.surface, borderRadius:14, padding:'16px 18px', border:`1px solid ${A.line}`, position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:c }}/>
                <div style={{ fontSize:11, color:A.ink2, fontWeight:600, letterSpacing:0.6, textTransform:'uppercase' }}>{l}</div>
                <div style={{ fontSize:32, fontWeight:700, color:A.ink, marginTop:6, lineHeight:1, fontFamily:MONO, fontFeatureSettings:'"tnum"' }}>{v}</div>
                <div style={{ fontSize:11, color:A.ink3, marginTop:4 }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* Bulk upload zone */}
          <div style={{ background:A.surface, borderRadius:16, border:`1.5px dashed ${T.primary}`, padding:'24px 28px', display:'flex', alignItems:'center', gap:24, flexWrap:'wrap' }}>
            <div style={{ width:60, height:60, borderRadius:14, background:T.primarySoft, color:T.primaryDeep, display:'grid', placeItems:'center' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg>
            </div>
            <div style={{ flex:1, minWidth:280 }}>
              <div style={{ fontSize:17, fontWeight:700, color:A.ink, letterSpacing:-0.2 }}>Bulk upload data karyawan plant</div>
              <div style={{ fontSize:12, color:A.ink2, marginTop:4, lineHeight:1.5 }}>Format Excel: <span style={{ fontFamily:MONO, padding:'1px 5px', background:A.surfaceAlt, borderRadius:4 }}>NO, NRP, NAMA, POSISI</span> · semua yang di-upload otomatis terikat ke site <b style={{ color:T.primaryDeep }}>{site}</b>.</div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button data-btn="ghost" style={{ padding:'10px 14px', borderRadius:10, background:A.surfaceAlt, color:A.ink, fontSize:12, fontWeight:600 }}>Download template</button>
              <button data-btn="primary" data-proto-link="true" onClick={() => flash('Karyawan ter-upload · 18 baris baru', 'ok')} style={{ padding:'10px 18px', borderRadius:10, background:A.ink, color:'#fff', fontSize:12.5, fontWeight:700 }}>Pilih file Excel</button>
              <button data-btn="primary" data-proto-link="true" onClick={() => setShowAdd(true)} style={{ padding:'10px 14px', borderRadius:10, background:T.primary, color:T.onPrimary, fontSize:12.5, fontWeight:700, display:'flex', alignItems:'center', gap:6 }}><Ic.plus/> Tambah satu</button>
            </div>
          </div>

          {/* Filter + table */}
          <div style={{ background:A.surface, borderRadius:18, border:`1px solid ${A.line}`, overflow:'hidden' }}>
            <div style={{ padding:'16px 20px', display:'flex', alignItems:'center', gap:12, borderBottom:`1px solid ${A.line}` }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', background:A.bg, border:`1px solid ${A.line}`, borderRadius:10, width:280 }}>
                <Ic.search/>
                <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Cari nama atau NRP…" style={{ border:'none', outline:'none', background:'transparent', flex:1, fontSize:12.5, color:A.ink }}/>
              </div>
              <div style={{ display:'flex', gap:6 }}>
                {['all','GL','Mekanik'].map(k => {
                  const on = posF === k;
                  return (
                    <button key={k} onClick={()=>setPosF(k)} style={{
                      padding:'7px 12px', borderRadius:999, fontSize:12, fontWeight:600,
                      background: on?A.ink:A.bg, color: on?'#fff':A.ink2,
                      border: on?'none':`1px solid ${A.line}`,
                    }}>{k==='all'?'Semua':k}</button>
                  );
                })}
              </div>
              <div style={{ marginLeft:'auto', fontSize:12, color:A.ink2 }}>{filtered.length} dari {allEmp.length}</div>
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:A.bg, color:A.ink2, fontSize:11, letterSpacing:0.6, textTransform:'uppercase' }}>
                  <th style={{ textAlign:'left', padding:'10px 24px', fontWeight:600 }}>NRP</th>
                  <th style={{ textAlign:'left', padding:'10px 16px', fontWeight:600 }}>Nama</th>
                  <th style={{ textAlign:'left', padding:'10px 16px', fontWeight:600 }}>Posisi</th>
                  <th style={{ textAlign:'left', padding:'10px 16px', fontWeight:600 }}>Shift</th>
                  <th style={{ textAlign:'left', padding:'10px 16px', fontWeight:600 }}>Site</th>
                  <th style={{ textAlign:'right', padding:'10px 24px', fontWeight:600 }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan="6" style={{ padding:'40px 24px', textAlign:'center', color:A.ink3 }}>Tidak ada karyawan yang cocok.</td></tr>
                ) : filtered.map(e=>(
                  <tr key={e.nrp} style={{ borderTop:`1px solid ${A.line}` }}>
                    <td style={{ padding:'12px 24px', fontFamily:MONO, fontWeight:600, color:A.ink }}>{e.nrp}</td>
                    <td style={{ padding:'12px 16px', color:A.ink, fontWeight:600 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ width:30, height:30, borderRadius:'50%', background:A.surfaceAlt, color:A.ink, display:'grid', placeItems:'center', fontSize:11, fontWeight:700 }}>{e.name.split(' ').map(w=>w[0]).slice(0,2).join('')}</div>
                        {e.name}
                      </div>
                    </td>
                    <td style={{ padding:'12px 16px' }}>
                      <Badge color={e.role==='GL'?A.indigo:A.coral} bg={e.role==='GL'?A.indigoSoft:A.coralSoft}>{e.role}</Badge>
                    </td>
                    <td style={{ padding:'12px 16px', color:A.ink2 }}>{e.shift}</td>
                    <td style={{ padding:'12px 16px' }}><SiteBadge site={e.site}/></td>
                    <td style={{ padding:'12px 24px', textAlign:'right', color:A.ink3 }}><Ic.dot3/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <Modal open={showAdd} onClose={() => setShowAdd(false)}>
        <div style={{ padding:24 }}>
          <div style={{ fontSize:11, color:T.primaryDeep, fontWeight:700, letterSpacing:1, textTransform:'uppercase', marginBottom:6 }}>Tambah karyawan</div>
          <div style={{ fontSize:20, fontWeight:700, color:A.ink, marginBottom:18 }}>Karyawan baru · Site {site}</div>
          {[
            ['NRP', 'contoh: KM23119'],
            ['Nama Lengkap', 'Cahya Pratama'],
          ].map(([l,p])=>(
            <div key={l} style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, color:A.ink3, fontWeight:700, letterSpacing:0.6, textTransform:'uppercase', marginBottom:6 }}>{l}</div>
              <input placeholder={p} style={{ width:'100%', padding:'12px 14px', borderRadius:10, border:`1px solid ${A.lineStrong}`, fontSize:13, outline:'none', background:A.bg, fontFamily: l==='NRP'?MONO:FONT }}/>
            </div>
          ))}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:18 }}>
            <div>
              <div style={{ fontSize:11, color:A.ink3, fontWeight:700, letterSpacing:0.6, textTransform:'uppercase', marginBottom:6 }}>Posisi</div>
              <select style={{ width:'100%', padding:'12px 14px', borderRadius:10, border:`1px solid ${A.lineStrong}`, fontSize:13, background:A.bg, outline:'none', fontWeight:600 }}><option>Mekanik</option><option>GL</option></select>
            </div>
            <div>
              <div style={{ fontSize:11, color:A.ink3, fontWeight:700, letterSpacing:0.6, textTransform:'uppercase', marginBottom:6 }}>Shift</div>
              <select style={{ width:'100%', padding:'12px 14px', borderRadius:10, border:`1px solid ${A.lineStrong}`, fontSize:13, background:A.bg, outline:'none', fontWeight:600 }}><option>Pagi</option><option>Sore</option><option>Malam</option></select>
            </div>
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
            <button data-btn="ghost" onClick={() => setShowAdd(false)} style={{ padding:'10px 16px', borderRadius:10, fontSize:13, fontWeight:600, color:A.ink }}>Batal</button>
            <button data-btn="confirm" onClick={() => { setShowAdd(false); flash('Karyawan baru ditambahkan ke ' + site, 'ok'); }} style={{ padding:'10px 18px', borderRadius:10, background:T.primary, color:T.onPrimary, fontSize:13, fontWeight:800, display:'flex', alignItems:'center', gap:6 }}><Ic.check/> Simpan</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// =============================================================
// 7. ADMIN AKUN — change password / account info
// =============================================================
const AdminAkun = ({ navigate, role='admin', site='AGMR', who }) => {
  const T = themeFor(role);
  const [showChange, setShowChange] = React.useState(false);
  const acc = window.UT_ACCOUNTS.find(a => (role==='ut' ? a.role==='PIC UT' : a.site === site && a.role==='Admin Site')) || window.UT_ACCOUNTS[0];

  return (
    <div className="screen-fade" style={{ minHeight:'100vh', fontFamily:FONT, background:A.bg, color:A.ink, display:'flex' }}>
      <Sidebar role={role} active={role==='ut'?'ut-akun':'akun'} onNavigate={navigate} site={role==='ut'?undefined:site}/>
      <main style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        <Topbar role={role} sub="Keamanan & Akun" title="Akun & Password" user={`${who||acc.name} · ${acc.role}`}/>
        <div style={{ padding:'24px 32px 80px', maxWidth:760, display:'flex', flexDirection:'column', gap:18 }}>

          <div style={{ background:A.surface, borderRadius:18, border:`1px solid ${A.line}`, padding:28 }}>
            <div style={{ display:'flex', alignItems:'center', gap:20, marginBottom:18 }}>
              <div style={{ width:72, height:72, borderRadius:'50%', background:T.primary, color:T.onPrimary, display:'grid', placeItems:'center', fontSize:24, fontWeight:800 }}>{acc.name.split(' ').map(w=>w[0]).slice(0,2).join('')}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:22, fontWeight:800, color:A.ink, letterSpacing:-0.3 }}>{acc.name}</div>
                <div style={{ fontSize:13, color:A.ink2, marginTop:2 }}>{acc.role} · {acc.site === 'ALL' ? 'Semua site KPP' : 'Site ' + acc.site}</div>
                <div style={{ fontSize:11, color:A.ink3, marginTop:6, fontFamily:MONO }}>{acc.email}</div>
              </div>
              <Badge color={A.aman} bg={A.amanBg}>Aktif</Badge>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:1, background:A.line, borderRadius:12, overflow:'hidden', marginBottom:18 }}>
              {[
                ['Login terakhir', '21 Mei · 08:30'],
                ['Device aktif', 'Chrome · Mac'],
                ['Password diubah', '3 bulan yang lalu'],
              ].map(([l,v],i)=>(
                <div key={i} style={{ background:A.bg, padding:'14px 18px' }}>
                  <div style={{ fontSize:10, color:A.ink3, fontWeight:700, letterSpacing:0.6, textTransform:'uppercase' }}>{l}</div>
                  <div style={{ fontSize:13.5, fontWeight:700, color:A.ink, marginTop:3 }}>{v}</div>
                </div>
              ))}
            </div>

            <button data-btn="primary" data-proto-link="true" onClick={() => setShowChange(true)} style={{ padding:'12px 18px', borderRadius:10, background:A.ink, color:'#fff', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', gap:8 }}>
              <Ic.spark/> Ubah password
            </button>
          </div>

          <div style={{ background:A.surface, borderRadius:18, border:`1px solid ${A.line}`, padding:24 }}>
            <div style={{ fontSize:11, color:A.ink3, fontWeight:700, letterSpacing:0.6, textTransform:'uppercase', marginBottom:12 }}>Tips keamanan</div>
            <ul style={{ margin:0, padding:'0 0 0 18px', fontSize:13, color:A.ink2, lineHeight:1.8 }}>
              <li>Ganti password setiap 3 bulan minimal — sistem akan mengingatkan.</li>
              <li>Jangan share email/password ke kolega — buat akun baru lewat Super Admin.</li>
              <li>Akun Admin Site terikat ke 1 site. Pindah site = akun baru.</li>
              <li>PIC UT punya 1 akun global yang bisa filter view per-site KPP.</li>
            </ul>
          </div>
        </div>
      </main>

      {showChange && <ChangePwd onClose={() => setShowChange(false)} email={acc.email} theme={T}/>}
    </div>
  );
};

// =============================================================
// 8. INQUIRY LIST — site-aware (admin sees own site only)
// =============================================================
const InquiryList = ({ navigate, role='admin', site='AGMR', who }) => {
  const T = themeFor(role);
  const all = window.PROTO_ALL_INQUIRIES();
  const INQ = role === 'ut' ? all : all.filter(q => q.site === site);
  const [statusF, setStatusF] = React.useState('all');
  const filtered = INQ.filter(q => statusF==='all' ? true : q.status === statusF);
  const [activeId, setActiveId] = React.useState(filtered[0]?.id);
  const active = INQ.find(q => q.id === activeId) || filtered[0] || INQ[0];

  React.useEffect(() => { if (!INQ.find(q => q.id === activeId)) setActiveId(filtered[0]?.id); }, [statusF]);

  const counts = {
    all: INQ.length,
    PENDING: INQ.filter(q=>q.status==='PENDING').length,
    VALID: INQ.filter(q=>q.status==='VALID').length,
    INVALID: INQ.filter(q=>q.status==='INVALID').length,
  };

  return (
    <div className="screen-fade" style={{ minHeight:'100vh', fontFamily:FONT, background:A.bg, color:A.ink, display:'flex' }}>
      <Sidebar role={role} active="inquiry" onNavigate={navigate} site={site}/>
      <main style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        <Topbar role={role} sub={`Inquiry Kelas G · ${INQ.length} total`} title={`Antrian Inquiry ${role==='admin'?site:'· All Sites'}`} user={`${who||'Rina'} · Admin ${site}`}/>
        <div style={{ padding:'24px 32px 80px' }}>

          <div style={{ display:'flex', gap:8, marginBottom:18, alignItems:'center', flexWrap:'wrap' }}>
            {[
              ['all', 'Semua', null],
              ['PENDING', 'Pending UT', A.pending],
              ['VALID', 'Valid', A.tersedia],
              ['INVALID', 'Invalid · diganti', A.tidakAda],
            ].map(([k,l,c])=>{
              const on = statusF === k;
              return (
                <button key={k} onClick={()=>setStatusF(k)} style={{
                  padding:'8px 14px', borderRadius:999, fontSize:12.5, fontWeight:600,
                  background: on?A.ink:A.surface, color: on?'#fff':A.ink2,
                  border: on?'none':`1px solid ${A.line}`,
                  display:'flex', alignItems:'center', gap:8,
                }}>
                  {c && <span style={{ width:6, height:6, borderRadius:'50%', background:c }}/>}
                  {l} <span style={{ fontSize:11, opacity:0.7, fontFeatureSettings:'"tnum"' }}>{counts[k]}</span>
                </button>
              );
            })}
            <button data-btn="primary" style={{ marginLeft:'auto', padding:'8px 14px', borderRadius:10, background:T.primary, color:T.onPrimary, fontSize:12, fontWeight:700 }}>Export Excel</button>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 420px', gap:16 }}>
            <div style={{ background:A.surface, borderRadius:18, border:`1px solid ${A.line}`, overflow:'hidden' }}>
              <div style={{ display:'grid', gridTemplateColumns:'90px 1fr 80px 110px', gap:0, padding:'12px 20px', background:A.bg, fontSize:11, color:A.ink2, letterSpacing:0.6, textTransform:'uppercase', fontWeight:600 }}>
                <div>Tanggal</div><div>Part & Asal</div><div style={{ textAlign:'right' }}>Qty</div><div style={{ textAlign:'right' }}>Status</div>
              </div>
              {filtered.length === 0 ? <div style={{ padding:'40px', textAlign:'center', color:A.ink3 }}>Tidak ada inquiry pada filter ini.</div> : filtered.map(q=>{
                const on = activeId === q.id;
                return (
                  <div key={q.id} data-proto-link="true" onClick={() => setActiveId(q.id)} style={{
                    display:'grid', gridTemplateColumns:'90px 1fr 80px 110px', gap:0, padding:'14px 20px',
                    borderTop:`1px solid ${A.line}`, alignItems:'center',
                    background: on ? T.primarySoft : 'transparent',
                  }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:A.ink }}>{q.date.split(' ').slice(0,2).join(' ')}</div>
                      <div style={{ fontSize:10, color:A.ink3, fontFamily:MONO, marginTop:2 }}>{q.id}</div>
                    </div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:13.5, fontWeight:700, color:A.ink, marginBottom:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{q.part}</div>
                      <div style={{ fontSize:11, color:A.ink2, display:'flex', alignItems:'center', gap:6 }}><SiteBadge site={q.site}/> {q.by} · {q.role}</div>
                    </div>
                    <div style={{ textAlign:'right', fontFamily:MONO, fontWeight:700, color:A.ink, fontFeatureSettings:'"tnum"' }}>{q.qty}<span style={{ color:A.ink3, fontWeight:500, marginLeft:3 }}>pcs</span></div>
                    <div style={{ textAlign:'right' }}><InqBadge s={q.status}/></div>
                  </div>
                );
              })}
            </div>

            <aside style={{ background:A.surface, borderRadius:18, border:`1px solid ${A.line}`, padding:24, alignSelf:'start', position:'sticky', top:24 }}>
              {active ? (
                <>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                    <div style={{ display:'flex', gap:6 }}><InqBadge s={active.status}/><SiteBadge site={active.site}/></div>
                    <span style={{ fontSize:10, fontFamily:MONO, color:A.ink3 }}>{active.id}</span>
                  </div>
                  <div style={{ fontSize:20, fontWeight:700, color:A.ink, letterSpacing:-0.3, lineHeight:1.25, marginBottom:6 }}>{active.part}</div>
                  {active.pn && <div style={{ fontFamily:MONO, fontSize:12, color:A.ink2, marginBottom:6 }}>{active.pn}</div>}
                  <div style={{ fontSize:12, color:A.ink2, marginBottom:18 }}>{active.date} · untuk unit {active.unit}</div>

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:18 }}>
                    <div style={{ padding:'10px 12px', background:A.bg, borderRadius:10 }}>
                      <div style={{ fontSize:10, color:A.ink3, fontWeight:600, letterSpacing:0.6, textTransform:'uppercase' }}>Diajukan</div>
                      <div style={{ fontSize:13, fontWeight:700, color:A.ink, marginTop:2 }}>{active.by}</div>
                      <div style={{ fontSize:11, color:A.ink2, fontFamily:MONO }}>{active.nrp} · {active.role}</div>
                    </div>
                    <div style={{ padding:'10px 12px', background:A.bg, borderRadius:10 }}>
                      <div style={{ fontSize:10, color:A.ink3, fontWeight:600, letterSpacing:0.6, textTransform:'uppercase' }}>Qty diminta</div>
                      <div style={{ fontSize:22, fontWeight:700, color:A.ink, fontFamily:MONO, marginTop:2, lineHeight:1, fontFeatureSettings:'"tnum"' }}>{active.qty}<span style={{ fontSize:11, color:A.ink3, marginLeft:4, fontWeight:500 }}>pcs</span></div>
                    </div>
                  </div>

                  <div style={{ fontSize:11, color:A.ink3, fontWeight:600, letterSpacing:0.6, textTransform:'uppercase', marginBottom:6 }}>Catatan mekanik</div>
                  <div style={{ fontSize:12.5, color:A.ink, lineHeight:1.55, padding:12, background:A.bg, borderRadius:10, marginBottom:18 }}>"{active.notes || 'Tidak ada catatan tambahan.'}"</div>

                  {(active.status === 'VALID' || active.status === 'INVALID') && (
                    <>
                      <div style={{ fontSize:11, color:A.ink3, fontWeight:600, letterSpacing:0.6, textTransform:'uppercase', marginBottom:8 }}>Respond dari UT</div>
                      <div style={{ padding:14, background: active.status==='VALID'?A.tersediaBg:A.tidakAdaBg, borderRadius:10, marginBottom:14 }}>
                        {active.status === 'INVALID' && active.replacementPn && (
                          <div style={{ marginBottom:10, padding:'8px 10px', background:'rgba(255,255,255,0.6)', borderRadius:8 }}>
                            <div style={{ fontSize:10, color:A.tidakAda, fontWeight:700, letterSpacing:0.6, textTransform:'uppercase' }}>PN Pengganti</div>
                            <div style={{ fontSize:14, fontWeight:800, color:A.ink, fontFamily:MONO, marginTop:2 }}>{active.replacementPn}</div>
                            <div style={{ fontSize:11, color:A.ink2, marginTop:2 }}>{active.replacementDesc}</div>
                          </div>
                        )}
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                          <div style={{ fontSize:10, color:A.ink2, fontWeight:700, letterSpacing:0.6, textTransform:'uppercase' }}>Kode WH UT</div>
                          <Badge color={A.honeyDeep} bg={A.honeySoft} mono>{active.utSiteCode}</Badge>
                        </div>
                        <div style={{ fontSize:12.5, color:A.ink, lineHeight:1.55, marginTop:6, fontStyle:'italic' }}>"{active.utNote}"</div>
                        <div style={{ fontSize:11, color:A.ink3, marginTop:8 }}>— {active.respondedBy} · {active.respondedAt}</div>
                      </div>
                    </>
                  )}

                  {active.status === 'PENDING' && (
                    <div style={{ padding:'12px 14px', background:A.pendingBg, borderRadius:10, fontSize:12, color:A.pending, fontWeight:600, display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ width:8, height:8, borderRadius:'50%', background:A.pending }}/> Menunggu PIC UT merespond
                    </div>
                  )}
                </>
              ) : <div style={{ padding:'40px 0', color:A.ink3, textAlign:'center' }}>Pilih inquiry untuk melihat detail.</div>}
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
};

Object.assign(window, {
  PROTO_AdminDashboard: AdminDashboard,
  PROTO_Katalog: Katalog,
  PROTO_PartDetail: PartDetail,
  PROTO_UploadReadiness: UploadReadiness,
  PROTO_UploadMaster: UploadMaster,
  PROTO_Karyawan: Karyawan,
  PROTO_AdminAkun: AdminAkun,
  PROTO_InquiryList: InquiryList,
});
})();
