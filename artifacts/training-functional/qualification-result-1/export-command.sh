# SPEC: _spec/runtime-protocol.puml
bash -c '
set -euo pipefail
umask 077
H="/home/gu1lty/Projects/proveo/chess-coach"
B="$H/_work/gpu-owner-recovery/cache/host-gpu-native-build-1/bun"
test -x "$B"
exec "$B" --no-env-file --no-install -e "
const fs=require(\"node:fs\"),{createHash}=require(\"node:crypto\");
try {
  const h=Bun.argv.at(-1),root=h+\"/_work/gpu-owner-recovery/runs/\",cap=1048576;
  const names=[\"training-qualification-1/evidence/operator-report.json\",\"training-qualification-1/evidence/canonical.json\",\"training-qualification-1/evidence/r4.json\",\"training-qualification-1/evidence/functional-evidence.json\",\"training-qualification-delivery-1/preparation-receipt.json\",\"training-qualification-inputs-1/qualification-inputs/input-manifest.json\"];
  const sha=b=>createHash(\"sha256\").update(b).digest(\"hex\");
  const files=names.map(name=>{
    const path=root+name,fd=fs.openSync(path,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);
    try {
      const before=fs.fstatSync(fd,{bigint:true});
      if(!before.isFile()||before.size<1n||before.size>BigInt(cap))throw new Error(\"INPUT_BOUND: \"+name);
      const buffer=Buffer.alloc(Number(before.size)+1);let size=0;
      while(size<buffer.length){const n=fs.readSync(fd,buffer,size,buffer.length-size,null);if(!n)break;size+=n;}
      const after=fs.fstatSync(fd,{bigint:true});
      if(size!==Number(before.size)||before.size!==after.size||before.mtimeNs!==after.mtimeNs||before.ctimeNs!==after.ctimeNs)throw new Error(\"INPUT_DRIFT: \"+name);
      const bytes=buffer.subarray(0,size),text=new TextDecoder(\"utf-8\",{fatal:true,ignoreBOM:true}).decode(bytes),value=JSON.parse(text);
      if(!value||typeof value!==\"object\"||Array.isArray(value))throw new Error(\"JSON_OBJECT: \"+name);
      return {path,byteLength:size,sha256:sha(bytes),text};
    } finally {fs.closeSync(fd);}
  });
  const expected=[[4,1921,\"20f2b4620ef665698a8b7bfffc9fb10ac784491541bc531aa682e7f666a47fd7\"],[5,143938,\"7bc8885b4ee97be1d4935aa4dcc994275ea41e2e368b144e29be1b598b53ae51\"]];
  for(const [i,n,hash] of expected)if(files[i].byteLength!==n||files[i].sha256!==hash)throw new Error(\"REPORTED_PIN_MISMATCH: \"+names[i]);
  const report={version:\"chess-coach.qualification-json-export.v1\",scope:\"USER_RUN_RETAINED_JSON_EXPORT_NOT_NEW_QUALIFICATION\",publicationCommit:\"e821b5169f29b191b8418763508bd54292774aef\",files,qualified:false,trainingReady:false};
  const output=root+\"training-qualification-json-export-1.json\",bytes=Buffer.from(JSON.stringify(report)+\"\\n\");
  if(bytes.length>13*cap)throw new Error(\"EXPORT_BOUND\");
  const fd=fs.openSync(output,\"wx\",0o600);
  try {fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);} finally {fs.closeSync(fd);}
  console.log(\"Executor: \"+JSON.stringify({status:\"EXPORTED_EXISTING_JSON_ONLY\",path:output,byteLength:bytes.length,sha256:sha(bytes),files:files.length,sourceBytes:files.reduce((n,f)=>n+f.byteLength,0),qualified:false,trainingReady:false}));
} catch(error) {console.error(\"Executor: \"+String(error));process.exitCode=1;}
" -- "$H"
'
