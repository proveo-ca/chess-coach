// SPEC: _spec/tooling/native-ingress/step2.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { createSdkPayloadInspectionFixture, SDK_PAYLOAD_TARGETS as targets, SDK_PAYLOAD_ROOT as root } from './sdk-payload-inspection.mjs';
import { SDK_PAYLOAD_SOURCE_PINS as pins, transformSdkPayloadCoreSource, runRegisteredSdkPayloadInspection } from './sdk-payload-inspection-operation.mjs';

const read=name=>fs.readFileSync(new URL('./'+name+'.mjs',import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex');
const uri=b=>'data:text/javascript;base64,'+Buffer.from(b).toString('base64');
const link=(b,name,dependency)=>Buffer.from(b.toString().replace("from './"+name+".mjs'","from '"+dependency+"'"));
const names=['tar-inventory','elf-metadata','xz-staging','gnu-sdk-inventory','gnu-sdk-inventory-v2-operation','gnu-sdk-inventory-v4-operation','elf-requirements-v3','sdk-payload-inspection'];
const captured=new Map(names.map(name=>[name,read(name)])),source=read('sdk-payload-inspection-operation').toString();
const receiptBytes=fs.readFileSync(new URL('../../_spec/tooling/native-ingress/xz-qualification.receipt.json',import.meta.url));
const [v2,v4]=await Promise.all([import(uri(captured.get('gnu-sdk-inventory-v2-operation'))),import(uri(captured.get('gnu-sdk-inventory-v4-operation')))]);
const tarSource=v4.transformTarInventoryV4Source(captured.get('tar-inventory'));
const eventCore=v2.transformSdkInventoryV2Source(captured.get('gnu-sdk-inventory')),core=transformSdkPayloadCoreSource(eventCore);
const tarLinkedAdapter=link(captured.get('sdk-payload-inspection'),'tar-inventory',uri(tarSource));
const adapterSource=link(tarLinkedAdapter,'elf-requirements-v3',uri(captured.get('elf-requirements-v3'))),adapterUri=uri(adapterSource);
const pipelineSource=link(core,'tar-inventory',adapterUri);
const archive=Buffer.from('0123456789');
const expectedSummary=Object.freeze({expandedBytes:47104,headers:45,entries:45,extensionBytes:0,outputBytes:7592,collisionBytes:3416,dataEvents:1,
  metadataSha256:'8f05c471b5dc2703300ca18a09190cefdffac06f92994c163cb17a141c5456a9'});
const expectedDecodedSha256='d708b51922d212fdd281364583bc6a037ba662f492bc705816eae37eeb899b30';
function fixture(options={}) {
  const elf=rel=>{const b=Buffer.alloc(rel?128:512);b.set([127,69,76,70,2,1,1]);b.writeUInt16LE(rel?1:2,16);b.writeUInt16LE(62,18);
    b.writeUInt32LE(1,20);b.writeUInt16LE(64,52);b.writeUInt16LE(rel?0:56,54);
    if(rel){b.writeBigUInt64LE(64n,40);b.writeUInt16LE(64,58);b.writeUInt16LE(1,60);}return b;};
  const spans=[],members=[];
  for(const [i,row] of targets.entries()) {
    let body;
    if(row.kind==='ELF_EXEC_DSO')body=elf(false);
    else if(row.kind==='ET_REL')body=elf(true);
    else if(row.kind==='LINKER_TEXT')body=Buffer.from('GROUP ( /lib64/libc.so.6 AS_NEEDED ( -lgcc ) )'.padEnd(110,' '));
    else {const field=(s,n)=>String(s).padEnd(n,' ');body=Buffer.concat([Buffer.from('!<arch>\n'+field('object.o/',16)+field(0,12)+field(0,6)+field(0,6)+field('644',8)+field(128,10)+'`\n'),elf(true)]);}
    const h=Buffer.alloc(512),path=root+'/'+row.path,slash=path.lastIndexOf('/');
    if(Buffer.byteLength(path)<=100)h.write(path,0,100);else{h.write(path.slice(slash+1),0,100);h.write(path.slice(0,slash),345,155);}
    for(const [at,n,v] of [[100,8,0o644],[108,8,1000],[116,8,1000],[124,12,body.length],[136,12,0]])h.write(v.toString(8).padStart(n-1,'0')+'\0',at,n,'ascii');
    h[156]=48;h.write('ustar\0',257,6);h.write('00',263,2);h.fill(32,148,156);
    h.write(h.reduce((a,b)=>a+b,0).toString(8).padStart(6,'0')+'\0 ',148,8,'ascii');
    spans.push({path:row.path,index:i+1,bodyOffset:i*1024+512,size:body.length});
    members.push(h,body,Buffer.alloc(512-body.length));
  }
  const bytes=Buffer.concat([...members,Buffer.alloc(1024)]);
  assert.equal(sha(bytes),expectedDecodedSha256);
  if(options.payloadFailureKind){
    const ordinal=targets.findIndex(row=>row.kind===options.payloadFailureKind),at=spans[ordinal].bodyOffset;
    if(options.payloadFailureKind==='ELF_EXEC_DSO')bytes.writeUInt16LE(129,at+56);
    else if(options.payloadFailureKind==='ET_REL')bytes.writeUInt16LE(2,at+16);
    else if(options.payloadFailureKind==='AR')bytes.write('#1/PRIVATE_NAME'.padEnd(16),at+8);
    else{bytes.fill(32,at,at+spans[ordinal].size);bytes.write('INCLUDE(/PRIVATE_REFERENCE)',at);}
  }
  return {bytes,api:createSdkPayloadInspectionFixture({targets:spans,expectedSummary,expectedDecodedSha256,limits:{}})};
}
function harness(pipeline,f,options,clock,log) {
  const stats={root:{dev:11n,ino:101n,mode:0o40700n,uid:1000n,gid:1000n,nlink:2n,size:4096n,mtimeNs:100n,ctimeNs:101n},
    file:{dev:22n,ino:202n,mode:0o100600n,uid:1000n,gid:1000n,nlink:1n,size:10n,mtimeNs:200n,ctimeNs:201n}};
  const identity=Object.fromEntries(Object.entries(stats).map(([kind,values])=>[kind,Object.fromEntries(Object.entries(values).map(([key,value])=>[key,String(value)]))]));
  const kind=path=>path===pipeline.GNU_SDK_DESCRIPTOR.root?'root':path===pipeline.GNU_SDK_DESCRIPTOR.file?'file':assert.fail('unexpected path');
  let reads=0;
  const io={
    lstatSync:path=>{if(options.earlyFsFailure)throw new Error('mock early fs');return {...stats[kind(path)]};},fstatSync:fd=>({...stats[fd===41?'root':'file']}),openSync:path=>kind(path)==='root'?41:42,
    readSync(fd,buffer,offset,length,position){assert.equal(fd,42);log.archiveReads.push([position,length]);reads++;
      if(options.archiveHashFailure&&reads===1){buffer.fill(0,offset,offset+length);return length;}
      if(options.secondHashFailure&&reads===3){buffer.fill(0,offset,offset+length);return length;}
      return archive.copy(buffer,offset,position,position+length);},
    closeSync(fd){log.closes.push(fd);if(options.closeFailure&&fd===42)throw new Error('mock close');},
  };
  function spawn(...args) {
    log.spawns.push(args);log.order.push('spawn');assert.deepEqual(log.archiveReads.slice(0,2),[[0,10],[10,1]]);
    const child=new EventEmitter();for(const name of ['stdin','stdout','stderr'])child[name]=new EventEmitter();
    child.stdin.write=(bytes,callback)=>{assert.ok(Buffer.isBuffer(bytes));queueMicrotask(callback);return true;};
    child.kill=signal=>{log.kills.push(signal);queueMicrotask(()=>child.emit('close',null,signal));};
    child.stdin.end=()=>{
      child.stdin.emit('finish');child.stdout.emit('data',f.bytes);if(log.kills.length)return;
      if(!options.missingStdoutEof)child.stdout.emit('end');child.stderr.emit('end');child.stdout.emit('close');child.stderr.emit('close');
      child.emit('exit',options.badExit?1:0,null);child.emit('close',options.badExit?1:0,null);child.stdin.emit('close');
    };
    queueMicrotask(()=>{assert.equal(child.stdout.listenerCount('data'),1);child.emit('spawn');assert.equal(child.stdout.listenerCount('data'),2);});return child;
  }
  async function run(deps) {
    assert.equal(log.repoOwned,0);assert.equal(log.repoCloses.length,9);
    log.coreCalls++;
    const result=await pipeline.createSdkInventoryFixtureRunner({archiveBytes:10,archiveSha256:sha(archive)},{fs:io,spawn,now:()=>clock.value,...deps})(identity);
    log.order.push('core-complete');
    if(options.lateCoreFailure)throw Object.assign(new Error('E_CLOSE'),{code:'E_CLOSE'});
    if(options.expireCore)clock.value=160000;
    if(options.secondSpawn)deps.spawn('forbidden-second-child');
    return options.coreResult?options.coreResult(result):result;
  }
  return {spawn,run};
}
function repoFs(options,clock,log) {
  const prefix='/tmp/opencode/f9-bootstrap-correspondence',records=new Map(),owned=new Map();
  const rootStat={dev:17n,ino:2000n,mode:0o40700n,uid:1000n,gid:1000n,nlink:3n,size:4096n,mtimeNs:100n,ctimeNs:101n};
  for(const [i,name] of [...names,'receipt'].entries()) {
    const path=name==='receipt'?prefix+'/_spec/tooling/native-ingress/xz-qualification.receipt.json':prefix+'/tooling/native-ingress/'+name+'.mjs';
    let bytes=name==='receipt'?receiptBytes:captured.get(name);
    if(options.corrupt===name){bytes=Buffer.from(bytes);bytes[100]^=1;}
    if(name==='receipt'&&options.receiptFailure)bytes=Buffer.from('bad');
    if(name==='receipt'&&options.receiptHashFailure){bytes=Buffer.from(bytes);bytes[100]^=1;}
    records.set(path,{name,path,bytes,namedCalls:0,stat:{dev:18n,ino:3000n+BigInt(i),mode:0o100644n,uid:1000n,gid:1000n,nlink:1n,
      size:BigInt(bytes.length),mtimeNs:200n,ctimeNs:201n}});
  }
  const target=record=>record.name===(options.repoFaultName??'tar-inventory');
  function unknownFailure() {throw Object.defineProperty(new Error('PRIVATE_REPO_IO'),'code',{get(){assert.fail('I/O code getter');}});}
  let fd=1000,rootChecks=0;
  return {
    constants:Object.freeze({O_RDONLY:0,O_NOFOLLOW:131072,O_NONBLOCK:2048}),
    readFileSync(){assert.fail('unbounded or native repository read route');},
    lstatSync(path,args){
      assert.deepEqual(args,{bigint:true});log.repoStats.push(['named',path]);
      if(path===prefix){
        rootChecks++;if(options.repoIoFailure==='root')unknownFailure();
        return {...rootStat,...(options.repoRootSymlink?{mode:0o120777n}:{}),...(options.repoRootDrift&&rootChecks===2?{ino:2001n}:{})};
      }
      const record=records.get(path);assert.ok(record,'fixed repository path');record.namedCalls++;
      if(target(record)&&options.repoIoFailure==='named')unknownFailure();
      const stat={...record.stat};
      if(target(record)){
        if(options.repoOversized)stat.size=1n<<60n;
        if(options.repoSymlink)stat.mode=0o120777n;
        if(options.repoFifo)stat.mode=0o10600n;
        if(options.repoNamedDrift&&record.namedCalls===2)stat.ino++;
      }
      return stat;
    },
    openSync(path,flags){
      const record=records.get(path);assert.ok(record,'fixed repository open');
      assert.equal(flags,131072|2048);assert.equal(owned.size,0,'only one repository FD at a time');
      log.sourceReads.push(path);log.repoOpenFlags.push(flags);
      if(target(record)&&(options.repoIoFailure==='open'||options.repoOpenSymlink))unknownFailure();
      const next=++fd;owned.set(next,{record,fdChecks:0});log.repoOwned=owned.size;
      if(options.slowCapture)clock.value=10000;return next;
    },
    fstatSync(fd,args){
      assert.deepEqual(args,{bigint:true});const entry=owned.get(fd);assert.ok(entry,'owned repository stat');entry.fdChecks++;
      log.repoStats.push(['fd',fd]);const {record}=entry;
      if(target(record)&&options.repoIoFailure==='fd')unknownFailure();
      const stat={...record.stat};
      if(target(record)){
        if(options.repoFdOversized)stat.size=1n<<60n;
        if(options.repoFdFifo)stat.mode=0o10600n;
        if(options.repoFdBeforeDrift)stat.uid++;
        if(options.repoDriftField&&entry.fdChecks===2)stat[options.repoDriftField]+=options.repoDriftField==='mode'?0o100n:1n;
        if(options.repoMetadataGetter)Object.defineProperty(stat,'uid',{get(){assert.fail('metadata getter');}});
      }
      return stat;
    },
    readSync(fd,buffer,offset,length,position){
      const {record}=owned.get(fd)??{};assert.ok(record,'owned repository read');
      assert.equal(offset,position);assert.ok(length>0&&length<=65536);assert.ok(buffer.length===record.bytes.length+1);
      log.repoReads.push({path:record.path,fd,position,length});
      if(target(record)&&options.repoIoFailure==='read')unknownFailure();
      if(target(record)&&options.repoInvalidRead)return length+1;
      let n;
      if(target(record)&&options.repoExtraByte&&position===record.bytes.length){buffer[offset]=120;n=1;}
      else {
        const end=target(record)&&options.repoEarlyEof?record.bytes.length-1:record.bytes.length;
        n=record.bytes.copy(buffer,offset,position,Math.min(position+length,end,position+(options.repoChunkBytes??length)));
      }
      if(target(record)&&(options.repoReadDeadline||(options.repoEofDeadline&&position===record.bytes.length)))clock.value=10000;
      return n;
    },
    closeSync(fd){
      const {record}=owned.get(fd)??{};assert.ok(record,'single repository close authority');
      owned.delete(fd);log.repoOwned=owned.size;log.repoCloses.push(fd);
      if(target(record)&&(options.repoCloseFailure||options.repoIoFailure==='close'))unknownFailure();
      if(target(record)&&options.repoCloseDeadline)clock.value=10000;
    },
  };
}
let serial=0;
async function mocked(options={}) {
  const f=fixture(options),clock={value:0},log={sourceReads:[],archiveReads:[],closes:[],spawns:[],kills:[],order:[],coreCalls:0,stages:0,preloads:0,acceptCalls:0,getCalls:0,attemptReads:0,
    repoOwned:0,repoCloses:[],repoOpenFlags:[],repoStats:[],repoReads:[],repoAllocations:[],sourceUris:0};
  const key='__payloadOperationMock'+ ++serial;let nowCalls=0;
  const d={
    now(){nowCalls++;if(options.preflightExpired&&nowCalls>=2)return 10000;if(options.invalidClock&&nowCalls>=2)return NaN;return clock.value;},
    fs:repoFs(options,clock,log),
    repoAlloc(n){log.repoAllocations.push(n);return Buffer.alloc(n);},
    sourceUri(){log.sourceUris++;},
    verifyStagedXzImages(){log.stages++;if(options.stageFailure||(options.lateStageFailure&&log.stages===2))throw new Error('mock stage');
      return {counters:{fsCalls:10,readBytes:options.stageOverflow?5516433:100,closeAttempts:5}};},
    assertNoSystemPreload(){log.preloads++;return !options.preloadFailure&&!(options.latePreloadFailure&&log.preloads===2);},
    beginPayloadPass:()=>f.api.beginPayloadPass(),createTarInventory:overrides=>f.api.createTarInventory(overrides),
    acceptPayloadPass(value){log.acceptCalls++;log.order.push('payload-accept');return f.api.acceptPayloadPass(value);},
    getPayloadData(){log.getCalls++;const value=f.api.getPayloadData();log.order.push('payload-release');if(options.publicationExpired)clock.value+=30000;
      return options.outputOverflow?{...value,mockPadding:'π'.repeat(400000)}:value;},
    abortPayloadInspection:()=>f.api.abortPayloadInspection(),
    SDK_PAYLOAD_TARGETS:Object.freeze(targets.map((row,i)=>Object.freeze({...row,index:i+1}))),
    getFailedTargetAttempt(){log.attemptReads++;const value=f.api.getFailedTargetAttempt();return options.attemptOverride?options.attemptOverride(value):value;},
  };
  globalThis[key]=d;
  const dependencyUri=uri(`const d=globalThis[${JSON.stringify(key)}];export default d.fs;export const fixtureNow=()=>d.now();
    export const fixtureRepoAlloc=n=>d.repoAlloc(n);export const fixtureSourceUri=()=>d.sourceUri();export const spawn=(...args)=>d.spawn(...args);
    export const verifyStagedXzImages=d.verifyStagedXzImages;export const assertNoSystemPreload=d.assertNoSystemPreload;
    export const runGnuSdkInventory=(...args)=>d.runGnuSdkInventory(...args);export const beginPayloadPass=d.beginPayloadPass;
    export const createTarInventory=d.createTarInventory;export const acceptPayloadPass=d.acceptPayloadPass;
    export const getPayloadData=d.getPayloadData;export const abortPayloadInspection=d.abortPayloadInspection;
    export const SDK_PAYLOAD_TARGETS=d.SDK_PAYLOAD_TARGETS;export const getFailedTargetAttempt=d.getFailedTargetAttempt;`);
  try {
    const pipeline=await import(uri(link(core,'tar-inventory',dependencyUri))),h=harness(pipeline,f,options,clock,log);
    d.spawn=h.spawn;d.runGnuSdkInventory=async(identity,deps)=>{assert.equal(identity.file.size,'102296280');assert.equal(identity.root.ino,'13894');return h.run(deps);};
    let text=source.replace("from 'node:fs'","from '"+dependencyUri+"'").replace("from 'node:child_process'","from '"+dependencyUri+"'")
      .replaceAll('performance.now()','fixtureNow()').replace('import(uri(stageSource))','import('+JSON.stringify(dependencyUri)+')')
      .replace('import(uri(pipelineSource))','import('+JSON.stringify(dependencyUri)+')').replace('import(collectorUri)','import('+JSON.stringify(dependencyUri)+')');
    assert.equal(text.split('Buffer.alloc(pin.bytes + 1)').length,2);
    const uriNeedle="const uri = bytes => 'data:text/javascript;base64,' + bytes.toString('base64');";
    assert.equal(text.split(uriNeedle).length,2);
    text=text.replace(uriNeedle,"const uri = bytes => { fixtureSourceUri(); return 'data:text/javascript;base64,' + bytes.toString('base64'); };");
    text=`import { fixtureNow, fixtureRepoAlloc, fixtureSourceUri } from '${dependencyUri}';\n`+text.replace('Buffer.alloc(pin.bytes + 1)','fixtureRepoAlloc(pin.bytes + 1)');
    if(options.badLinkedPin)text=text.replace('const adapterSource = pinned(link(tarLinkedAdapter,','const adapterSource = pinned(link(Buffer.concat([tarLinkedAdapter, Buffer.from(" ")]),');
    if(!options.productionGuards)for(const [from,to] of [
      ['value.mockOnly !== false','value.mockOnly !== true'],['value.archiveBytes !== 102296280','value.archiveBytes !== 10'],
      ["value.archiveSha256 !== 'cde893afab04ac7dcd15c46aac214ff550441b982536124c88a71146a0eeedd3'","value.archiveSha256 !== '"+sha(archive)+"'"],
      ['value.archiveDataBytes !== 204592560','value.archiveDataBytes !== 20'],['value.archiveRequestedBytes !== 204592562','value.archiveRequestedBytes !== 22'],
      ['result.mockOnly !== false','result.mockOnly !== true'],['result.capturedBytes !== 184285137','result.capturedBytes !== 16730'],
      ["result.decodedSha256 !== '5e7f960281fb93121982f95976eb59ed980e009b54aabf993d5d3fa2982e056f'","result.decodedSha256 !== '"+expectedDecodedSha256+"'"],
      ["profile: 'registered-sdk-payload-inspection-v1'","profile: 'mock-sdk-payload-inspection-v1'"],['realArchiveInspected: !error','realArchiveInspected: false'],
    ]){assert.equal(text.split(from).length,2);text=text.replace(from,to);}
    const operation=await import(uri(text));assert.equal(log.sourceReads.length,0);
    return {f,log,run:async()=>{const response=await operation.runRegisteredSdkPayloadInspection();return {response,packet:JSON.parse(response.text)};}};
  } finally {delete globalThis[key];}
}
const stopped=value=>{assert.equal(value.response.exitCode,1);assert.equal(value.packet.status,'STOP');assert.equal(Object.hasOwn(value.packet,'result'),false);assert.equal(value.packet.realArchiveInspected,false);
  assert.doesNotMatch(value.response.text,/"members"|"capturedBytes"|"decodedSha256"|"unsafeLoadingTags"/);};

test('source graph pins bind every raw, intermediate, and fully linked private image',()=>{
  const images={adapter:captured.get('sdk-payload-inspection'),elfV3:captured.get('elf-requirements-v3'),eventCore,metadataCore:core,transformedTar:tarSource,
    linkedStage:link(captured.get('xz-staging'),'elf-metadata',uri(captured.get('elf-metadata'))),tarLinkedAdapter,linkedAdapter:adapterSource,linkedPipeline:pipelineSource};
  for(const [key,b] of Object.entries(images))assert.deepEqual({bytes:b.length,sha256:sha(b)},pins[key]);
});
test('production import is inert and the registered operation has zero arguments',()=>{
  assert.equal(runRegisteredSdkPayloadInspection.length,0);
  assert.doesNotMatch(source,/await runRegisteredSdkPayloadInspection|process\.(?:env|argv)|\b(?:fetch|eval|writeFileSync|mkdirSync|unlink|rmSync|execFileSync)\s*\(/);
  assert.doesNotMatch(source,/runRegisteredGnuSdk(?:Inventory|SubsetCatalog|Driver|Controls)/);
  assert.equal(captured.get('sdk-payload-inspection').toString().split("from './tar-inventory.mjs'").length,2);
  assert.equal(captured.get('sdk-payload-inspection').toString().split("from './elf-requirements-v3.mjs'").length,2);
  assert.equal(pipelineSource.toString().split("from '"+adapterUri+"'").length,2);
});
test('private core changes only 4 MiB summary after unchanged event transform',()=>{
  assert.deepEqual(Buffer.from(core.toString().replace('maxSummaryBytes: 4_194_304','maxSummaryBytes: 262_144')),eventCore);
  assert.match(core.toString(),/maxTotalMs: 120_000, cleanupMs: 3000/);assert.match(core.toString(),/maxStreamEvents: 262_144/);
  assert.match(source,/function guard\(limit = 160000\)/);assert.match(source,/started \+ 160000 - guard\(\) < 150000/);
  assert.match(source,/publicationStarted >= 30000/);assert.match(source,/guard\(10000\)/);
});
test('private transform rejects altered, transformed, shared and proxy images without getters',()=>{
  const bad=Buffer.from(eventCore);bad[100]^=1;const shared=Buffer.from(new SharedArrayBuffer(eventCore.length));shared.set(eventCore);
  for(const bytes of [bad,core,shared,new Proxy(eventCore,{get(){assert.fail('proxy getter');}})])assert.throws(()=>transformSdkPayloadCoreSource(bytes),{code:'E_SOURCE_PIN'});
});
test('one mock child completes two hash/EOF passes and positive FD closes before publication',async()=>{
  const m=await mocked(),{response,packet}=await m.run();assert.equal(response.exitCode,0);assert.ok(Object.isFrozen(response));assert.equal(packet.status,'SDK_PAYLOAD_DATA_INSPECTED');
  assert.equal(packet.result.members.length,45);assert.equal(m.log.coreCalls,1);assert.equal(m.log.spawns.length,1);
  assert.deepEqual(m.log.archiveReads,[[0,10],[10,1],[0,10],[10,1]]);assert.deepEqual(m.log.closes,[42,41]);
  assert.deepEqual(m.log.order,['spawn','core-complete','payload-accept','payload-release']);assert.equal(packet.counts.sourceReads,8);
  assert.equal(packet.counts.stageChecks,2);assert.equal(packet.counts.preloadChecks,2);assert.equal(packet.counts.stageCloses,10);
  assert.equal(packet.counts.archiveDataBytes,20);assert.equal(packet.counts.archiveRequestedBytes,22);
  assert.equal(packet.sourceAccountingComplete,true);assert.equal(packet.receiptAccountingComplete,true);assert.equal(packet.archiveAccountingComplete,true);
  const [command,args,options]=m.log.spawns[0];assert.equal(command,'/tmp/opencode/f9-xz-qualification-01/ld-linux-x86-64.so.2');
  assert.deepEqual(args,['--inhibit-cache','--glibc-hwcaps-mask','','--library-path','/tmp/opencode/f9-xz-qualification-01',
    '/tmp/opencode/f9-xz-qualification-01/xz','--decompress','--stdout','--format=xz','--threads=1','--memlimit-decompress=16777216','--','-']);
  assert.deepEqual(options.env,{LC_ALL:'C',LANG:'C',TZ:'UTC'});assert.deepEqual(options.stdio,['pipe','pipe','pipe']);assert.equal(options.shell,false);
});
for(const name of names)test('raw source pin failure stops before archive work: '+name,async()=>{
  const m=await mocked({corrupt:name}),result=await m.run();stopped(result);assert.equal(result.packet.error,'E_SOURCE_PIN');assert.equal(m.log.coreCalls,0);assert.equal(m.log.spawns.length,0);
});
test('fully linked adapter mutation fails its pin before import or archive work',async()=>{
  const m=await mocked({badLinkedPin:true}),result=await m.run();stopped(result);assert.equal(result.packet.error,'E_SOURCE_PIN');assert.equal(m.log.coreCalls,0);
});
for(const option of ['receiptFailure','preflightExpired','slowCapture','invalidClock'])test(option+' rejects preflight before child or archive core',async()=>{
  const m=await mocked({[option]:true}),result=await m.run();stopped(result);assert.equal(m.log.coreCalls,0);assert.equal(m.log.spawns.length,0);
});
for(const option of ['archiveHashFailure','stageFailure','preloadFailure','stageOverflow'])test(option+' rejects before child creation',async()=>{
  const m=await mocked({[option]:true}),result=await m.run();stopped(result);assert.equal(m.log.spawns.length,0);assert.equal(m.log.getCalls,0);
});
for(const option of ['secondHashFailure','lateCoreFailure','lateStageFailure','latePreloadFailure','closeFailure','expireCore','badExit','missingStdoutEof'])test(option+' suppresses all provisional payload data',async()=>{
  const m=await mocked({[option]:true}),result=await m.run();stopped(result);assert.equal(m.log.spawns.length,1);
  assert.equal(m.log.acceptCalls,0);assert.equal(m.log.getCalls,0);assert.equal(m.f.api.snapshot().phase,'failed');
});
test('second child attempt fails without retry or another actual spawn',async()=>{
  const m=await mocked({secondSpawn:true}),result=await m.run();stopped(result);assert.equal(result.packet.error,'E_LIMIT');assert.equal(result.packet.counts.spawnAttempts,2);assert.equal(m.log.spawns.length,1);
});
for(const option of ['publicationExpired','outputOverflow'])test(option+' removes observations from final response',async()=>{
  const m=await mocked({[option]:true}),result=await m.run();stopped(result);assert.equal(m.log.getCalls,1);assert.equal(m.f.api.snapshot().phase,'failed');
});
test('production guards never accept a reduced fixture as a real payload pass',async()=>{
  const m=await mocked({productionGuards:true}),result=await m.run();stopped(result);assert.equal(result.packet.error,'E_RECEIPT');assert.equal(m.log.acceptCalls,0);
});
test('complete-parser output cannot bypass the joint core lifecycle checks',async()=>{
  const m=await mocked({coreResult:r=>({...r,stdoutEnded:false})}),result=await m.run();stopped(result);assert.equal(result.packet.error,'E_RECEIPT');assert.equal(m.log.acceptCalls,0);
});
test('data inspection never promotes any native, installation, training, or resource guarantee',async()=>{
  const m=await mocked(),result=await m.run();assert.equal(result.response.exitCode,0);
  for(const key of ['nativeQualified','nativeAuthority','trainingReady','pythonFreeSubsetVerified','installedUsability','rustReady','relocationReady',
    'archiveExtracted','filesInstalled','pythonRuntimeInvoked','archiveImmutable','nodeBootstrapAuthenticated','hardRssBounded','hardDeadlineGuaranteed','processTreeBounded'])assert.equal(result.packet[key],false);
});
test('all old raw dependency pins and Step 1 receipt remain unchanged',()=>{
  const refs=[...source.matchAll(/\['([a-z0-9-]+)', (\d+), '([a-f0-9]{64})'\]/g)];assert.equal(refs.length,6);
  for(const [,name,length,digest] of refs){assert.equal(captured.get(name).length,Number(length));assert.equal(sha(captured.get(name)),digest);}
  assert.equal(receiptBytes.length,4239);assert.equal(sha(receiptBytes),'e45d65231c0815ab2b895c0d74467500a0e6caf33cc0a4ee342b20489ce6b233');
});
test('handoff pins identify the two new implementation images',t=>{
  for(const name of ['sdk-payload-inspection','sdk-payload-inspection-operation']) {
    const bytes=read(name);t.diagnostic(JSON.stringify({file:'tooling/native-ingress/'+name+'.mjs',bytes:bytes.length,sha256:sha(bytes)}));
  }
});
for(const [kind,code,underlyingCode] of [['ELF_EXEC_DSO','E_ELF','E_PROGRAM_HEADERS'],['ET_REL','E_REL',null],['AR','E_AR_UNSUPPORTED',null],['LINKER_TEXT','E_LINKER_UNSUPPORTED',null]])
  test('unchanged joint core keeps E_TAR while STOP exposes only the '+kind+' attempted target category',async()=>{
    const m=await mocked({payloadFailureKind:kind}),result=await m.run(),ordinal=targets.findIndex(row=>row.kind===kind);stopped(result);
    assert.equal(result.packet.error,'E_TAR');assert.equal(result.packet.dataObservationScope,'APPROVED_PROFILE_ID_AND_FIXED_PARSER_CODE_ONLY');
    assert.deepEqual(result.packet.failedTargetAttempt,{path:targets[ordinal].path,index:ordinal+1,kind,code,underlyingCode,
      scope:'ATTEMPTED_LITERAL_TARGET_NOT_ACCEPTED_PAYLOAD_EVIDENCE'});
    assert.ok(Buffer.byteLength(JSON.stringify(result.packet.failedTargetAttempt))<=4096);
    assert.doesNotMatch(result.response.text,/PRIVATE|"underlyingMessage"|"stack"|"cause"/);
    assert.equal(m.log.spawns.length,1);assert.equal(m.log.acceptCalls,0);assert.equal(m.log.getCalls,0);assert.equal(result.packet.archiveAccountingComplete,false);
    assert.equal(m.f.api.snapshot().retainedObservations,0);assert.equal(m.f.api.snapshot().activePayloadBytes,0);
  });
for(const option of ['earlyFsFailure','archiveHashFailure','stageFailure','lateStageFailure','closeFailure','productionGuards'])
  test(option+' emits no failed target attempt without a target parser failure',async()=>{
    const m=await mocked({[option]:true}),result=await m.run();stopped(result);assert.equal(result.packet.failedTargetAttempt,null);
  });
test('source pin failure and successful full result both carry a null attempt',async()=>{
  const failed=await mocked({corrupt:'sdk-payload-inspection'}),stop=await failed.run();stopped(stop);
  assert.equal(stop.packet.failedTargetAttempt,null);assert.equal(failed.log.attemptReads,0);
  const fresh=await mocked(),result=await fresh.run();assert.equal(result.response.exitCode,0);assert.equal(result.packet.failedTargetAttempt,null);assert.equal(fresh.log.attemptReads,0);
});
test('a consumed collector cannot carry its prior parser attempt into another operation call',async()=>{
  const m=await mocked({payloadFailureKind:'ELF_EXEC_DSO'}),first=await m.run();stopped(first);assert.notEqual(first.packet.failedTargetAttempt,null);
  const second=await m.run();stopped(second);assert.equal(second.packet.error,'E_PHASE');assert.equal(second.packet.failedTargetAttempt,null);
  assert.equal(m.log.spawns.length,1);assert.equal(m.log.attemptReads,1);
  const other=await mocked({earlyFsFailure:true}),third=await other.run();stopped(third);assert.equal(third.packet.failedTargetAttempt,null);
});
for(const mode of ['extra','getter','unknown','path','oversized','underlying'])test('STOP diagnostic rejects '+mode+' data without weakening the outer parser error',async()=>{
  let getters=0;
  const m=await mocked({payloadFailureKind:'ELF_EXEC_DSO',attemptOverride(value){
    if(mode==='extra')return {...value,privateMetadata:'PRIVATE_METADATA'};
    if(mode==='getter')return Object.defineProperty({...value},'code',{get(){getters++;assert.fail('diagnostic getter');}});
    if(mode==='unknown')return {...value,code:'PRIVATE_CODE'};
    if(mode==='path')return {...value,path:'PRIVATE_HEADER_PATH'};
    if(mode==='oversized')return {...value,path:'P'.repeat(4097)};
    return {...value,underlyingCode:'PRIVATE_UNDERLYING'};
  }}),result=await m.run();stopped(result);assert.equal(result.packet.error,'E_TAR');assert.equal(result.packet.failedTargetAttempt,null);
  assert.equal(getters,0);assert.doesNotMatch(result.response.text,/PRIVATE|P{100}/);assert.equal(m.log.getCalls,0);
});
test('repository capture uses only private fixed descriptors and no unbounded read route',()=>{
  assert.doesNotMatch(source,/readFileSync|export (?:async )?function readPinnedRepoSource/);
  assert.match(source,/function readPinnedRepoSource\(fixedPath, pin\)/);
  assert.match(source,/descriptor\.pin !== pin/);assert.match(source,/c\.O_RDONLY \| c\.O_NOFOLLOW \| c\.O_NONBLOCK/);
  assert.match(source,/const fd = owned; owned = null;[\s\S]*fs\.closeSync\(fd\)/);
  assert.match(source,/Buffer\.alloc\(pin\.bytes \+ 1\)/);assert.match(source,/Math\.min\(65536, pin\.bytes - position\)/);
});
test('nine bound repository captures close before the archive core and have separate exact accounting',async()=>{
  const m=await mocked(),result=await m.run();assert.equal(result.response.exitCode,0);
  const sourceBytes=[...captured.values()].reduce((n,b)=>n+b.length,0),total=sourceBytes+receiptBytes.length;
  assert.equal(result.packet.counts.sourceBytes,sourceBytes);assert.equal(result.packet.counts.receiptBytes,receiptBytes.length);
  assert.deepEqual(result.packet.repoCapture,{fsCalls:90,rootChecks:18,namedChecks:18,fdChecks:18,openAttempts:9,readAttempts:18,
    requestedBytes:total+9,readBytes:total,closeAttempts:9,closes:9,completedCaptures:9,sourceCaptures:8,receiptCaptures:1,
    allocations:9,allocatedBytes:total+9,ownedFds:0,peakOwnedFds:1});
  assert.equal(result.packet.repoCaptureAccountingComplete,true);assert.equal(m.log.repoOwned,0);assert.equal(new Set(m.log.repoCloses).size,9);
  assert.equal(m.log.repoAllocations.length,9);assert.ok(m.log.repoOpenFlags.every(n=>n===(131072|2048)));
  assert.match(result.packet.repoCaptureCountersScope,/separate from stage and archive I\/O/);
});
test('bounded positive short reads finish each fixed image and EOF without changing the archive profile',async()=>{
  const m=await mocked({repoChunkBytes:1024}),result=await m.run();assert.equal(result.response.exitCode,0);
  for(const path of m.log.sourceReads){
    const reads=m.log.repoReads.filter(row=>row.path===path);assert.ok(reads.length<=64);assert.equal(reads.at(-1).length,1);
    assert.ok(reads.slice(0,-1).every(row=>row.length<=65536));
  }
  assert.equal(result.packet.repoCapture.completedCaptures,9);assert.equal(m.log.spawns.length,1);
});
for(const option of ['repoOversized','repoFdOversized'])test(option+' refuses before allocation or any repository data read',async()=>{
  const m=await mocked({[option]:true}),result=await m.run();stopped(result);assert.equal(result.packet.error,'E_SOURCE_PIN');
  assert.equal(m.log.repoAllocations.length,0);assert.equal(m.log.repoReads.length,0);assert.equal(m.log.sourceUris,0);assert.equal(m.log.coreCalls,0);
  assert.equal(result.packet.repoCapture.allocatedBytes,0);assert.equal(result.packet.repoCapture.readBytes,0);
  assert.equal(result.packet.repoCapture.closeAttempts,option==='repoFdOversized'?1:0);
});
for(const option of ['repoFifo','repoSymlink','repoFdFifo','repoOpenSymlink','repoRootSymlink'])test(option+' rejects before source allocation and never follows an alternate source',async()=>{
  const m=await mocked({[option]:true}),result=await m.run();stopped(result);
  assert.equal(result.packet.error,option==='repoOpenSymlink'?'E_IO':'E_SOURCE_PIN');assert.equal(m.log.repoAllocations.length,0);
  assert.equal(m.log.repoReads.length,0);assert.equal(m.log.sourceUris,0);assert.equal(m.log.coreCalls,0);assert.equal(m.log.repoOwned,0);
  assert.equal(result.packet.repoCapture.closeAttempts,option==='repoFdFifo'?1:0);
});
for(const field of ['dev','ino','mode','uid','gid','nlink','size','mtimeNs','ctimeNs'])test('repository post-read FD '+field+' drift withholds all source data',async()=>{
  const m=await mocked({repoDriftField:field}),result=await m.run();stopped(result);
  assert.equal(result.packet.error,field==='size'?'E_SOURCE_PIN':'E_BINDING');assert.equal(m.log.repoCloses.length,1);assert.equal(m.log.repoOwned,0);
  assert.equal(result.packet.repoCapture.completedCaptures,0);assert.equal(result.packet.sourceAccountingComplete,false);assert.equal(m.log.sourceUris,0);
  assert.equal(result.packet.counts.sourceBytes,captured.get('tar-inventory').length);assert.equal(result.packet.failedTargetAttempt,null);
});
for(const option of ['repoFdBeforeDrift','repoNamedDrift','repoRootDrift','repoMetadataGetter'])test(option+' fails metadata binding without invoking metadata getters',async()=>{
  const m=await mocked({[option]:true}),result=await m.run();stopped(result);
  assert.equal(result.packet.error,option==='repoMetadataGetter'?'E_METADATA':'E_BINDING');assert.equal(m.log.repoCloses.length,1);assert.equal(m.log.repoOwned,0);
  assert.equal(m.log.sourceUris,0);assert.equal(m.log.coreCalls,0);assert.equal(result.packet.repoCapture.completedCaptures,0);
});
for(const option of ['repoEarlyEof','repoExtraByte','repoInvalidRead'])test(option+' never publishes an accepted source prefix',async()=>{
  const m=await mocked({[option]:true}),result=await m.run();stopped(result);assert.equal(result.packet.error,option==='repoInvalidRead'?'E_IO':'E_SOURCE_PIN');
  assert.equal(m.log.repoCloses.length,1);assert.equal(m.log.repoOwned,0);assert.equal(m.log.sourceUris,0);assert.equal(m.log.coreCalls,0);
  assert.equal(result.packet.repoCapture.completedCaptures,0);assert.equal(result.packet.repoCaptureAccountingComplete,false);
  if(option==='repoEarlyEof')assert.equal(result.packet.counts.sourceBytes,captured.get('tar-inventory').length-1);
  if(option==='repoExtraByte')assert.equal(result.packet.counts.sourceBytes,captured.get('tar-inventory').length+1);
});
test('per-image read loop stops within 64 calls without accepting tiny-read prefixes',async()=>{
  const m=await mocked({repoChunkBytes:1}),result=await m.run();stopped(result);assert.equal(result.packet.error,'E_LIMIT');
  assert.equal(m.log.repoReads.length,63);assert.equal(result.packet.repoCapture.readAttempts,63);assert.equal(result.packet.counts.sourceBytes,63);
  assert.equal(m.log.repoCloses.length,1);assert.equal(m.log.sourceUris,0);
});
test('hash mismatch consumes only the bounded image and closes before refusing all source URIs',async()=>{
  const m=await mocked({corrupt:'tar-inventory'}),result=await m.run();stopped(result);assert.equal(result.packet.error,'E_SOURCE_PIN');
  assert.equal(result.packet.counts.sourceBytes,captured.get('tar-inventory').length);assert.equal(result.packet.repoCapture.readAttempts,2);
  assert.equal(result.packet.repoCapture.closes,1);assert.equal(result.packet.repoCapture.completedCaptures,0);assert.equal(m.log.sourceUris,0);
});
for(const method of ['root','named','open','fd','read','close'])test('unknown repository '+method+' I/O fails with a fixed code and no error getters',async()=>{
  const m=await mocked({repoIoFailure:method}),result=await m.run();stopped(result);assert.equal(result.packet.error,method==='close'?'E_CLOSE':'E_IO');
  assert.equal(m.log.repoOwned,0);assert.equal(m.log.sourceUris,0);assert.equal(m.log.coreCalls,0);assert.doesNotMatch(result.response.text,/PRIVATE_REPO_IO/);
});
for(const option of ['repoReadDeadline','repoEofDeadline','repoCloseDeadline','slowCapture'])test(option+' still closes its owned repository FD once after deadline',async()=>{
  const m=await mocked({[option]:true}),result=await m.run();stopped(result);assert.equal(result.packet.error,'E_DEADLINE');
  assert.equal(m.log.repoCloses.length,1);assert.equal(result.packet.repoCapture.closeAttempts,1);assert.equal(result.packet.repoCapture.closes,1);
  assert.equal(m.log.repoOwned,0);assert.equal(result.packet.repoCapture.ownedFds,0);assert.equal(result.packet.repoCapture.completedCaptures,0);
  assert.equal(m.log.sourceUris,0);assert.equal(m.log.coreCalls,0);
});
for(const other of [{},{corrupt:'tar-inventory'},{slowCapture:true}])test('repository close error absorbs earlier failure without close retry '+JSON.stringify(other),async()=>{
  const m=await mocked({...other,repoCloseFailure:true}),result=await m.run();stopped(result);assert.equal(result.packet.error,'E_CLOSE');
  assert.equal(result.packet.repoCapture.closeAttempts,1);assert.equal(result.packet.repoCapture.closes,0);assert.equal(result.packet.repoCapture.ownedFds,0);
  assert.equal(m.log.repoCloses.length,1);assert.equal(m.log.sourceUris,0);assert.equal(m.log.coreCalls,0);assert.equal(result.packet.failedTargetAttempt,null);
});
test('a later source prefix reports prior completed captures and actual failed-read bytes separately',async()=>{
  const m=await mocked({repoFaultName:'elf-metadata',repoEarlyEof:true}),result=await m.run();stopped(result);
  assert.equal(result.packet.repoCapture.sourceCaptures,1);assert.equal(result.packet.repoCapture.completedCaptures,1);assert.equal(result.packet.repoCapture.closes,2);
  assert.equal(result.packet.counts.sourceReads,2);assert.equal(result.packet.counts.sourceBytes,captured.get('tar-inventory').length+captured.get('elf-metadata').length-1);
  assert.equal(result.packet.sourceAccountingComplete,false);assert.equal(m.log.sourceUris,0);
});
for(const option of ['repoFdOversized','repoCloseFailure','receiptHashFailure'])test('receipt '+option+' suppresses all imports after eight closed source captures',async()=>{
  const m=await mocked({repoFaultName:'receipt',[option]:true}),result=await m.run();stopped(result);
  assert.equal(result.packet.sourceAccountingComplete,true);assert.equal(result.packet.receiptAccountingComplete,false);assert.equal(result.packet.repoCapture.sourceCaptures,8);
  assert.equal(result.packet.repoCapture.receiptCaptures,0);assert.equal(m.log.repoCloses.length,9);assert.equal(m.log.sourceUris,0);assert.equal(m.log.coreCalls,0);
});
