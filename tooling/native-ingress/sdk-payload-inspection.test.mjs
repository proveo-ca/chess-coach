// SPEC: _spec/tooling/native-ingress/step2.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { createTarInventory } from './tar-inventory.mjs';
import { createSdkPayloadInspectionFixture, SDK_PAYLOAD_TARGETS as targets, SDK_PAYLOAD_ROOT as root,
  SDK_PAYLOAD_EXPECTATION, SDK_PAYLOAD_LIMITS } from './sdk-payload-inspection.mjs';

const source = fs.readFileSync(new URL('./sdk-payload-inspection.mjs', import.meta.url), 'utf8');
const elfSource = fs.readFileSync(new URL('./elf-requirements-v3.mjs', import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const uri = bytes => 'data:text/javascript;base64,' + Buffer.from(bytes).toString('base64');
export const FIXTURE_SUMMARY = Object.freeze({ expandedBytes: 47104, headers: 45, entries: 45,
  extensionBytes: 0, outputBytes: 7592, collisionBytes: 3416, dataEvents: 1,
  metadataSha256: '8f05c471b5dc2703300ca18a09190cefdffac06f92994c163cb17a141c5456a9' });
export const FIXTURE_DIGEST = 'd708b51922d212fdd281364583bc6a037ba662f492bc705816eae37eeb899b30';
export function elf(type = 2, length = type === 1 ? 128 : 512) {
  const b = Buffer.alloc(length); b.set([127,69,76,70,2,1,1]); b.writeUInt16LE(type,16); b.writeUInt16LE(62,18);
  b.writeUInt32LE(1,20); b.writeUInt16LE(64,52); b.writeUInt16LE(type === 1 ? 0 : 56,54);
  if (type === 1) { b.writeBigUInt64LE(64n,40); b.writeUInt16LE(64,58); b.writeUInt16LE(1,60); }
  return b;
}
export function arMember(name, body) {
  const field = (s, n) => String(s).padEnd(n, ' ');
  const header = field(name,16) + field('0',12) + field('0',6) + field('0',6) + field('644',8) + field(body.length,10) + '`\n';
  assert.equal(header.length,60);
  return Buffer.concat([Buffer.from(header),body,...(body.length % 2 ? [Buffer.from('\n')] : [])]);
}
export function ar(body = elf(1)) { return Buffer.concat([Buffer.from('!<arch>\n'),arMember('object.o/',body)]); }
const script = text => Buffer.from(text.padEnd(110,' '));
export function bodyFor(row) {
  return row.kind === 'ELF_EXEC_DSO' ? elf() : row.kind === 'ET_REL' ? elf(1) : row.kind === 'AR' ? ar() : script('GROUP ( /lib64/libc.so.6 AS_NEEDED ( -lgcc ) )');
}
function member(row, body) {
  const path = root + '/' + row.path, h = Buffer.alloc(512), slash = path.lastIndexOf('/');
  if (Buffer.byteLength(path) <= 100) h.write(path,0,100);
  else { h.write(path.slice(slash+1),0,100); h.write(path.slice(0,slash),345,155); }
  for (const [at,n,v] of [[100,8,0o644],[108,8,1000],[116,8,1000],[124,12,body.length],[136,12,0]]) h.write(v.toString(8).padStart(n-1,'0')+'\0',at,n,'ascii');
  h[156]=48; h.write('ustar\0',257,6); h.write('00',263,2); h.fill(32,148,156);
  h.write(h.reduce((a,b)=>a+b,0).toString(8).padStart(6,'0')+'\0 ',148,8,'ascii');
  return Buffer.concat([h,body,Buffer.alloc((512-body.length%512)%512)]);
}
export function fixture(options = {}) {
  const bodies = targets.map((row,i) => options.change ? options.change(bodyFor(row),row,i) : bodyFor(row));
  let offset = 0;
  const spans = targets.map((row,i) => {
    const result = { path: row.path, index: i+1, bodyOffset: offset+512, size: bodies[i].length };
    offset += 512 + Math.ceil(bodies[i].length/512)*512; return result;
  });
  const bytes = Buffer.concat([...targets.map((row,i)=>member(row,bodies[i])),Buffer.alloc(1024)]);
  const profile = { expectedSummary: options.summary ?? FIXTURE_SUMMARY,
    expectedDecodedSha256: options.digest ?? FIXTURE_DIGEST,
    targets: options.targets ? options.targets(spans) : spans, limits: options.limits ?? {} };
  return { bytes, profile, api: options.noApi ? null : createSdkPayloadInspectionFixture(profile) };
}
export const coreReceipt = (inventory, extra = {}) => ({ state: 'GNU_SDK_DATA_INVENTORY',mockOnly:true,inventory,
  archiveBytes:10,archiveSha256:sha(Buffer.from('0123456789')),archivePasses:2,archiveDataBytes:20,archiveRequestedBytes:22,
  closeAttempts:2,stdinFinished:true,stdoutEnded:true,stderrEnded:true,closeObserved:true,exitCode:0,signal:null,
  extracted:false,nativeQualified:false,pythonFreeSubsetVerified:false,...extra });
export function finish(f, chunk = 65536) {
  if (chunk !== 65536) f.api = createSdkPayloadInspectionFixture({ ...f.profile,
    expectedSummary: { ...f.profile.expectedSummary, dataEvents: Math.ceil(f.bytes.length / chunk) } });
  f.api.beginPayloadPass(); const parser = f.api.createTarInventory();
  for(let at=0;at<f.bytes.length;at+=chunk) parser.feed(f.bytes.subarray(at,at+chunk));
  return parser.finish();
}
export function inspectFixture(f = fixture(), chunk) {
  const inventory = finish(f,chunk); f.api.acceptPayloadPass(coreReceipt(inventory)); return f.api.getPayloadData();
}
let serial=0;
async function fakeParser(f, options = {}) {
  const parser = createTarInventory(), events = parser.feed(f.bytes), summary = parser.finish();
  const state = { events,summary,...options }, key = '__payloadParser'+ ++serial;
  globalThis[key]=state;
  const dep = uri(`const d=globalThis[${JSON.stringify(key)}]; export function createTarInventory() { return {
    feed() { if(d.feedError) throw d.feedError; return d.events; }, finish() { if(d.finishError) throw d.finishError; return d.summary; } }; }
    export function inspectElf64RequirementsV3() { throw d.elfFailure; }`);
  try {
    const elfDependency = Object.hasOwn(options, 'elfFailure') ? dep : uri(elfSource);
    let text=source.replace("from './tar-inventory.mjs'","from '"+dep+"'").replace("from './elf-requirements-v3.mjs'","from '"+elfDependency+"'");
    if (options.allocate) text=`const fixtureAllocation = globalThis[${JSON.stringify(key)}];\n`+
      text.replace('bytes: Buffer.alloc(target.size)','bytes: fixtureAllocation.allocate(target.size)');
    const ns=await import(uri(text)+'#'+serial);
    return {api:ns.createSdkPayloadInspectionFixture(f.profile),state};
  } finally { delete globalThis[key]; }
}

test('fixture pins are independently frozen', () => {
  const f=fixture({noApi:true}), parser=createTarInventory(); parser.feed(f.bytes); const s=parser.finish();
  const summary=Object.fromEntries(Object.keys(SDK_PAYLOAD_EXPECTATION).map(key=>[key,s[key]]));
  assert.deepEqual(summary,FIXTURE_SUMMARY); assert.equal(sha(f.bytes),FIXTURE_DIGEST);
});
test('all 45 literal tuples exactly copy the accepted catalog',()=>{
  const receipt=JSON.parse(fs.readFileSync(new URL('../../_spec/tooling/native-ingress/gnu-sdk-subset-catalog.receipt.json',import.meta.url)));
  assert.deepEqual(targets.map(r=>[r.path,r.index,r.bodyOffset,r.size]),receipt.selectedRegularMetadata);
  assert.equal(targets.length,45); assert.equal(targets.reduce((n,r)=>n+r.size,0),184285137); assert.equal(Math.max(...targets.map(r=>r.size)),51506040);
  for(const [kind,count,size] of [['ELF_EXEC_DSO',28,176338752],['ET_REL',10,19352],['AR',4,7926538],['LINKER_TEXT',3,495]]) {
    const rows=targets.filter(r=>r.kind===kind); assert.equal(rows.length,count); assert.equal(rows.reduce((n,r)=>n+r.size,0),size);
  }
  assert.ok(Object.isFrozen(targets)); assert.ok(targets.every(Object.isFrozen)); assert.ok(Object.isFrozen(SDK_PAYLOAD_LIMITS));
});
test('all roles explicitly distinguish host tools from target link data',()=>{
  for(const r of targets) { assert.match(r.role,new RegExp('^'+r.domain+'_')); assert.ok(['HOST','TARGET'].includes(r.domain)); }
  assert.equal(targets.filter(r=>r.optionalForMinimalC).length,4);
  assert.equal(targets.find(r=>r.path.endsWith('/sysroot/lib/libc.so.6')).domain,'TARGET');
  assert.doesNotMatch(targets.map(r=>r.path).join('\n'),/python|gdb/i);
  assert.doesNotMatch(source,/node:(?:fs|path|child_process)|\b(?:fetch|spawn|eval|readFile|writeFile|readlink)\s*\(/);
});
test('all four format dispatches complete as immutable metadata only',()=>{
  const result=inspectFixture(); assert.equal(result.mockOnly,true); assert.equal(result.state,'SDK_PAYLOAD_DATA_INSPECTED');
  assert.equal(result.targetCount,45); assert.equal(result.capturedBytes,16730); assert.equal(result.members.length,45);
  assert.ok(Object.isFrozen(result)); assert.ok(result.members.every(Object.isFrozen)); assert.ok(Object.isFrozen(result.members[0].metadata.requirements.dynamic));
  assert.deepEqual([...new Set(result.members.map(r=>r.kind))].sort(),['AR','ELF_EXEC_DSO','ET_REL','LINKER_TEXT']);
  assert.equal(result.resourceAccounting.buffersAllocated,45); assert.equal(result.resourceAccounting.buffersErased,45);
  assert.equal(result.resourceAccounting.peakPayloadBytes,512); assert.equal(result.resourceAccounting.maxAdditionalElfSnapshotBytes,67108864);
  for (const [i,row] of result.members.entries()) assert.equal(row.sha256,sha(bodyFor(targets[i])));
  for(const key of ['installedUsability','nativeQualified','nativeAuthority','relocationReady','pythonFreeSubsetVerified','trainingReady','rustReady','extractionAuthorized','roleSatisfied']) assert.equal(result[key],false);
  assert.ok(result.members.every(r=>!r.roleSatisfied&&!r.qualified));
});
for(const chunk of [7,63,511,513,1023,4093,65536]) test('split payload capture and multi-end chunks: '+chunk,()=>{
  const f=fixture(), result=inspectFixture(f,chunk); assert.equal(result.capturedBytes,16730);
  assert.equal(result.members[0].sha256,sha(elf())); assert.equal(f.api.snapshot().activePayloadBytes,0);
  assert.equal(f.api.snapshot().buffersAllocated,f.api.snapshot().buffersErased);
});
test('capture sorts offsets but publishes the original shuffled profile order',()=>{
  const f=fixture({targets:spans=>[...spans].reverse()}),result=inspectFixture(f,79);
  assert.deepEqual(result.members.map(r=>r.path),[...targets].reverse().map(r=>r.path));
});
test('original event and inventory object identities pass through unchanged',async()=>{
  const f=fixture(), fake=await fakeParser(f); fake.api.beginPayloadPass(); const p=fake.api.createTarInventory();
  assert.equal(p.feed(f.bytes),fake.state.events); assert.equal(p.finish(),fake.state.summary);
  fake.api.acceptPayloadPass(coreReceipt(fake.state.summary)); assert.equal(fake.api.getPayloadData().members.length,45);
});
test('provisional observations never release before joint-core acceptance',()=>{
  const f=fixture(); finish(f); assert.throws(()=>f.api.getPayloadData(),{code:'E_PHASE'});
  assert.equal(f.api.snapshot().retainedObservations,0); assert.equal(f.api.snapshot().phase,'failed');
});
for(const [key,value] of [['archivePasses',1],['closeAttempts',1],['stdinFinished',false],['stdoutEnded',false],['stderrEnded',false],['closeObserved',false],['exitCode',1],['signal','SIGTERM'],['mockOnly',false],['nativeQualified',true]]) test('joint core rejects '+key,()=>{
  const f=fixture(),summary=finish(f); assert.throws(()=>f.api.acceptPayloadPass(coreReceipt(summary,{[key]:value})),{code:'E_RECEIPT'});
  assert.equal(f.api.snapshot().retainedObservations,0);
});
test('acceptance binds its own exact inventory object',()=>{
  const f=fixture(),summary=finish(f); assert.throws(()=>f.api.acceptPayloadPass(coreReceipt({...summary})),{code:'E_RECEIPT'});
});
test('unrelated accessor metadata never executes at acceptance',()=>{
  const f=fixture(),summary=finish(f),value=coreReceipt(summary); Object.defineProperty(value,'unused',{get(){assert.fail('getter');}});
  assert.throws(()=>f.api.acceptPayloadPass(value),{code:'E_INPUT'}); assert.equal(f.api.snapshot().retainedObservations,0);
});
test('late independent decoded hash failure drops all observations',()=>{
  const f=fixture({digest:'0'.repeat(64)}); assert.throws(()=>finish(f),{code:'E_HASH'}); assert.equal(f.api.snapshot().retainedObservations,0);
});
test('late independently expected TAR metadata failure drops all observations',()=>{
  const f=fixture({summary:{...FIXTURE_SUMMARY,metadataSha256:'0'.repeat(64)}});
  assert.throws(()=>finish(f),{code:'E_SUMMARY'}); assert.equal(f.api.snapshot().retainedObservations,0);
});
for(const phase of ['feed','finish']) test('original '+phase+' failures preserve identity and wipe private state',async()=>{
  const f=fixture(),failure=Object.freeze(new Error('private')),fake=await fakeParser(f,{[phase+'Error']:failure});
  fake.api.beginPayloadPass();const p=fake.api.createTarInventory(); if(phase==='finish')p.feed(f.bytes);
  assert.throws(()=>phase==='feed'?p.feed(f.bytes):p.finish(),e=>e===failure); assert.equal(fake.api.snapshot().retainedObservations,0);
});
for(const option of ['wrongIndex','wrongPath','wrongSize','wrongType','duplicate','missing']) test('fixed target metadata mismatch: '+option,async()=>{
  const f=fixture(),fake=await fakeParser(f),e=fake.state.events;
  if(option==='wrongIndex')fake.state.events=[{...e[0],index:2},...e.slice(1)];
  if(option==='wrongPath')fake.state.events=[{...e[0],path:root+'/not-approved'},...e.slice(1)];
  if(option==='wrongSize')fake.state.events=[{...e[0],size:1},...e.slice(1)];
  if(option==='wrongType')fake.state.events=[{...e[0],type:'symlink'},...e.slice(1)];
  if(option==='duplicate')fake.state.events=[...e,e[0]];
  if(option==='missing')fake.state.events=e.slice(1);
  fake.api.beginPayloadPass(); const p=fake.api.createTarInventory();
  assert.throws(()=>{p.feed(f.bytes);p.finish();}); assert.equal(fake.api.snapshot().retainedObservations,0);
});
for(const change of [spans=>spans.slice(1),spans=>[spans[0],...spans.slice(0,-1)],spans=>spans.map((r,i)=>i===1?{...r,bodyOffset:512}:r),
  spans=>spans.map((r,i)=>i===0?{...r,size:Number.MAX_SAFE_INTEGER}:r),spans=>spans.map((r,i)=>i===0?{...r,bodyOffset:-1}:r)]) test('invalid target ranges reject before allocation '+ ++serial,()=>{
  assert.throws(()=>fixture({targets:change}));
});
for(const key of ['maxAggregateBytes','maxObservationBytes','maxCoreBytes','maxOutputBytes','maxPayloadBytes','maxElfSnapshotBytes','maxTextBytes','maxArBytes']) test('lower-only '+key+' fails without truncation',()=>{
  assert.throws(()=>inspectFixture(fixture({limits:{[key]:1}})));
});
test('fixture cannot expand limits, roots, target names, or accessor spans',()=>{
  assert.throws(()=>fixture({limits:{maxArBytes:8388609}}),{code:'E_INPUT'});
  assert.throws(()=>fixture({targets:s=>s.map((r,i)=>i===0?{...r,path:'bin/unapproved'}:r)}),{code:'E_TARGET'});
  assert.throws(()=>fixture({targets:s=>s.map((r,i)=>i===0?Object.defineProperty({...r},'size',{get(){assert.fail('getter');}}):r)}),{code:'E_INPUT'});
});
test('proxy, shared, oversized, and accessor chunks fail before payload allocation',()=>{
  for(const bytes of [new Proxy(Buffer.from('x'),{}),new Uint8Array(new SharedArrayBuffer(10)),Buffer.alloc(65537)]) {
    const f=fixture();f.api.beginPayloadPass();assert.throws(()=>f.api.createTarInventory().feed(bytes),{code:'E_INPUT'}); assert.equal(f.api.snapshot().buffersAllocated,0);
  }
});
test('abort erases an active partial payload and consumes the one-pass instance',()=>{
  const f=fixture();f.api.beginPayloadPass();const p=f.api.createTarInventory();p.feed(f.bytes.subarray(0,600));
  assert.equal(f.api.snapshot().activePayloadBytes,512);f.api.abortPayloadInspection();
  assert.equal(f.api.snapshot().activePayloadBytes,0);assert.equal(f.api.snapshot().buffersErased,1);assert.throws(()=>f.api.beginPayloadPass(),{code:'E_PHASE'});
});
test('every payload allocation follows erasure of its predecessor, including parse failure',async()=>{
  for(const bad of [false,true]) {
    const f=bad?malformed('AR',b=>{b[0]=0;return b;}):fixture(),allocated=[];
    const fake=await fakeParser(f,{allocate(size){
      assert.ok(allocated.every(b=>b.every(byte=>byte===0)),'previous payload must be erased before next allocation');
      const b=Buffer.alloc(size);allocated.push(b);return b;
    }});
    fake.api.beginPayloadPass();const p=fake.api.createTarInventory();
    if(bad)assert.throws(()=>p.feed(f.bytes),{code:'E_AR'});else{p.feed(f.bytes);p.finish();}
    assert.ok(allocated.every(b=>b.every(byte=>byte===0)));assert.equal(fake.api.snapshot().activePayloadBytes,0);
    assert.equal(fake.api.snapshot().buffersAllocated,fake.api.snapshot().buffersErased);
  }
});
for(const action of ['factory','finish','accept','get']) test('single-use '+action+' cannot repeat',()=>{
  const f=fixture();f.api.beginPayloadPass();const p=f.api.createTarInventory();
  if(action==='factory'){assert.throws(()=>f.api.createTarInventory(),{code:'E_PHASE'});return;}
  p.feed(f.bytes);const s=p.finish();
  if(action==='finish'){assert.throws(()=>p.finish(),{code:'E_PHASE'});return;}
  f.api.acceptPayloadPass(coreReceipt(s));
  if(action==='accept'){assert.throws(()=>f.api.acceptPayloadPass(coreReceipt(s)),{code:'E_PHASE'});return;}
  f.api.getPayloadData();assert.throws(()=>f.api.getPayloadData(),{code:'E_PHASE'});
});
function malformed(kind,modify) {
  const first=targets.findIndex(r=>r.kind===kind);
  return fixture({change:(b,r,i)=>i===first?modify(b):b});
}
for(const [name,modify] of [
  ['wrong machine',b=>{b.writeUInt16LE(3,18);return b;}],['ET_EXEC masquerade',b=>{b.writeUInt16LE(2,16);return b;}],
  ['giant section offset',b=>{b.writeBigUInt64LE((1n<<64n)-1n,40);return b;}],['extended count',b=>{b.writeUInt16LE(0,60);return b;}],
  ['extended string index',b=>{b.writeUInt16LE(65535,62);return b;}],['nonzero program count',b=>{b.writeUInt16LE(1,56);return b;}],
  ['section body out of range',b=>{b.writeUInt32LE(1,68);b.writeBigUInt64LE(129n,88);return b;}],
]) test('ET_REL rejects '+name,()=>{const f=malformed('ET_REL',modify);assert.throws(()=>finish(f),{code:name==='nonzero program count'?'E_REL_UNSUPPORTED':'E_REL'});assert.equal(f.api.snapshot().retainedObservations,0);});
test('ET_REL permits NOBITS without a file payload and records no symbol claim',()=>{
  const f=malformed('ET_REL',b=>{b.writeUInt32LE(8,68);b.writeBigUInt64LE(1000000n,88);b.writeBigUInt64LE(1000000n,96);return b;});
  f.profile.expectedDecodedSha256=sha(f.bytes);f.api=createSdkPayloadInspectionFixture(f.profile);
  const row=inspectFixture(f).members.find(r=>r.kind==='ET_REL');assert.equal(row.metadata.nobitsSections,1);assert.equal(row.metadata.symbolRelocationsVerified,false);
});
for(const [name,modify] of [
  ['thin',b=>{b.write('!<thin>\n');return b;}],['BSD name',b=>{b.write('#1/10'.padEnd(16),8);return b;}],
  ['huge declared body',b=>{b.write('9999999999',56);return b;}],['bad numeric field',b=>{b.write('00'.padEnd(12),24);return b;}],
  ['non-object body',b=>{b[68]=0;return b;}],['unbound long name',b=>{b.write('/0'.padEnd(16),8);return b;}],
]) test('AR rejects '+name,()=>{const f=malformed('AR',modify);assert.throws(()=>finish(f),{code:name==='BSD name'?'E_AR_UNSUPPORTED':name==='non-object body'?'E_REL':'E_AR'});assert.equal(f.api.snapshot().retainedObservations,0);});
test('AR validates symbol tables, GNU long names and odd newline padding without following names',()=>{
  const special=Buffer.concat([Buffer.from('!<arch>\n'),arMember('/',Buffer.from('x')),arMember('//',Buffer.from('../external-object-name.o/\n')),arMember('/0',elf(1))]);
  const f=malformed('AR',()=>special),parser=createTarInventory();parser.feed(f.bytes);const s=parser.finish();
  f.profile.expectedSummary=Object.freeze(Object.fromEntries(Object.keys(SDK_PAYLOAD_EXPECTATION).map(k=>[k,s[k]])));
  f.profile.expectedDecodedSha256=sha(f.bytes);f.api=createSdkPayloadInspectionFixture(f.profile);
  const row=inspectFixture(f).members.find(r=>r.kind==='AR');assert.equal(row.metadata.memberCount,3);assert.equal(row.metadata.objectCount,1);
  assert.equal(row.metadata.longNameTablePresent,true);assert.equal(row.metadata.externalPathsOpened,false);
});
test('AR rejects bad odd padding instead of accepting a prefix',()=>{
  const a=Buffer.concat([Buffer.from('!<arch>\n'),arMember('/',Buffer.from('x')),arMember('object.o/',elf(1))]);a[69]=0;
  assert.throws(()=>finish(malformed('AR',()=>a)),{code:'E_AR'});
});
test('linker references remain ordered literal target data including absolute and parent paths',()=>{
  const f=malformed('LINKER_TEXT',()=>script('/* GNU ld */ OUTPUT_FORMAT(elf64-x86-64) GROUP(/lib64/libc.so.6 AS_NEEDED(../libgcc.a -lgcc))'));
  f.profile.expectedDecodedSha256=sha(f.bytes);f.api=createSdkPayloadInspectionFixture(f.profile);
  const row=inspectFixture(f).members.find(r=>r.kind==='LINKER_TEXT');
  assert.deepEqual(row.metadata.references.map(r=>r.literal),['/lib64/libc.so.6','../libgcc.a','-lgcc']);
  assert.ok(row.metadata.references.every(r=>r.requiresApprovedSysrootMapping&&!r.followed));assert.equal(row.metadata.evaluated,false);
});
for(const [name,text,code] of [['unknown directive','INCLUDE(/etc/hosts)','E_LINKER_UNSUPPORTED'],['quotes','INPUT("libc.so")','E_LINKER_UNSUPPORTED'],
  ['substitution','INPUT($HOST)','E_LINKER_UNSUPPORTED'],['NUL','INPUT(libc.so)\0','E_LINKER_TEXT'],['unclosed comment','/* unfinished','E_LINKER_TEXT'],
  ['empty','INPUT()','E_LINKER_TEXT']]) test('linker rejects '+name,()=>{
  const f=malformed('LINKER_TEXT',()=>Buffer.from(text.padEnd(Math.max(110,text.length),' ')));
  assert.throws(()=>finish(f),{code});assert.equal(f.api.snapshot().retainedObservations,0);
});
test('linker depth cap also rejects oversized synthetic grammar without a production profile',async()=>{
  const tarSource=fs.readFileSync(new URL('./tar-inventory.mjs',import.meta.url));
  const text=source.replace("from './tar-inventory.mjs'","from '"+uri(tarSource)+"'")
    .replace("from './elf-requirements-v3.mjs'","from '"+uri(elfSource)+"'")+ '\nexport const fixtureLinker = linker;';
  const pure=await import(uri(text));
  assert.throws(()=>pure.fixtureLinker(Buffer.from('INPUT('+'AS_NEEDED('.repeat(33)+'x'+')'.repeat(34))),{code:'E_LINKER_TEXT'});
});
test('strict linker UTF-8 and ELF format dispatch return fixed errors without byte strings',()=>{
  const f=malformed('LINKER_TEXT',b=>{b[0]=255;return b;});assert.throws(()=>finish(f),{code:'E_LINKER_TEXT'});
  const g=malformed('ELF_EXEC_DSO',b=>{b[0]=0;return b;});assert.throws(()=>finish(g),error=>{assert.equal(error.message,'E_ELF');assert.deepEqual(Object.keys(error),['code']);return true;});
});
test('all unknown dynamic tags survive and loading audit/filter tags stay unqualified',()=>{
  const f=malformed('ELF_EXEC_DSO',b=>{
    b.writeBigUInt64LE(64n,32);b.writeUInt16LE(1,56);b.writeUInt32LE(2,64);b.writeBigUInt64LE(128n,72);
    b.writeBigUInt64LE(32n,96);b.writeBigUInt64LE(32n,104);b.writeBigInt64LE(0x6ffffefbn,128);b.writeBigUInt64LE(7n,136);return b;
  });
  f.profile.expectedDecodedSha256=sha(f.bytes);f.api=createSdkPayloadInspectionFixture(f.profile);
  const row=inspectFixture(f).members[0];assert.deepEqual(row.metadata.unsafeLoadingTags,[{tag:'1879047931',value:'7'}]);
  assert.equal(row.metadata.requirements.dynamic.unknownTags.length,1);assert.equal(row.metadata.qualified,false);
});
function dynamicElf(kind,name) {
  const b=elf(),strings=Buffer.from('\0'+name+'\0');
  b.writeBigUInt64LE(64n,32);b.writeUInt16LE(2,56);
  b.writeUInt32LE(1,64);b.writeUInt32LE(4,68);b.writeBigUInt64LE(512n,96);b.writeBigUInt64LE(512n,104);b.writeBigUInt64LE(1n,112);
  b.writeUInt32LE(2,120);b.writeBigUInt64LE(192n,128);b.writeBigUInt64LE(64n,152);b.writeBigUInt64LE(64n,160);
  for(const [i,tag,val] of [[0,5n,320n],[1,10n,BigInt(strings.length)],[2,kind==='needed'?1n:14n,1n]]) {
    b.writeBigInt64LE(tag,192+i*16);b.writeBigUInt64LE(val,200+i*16);
  }
  strings.copy(b,320);return b;
}
test('declared needed edges match names only within their explicit host or target domain',()=>{
  const f=fixture({change:(b,r,i)=>i===0?dynamicElf('needed','libc.so.6'):
    r.path==='lib/libz.so.1.3.2'||r.path.endsWith('/sysroot/lib/libc.so.6')?dynamicElf('soname','libc.so.6'):b});
  f.profile.expectedDecodedSha256=sha(f.bytes);f.api=createSdkPayloadInspectionFixture(f.profile);
  const result=inspectFixture(f),edge=result.declaredNeededEdges[0];
  assert.deepEqual(edge.declaredProviderNames,['lib/libz.so.1.3.2']);assert.equal(edge.domain,'HOST');assert.equal(edge.status,'UNRESOLVED');
  assert.equal(edge.abiVerified,false);assert.equal(edge.aliasFollowed,false);assert.equal(result.loaderClosureVerified,false);
  assert.deepEqual(result.members[0].metadata.requirements.dynamic.needed,['libc.so.6']);
});
test('members and declared edges share one observation budget without accepting a prefix',()=>{
  const f=fixture({change:(b,r,i)=>i===0?dynamicElf('needed','libc.so.6'):b});
  f.profile.expectedDecodedSha256=sha(f.bytes);f.api=createSdkPayloadInspectionFixture(f.profile);
  const first=inspectFixture(f),cap=first.resourceAccounting.observationBytes-1;
  const g={bytes:f.bytes,profile:{...f.profile,limits:{maxObservationBytes:cap}}};g.api=createSdkPayloadInspectionFixture(g.profile);
  const summary=finish(g);g.api.acceptPayloadPass(coreReceipt(summary));
  assert.throws(()=>g.api.getPayloadData(),{code:'E_OUTPUT'});assert.equal(g.api.snapshot().retainedObservations,0);
});
const attemptScope = 'ATTEMPTED_LITERAL_TARGET_NOT_ACCEPTED_PAYLOAD_EVIDENCE';
test('native ELF failure keeps its outer code and exposes only its fixed own underlying category',()=>{
  const f=malformed('ELF_EXEC_DSO',b=>{b.writeUInt16LE(129,56);return b;});
  assert.equal(f.api.getFailedTargetAttempt(),null);
  assert.throws(()=>finish(f),error=>{
    assert.equal(error.code,'E_ELF');assert.equal(Object.getOwnPropertyDescriptor(error,'underlyingCode').value,'E_PROGRAM_HEADERS');
    assert.deepEqual(Object.keys(error),['code']);return true;
  });
  assert.deepEqual(f.api.getFailedTargetAttempt(),{path:targets[0].path,index:1,kind:'ELF_EXEC_DSO',code:'E_ELF',underlyingCode:'E_PROGRAM_HEADERS',scope:attemptScope});
  assert.equal(f.api.snapshot().retainedObservations,0);assert.equal(f.api.snapshot().activePayloadBytes,0);
  assert.throws(()=>f.api.getPayloadData(),{code:'E_PHASE'});
});
for(const code of ['E_INPUT','E_LIMITS','E_ELF','E_RANGE','E_PROGRAM_HEADERS','E_INTERPRETER','E_DYNAMIC','E_STRING_TABLE','E_STRING','E_OUTPUT','E_VERSIONS','E_NOTES','E_PROPERTIES'])
  test('ELF attempt allowlists native own data code '+code,async()=>{
    const failure={code};for(const key of ['message','stack','cause'])Object.defineProperty(failure,key,{get(){assert.fail('unsafe '+key);}});
    const f=fixture(),fake=await fakeParser(f,{elfFailure:failure});fake.api.beginPayloadPass();const parser=fake.api.createTarInventory();
    assert.throws(()=>parser.feed(f.bytes),{code:'E_ELF'});
    const attempt=fake.api.getFailedTargetAttempt();assert.equal(attempt.underlyingCode,code);assert.ok(Object.isFrozen(attempt));
    assert.deepEqual(Object.keys(attempt),['path','index','kind','code','underlyingCode','scope']);
    assert.ok(Buffer.byteLength(JSON.stringify(attempt))<=4096);
  });
for(const mode of ['unknown','getter','inherited','object','proxy','primitive','null']) test('ELF attempt never reads unsafe '+mode+' error data',async()=>{
  let reads=0;
  const getter=()=>{reads++;assert.fail('unsafe error read');};
  const failure=mode==='unknown'?{code:'PRIVATE_UNRECOGNIZED_ERROR'}:mode==='getter'?Object.defineProperty({},'code',{get:getter}):
    mode==='inherited'?Object.create(Object.defineProperty({},'code',{get:getter})):
    mode==='object'?{code:{toString:getter}}:mode==='proxy'?new Proxy({code:'E_RANGE'},{get:getter,getOwnPropertyDescriptor:getter}):mode==='primitive'?'PRIVATE_ERROR_TEXT':null;
  const f=fixture(),fake=await fakeParser(f,{elfFailure:failure});fake.api.beginPayloadPass();const parser=fake.api.createTarInventory();
  assert.throws(()=>parser.feed(f.bytes),{code:'E_ELF'});assert.equal(fake.api.getFailedTargetAttempt().underlyingCode,null);assert.equal(reads,0);
  assert.doesNotMatch(JSON.stringify(fake.api.getFailedTargetAttempt()),/PRIVATE/);
});
for(const [kind,code,change] of [
  ['ET_REL','E_REL',b=>{b.writeUInt16LE(2,16);return b;}],
  ['AR','E_AR_UNSUPPORTED',b=>{b.write('#1/PRIVATE_NAME'.padEnd(16),8);return b;}],
  ['LINKER_TEXT','E_LINKER_UNSUPPORTED',()=>script('INCLUDE(/PRIVATE_REFERENCE)')],
]) test('attempt records only the approved '+kind+' target identity and fixed parser category',()=>{
  const f=malformed(kind,change),ordinal=targets.findIndex(r=>r.kind===kind);
  assert.throws(()=>finish(f),{code});const attempt=f.api.getFailedTargetAttempt();
  assert.deepEqual(attempt,{path:targets[ordinal].path,index:ordinal+1,kind,code,underlyingCode:null,scope:attemptScope});
  assert.doesNotMatch(JSON.stringify(attempt),/PRIVATE|sha256|metadata|references|members/);
  assert.ok(Object.isFrozen(attempt));assert.equal(f.api.snapshot().retainedObservations,0);assert.equal(f.api.snapshot().activePayloadBytes,0);
});
test('first failed literal target survives abort and later calls without retaining later data',()=>{
  const f=fixture({change:(b,r,i)=>i===18?Buffer.from(b).fill(0):i===23?Buffer.from(b).fill(1):b});
  f.api.beginPayloadPass();const parser=f.api.createTarInventory();assert.throws(()=>parser.feed(f.bytes),{code:'E_AR'});
  const first=f.api.getFailedTargetAttempt();assert.equal(first.path,targets[18].path);assert.equal(first.index,19);
  f.api.abortPayloadInspection();assert.equal(f.api.getFailedTargetAttempt(),first);
  assert.throws(()=>parser.feed(Buffer.from('PRIVATE_LATER_WORKER_DATA')),{code:'E_PHASE'});
  assert.throws(()=>f.api.beginPayloadPass(),{code:'E_PHASE'});assert.equal(f.api.getFailedTargetAttempt(),first);
  assert.throws(()=>f.api.getPayloadData(),{code:'E_PHASE'});assert.equal(f.api.getFailedTargetAttempt(),first);
  assert.equal(f.api.snapshot().retainedObservations,0);assert.equal(f.api.snapshot().buffersAllocated,f.api.snapshot().buffersErased);
});
test('original TAR failures, metadata mismatches and late hash failures never become target parser evidence',async()=>{
  const f=fixture(),fake=await fakeParser(f,{feedError:{code:'E_AR',path:'PRIVATE_HEADER_PATH'}});
  fake.api.beginPayloadPass();assert.throws(()=>fake.api.createTarInventory().feed(f.bytes));assert.equal(fake.api.getFailedTargetAttempt(),null);
  const g=fixture(),mismatch=await fakeParser(g);mismatch.state.events=[{...mismatch.state.events[0],path:root+'/PRIVATE_HEADER_PATH'},...mismatch.state.events.slice(1)];
  mismatch.api.beginPayloadPass();assert.throws(()=>mismatch.api.createTarInventory().feed(g.bytes),{code:'E_TARGET'});assert.equal(mismatch.api.getFailedTargetAttempt(),null);
  const h=fixture({digest:'0'.repeat(64)});assert.throws(()=>finish(h),{code:'E_HASH'});assert.equal(h.api.getFailedTargetAttempt(),null);
});
test('fresh fixture instances and successful publication carry no previous attempt',()=>{
  const failed=malformed('ELF_EXEC_DSO',b=>{b[0]=0;return b;});assert.throws(()=>finish(failed),{code:'E_ELF'});
  assert.throws(()=>fixture({targets:rows=>rows.slice(1)}));
  const fresh=fixture();assert.equal(fresh.api.getFailedTargetAttempt(),null);inspectFixture(fresh);assert.equal(fresh.api.getFailedTargetAttempt(),null);
  fresh.api.abortPayloadInspection();assert.equal(fresh.api.getFailedTargetAttempt(),null);assert.notEqual(failed.api.getFailedTargetAttempt(),null);
});
for(const offset of [0,1,2,3]) test('ET_REL rejects high-bit mutation of raw magic byte '+offset,()=>{
  const f=malformed('ET_REL',b=>{b[offset]^=128;return b;});
  assert.throws(()=>finish(f),{code:'E_REL'});assert.equal(f.api.getFailedTargetAttempt().code,'E_REL');
  assert.equal(f.api.snapshot().retainedObservations,0);assert.throws(()=>f.api.getPayloadData(),{code:'E_PHASE'});
});
for(const offset of [0,1,2,3,4,5,6,7]) test('AR rejects high-bit mutation of raw archive magic byte '+offset,()=>{
  const f=malformed('AR',b=>{b[offset]^=128;return b;});
  assert.throws(()=>finish(f),{code:'E_AR'});assert.equal(f.api.getFailedTargetAttempt().code,'E_AR');
  assert.equal(f.api.snapshot().retainedObservations,0);assert.throws(()=>f.api.getPayloadData(),{code:'E_PHASE'});
});
for(const offset of [0,1,2,3]) test('AR rejects high-bit mutation of member ELF magic byte '+offset,()=>{
  const f=malformed('AR',b=>{b[68+offset]^=128;return b;});
  assert.throws(()=>finish(f),{code:'E_REL'});assert.equal(f.api.getFailedTargetAttempt().kind,'AR');
  assert.equal(f.api.snapshot().retainedObservations,0);assert.throws(()=>f.api.getPayloadData(),{code:'E_PHASE'});
});
