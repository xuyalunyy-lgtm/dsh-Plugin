import test from 'node:test';
import assert from 'node:assert/strict';
import {findMatches,pdfPageText,intersections,decodeMarkdown} from '../src/search.mjs';
test('empty, literal regex, Chinese, case, original offsets',()=>{
 assert.deepEqual(findMatches('abc',''),[]);
 assert.deepEqual(findMatches('a.b aXb','a.b'),[{start:0,end:3}]);
 assert.deepEqual(findMatches('中文 中文','中文'),[{start:0,end:2},{start:3,end:5}]);
 assert.equal(findMatches('AaA','a').length,3);
 assert.equal(findMatches('AaA','a',true).length,1);
 assert.deepEqual(findMatches('İABC abc','abc'),[{start:1,end:4},{start:5,end:8}]);
});
test('cross-span matching with EOL and intersection mapping',()=>{
 const p=pdfPageText([{str:'中'},{str:'文ABC',hasEOL:true},{str:'ABC'}]);
 assert.equal(p.text,'中文ABC\nABC');
 const m=findMatches(p.text,'中文');
 assert.deepEqual(intersections(1,5,m),[{start:0,end:1,index:0}]);
 assert.equal(findMatches(p.text,'CABC').length,0);
});
test('complete UTF8 and UTF16 with invalid input rejected',()=>{
 assert.equal(decodeMarkdown(new TextEncoder().encode('# 中文')),'# 中文');
 assert.equal(decodeMarkdown(new Uint8Array([255,254,65,0])),'A');
 assert.throws(()=>decodeMarkdown(new Uint8Array([255])));
});
