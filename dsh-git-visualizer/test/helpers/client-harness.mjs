import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../../client.js',import.meta.url),'utf8');
export function nodes(node){if(!node||typeof node!=='object')return[];return[node,...(node.children||[]).flat(Infinity).flatMap(nodes)];}
export function text(node){return typeof node==='string'?node:typeof node==='number'?String(node):node&&typeof node==='object'?(node.children||[]).flat(Infinity).map(text).join(''):'';}
export function memoryStorage(){const items=new Map();return {getItem:key=>items.get(key)??null,setItem:(key,value)=>items.set(key,value),removeItem:key=>items.delete(key)};}
export async function harness(transport,{storage=memoryStorage()}={}){
 const state=[],refs=[],effects=[],pending=[],calls=[];let si=0,ri=0,ei=0,App,plugin;
 const React={Fragment:'fragment',createElement:(type,props,...children)=>({type,props:props||{},children}),
  useState:initial=>{const i=si++;if(!(i in state))state[i]=initial;return[state[i],v=>{state[i]=typeof v==='function'?v(state[i]):v;}];},
  useRef:initial=>{const i=ri++;return refs[i]??={current:initial};},
  useEffect:(fn,deps)=>{const i=ei++,previous=effects[i];if(!previous||deps.some((d,j)=>d!==previous.deps[j])){previous?.cleanup?.();effects[i]={deps};pending.push(()=>{effects[i].cleanup=fn();});}}
 };
 const fetch=async(url,options)=>{const body=JSON.parse(options.body),action=new URL(url).pathname.split('/').pop();calls.push({action,...body});return transport(action,body);};
 vm.runInNewContext(source,{URL,document:{baseURI:'http://localhost/'},fetch,window:{sessionStorage:storage,__ModuleLoader__:{load:entry=>{plugin=entry.factory(()=>React);plugin.apply({effect:fn=>fn(),sidebarRightTabs:{register:()=>{}},slots:{inject:(_,fn)=>fn(),register:(meta,component)=>{if(meta.name==='sidebar.right.pane.tab')App=component;}}});}}}});
 const render=(id='session-test')=>{si=ri=ei=0;const tree=App({sessionId:id});pending.splice(0).forEach(fn=>fn());return tree;};
 const flush=async()=>{for(let i=0;i<45;i++)await Promise.resolve();};
 const button=(tree,label)=>nodes(tree).find(n=>n.type==='button'&&(text(n)===label||n.props['aria-label']===label));
 const dispose=()=>effects.forEach(effect=>effect.cleanup?.());
 return {render,flush,calls,button,storage,dispose,parsePatch:plugin.parsePatch};
}
export const ok=value=>({ok:true,json:async()=>value});
export const repos={workspaceRoot:'D:/workspace',repositories:[{id:'alpha',name:'alpha',depth:1,kind:'repository'},{id:'group/beta',name:'beta',depth:2,kind:'repository'}],warnings:[],truncated:false};
export const snapshot=branch=>({branch,status:[{path:'file.txt',index:' ',worktree:'M'}],commits:[],branches:['alpha','beta']});
export const metadata=branch=>({head:'a'.repeat(40),branch,upstream:'origin/main',ahead:1,behind:0,remotes:[{name:'origin'}],clean:false,conflicts:false});
export const overview=branch=>({snapshot:snapshot(branch),details:metadata(branch)});
