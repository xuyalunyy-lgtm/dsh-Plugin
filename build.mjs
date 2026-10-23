import {build} from 'esbuild';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
const root=path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/,'$1'));
process.chdir(root);
const base='node_modules/pdfjs-dist';
const assets={};
for(const dir of ['cmaps','standard_fonts']){
  for(const name of await readdir(`${base}/${dir}`)){
    if(name==='LICENSE')continue;
    assets[`${dir}/${name}`]=(await readFile(`${base}/${dir}/${name}`)).toString('base64');
  }
}
await writeFile('src/pdf-assets.json',JSON.stringify(assets));
await writeFile('THIRD-PARTY-NOTICES.txt','Original icon and plugin code: workspace author.\nPDF.js and adapted text layer CSS: Mozilla Foundation, Apache-2.0.\n\n'+await readFile(`${base}/LICENSE`,'utf8')+'\n\nCMap license:\n'+await readFile(`${base}/cmaps/LICENSE`,'utf8')+'\n\nStandard font licenses:\n'+await readFile(`${base}/standard_fonts/LICENSE_FOXIT`,'utf8')+'\n'+await readFile(`${base}/standard_fonts/LICENSE_LIBERATION`,'utf8'));
await build({entryPoints:['src/client.cjs'],outfile:'client.js',bundle:true,platform:'browser',format:'cjs',target:'chrome120',external:['react'],legalComments:'inline',loader:{'.css':'text'},plugins:[{name:'local-worker-source',setup(b){b.onLoad({filter:/pdf\.worker\.mjs$/},async args=>({contents:await readFile(args.path,'utf8'),loader:'text'}));}}],banner:{js:"window.__ModuleLoader__.load({id:'@local/dsh-document-body-search',factory(require){var module={exports:{}};var exports=module.exports;"},footer:{js:'return module.exports;}});'}});
console.log('Built local PDF worker, '+Object.keys(assets).length+' support assets, and document search client.');
