/* Bids.jsx */
import { useState } from 'react';
import { X } from 'lucide-react';
import { formatCurrency } from '../utils/formatting.js';
import Badge from '../components/common/Badge.jsx';

const MOCK_IPOS = [
  { id:'ipo1', company:'QuantumTech Solutions', symbol:'QUANTECH', price:'C 420–440', lot:34, rating:'⭐⭐⭐⭐⭐', gmpPct:'+22%', closeDate:'2026-07-22', sector:'IT', description:'AI-driven SaaS platform for enterprise automation.' },
  { id:'ipo2', company:'GreenStar Infra',       symbol:'GREENSTAR', price:'C 180–195', lot:77, rating:'⭐⭐⭐⭐', gmpPct:'+15%', closeDate:'2026-07-23', sector:'Infra', description:'Renewable energy infrastructure developer.' },
  { id:'ipo3', company:'RapiMed Pharma',         symbol:'RAPIDMED',  price:'C 310–325', lot:46, rating:'⭐⭐⭐⭐', gmpPct:'+8%',  closeDate:'2026-07-24', sector:'Pharma', description:'Specialty pharma and biosimilars manufacturer.' },
];

const MOCK_AUCTIONS = [
  { id:'auc1', instrument:'POWERGRID - 2026 SGS', type:'T-Bill', faceValue:'C 100', coupon:'7.15%', maturity:'2026-12-31', minBid:'C 10,000', status:'OPEN' },
  { id:'auc2', instrument:'NTPC 5Y Bond',          type:'Bond',  faceValue:'C 1,000', coupon:'7.80%', maturity:'2031-07-20', minBid:'C 50,000', status:'OPEN' },
  { id:'auc3', instrument:'91-Day T-Bill',          type:'T-Bill',faceValue:'C 100', coupon:'6.95%', maturity:'2026-10-15', minBid:'C 25,000', status:'CLOSED' },
];

const GOVT_BONDS = [
  { name:'GoI 10Y Bond', coupon:'7.26%', maturity:'2033-04-06', price:'C 101.25', ytm:'7.08%' },
  { name:'GoI 5Y Bond',  coupon:'7.10%', maturity:'2029-01-14', price:'C 100.80', ytm:'6.94%' },
  { name:'SDSL 7Y Bond', coupon:'7.45%', maturity:'2030-11-25', price:'C 102.10', ytm:'7.18%' },
];

function IPOModal({ ipo, onClose }) {
  const [lots, setLots] = useState(1);
  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="glass-card modal-enter" style={{ width:'100%', maxWidth:440, padding:'var(--space-xl)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'var(--space-md)' }}>
          <h2 style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:18 }}>{ipo.company} IPO</h2>
          <button className="btn-icon" onClick={onClose}><X size={18}/></button>
        </div>
        <div className="alert alert-info" style={{ marginBottom:'var(--space-md)', fontSize:12 }}>
          IPO applications in CONE are simulated. Allotment is based on mock lottery.
        </div>
        {[['Price Band', ipo.price], ['Lot Size', `${ipo.lot} shares`], ['GMP', ipo.gmpPct], ['Close Date', ipo.closeDate], ['Sector', ipo.sector]].map(([k,v]) => (
          <div key={k} style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:8 }}>
            <span style={{ color:'var(--text-muted)' }}>{k}</span><span style={{ fontWeight:600 }}>{v}</span>
          </div>
        ))}
        <div className="divider"/>
        <div className="input-group" style={{ marginBottom:'var(--space-md)' }}>
          <label className="input-label">Number of Lots</label>
          <input className="input" type="number" min="1" value={lots} onChange={e => setLots(Math.max(1, parseInt(e.target.value)||1))}/>
        </div>
        <button className="btn btn-primary btn-full">Apply for {lots} Lot{lots>1?'s':''} (Simulated)</button>
      </div>
    </div>
  );
}

export default function Bids() {
  const [tab, setTab] = useState('IPO');
  const [selectedIpo, setSelectedIpo] = useState(null);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-md)' }}>
      {selectedIpo && <IPOModal ipo={selectedIpo} onClose={() => setSelectedIpo(null)}/>}

      <div className="glass-card" style={{ padding:'0 var(--space-md)' }}>
        <div className="tab-bar" style={{ marginBottom:0 }}>
          {['IPO','Auctions','Govt. Securities'].map(t => (
            <button key={t} className={`tab-item${tab===t?' active':''}`} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>
      </div>

      {/* IPO */}
      {tab === 'IPO' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-md)' }}>
          <div className="alert alert-info" style={{ fontSize:12 }}>
            IPO applications are simulated. No real money involved.
          </div>
          {MOCK_IPOS.map(ipo => (
            <div key={ipo.id} className="glass-card hoverable" style={{ padding:'var(--space-md)' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'var(--space-md)' }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:16, fontWeight:700 }}>{ipo.company}</span>
                    <span style={{ fontSize:11, padding:'2px 8px', background:'rgba(139,92,246,0.15)', borderRadius:'var(--radius-full)', color:'var(--accent-primary)', fontWeight:600 }}>{ipo.symbol}</span>
                  </div>
                  <div style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:8 }}>{ipo.description}</div>
                  <div style={{ display:'flex', gap:'var(--space-lg)', flexWrap:'wrap' }}>
                    {[['Price', ipo.price], ['Lot', `${ipo.lot} shares`], ['GMP', ipo.gmpPct], ['Closes', ipo.closeDate], ['Rating', ipo.rating]].map(([k,v]) => (
                      <div key={k}>
                        <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase' }}>{k}</div>
                        <div style={{ fontSize:13, fontWeight:600, marginTop:2, color: k==='GMP' ? 'var(--color-buy)' : 'var(--text-primary)' }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <button className="btn btn-primary" onClick={() => setSelectedIpo(ipo)}>Apply</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Auctions */}
      {tab === 'Auctions' && (
        <div className="glass-card" style={{ padding:'var(--space-md)' }}>
          <div className="section-title" style={{ marginBottom:'var(--space-md)' }}>T-Bill & Bond Auctions</div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead><tr><th>Instrument</th><th>Type</th><th>Coupon</th><th>Maturity</th><th>Min Bid</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {MOCK_AUCTIONS.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontWeight:600 }}>{a.instrument}</td>
                    <td><Badge type="CNC">{a.type}</Badge></td>
                    <td style={{ color:'var(--color-buy)', fontWeight:600 }}>{a.coupon}</td>
                    <td style={{ fontSize:12, color:'var(--text-muted)' }}>{a.maturity}</td>
                    <td>{a.minBid}</td>
                    <td><Badge type={a.status}>{a.status}</Badge></td>
                    <td><button className="btn btn-primary btn-sm" disabled={a.status==='CLOSED'}>Bid</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Govt Securities */}
      {tab === 'Govt. Securities' && (
        <div className="glass-card" style={{ padding:'var(--space-md)' }}>
          <div className="section-title" style={{ marginBottom:'var(--space-md)' }}>Government Securities</div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead><tr><th>Bond</th><th>Coupon</th><th>Maturity</th><th className="col-right">Price</th><th className="col-right">YTM</th></tr></thead>
              <tbody>
                {GOVT_BONDS.map(b => (
                  <tr key={b.name}>
                    <td style={{ fontWeight:600 }}>{b.name}</td>
                    <td style={{ color:'var(--color-buy)', fontWeight:600 }}>{b.coupon}</td>
                    <td style={{ fontSize:12, color:'var(--text-muted)' }}>{b.maturity}</td>
                    <td className="col-right" style={{ fontFamily:"'Space Grotesk',monospace" }}>{b.price}</td>
                    <td className="col-right" style={{ color:'var(--accent-primary)', fontWeight:600 }}>{b.ytm}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
