const React = require('react');
const pdfjs = require('pdfjs-dist/build/pdf.mjs');
// The .mjs text-loader result is an ES module namespace, not the source string.
const workerSource = require('pdfjs-dist/build/pdf.worker.mjs').default;
const assets = require('./pdf-assets.json');
const {findMatches, pdfPageText, intersections, decodeMarkdown} = require('./search.mjs');
const {matchPosition, nextMatchIndex, matchJumpTarget, isComposingKey} = require('./match-navigation.mjs');
const {RESULTS_PAGE_SIZE, buildLineStarts, createResultPage, listScrollForItem} = require('./result-list.mjs');
const {documentViewKey, normalizeViewState, createViewStateCache, createScrollCoordinator} = require('./view-state.mjs');
const {buildPageLayout, capturePageAnchor, restorePageAnchor, groupPageMatches, pdfReadyMatches, mountedPdfPages, normalizedPdfMetric, isManualScrollKey, measurePdfViewport, EMPTY_PAGE_MATCHES} = require('./continuous-pdf.mjs');
const css = require('./style.css');
const zh = require('../locale/zh.json');
const en = require('../locale/en.json');
const h = React.createElement;
const {useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback} = React;
const EMPTY_PAGES = [];
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
function PdfPage({doc, frame, record, group, current, source, intentRevision, measurementRevision, onReady, t}) {
  const canvas=useRef(null), layer=useRef(null), shell=useRef(null), textLayer=useRef(null);
  const [outcome,setOutcome]=useState(null),generation=useRef(0);
  useEffect(()=>{
    let cancelled=false, renderTask, tl;
    const run=++generation.current,c=canvas.current,container=layer.current;
    setOutcome(null);textLayer.current=null;
    (async()=>{
      const page=await doc.getPage(frame.page);if(cancelled)return;
      const viewport=page.getViewport({scale:frame.scale});
      const pixelRatio=Math.min(window.devicePixelRatio||1,2,Math.sqrt(16777216/(viewport.width*viewport.height)));
      c.width=Math.max(1,Math.floor(viewport.width*pixelRatio));c.height=Math.max(1,Math.floor(viewport.height*pixelRatio));
      c.style.width=frame.width+'px';c.style.height=frame.height+'px';
      container.replaceChildren();
      container.style.setProperty('--scale-factor',String(frame.scale));
      container.style.setProperty('--total-scale-factor',String(frame.scale*(viewport.userUnit||page.userUnit||1)));
      renderTask=page.render({canvasContext:c.getContext('2d'),viewport,transform:[pixelRatio,0,0,pixelRatio,0,0]});
      tl=new pdfjs.TextLayer({textContentSource:record.content,container,viewport});
      await Promise.all([renderTask.promise,tl.render()]);
      if(!cancelled){textLayer.current=tl;setOutcome({run,error:''});}
    })().catch(e=>{if(!cancelled)setOutcome({run,error:String(e.message||e)});});
    return ()=>{cancelled=true;renderTask?.cancel();tl?.cancel();textLayer.current=null;container.replaceChildren();c.width=0;c.height=0;};
  },[doc,frame.page,frame.scale,frame.width,frame.height,record]);
  useEffect(()=>{
    const tl=textLayer.current;if(!outcome||outcome.run!==generation.current||(!tl&&!outcome.error))return;
    if(tl)tl.textDivs.forEach((div,i)=>{
      const span=record.spans[i];if(!span)return;
      const text=tl.textContentItemsStr[i],slices=intersections(span.start,span.end,group.matches);
      const nodes=[];let offset=0;
      for(const match of slices){
        nodes.push(document.createTextNode(text.slice(offset,match.start)));
        const mark=document.createElement('mark'),globalIndex=group.globalIndexes[match.index];
        mark.textContent=text.slice(match.start,match.end);mark.dataset.hit=String(globalIndex);
        if(globalIndex===current)mark.dataset.active='true';nodes.push(mark);offset=match.end;
      }
      nodes.push(document.createTextNode(text.slice(offset)));div.replaceChildren(...nodes);
    });
    onReady({source,layoutWidth:frame.layoutWidth,token:intentRevision,page:frame.page,node:shell.current});
  },[record,group,current,outcome,intentRevision,measurementRevision,source,frame.page,frame.layoutWidth,onReady]);
  return h('div',{ref:shell,className:'dbs-pdf-page'},outcome?.error&&h('p',{className:'dbs-pdf-error',role:'alert'},t('renderError')+' '+outcome.error),h('canvas',{ref:canvas,'aria-label':t('page')+' '+frame.page}),h('div',{ref:layer,className:'dbs-textLayer'}));
}

function ContinuousPdf({doc,pages,results,current,source,epoch,intentRevision,coordinator,scrollRef,saveView,onReadingPage,t}) {
  const [viewport,setViewport]=useState({width:0,height:0,top:0,visible:false,measurementRevision:0}),[pending,setPending]=useState(null);
  const layout=useMemo(()=>buildPageLayout(pages.map(p=>p.metric),viewport.width||600),[pages,viewport.width]);
  const grouped=useMemo(()=>groupPageMatches(results),[results]);
  const layoutRef=useRef(null),pendingRef=useRef(null),frameRef=useRef(0),disposed=useRef(false);
  const sampledTop=useRef(0),lastReady=useRef(null),readyHandler=useRef(null);
  const callbackRef=useRef({saveView,onReadingPage});callbackRef.current={saveView,onReadingPage};
  const runtimeRef=useRef({source,epoch,intentRevision,layout});runtimeRef.current={source,epoch,intentRevision,layout};
  const queueViewport=useCallback(event=>{
    const node=scrollRef.current;if(!node||disposed.current)return;
    const runtime=runtimeRef.current;
    // Capture the latest scroll synchronously so unmount cannot cancel its save.
    // A width mismatch is a resize, whose transient clamped offset is not accepted.
    if(event?.type==='scroll'&&node.clientWidth>0&&node.clientHeight>0&&node.clientWidth===runtime.layout.width&&coordinator.capture(runtime.epoch,{scrollTop:node.scrollTop,scrollLeft:node.scrollLeft}))sampledTop.current=node.scrollTop;
    if(frameRef.current)return;
    frameRef.current=requestAnimationFrame(()=>{
      frameRef.current=0;const node=scrollRef.current;if(!node||disposed.current)return;
      setViewport(old=>measurePdfViewport(old,{width:node.clientWidth,height:node.clientHeight,top:node.scrollTop}));
      if(node.clientWidth<=0||node.clientHeight<=0)return;
      if(lastReady.current)readyHandler.current?.(lastReady.current);
      const runtime=runtimeRef.current;
      if(node.clientWidth===runtime.layout.width&&coordinator.capture(runtime.epoch,{scrollTop:node.scrollTop,scrollLeft:node.scrollLeft})){
        sampledTop.current=node.scrollTop;callbackRef.current.onReadingPage(capturePageAnchor(runtime.layout,node.scrollTop).page);callbackRef.current.saveView();
      }
    });
  },[coordinator,scrollRef]);
  useLayoutEffect(()=>{
    const node=scrollRef.current;if(!node)return;
    disposed.current=false;
    const manual=()=>{
      if(node.clientWidth<=0||node.clientHeight<=0)return;
      const runtime=runtimeRef.current,plan=coordinator.plan(runtime.epoch);
      if(plan&&plan.kind!=='none'){
        coordinator.complete(runtime.epoch,plan.token,{scrollTop:node.scrollTop,scrollLeft:node.scrollLeft});
        pendingRef.current=null;lastReady.current=null;setPending(null);callbackRef.current.saveView();
      }
    };
    const key=event=>{if(isManualScrollKey(event))manual();};
    const resize=new ResizeObserver(queueViewport);resize.observe(node);
    node.addEventListener('scroll',queueViewport,{passive:true});node.addEventListener('wheel',manual,{passive:true});
    node.addEventListener('touchstart',manual,{passive:true});node.addEventListener('pointerdown',manual);node.addEventListener('keydown',key);
    setViewport(old=>measurePdfViewport(old,{width:node.clientWidth,height:node.clientHeight,top:node.scrollTop}));
    return ()=>{
      const runtime=runtimeRef.current;
      if(node.clientWidth>0&&node.clientHeight>0&&node.clientWidth===runtime.layout.width&&coordinator.capture(runtime.epoch,{scrollTop:node.scrollTop,scrollLeft:node.scrollLeft}))callbackRef.current.saveView();
      disposed.current=true;resize.disconnect();if(frameRef.current)cancelAnimationFrame(frameRef.current);frameRef.current=0;
      node.removeEventListener('scroll',queueViewport);node.removeEventListener('wheel',manual);node.removeEventListener('touchstart',manual);node.removeEventListener('pointerdown',manual);node.removeEventListener('keydown',key);
      pendingRef.current=null;lastReady.current=null;
    };
  },[coordinator,scrollRef,queueViewport]);
  useLayoutEffect(()=>{
    const node=scrollRef.current;if(!node||!viewport.visible||viewport.width<=0||node.clientWidth<=0||node.clientHeight<=0)return;
    const oldLayout=layoutRef.current,plan=coordinator.plan(epoch,intentRevision);layoutRef.current=layout;
    if(!plan)return;
    if(plan.kind==='reveal'){
      const match=results[current],target=match&&layout.pages[match.page-1];
      if(target){
        const expected={source,layoutWidth:layout.width,token:plan.token,page:target.page};
        pendingRef.current=expected;lastReady.current=null;setPending(expected);node.scrollTop=target.top;
      }else{
        pendingRef.current=null;lastReady.current=null;setPending(null);coordinator.complete(epoch,plan.token,{scrollTop:node.scrollTop,scrollLeft:node.scrollLeft});saveView();
      }
    }else{
      pendingRef.current=null;lastReady.current=null;setPending(null);
      let top=plan.kind==='restore'?plan.scrollTop:node.scrollTop;
      if(oldLayout&&oldLayout!==layout&&oldLayout.width!==layout.width)top=restorePageAnchor(layout,capturePageAnchor(oldLayout,plan.kind==='restore'?plan.scrollTop:sampledTop.current));
      if(plan.kind==='restore'||oldLayout!==layout){node.scrollTop=top;if(plan.kind==='restore')node.scrollLeft=plan.scrollLeft;coordinator.complete(epoch,plan.token,{scrollTop:node.scrollTop,scrollLeft:node.scrollLeft});saveView();}
    }
    queueViewport();
  },[layout,viewport.width,viewport.measurementRevision,source,epoch,intentRevision,results,current,coordinator,scrollRef,saveView,queueViewport]);
  const pageReady=useCallback(actual=>{
    const expected=pendingRef.current,runtime=runtimeRef.current;
    if(disposed.current||!pdfReadyMatches(expected,actual)||runtime.source!==actual.source||runtime.layout.width!==actual.layoutWidth||!coordinator.plan(runtime.epoch,actual.token))return;
    lastReady.current=actual;
    const node=scrollRef.current;if(!node||node.clientWidth<=0||node.clientHeight<=0)return;
    revealWithinScrollport(node,actual.node);
    if(coordinator.complete(runtime.epoch,actual.token,{scrollTop:node.scrollTop,scrollLeft:node.scrollLeft})){
      pendingRef.current=null;lastReady.current=null;setPending(null);callbackRef.current.saveView();queueViewport();
    }
  },[coordinator,scrollRef,queueViewport]);
  readyHandler.current=pageReady;
  const mounted=mountedPdfPages(layout,viewport.top,viewport.height,pending?.page);
  return h('div',{className:'dbs-pdf-continuous',style:{height:layout.totalHeight}},layout.pages.map(frame=>h('div',{
    key:frame.page,className:'dbs-pdf-placeholder','data-pdf-page':frame.page,
    style:{position:'absolute',top:frame.top,left:frame.left,width:frame.width,height:frame.height},
  },mounted.has(frame.page)&&h(PdfPage,{doc,frame:{...frame,layoutWidth:layout.width},record:pages[frame.page-1],group:grouped.get(frame.page)||EMPTY_PAGE_MATCHES,current,source,intentRevision,measurementRevision:viewport.measurementRevision,onReady:pageReady,t}))));
}
function ResultList({listing,current,t,onSelect}) {
  const list=useRef(null), previous=useRef({listing:null,current:null});
  useEffect(()=>{
    const node=list.current;if(!node)return;
    // Identity also changes for a new query on the same batch/current ordinal.
    const listingChanged=previous.current.listing!==listing;
    if(listingChanged)node.scrollTop=0;
    if(listingChanged||previous.current.current!==current){
      const selected=node.querySelector('[aria-current="true"]');
      if(selected)node.scrollTop=listScrollForItem(node.scrollTop,node.clientHeight,selected.offsetTop,selected.offsetHeight);
    }
    previous.current={listing,current};
  },[current,listing]);
  return h('ol',{ref:list,className:'dbs-result-list',start:listing.from},listing.items.map(item=>{
    const location=item.line===undefined?t('resultPage',{page:item.page}):t('resultLine',{line:item.line});
    return h('li',{key:item.index},h('button',{
      type:'button',className:'dbs-result-item','aria-current':item.index===current?'true':undefined,
      onClick:()=>onSelect(item.index)
    },h('span',{className:'dbs-result-location'},t('resultOrdinal',{ordinal:item.ordinal})+' · '+location),
      h('span',{className:'dbs-result-snippet'},item.leadingEllipsis?'…':'',item.before,
        h('mark',null,item.match,item.matchTruncated?'…':''),item.after,item.trailingEllipsis?'…':'')));
  }));
}
function ReaderEntry(props) {
  const {tab}=props.useTabInfo();
  const key=documentViewKey(props.sessionId,tab.id,props.resourceAddress);
  return h(Reader,{...props,key,viewKey:key,tabSignal:tab.signal});
}
function revealWithinScrollport(node, scope=node) {
  const target=scope?.querySelector('[data-active="true"]');if(!target)return;
  const parent=node.getBoundingClientRect(),rect=target.getBoundingClientRect();
  const top=rect.top-parent.top-node.clientTop+node.scrollTop,left=rect.left-parent.left-node.clientLeft+node.scrollLeft;
  node.scrollTop=listScrollForItem(node.scrollTop,node.clientHeight,top,rect.height);
  node.scrollLeft=listScrollForItem(node.scrollLeft,node.clientWidth,left,rect.width);
}
function Reader({content,resourceAddress,scrollportRef,isPdf,t,viewCache,viewKey,tabSignal}) {
  const [initial]=useState(()=>normalizeViewState(viewCache.read(viewKey)));
  const [view,setView]=useState(()=>({...initial,focusFirst:false,focusSavedMatch:initial.pendingReveal===true}));
  const {query,sensitive,listExpanded}=view;
  const [state,setState]=useState({loading:true,pages:[],doc:null,error:'',source:null,epoch:0});
  const [jumpValue,setJumpValue]=useState(''),[jumpError,setJumpError]=useState('');
  const [coordinator]=useState(()=>createScrollCoordinator(initial));
  const [intentRevision,setIntentRevision]=useState(0);
  const scroll=useRef(null),input=useRef(null),jumpComposing=useRef(false),leaseRef=useRef(null),latestView=useRef(initial);
  const ownerRef=useRef(scrollportRef);ownerRef.current=scrollportRef;
  const ref=useCallback(node=>{scroll.current=node;ownerRef.current?.(node);},[]);
  const jumpErrorId=React.useId(), resultListId=React.useId();
  const data=content.kind==='bytes'?content.data:null;
  const currentSource=useRef(data),displayedPage=useRef(1);currentSource.current=data;
  const saveView=useCallback(()=>leaseRef.current?.save({...latestView.current,...coordinator.snapshot()}),[coordinator]);
  useEffect(()=>{
    const lease=viewCache.retain(viewKey,tabSignal);leaseRef.current=lease;
    return ()=>{lease.save({...latestView.current,...coordinator.snapshot()});lease.release();if(leaseRef.current===lease)leaseRef.current=null;};
  },[viewCache,viewKey,tabSignal,coordinator]);
  useEffect(()=>{
    let disposed=false,task;
    const epoch=coordinator.beginLoad();setIntentRevision(coordinator.revision);
    setJumpValue('');setJumpError('');jumpComposing.current=false;
    setState({loading:true,pages:[],doc:null,error:'',source:data,epoch});
    (async()=>{
      if(!data)throw new Error(t('bytesRequired'));
      if(!isPdf){const text=decodeMarkdown(data);if(!disposed)setState({loading:false,pages:[{text}],doc:null,error:'',source:data,epoch});return;}
      task=pdfjs.getDocument({data:data.slice(),useWorkerFetch:false,CMapReaderFactory,StandardFontDataFactory,isEvalSupported:false,useWasm:false});
      task.onPassword=()=>{if(!disposed)setState({loading:false,pages:[],doc:null,error:t('password'),source:data,epoch});task.destroy().catch(()=>{});};
      const doc=await task.promise;
      const pages=[];
      for(let n=1;n<=doc.numPages;n++){
        if(disposed)return;
        const p=await doc.getPage(n), textContent=await p.getTextContent();
        pages.push({...pdfPageText(textContent.items),content:textContent,metric:normalizedPdfMetric(p.getViewport({scale:1}))});
      }
      if(!disposed)setState({loading:false,pages,doc,error:'',source:data,epoch});
    })().catch(e=>{if(!disposed)setState({loading:false,pages:[],doc:null,error:String(e.message||e),source:data,epoch});});
    return ()=>{disposed=true;task?.destroy().catch(()=>{});};
  },[data,resourceAddress,isPdf,coordinator]);
  const loading=state.source!==data||state.loading,error=state.source===data?state.error:'';
  const ready=!loading&&!error,pages=ready?state.pages:EMPTY_PAGES;
  const results=useMemo(()=>pages.flatMap((p,i)=>findMatches(p.text,query,sensitive).map(m=>({...m,page:i+1}))),[pages,query,sensitive]);
  // Clamp before rendering any page or hit, not in a later effect: the document
  // may have shrunk while its tab was hidden or its source was reloaded.
  const safeView=normalizeViewState(view,ready?{totalMatches:results.length,totalPages:pages.length}:undefined);
  const current=safeView.current,listPage=safeView.listPage;
  const focusedMatch=view.focusFirst?results[0]:view.focusSavedMatch?results[current]:undefined;
  const page=ready&&focusedMatch?focusedMatch.page:safeView.page;
  displayedPage.current=page;

  const position=matchPosition(query,results.length,current,{loading,error});
  const markdownLineStarts=useMemo(()=>isPdf?undefined:buildLineStarts(pages[0]?.text||''),[pages,isPdf]);
  const listing=useMemo(()=>listExpanded&&position.status==='matched'?createResultPage(pages,results,listPage,{isPdf,lineStarts:markdownLineStarts}):null,[listExpanded,position.status,pages,results,listPage,isPdf,markdownLineStarts]);
  const active=position.status==='matched'?results[position.current-1]:undefined;

  useLayoutEffect(()=>{
    latestView.current=normalizeViewState({...view,current,page,listPage});
    if(ready&&(view.current!==current||view.page!==page||view.listPage!==listPage||view.focusFirst||view.focusSavedMatch)) {
      setView(value=>({...value,current,page,listPage,focusFirst:false,focusSavedMatch:false}));
    }
  },[view,current,page,listPage,ready]);
  useEffect(()=>{saveView();},[query,sensitive,current,page,listExpanded,listPage,saveView]);
  const finishReady=useCallback(()=>{
    if(!ready||state.source!==currentSource.current||page!==displayedPage.current||!scroll.current)return;
    const intent=coordinator.plan(state.epoch,intentRevision);if(!intent)return;
    const node=scroll.current;
    if(intent.kind==='restore'){node.scrollTop=intent.scrollTop;node.scrollLeft=intent.scrollLeft;}
    else if(intent.kind==='reveal')revealWithinScrollport(node);
    if(coordinator.complete(state.epoch,intent.token,{scrollTop:node.scrollTop,scrollLeft:node.scrollLeft}))saveView();
  },[ready,state.source,state.epoch,page,intentRevision,coordinator,saveView]);
  useLayoutEffect(()=>{if(!isPdf&&ready)finishReady();},[isPdf,ready,results,intentRevision,finishReady]);
  const captureScroll=event=>{
    if(isPdf||event.target!==event.currentTarget||!ready||state.source!==currentSource.current)return;
    const node=event.currentTarget;
    if(coordinator.capture(state.epoch,{scrollTop:node.scrollTop,scrollLeft:node.scrollLeft}))saveView();
  };
  const changeQuery=(value,nextSensitive=sensitive)=>{
    setIntentRevision(coordinator.reveal());
    setView(previous=>({...previous,query:value,sensitive:nextSensitive,current:0,listPage:0,focusFirst:true,focusSavedMatch:false}));
    setJumpValue('');setJumpError('');jumpComposing.current=false;
  };
  const readingPage=useCallback(next=>setView(previous=>previous.page===next?previous:{...previous,page:next,focusFirst:false,focusSavedMatch:false}),[]);
  const setListPage=next=>setView(previous=>({...previous,listPage:next}));
  const toggleList=()=>setView(previous=>({...previous,listExpanded:!previous.listExpanded,listPage:!previous.listExpanded?Math.floor(Math.max(0,position.current-1)/RESULTS_PAGE_SIZE):previous.listPage}));
  const counterText=position.status==='matched'?t('matchCount',{current:position.current,total:position.total}):t({idle:'idle',empty:'noMatches',loading:'indexing',error:'searchUnavailable'}[position.status]);
  // Every explicit navigation supersedes a pending scroll restoration.
  const selectMatch=index=>{
    const target=results[index];if(!target)return;
    setIntentRevision(coordinator.reveal());
    setView(previous=>({...previous,current:index,page:target.page,listPage:Math.floor(index/RESULTS_PAGE_SIZE),focusFirst:false,focusSavedMatch:false}));
    setJumpError('');
  };
  const move=delta=>{if(!results.length)return;setJumpError('');selectMatch(nextMatchIndex(current,delta,results.length));};
  const jump=()=>{
    if(jumpComposing.current||position.status!=='matched')return;
    const target=matchJumpTarget(jumpValue,results);
    if(!target.ok){setJumpError(target.error);return;}
    setJumpError('');setJumpValue(String(target.ordinal));selectMatch(target.index);
  };
  const button=(label,click,disabled)=>h('button',{type:'button',onClick:click,disabled,'aria-label':label,title:label},label);
  return h('section',{className:'dbs-root',onKeyDown:e=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='f'){e.preventDefault();e.stopPropagation();input.current?.focus();input.current?.select();}
  }},h('style',null,css),
    h('div',{className:'dbs-toolbar'},h('label',null,t('find'),h('input',{ref:input,type:'search',value:query,placeholder:t('placeholder'),disabled:loading||!!error,onChange:e=>changeQuery(e.target.value),onKeyDown:e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing){e.preventDefault();move(e.shiftKey?-1:1);}if(e.key==='Escape'){changeQuery('');e.stopPropagation();}}})),
      h('label',null,h('input',{type:'checkbox',checked:sensitive,onChange:e=>changeQuery(query,e.target.checked)}),t('case')),
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
      h('button',{type:'button','aria-expanded':listExpanded,'aria-controls':resultListId,disabled:position.status!=='matched'&&!listExpanded,onClick:toggleList},t(listExpanded?'hideResults':'showResults')),
      isPdf&&position.status==='matched'&&active&&h('span',{className:'dbs-match-page'},t('matchPage',{page:active.page})),
      jumpError&&h('span',{id:jumpErrorId,className:'dbs-jump-error',role:'alert'},t(jumpError,{total:position.total}))),
    listExpanded&&h('section',{id:resultListId,className:'dbs-result-panel','aria-label':t('resultsTitle')},
      listing?h(React.Fragment,null,h('div',{className:'dbs-toolbar'},
        h('span',{'aria-live':'polite'},t('resultRange',{from:listing.from,to:listing.to,total:listing.total})),
        button(t('previousResults'),()=>setListPage(listing.page-1),listing.page===0),
        button(t('nextResults'),()=>setListPage(listing.page+1),listing.page+1>=listing.pageCount)),
        h(ResultList,{listing,current:position.current-1,t,onSelect:selectMatch})):
        h('p',{className:'dbs-note'},counterText)),

    h('p',{className:'dbs-note'},t(isPdf?'pdfNote':'mdNote')),
    h('div',{className:isPdf?'dbs-scroll dbs-pdf-scroll':'dbs-scroll',ref,onScroll:captureScroll},
      loading?h('p',{role:'status'},t('loading')):error?h('p',{role:'alert'},t('error')+' '+error):isPdf?
        h(React.Fragment,null,!pages.some(p=>p.text.trim())&&h('p',{className:'dbs-scanned-note',role:'status'},t('scanned')),pages.length>0&&h(ContinuousPdf,{doc:state.doc,pages,results,current,source:data,epoch:state.epoch,intentRevision,coordinator,scrollRef:scroll,saveView,onReadingPage:readingPage,t})):
        h('pre',{className:'dbs-markdown'},marks(pages[0]?.text||'',results,position.current-1))));
}
module.exports={inject:['slots','documentPreviews','locale'],apply(ctx){
  const viewCache=createViewStateCache();
  ctx.effect(()=>()=>viewCache.dispose());
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
    ctx.effect(()=>ctx.slots.inject('sidebar.right.tab.document',()=>ctx.slots.register({name:'sidebar.right.tab.document',key:id,locale:'documentSearch'},props=>h(ReaderEntry,{...props,isPdf,viewCache}))));
  }
}};
