import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Star, Plus, ChevronDown, ChevronRight, MoreHorizontal, AlignJustify, BarChart2, Trash2, Pin, X, GripVertical, Maximize2, Minimize2 } from 'lucide-react';
import { useMarket } from '../context/MarketContext.jsx';
import { usePortfolio } from '../context/PortfolioContext.jsx';
import CandlestickChart from '../components/charts/CandlestickChart.jsx';
import ReplayControls from '../components/trading/ReplayControls.jsx';
import MarketDepth from '../components/trading/MarketDepth.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { fmtPrice, formatNumber } from '../utils/formatting.js';
import './Market.css';
import { useMarketInterest } from '../hooks/useMarketInterest.js';

function MoveChoices({items,onSelect,label="Move to watchlist"}) {
 const [open,setOpen]=useState(false);
 return <div className="move-choices"><button onClick={()=>setOpen(!open)} aria-expanded={open}>{label} <ChevronRight size={12}/></button>{open && <div className="move-destinations"><button onClick={()=>setOpen(false)}>‹ Back</button>{items.length?items.map(w=><button key={w.id} onClick={e=>{onSelect(w.id);setOpen(false);e.currentTarget.closest('details')?.removeAttribute('open');}}>{w.name}</button>):<span>No other watchlists</span>}</div>}</div>;
}
function WatchRow({ stock, price, pinned, groups, groupId, onPin, onMove, onRemove, onTrade, onDrag, onDrop, onShift, watchlists, onWorkspace, onChart, onDragOver }) {
  const [menu,setMenu]=useState(false),[depth,setDepth]=useState(false);
  const row=useRef(null);
  useEffect(()=>{const close=e=>{if(!row.current?.contains(e.target))setMenu(false);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[]);
  const symbol=stock.tradingsymbol;
  return <div ref={row} onDragOver={onDragOver} onDrop={onDrop} className={`watch-stock${menu?' menu-open':''}`} onKeyDown={e=>{if(e.key==='Escape'){setMenu(false);setDepth(false);}}}>
    <div className="watch-stock-line" onClick={e=>{if(!e.target.closest('button, a, [draggable]'))onChart(stock.instrumentKey);}}>
      <span className="drag-handle" draggable onDragStart={onDrag} role="button" tabIndex={0} aria-label={`Drag ${symbol}`}><GripVertical size={12}/></span>
      <button className="watch-stock-symbol" onClick={()=>onChart(stock.instrumentKey)}>{pinned && <Pin size={10}/>}<span>{symbol}</span><small>{stock.exchange}</small></button>
      <div className="watch-stock-price"><span className={price?.changePercent>=0?'text-up':'text-down'}>{price ? `${price.changePercent>=0?'+':''}${price.changePercent.toFixed(2)}%`:'—'}</span><strong>{price?fmtPrice(price.ltp):'—'}</strong></div>
      <div className="watch-stock-actions" aria-label={`${symbol} actions`}>
        <button className="btn btn-buy btn-sm" aria-label={`Buy ${symbol}`} title="Buy" disabled={stock.tradable===false || (stock.segment==='INDICES'||stock.segment.endsWith('INDEX'))} onClick={()=>onTrade('BUY')}>B</button>
        <button className="btn btn-sell btn-sm" aria-label={`Sell ${symbol}`} title="Sell" disabled={stock.tradable===false || (stock.segment==='INDICES'||stock.segment.endsWith('INDEX'))} onClick={()=>onTrade('SELL')}>S</button>
        <button className="watch-action" aria-label={`Market depth ${symbol}`} title="Market depth" aria-expanded={depth} onClick={()=>setDepth(v=>!v)}><AlignJustify size={14}/></button>
        <button className="watch-action" aria-label={`Chart ${symbol}`} title="Chart" onClick={()=>onChart(stock.instrumentKey)}><BarChart2 size={14}/></button>
        <button className="watch-action" aria-label={`Remove ${symbol} from watchlist`} title="Remove" onClick={onRemove}><Trash2 size={13}/></button>
        <button className="watch-action" aria-label={`More ${symbol}`} title="More" aria-expanded={menu} onClick={()=>setMenu(v=>!v)}><MoreHorizontal size={15}/></button>
      </div>
    </div>
    {menu && <div className="watch-row-menu"><button onClick={()=>{onPin();setMenu(false);}}>{pinned?'Unpin':'Pin to top'}</button><button onClick={()=>{onShift(-1);setMenu(false);}}>Move up</button><button onClick={()=>{onShift(1);setMenu(false);}}>Move down</button><button onClick={()=>onChart(stock.instrumentKey)}>Chart</button><button onClick={()=>{setDepth(v=>!v);setMenu(false);}}>Market depth</button><MoveChoices items={watchlists} onSelect={id=>{onWorkspace(id);setMenu(false);}}/><MoveChoices label="Move to group" items={[{id:'',name:'Default'},...groups].filter(g=>g.id!==(groupId||''))} onSelect={id=>{onMove(id);setMenu(false);}}/><button className="menu-remove" onClick={onRemove}><Trash2 size={13}/>Remove stock</button></div>}
    {depth && <div className="watch-depth"><MarketDepth instrumentKey={stock.instrumentKey}/></div>}
  </div>;
}

export default function Market() {
  const {instruments,prices}=useMarket();
  const {settings}=useSettings();const navigate=useNavigate();
  const screenerEnabled=settings.showStockScreener!==false,chartEnabled=settings.showMarketChart!==false;
  const {watchlists,updateWatchlist,createWatchlist,openOrderModal,moveWatchlistItem}=usePortfolio();
  const searchInput=useRef(null), searchPanel=useRef(null);
  useEffect(()=>{
    const close=e=>{if(!searchPanel.current?.contains(e.target))setSearchOpen(false);document.querySelectorAll('.group-options[open]').forEach(el=>{if(!el.contains(e.target))el.open=false;});};
    document.addEventListener('pointerdown',close);
    return()=>document.removeEventListener('pointerdown',close);
  },[]);
  const [pane,setPane]=useState('chart'),[chartKey,setChartKey]=useState(null),[maxGroup,setMaxGroup]=useState(null);
  const [searchOpen,setSearchOpen]=useState(false),[view,setView]=useState('All'),[page,setPage]=useState(0),[tableLive,setTableLive]=useState(false),[drag,setDrag]=useState(null);
  const [query,setQuery]=useState(''),[search,setSearch]=useState(''),[listId,setListId]=useState(null),[targetGroup,setTargetGroup]=useState('');
  const [editor,setEditor]=useState(null),[saving,setSaving]=useState(false),[error,setError]=useState(''),[collapsed,setCollapsed]=useState({});
  const listIndex=Math.max(0,watchlists.findIndex((w,i)=>(w.id || String(i))===listId));const list=watchlists[listIndex];
  const groups=list?.groups || [];
  const activeGroup=groups.some(g=>g.id===targetGroup)?targetGroup:'';
  const equities=instruments.filter(stock=>['NSE_EQ','BSE_EQ','NSE_INDEX','BSE_INDEX','INDICES'].includes(stock.segment));
  const byKey=new Map(equities.map(stock=>[stock.instrumentKey,stock]));
  const matches=(stock,q)=>`${stock.tradingsymbol} ${stock.name}`.toLowerCase().includes(q.trim().toLowerCase());
  const stocks=equities.filter(stock=>matches(stock,query)).filter(stock=>(view==='All'&&!(stock.segment==='INDICES'||stock.segment.endsWith('INDEX')))||(view.startsWith('list:')&&watchlists.find(w=>w.id===view.slice(5))?.stocks.includes(stock.instrumentKey))||(view==='Indices'&&(stock.segment==='INDICES'||stock.segment.endsWith('INDEX')))||(stock.indices||[]).includes(view));
  const currentPage=Math.min(page,Math.max(0,Math.ceil(stocks.length/50)-1));
  const visibleStocks=stocks.slice(currentPage*50,currentPage*50+50);
  const activePane=pane==='chart'?(chartEnabled?'chart':screenerEnabled?'screener':'none'):(screenerEnabled?'screener':chartEnabled?'chart':'none');
  useMarketInterest(activePane==='chart'&&chartKey?[chartKey]:activePane==='screener'&&tableLive?visibleStocks.map(s=>s.instrumentKey):[]);
  function showChart(key){if(!chartEnabled){navigate(`/stock/${encodeURIComponent(key)}`);return;}setChartKey(key);setPane('chart');}
  const results=searchOpen?equities.filter(stock=>matches(stock,search)).slice(0,100):[];

  async function update(change) {
    if(!list)return;
    const result=await updateWatchlist(listIndex,change);
    if(result?.ok===false)setError(result.error);
    return result;
  }
  function assign(stockKey, groupId) {
    return update(current=>({stocks:[...new Set([...current.stocks,stockKey])],groups:(current.groups||[]).map(g=>({...g,stocks:[...g.stocks.filter(key=>key!==stockKey),...(g.id===groupId?[stockKey]:[])]}))}));
  }
  function remove(stockKey) { return update(current=>({stocks:current.stocks.filter(key=>key!==stockKey)})); }
  function pin(stockKey) { return update(current=>({pinned:(current.pinned||[]).includes(stockKey)?current.pinned.filter(key=>key!==stockKey):[...(current.pinned||[]),stockKey]})); }
  function begin(type,id='',name='') { setEditor({type,id,name});setError(''); }
  async function saveEditor(event) {
    event.preventDefault();if(saving)return;
    const name=editor.name.trim();if(!name)return setError('Enter a name.');
    if(new TextEncoder().encode(name).length>50)return setError('Name is too long (maximum 50 bytes).');
    setSaving(true);setError('');
    let result;
    if(editor.type==='list') {
      result=await createWatchlist(name);
      if(result?.ok!==false)setListId(result?.watchlist?.id || null);
    } else if(editor.type==='renameList') result=await update({name});
    else if(editor.type==='group') {
      const id=crypto.randomUUID();
      result=await update(current=>({groups:[...(current.groups||[]),{id,name,stocks:[]}]}));
      if(result?.ok!==false)setTargetGroup(id);
    } else result=await update(current=>({groups:(current.groups||[]).map(g=>g.id===editor.id?{...g,name}:g)}));
    setSaving(false);if(result?.ok===false)setError(result.error);else setEditor(null);
  }
  const groupedKeys=new Set(groups.flatMap(g=>g.stocks));
  const defaultSection={id:'',name:'Default',stocks:(list?.stocks||[]).filter(key=>!groupedKeys.has(key))};
  const order=list?.groupOrder||['',...groups.map(g=>g.id)];
  const sections=[defaultSection,...groups].sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id));
  const firstKey=sections.flatMap(g=>[...g.stocks].sort((a,b)=>Number((list?.pinned||[]).includes(b))-Number((list?.pinned||[]).includes(a)))).find(key=>byKey.has(key));
  useEffect(()=>{if(!chartKey&&firstKey)setChartKey(firstKey);},[chartKey,firstKey]);
  const chartPrice=prices.get(chartKey);
  function clearDrop(){document.querySelectorAll('[data-drop-edge]').forEach(el=>el.removeAttribute('data-drop-edge'));}
  function previewDrop(event,kind){
    if(!drag || (kind==='stock'&&drag.kind!=='stock'))return;
    event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect='move';
    const el=event.currentTarget, rect=el.getBoundingClientRect();
    const gap=el.dataset.dropEdge;const top=rect.top+(gap==='before'?46:0), bottom=rect.bottom-(gap==='after'?46:0);
    if((gap==='before'&&event.clientY<top)||(gap==='after'&&event.clientY>bottom))return;
    const edge=event.clientY<(top+bottom)/2?'before':'after';
    if(el.dataset.dropEdge!==edge){clearDrop();el.dataset.dropEdge=edge;}
    const scroller=el.closest('.watchlist-groups');
    if(scroller){const bounds=scroller.getBoundingClientRect();if(event.clientY<bounds.top+45)scroller.scrollTop-=12;else if(event.clientY>bounds.bottom-45)scroller.scrollTop+=12;}
  }
  function startDrag(event,kind,item){
    const el=event.currentTarget.closest(kind==='group'?'.watch-group':'.watch-stock');
    const ghost=el.cloneNode(true);ghost.className='watch-drag-preview';ghost.style.width=el.getBoundingClientRect().width+'px';ghost.style.position='fixed';ghost.style.left='-10000px';ghost.style.top='0';document.body.appendChild(ghost);event.dataTransfer.setDragImage(ghost,24,18);setTimeout(()=>ghost.remove(),0);
const value={sourceId:list.id,kind,item};event.dataTransfer.setData('application/cone-watchlist',JSON.stringify(value));event.dataTransfer.effectAllowed='move';setDrag(value);event.stopPropagation();}
  async function drop(event,targetListId,targetGroupId='',beforeId=null){event.preventDefault();event.stopPropagation();event.currentTarget.removeAttribute('data-dragover');clearDrop();let value=drag;try{value=JSON.parse(event.dataTransfer.getData('application/cone-watchlist'))||value;}catch{}setDrag(null);if(!value||!targetListId)return;if(value.sourceId===targetListId&&value.item===beforeId)return;const result=await moveWatchlistItem(value.sourceId,{kind:value.kind,item:value.item,targetListId,targetGroupId,beforeId});if(result?.ok===false)setError(result.error);}
  function moveStock(key,groupId,beforeId){return moveWatchlistItem(list.id,{kind:'stock',item:key,targetListId:list.id,targetGroupId:groupId,beforeId});}
  function shiftStock(key,group,direction){const index=group.stocks.indexOf(key);if(index<0||index+direction<0||index+direction>=group.stocks.length)return;return moveStock(key,group.id,group.stocks[index+(direction<0?-1:2)]||null);}
  function shiftGroup(id,direction){const index=order.indexOf(id);if(index+direction<0||index+direction>=order.length)return;return moveWatchlistItem(list.id,{kind:'group',item:id,targetListId:list.id,beforeId:order[index+(direction<0?-1:2)]??null});}
  function addItem(groupId){setTargetGroup(groupId);setSearchOpen(true);searchInput.current?.focus();}
  const listName=list?.name || 'Watchlist';
  return <div className="market-layout grouped-market">
    <section className="grouped-watchlist" aria-label="Watchlist panel" onKeyDown={e=>{if(e.key==='Escape'){setSearchOpen(false);e.currentTarget.querySelectorAll('details[open]').forEach(el=>{el.open=false;el.querySelector('summary')?.focus();});}}}>
      <div className="watchlist-search-overlay" ref={searchPanel}><div className="watchlist-search"><Search size={14}/><input ref={searchInput} onFocus={()=>setSearchOpen(true)} onKeyDown={e=>{if(e.key==='Escape')setSearchOpen(false);}} aria-label="Add stocks to watchlist" placeholder="Search & add stocks" value={search} onChange={e=>setSearch(e.target.value)}/>{search && <button aria-label="Clear stock search" onClick={()=>setSearch('')}><X size={13}/></button>}</div>
      {searchOpen && <div className="watchlist-search-results" aria-label="Stock search results">{!results.length && <p>No matching stocks.</p>}{results.map(stock=><button key={stock.instrumentKey} disabled={!list} onClick={async()=>{const result=await assign(stock.instrumentKey,activeGroup);if(result?.ok!==false){setSearch('');setSearchOpen(false);}}}><span>{stock.tradingsymbol}<small>{stock.exchange} · {stock.name}</small></span>{list?.stocks.includes(stock.instrumentKey)?<span aria-label="Already added">✓</span>:<Plus size={14}/>}</button>)}</div>}</div>
      <div className="watchlist-heading"><span>{listName} <small>{list?.stocks.length||0} / 100</small></span><button disabled={!list || groups.length>=20} onClick={()=>begin('group')}>+ New group</button></div>
      {editor && <form className="watchlist-editor" onSubmit={saveEditor}><label>{({list:'New watchlist',group:'New group',renameList:'Rename watchlist',renameGroup:'Rename group'})[editor.type]}<input className="input" aria-label="Name" autoFocus maxLength={50} value={editor.name} onChange={e=>setEditor({...editor,name:e.target.value})}/></label><div><button className="btn btn-primary btn-sm" disabled={saving} type="submit">{saving?'Saving…':'Save'}</button><button type="button" className="btn btn-ghost btn-sm" disabled={saving} onClick={()=>{setEditor(null);setError('');}}>Cancel</button></div></form>}
      {error && <p role="alert" className="watchlist-error">{error}</p>}
      <div className="watchlist-groups" onDragEnd={()=>{setDrag(null);clearDrop();}}>
        {list ? (list.stocks.length===0 && groups.length===0 ? <div className="watchlist-blank"><p>No stocks in this watchlist.</p><button className="btn btn-primary" onClick={()=>addItem('')}>Add a stock</button></div> : sections.filter(group=>maxGroup===null||maxGroup===group.id).map(group=>{
          const keys=group.stocks.filter(key=>byKey.has(key));
          const sorted=keys.map((key,i)=>({key,i})).sort((a,b)=>Number((list.pinned||[]).includes(b.key))-Number((list.pinned||[]).includes(a.key))||a.i-b.i);
          return <section className="watch-group" key={group.id || 'default'} aria-label={`${group.name} group`} onDragOver={e=>previewDrop(e,'group')} onDrop={e=>{const after=e.currentTarget.dataset.dropEdge==='after';const next=sections[sections.findIndex(g=>g.id===group.id)+1]?.id??null;drop(e,list.id,group.id,drag?.kind==='group'?(after?next:group.id):null);}}>
            <div draggable onDragStart={e=>startDrag(e,'group',group.id)} className={`watch-group-heading${activeGroup===group.id?' selected':''}`}>
              <span className="drag-handle"><GripVertical size={12}/></span><button className="group-collapse" aria-label={`${collapsed[group.id]?'Expand':'Collapse'} ${group.name}`} aria-expanded={!collapsed[group.id]} onClick={()=>setCollapsed({...collapsed,[group.id]:!collapsed[group.id]})}>{collapsed[group.id]?<ChevronRight size={13}/>:<ChevronDown size={13}/>}</button>
              <button className="group-name" aria-pressed={activeGroup===group.id} onClick={()=>setTargetGroup(group.id)}>{group.name} <small>{keys.length}</small></button>
              <button className="group-maximize" aria-label={`${maxGroup===group.id?'Restore':'Maximize'} ${group.name}`} title={maxGroup===group.id?'Restore groups':'Maximize group'} onClick={()=>{setMaxGroup(maxGroup===group.id?null:group.id);setCollapsed(current=>({...current,[group.id]:false}));}}>{maxGroup===group.id?<Minimize2 size={13}/>:<Maximize2 size={13}/>}</button><button className="group-add" aria-label={`Add item to ${group.name}`} title="Add item" onClick={()=>addItem(group.id)}><Plus size={13}/></button><details className="group-options"><summary aria-label={`${group.name} group options`}><MoreHorizontal size={15}/></summary><div><button onClick={()=>shiftGroup(group.id,-1)}>Move up</button><button onClick={()=>shiftGroup(group.id,1)}>Move down</button><MoveChoices items={watchlists.filter(w=>w.id!==list.id)} onSelect={targetListId=>moveWatchlistItem(list.id,{kind:'group',item:group.id,targetListId})}/>{group.id && <button onClick={event=>{event.currentTarget.closest('details').open=false;begin('renameGroup',group.id,group.name);}}>Rename</button>}{group.id && <button onClick={event=>{event.currentTarget.closest('details').open=false;update(current=>({groups:(current.groups||[]).filter(g=>g.id!==group.id)}));setTargetGroup('');}}>Remove group</button>}</div></details>
            </div>
            {!collapsed[group.id] && (sorted.length ? sorted.map(({key})=><WatchRow key={key} stock={byKey.get(key)} price={prices.get(key)} pinned={(list.pinned||[]).includes(key)} groups={groups} groupId={group.id} watchlists={watchlists.filter(w=>w.id!==list.id)} onWorkspace={targetListId=>moveWatchlistItem(list.id,{kind:'stock',item:key,targetListId})} onDrag={e=>startDrag(e,'stock',key)} onDragOver={e=>previewDrop(e,'stock')} onDrop={e=>{if(drag?.kind==='group')return;const after=e.currentTarget.dataset.dropEdge==='after';drop(e,list.id,group.id,after?(group.stocks[group.stocks.indexOf(key)+1]||null):key);}} onChart={showChart} onShift={direction=>shiftStock(key,group,direction)} onPin={()=>pin(key)} onMove={id=>assign(key,id)} onRemove={()=>remove(key)} onTrade={side=>openOrderModal({instrumentKey:key,side})}/>) : <div className="watch-group-empty"><span>No items.</span><button onClick={()=>addItem(group.id)}>+ Add item</button></div>)}
          </section>;
        })) : <div className="empty-section"><button className="btn btn-ghost" onClick={()=>begin('list')}>Create watchlist</button></div>}
      </div>
      <footer className="watchlist-tabs" aria-label="Watchlists">{watchlists.map((value,index)=><button key={value.id||index} onDragOver={e=>{e.preventDefault();e.currentTarget.dataset.dragover='true';}} onDragLeave={e=>e.currentTarget.removeAttribute('data-dragover')} onDrop={e=>drop(e,value.id)} title={value.name} aria-label={`Watchlist ${index+1}: ${value.name}`} aria-pressed={listIndex===index} onClick={()=>{setListId(value.id || String(index));setMaxGroup(null);setTargetGroup('');setEditor(null);setError('');setSearch('');}}>{index+1}</button>)}<button aria-label="New watchlist" title="New watchlist" disabled={watchlists.length>=10} onClick={()=>begin('list')}><Plus size={16}/></button>{list && <details className="group-options rename-watchlist footer-options"><summary aria-label="Watchlist options"><MoreHorizontal size={16}/></summary><div><button onClick={e=>{e.currentTarget.closest('details').open=false;begin('renameList','',list.name);}}>Rename watchlist</button></div></details>}</footer>
    </section>
    <section className="market-explorer"><ReplayControls/>
      <div className="market-pane-tabs" role="tablist" aria-label="Market view">{screenerEnabled && <button role="tab" aria-selected={activePane==='screener'} onClick={()=>setPane('screener')}>Stock screener</button>}{chartEnabled && <button role="tab" aria-selected={activePane==='chart'} onClick={()=>setPane('chart')}>Chart</button>}</div>
      {activePane==='none'?<p className="empty-section">Market panels are hidden. <Link to="/settings">Open settings</Link></p>:activePane==='chart'?<div className="market-chart-pane">{chartKey?<><div className="market-chart-heading"><h2>{byKey.get(chartKey)?.tradingsymbol||chartKey}</h2><span>{prices.get(chartKey)?fmtPrice(prices.get(chartKey).ltp):'—'}</span><Link to={`/stock/${encodeURIComponent(chartKey)}`}>Open details ↗</Link></div><CandlestickChart key={chartKey} instrumentKey={chartKey} height={400}/><div className="market-quote-stats">{['open','high','low','close','volume'].map(field=><div key={field}><span>{field==='volume'?'Volume':field[0].toUpperCase()+field.slice(1)}</span><strong>{chartPrice?.[field]==null?'—':field==='volume'?formatNumber(chartPrice[field]):fmtPrice(chartPrice[field])}</strong></div>)}</div><MarketDepth key={`depth-${chartKey}`} instrumentKey={chartKey}/></>:<p className="empty-section">Select a stock’s chart from the watchlist.</p>}</div>:<>

      <div className="section-heading screener-heading"><h2>Stock screener <span className="muted">{stocks.length}</span></h2><label className="market-search"><Search size={15}/><input aria-label="Search market stocks" placeholder="Search stocks" value={query} onChange={e=>setQuery(e.target.value)}/></label></div>
      <div className="screener-controls"><select aria-label="Stock view" value={view} onChange={e=>{setView(e.target.value);setPage(0);}}><optgroup label="Market">{['All','Nifty 50','Nifty 100','Nifty 500','Indices'].map(label=><option key={label} value={label}>{label==='All'?'All stocks':label}</option>)}</optgroup>{watchlists.length>0 && <optgroup label="Your watchlists">{watchlists.map((w,i)=><option key={w.id||i} value={`list:${w.id}`}>{i+1}. {w.name}</option>)}</optgroup>}</select><label><input type="checkbox" checked={tableLive} onChange={e=>setTableLive(e.target.checked)}/>Live table quotes</label></div>
      <div className="table-wrapper"><table className="data-table market-table"><thead><tr><th aria-label="Watchlist"/><th>Stock</th><th className="col-right">Price</th><th className="col-right">Change</th><th>Sector</th></tr></thead><tbody>{visibleStocks.map(stock=>{const price=prices.get(stock.instrumentKey),selected=list?.stocks.includes(stock.instrumentKey);return <tr key={stock.instrumentKey}>
        <td><button className="btn-icon" aria-label={`${selected?'Remove':'Add'} ${stock.tradingsymbol} ${selected?'from':'to'} watchlist`} aria-pressed={!!selected} disabled={!list} onClick={()=>selected?remove(stock.instrumentKey):assign(stock.instrumentKey,activeGroup)}><Star size={14} fill={selected?'currentColor':'none'}/></button></td>
        <td><Link className="stock-link" to={`/stock/${encodeURIComponent(stock.instrumentKey)}`}>{stock.tradingsymbol}</Link><div className="stock-name">{stock.exchange} · {stock.name}</div></td><td className="col-right">{price?fmtPrice(price.ltp):'—'}</td><td className={`col-right ${price?.changePercent>=0?'text-up':'text-down'}`}>{price?`${price.changePercent>=0?'+':''}${price.changePercent.toFixed(2)}%`:'—'}</td><td>{stock.sector || '—'}</td>
      </tr>;})}</tbody></table></div>{!stocks.length && <p className="empty-section">{view.startsWith('Nifty')?'Index membership is not loaded yet. Switch to Upstox to refresh the catalogue.':'No matching stocks.'}</p>}<div className="screener-pagination"><button disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>Previous</button><span>{currentPage+1} / {Math.max(1,Math.ceil(stocks.length/50))}</span><button disabled={(currentPage+1)*50>=stocks.length} onClick={()=>setPage(currentPage+1)}>Next</button></div>
    </>}
    </section>
  </div>;
}
