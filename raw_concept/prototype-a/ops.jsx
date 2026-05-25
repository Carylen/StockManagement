// =============================================================
// Prototype A — Ops screens: UT PIC + GL (desktop)
//   • UTInquiry — multi-site inbox + Valid/Invalid respond
//   • UTReadiness — read-only readiness viewer across all sites
//   • GLInquiry — GL melihat inquiry tim mekanik di site-nya
// =============================================================
(function(){
const A = window.PROTO_A, FONT = window.PROTO_FONT, MONO = window.PROTO_MONO;
const Ic = window.PROTO_Ic, Sidebar = window.PROTO_Sidebar, Topbar = window.PROTO_Topbar;
const StatusBadge = window.PROTO_StatusBadge, InqBadge = window.PROTO_InqBadge;
const SiteBadge = window.PROTO_SiteBadge, themeFor = window.PROTO_themeFor;
const Badge = window.PROTO_Badge, Gauge = window.PROTO_Gauge;
const H = window.UT_HELPERS;
const SITES = window.UT_SITES;
const WHS = window.UT_WAREHOUSES;

// =============================================================
// UT — Inquiry inbox & respond (multi-site)
// =============================================================
const UTInquiry = ({ navigate, flash, who }) => {
  const T = themeFor('ut');
  const all = window.PROTO_ALL_INQUIRIES();

  const [siteF, setSiteF] = React.useState('ALL');     // ALL | AGMR | RANT | SPUT
  const [statusF, setStatusF] = React.useState('PENDING');

  const visible = all.filter(q => {
    if (siteF !== 'ALL' && q.site !== siteF) return false;
    if (statusF !== 'all' && q.status !== statusF) return false;
    return true;
  });

  const [activeId, setActiveId] = React.useState(visible[0]?.id || all[0]?.id);
  const active = all.find(q => q.id === activeId) || visible[0] || all[0];

  // Respond form
  const [mode, setMode] = React.useState('VALID');         // VALID | INVALID
  const [utCode, setUtCode] = React.useState('RTT');
  const [replacePn, setReplacePn] = React.useState('');
  const [note, setNote] = React.useState('');

  React.useEffect(() => {
    // Reset form when active changes
    setMode('VALID');
    // Suggest UT WH closest to the requesting site
    const site = SITES.find(s => s.code === active?.site);
    setUtCode(site?.utWh?.[0] || 'RTT');
    setReplacePn('');
    setNote('');
  }, [activeId]);

  React.useEffect(() => {
    if (!visible.find(q => q.id === activeId)) setActiveId(visible[0]?.id || all[0]?.id);
  }, [siteF, statusF]);

  const counts = (sf) => {
    const set = sf==='all' ? all : all.filter(q => q.status === sf);
    return {
      ALL: set.length,
      AGMR: set.filter(q => q.site==='AGMR').length,
      RANT: set.filter(q => q.site==='RANT').length,
      SPUT: set.filter(q => q.site==='SPUT').length,
    };
  };
  const pendingPerSite = counts('PENDING');

  const submitRespond = () => {
    if (mode === 'VALID') {
      window.PROTO_RESPOND_VALID(active.id, utCode, note || `Tersedia di ${utCode}, siap dikirim.`);
      flash(`Respond VALID → ${active.site} · WH UT ${utCode}`, 'ok');
    } else {
      if (!replacePn) return;
      window.PROTO_RESPOND_INVALID(active.id, replacePn, utCode, note || `PN diganti dengan ${replacePn}, tersedia di ${utCode}.`);
      flash(`Respond INVALID → PN diganti ${replacePn} di ${utCode}`, 'warn');
    }
    const next = window.PROTO_ALL_INQUIRIES().filter(q => q.status === 'PENDING' && q.id !== active.id)[0];
    if (next) setActiveId(next.id);
  };

  const validPn = replacePn && window.UT_CLASS_MASTER.find(m => m.pn.toLowerCase() === replacePn.toLowerCase());

  const utFooter = (
    <div style={{ marginTop:'auto', padding:14, background:A.surface, borderRadius:14, border:`1px solid ${A.line}` }}>
      <div style={{ fontSize:11, color:A.ink3, fontWeight:600, letterSpacing:0.8, textTransform:'uppercase', marginBottom:6 }}>Workspace</div>
      <div style={{ fontSize:13, fontWeight:700, color:A.ink, marginBottom:2 }}>UT Rantau · PIC</div>
      <div style={{ fontSize:11, color:A.ink2 }}>Multi-site · 3 KPP</div>
      <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:6, fontSize:11, color:A.aman, fontWeight:600 }}>
        <span style={{ width:6, height:6, borderRadius:'50%', background:A.aman, boxShadow:`0 0 0 4px ${A.amanBg}` }}/> Online · sync OK
      </div>
    </div>
  );

  return (
    <div className="screen-fade" style={{ minHeight:'100vh', fontFamily:FONT, background:A.bg, color:A.ink, display:'flex' }}>
      <Sidebar role="ut" active="ut-inquiry" onNavigate={navigate} footer={utFooter} site="ALL"/>
      <main style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        <Topbar role="ut" sub="UT Rantau · PIC · multi-site inbox" title="Inquiry Masuk dari KPP" user={`${who||'Hendro'} · PIC UT`}/>
        <div style={{ padding:'24px 32px 80px' }}>

          {/* Site filter row */}
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14, flexWrap:'wrap' }}>
            <div style={{ fontSize:11, color:A.ink3, fontWeight:700, letterSpacing:0.6, textTransform:'uppercase' }}>Filter Site:</div>
            {[
              ['ALL', 'Semua Site KPP'],
              ['AGMR', 'AGMR'],
              ['RANT', 'RANT'],
              ['SPUT', 'SPUT'],
            ].map(([k,l])=>{
              const on = siteF === k;
              const c = pendingPerSite[k];
              return (
                <button key={k} onClick={()=>setSiteF(k)} style={{
                  padding:'8px 14px', borderRadius:999, fontSize:12.5, fontWeight:700,
                  background: on?A.ink:A.surface, color: on?'#fff':A.ink2,
                  border: on?'none':`1px solid ${A.line}`, display:'flex', alignItems:'center', gap:8,
                  fontFamily: k==='ALL'?FONT:MONO,
                }}>
                  {l} {c>0 && <span style={{ fontSize:10, padding:'1px 6px', borderRadius:6, background: on?T.primary:A.pendingBg, color: on?A.ink:A.pending, fontWeight:700, fontFamily:FONT }}>{c}</span>}
                </button>
              );
            })}
            <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
              <button data-btn="ghost" style={{ padding:'8px 14px', borderRadius:10, background:A.surface, border:`1px solid ${A.line}`, fontSize:12, color:A.ink, fontWeight:600, display:'flex', alignItems:'center', gap:6 }}><Ic.filter/> Periode</button>
              <button data-btn="primary" style={{ padding:'8px 14px', borderRadius:10, background:T.primary, color:A.ink, fontSize:12, fontWeight:700 }}>Export Excel</button>
            </div>
          </div>

          {/* Status chips */}
          <div style={{ display:'flex', gap:8, marginBottom:18, flexWrap:'wrap' }}>
            {[
              ['all', 'Semua', null],
              ['PENDING', 'Pending', A.pending],
              ['VALID', 'Valid', A.tersedia],
              ['INVALID', 'Invalid · diganti', A.tidakAda],
            ].map(([k,l,c])=>{
              const on = statusF === k;
              const list = k==='all' ? all : all.filter(q => q.status === k);
              const inScope = siteF==='ALL' ? list.length : list.filter(q => q.site===siteF).length;
              return (
                <button key={k} onClick={()=>setStatusF(k)} style={{
                  padding:'7px 14px', borderRadius:999, fontSize:12, fontWeight:600,
                  background: on?A.ink:A.surface, color: on?'#fff':A.ink2,
                  border: on?'none':`1px solid ${A.line}`, display:'flex', alignItems:'center', gap:8,
                }}>
                  {c && <span style={{ width:6, height:6, borderRadius:'50%', background:c }}/>}
                  {l} <span style={{ fontSize:11, opacity:0.7, fontFeatureSettings:'"tnum"' }}>{inScope}</span>
                </button>
              );
            })}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 440px', gap:16 }}>
            {/* List */}
            <div style={{ background:A.surface, borderRadius:18, border:`1px solid ${A.line}`, overflow:'hidden' }}>
              <div style={{ display:'grid', gridTemplateColumns:'80px 80px 1fr 70px 100px', gap:0, padding:'12px 20px', background:A.bg, fontSize:11, color:A.ink2, letterSpacing:0.6, textTransform:'uppercase', fontWeight:600 }}>
                <div>Site</div><div>Tanggal</div><div>Part & Asal</div><div style={{ textAlign:'right' }}>Qty</div><div style={{ textAlign:'right' }}>Status</div>
              </div>
              {visible.length === 0 ? <div style={{ padding:'40px', textAlign:'center', color:A.ink3 }}>Tidak ada inquiry pada filter ini.</div> : visible.map(q => {
                const on = activeId === q.id;
                return (
                  <div key={q.id} data-proto-link="true" onClick={() => setActiveId(q.id)} style={{
                    display:'grid', gridTemplateColumns:'80px 80px 1fr 70px 100px', gap:0, padding:'14px 20px',
                    borderTop:`1px solid ${A.line}`, alignItems:'center',
                    background: on ? T.primarySoft : 'transparent',
                  }}>
                    <div><SiteBadge site={q.site}/></div>
                    <div>
                      <div style={{ fontSize:12.5, fontWeight:700, color:A.ink }}>{q.date.split(' ').slice(0,2).join(' ')}</div>
                      <div style={{ fontSize:10, color:A.ink3, fontFamily:MONO, marginTop:2 }}>{q.id}</div>
                    </div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:13.5, fontWeight:700, color:A.ink, marginBottom:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{q.part}</div>
                      <div style={{ fontSize:11, color:A.ink2 }}>{q.pn ? <span style={{ fontFamily:MONO, marginRight:6 }}>{q.pn}</span> : null}{q.by} · {q.unit}</div>
                    </div>
                    <div style={{ textAlign:'right', fontFamily:MONO, fontWeight:700, color:A.ink, fontFeatureSettings:'"tnum"' }}>{q.qty}<span style={{ color:A.ink3, fontWeight:500, marginLeft:3 }}>pcs</span></div>
                    <div style={{ textAlign:'right' }}><InqBadge s={q.status}/></div>
                  </div>
                );
              })}
            </div>

            {/* Respond panel */}
            <aside style={{ background:A.surface, borderRadius:18, border:`1px solid ${A.line}`, padding:24, alignSelf:'start', position:'sticky', top:24 }}>
              {active ? (
                <>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                    <div style={{ display:'flex', gap:6 }}><InqBadge s={active.status}/><SiteBadge site={active.site}/></div>
                    <span style={{ fontSize:10, fontFamily:MONO, color:A.ink3 }}>{active.id}</span>
                  </div>
                  <div style={{ fontSize:18, fontWeight:700, color:A.ink, letterSpacing:-0.3, lineHeight:1.25, marginBottom:6 }}>{active.part}</div>
                  {active.pn && <div style={{ fontFamily:MONO, fontSize:12, color:A.ink2, marginBottom:6 }}>PN: {active.pn}</div>}
                  <div style={{ fontSize:12, color:A.ink2, marginBottom:18 }}>Diminta {active.date} · butuh {active.dateNeeded || '-'}</div>

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:18 }}>
                    <div style={{ padding:'10px 12px', background:A.bg, borderRadius:10 }}>
                      <div style={{ fontSize:10, color:A.ink3, fontWeight:600, letterSpacing:0.6, textTransform:'uppercase' }}>Diajukan oleh</div>
                      <div style={{ fontSize:13, fontWeight:700, color:A.ink, marginTop:2 }}>{active.by}</div>
                      <div style={{ fontSize:11, color:A.ink2, fontFamily:MONO }}>{active.nrp} · {active.role}</div>
                    </div>
                    <div style={{ padding:'10px 12px', background:A.bg, borderRadius:10 }}>
                      <div style={{ fontSize:10, color:A.ink3, fontWeight:600, letterSpacing:0.6, textTransform:'uppercase' }}>Qty · Unit</div>
                      <div style={{ fontSize:22, fontWeight:700, color:A.ink, fontFamily:MONO, marginTop:2, lineHeight:1, fontFeatureSettings:'"tnum"' }}>{active.qty}<span style={{ fontSize:11, color:A.ink3, marginLeft:4, fontWeight:500 }}>pcs</span></div>
                      <div style={{ fontSize:11, color:A.ink2, marginTop:2 }}>{active.unit}</div>
                    </div>
                  </div>

                  <div style={{ fontSize:11, color:A.ink3, fontWeight:600, letterSpacing:0.6, textTransform:'uppercase', marginBottom:6 }}>Catatan mekanik</div>
                  <div style={{ fontSize:12.5, color:A.ink, lineHeight:1.55, padding:12, background:A.bg, borderRadius:10, marginBottom:18 }}>"{active.notes || 'Tidak ada catatan.'}"</div>

                  {active.status === 'PENDING' ? (
                    <>
                      <div style={{ fontSize:11, color:A.ink3, fontWeight:600, letterSpacing:0.6, textTransform:'uppercase', marginBottom:8 }}>Respond — pilih satu</div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
                        {[
                          ['VALID',   'Valid · tersedia', A.tersedia, A.tersediaBg],
                          ['INVALID', 'Invalid · PN diganti', A.tidakAda, A.tidakAdaBg],
                        ].map(([k,l,c,b])=>{
                          const on = mode === k;
                          return (
                            <button key={k} onClick={()=>setMode(k)} style={{ padding:'12px 10px', borderRadius:10, fontSize:12.5, fontWeight:700,
                              background: on?b:A.surfaceAlt,
                              color: on?c:A.ink2,
                              border: on?`1.5px solid ${c}`:`1px solid ${A.line}`,
                              textAlign:'left',
                            }}>
                              <div>{l}</div>
                              <div style={{ fontSize:10.5, fontWeight:500, color: on?c:A.ink3, marginTop:2 }}>
                                {k==='VALID' ? 'Isi kode warehouse UT' : 'Isi PN pengganti + kode WH UT'}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {mode === 'INVALID' && (
                        <div style={{ marginBottom:12 }}>
                          <div style={{ fontSize:11, color:A.ink3, fontWeight:600, letterSpacing:0.6, textTransform:'uppercase', marginBottom:6 }}>Part Number pengganti *</div>
                          <input value={replacePn} onChange={e=>setReplacePn(e.target.value)} placeholder="contoh: 6212-31-2300" style={{ width:'100%', padding:'12px 14px', borderRadius:10, border:`1.5px solid ${replacePn?A.aman:A.lineStrong}`, background:A.bg, fontSize:13, color:A.ink, outline:'none', fontFamily:MONO, fontWeight:600 }}/>
                        </div>
                      )}

                      <div style={{ marginBottom:12 }}>
                        <div style={{ fontSize:11, color:A.ink3, fontWeight:600, letterSpacing:0.6, textTransform:'uppercase', marginBottom:6 }}>Kode Warehouse UT *</div>
                        <input value={utCode} onChange={e=>setUtCode(e.target.value.toUpperCase())} placeholder="contoh: RTT" maxLength={6} style={{ width:'100%', padding:'12px 14px', borderRadius:10, border:`1.5px solid ${utCode?A.aman:A.lineStrong}`, background:A.bg, fontSize:14, color:A.ink, outline:'none', fontFamily:MONO, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase' }}/>
                        <div style={{ marginTop:6, fontSize:11, color:A.ink3 }}>Ketik kode warehouse UT (mis. <b style={{ color:A.honeyDeep, fontFamily:MONO }}>{SITES.find(s => s.code===active.site)?.utWh?.[0]}</b> terdekat ke {active.site}).</div>
                      </div>

                      <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder={mode==='VALID' ? 'Catatan tambahan untuk KPP — ETA, kondisi…' : 'Alasan penggantian PN, kondisi stok…'} style={{ width:'100%', padding:10, border:`1px solid ${A.line}`, borderRadius:10, fontSize:12, color:A.ink, marginBottom:12, minHeight:60, resize:'vertical', fontFamily:FONT, background:A.bg, outline:'none' }}/>

                      <button data-btn="confirm" data-proto-link="true" onClick={submitRespond} disabled={!utCode || (mode==='INVALID' && !replacePn)} style={{
                        width:'100%', padding:'13px', borderRadius:10, color:'#fff', fontSize:13, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                        background: (!utCode || (mode==='INVALID'&&!replacePn)) ? A.surfaceAlt : mode==='VALID' ? A.aman : A.tidakAda,
                        cursor: (!utCode || (mode==='INVALID'&&!replacePn)) ? 'not-allowed' : 'pointer',
                      }}>
                        <Ic.check/> Kirim respond ke {active.site}
                      </button>
                    </>
                  ) : (
                    <div style={{ padding:14, background: active.status==='VALID'?A.tersediaBg:A.tidakAdaBg, borderRadius:10 }}>
                      <div style={{ fontSize:11, color:active.status==='VALID'?A.tersedia:A.tidakAda, fontWeight:700, letterSpacing:0.6, textTransform:'uppercase', marginBottom:6 }}>Sudah Direspond</div>
                      {active.status === 'INVALID' && active.replacementPn && (
                        <div style={{ marginBottom:10, padding:'8px 10px', background:'rgba(255,255,255,0.6)', borderRadius:8 }}>
                          <div style={{ fontSize:10, color:A.tidakAda, fontWeight:700, letterSpacing:0.6, textTransform:'uppercase' }}>PN Pengganti</div>
                          <div style={{ fontSize:13, fontWeight:800, color:A.ink, fontFamily:MONO, marginTop:2 }}>{active.replacementPn}</div>
                          <div style={{ fontSize:11, color:A.ink2, marginTop:2 }}>{active.replacementDesc}</div>
                        </div>
                      )}
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                        <span style={{ fontSize:10, color:A.ink2, fontWeight:700, letterSpacing:0.6, textTransform:'uppercase' }}>Kode WH UT</span>
                        <Badge color={A.honeyDeep} bg={A.honeySoft} mono>{active.utSiteCode}</Badge>
                      </div>
                      <div style={{ fontSize:12.5, color:A.ink, lineHeight:1.55, marginTop:6, fontStyle:'italic' }}>"{active.utNote}"</div>
                      <div style={{ fontSize:11, color:A.ink3, marginTop:8 }}>— {active.respondedBy} · {active.respondedAt}</div>
                    </div>
                  )}
                </>
              ) : <div style={{ padding:'40px 0', color:A.ink3, textAlign:'center' }}>Pilih inquiry untuk merespond.</div>}
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
};

// =============================================================
// UT — Readiness viewer (all sites consolidated, drill per site)
// =============================================================
const UTReadiness = ({ navigate, who }) => {
  const T = themeFor('ut');
  const [view, setView] = React.useState('consolidated'); // consolidated | AGMR | RANT | SPUT
  const [statusF, setStatusF] = React.useState('all');

  const all = view === 'consolidated'
    ? SITES.flatMap(s => window.UT_READINESS[s.code].map(p => ({ ...p, site:s.code })))
    : window.UT_READINESS[view].map(p => ({ ...p, site:view }));

  const filtered = all.filter(p => statusF === 'all' || H.statusOf(p) === statusF);

  const utFooter = (
    <div style={{ marginTop:'auto', padding:14, background:A.surface, borderRadius:14, border:`1px solid ${A.line}` }}>
      <div style={{ fontSize:11, color:A.ink3, fontWeight:600, letterSpacing:0.8, textTransform:'uppercase', marginBottom:6 }}>UT Workspace</div>
      <div style={{ fontSize:13, fontWeight:700, color:A.ink, marginBottom:2 }}>Konsolidasi 3 site KPP</div>
      <div style={{ fontSize:11, color:A.ink2 }}>data dari upload admin site</div>
    </div>
  );

  return (
    <div className="screen-fade" style={{ minHeight:'100vh', fontFamily:FONT, background:A.bg, color:A.ink, display:'flex' }}>
      <Sidebar role="ut" active="ut-readiness" onNavigate={navigate} footer={utFooter} site="ALL"/>
      <main style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        <Topbar role="ut" sub="UT Rantau · readiness viewer" title={view==='consolidated' ? 'Readiness · 3 Site' : `Readiness ${view}`} user={`${who||'Hendro'} · PIC UT`}/>
        <div style={{ padding:'24px 32px 80px' }}>

          {/* View toggle */}
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:18, flexWrap:'wrap' }}>
            <div style={{ fontSize:11, color:A.ink3, fontWeight:700, letterSpacing:0.6, textTransform:'uppercase', marginRight:6 }}>View:</div>
            {[
              ['consolidated', 'Konsolidasi 3 site', '🌐'],
              ['AGMR', 'AGMR', null],
              ['RANT', 'RANT', null],
              ['SPUT', 'SPUT', null],
            ].map(([k,l,emo])=>{
              const on = view === k;
              return (
                <button key={k} onClick={() => setView(k)} style={{
                  padding:'8px 14px', borderRadius:999, fontSize:12.5, fontWeight:700,
                  background: on?A.ink:A.surface, color: on?'#fff':A.ink2,
                  border: on?'none':`1px solid ${A.line}`, fontFamily: k==='consolidated'?FONT:MONO,
                }}>{emo && <span style={{ marginRight:4 }}>{emo}</span>}{l}</button>
              );
            })}
            <div style={{ marginLeft:'auto', fontSize:12, color:A.ink2 }}>
              <b style={{ color:A.ink, fontFamily:MONO }}>{filtered.length}</b> baris {view==='consolidated' ? 'dari 3 site' : `· ${view}`}
            </div>
          </div>

          {/* Per-site summary cards (consolidated only) */}
          {view === 'consolidated' && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:18 }}>
              {SITES.map(s => {
                const sum = H.summary(window.UT_READINESS[s.code]);
                return (
                  <div key={s.code} data-proto-link="true" onClick={() => setView(s.code)} style={{ background:A.surface, borderRadius:14, border:`1px solid ${A.line}`, padding:18, position:'relative', overflow:'hidden' }}>
                    <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:T.primary }}/>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
                      <div>
                        <SiteBadge site={s.code}/>
                        <div style={{ fontSize:14, fontWeight:700, color:A.ink, marginTop:6 }}>{s.name}</div>
                      </div>
                      <span style={{ fontSize:10, color:A.ink3, fontFamily:MONO }}>WH {s.utWh.join(' + ')}</span>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6 }}>
                      {[['Total', sum.total, A.ink],['Aman', sum.AMAN, A.aman],['Warn', sum.WARNING, A.warn],['MIN%', sum.min_pct+'%', T.primaryDeep]].map(([l,v,c],i)=>(
                        <div key={i} style={{ padding:'8px 10px', background:A.bg, borderRadius:8 }}>
                          <div style={{ fontSize:9.5, color:A.ink3, fontWeight:700, letterSpacing:0.4, textTransform:'uppercase' }}>{l}</div>
                          <div style={{ fontSize:18, fontWeight:700, color:c, fontFamily:MONO, marginTop:2, fontFeatureSettings:'"tnum"' }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Status filter */}
          <div style={{ display:'flex', gap:6, marginBottom:14 }}>
            {[
              ['all','Semua'],['WARNING','Warning',A.warn],['AMAN','Aman',A.aman],['OVER','Over',A.over]
            ].map(([k,l,c]) => {
              const on = statusF === k;
              return (
                <button key={k} onClick={() => setStatusF(k)} style={{ padding:'7px 12px', borderRadius:999, fontSize:11.5, fontWeight:600,
                  background: on?A.ink:A.surface, color: on?'#fff':A.ink2, border: on?'none':`1px solid ${A.line}`, display:'flex', alignItems:'center', gap:6 }}>
                  {c && <span style={{ width:6, height:6, borderRadius:'50%', background:c }}/>}{l}
                </button>
              );
            })}
          </div>

          {/* Table */}
          <div style={{ background:A.surface, borderRadius:18, border:`1px solid ${A.line}`, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:A.bg, color:A.ink2, fontSize:11, letterSpacing:0.6, textTransform:'uppercase' }}>
                  <th style={{ textAlign:'left', padding:'12px 24px', fontWeight:600 }}>Site</th>
                  <th style={{ textAlign:'left', padding:'12px 16px', fontWeight:600 }}>Part Number</th>
                  <th style={{ textAlign:'left', padding:'12px 16px', fontWeight:600 }}>Description</th>
                  <th style={{ textAlign:'right', padding:'12px 16px', fontWeight:600 }}>MIN</th>
                  <th style={{ textAlign:'right', padding:'12px 16px', fontWeight:600 }}>MAX</th>
                  <th style={{ textAlign:'right', padding:'12px 16px', fontWeight:600 }}>RTT</th>
                  <th style={{ textAlign:'right', padding:'12px 16px', fontWeight:600 }}>TBD</th>
                  <th style={{ textAlign:'right', padding:'12px 16px', fontWeight:600 }}>Total</th>
                  <th style={{ textAlign:'right', padding:'12px 16px', fontWeight:600 }}>Estimasi</th>
                  <th style={{ textAlign:'right', padding:'12px 24px', fontWeight:600 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 50).map((p,i)=>(
                  <tr key={i} style={{ borderTop:`1px solid ${A.line}` }}>
                    <td style={{ padding:'12px 24px' }}><SiteBadge site={p.site}/></td>
                    <td style={{ padding:'12px 16px', fontFamily:MONO, fontWeight:600, color:A.ink, fontSize:12.5 }}>{p.pn}</td>
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
                {filtered.length > 50 && (
                  <tr><td colSpan="10" style={{ padding:'14px 24px', textAlign:'center', color:A.ink3, fontSize:12 }}>… {filtered.length - 50} baris lainnya · pakai filter untuk mempersempit</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

// =============================================================
// GL — Inquiry tim mekanik di site GL (no approval, view only)
// =============================================================
const GLInquiry = ({ navigate, site='AGMR', who }) => {
  const T = themeFor('gl');
  const all = window.PROTO_ALL_INQUIRIES().filter(q => q.site === site);
  const team = H.empBySite(site).filter(e => e.role === 'Mekanik');
  const [activeId, setActiveId] = React.useState(all[0]?.id);
  const active = all.find(q => q.id === activeId) || all[0];

  return (
    <div className="screen-fade" style={{ minHeight:'100vh', fontFamily:FONT, background:A.bg, color:A.ink, display:'flex' }}>
      <Sidebar role="gl" active="gl-inquiry" onNavigate={navigate} site={site}/>
      <main style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        <Topbar role="gl" sub={`Group Leader · Site ${site}`} title={`Inquiry tim mekanik ${site}`} user={`${who||'Yusuf'} · Group Leader`}/>
        <div style={{ padding:'24px 32px 80px' }}>

          {/* Summary */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:18 }}>
            {[
              ['Tim Mekanik', team.length, T.primary, 'aktif di '+site],
              ['Inquiry minggu ini', all.length, A.honey, 'Class G'],
              ['Pending UT', all.filter(q=>q.status==='PENDING').length, A.pending, 'menunggu respond'],
              ['Sudah dijawab', all.filter(q=>q.status!=='PENDING').length, A.aman, 'valid + invalid'],
            ].map(([l,v,c,sub],i)=>(
              <div key={i} style={{ background:A.surface, borderRadius:14, border:`1px solid ${A.line}`, padding:'16px 18px', position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:c }}/>
                <div style={{ fontSize:11, color:A.ink2, fontWeight:600, letterSpacing:0.6, textTransform:'uppercase' }}>{l}</div>
                <div style={{ fontSize:30, fontWeight:700, color:A.ink, fontFamily:MONO, marginTop:6, lineHeight:1, fontFeatureSettings:'"tnum"' }}>{v}</div>
                <div style={{ fontSize:11, color:A.ink3, marginTop:4 }}>{sub}</div>
              </div>
            ))}
          </div>

          <div style={{ background:T.primarySoft, borderRadius:12, padding:'12px 16px', marginBottom:18, fontSize:12, color:A.ink, lineHeight:1.5 }}>
            <b style={{ color:T.primaryDeep }}>GL view · read only.</b> Sejak v2.0, inquiry mekanik langsung dikirim ke UT (tanpa step approval). Kamu bisa pantau status & bantu eskalasi kalau ada yang lama tidak direspond.
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 400px', gap:16 }}>
            <div style={{ background:A.surface, borderRadius:18, border:`1px solid ${A.line}`, overflow:'hidden' }}>
              <div style={{ display:'grid', gridTemplateColumns:'90px 1fr 80px 110px', gap:0, padding:'12px 20px', background:A.bg, fontSize:11, color:A.ink2, letterSpacing:0.6, textTransform:'uppercase', fontWeight:600 }}>
                <div>Tanggal</div><div>Part & Mekanik</div><div style={{ textAlign:'right' }}>Qty</div><div style={{ textAlign:'right' }}>Status</div>
              </div>
              {all.length === 0 ? (
                <div style={{ padding:'60px 24px', textAlign:'center', color:A.ink3 }}>Belum ada inquiry dari tim {site}.</div>
              ) : all.map(q => {
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
                      <div style={{ fontSize:11, color:A.ink2 }}>{q.by} · {q.unit}</div>
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
                    <InqBadge s={active.status}/>
                    <span style={{ fontSize:10, fontFamily:MONO, color:A.ink3 }}>{active.id}</span>
                  </div>
                  <div style={{ fontSize:20, fontWeight:700, color:A.ink, letterSpacing:-0.3, lineHeight:1.25, marginBottom:6 }}>{active.part}</div>
                  {active.pn && <div style={{ fontFamily:MONO, fontSize:12, color:A.ink2, marginBottom:6 }}>{active.pn}</div>}
                  <div style={{ fontSize:12, color:A.ink2, marginBottom:18 }}>Diminta {active.date} · butuh {active.dateNeeded}</div>

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:18 }}>
                    <div style={{ padding:'10px 12px', background:A.bg, borderRadius:10 }}>
                      <div style={{ fontSize:10, color:A.ink3, fontWeight:600, letterSpacing:0.6, textTransform:'uppercase' }}>Mekanik</div>
                      <div style={{ fontSize:13, fontWeight:700, color:A.ink, marginTop:2 }}>{active.by}</div>
                      <div style={{ fontSize:11, color:A.ink2, fontFamily:MONO }}>{active.nrp}</div>
                    </div>
                    <div style={{ padding:'10px 12px', background:A.bg, borderRadius:10 }}>
                      <div style={{ fontSize:10, color:A.ink3, fontWeight:600, letterSpacing:0.6, textTransform:'uppercase' }}>Qty · Unit</div>
                      <div style={{ fontSize:22, fontWeight:700, color:A.ink, fontFamily:MONO, marginTop:2, lineHeight:1, fontFeatureSettings:'"tnum"' }}>{active.qty}</div>
                      <div style={{ fontSize:11, color:A.ink2 }}>{active.unit}</div>
                    </div>
                  </div>

                  <div style={{ fontSize:11, color:A.ink3, fontWeight:600, letterSpacing:0.6, textTransform:'uppercase', marginBottom:6 }}>Justifikasi mekanik</div>
                  <div style={{ fontSize:12.5, color:A.ink, lineHeight:1.55, padding:12, background:A.bg, borderRadius:10, marginBottom:18, fontStyle:'italic' }}>"{active.notes}"</div>

                  {(active.status === 'VALID' || active.status === 'INVALID') ? (
                    <div style={{ padding:14, background: active.status==='VALID'?A.tersediaBg:A.tidakAdaBg, borderRadius:10 }}>
                      <div style={{ fontSize:11, color:active.status==='VALID'?A.tersedia:A.tidakAda, fontWeight:700, letterSpacing:0.6, textTransform:'uppercase', marginBottom:6 }}>Respond UT</div>
                      {active.replacementPn && (
                        <div style={{ marginBottom:10, padding:'8px 10px', background:'rgba(255,255,255,0.6)', borderRadius:8 }}>
                          <div style={{ fontSize:10, color:A.tidakAda, fontWeight:700, letterSpacing:0.6, textTransform:'uppercase' }}>PN Pengganti</div>
                          <div style={{ fontSize:13, fontWeight:800, color:A.ink, fontFamily:MONO, marginTop:2 }}>{active.replacementPn}</div>
                          <div style={{ fontSize:11, color:A.ink2, marginTop:2 }}>{active.replacementDesc}</div>
                        </div>
                      )}
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:10, color:A.ink2, fontWeight:700, letterSpacing:0.6, textTransform:'uppercase' }}>Kode WH UT</span>
                        <Badge color={A.honeyDeep} bg={A.honeySoft} mono>{active.utSiteCode}</Badge>
                      </div>
                      <div style={{ fontSize:12.5, color:A.ink, lineHeight:1.55, marginTop:8, fontStyle:'italic' }}>"{active.utNote}"</div>
                    </div>
                  ) : (
                    <div style={{ padding:'12px 14px', background:A.pendingBg, borderRadius:10, fontSize:12, color:A.pending, fontWeight:600, display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ width:8, height:8, borderRadius:'50%', background:A.pending }}/> Menunggu PIC UT merespond. Eskalasi via WhatsApp jika &gt; 3 hari kerja.
                    </div>
                  )}
                </>
              ) : <div style={{ padding:'40px 0', color:A.ink3, textAlign:'center' }}>Pilih inquiry untuk lihat detail.</div>}
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
};

Object.assign(window, {
  PROTO_UTInquiry: UTInquiry,
  PROTO_UTReadiness: UTReadiness,
  PROTO_GLInquiry: GLInquiry,
});
})();
