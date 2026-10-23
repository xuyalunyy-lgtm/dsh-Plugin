const React = require('react');
const pdfjs = require('pdfjs-dist/build/pdf.mjs');
// The .mjs text-loader result is an ES module namespace, not the source string.
const workerSource = require('pdfjs-dist/build/pdf.worker.mjs').default;
const assets = require('./pdf-assets.json');
const {findMatches, pdfPageText, intersections, decodeMarkdown} = require('./search.mjs');
const {matchPosition, nextMatchIndex, matchJumpTarget, isComposingKey} = require('./match-navigation.mjs');
const css = require('./style.css');
const zh = require('../locale/zh.json');
const en = require('../locale/en.json');
const h = React.createElement;
const {useState, useEffect, useMemo, useRef} = React;
const ID = 'dsh-document-search';
function asset(name) {
  const raw = assets[name];
  if (!raw) throw new Error('Missing local PDF asset: ' + name);
  return Uint8Array.from(atob(raw), c => c.charCodeAt(0));
}
class CMapReaderFactory { async fetch({name}) { return {cMapData:asset('cmaps/'+name+'.bcmap'),compressionType:1}; } }
class StandardFontDataFactory { async fetch({filename}) { return asset('standard_fonts/'+filename); } }
function marks(text, matches, active, prefix='') {
  const out=[]; let offset=0;
  matches.forEach((m,i)=>{
    out.push(text.slice(offset,m.start));
    out.push(h('mark',{key:prefix+i,'data-hit':i,'data-active':i===active ? 'true':undefined},text.slice(m.start,m.end)));
    offset=m.end;
  });
  out.push(text.slice(offset)); return out;
}
function PdfPage({doc, pageNumber, record, matches, active, reveal, t}) {
  const canvas=useRef(null), layer=useRef(null), shell=useRef(null);
  const [width,setWidth]=useState(600), [error,setError]=useState(''), [ready,setReady]=useState(0);
  const textLayer=useRef(null);
  useEffect(()=>{const observer=new ResizeObserver(entries=>setWidth(Math.max(160,entries[0].contentRect.width)));observer.observe(shell.current);return ()=>observer.disconnect();},[]);
  useEffect(()=>{
    let cancelled=false, renderTask, tl;
    setError(''); textLayer.current=null;
    (async()=>{
      const page=await doc.getPage(pageNumber); if(cancelled)return;
      const base=page.getViewport({scale:1});
      const scale=Math.min(2,Math.max(.1,(width-16)/base.width));
      const viewport=page.getViewport({scale});
      const pixelRatio=Math.min(window.devicePixelRatio||1,2,Math.sqrt(16777216/(viewport.width*viewport.height)));
      const c=canvas.current;
      c.width=Math.floor(viewport.width*pixelRatio); c.height=Math.floor(viewport.height*pixelRatio);
      c.style.width=viewport.width+'px';c.style.height=viewport.height+'px';
      layer.current.replaceChildren();
      layer.current.style.setProperty('--scale-factor',String(scale));
      layer.current.style.setProperty('--total-scale-factor',String(scale*(viewport.userUnit||page.userUnit||1)));
      renderTask=page.render({canvasContext:c.getContext('2d'),viewport,transform:[pixelRatio,0,0,pixelRatio,0,0]});
      tl=new pdfjs.TextLayer({textContentSource:record.content,container:layer.current,viewport});
      await Promise.all([renderTask.promise,tl.render()]);
      if(!cancelled){textLayer.current=tl;setReady(x=>x+1);}
    })().catch(e=>{if(!cancelled)setError(String(e.message||e));});
    return ()=>{cancelled=true;renderTask?.cancel();tl?.cancel();textLayer.current=null;};
  },[doc,pageNumber,record,width]);
  useEffect(()=>{
    const tl=textLayer.current; if(!tl)return;
    tl.textDivs.forEach((div,i)=>{
      const span=record.spans[i]; if(!span)return;
      const text=tl.textContentItemsStr[i];
      const slices=intersections(span.start,span.end,matches);
      const nodes=[];let offset=0;
      for(const m of slices){nodes.push(document.createTextNode(text.slice(offset,m.start)));const mark=document.createElement('mark');mark.textContent=text.slice(m.start,m.end);mark.dataset.hit=String(m.index);if(m.index===active)mark.dataset.active='true';nodes.push(mark);offset=m.end;}
      nodes.push(document.createTextNode(text.slice(offset))); div.replaceChildren(...nodes);
    });
    layer.current.querySelector('[data-active="true"]')?.scrollIntoView({block:'nearest',inline:'nearest'});
  },[record,matches,active,ready,reveal]);
  return h('div',{ref:shell,className:'dbs-pdf-shell'},error&&h('p',{role:'alert'},t('renderError')+' '+error),h('div',{className:'dbs-pdf-page'},h('canvas',{ref:canvas,'aria-label':t('page')+' '+pageNumber}),h('div',{ref:layer,className:'dbs-textLayer'})));
}
function Reader({content,resourceAddress,scrollportRef,isPdf,t}) {
  const [query,setQuery]=useState(''),[sensitive,setSensitive]=useState(false),[current,setCurrent]=useState(0),[page,setPage]=useState(1);
  const [state,setState]=useState({loading:true,pages:[],doc:null,error:''});
  const [jumpValue,setJumpValue]=useState(''),[jumpError,setJumpError]=useState(''),[reveal,setReveal]=useState(0);
  const scroll=useRef(null), input=useRef(null), jumpComposing=useRef(false);
  const jumpErrorId=React.useId();
  const data=content.kind==='bytes'?content.data:null;
  useEffect(()=>{
    let disposed=false,task;
    setQuery('');setCurrent(0);setPage(1);setState({loading:true,pages:[],doc:null,error:''});
    (async()=>{
      if(!data)throw new Error(t('bytesRequired'));
      if(!isPdf){const text=decodeMarkdown(data);if(!disposed)setState({loading:false,pages:[{text}],doc:null,error:''});return;}
      task=pdfjs.getDocument({data:data.slice(),useWorkerFetch:false,CMapReaderFactory,StandardFontDataFactory,isEvalSupported:false,useWasm:false});
      task.onPassword=()=>{if(!disposed)setState({loading:false,pages:[],doc:null,error:t('password')});task.destroy().catch(()=>{});};
      const doc=await task.promise;
      const pages=[];
      for(let n=1;n<=doc.numPages;n++){
        if(disposed)return;
        const p=await doc.getPage(n), textContent=await p.getTextContent();
        pages.push({...pdfPageText(textContent.items),content:textContent});
      }
      if(!disposed)setState({loading:false,pages,doc,error:''});
    })().catch(e=>{if(!disposed)setState({loading:false,pages:[],doc:null,error:String(e.message||e)});});
    return ()=>{disposed=true;task?.destroy().catch(()=>{});};
  },[data,resourceAddress,isPdf]);
  const results=useMemo(()=>state.pages.flatMap((p,i)=>findMatches(p.text,query,sensitive).map(m=>({...m,page:i+1}))),[state.pages,query,sensitive]);
  const pageMatches=useMemo(()=>results.filter(m=>m.page===page),[results,page]);
  const position=matchPosition(query,results.length,current,state);
  const active=position.status==='matched'?results[position.current-1]:undefined;
  const pageActive=active?.page===page?pageMatches.indexOf(active):-1;
  const changeQuery=value=>{setQuery(value);setCurrent(0);};
  useEffect(()=>{if(results[0])setPage(results[0].page);setCurrent(0);setJumpValue('');setJumpError('');jumpComposing.current=false;},[results]);
  useEffect(()=>{if(!isPdf)scroll.current?.querySelector('[data-active="true"]')?.scrollIntoView({block:'nearest',inline:'nearest'});},[current,results,isPdf,reveal]);
  const counterText=position.status==='matched'?t('matchCount',{current:position.current,total:position.total}):t({idle:'idle',empty:'noMatches',loading:'indexing',error:'searchUnavailable'}[position.status]);
  // All match navigation shares the same current-item and PDF-page update.
  // A reveal revision also repositions an already-selected match after manual scrolling.
  const selectMatch=index=>{const target=results[index];if(!target)return;setCurrent(index);setPage(target.page);setReveal(value=>value+1);};
  const move=delta=>{if(!results.length)return;setJumpError('');selectMatch(nextMatchIndex(current,delta,results.length));};
  const jump=()=>{
    if(jumpComposing.current||position.status!=='matched')return;
    const target=matchJumpTarget(jumpValue,results);
    if(!target.ok){setJumpError(target.error);return;}
    setJumpError('');setJumpValue(String(target.ordinal));selectMatch(target.index);
  };
  const ref=node=>{scroll.current=node;scrollportRef?.(node);};
  const button=(label,click,disabled)=>h('button',{type:'button',onClick:click,disabled,'aria-label':label,title:label},label);
  return h('section',{className:'dbs-root',onKeyDown:e=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='f'){e.preventDefault();e.stopPropagation();input.current?.focus();input.current?.select();}
  }},h('style',null,css),
    h('div',{className:'dbs-toolbar'},h('label',null,t('find'),h('input',{ref:input,type:'search',value:query,placeholder:t('placeholder'),disabled:state.loading||!!state.error,onChange:e=>changeQuery(e.target.value),onKeyDown:e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing){e.preventDefault();move(e.shiftKey?-1:1);}if(e.key==='Escape'){changeQuery('');e.stopPropagation();}}})),
      h('label',null,h('input',{type:'checkbox',checked:sensitive,onChange:e=>{setSensitive(e.target.checked);setCurrent(0);}}),t('case')),
      button(t('clear'),()=>changeQuery(''),!query)),
    h('div',{className:'dbs-toolbar dbs-results'},
      h('output',{className:'dbs-match-counter','data-status':position.status,'aria-live':'polite','aria-atomic':'true'},counterText),
      button(t('previous'),()=>move(-1),position.status!=='matched'),button(t('next'),()=>move(1),position.status!=='matched'),
      h('label',{className:'dbs-jump-label'},t('jumpLabel'),h('input',{
        className:'dbs-jump-input',type:'text',inputMode:'numeric',autoComplete:'off',spellCheck:false,
        value:jumpValue,placeholder:t('jumpPlaceholder',{total:position.total}),disabled:position.status!=='matched',
        'aria-invalid':Boolean(jumpError),'aria-describedby':jumpError?jumpErrorId:undefined,
        onChange:e=>{setJumpValue(e.target.value);setJumpError('');},
        onCompositionStart:()=>{jumpComposing.current=true;},onCompositionEnd:()=>{jumpComposing.current=false;},
        onKeyDown:e=>{if(e.key==='Enter'&&!isComposingKey(e,jumpComposing.current)){e.preventDefault();e.stopPropagation();jump();}}
      })),button(t('jumpButton'),jump,position.status!=='matched'),
      isPdf&&position.status==='matched'&&active&&h('span',{className:'dbs-match-page'},t('matchPage',{page:active.page})),
      jumpError&&h('span',{id:jumpErrorId,className:'dbs-jump-error',role:'alert'},t(jumpError,{total:position.total}))),
    isPdf&&state.pages.length>0&&h('div',{className:'dbs-toolbar'},button('‹',()=>setPage(p=>Math.max(1,p-1)),page<=1),h('label',null,t('page'),h('input',{type:'number',min:1,max:state.pages.length,value:page,onChange:e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=1&&n<=state.pages.length)setPage(n);}})),h('span',null,' / '+state.pages.length),button('›',()=>setPage(p=>Math.min(state.pages.length,p+1)),page>=state.pages.length)),
    h('p',{className:'dbs-note'},t(isPdf?'pdfNote':'mdNote')),
    h('div',{className:'dbs-scroll',ref},
      state.loading?h('p',{role:'status'},t('loading')):state.error?h('p',{role:'alert'},t('error')+' '+state.error):isPdf?
        h(React.Fragment,null,!state.pages.some(p=>p.text.trim())&&h('p',{role:'status'},t('scanned')),h(PdfPage,{doc:state.doc,pageNumber:page,record:state.pages[page-1],matches:pageMatches,active:pageActive,reveal,t})):
        h('pre',{className:'dbs-markdown'},marks(state.pages[0]?.text||'',results,position.current-1))));
}
module.exports={inject:['slots','documentPreviews','locale'],apply(ctx){
  ctx.effect(()=>{
    if(typeof workerSource !== 'string' || !workerSource.includes('WorkerMessageHandler')) throw new Error('Invalid bundled PDF worker source');
    const url=URL.createObjectURL(new Blob([workerSource],{type:'text/javascript'}));
    pdfjs.GlobalWorkerOptions.workerSrc=url;
    return ()=>URL.revokeObjectURL(url);
  });
  ctx.effect(()=>ctx.locale.register('documentSearch','en',en.ui));
  ctx.effect(()=>ctx.locale.register('documentSearch','zh',zh.ui));
  const t=ctx.locale.bind('documentSearch');
  for(const [suffixes,isPdf,id,label] of [[['pdf'],true,ID+'/pdf','pdfTitle'],[['md','markdown','mdown'],false,ID+'/md','mdTitle']]){
    ctx.effect(()=>ctx.documentPreviews.register({id,extensions:suffixes,...(isPdf?{binaryExtensions:['pdf']}:{}),priority:'builtin',title:()=>t(label),loading:'bytes-complete',wrap:false}));
    ctx.effect(()=>ctx.slots.inject('sidebar.right.tab.document',()=>ctx.slots.register({name:'sidebar.right.tab.document',key:id,locale:'documentSearch'},props=>h(Reader,{...props,isPdf}))));
  }
}};
