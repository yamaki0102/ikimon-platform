/** Deterministic native packaging. No npm dependencies or runtime GitHub/AI calls. */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
const args=new Map();
for(let i=2;i<process.argv.length;i+=2){if(!['--source-sha','--source-tree','--asset-bundle'].includes(process.argv[i])||!process.argv[i+1])throw Error('Unknown or missing build argument');args.set(process.argv[i],process.argv[i+1]);}
const sha=args.get('--source-sha'),tree=args.get('--source-tree');
if(!/^[a-f0-9]{40}$/.test(sha||'')||!/^[a-f0-9]{40}$/.test(tree||''))throw Error('An independently verified exact source commit and tree are required');
const assetCommit='df908632e317b5aaf8316589ab9d31b5290dc0d0';
const expected={hero:{file:'ryuyo-hero.webp',sha256:'b5f06f7c1ae784d78942b6c638eadeaded8d9c5d63e5dc4669cb504114e9f724',bytes:411318,width:1600,height:900},discovery:{file:'ryuyo-discovery.webp',sha256:'7b84615c811fa1dcbe0a8f4b89c6fdfa805672f35a8cc729026a11dcbefd570a',bytes:111504,width:800,height:800},memories:{file:'ryuyo-memories.webp',sha256:'160f8d5b3419ea696506923665ce6ae3b21adcd6d0b0d801259f947f6fb70d1f',bytes:92844,width:800,height:800}};
const digest=v=>createHash('sha256').update(v).digest('hex');
const supplied=args.has('--asset-bundle')?JSON.parse(await readFile(args.get('--asset-bundle'),'utf8')):null;
if(supplied&&(supplied.schema!=='zukan.public-program-asset-bundle/v1'||supplied.commit!==assetCommit||supplied.repository!=='yamaki0102/ikimon-platform'))throw Error('Asset bundle source identity mismatch');
const assets={};
for(const [id,s] of Object.entries(expected)){
 let bytes;
 if(supplied){if(!supplied.assets?.[id]?.base64)throw Error('Missing asset: '+id);bytes=Buffer.from(supplied.assets[id].base64,'base64');}
 else {const response=await fetch(`https://raw.githubusercontent.com/yamaki0102/ikimon-platform/${assetCommit}/platform_v2/public/assets/event-discovery/${s.file}`);if(!response.ok)throw Error('Asset fetch failed: '+id+' '+response.status);bytes=Buffer.from(await response.arrayBuffer());}
 if(bytes.length!==s.bytes||digest(bytes)!==s.sha256)throw Error('Asset integrity mismatch: '+id);
 assets[id]={base64:bytes.toString('base64'),sha256:s.sha256,mime:'image/webp',width:s.width,height:s.height};
}
const source=await readFile(path.join(root,'program.mjs'),'utf8');
const bundle=JSON.stringify({schema:'zukan.public-program-asset-bundle/v1',repository:'yamaki0102/ikimon-platform',commit:assetCommit,assets});
const identity={repository:'yamaki0102/ikimon-platform',sha,tree,moduleSha256:digest(source),assetsSourceCommit:assetCommit,assetBundleSha256:digest(bundle),surface:'public-program-trial'};
const worker=source+'\nexport default createWorker('+JSON.stringify(assets)+','+JSON.stringify(identity)+');\n';
await mkdir(path.join(root,'dist'),{recursive:true});
await writeFile(path.join(root,'dist','worker.mjs'),worker);
await writeFile(path.join(root,'dist','build.json'),JSON.stringify({schema:'zukan.public-program-build/v1',source:identity,workerSha256:digest(worker),bytes:Buffer.byteLength(worker),serverUploads:false},null,2)+'\n');
console.log(JSON.stringify({source:sha,workerSha256:digest(worker),bytes:Buffer.byteLength(worker)}));
