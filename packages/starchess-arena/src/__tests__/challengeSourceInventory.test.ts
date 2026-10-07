import { cpSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { canonical } from "../challenge/config";
import { sha256 } from "../challenge/corpus";
import { collectSourceInventory, SOURCE_PARTITIONS, type SourceInventoryV1 } from "../challenge/sourceInventory";

const CORE = "packages/starchess-core";
const ARENA = "packages/starchess-arena";
const TRAINING = "packages/starchess-training";
const minifiedNumericRead = 'export function read(input,prior){let cursor,index;const words=prior||[0];for(cursor=0;cursor<input.length;cursor++){index=cursor>>>2;consume(words[index]);}return words;}';
const repository = fileURLToPath(new URL("../../../../", import.meta.url));
const temporary: string[] = [];
const wrappedMutations = [
  'function read(bag:{key:number}){return bag.key;}let invoke=read;invoke=poison;invoke(data);',
  'function read(bag:{key:number}){return bag.key;}let invoke=read;const alias=invoke;invoke=poison;invoke.call(null,data);',
  'function read(bag:{key:number}){return bag.key;}const holder={invoke:read};holder.invoke=poison;holder.invoke(data);',
  'const decoy={key:0};const args=[decoy];args[0]=data;poison.apply(null,args);',
  'const decoy={key:0};const args=[decoy];const alias=args;alias[0]=data;Reflect.apply(poison,null,args);',
  'const decoy={key:0};const tuple=[poison,null,[decoy]];(tuple[2] as any)[0]=data;Reflect.apply(...tuple);',
  'const decoy={key:0};let args=[decoy];args=[data];poison.apply(null,args);',
  'const decoy={key:0};const args=[decoy];const stored={args};stored.args=[data];Reflect.apply(poison,null,stored.args);',
  'poison.call(null,data);',
  'const alias=poison;alias["call"](null,data);',
  'poison.apply(null,[data]);',
  'const args=[data];poison.apply(null,args);',
  'const args=[data];const stored={args};poison.apply(null,stored.args);',
  'const bound=poison.bind(null,data);bound();',
  'const bound=poison.bind(null);bound(data);',
  'const bound=poison.bind.call(poison,null);bound(data);',
  'const bound=poison.bind(null,data);[0].forEach(bound);',
  'Reflect.apply(poison,null,[data]);',
  'const apply=Reflect.apply;const args=[data];apply(poison,null,args);',
  'const tuple=[poison,null,[data]];Reflect.apply(...tuple);',
  'const tuple=[Reflect.apply,null,[poison,null,[data]]];const apply=Reflect.apply;apply(...tuple);',
  'Reflect.apply(poison.call,null,[null,data]);',
  'const call=poison.call;call.call(poison,null,data);',
  'Reflect.apply(poison.bind,poison,[null,data])();',
  'const bound=Reflect.apply.bind(null,poison);bound(null,[data]);',
  'poison[unknownMethod](null,data);',
  'poison.apply(null,unknownArguments);',
  'consume(poison,data);',
  'function invoke(callback:(bag:{key:number})=>void,bag:{key:number}){callback(bag);}invoke(poison,data);',
  'function invoke({change}:{change:(bag:{key:number})=>void},bag:{key:number}){change(bag);}invoke({change:poison},data);',
  'function invoke({change}:{change?:(bag:{key:number})=>void},bag:{key:number}){if(change)return change?change(bag):undefined;}invoke({change:poison},data);',
  'function invoke({read,hidden}:any,bag:{key:number}){read(bag);consume(hidden,bag);}invoke({read:()=>0,hidden:poison},data);',
];
const mutationProbe = (invocation: string): string => `function poison(bag:{key:number}){(bag as any).key="changed";}function probe(receiver:any,bag:{key:number}){return receiver[bag.key];}const data={key:0};${invocation}consume(probe(unknownFactory(),data));`;
const deferredMutations = [
  { name: "array assignment targets retain captured defaults", effect: 'function poison(bag=data){bag.key="changed" as any;}let invoke:any;[invoke]=[poison];invoke();' },
  { name: "object assignment targets retain captured defaults", effect: 'function poison(bag=data){bag.key="changed" as any;}let invoke:any;({invoke}={invoke:poison});invoke();' },
  { name: "renamed object assignments retain captured defaults", effect: 'function poison(bag=data){bag.key="changed" as any;}let invoke:any;({change:invoke}={change:poison});invoke();' },
  { name: "nested assignment patterns retain captured defaults", effect: 'function poison(bag=data){bag.key="changed" as any;}let invoke:any;({nested:[invoke]}={nested:[poison]});invoke();' },
  { name: "assignment aliases retain captured defaults", effect: 'function poison(bag=data){bag.key="changed" as any;}const writer=poison;const tuple=[writer];let invoke:any;[invoke]=tuple;const alias=invoke;alias();' },
  { name: "mutated tuple assignment sources retain current candidates", effect: 'function poison(bag=data){bag.key="changed" as any;}function read(){return 0;}const tuple=[read];tuple[0]=poison;let invoke:any;[invoke]=tuple;invoke();' },
  { name: "helper mutated tuple sources retain current candidates", effect: 'function poison(bag=data){bag.key="changed" as any;}function read(){return 0;}function install(tuple:any[]){tuple[0]=poison;}const tuple=[read];install(tuple);let invoke:any;[invoke]=tuple;invoke();' },
  { name: "mutated object assignment sources retain current candidates", effect: 'function poison(bag=data){bag.key="changed" as any;}function read(){return 0;}const methods={invoke:read};methods.invoke=poison;let invoke:any;({invoke}=methods);invoke();' },
  { name: "array assignment defaults retain mutator candidates", effect: 'function poison(bag=data){bag.key="changed" as any;}let invoke:any;[invoke=poison]=[];invoke();' },
  { name: "object assignment defaults retain mutator candidates", effect: 'function poison(bag=data){bag.key="changed" as any;}let invoke:any;({invoke=poison}={});invoke();' },
  { name: "array assignment rests retain mutator candidates", effect: 'function poison(bag=data){bag.key="changed" as any;}let holder:any;[...holder]=[poison];holder[0]();' },
  { name: "object assignment rests retain mutator candidates", effect: 'function poison(bag=data){bag.key="changed" as any;}let holder:any;({...holder}={invoke:poison});holder.invoke();' },
  { name: "assignment member targets retain captured defaults", effect: 'function poison(bag=data){bag.key="changed" as any;}const holder:any={};[holder.invoke]=[poison];holder.invoke();' },
  { name: "helper assignment patterns retain captured defaults", effect: 'function poison(bag=data){bag.key="changed" as any;}function install(holder:any){({change:holder.invoke}={change:poison});}const holder:any={};install(holder);holder.invoke();' },
  { name: "object holder replacement retains property candidates", effect: 'function poison(bag=data){bag.key="changed" as any;}let holder:any={};holder={invoke:poison};holder.invoke();' },
  { name: "array to object replacements retain property candidates", effect: 'function poison(bag=data){bag.key="changed" as any;}let holder:any=[];holder={invoke:poison};holder.invoke();' },
  { name: "object holder replacement retains shorthand candidates", effect: 'function poison(bag=data){bag.key="changed" as any;}let holder:any;holder={poison};holder.poison();' },
  { name: "object holder replacement retains nested candidates", effect: 'function poison(bag=data){bag.key="changed" as any;}let holder:any={nested:{}};holder={nested:{invoke:poison}};holder.nested.invoke();' },
  { name: "object holder replacement retains method default effects", effect: 'let holder:any={};holder={invoke(bag=data){bag.key="changed" as any;}};holder.invoke();' },
  { name: "object holder replacement retains method rest effects", effect: 'let holder:any={};holder={invoke(...bags:any[]){bags[1].key="changed";}};holder.invoke({key:1},data);' },
  { name: "known object spreads retain captured default candidates", effect: 'function poison(bag=data){bag.key="changed" as any;}const methods={invoke:poison};let holder:any={};holder={...methods};holder.invoke();' },
  { name: "unknown object spreads reject silent candidate loss", effect: 'function poison(bag=data){bag.key="changed" as any;}let holder:any={};holder={...unknownFactory(),invoke:poison};holder.invoke();' },
  { name: "getter held candidates retain captured default effects", effect: 'function poison(bag=data){bag.key="changed" as any;}let holder:any={};holder={get invoke(){return poison;}};holder.invoke();' },
  { name: "reassigned zero argument callees activate captured defaults", effect: 'function poison(bag=data){(bag as any).key="changed";}let invoke:any=undefined;invoke=poison;invoke();' },
  { name: "reassigned reader callees activate captured defaults", effect: 'function read(){return 0;}function poison(bag=data){(bag as any).key="changed";}let invoke=read;invoke=poison;invoke();' },
  { name: "transitive reassignment aliases activate captured defaults", effect: 'function poison(bag=data){(bag as any).key="changed";}let first:any;first=poison;let second:any=0;second=first;const alias=second;alias();' },
  { name: "reflected reassigned callees activate captured defaults", effect: 'function poison(bag=data){(bag as any).key="changed";}let invoke:any=undefined;invoke=poison;Reflect.apply(invoke,null,[]);' },
  { name: "applied reassigned callees activate captured defaults", effect: 'function poison(bag=data){(bag as any).key="changed";}let invoke:any=0;invoke=poison;invoke.apply(null,[]);' },
  { name: "bound reassigned callees activate captured defaults", effect: 'function poison(bag=data){(bag as any).key="changed";}let invoke:any;invoke=poison;const bound=invoke.bind(null);bound();' },
  { name: "reassigned callees retain destructured default effects", effect: 'function poison({bag}:{bag:{key:number}}={bag:data}){(bag as any).key="changed";}let invoke:any;invoke=poison;invoke();' },
  { name: "reassigned callees retain rest argument effects", effect: 'function poison(...bags:{key:number}[]){(bags[1] as any).key="changed";}let invoke:any;invoke=poison;invoke({key:1},data);' },
  { name: "missing array callables invalidate supplied marker data", effect: 'function poison(bag:{key:number}){(bag as any).key="changed";}const holder:any=[];holder[0]=poison;holder[0](data);' },
  { name: "sparse array callables invalidate supplied marker data", effect: 'function poison(bag:{key:number}){(bag as any).key="changed";}const holder:any=[,];holder[0]=poison;holder[0](data);' },
  { name: "missing array callables activate captured defaults", effect: 'function poison(bag=data){(bag as any).key="changed";}const holder:any=[];holder[0]=poison;holder[0]();' },
  { name: "sparse array aliases activate captured defaults", effect: 'function poison(bag=data){(bag as any).key="changed";}const holder:any=[,];const alias=holder;alias[0]=poison;const invoke=holder[0];invoke();' },
  { name: "nested sparse array callables activate captured defaults", effect: 'function poison(bag=data){(bag as any).key="changed";}const holder:any={nested:[,]};holder.nested[0]=poison;Reflect.apply(holder.nested[0],null,[]);' },
  { name: "helper installed sparse callables activate captured defaults", effect: 'function poison(bag=data){(bag as any).key="changed";}function install(holder:any[]){holder[0]=poison;}const holder:any=[,];install(holder);holder[0]();' },
  { name: "forwarded helper callables activate captured defaults", effect: 'function poison(bag=data){(bag as any).key="changed";}function install(holder:any[]){holder[0]=poison;}function forward(holder:any[]){install(holder);}const holder:any=[,];forward(holder);holder[0]();' },
  { name: "helper effects invalidate stored apply vectors", effect: 'function poison(bag:{key:number}){(bag as any).key="changed";}function replace(args:any[],bag:{key:number}){args[0]=bag;}const args=[{key:0}];poison.apply(null,args);replace(args,data);poison.apply(null,args);' },
  { name: "forwarded helper effects invalidate reflected vectors", effect: 'function poison(bag:{key:number}){(bag as any).key="changed";}function replace(args:any[],bag:{key:number}){args[0]=bag;}function forward(args:any[],bag:{key:number}){replace(args,bag);}const args=[{key:0}];Reflect.apply(poison,null,args);forward(args,data);Reflect.apply(poison,null,args);' },
  { name: "helper effects invalidate nested spread tuples", effect: 'function poison(bag:{key:number}){(bag as any).key="changed";}function replace(tuple:any[],bag:{key:number}){tuple[2][0]=bag;}const tuple=[poison,null,[{key:0}]];Reflect.apply(...tuple);replace(tuple,data);Reflect.apply(...tuple);' },
  { name: "helper effects invalidate stored bound vectors", effect: 'function poison(bag:{key:number}){(bag as any).key="changed";}function replace(args:any[],bag:{key:number}){args[0]=bag;}const args=[{key:0}];replace(args,data);const invoke=poison.bind(null,...args);invoke();' },
  { name: "helper effects invalidate member callable mappings", effect: 'function poison(bag:{key:number}){(bag as any).key="changed";}function read(bag:{key:number}){return bag.key;}function replace(holder:any){holder.invoke=poison;}const holder={invoke:read};holder.invoke(data);replace(holder);holder.invoke(data);' },
  { name: "uninitialized mutable callees invalidate caller data", effect: 'function poison(bag:{key:number}){(bag as any).key="changed";}let invoke;invoke=poison;invoke(data);' },
  { name: "undefined initialized callees invalidate caller data", effect: 'function poison(bag:{key:number}){(bag as any).key="changed";}let invoke:any=undefined;invoke=poison;invoke(data);' },
  { name: "noncallable initialized aliases invalidate caller data", effect: 'function poison(bag:{key:number}){(bag as any).key="changed";}let invoke:any=0;invoke=poison;const alias=invoke;alias.call(null,data);' },
  { name: "noncallable member initializers invalidate caller data", effect: 'function poison(bag:{key:number}){(bag as any).key="changed";}const holder:any={invoke:undefined};holder.invoke=poison;Reflect.apply(holder.invoke,null,[data]);' },
  { name: "missing member initializers invalidate caller data", effect: 'function poison(bag:{key:number}){(bag as any).key="changed";}const holder:any={};holder.invoke=poison;holder.invoke(data);' },
  { name: "mutable factory supplied callees invalidate caller data", effect: 'let invoke:any=undefined;invoke=unknownFactory();invoke(data);' },
  { name: "mutable writer callback aliases reject escaped effects", effect: 'function poison(bag:{key:number}){(bag as any).key="changed";}let invoke:any=undefined;invoke=poison;const alias=invoke;consume(alias,data);' },
  { name: "helper effects invalidate originally missing callables", effect: 'function poison(bag:{key:number}){(bag as any).key="changed";}function replace(holder:any){holder.invoke=poison;}const holder:any={};replace(holder);holder.invoke(data);' },
  { name: "forwarded union aliases activate outer destructured defaults", effect: 'const supplied:{bag:{key:number}}|undefined=flag?{bag:{key:1}}:undefined;const alias=supplied;function poison({bag}:{bag:{key:number}}={bag:data}){(bag as any).key="changed";}poison(alias);' },
  { name: "call result member aliases activate possible default effects", effect: 'const supplied={bag:unknownFactory()};const alias=supplied.bag;function poison(bag=data){(bag as any).key="changed";}poison(alias);' },
  { name: "conditional arguments activate possible default effects", effect: 'function poison(bag=data){(bag as any).key="changed";}poison(flag?{key:1}:undefined);' },
  { name: "call result arguments activate possible default effects", effect: 'function missing(){return undefined;}function poison(bag=data){(bag as any).key="changed";}poison(missing());' },
  { name: "union aliases activate possible default effects", effect: 'const missing:{key:number}|undefined=flag?{key:1}:undefined;const alias=missing;function poison(bag=data){(bag as any).key="changed";}poison(alias);' },
  { name: "reassigned aliases activate possible default effects", effect: 'let supplied:any={key:1};supplied=undefined;function poison(bag=data){(bag as any).key="changed";}poison(supplied);' },
  { name: "conditional destructured arguments activate outer defaults", effect: 'function poison({bag}:{bag:{key:number}}={bag:data}){(bag as any).key="changed";}poison(flag?{bag:{key:1}}:undefined);' },
  { name: "call result destructured arguments activate outer defaults", effect: 'function missing(){return undefined;}function poison({bag}:{bag:{key:number}}={bag:data}){(bag as any).key="changed";}poison(missing());' },
  { name: "nested destructured defaults invalidate captured data", effect: 'function poison({nested:{bag=data}={}}:{nested?:{bag?:{key:number}}}={}){(bag as any).key="changed";}poison(flag?{nested:{}}:undefined);' },
  { name: "rest parameter invalidates every remaining caller argument", effect: 'function poison(...bags:{key:number}[]){(bags[1] as any).key="changed";}poison({key:0},data);' },
  { name: "omitted parameter default invalidates captured caller data", effect: 'function poison(bag=data){(bag as any).key="changed";}poison();' },
  { name: "explicit undefined activates parameter default effects", effect: 'function poison(bag=data){(bag as any).key="changed";}poison(undefined);' },
  { name: "undefined alias activates parameter default effects", effect: 'function poison(bag=data){(bag as any).key="changed";}const missing=undefined;poison(missing);' },
  { name: "destructured member default invalidates captured caller data", effect: 'function poison({bag=data}:{bag?:{key:number}}={}){(bag as any).key="changed";}poison({});' },
  { name: "destructured omitted default invalidates captured caller data", effect: 'function poison({bag}:{bag:{key:number}}={bag:data}){(bag as any).key="changed";}poison();' },
];
const deferredMutationProbe = (effect: string): string => `const data={key:0};${effect}function probe(receiver:any,bag:{key:number}){return receiver[bag.key];}consume(probe(unknownFactory(),data));`;
const ownMemberConstructors = [
  'const box: any = {f: () => {}}; box.f[["con", "structor"].join("")]("return process")();',
  'const box = {f: () => {}} as any; box.f[["con", "structor"].join("")]("return process")();',
  'const box = {f: () => {}}; (box.f as any)[["con", "structor"].join("")]("return process")();',
  'const box: any = {f: function () {}}; box["f"][["con", "structor"].join("")]("return process")();',
  'const box: any = {f() {}}; box.f[["con", "structor"].join("")]("return process")();',
  'const f: any = () => {}; const box: any = {f}; box.f[["con", "structor"].join("")]("return process")();',
  'const box: any = {nested: {f: () => {}}}; box.nested.f[["con", "structor"].join("")]("return process")();',
  'const box = {nested: {f: () => {}}} as any; const nested = box.nested; const alias = nested.f; alias[["con", "structor"].join("")]("return process")();',
  'const box: any = {get f() {return () => {};}}; box.f[["con", "structor"].join("")]("return process")();',
  'const box = {get f(): any {return () => {};}}; const alias = box.f; alias[["con", "structor"].join("")]("return process")();',
  'const box: any = {get nested() {return {f: () => {}};}}; const alias = box.nested.f; alias[["con", "structor"].join("")]("return process")();',
  'const box: any = {nested: {get f() {return () => {};}}}; const alias = box.nested.f; alias[["con", "structor"].join("")]("return process")();',
  'const box: any = {f: () => {}}; const alias = later; const later = box.f; alias[["con", "structor"].join("")]("return process")();',
  'const box: any = {f: () => {}}; const key = "f"; box[key][["con", "structor"].join("")]("return process")();',
  'const box: any = {f: 0, f: () => {}}; box.f[["con", "structor"].join("")]("return process")();',
  'const member: any = {f: () => {}}; const box: any = {...member}; box.f[["con", "structor"].join("")]("return process")();',
  'const box: any = {f: () => {}}; (0, box.f)[["con", "structor"].join("")]("return process")();',
];
const arrayMemberConstructors = [
  'const f:any=([()=>{}] as any)[0]; f[["con","structor"].join("")]("return process")();',
  'const array: any = [() => {}]; array[0][["con", "structor"].join("")]("return process")();',
  'const array = [function () {}] as any; const alias = array["0"]; alias[["con", "structor"].join("")]("return process")();',
  'const array: any = [0, () => {}]; const index = 1; const alias = array[index]; alias[["con", "structor"].join("")]("return process")();',
  'const array: any = [0, () => {}]; const alias = array[index]; alias[["con", "structor"].join("")]("return process")();',
  'const array: any = [[() => {}]]; array[0][0][["con", "structor"].join("")]("return process")();',
  'const box: any = {array: [[() => {}]]}; const alias = box.array[0][0]; alias[["con", "structor"].join("")]("return process")();',
  'const array: any = [{f: () => {}}]; array[0].f[["con", "structor"].join("")]("return process")();',
  'const array: any = [{nested: [() => {}]}]; const box = array[0]; const alias = box.nested[0]; alias[["con", "structor"].join("")]("return process")();',
  'const array: any = [{get f() {return () => {};}}]; const alias = array[0].f; alias[["con", "structor"].join("")]("return process")();',
  'const array: any = [{get nested() {return [() => {}];}}]; const alias = array[0].nested[0]; alias[["con", "structor"].join("")]("return process")();',
  'const [f] = [() => {}] as any; const alias = f; alias[["con", "structor"].join("")]("return process")();',
  'const [, f] = [0, () => {}] as any; f[["con", "structor"].join("")]("return process")();',
  'const [[f]] = [[() => {}]] as any; f[["con", "structor"].join("")]("return process")();',
  'const {nested: [f]} = {nested: [() => {}]} as any; f[["con", "structor"].join("")]("return process")();',
  'const [{f: alias}] = [{f: () => {}}] as any; alias[["con", "structor"].join("")]("return process")();',
  'const {0: f} = [() => {}] as any; f[["con", "structor"].join("")]("return process")();',
  'const [f = () => {}] = [] as any; f[["con", "structor"].join("")]("return process")();',
  'const items: any = [() => {}]; const array: any = [...items]; const f = array[0]; f[["con", "structor"].join("")]("return process")();',
  'const items: any = [() => {}]; const [f] = [...items] as any; f[["con", "structor"].join("")]("return process")();',
  'const items: any = [() => {}]; const array: any = [0, ...items]; array[1][["con", "structor"].join("")]("return process")();',
  'const [...array] = [() => {}] as any; array[0][["con", "structor"].join("")]("return process")();',
];
const dataArrayAccesses = [
  'const array: any = [1, 2]; void array[index];',
  'const array: any = [[1, 2]]; void array[0][index];',
  'const array: any = [{data: [1, 2]}]; const alias = array[0].data; void alias[index];',
  'const box: any = {f: () => {}, data: [[1, 2]]}; void box.data[0][index];',
  'const [data] = [[1, 2]] as any; void data[index];',
  'const {nested: [data]} = {nested: [[1, 2]]} as any; void data[index];',
  'const array: any = [() => {}, [1, 2]]; const [f, data] = array; void data[index];',
  'const path = [...rayBetween(from, to), to]; const blocked = 1; void path[blocked - 1];',
  'const rows = [...inputRows]; void rows[0][1];',
];
const unprovenComputedReceivers = [
  'Array.prototype[Symbol.iterator]=function*(){yield["con","structor"].join("");};const receiver:any=unknownFactory();for(const key of["data"]){receiver[key]("return process")();}',
  'const ArrayCtor=Array;const iterator=Symbol.iterator;ArrayCtor.prototype[iterator]=function*(){yield["con","structor"].join("");};const receiver:any=unknownFactory();for(const key of["data"]){receiver[key]("return process")();}',
  'Array.prototype[Symbol.iterator]=function*(){yield["con","structor"].join("");};const receiver:any=unknownFactory();for(const key of["data"] as const){receiver[key]("return process")();}',
  'function poison(bag:{key:number}){(bag as any).key=["con","structor"].join("");}function compile(receiver:any,bag:{key:number}){return receiver[bag.key]("return process")();}const data={key:0};poison(data);compile(()=>{},data);',
  'function forward(bag:{key:number}){poison(bag);}function poison(bag:{key:number}){(bag as any).key=["con","structor"].join("");}function compile(receiver:any,bag:{key:number}){return receiver[bag.key]("return process")();}const data={key:0};forward(data);compile(()=>{},data);',
  'function poison(bag:{key:number}){const alias=bag;(alias as any).key=["con","structor"].join("");}function compile(receiver:any,bag:{key:number}){return receiver[bag.key]("return process")();}const data={key:0};const mutate=poison;mutate(data);compile(()=>{},data);',
  'function poison({bag}:{bag:{key:number}}){(bag as any).key=["con","structor"].join("");}function compile(receiver:any,bag:{key:number}){return receiver[bag.key]("return process")();}const data={key:0};poison({bag:data});compile(()=>{},data);',
  'function poison(wrapper:{bag:{key:number}}){const {bag}=wrapper;(bag as any).key=["con","structor"].join("");}function forward(bag:{key:number}){poison({bag});}function compile(receiver:any,bag:{key:number}){return receiver[bag.key]("return process")();}const data={key:0};forward(data);compile(()=>{},data);',
  'function poison(bag:{key:number}){Object.assign(bag,{key:["con","structor"].join("")});}function compile(receiver:any,bag:{key:number}){return receiver[bag.key]("return process")();}const data={key:0};poison(data);compile(()=>{},data);',
  'const assign=Object.assign;function poison(bag:{key:number}){assign(bag,{key:["con","structor"].join("")});}function compile(receiver:any,bag:{key:number}){return receiver[bag.key]("return process")();}const data={key:0};poison(data);compile(()=>{},data);',
  'const poison=(bag:{key:number})=>{(bag as any).key=["con","structor"].join("");};function compile(receiver:any,bag:{key:number}){return receiver[bag.key]("return process")();}const data={key:0};const mutate=poison;mutate(data);compile(()=>{},data);',
  'function poison(bag:{key:number}){(bag as any).key=["con","structor"].join("");}function compile(receiver:any,bag:{key:number}){return receiver[bag.key]("return process")();}const data={key:0};poison(...[data] as [{key:number}]);compile(()=>{},data);',
  'function acquire(receiver:object,box:{key:number}){return(receiver as any)[box.key]("return process")();} acquire(()=>{},JSON.parse(`{"key":"constructor"}`));',
  'function compile(receiver:any,bag:{key:number}){return receiver[bag.key]("return process")();} compile(unknownFactory(),{key:"constructor" as any});',
  'function compile(receiver:any,bag:{key:"w"}){return receiver[bag.key]("return process")();} compile(unknownFactory(),{key:"constructor" as any});',
  'function compile(receiver:any,bag:{key:number}){const alias=bag;return receiver[alias["key"]]("return process")();} compile(unknownFactory(),{key:"constructor" as any});',
  'function compile(receiver:any,bag:{nested:{key:number}}){return receiver[bag.nested.key]("return process")();} compile(unknownFactory(),{nested:{key:"constructor" as any}});',
  'function compile(receiver:any,bag:{key:number}){const {key}=bag;return receiver[key]("return process")();} compile(unknownFactory(),{key:"constructor" as any});',
  'function compile(receiver:any,{key}:{key:number}){return receiver[key]("return process")();} compile(unknownFactory(),{key:"constructor" as any});',
  'function compile(receiver:any,{nested:{key}}:{nested:{key:"w"}}){return receiver[key]("return process")();} compile(unknownFactory(),{nested:{key:"constructor" as any}});',
  'function compile(receiver:any,bag:{key:number}){return receiver[bag.key]("return process")();} compile(unknownFactory(),{key:1});compile(unknownFactory(),{key:"constructor" as any});',
  'export function compile(receiver:any,bag:{key:number}){return receiver[bag.key]("return process")();}',
  'function compile(receiver:any,bag:{key:number}){return receiver[bag.key]("return process")();} consume(compile);compile(unknownFactory(),{key:1});',
  'function compile(receiver:any,bag:{key:number}){return receiver[bag.key]("return process")();} function wrap(receiver:any,bag:{key:number}){return compile(receiver,bag);} wrap(unknownFactory(),{key:"constructor" as any});',
  'const receiver:any=unknownFactory();Array.prototype.includes=(()=>true) as any;const key=["con","structor"].join("");if(["data"].includes(key))receiver[key]("return process")();',
  'const receiver:any=unknownFactory();const prototype=Array.prototype;prototype.includes=(()=>true) as any;const key=["con","structor"].join("");if(["data"].includes(key))receiver[key]("return process")();',
  'const receiver:any=unknownFactory();const host=globalThis;(host.Array.prototype as any).includes=()=>true;const key=["con","structor"].join("");if(["data"].includes(key))receiver[key]("return process")();',
  'const receiver:any=unknownFactory();const assign=Object.assign;assign(Array.prototype,{includes:()=>true});const key=["con","structor"].join("");if(["data"].includes(key))receiver[key]("return process")();',
  'const receiver:any=unknownFactory();Object.defineProperty(Array.prototype,"includes",{value:()=>true});const key=["con","structor"].join("");if(["data"].includes(key))receiver[key]("return process")();',
  'const receiver:any=unknownFactory();Reflect.set(Array.prototype,"includes",()=>true);const key=["con","structor"].join("");if(["data"].includes(key))receiver[key]("return process")();',
  'const receiver:any=unknownFactory();const apply=Reflect.apply;apply(Object.assign,null,[Array.prototype,{includes:()=>true}]);const key=["con","structor"].join("");if(["data"].includes(key))receiver[key]("return process")();',
  'const receiver:any=unknownFactory();Array.prototype.includes=(()=>true) as any;function compile(key:"data"){if(["data"].includes(key))return receiver[key]("return process")();}compile("constructor" as any);',
  'function acquire(value:object,key:string){let compile:any; const label=`${compile=(value as any)[key]}`; return compile("return process")();} acquire(()=>{},["con","structor"].join(""));',
  'function lookup(value:object,key:string):any{return(value as any)[key];} lookup(()=>{},["con","structor"].join(""))("return process")();',
  'function lookup(value:object,key:string):any{const alias=value;return(alias as any)[key];} lookup(()=>{},["con","structor"].join(""))("return process")();',
  'function lookup(value:{[key:string]:unknown},key:string):any{return value[key];} lookup((()=>{}) as any,["con","structor"].join(""))("return process")();',
  'function lookup<T extends object>(value:T,key:string):any{return(value as any)[key];} lookup(()=>{},["con","structor"].join(""))("return process")();',
  'const lookup=(value:object,key:string):any=>(value as any)[key]; consume(lookup); lookup({data:1},"data");',
  'function lookup(value:object,key:string):any{return(value as any)[key];} lookup({data:1},"data"); lookup(()=>{},["con","structor"].join(""))("return process")();',
  'const box={key:0};(box as any).key=["con","structor"].join("");const receiver:any=unknownFactory();receiver[box.key]("return process")();',
  'const bag={key:0};const alias=bag;(alias as any)["key"]=["con","structor"].join("");const receiver:any=unknownFactory();receiver[bag["key"]]("return process")();',
  'const box={key:0};(box as any).key=["con","structor"].join("");const key=box.key;const receiver:any=unknownFactory();receiver[key]("return process")();',
  'const box={key:0};(box as any).key=["con","structor"].join("");const {key}=box;const receiver:any=unknownFactory();receiver[key]("return process")();',
  'const box={nested:{key:0}};(box.nested as any).key=["con","structor"].join("");const receiver:any=unknownFactory();receiver[box.nested.key]("return process")();',
  'const box={key:0};Object.assign(box,{key:["con","structor"].join("")});const receiver:any=unknownFactory();receiver[box.key]("return process")();',
  'const receiver:any=unknownFactory(); let key; for(key=0;key<3;key++){key=["con","structor"].join(""); receiver[key]("return process")();}',
  'const receiver:any=unknownFactory(); let key; key=0>>>2; key=["con","structor"].join(""); receiver[key]("return process")();',
  'const receiver:any=unknownFactory(); let key:number; key=["con","structor"].join("") as any; receiver[key]("return process")();',
  'const receiver:any=unknownFactory(); let key=0; function mutate(){key=["con","structor"].join("") as any;} mutate(); receiver[key]("return process")();',
  'const receiver:any=unknownFactory(); let key; const bag={get key():number{return "constructor" as any;}}; key=bag["key"]; receiver[key]("return process")();',
  'const receiver:any=unknownFactory(); let key; const bag={get key():number{return "constructor" as any;}}; key=bag["key"]+1; receiver[key]("return process")();',
  'const receiver:any=unknownFactory(); const bag={get key():number{return "constructor" as any;}}; receiver[String(bag["key"])]("return process")();',
  'function read(receiver:any,key:number){return receiver[String(key)]("return process")();} read(()=>{}, "constructor" as any);',
  'const receiver:any=unknownFactory(); var key; key=0; var key=["con","structor"].join(""); receiver[key]("return process")();',
  'const receiver:any=unknownFactory(); let key; [key]=["constructor"]; receiver[key]("return process")();',
  'const receiver:any=unknownFactory(); let key; for(key=0;condition;key++){key+=unknownValue; receiver[key]("return process")();}',
  'const receiver:any=unknownFactory(); const read=(key:number)=>receiver[key]("return process")(); read(0); read("constructor" as any);',
  'const receiver:any=unknownFactory(); const read=(key:number)=>receiver[key]("return process")(); consume(read); read(0);',
  'const receiver:any=unknownFactory(); const read=(key:number)=>receiver[key]("return process")(); export {read as escaped}; read(0);',
  'const receiver:any=unknownFactory(); export const read=(key:number)=>receiver[key]("return process")(); read(0);',
  'const receiver:any=unknownFactory(); const data=[1,2]; data.forEach=((cb:any)=>cb(1,"constructor")) as any; data.forEach((_,key)=>receiver[key]("return process")());',
  'const receiver:any=unknownFactory(); const data={forEach(cb:any){cb(1,"constructor");}} as unknown as number[]; data.forEach((_,key)=>receiver[key]("return process")());',
  'const receiver:any=unknownFactory(); Array.prototype.forEach=((cb:any)=>cb(1,"constructor")) as any; [1,2].forEach((_,key)=>receiver[key]("return process")());',
  'const receiver:any=unknownFactory(); Object.assign(Array.prototype,{forEach(cb:any){cb(1,"constructor");}}); [1,2].forEach((_,key)=>receiver[key]("return process")());',
  'const receiver:any=unknownFactory(); let data:any=[1,2]; data={forEach(cb:any){cb(1,"constructor");}}; data.forEach((_:any,key:number)=>receiver[key]("return process")());',
  'const receiver:any=unknownFactory(); function Factory(){return Array.prototype;} Object.assign(new (Factory as any)(),{forEach(cb:any){cb(1,"constructor");}}); [1,2].forEach((_,key)=>receiver[key]("return process")());',
  'const receiver:any=unknownFactory(); function Error(){return Array.prototype;} Object.assign(new (Error as any)(),{forEach(cb:any){cb(1,"constructor");}}); [1,2].forEach((_,key)=>receiver[key]("return process")());',
  'const receiver:any=unknownFactory(); JSON.parse=(()=>({map(cb:any){cb(0,"constructor");}})) as any; JSON.parse("{}").map((_:any,key:number)=>receiver[key]("return process")());',
  'const receiver:any=unknownFactory(); (Object.prototype as any).map=function(cb:any){cb(0,"constructor");}; JSON.parse("{}").map((_:any,key:number)=>receiver[key]("return process")());',
  'const receiver:any=unknownFactory(); const {key}={get key():number{return "constructor" as any;}}; receiver[key]("return process")();',
  'const receiver:any=unknownFactory(); let index; const {key}={get key():number{return "constructor" as any;}}; index=key; receiver[index]("return process")();',
  'this.Function("return process")();',
  'this.eval("return process");',
  'parent.Function("return process")();',
  'document.defaultView.eval("return process");',
  'const {defaultView: host} = document; host.Function("return process")();',
  'globalThis.document.defaultView.Function("return process")();',
  'const {document: doc} = globalThis; const {defaultView: host} = doc; host.eval("return process");',
  'const key:any="constructor"; Number = (()=>key) as any; const receiver:any=unknownFactory(); receiver[Number(0)]("return process")();',
  'void window.process;',
  'void self.process;',
  'const timer = setTimeout; timer("return process", 0);',
  'setTimeout.bind(null)("return process", 0);',
  'setInterval.call(null, "return process", 0);',
  'Reflect.apply(setTimeout, null, ["return process", 0]);',
  'setTimeout(unknownCallback, 0);',
  'function schedule(callback: any) {setTimeout(callback, 0);}',
  'consume(setTimeout);',
  'const api = Reflect; consume(api.get);',
  'const api = Object; consume(api.getOwnPropertyDescriptor);',
  'const {get: read} = Reflect; read(() => {}, "constructor");',
  'const bag = {get key(): number {return "constructor" as any;}}; const key = bag["key"]; const receiver:any = unknownFactory(); receiver[key]("return process")();',
  'function compile(receiver: any, key: number) {receiver[key]("return process")();} compile(()=>{}, "constructor" as any);',
  'function compile(receiver: any, key: number) {receiver[key + 1]("return process")();}',
  'function compile(receiver: any, key: number | "data") {receiver[key]("return process")();}',
  'const {apply} = Reflect; const args = [Object.assign, null, [Math, {floor:()=>"constructor"}]]; apply(...args); const receiver:any=unknownFactory(); receiver[Math.floor(0)]("return process")();',
  'const args = [Object.assign, null, [Math, {floor:()=>"constructor"}]]; const apply = Reflect.apply; apply(...args); const receiver:any=unknownFactory(); receiver[Math.floor(0)]("return process")();',
  'const args = [Reflect.apply, null, [Object.assign, null, [Math, {floor:()=>"constructor"}]]]; const apply = Reflect.apply; apply(...args); const receiver:any=unknownFactory(); receiver[Math.floor(0)]("return process")();',
  'globalThis.Function("return process")();',
  'globalThis["Function"]("return process")();',
  'globalThis["eval"]("return process");',
  'window.Function("return process")();',
  'self["eval"]("return process");',
  'frames[0].Function("return process")();',
  'top["eval"]("return process");',
  'Reflect.get(globalThis, "Function")("return process")();',
  'Object.getOwnPropertyDescriptor(globalThis, "Function").value("return process")();',
  'setTimeout("return process", 0);',
  'const x: any = 1; const y: any = 2; const key = (x as unknown as number) + (y as unknown as number); const receiver: any = {}; receiver[key][key]("return process")();',
  'Object.assign.call.call(Object.assign, null, Math, {floor:()=>"constructor"}); const f:any=unknownFactory(); f[Math.floor(0)]("return process")();',
  'Reflect.apply(Reflect.apply, null, [Object.assign, null, [Math, {floor:()=>"constructor"}]]); const f:any=unknownFactory(); f[Math.floor(0)]("return process")();',
  'Object.assign[["c","all"].join("")](Math, {floor:()=>"constructor"}); const f:any=unknownFactory(); f[Math.floor(0)]("return process")();',
  'const {assign}=Object; assign(globalThis.Math, {floor:()=>"constructor"}); const f:any=unknownFactory(); f[Math.floor(0)]("return process")();',
  'const bag = { get key(): number { return "constructor" as any; } }; const receiver: any = {}; receiver[bag.key][bag.key]("return process")();',
  'const f:any=()=>{}; const key=["con","structor"].join(""); (f[key] *= 1)("return process")();',
  'const key=["con","structor"].join(""); const receiver:any={}; receiver[key][key]("return process")();',
  'const key=["con","structor"].join(""); const receiver:any=[]; receiver[key][key]("return process")();',
  'const f:any=()=>{}; const key=["con","structor"].join(""); (f[key] ||= null)("return process")();',
  'const f:any=()=>{}; const key=["con","structor"].join(""); (f[key] &&= f[key])("return process")();',
  'const f:any=()=>{}; const key=["con","structor"].join(""); (f[key] ??= null)("return process")();',
  'Object.assign.call(null, Math, {floor:()=>"constructor"}); const f:any=unknownFactory(); f[Math.floor(0)]("return process")();',
  'Object.assign.apply(null, [Math, {floor:()=>"constructor"}]); const f:any=unknownFactory(); f[Math.floor(0)]("return process")();',
  'Reflect.apply(Object.assign, null, [Math, {floor:()=>"constructor"}]); const f:any=unknownFactory(); f[Math.floor(0)]("return process")();',
  'Object.assign.bind(null, Math, {floor:()=>"constructor"})(); const f:any=unknownFactory(); f[Math.floor(0)]("return process")();',
  'const make:any=()=>()=>{}; const f=make(); const keys={indexOf:()=>["con","structor"].join("")} as unknown as number[]; const key=keys.indexOf(0); f[key]("return process")();',
  'const f: any = unknownFactory(); for (let key: any = 0; condition; key++) {key = ["con", "structor"].join(""); f[key]("return process")();}',
  'const f: any = unknownFactory(); String = (() => "constructor") as any; f[String(1)]("return process")();',
  'const f: any = unknownFactory(); Math.floor = (() => "constructor") as any; f[Math.floor(1)]("return process")();',
  'const f: any = unknownFactory(); globalThis.Math.floor = (() => "constructor") as any; f[Math.floor(1)]("return process")();',
  'const f: any = unknownFactory(); Array.prototype.indexOf = (() => "constructor") as any; f[[0].indexOf(0)]("return process")();',
  'const make:any=()=>()=>{}; const f=make(); const key=["con","structor"].join("") as "w"; f[key]("return process")();',
  'const make:any=()=>()=>{}; const f=make(); const key: "w"=["con","structor"].join("") as any; f[key]("return process")();',
  'const make:any=()=>()=>{}; const f=make(); const key=["con","structor"].join("") as unknown as number; f[key]("return process")();',
  'const make:any=()=>()=>{}; const f=make(); const makeKey=(): "w" => ["con","structor"].join("") as "w"; const key=makeKey(); f[key]("return process")();',
  'function make(): any {return () => {};} const value = make() as Record<string, number>; const compile: any = value[["con", "structor"].join("")]; compile("return process")();',
  'const make:any=()=>()=>{}; const f:Record<string,number>=make(); const c=f[["con","structor"].join("")] as unknown as (s:string)=>()=>unknown; c("return process")();',
  'const make = (): Record<string, number> => (() => {}) as unknown as Record<string, number>; const value = make(); const compile: any = value[["con", "structor"].join("")]; compile("return process")();',
  'const box: {f: number} = {f: 0}; (box as any).f = () => {}; const value = box.f as unknown as Record<string, number>; const compile: any = value[["con", "structor"].join("")]; compile("return process")();',
  'const make:any=()=>()=>{}; const f:any=make(); f[["con","structor"].join("")]("return process")();',
  'const box:any={f:0}; box.f=()=>{}; box.f[["con","structor"].join("")]("return process")();',
  'const make: any = function () {return function () {};}; const f: any = make(); f[["con", "structor"].join("")]("return process")();',
  'const make: any = () => ({f: () => {}}); const f = make().f; f[["con", "structor"].join("")]("return process")();',
  'const make: any = () => [() => {}]; const f = make()[0]; f[["con", "structor"].join("")]("return process")();',
  'const make: any = () => () => {}; const f = make(); const alias = f; alias[["con", "structor"].join("")]("return process")();',
  'const make: any = () => () => {}; const box: any = {f: make()}; box.f[["con", "structor"].join("")]("return process")();',
  'const make: any = () => ({f: () => {}}); const {f} = make(); f[["con", "structor"].join("")]("return process")();',
  'const make: any = () => [() => {}]; const [f] = make(); f[["con", "structor"].join("")]("return process")();',
  'const f: any = unknownFactory(); f[unknownKey];',
  'const make: any = () => () => {}; (make() as any)[["con", "structor"].join("")]("return process")();',
  'const box: any = {f: 0}; box["f"] = () => {}; const f = box.f; f[["con", "structor"].join("")]("return process")();',
  'const box: any = {nested: {f: 0}}; box.nested.f = () => {}; box.nested.f[["con", "structor"].join("")]("return process")();',
  'const box: any = {f: 0}; const alias = box; alias.f = () => {}; box.f[["con", "structor"].join("")]("return process")();',
  'const box: any = {nested: {f: 0}}; const alias = box.nested; alias.f = () => {}; box.nested.f[["con", "structor"].join("")]("return process")();',
  'const box: any = {nested: {f: 0}}; const {nested: alias} = box; alias.f = () => {}; box.nested.f[["con", "structor"].join("")]("return process")();',
  'const array: any = [0]; array[0] = () => {}; const [f] = array; f[["con", "structor"].join("")]("return process")();',
  'const box: any = {f: 0}; Object.assign(box, {f: () => {}}); box.f[["con", "structor"].join("")]("return process")();',
  'const box: any = {f: 0}; const alias = box; const api = Object; api.assign(alias, {f: () => {}}); box.f[["con", "structor"].join("")]("return process")();',
  'const box: any = {f: 0}; const assign = Object.assign; assign(box, {f: () => {}}); box.f[["con", "structor"].join("")]("return process")();',
  'const box: any = {f: 0}; Object.defineProperty(box, "f", {value: () => {}}); box.f[["con", "structor"].join("")]("return process")();',
  'const box: any = {f: 0}; Reflect.set(box, "f", () => {}); box.f[["con", "structor"].join("")]("return process")();',
  'const box: any = {f: 0}; [box.f] = [() => {}]; box.f[["con", "structor"].join("")]("return process")();',
  'const box: any = {f: 0}; ({f: box.f} = {f: () => {}}); box.f[["con", "structor"].join("")]("return process")();',
  'const box: any = {f: 0, other: 0}; box.other = 1; box.f[unknownKey];',
  'const make: any = () => () => {}; const f: any = condition ? make() : make(); f[["con", "structor"].join("")]("return process")();',
  'const make: any = () => () => {}; const f: any = make() || make(); f[["con", "structor"].join("")]("return process")();',
  'const make: any = async () => () => {}; const f: any = await make(); f[["con", "structor"].join("")]("return process")();',
  'const make: any = function () {return () => {};}; const f: any = new make(); f[["con", "structor"].join("")]("return process")();',
  'const box: any = {f: 0}; const f: any = box.f = () => {}; f[["con", "structor"].join("")]("return process")();',
  'const array: any = [0]; array.fill(() => {}); const f: any = array[0]; f[["con", "structor"].join("")]("return process")();',
  'const array: any = [0]; array.splice(0, 1, () => {}); const [f] = array; f[["con", "structor"].join("")]("return process")();',
  'const make: any = () => () => {}; const key = ["con", "structor"].join(""); if (["data"].includes(key) || true) make()[key]("return process")();',
  'const make: any = () => () => {}; let key: any = "data"; if (["data"].includes(key)) {key = ["con", "structor"].join(""); make()[key]("return process")();}',
  'const array: any = [0, () => {}]; array.reverse(); const f: any = array[0]; f[["con", "structor"].join("")]("return process")();',
  'const box = {f: 0}; (box as any).f = () => {}; (box.f as any)[["con", "structor"].join("")]("return process")();',
  'const box: any = {f: 0}; function mutate() {box.f = () => {};} mutate(); box.f[["con", "structor"].join("")]("return process")();',
];
const ordinaryComputedData = [
  'const data={key:0};function read(bag=data){return bag.key;}let invoke:any;[invoke]=[read];invoke();function probe(receiver:any,bag:{key:number}){return receiver[bag.key];}consume(probe(unknownFactory(),data));',
  'const data={key:0};function read(bag=data){return bag.key;}let invoke:any;({invoke}={invoke:read});invoke();function probe(receiver:any,bag:{key:number}){return receiver[bag.key];}consume(probe(unknownFactory(),data));',
  'const data={key:0};function unused(bag=data){bag.key=1;}function read(){return 0;}let invoke:any,other:any;[invoke,other]=[read,unused];invoke();function probe(receiver:any,bag:{key:number}){return receiver[bag.key];}consume(probe(unknownFactory(),data));',
  'const data={key:0};function unused(bag=data){bag.key=1;}function read(){return 0;}let invoke:any,other:any;({invoke,other}={invoke:read,other:unused});invoke();function probe(receiver:any,bag:{key:number}){return receiver[bag.key];}consume(probe(unknownFactory(),data));',
  'const data={key:0};function read(bag=data){return bag.key;}let invoke:any;[invoke=read]=[];invoke();function probe(receiver:any,bag:{key:number}){return receiver[bag.key];}consume(probe(unknownFactory(),data));',
  'const data={key:0};function read(bag=data){return bag.key;}let holder:any;[...holder]=[read];holder[0]();function probe(receiver:any,bag:{key:number}){return receiver[bag.key];}consume(probe(unknownFactory(),data));',
  'const data={key:0};function read(bag=data){return bag.key;}let holder:any;({...holder}={invoke:read});holder.invoke();function probe(receiver:any,bag:{key:number}){return receiver[bag.key];}consume(probe(unknownFactory(),data));',
  'const data={key:0};const methods={invoke(bag=data){return bag.key;}};let holder:any={};holder={...methods};holder.invoke();function probe(receiver:any,bag:{key:number}){return receiver[bag.key];}consume(probe(unknownFactory(),data));',
  'const data={key:0};let holder:any={};holder={invoke(bag={key:1}){bag.key=2;}};holder.invoke();function probe(receiver:any,bag:{key:number}){return receiver[bag.key];}consume(probe(unknownFactory(),data));',
  'const data={key:0};function read(bag=data){return bag.key;}const holder=[,read];holder[1]();function probe(receiver:any,bag:{key:number}){return receiver[bag.key];}consume(probe(unknownFactory(),data));',
  'const data={key:0};function writeLocal(bag={key:1}){bag.key=2;}writeLocal();function probe(receiver:any,bag:{key:number}){return receiver[bag.key];}consume(probe(unknownFactory(),data));',
  'const data={key:0};function writeLocal(bag={key:1}){bag.key=2;}let invoke:any;invoke=writeLocal;invoke();function probe(receiver:any,bag:{key:number}){return receiver[bag.key];}consume(probe(unknownFactory(),data));',
  'const data={key:0};function read(bag=data){return bag.key;}let invoke:any;invoke=read;invoke();function probe(receiver:any,bag:{key:number}){return receiver[bag.key];}consume(probe(unknownFactory(),data));',
  'const data={key:0};function read(bag=data){return bag.key;}const holder:any=[,];holder[0]=read;holder[0]();function probe(receiver:any,bag:{key:number}){return receiver[bag.key];}consume(probe(unknownFactory(),data));',
  'const data={key:0};function unused(bag=data){bag.key=1;}function read(){return 0;}let invoke:any;invoke=read;invoke();function probe(receiver:any,bag:{key:number}){return receiver[bag.key];}consume(probe(unknownFactory(),data));',
  'const data={key:0};function writeOther(bag=data){bag.key=1;}let invoke:any;invoke=writeOther;invoke({key:2});function probe(receiver:any,bag:{key:number}){return receiver[bag.key];}consume(probe(unknownFactory(),data));',
  'const data={key:0};function replace(args:any[]){args[0]={key:1};}const other=[{key:2}];replace(other);function read(bag:{key:number}){return bag.key;}read.apply(null,[data]);function probe(receiver:any,bag:{key:number}){return receiver[bag.key];}consume(probe({0:"value"},data));',
  'const data={key:0};function writeOther(bag=data){bag.key=1;}writeOther({key:2});function probe(receiver:any,bag:{key:number}){return receiver[bag.key];}consume(probe({0:"value"},data));',
  'const data={key:0};function writeOther(bag=data){bag.key=1;}const supplied=flag?{key:2}:{key:3};writeOther(supplied);function probe(receiver:any,bag:{key:number}){return receiver[bag.key];}consume(probe({0:"value"},data));',
  'const data={key:0};function read(bag=data){return bag.key;}read(flag?{key:1}:undefined);function probe(receiver:any,bag:{key:number}){return receiver[bag.key];}consume(probe({0:"value"},data));',
  'const data={key:0};function read(args:{key:number}[]){return args.length;}const args=[{key:1}];read(args);function inspect(bag:{key:number}){return bag.key;}inspect.apply(null,args);function probe(receiver:any,bag:{key:number}){return receiver[bag.key];}consume(probe({0:"value"},data));',
  'function read(bag:{key:number}){return bag.key;}function probe(receiver:any,bag:{key:number}){return receiver[bag.key];}const data={key:0};const invoke=read;const args=[data];invoke.apply(null,args);consume(probe({0:"value"},data));',
  'function read(bag:{key:number}={key:1}){return bag.key;}function probe(receiver:any,bag:{key:number}){return receiver[bag.key];}const data={key:0};read();read(undefined);consume(probe({0:"value"},data));',
  'function writeLocal(bag={key:1}){bag.key=2;return bag.key;}function probe(receiver:any,bag:{key:number}){return receiver[bag.key];}const data={key:0};writeLocal();consume(probe({0:"value"},data));',
  'function read(...bags:{key:number}[]){return bags.length;}function probe(receiver:any,bag:{key:number}){return receiver[bag.key];}const data={key:0};read({key:1},data);consume(probe({0:"value"},data));',
  'function read(bag:{key:number}){return bag.key;}function invoke({read:callback}:{read:(bag:{key:number})=>number},bag:{key:number}){return callback(bag);}function probe(receiver:any,bag:{key:number}){return receiver[bag.key];}const data={key:0};invoke({read},data);consume(probe({0:"value"},data));',
  'function read(bag:{key:number}){return bag.key;}function invoke({read:callback}:{read?:(bag:{key:number})=>number},bag:{key:number}){return callback?callback(bag):undefined;}function probe(receiver:any,bag:{key:number}){return receiver[bag.key];}const data={key:0};invoke({read},data);consume(probe({0:"value"},data));',
  'function read(bag:{key:number}){return bag.key;}function probe(receiver:any,bag:{key:number}){return receiver[bag.key];}const data={key:0};read.call(null,data);read.apply(null,[data]);consume(probe({0:"value"},data));',
  'function read(bag:{key:number}){return bag.key;}function probe(receiver:any,bag:{key:number}){return receiver[bag.key];}const data={key:0};const bound=read.bind(null,data);[1,2].map(bound);consume(probe({0:"value"},data));',
  'function read(bag:{key:number}){return bag.key;}function probe(receiver:any,bag:{key:number}){return receiver[bag.key];}const data={key:0};const bound=read.bind(null);bound(data);Reflect.apply(read,null,[data]);consume(probe({0:"value"},data));',
  'function reset(bag:{key:number}){bag={key:1};return bag.key;}function probe(receiver:any,bag:{key:number}){return receiver[bag.key];}const data={key:0};reset.call(null,data);const bound=reset.bind(null,data);bound();consume(probe({0:"value"},data));',
  'function read(bag:{key:number}){return bag.key;}function compile(receiver:any,bag:{key:number}){return receiver[bag.key];}function forward(receiver:any,bag:{key:number}){read(bag);return compile(receiver,bag);}const data={key:0};consume(forward({0:"value"},data));',
  'function resetLocal(bag:{key:number}){bag={key:42};return bag.key;}function compile(receiver:any,bag:{key:number}){return receiver[bag.key];}const data={key:0};resetLocal(data);consume(compile({0:"value"},data));',
  'function inspect(bag:{key:number}){const {key}=bag;return key+1;}function compile(receiver:any,bag:{key:number}){return receiver[bag.key];}const data={key:0};inspect(data);consume(compile({0:"value"},data));',
  'function acquire(receiver:object,box:{key:number}){return(receiver as any)[box.key];} consume(acquire({1:"value"},{key:1}));',
  'function acquire(receiver:object,box:{nested:{key:number}}){return(receiver as any)[box.nested.key];} consume(acquire({1:"value"},{nested:{key:1}}));',
  'function acquire(receiver:object,{key}:{key:number}){return(receiver as any)[key];} consume(acquire({1:"value"},{key:1}));',
  'function acquire(receiver:object,box:{key:number}){return(receiver as any)[box.key];} function wrap(receiver:object,box:{key:number}){return acquire(receiver,box);} consume(wrap({1:"value"},{key:1}));',
  'function acquire(receiver:object,box:{key:"w"}){return(receiver as any)[box.key];} consume(acquire({w:1},{key:"w"}));',
  'function acquire(receiver:object,box:{key:number}){return(receiver as any)[+box.key];} consume(acquire({1:"value"},{key:1}));',
  'function acquire(receiver:any,values:number[]){return receiver[values.length];} consume(acquire(unknownFactory(),[1,2]));',
  'function acquire(receiver:any,box:{key:number}){return receiver[box.key];}consume(acquire(unknownFactory(),Object.freeze({key:1})));',
  'function label(value:object,key:string){return `${(value as any)[key]}`;} label({},"data");',
  'function lookup(value:object,key:string):unknown{return(value as Record<string,unknown>)[key];} consume(lookup({data:1,nested:{value:"ok"}},"data"));',
  'function lookup(value:object,key:string):unknown{return(value as Record<string,unknown>)[key];} function wrap(value:object){return lookup(value,"data");} consume(wrap({data:1}));',
  'function lookup(value:object,key:string):unknown{return(value as Record<string,unknown>)[key];} const data=JSON.parse(`{"data":1}`); consume(lookup(data,"data"));',
  'function inspectRecord(value:object,key:string){void(value as any)[key];return typeof(value as any)[key]==="number";}',
  'const box={key:0};(box as any).key=unknownValue;const receiver:any=unknownFactory();consume(receiver[box.key>>>0]);',
  'function pack(input:any,existing:any){let i,s;const words=existing||[0];for(i=0;i<input.length;i+=1){s=i>>>2;words[s]|=input[i];}return words;}',
  'const receiver:any=unknownFactory(); let key; for(key=0;key<3;key++) consume(receiver[key]);',
  'const receiver:any=unknownFactory(); let key; key=unknownValue>>>2; consume(receiver[key]);',
  'const receiver:any=unknownFactory(); let key; key=unknownValue&31; consume(receiver[key]);',
  'const receiver:any=unknownFactory(); consume(receiver[unknownKeyFactory()+1]);',
  'const receiver:any=unknownFactory(); const data:any=unknownFactory(); consume(data[data.indexOf("first")+1]);',
  'const receiver:any=unknownFactory(); let key=0; key+=2; key-=1; consume(receiver[key]);',
  'const receiver:any=unknownFactory(); const read=(key:number)=>receiver[key]; for(let i=0;i<3;i++) consume(read(i));',
  'const receiver:any=unknownFactory(); function read(key:number){return receiver[key];} consume(read(1));',
  'const receiver:any=unknownFactory(); const data=[1,2]; data.forEach((_,index)=>consume(receiver[index]));',
  'const receiver:any=unknownFactory(); const make=()=>[1,2]; const data=make(); data.forEach((_,index)=>consume(receiver[index]));',
  'const receiver:any=unknownFactory(); Array.from({length:4},(_,index)=>receiver[index]);',
  'const receiver:any=unknownFactory(); const data=[1,2].map(value=>value*2); data.forEach((_,index)=>consume(receiver[index]));',
  'const receiver:any=unknownFactory(); const data=Array.from({length:4},()=>[1,2]); data.flatMap((_,index)=>[receiver[index]]);',
  'const receiver:any=unknownFactory(); const data=[1,2]; consume(receiver[String(data.length)]);',
  'const receiver:any=unknownFactory(); const data=Array(4).fill(0); [1,2].forEach((_,index)=>consume(receiver[index]));',
  'const receiver:any=unknownFactory(); Object.assign(new Error("failure"),{code:"X"}); [1,2].forEach((_,index)=>consume(receiver[index]));',
  'const receiver:any=unknownFactory(); const data=JSON.parse(`{"items":[1,2]}`); data.items.map((_:any,index:number)=>receiver[index]);',
  'setTimeout(() => {}, 0); setInterval(function () {}, 0);',
  'function schedule(callback: () => void) {setTimeout(callback, 0);}',
  'function callback() {} setTimeout(callback, 0);',
  'const data = new Uint32Array(4); data[0] = 1; void data[0];',
  'const values: any = unknownFactory(); for (let i = 0; i < 3; i++) void values[i];',
  'const values: any = unknownFactory(); const items = [1, 2]; for (let i = items.length - 1; i >= 0; i--) void values[i];',
  'const make: any = () => [1, 2]; const values = make(); void values[0];',
  'const values: any = unknownFactory(); const index: number = 1; void values[index];',
  'const values: any = unknownFactory(); void values["data"];',
  'const make = (): {[key: string]: number} => ({w: 1}); const values = make(); const key = "w"; void values[key];',
  'const box: {data: {[key: string]: number}} = {data: {w: 1}}; box.data.w = 2; const key = "w"; void box.data[key];',
  'const box: any = {data: [1, 2]}; box.data[0] = 3; void box.data[0];',
  'const box: any = {data: [1, 2]}; Object.assign(box, {data: [3, 4]}); void box.data[1];',
  'const values: any = unknownFactory(); const key: "w" | "b" = unknownSide; if (["w", "b"].includes(key)) void values[key];',
  'const values: any = unknownFactory(); for (const key of ["w", "b"]) void values[key];',
  'const values: any = unknownFactory(); const key = unknownKey; if (["w", "b"].includes(key)) void values[key];',
  'const values: any = unknownFactory(); void values[+values.indexOf("first") + 1];',
  'function charge(budget: any, field: string, amount: number) {budget[field] += amount; if (budget[field] > 100) throw new Error("limit");}',
  'function inspect(value: {[key: string]: unknown}, key: string) {let alias: unknown = value.data; alias = null; if(["data"].includes(key)) return value[key]; return undefined;}',
  'function access(array: any, index: number) {void array[index];} function Function(value: string) {return value;} void Function("data");',
];
afterEach(() => { for (const root of temporary.splice(0)) rmSync(root, { recursive: true, force: true }); });
const put = (root: string, path: string, value: string): void => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), value);
};
const fixture = (): string => {
  mkdirSync("/tmp/opencode", { recursive: true });
  const root = mkdtempSync("/tmp/opencode/challenge-source-inventory-");
  temporary.push(root);
  for (const path of ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", `${CORE}/package.json`, `${ARENA}/package.json`, `${TRAINING}/package.json`, `${CORE}/tsconfig.json`, `${ARENA}/tsconfig.json`, `${TRAINING}/tsconfig.json`, `${ARENA}/hermetic/pins.json`]) {
    put(root, path, readFileSync(join(repository, path), "utf8"));
  }
  put(root, `${CORE}/package.json`, JSON.stringify({ name: "@chess-coach/starchess-core", exports: { ".": "./src/index.ts", "./planning-v1": "./src/planning-v1.ts" }, dependencies: { fflate: "^0.8.3" } }));
  put(root, `${ARENA}/package.json`, JSON.stringify({ name: "@chess-coach/starchess-arena", exports: {
    ".": "./src/index.ts", "./observations": "./src/observations.ts", "./intent-codec-v1": "./src/intent-codec-v1.ts", "./events": "./src/events.ts",
  }, dependencies: { "@chess-coach/starchess-core": "workspace:*", jssha: "3.3.2" }, devDependencies: { tsx: "^4.19.5", typescript: "~5.9.3" } }));
  put(root, `${TRAINING}/package.json`, JSON.stringify({ name: "@chess-coach/starchess-training", exports: { "./candidates": "./src/candidates.ts" }, dependencies: {
    "@chess-coach/starchess-core": "workspace:*", "@chess-coach/starchess-arena": "workspace:*", jssha: "3.3.2",
  } }));
  for (const path of [`${CORE}/src/index.ts`, `${CORE}/src/planning-v1.ts`, `${CORE}/src/seeds.ts`, `${ARENA}/src/index.ts`, `${ARENA}/src/observations.ts`, `${ARENA}/src/events.ts`, `${ARENA}/src/intent-codec-v1.ts`, `${TRAINING}/src/candidates.ts`, `${ARENA}/src/challenge/worker.ts`, `${ARENA}/src/challenge/sourceInventory.ts`, `${ARENA}/src/challengeContract/codec.ts`]) put(root, path, "export {};\n");
  put(root, `${ARENA}/src/cli/challenge.ts`, 'import "@chess-coach/starchess-core";\n');
  put(root, `${ARENA}/src/challenge/supervisor.ts`, 'import { createRequire } from "node:module";\ncreateRequire(import.meta.url).resolve("tsx");\nnew URL("./worker.ts", import.meta.url);\n');
  put(root, "scripts/challenge-contract-evidence.ts", `import "../${ARENA}/src/challengeContract/codec";\n`);
  put(root, `${ARENA}/hermetic/run.mjs`, 'import "./runtime.mjs";\nimport pins from "./pins.json" with { type: "json" };\nvoid pins;\n');
  put(root, `${ARENA}/hermetic/runtime.mjs`, 'import "node:child_process";\nnew URL(variable, import.meta.url);\n');
  put(root, `${ARENA}/hermetic/infra.test.mjs`, "export {};\n");
  put(root, `${ARENA}/src/__tests__/excluded.ts`, "import(computed);\n");
  return root;
};
const importedReceivers = [
  'import {specialGasCost} from "@chess-coach/starchess-core/planning-v1"; (specialGasCost as any)[["con","structor"].join("")]("return process")();',
  'import {specialGasCost as cost} from "@chess-coach/starchess-core/planning-v1"; const alias=cost; (alias as any)[["con","structor"].join("")]("return process")();',
  'import * as planning from "@chess-coach/starchess-core/planning-v1"; (planning.specialGasCost as any)[["con","structor"].join("")]("return process")();',
  'import {specialGasCost} from "@chess-coach/starchess-core/planning-v1"; const make=()=>specialGasCost; const value=make(); (value as any)[["con","structor"].join("")]("return process")();',
  'import {Budget} from "@chess-coach/starchess-core/planning-v1"; (Budget as any)[["con","structor"].join("")]("return process")();',
];
const importedFixture = (code: string): string => {
  const root = fixture();
  put(root, `${CORE}/src/planning-v1.ts`, 'export {specialGasCost,Budget,numbers} from "./rules/specials/registry";');
  put(root, `${CORE}/src/rules/specials/registry.ts`, 'export const specialGasCost=(kind:string):number=>kind.length; export class Budget{}; export const numbers=[1,2,3];');
  put(root, `${TRAINING}/src/candidates.ts`, code);
  return root;
};

describe("partitioned challenge source inventory", () => {
  it.each(deferredMutations)("tracks parameter effects: $name", ({effect}) => {
    const root = fixture();
    put(root, `${CORE}/src/index.ts`, deferredMutationProbe(effect));
    expect(() => collectSourceInventory(root)).toThrow(/Unsupported code constructor acquisition|Unsupported parameter mutation/);
  });
  it.each(wrappedMutations)("invalidates caller field shapes through a local invocation wrapper: %s", (invocation) => {
    const root = fixture();
    put(root, `${CORE}/src/index.ts`, mutationProbe(invocation));
    expect(() => collectSourceInventory(root)).toThrow(/Unsupported code constructor acquisition|Unsupported parameter mutation/);
  });
  it.each(importedReceivers)("resolves imported callable and constructor receiver signatures: %s", (code) => {
    expect(() => collectSourceInventory(importedFixture(code))).toThrow("Unsupported code constructor acquisition");
  });
  it("resolves imported ordinary numeric data without classifying it as callable", () => {
    const root = importedFixture('import {numbers} from "@chess-coach/starchess-core/planning-v1"; for(let i=0;i<numbers.length;i++) consume(numbers[i]);');
    expect(collectSourceInventory(root).audit.passed).toBe(true);
  });
  it.each([".js", ".mjs"])("proves hoisted JavaScript counter writes and rejects a string rewrite in %s", (extension) => {
    const root = fixture();
    const path = `${CORE}/src/numeric-read${extension}`;
    put(root, path, minifiedNumericRead);
    expect(collectSourceInventory(root).audit.passed).toBe(true);
    put(root, path, minifiedNumericRead.replace("consume(words[index])", 'index=["con","structor"].join("");consume(words[index])'));
    expect(() => collectSourceInventory(root)).toThrow("Unsupported code constructor acquisition");
  });
  it.each([`${TRAINING}/src/candidates.ts`, `${ARENA}/src/observations.ts`])("rejects every consumer edge kind to the core root: %s", (path) => {
    const root = fixture();
    for (const code of [
      'import "@chess-coach/starchess-core";',
      'import type {Hidden} from "@chess-coach/starchess-core";',
      'export * from "@chess-coach/starchess-core";',
      'export type {Hidden} from "@chess-coach/starchess-core";',
      'type Hidden = import("@chess-coach/starchess-core").Hidden;',
      'import "../../starchess-core/src/index";',
    ]) {
      put(root, path, code);
      expect(() => collectSourceInventory(root)).toThrow("Forbidden core root edge");
    }
  });
  it("keeps the native root and every unreferenced core file in the whole inventory", () => {
    const root = fixture();
    put(root, `${CORE}/src/scfen/native.ts`, 'import "fflate";');
    const inventory = collectSourceInventory(root);
    expect(inventory.entrypoints).toEqual(expect.arrayContaining([`${CORE}/src/index.ts`, `${CORE}/src/planning-v1.ts`]));
    expect(inventory.files.map((file) => file.path)).toContain(`${CORE}/src/scfen/native.ts`);
    expect(inventory.audit.edges).toContainEqual(expect.objectContaining({ specifier: "fflate", targetKind: "external" }));
  });
  it.each([".", "./planning-v1"])("rejects a noncanonical erased types branch for core %s", (subpath) => {
    const root = fixture();
    const path = `${CORE}/package.json`;
    const manifest = JSON.parse(readFileSync(join(root, path), "utf8"));
    manifest.exports[subpath] = { import: manifest.exports[subpath], types: "./src/seeds.ts" };
    put(root, path, JSON.stringify(manifest));
    expect(() => collectSourceInventory(root)).toThrow("Unsupported workspace export map");
  });
  it.each(["index", "scfen/native", "replay/native", "commands/native", "resolve/native"])("rejects transitive native planning inventory edge %s", (target) => {
    const root = fixture();
    put(root, `${CORE}/src/${target}.ts`, "export type Hidden = number;");
    put(root, `${CORE}/src/planning-v1.ts`, 'export * from "./bridge";');
    put(root, `${CORE}/src/bridge.ts`, `export type {Hidden} from "./${target}";`);
    expect(() => collectSourceInventory(root)).toThrow("Forbidden native planning edge");
  });
  it("rejects fflate reconnection from planning while allowing native core use", () => {
    const root = fixture();
    put(root, `${CORE}/src/index.ts`, 'import "fflate";');
    expect(collectSourceInventory(root).audit.passed).toBe(true);
    put(root, `${CORE}/src/planning-v1.ts`, 'import "fflate";');
    expect(() => collectSourceInventory(root)).toThrow("Forbidden native planning edge");
  });
  it("rejects the exact indexed descriptor call outside the reviewed array declaration", () => {
    const root = fixture();
    put(root, `${ARENA}/src/challengeContract/validation.ts`, 'function acquire(value: unknown, index: number) {return Object.getOwnPropertyDescriptor(value, String(index));}');
    expect(() => collectSourceInventory(root)).toThrow("Unsupported code constructor acquisition");
  });
  it("preserves global evaluation rejection after data-type inference", () => {
    const root = fixture();
    put(root, `${CORE}/src/index.ts`, 'function access(array: any, index: number) {void array[index];} Function("return process")();');
    expect(() => collectSourceInventory(root)).toThrow("Unsupported string evaluation");
  });
  it.each(unprovenComputedReceivers)("rejects unproven call-derived or mutated receivers: %s", (code) => {
    const root = fixture();
    put(root, `${CORE}/src/index.ts`, code);
    expect(() => collectSourceInventory(root)).toThrow(/Unsupported code constructor acquisition|Unsupported mutable computed receiver|Unsupported builtin acquisition|Unsupported string evaluation|Forbidden process access/);
  });
  it.each(ordinaryComputedData)("allows ordinary call-derived and mutated data indexing: %s", (code) => {
    const root = fixture();
    put(root, `${CORE}/src/index.ts`, code);
    expect(collectSourceInventory(root).audit.passed).toBe(true);
  });
  it.each(arrayMemberConstructors)("rejects numeric array function constructor acquisition: %s", (code) => {
    const root = fixture();
    put(root, `${CORE}/src/index.ts`, code);
    expect(() => collectSourceInventory(root)).toThrow("Unsupported code constructor acquisition");
  });
  it.each(dataArrayAccesses)("allows ordinary data array indexing: %s", (code) => {
    const root = fixture();
    put(root, `${CORE}/src/index.ts`, code);
    expect(collectSourceInventory(root).audit.passed).toBe(true);
  });
  it.each(ownMemberConstructors)("rejects computed constructors on own function members: %s", (code) => {
    const root = fixture();
    put(root, `${CORE}/src/index.ts`, code);
    expect(() => collectSourceInventory(root)).toThrow("Unsupported code constructor acquisition");
  });
  it("allows computed own data indexing beside function members", () => {
    const root = fixture();
    put(root, `${CORE}/src/index.ts`, 'const box: any = {f: () => {}, data: {w: 1, b: 2}}; const alias = box.data; void alias[key];');
    expect(collectSourceInventory(root).audit.passed).toBe(true);
  });
  it.each([
    'import.meta.url = "file:///contracts/anchor.cjs";',
    'delete import.meta.url;',
    'const meta = import.meta; Object.assign(meta, {url: "file:///contracts/anchor.cjs"});',
    'Object.defineProperty(import.meta, "url", {value: "file:///contracts/anchor.cjs"});',
    'const load = (() => {}).constructor(`return process.getBuiltinModule("module")`)();',
    'const compile = Reflect.get(() => {}, "constructor"); compile("return process")();',
    '[import.meta.url] = ["file:///contracts/anchor.cjs"];',
    '({url: import.meta.url} = {url: "file:///contracts/anchor.cjs"});',
    'for ([import.meta.url] of [["file:///contracts/anchor.cjs"]]) {}',
    'const key = "constructor"; const compile = (() => {})[key];',
    'const {constructor: compile} = () => {};',
    'const read = Reflect.get; const compile = read(() => {}, "constructor");',
    'const key = "con" + "structor"; const compile = (() => {})[key];',
    'const key = ["con", "structor"].join(""); const compile = ((() => {}) as any)[key];',
    'const fn: any = () => {}; const key = ["con", "structor"].join(""); const compile = fn[key];',
    'const key = ["con", "structor"].join(""); const compile = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(() => {}), key).value;',
    'let fn: any = {}; fn = () => {}; const key = ["con", "structor"].join(""); const compile = fn[key];',
    'let fn: any = {}; fn = () => {}; const alias = fn; const key = ["con", "structor"].join(""); const compile = alias[key];',
    'let fn: any = {}; [fn] = [() => {}]; const key = ["con", "structor"].join(""); const compile = fn[key];',
    'const {getPrototypeOf: p} = Object; const proto = p(() => {}); const key = ["con", "structor"].join(""); const compile = proto[key];',
    'let api: any = {}; api = Object; for (const key of ["getPrototypeOf"]) { const proto = api[key](() => {}); }',
    'let api: any = {}; api = Object; for (const key of ["getOwnPropertyDescriptor"]) { const descriptor = api[key]; }',
    'const api = Object; for (const key of ["getPrototypeOf"]) { const proto = api[key](() => {}); }',
  ])("rejects metadata mutation and indirect code constructors: %s", (code) => {
    const root = fixture();
    put(root, `${CORE}/src/index.ts`, code);
    expect(() => collectSourceInventory(root)).toThrow(/Unsupported import metadata|Unsupported code constructor|Unsupported mutable computed receiver|Unsupported builtin acquisition/);
  });
  it("audits execution files named infra.test.mjs instead of bypassing partition rules", () => {
    const root = fixture();
    put(root, `${ARENA}/src/infra.test.mjs`, 'import "./challengeContract/codec";\n');
    expect(() => collectSourceInventory(root)).toThrow("Forbidden partition edge");
  });

  it.each([
    'const load = createRequire(import.meta.url).bind(null); load(variable);',
    'const request = createRequire(import.meta.url); const bound = request.bind(null); bound(variable);',
    'const request = createRequire(import.meta.url); Reflect.apply(request, null, [variable]);',
    'const { resolve: locate } = createRequire(import.meta.url); locate(variable);',
  ])("rejects escaping a module loader: %s", (code) => {
    const root = fixture();
    put(root, `${ARENA}/src/escape.ts`, `import {createRequire} from "node:module";\n${code}\n`);
    expect(() => collectSourceInventory(root)).toThrow(/Unsupported loader/);
  });

  it.each([
    'import nodeModule from "node:module"; nodeModule.createRequire(import.meta.url)("../challengeContract/codec.ts");',
    'import nodeModule from "module"; nodeModule["createRequire"](import.meta.url)("../challengeContract/codec.ts");',
    'import {default as nodeModule} from "node:module"; nodeModule.createRequire(import.meta.url)("../challengeContract/codec.ts");',
    'import {Module as nodeModule} from "node:module"; nodeModule.createRequire(import.meta.url)("../challengeContract/codec.ts");',
    'import * as nodeModule from "node:module"; const alias = nodeModule; alias.createRequire(import.meta.url)("../challengeContract/codec.ts");',
    'import nodeModule from "node:module"; const second = first; const first = nodeModule; second["createRequire"](import.meta.url)("../challengeContract/codec.ts");',
    'import nodeModule from "node:module"; (0, nodeModule.createRequire)(import.meta.url)("../challengeContract/codec.ts");',
    'import nodeModule from "node:module"; (nodeModule["createRequire"] as typeof nodeModule.createRequire)!(import.meta.url)("../challengeContract/codec.ts");',
    'import nodeModule from "node:module"; const make = nodeModule.createRequire; make(import.meta.url)("../challengeContract/codec.ts");',
    'import nodeModule from "node:module"; const make = later; const later = nodeModule["createRequire"]; make(import.meta.url)("../challengeContract/codec.ts");',
    'import { createRequire as make } from "node:module"; const first = second; const second = make; first(import.meta.url)("../challengeContract/codec.ts");',
    'import { createRequire as make } from "node:module"; const load = later; const later = make(import.meta.url); load("../challengeContract/codec.ts");',
    'import { createRequire } from "node:module"; (createRequire(import.meta.url) as ReturnType<typeof createRequire>)!("../challengeContract/codec.ts");',
    'module["require"]("../challengeContract/codec.ts");',
  ])("audits literal forbidden targets through supported loader syntax: %s", (code) => {
    const root = fixture();
    put(root, `${ARENA}/src/challenge/worker.ts`, code);
    expect(() => collectSourceInventory(root)).toThrow("Forbidden partition edge");
  });

  it.each([
    'make("/app/packages/starchess-arena/src/challengeContract/anchor.cjs")("./codec.cjs");',
    'make(new URL("file:///app/packages/starchess-arena/src/challengeContract/anchor.cjs"))("./codec.cjs");',
    'make(new URL("../challengeContract/anchor.cjs", import.meta.url))("./codec.cjs");',
    'make(new URL(import.meta.url))("./codec.cjs");',
    'make("file:///app/packages/starchess-arena/src/challengeContract/anchor.cjs")("./codec.cjs");',
    'const base = import.meta.url; make(base)("./codec.cjs");',
    'make((other(), import.meta.url))("./codec.cjs");',
    'make()("./codec.cjs");',
    'make(import.meta.url, extra)("./codec.cjs");',
    'make(...args)("./codec.cjs");',
  ])("rejects unsupported factory bases through forward aliases: %s", (code) => {
    const root = fixture();
    put(root, `${ARENA}/src/challenge/codec.cjs`, 'module.exports = "execution decoy";\n');
    put(root, `${ARENA}/src/challengeContract/codec.cjs`, 'module.exports = "contracts target";\n');
    put(root, `${ARENA}/src/challenge/worker.ts`, `import nodeModule from "node:module";\nconst make = later; const later = nodeModule["createRequire"];\n${code}\n`);
    expect(() => collectSourceInventory(root)).toThrow("Unsupported createRequire base");
  });

  it.each(["absolute path", "URL"])("rejects a %s factory base that resolves to contracts instead of an execution decoy", (kind) => {
    const root = fixture();
    const anchor = join(root, `${ARENA}/src/challengeContract/anchor.cjs`);
    const worker = join(root, `${ARENA}/src/challenge/worker.ts`);
    put(root, `${ARENA}/src/challengeContract/anchor.cjs`, "module.exports = {};\n");
    put(root, `${ARENA}/src/challengeContract/codec.cjs`, 'module.exports = "contracts target";\n');
    put(root, `${ARENA}/src/challenge/codec.cjs`, 'module.exports = "execution decoy";\n');
    const base = kind === "URL" ? pathToFileURL(anchor) : anchor;
    expect(createRequire(base)("./codec.cjs")).toBe("contracts target");
    expect(createRequire(worker)("./codec.cjs")).toBe("execution decoy");
    const expression = kind === "URL" ? `new URL(${JSON.stringify(pathToFileURL(anchor).href)})` : JSON.stringify(anchor);
    put(root, `${ARENA}/src/challenge/worker.ts`, `import {createRequire as factory} from "node:module";\nconst make = later; const later = factory;\nmake(${expression})("./codec.cjs");\n`);
    expect(() => collectSourceInventory(root)).toThrow("Unsupported createRequire base");
  });

  it.each([
    'process.mainModule.require("node:fs");',
    'process.require("node:fs");',
    'process.binding("fs");',
    'process.dlopen(module, "addon.node");',
    'const p = process; const acquire = p.binding; acquire("fs");',
    'import {binding as acquire} from "node:process"; acquire("fs");',
    'export {dlopen} from "node:process";',
    'process.getBuiltinModule("module").createRequire(import.meta.url)("../challengeContract/codec.ts");',
    'process["getBuiltinModule"]("module").createRequire(import.meta.url)("../challengeContract/codec.ts");',
    'const acquire = process.getBuiltinModule; acquire("module");',
    'const p = later; const later = process; const acquire = p["getBuiltinModule"]; acquire("module");',
    'const key = "getBuiltinModule"; process[key]("module");',
    'const {getBuiltinModule: acquire} = process; acquire("module");',
    'const box = {process}; box.process.getBuiltinModule("module");',
    'import p from "node:process"; p.getBuiltinModule("module");',
    'import * as p from "node:process"; const alias = p; alias["getBuiltinModule"]("module");',
    'import * as p from "node:process"; p.default.getBuiltinModule("module");',
    'import {default as p} from "process"; p.getBuiltinModule("module");',
    'import {getBuiltinModule as acquire} from "node:process"; acquire("module");',
    'globalThis.process.getBuiltinModule("module");',
    'const g = globalThis; const p = g["process"]; p["getBuiltinModule"]("module");',
    'const g = global; g.globalThis.process.getBuiltinModule("module");',
    'const p = require("node:process"); p.getBuiltinModule("module");',
    'import("node:process").then(p => p.getBuiltinModule("module"));',
    'export {getBuiltinModule as acquire} from "node:process";',
    'export * from "node:process";',
  ])("rejects unsupported builtin acquisition: %s", (code) => {
    const root = fixture();
    put(root, `${ARENA}/src/challenge/worker.ts`, code);
    expect(() => collectSourceInventory(root)).toThrow("Unsupported builtin acquisition");
  });

  it("rejects an actual builtin acquisition that loads contracts in CommonJS", () => {
    const root = fixture();
    const path = `${ARENA}/src/challenge/acquire.cjs`;
    put(root, `${ARENA}/src/challengeContract/codec.cjs`, 'module.exports = "contracts target";\n');
    put(root, path, 'module.exports = process.getBuiltinModule("module").createRequire(__filename)("../challengeContract/codec.cjs");\n');
    expect(createRequire(import.meta.url)(join(root, path))).toBe("contracts target");
    expect(() => collectSourceInventory(root)).toThrow("Unsupported builtin acquisition");
  });

  it.each([
    'import {register} from "node:module"; register("../challengeContract/codec.ts", import.meta.url);',
    'import {registerHooks as install} from "module"; install(hooks);',
    'import nodeModule from "node:module"; nodeModule.register("../challengeContract/codec.ts", import.meta.url);',
    'import * as nodeModule from "node:module"; const alias = nodeModule; alias["registerHooks"](hooks);',
    'import {Module as nodeModule} from "node:module"; const install = nodeModule["register"]; install(variable);',
  ])("rejects unsupported Node module registration APIs: %s", (code) => {
    const root = fixture();
    put(root, `${ARENA}/src/challenge/worker.ts`, code);
    expect(() => collectSourceInventory(root)).toThrow("Unsupported module loader API");
  });

  it.each([
    'eval("require(\'../challengeContract/codec.cjs\')");',
    '(0, eval)("require(\'../challengeContract/codec.cjs\')");',
    '(eval as typeof eval)!(variable);',
    'const execute = eval; execute(variable);',
    'Reflect.apply(eval, null, [variable]);',
    'eval.call(null, variable);',
    'globalThis.eval(variable);',
    'globalThis["eval"](variable);',
    'const g = later; const later = globalThis; g["eval"](variable);',
    'const g = global; g.globalThis.eval(variable);',
    'Function("return import(\'../challengeContract/codec.ts\')")();',
    'new Function("return import(\'../challengeContract/codec.ts\')")();',
    '(0, Function)(variable)();',
    'const compile = Function; compile(variable)();',
    'globalThis["Function"](variable)();',
    'const g = globalThis; new g.Function(variable)();',
    'const box = {execute: eval}; box.execute(variable);',
  ])("rejects direct and indirect string evaluation: %s", (code) => {
    const root = fixture();
    put(root, `${ARENA}/src/challenge/escape.cjs`, code);
    expect(() => collectSourceInventory(root)).toThrow("Unsupported string evaluation");
  });

  it("rejects an actual CommonJS eval load into contracts", () => {
    const root = fixture();
    const path = `${ARENA}/src/challenge/evaluate.cjs`;
    put(root, `${ARENA}/src/challengeContract/codec.cjs`, 'module.exports = "contracts target";\n');
    put(root, path, 'module.exports = eval("require(\'../challengeContract/codec.cjs\')");\n');
    expect(createRequire(import.meta.url)(join(root, path))).toBe("contracts target");
    expect(() => collectSourceInventory(root)).toThrow("Unsupported string evaluation");
  });

  it("allows normalized import.meta.url factory bases and safe process namespace aliases", () => {
    const root = fixture();
    put(root, `${ARENA}/src/challenge/worker.ts`, 'import {createRequire as make} from "node:module";\nconst load = make(((import.meta.url as string)!));\nload("./supervisor.ts");\nimport * as p from "node:process"; const alias = p; void alias.env[variable]; void alias.default.argv;\nconst g = globalThis; void g.crypto;\n');
    expect(collectSourceInventory(root).audit.edges).toContainEqual(expect.objectContaining({
      importer: `${ARENA}/src/challenge/worker.ts`, target: `${ARENA}/src/challenge/supervisor.ts`, kind: "require",
    }));
  });

  it("allows genuine lexical shadows, property names and erased evaluation API types", () => {
    const root = fixture();
    put(root, `${ARENA}/src/challenge/worker.ts`, 'type Eval = typeof eval; type Constructor = Function;\nimport type {getBuiltinModule} from "node:process"; import type {registerHooks} from "node:module";\nexport type {getBuiltinModule, registerHooks};\nconst object = {eval: 1, Function: 2, getBuiltinModule: 3, register: 4}; void object.eval; void object.Function;\nfunction local(eval: (value: string) => string, Function: (value: string) => string, process: {getBuiltinModule: () => string}) { eval("safe"); Function("safe"); return process.getBuiltinModule(); }\nfunction scope() { function eval(value: string) { return value; } function Function(value: string) { return value; } return [eval("safe"), Function("safe")]; }\n');
    expect(collectSourceInventory(root).audit.passed).toBe(true);
  });

  it("allows actual CommonJS functions that shadow evaluation globals", () => {
    const root = fixture();
    const path = `${ARENA}/src/challenge/shadows.cjs`;
    put(root, path, 'function eval(value) { return value; }\nfunction Function(value) { return value; }\nfunction local(process, globalThis) { return [process.getBuiltinModule(), globalThis.eval(), globalThis.Function()]; }\nmodule.exports = [eval("local eval"), Function("local Function"), ...local({getBuiltinModule: () => "local process"}, {eval: () => "local method", Function: () => "local constructor method"})];\n');
    expect(createRequire(import.meta.url)(join(root, path))).toEqual(["local eval", "local Function", "local process", "local method", "local constructor method"]);
    expect(collectSourceInventory(root).audit.passed).toBe(true);
  });

  it.each([
    ["worker.ts", 'import {createRequire} from "node:module"; createRequire(import.meta.url).resolve("tsx");'],
    ["supervisor.ts", 'import {createRequire} from "node:module"; createRequire(import.meta.url).resolve("tsx/package.json");'],
    ["supervisor.ts", 'import {createRequire as make} from "node:module"; make(import.meta.url).resolve("tsx");'],
  ])("keeps the inline factory resolver confined to its existing supervisor scope: %s %s", (name, code) => {
    const root = fixture();
    put(root, `${ARENA}/src/challenge/${name}`, code);
    expect(() => collectSourceInventory(root)).toThrow("Undeclared createRequire resolver");
  });

  it.each([
    'const box = {make: nodeModule.createRequire}; box.make(import.meta.url)("../challengeContract/codec.js");',
    'const box = {make: nodeModule["createRequire"]}; box.make(import.meta.url)("../challengeContract/codec.ts");',
    'const make = nodeModule["createRequire"]; const box = {make}; box.make(import.meta.url)("../challengeContract/codec.ts");',
    'const make = later; const later = nodeModule.createRequire; const box = {make}; box.make(import.meta.url)("../challengeContract/codec.ts");',
    'const box = {nodeModule}; box.nodeModule.createRequire(import.meta.url)("../challengeContract/codec.ts");',
    'const alias = nodeModule; export {alias};',
    'export {nodeModule};',
    'export default nodeModule;',
    'export const alias = nodeModule;',
    'export const make = nodeModule.createRequire;',
    'export const load = nodeModule.createRequire(import.meta.url);',
    'const alias = nodeModule; alias = other;',
    'nodeModule = other;',
    'nodeModule.createRequire = other;',
    'const key = "createRequire"; nodeModule[key](import.meta.url)("../challengeContract/codec.ts");',
    'nodeModule[getter()](import.meta.url)("../challengeContract/codec.ts");',
    'nodeModule["default"].createRequire(import.meta.url)("../challengeContract/codec.ts");',
    'const {createRequire: make} = (nodeModule as unknown);',
    'consume(nodeModule);',
    'consume(nodeModule["createRequire"]);',
    'function getModule() { return nodeModule; }',
    'function getFactory() { return nodeModule.createRequire; }',
    'const load = nodeModule.createRequire(import.meta.url); consume(load);',
    'const load = nodeModule.createRequire(import.meta.url); const box = {load};',
    'const load = nodeModule.createRequire(import.meta.url); function getLoader() { return load; }',
    'const load = nodeModule.createRequire(import.meta.url); load = other;',
    'const load = nodeModule.createRequire(import.meta.url); const key = "resolve"; load[key]("../challengeContract/codec.ts");',
    'const load = nodeModule.createRequire(import.meta.url); load[getter()]("../challengeContract/codec.ts");',
    'const load = nodeModule.createRequire(import.meta.url); const locate = load["resolve"]; locate("../challengeContract/codec.ts");',
    'const make = nodeModule.createRequire; make = other;',
    'const make = nodeModule.createRequire; make["call"](null, import.meta.url)("../challengeContract/codec.ts");',
    'const box = [nodeModule.createRequire]; box[0](import.meta.url)("../challengeContract/codec.ts");',
  ])("fails closed on namespace, factory, or loader escapes: %s", (code) => {
    const root = fixture();
    put(root, `${ARENA}/src/challenge/worker.ts`, `import nodeModule from "node:module";\n${code}\n`);
    expect(() => collectSourceInventory(root)).toThrow(/Unsupported loader (escape|destructuring)|Forbidden partition edge/);
  });

  it.each([
    'export * from "node:module";',
    'export * as box from "node:module";',
    'export {createRequire as make} from "node:module";',
    'export {default as box} from "module";',
    'export {Module as box} from "node:module";',
    'import {createRequire as make} from "node:module"; export {make};',
    'import * as nodeModule from "node:module"; const alias = nodeModule; export {alias as box};',
  ])("rejects loader-bearing reexports: %s", (code) => {
    const root = fixture();
    put(root, `${ARENA}/src/challenge/worker.ts`, code);
    expect(() => collectSourceInventory(root)).toThrow("Unsupported loader escape");
  });

  it.each([
    'import("node:module").then(nodeModule => nodeModule.createRequire(import.meta.url)("../challengeContract/codec.ts"));',
    'const nodeModule = await import("module"); nodeModule.default.createRequire(import.meta.url)("../challengeContract/codec.ts");',
    'const nodeModule = require("node:module"); nodeModule.createRequire(import.meta.url)("../challengeContract/codec.ts");',
  ])("rejects non-static module namespaces: %s", (code) => {
    const root = fixture();
    put(root, `${ARENA}/src/challenge/worker.ts`, code);
    expect(() => collectSourceInventory(root)).toThrow("Unsupported dynamic module import");
  });

  it.each([
    'require("./helper.txt");',
    'require.resolve("./helper.txt");',
    'import nodeModule from "node:module"; (nodeModule.createRequire)(import.meta.url)("./helper.txt");',
    'import * as nodeModule from "node:module"; const alias = nodeModule; alias["createRequire"](import.meta.url)("./helper.txt");',
    'import {createRequire as make} from "node:module"; const load = make(import.meta.url); load("./helper.txt");',
    'import "./helper.txt";',
  ])("rejects actual unrecognized-extension executable sources: %s", (code) => {
    const root = fixture();
    const helper = `${ARENA}/src/challenge/helper.txt`;
    put(root, helper, 'exports.value = require("../challengeContract/codec.cjs").value;\n');
    put(root, `${ARENA}/src/challengeContract/codec.cjs`, "exports.value = 42;\n");
    expect(createRequire(import.meta.url)(join(root, helper))).toEqual({ value: 42 });
    put(root, `${ARENA}/src/challenge/worker.ts`, code);
    expect(() => collectSourceInventory(root)).toThrow("Unaudited executable extension");
  });

  it("preserves static named loaders, extensionless code, JSON, MJS, package resolution and supervisor edges", () => {
    const root = fixture();
    put(root, `${ARENA}/src/challenge/helper.ts`, "export {};\n");
    put(root, `${ARENA}/src/challenge/other.mjs`, "export {};\n");
    put(root, `${ARENA}/src/challenge/data.json`, '{"value":42}\n');
    put(root, `${ARENA}/src/challenge/worker.ts`, 'import {createRequire as make} from "node:module";\nconst load = make(import.meta.url);\nload("./helper");\nload("./other.mjs");\nload("./data.json");\nload.resolve("tsx/package.json");\n');
    const inventory = collectSourceInventory(root);
    expect(inventory.audit.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ specifier: "./helper", target: `${ARENA}/src/challenge/helper.ts`, kind: "require" }),
      expect.objectContaining({ specifier: "./other.mjs", kind: "require" }),
      expect.objectContaining({ specifier: "./data.json", kind: "require" }),
      expect.objectContaining({ specifier: "tsx/package.json", targetKind: "external", kind: "resolve" }),
      expect.objectContaining({ specifier: "tsx", kind: "resolve", importer: `${ARENA}/src/challenge/supervisor.ts` }),
      expect.objectContaining({ specifier: "./worker.ts", kind: "worker" }),
    ]));
  });

  it.each([
    'import nodeModule from "node:module"; (0, nodeModule.createRequire)(import.meta.url)("./supervisor.ts");',
    'import nodeModule from "node:module"; (nodeModule["createRequire"] as typeof nodeModule.createRequire)!(import.meta.url)("./supervisor.ts");',
    'import {createRequire} from "node:module"; (createRequire(import.meta.url) as ReturnType<typeof createRequire>)!("./supervisor.ts");',
    'import nodeModule from "node:module"; const make = later; const later = (nodeModule["createRequire"] satisfies typeof nodeModule.createRequire); make(import.meta.url)("./supervisor.ts");',
    'import * as nodeModule from "node:module"; const second = first; const first = (nodeModule); second.createRequire(import.meta.url)("./supervisor.ts");',
  ])("records allowed literal targets through wrappers and forward aliases: %s", (code) => {
    const root = fixture();
    put(root, `${ARENA}/src/challenge/worker.ts`, code);
    expect(collectSourceInventory(root).audit.edges).toContainEqual(expect.objectContaining({
      importer: `${ARENA}/src/challenge/worker.ts`, target: `${ARENA}/src/challenge/supervisor.ts`, kind: "require",
    }));
  });

  it("distinguishes lexical bindings and property names from loader value references", () => {
    const root = fixture();
    put(root, `${ARENA}/src/challenge/worker.ts`, 'import {isBuiltin} from "node:module";\nimport {createRequire as make} from "node:module";\nconst load = make(import.meta.url); load("./supervisor.ts");\nconst object = {createRequire: 1, require: 2, module: 3, make: 4};\nvoid object.createRequire; void object.require; void object.module; void object.make;\nfunction local(make: (value: string) => void, module: object, require: number) { make("unrelated"); return {module, require}; }\nfunction inner() { const load = (value: string) => value; return load("unrelated"); }\nvoid isBuiltin("fs");\nexport {isBuiltin};\n');
    expect(collectSourceInventory(root).audit.edges.filter((edge) => edge.importer.endsWith("/worker.ts") && edge.kind === "require")).toEqual([
      expect.objectContaining({ specifier: "./supervisor.ts", target: `${ARENA}/src/challenge/supervisor.ts` }),
    ]);
  });

  it.each([".mjs", ".js"])("audits loader aliases and escapes in JavaScript %s files", (extension) => {
    const root = fixture();
    const path = `${ARENA}/src/challenge/escape${extension}`;
    put(root, path, 'import nodeModule from "node:module"; const make = later; const later = nodeModule["createRequire"]; make(import.meta.url)("../challengeContract/codec.ts");\n');
    expect(() => collectSourceInventory(root)).toThrow("Forbidden partition edge");
    put(root, path, 'import nodeModule from "node:module"; const box = {make: nodeModule["createRequire"]}; box.make(import.meta.url)("../challengeContract/codec.ts");\n');
    expect(() => collectSourceInventory(root)).toThrow("Unsupported loader escape");
  });

  it.each([
    ['require(variable);', "Computed module loader"],
    ['const box = {require}; box.require("../challengeContract/codec.ts");', "Unsupported loader escape"],
    ['const nodeModule = require("node:module"); nodeModule.createRequire(__filename)("../challengeContract/codec.ts");', "Unsupported dynamic module import"],
  ])("rejects unauditable CommonJS loader uses: %s", (code, message) => {
    const root = fixture();
    put(root, `${ARENA}/src/challenge/escape.cjs`, code);
    expect(() => collectSourceInventory(root)).toThrow(message);
  });

  it("audits ordinary CommonJS imports and exports", () => {
    const root = fixture();
    put(root, `${ARENA}/src/challenge/helper.cjs`, "module.exports = {value: 42};\n");
    put(root, `${ARENA}/src/challenge/load.cjs`, 'module.exports = require("./helper.cjs");\n');
    expect(collectSourceInventory(root).audit.edges).toContainEqual(expect.objectContaining({
      importer: `${ARENA}/src/challenge/load.cjs`, target: `${ARENA}/src/challenge/helper.cjs`, kind: "require",
    }));
  });

  it("allows erased loader type queries and type-only reexports", () => {
    const root = fixture();
    put(root, `${ARENA}/src/challenge/worker.ts`, 'import {createRequire as make} from "node:module";\nimport nodeModule from "node:module";\ntype Factory = typeof make;\ntype Namespace = typeof nodeModule;\nexport type {make, nodeModule, Factory, Namespace};\nexport {type make as FactoryValue};\nexport {type createRequire} from "node:module";\n');
    expect(collectSourceInventory(root).audit.passed).toBe(true);
  });

  it("audits its own actual source without confusing AST property names with loader references", () => {
    const root = fixture();
    const path = `${ARENA}/src/challenge/sourceInventory.ts`;
    put(root, path, readFileSync(join(repository, path), "utf8"));
    put(root, `${ARENA}/src/challenge/config.ts`, "export const canonical = JSON.stringify;\n");
    expect(collectSourceInventory(root).audit.auditedFiles).toContain(path);
  });
  it("enumerates deterministic disjoint complete partitions, pins itself, and hashes explicit records", () => {
    const root = fixture();
    const inventory = collectSourceInventory(root);
    expect(collectSourceInventory(root)).toEqual(inventory);
    expect(inventory.version).toBe("challenge-source-inventory-v2");
    expect(inventory.policyVersion).toBe("challenge-source-policy-v2");
    expect(inventory.files.map((file) => file.path)).toEqual(inventory.files.map((file) => file.path).sort());
    expect(inventory.groups["verification-tooling"].some((file) => file.path.endsWith("/sourceInventory.ts"))).toBe(true);
    expect(inventory.files.some((file) => file.path.includes("__tests__"))).toBe(false);
    expect(inventory.groups["verification-tooling"].some((file) => file.path.endsWith("/infra.test.mjs"))).toBe(true);
    expect(inventory.audit.auditedFiles.some((path) => path.endsWith("/infra.test.mjs"))).toBe(true);
    expect(new Set(Object.values(inventory.groups).flat().map((file) => file.path)).size).toBe(inventory.files.length);
    expect(Object.keys(inventory.groups)).toEqual([...SOURCE_PARTITIONS]);
    for (const partition of SOURCE_PARTITIONS) expect(inventory.partitionSha256[partition]).toBe(sha256(canonical(inventory.groups[partition])));
    expect(inventory.runtimeConfigurationSha256).toBe(sha256(canonical(inventory.runtime)));
    expect(inventory.inventorySha256).toBe(sha256(canonical({ version: inventory.version, policyVersion: inventory.policyVersion,
      roots: inventory.roots, entrypoints: inventory.entrypoints, files: inventory.files, groups: inventory.groups })));
    expect(inventory.runtime.find((file) => file.path === ".npmrc")).toEqual({ path: ".npmrc", present: false, sha256: null });
  });

  it.each(["edit", "add", "delete", "rename"])("changes execution and inventory pins on a seeds.ts %s", (mutation) => {
    const root = fixture();
    const before = collectSourceInventory(root);
    const seed = `${CORE}/src/seeds.ts`;
    if (mutation === "edit") put(root, seed, "export const seed = 42;\n");
    if (mutation === "add") put(root, `${CORE}/src/new-seeds.ts`, "export {};\n");
    if (mutation === "delete") rmSync(join(root, seed));
    if (mutation === "rename") renameSync(join(root, seed), join(root, `${CORE}/src/renamed-seeds.ts`));
    const after = collectSourceInventory(root);
    expect(after.partitionSha256["core-rules"]).not.toBe(before.partitionSha256["core-rules"]);
    expect(after.inventorySha256).not.toBe(before.inventorySha256);
    expect(after.partitionSha256["arena-authorized"]).toBe(before.partitionSha256["arena-authorized"]);
    expect(after.partitionSha256["verification-tooling"]).toBe(before.partitionSha256["verification-tooling"]);
    expect(after.runtimeConfigurationSha256).toBe(before.runtimeConfigurationSha256);
  });

  it.each([
    ["verification-tooling", `${ARENA}/src/challengeContract/codec.ts`],
    ["verification-tooling", "scripts/unused.ts"],
    ["verification-tooling", `${ARENA}/hermetic/infra.test.mjs`],
    ["verification-tooling", `${ARENA}/hermetic/probe.mjs`],
    ["verification-tooling", `${ARENA}/hermetic/workspace-policy.mjs`],
    ["verification-tooling", `${ARENA}/hermetic/verification-plan.mjs`],
    ["verification-tooling", `${ARENA}/hermetic/public-closure.mjs`],
    ["verification-tooling", "scripts/r2-composition-evidence.ts"],
    ["verification-tooling", "scripts/__tests__/diagnostic.ts"],
    ["core-rules", `${CORE}/src/data.bin`],
    ["arena-authorized", `${ARENA}/src/observations.ts`],
    ["training-model", `${TRAINING}/src/candidates.ts`],
    ["training-coordinator", `${TRAINING}/src/coordinator/unused.ts`],
  ] as const)("pins all %s artifact bytes at %s", (partition, path) => {
    const root = fixture();
    const before = collectSourceInventory(root);
    put(root, path, path.endsWith(".bin") ? "binary asset" : "export const changed = true;\n");
    const after = collectSourceInventory(root);
    expect(after.partitionSha256[partition]).not.toBe(before.partitionSha256[partition]);
    if (partition !== "core-rules") expect(after.partitionSha256["core-rules"]).toBe(before.partitionSha256["core-rules"]);
  });

  it.each(["pnpm-lock.yaml", `${CORE}/package.json`, `${TRAINING}/package.json`, `${TRAINING}/tsconfig.json`, `${TRAINING}/vitest.config.ts`, `${ARENA}/tsconfig.json`, ".npmrc", ".pnpmfile.cjs", "pnpmfile.cjs", `${ARENA}/hermetic/pins.json`])("pins runtime input or explicit absence: %s", (path) => {
    const root = fixture();
    const before = collectSourceInventory(root);
    const original = before.runtime.find((file) => file.path === path)!;
    put(root, path, original.present ? `${readFileSync(join(root, path), "utf8")}\n` : "captured override\n");
    const after = collectSourceInventory(root);
    expect(after.runtimeConfigurationSha256).not.toBe(before.runtimeConfigurationSha256);
    expect(after.runtime.find((file) => file.path === path)?.present).toBe(true);
    for (const partition of SOURCE_PARTITIONS.filter((partition) => partition !== "verification-tooling")) expect(after.partitionSha256[partition]).toBe(before.partitionSha256[partition]);
  });

  it("captures recursive JSONC tsconfig extends and rejects escapes, cycles, and unresolved bases", () => {
    const root = fixture();
    put(root, `${CORE}/tsconfig.json`, '{ "extends": "../../config/base" }');
    put(root, "config/base.json", '{ // config\n "extends": "./strict.json" }');
    put(root, "config/strict.json", '{ "compilerOptions": { "strict": true } }');
    const before = collectSourceInventory(root);
    expect(before.runtime.some((file) => file.path === "config/strict.json")).toBe(true);
    put(root, "config/strict.json", '{ "compilerOptions": { "strict": false } }');
    expect(collectSourceInventory(root).runtimeConfigurationSha256).not.toBe(before.runtimeConfigurationSha256);
    put(root, "config/strict.json", '{ "extends": "./base.json" }');
    expect(() => collectSourceInventory(root)).toThrow("Cyclic tsconfig");
    put(root, "config/strict.json", '{ "extends": "./absent" }');
    expect(() => collectSourceInventory(root)).toThrow("Missing or ambiguous tsconfig");
    put(root, "config/strict.json", '{ "extends": "../../../../outside.json" }');
    expect(() => collectSourceInventory(root)).toThrow("Unsafe inventory path");
    put(root, "config/strict.json", '{ "extends": "@external/tsconfig" }');
    expect(() => collectSourceInventory(root)).toThrow("Unsafe tsconfig");
  });

  it.each([`${CORE}/src`, `${CORE}/src/symlink.ts`, `${ARENA}/src/__tests__/symlink.ts`, "pnpm-lock.yaml"])("fails closed on symlinks at %s", (path) => {
    const root = fixture();
    rmSync(join(root, path), { recursive: true, force: true });
    symlinkSync(join(root, `${ARENA}/src/challenge/worker.ts`), join(root, path));
    expect(() => collectSourceInventory(root)).toThrow("Symlink");
  });

  it("audits static, type, dynamic, require, import-type, workspace exports and explicit MJS/JS imports", () => {
    const root = fixture();
    put(root, `${CORE}/src/value.ts`, "export type Value = number;\n");
    put(root, `${CORE}/src/nested/index.ts`, "export {};\n");
    put(root, `${CORE}/src/module.mjs`, "export {};\n");
    put(root, `${CORE}/src/module.js`, "export {};\n");
    put(root, `${CORE}/src/index.ts`, 'import type { Value } from "./value";\nexport type { Value } from "./value";\nimport "./nested";\nrequire("./module.mjs");\nimport mjs = require("./module.mjs");\ntype Ref = import("./value").Value;\nimport "./module.js";\nimport "fflate";\n');
    put(root, `${ARENA}/src/challenge/worker.ts`, 'import "fs"; import "node:test"; import("./supervisor");');
    const inventory = collectSourceInventory(root);
    expect(new Set(inventory.audit.edges.map((edge) => edge.kind))).toEqual(new Set(["import", "export", "dynamic", "require", "import-type", "resolve", "worker"]));
    expect(inventory.audit.edges.some((edge) => edge.specifier === "@chess-coach/starchess-core" && edge.target === `${CORE}/src/index.ts`)).toBe(true);
    expect(inventory.audit.edges.some((edge) => edge.specifier === "fflate" && edge.targetKind === "external")).toBe(true);
    expect(inventory.audit.edges.some((edge) => edge.target.endsWith("/nested/index.ts"))).toBe(true);
  });

  it.each([
    ['import "undeclared-dependency";', "Undeclared external"],
    ['import "node:nonexistent-builtin";', "Undeclared external"],
    ['import "./absent";', "Missing or ambiguous import"],
    ['import "./__tests__/hidden";', "Import into excluded tests"],
    ['import "../raw-code.ts";', "Unclassified import target"],
    ['import(variable);', "Computed module loader"],
    ['require(variable);', "Computed module loader"],
    ['require.resolve(variable);', "Computed module loader"],
    ['require["resolve"](variable);', "Computed module loader"],
    ['module.require(variable);', "Computed module loader"],
    ['const load = require; load(variable);', "Computed module loader"],
    ['(0, require)(variable);', "Computed module loader"],
    ['import * as mod from "node:module"; const load = mod.createRequire(import.meta.url); load(variable);', "Computed module loader"],
    ['import { createRequire } from "node:module"; createRequire(import.meta.url)(variable);', "Computed module loader"],
    ['import { createRequire } from "node:module"; const load = createRequire(import.meta.url); load(variable);', "Computed module loader"],
    ['import { createRequire } from "node:module"; Reflect.apply(createRequire(import.meta.url), null, [variable]);', "Unsupported loader escape"],
    ['import * as mod from "node:module"; const { "createRequire": make } = mod; const load = make(import.meta.url); load("../challengeContract/codec");', "Unsupported loader destructuring"],
    ['import nodeModule from "node:module";\nconst load = nodeModule.createRequire(import.meta.url);\nload(variable);', "Computed module loader"],
    ['import * as nodeModule from "node:module";\nconst alias = nodeModule;\nalias.createRequire(import.meta.url)(variable);', "Computed module loader"],
    ['require("./helper.txt");', "Unaudited executable extension"],
    ['import nodeModule from "node:module";\n(nodeModule.createRequire)(import.meta.url)("./helper.txt");', "Unaudited executable extension"],
    ['import nodeModule from "node:module";\nconst key = "createRequire";\nnodeModule[key](import.meta.url)("./helper.txt");', "Unaudited executable extension"],
    ['import("node:module");', "Unsupported dynamic module import"],
  ])("rejects unauditable or excluded module edge %s", (code, message) => {
    const root = fixture();
    put(root, `${CORE}/src/__tests__/hidden.ts`, "export {};\n");
    put(root, `${CORE}/raw-code.ts`, "export {};\n");
    if (code.includes('"node:module"')) put(root, `${ARENA}/src/challenge/worker.ts`, code);
    else put(root, `${CORE}/src/index.ts`, code);
    expect(() => collectSourceInventory(root)).toThrow(message);
  });

  it("requires declared dependencies in the importer's pinned manifest", () => {
    const root = fixture();
    put(root, `${CORE}/src/index.ts`, 'import "tsx";');
    expect(() => collectSourceInventory(root)).toThrow("Undeclared external");
    const manifest: unknown = JSON.parse(readFileSync(join(root, `${CORE}/package.json`), "utf8"));
    put(root, `${CORE}/package.json`, JSON.stringify({ ...manifest as Record<string, unknown>, dependencies: { tsx: "4.19.5" } }));
    expect(collectSourceInventory(root).audit.edges.some((edge) => edge.specifier === "tsx")).toBe(true);
  });

  it("rejects ambiguous relative resolution and unsupported workspace export maps", () => {
    const root = fixture();
    put(root, `${CORE}/src/index.ts`, 'import "./seeds";');
    put(root, `${CORE}/src/seeds/index.ts`, "export {};\n");
    expect(() => collectSourceInventory(root)).toThrow("Missing or ambiguous import");
    rmSync(join(root, `${CORE}/src/seeds/index.ts`));
    put(root, `${CORE}/package.json`, JSON.stringify({ name: "@chess-coach/starchess-core", exports: { ".": { require: "./src/index.ts" } } }));
    expect(() => collectSourceInventory(root)).toThrow("Unsupported workspace export");
  });

  it.each([
    [`${ARENA}/src/challenge/worker.ts`, "../challengeContract/codec"],
    [`${ARENA}/src/challenge/worker.ts`, "../../../../scripts/challenge-contract-evidence"],
    [`${ARENA}/src/challengeContract/codec.ts`, "../../../../scripts/challenge-contract-evidence"],
  ])("rejects forbidden partition edges from %s", (path, target) => {
    const root = fixture();
    put(root, path, `import "${target}";\n`);
    expect(() => collectSourceInventory(root)).toThrow("Forbidden partition edge");
  });

  it("allows contracts to use execution and contracts, and diagnostics to use every partition", () => {
    const root = fixture();
    put(root, `${ARENA}/src/challengeContract/codec.ts`, 'import "../challenge/worker";\nimport "./other";');
    put(root, `${ARENA}/src/challengeContract/other.ts`, "export {};\n");
    put(root, "scripts/challenge-contract-evidence.ts", `import "../${ARENA}/src/challengeContract/codec";\nimport "../${ARENA}/src/challenge/worker";\nimport "../${ARENA}/hermetic/run.mjs";`);
    expect(collectSourceInventory(root).audit.passed).toBe(true);
  });

  it("requires every production entrypoint and inventory root", () => {
    const root = fixture();
    rmSync(join(root, "scripts/challenge-contract-evidence.ts"));
    expect(() => collectSourceInventory(root)).toThrow("Missing inventory entrypoint");
    rmSync(join(root, "scripts"), { recursive: true });
    expect(() => collectSourceInventory(root)).toThrow();
  });

  it("rejects an optional configuration directory rather than recording it as absent", () => {
    const root = fixture();
    mkdirSync(join(root, ".npmrc"));
    expect(() => collectSourceInventory(root)).toThrow("Non-file runtime configuration");
  });

  it("audits the exact locked hermetic closure loader and rejects changed computed loaders", () => {
    const root = fixture();
    const closure = "import {createRequire} from 'node:module';\nconst require = createRequire(import.meta.url);\nconst esbuild = require(require.resolve('esbuild', { paths: [require.resolve('tsx/package.json')] }));\n";
    put(root, `${ARENA}/hermetic/closure.mjs`, closure);
    expect(collectSourceInventory(root).audit.edges.some((edge) => edge.importer.endsWith("closure.mjs") && edge.specifier === "esbuild")).toBe(true);
    put(root, `${ARENA}/hermetic/closure.mjs`, closure.replace("require(require.resolve('esbuild', { paths: [require.resolve('tsx/package.json')] }))", "require(process.env.MODULE)"));
    expect(() => collectSourceInventory(root)).toThrow("Computed module loader");
  });

  it("keeps historical v1 literals and partition meanings distinct", () => {
    const historical: Pick<SourceInventoryV1, "version" | "policyVersion" | "files"> = {
      version: "challenge-source-inventory-v1", policyVersion: "challenge-source-policy-v1",
      files: [{ path: `${CORE}/src/index.ts`, sha256: "0".repeat(64), partition: "execution" }],
    };
    expect(historical.files[0]!.partition).toBe("execution");
    expect(collectSourceInventory(fixture()).version).not.toBe(historical.version);
  });

  it("audits the real repository graph with declared root tooling in an isolated fixture", () => {
    const root = fixture();
    for (const path of [`${CORE}/src`, `${ARENA}/src`, `${TRAINING}/src`, "scripts", `${ARENA}/hermetic`]) cpSync(join(repository, path), join(root, path), { recursive: true });
    for (const owner of [CORE, ARENA, TRAINING]) put(root, `${owner}/package.json`, readFileSync(join(repository, owner, "package.json"), "utf8"));
    const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    put(root, "package.json", JSON.stringify({ ...manifest, devDependencies: { ...manifest.devDependencies, typescript: "~5.9.3" } }));
    const inventory = collectSourceInventory(root);
    expect(inventory.audit.passed).toBe(true);
    expect(inventory.audit.edges).toContainEqual(expect.objectContaining({ importer: `${ARENA}/hermetic/public-closure.mjs`, specifier: "typescript", targetKind: "external" }));
    expect(inventory.audit.edges).toContainEqual(expect.objectContaining({ importer: "scripts/check-public-closure.mjs", target: `${ARENA}/hermetic/public-closure.mjs`, targetKind: "source" }));
    expect(inventory.audit.edges).toContainEqual(expect.objectContaining({ importer: "scripts/r2-composition-evidence.ts", target: `${TRAINING}/src/candidates.ts`, targetKind: "source" }));
    expect(inventory.groups["verification-tooling"].some((file) => file.path === "scripts/check-public-closure.mjs")).toBe(true);
  }, 120000);

  it.each([
    ['import "@chess-coach/starchess-arena";', "Forbidden partition edge"],
    ['import "./coordinator/run";', "Forbidden partition edge"],
    ['import "node:crypto";', "Forbidden builtin edge"],
    ['import type {Stats} from "node:fs";', "Forbidden builtin edge"],
    ['import "../../starchess-core/src/seeds";', "Forbidden deep private edge"],
    ['import "@chess-coach/starchess-arena/src/challenge/baseline";', "Unsupported workspace export"],
    ['void process.env;', "Forbidden process access"],
  ])("rejects model host, builtin and private links: %s", (code, message) => {
    const root = fixture();
    put(root, `${TRAINING}/src/coordinator/run.ts`, "export {};\n");
    put(root, `${TRAINING}/src/candidates.ts`, code);
    expect(() => collectSourceInventory(root)).toThrow(message);
  });

  it("allows model public seams and coordinator host edges without widening pure partitions", () => {
    const root = fixture();
    put(root, `${TRAINING}/src/candidates.ts`, 'import "@chess-coach/starchess-core/planning-v1"; import "@chess-coach/starchess-arena/observations"; import "@chess-coach/starchess-arena/intent-codec-v1"; import "@chess-coach/starchess-arena/events"; import "jssha/sha256";');
    put(root, `${TRAINING}/src/coordinator/run.ts`, 'import "@chess-coach/starchess-arena"; import "node:fs"; import "../candidates";');
    const inventory = collectSourceInventory(root);
    expect(inventory.groups["training-model"].map((file) => file.path)).toEqual([`${TRAINING}/src/candidates.ts`]);
    expect(inventory.entrypoints).toEqual(expect.arrayContaining([`${TRAINING}/src/candidates.ts`, `${ARENA}/src/observations.ts`, `${ARENA}/src/intent-codec-v1.ts`, `${ARENA}/src/events.ts`]));
    expect(inventory.audit.edges).toContainEqual(expect.objectContaining({ importer: `${TRAINING}/src/candidates.ts`, specifier: "jssha/sha256", targetKind: "external" }));
  });

  it.each([
    [`${CORE}/src/index.ts`, "./seeds"],
    [`${ARENA}/src/observations.ts`, "./intent-codec-v1"],
    [`${TRAINING}/src/candidates.ts`, "./domain"],
  ])("rejects literal dynamic loading from a pure partition: %s", (path, target) => {
    const root = fixture();
    put(root, `${TRAINING}/src/domain.ts`, "export {};\n");
    put(root, path!, `import(${JSON.stringify(target)});`);
    expect(() => collectSourceInventory(root)).toThrow("Forbidden dynamic import edge");
  });

  it("allows only the reviewed descriptor-safe DTO function and retains the indexed array seam", () => {
    const root = fixture();
    const path = `${ARENA}/src/challengeContract/validation.ts`;
    put(root, path, readFileSync(join(repository, path), "utf8"));
    expect(collectSourceInventory(root).audit.auditedFiles).toContain(path);
    put(root, path, `${readFileSync(join(repository, path), "utf8")}\nObject.getPrototypeOf(() => {});`);
    expect(() => collectSourceInventory(root)).toThrow("Unsupported code constructor acquisition");
  });

  it.each([
    ['typeof input === "function" || typeof input === "symbol"', 'typeof input === "symbol"'],
    ['Object.getPrototypeOf(input)', 'Object.getPrototypeOf(() => {})'],
    ['Object.getOwnPropertyDescriptors(input)', 'Object.getOwnPropertyDescriptors(Object)'],
    ['visit(descriptor.value,', 'visit(descriptor.value.constructor,'],
    ['depth > 16 || ++state.visits > 8192', 'depth > 26 || ++state.visits > 81920'],
    ['if (state.ancestors.has(input)) fail(at);', 'if (false) fail(at);'],
    ['if (state.textbytes > MAX_CODEC_BYTES) fail(at, "SIZE");', 'if (false) fail(at, "SIZE");'],
    ['throw new ContractError(path, code);', 'return value as never;'],
  ])("rejects changes to the descriptor seam: %s", (before, after) => {
    const root = fixture();
    const path = `${ARENA}/src/challengeContract/validation.ts`;
    const original = readFileSync(join(repository, path), "utf8");
    expect(original).toContain(before);
    put(root, path, original.replace(before, after));
    expect(() => collectSourceInventory(root)).toThrow("Unsupported code constructor acquisition");
  });
});

describe("static browser public closure", () => {
  const check = async (root: string) => {
    const script = pathToFileURL(join(repository, "scripts/check-public-closure.mjs")).href;
    const { checkPublicClosure } = await import(/* @vite-ignore */ script);
    return checkPublicClosure(root);
  };
  it.each(deferredMutations)("tracks public parameter effects: $name", async ({effect}) => {
    const root = fixture();
    put(root, `${CORE}/src/planning-v1.ts`, deferredMutationProbe(effect));
    await expect(check(root)).rejects.toThrow(/Code constructor acquisition in public closure|Unsupported parameter mutation/);
  });
  it.each([
    [CORE, ARENA, "@chess-coach/starchess-arena/observations", `${CORE}/src/planning-v1.ts`],
    [CORE, TRAINING, "@chess-coach/starchess-training/candidates", `${CORE}/src/planning-v1.ts`],
    [ARENA, TRAINING, "@chess-coach/starchess-training/candidates", `${ARENA}/src/observations.ts`],
  ])("rejects declared reverse workspace edges from %s to %s", async (owner, targetOwner, specifier, entry) => {
    for (const code of [`import "${specifier}";`, `export type {Value} from "${specifier}";`, `type Value=import("${specifier}").Value;`]) {
      const root = fixture();
      const path = `${owner}/package.json`;
      const manifest = JSON.parse(readFileSync(join(root, path), "utf8"));
      const target = JSON.parse(readFileSync(join(root, `${targetOwner}/package.json`), "utf8"));
      manifest.dependencies = { ...manifest.dependencies, [target.name]: "workspace:*" };
      put(root, path, JSON.stringify(manifest));
      put(root, entry!, code);
      await expect(check(root)).rejects.toThrow("Forbidden public workspace direction");
    }
  });
  it.each(["import", "export-type", "import-type"])("rejects a workspace cycle through a reverse %s edge", async (kind) => {
    const root = fixture();
    const path = `${ARENA}/package.json`;
    const manifest = JSON.parse(readFileSync(join(root, path), "utf8"));
    manifest.dependencies["@chess-coach/starchess-training"] = "workspace:*";
    put(root, path, JSON.stringify(manifest));
    put(root, `${TRAINING}/src/candidates.ts`, 'import "@chess-coach/starchess-arena/observations";');
    const specifier = "@chess-coach/starchess-training/candidates";
    put(root, `${ARENA}/src/observations.ts`, kind === "import" ? `import "${specifier}";` : kind === "export-type" ? `export type {Value} from "${specifier}";` : `type Value=import("${specifier}").Value;`);
    await expect(check(root)).rejects.toThrow("Forbidden public workspace direction");
  });
  it.each(wrappedMutations)("invalidates public caller field shapes through a local invocation wrapper: %s", async (invocation) => {
    const root = fixture();
    put(root, `${CORE}/src/planning-v1.ts`, mutationProbe(invocation));
    await expect(check(root)).rejects.toThrow(/Code constructor acquisition in public closure|Unsupported parameter mutation/);
  });
  it.each(importedReceivers)("resolves public imported callable and constructor receiver signatures: %s", async (code) => {
    await expect(check(importedFixture(code))).rejects.toThrow("Code constructor acquisition in public closure");
  });
  it("resolves public imported ordinary numeric data without classifying it as callable", async () => {
    const root = importedFixture('import {numbers} from "@chess-coach/starchess-core/planning-v1"; for(let i=0;i<numbers.length;i++) consume(numbers[i]);');
    expect((await check(root)).passed).toBe(true);
  });
  const shaFixture = (root: string, code = "export default class SHA {};"): string => {
    const base = `${TRAINING}/node_modules/jssha`;
    put(root, `${base}/package.json`, JSON.stringify({ name: "jssha", version: "3.3.2", exports: { "./sha256": { import: "./dist/sha256.mjs", require: "./dist/sha256.js" } } }));
    put(root, `${base}/dist/sha256.mjs`, code);
    put(root, `${TRAINING}/src/candidates.ts`, 'import "jssha/sha256";');
    return base;
  };
  it.each([".js", ".mjs"])("proves public hoisted JavaScript counter writes and rejects a string rewrite in %s", async (extension) => {
    const root = fixture();
    const path = `${CORE}/src/numeric-read${extension}`;
    put(root, `${CORE}/src/planning-v1.ts`, `export * from "./numeric-read${extension}";`);
    put(root, path, minifiedNumericRead);
    expect((await check(root)).passed).toBe(true);
    put(root, path, minifiedNumericRead.replace("consume(words[index])", 'index=["con","structor"].join("");consume(words[index])'));
    await expect(check(root)).rejects.toThrow("Code constructor acquisition in public closure");
  });
  it("audits the real five-root public graph and standalone SHA runtime", async () => {
    const report = await check(repository);
    expect(report.version).toBe("public-closure-v2");
    expect(report.passed).toBe(true);
    expect(report.entries).toHaveLength(5);
    expect(report.entries[0].subpath).toBe("./planning-v1");
    expect(report.verifiedPaths).not.toContain(`${CORE}/src/index.ts`);
    expect(report.dependencyFiles.map((file: {path: string}) => file.path)).toEqual(["jssha@3.3.2/dist/sha256.mjs", "jssha@3.3.2/package.json"]);
    expect(report.edges.some((edge: {importer: string}) => edge.importer.startsWith("jssha@"))).toBe(false);
  }, 120000);
  it.each(["jssha", "jssha/sha1", "jssha/dist/sha256.mjs"])("rejects an unreviewed SHA export %s", async (specifier) => {
    const root = fixture();
    shaFixture(root);
    put(root, `${TRAINING}/src/candidates.ts`, `import "${specifier}";`);
    await expect(check(root)).rejects.toThrow("Unreviewed SHA export");
  });
  it("rejects the indexed descriptor call outside the reviewed public array declaration", async () => {
    const root = fixture();
    put(root, `${ARENA}/src/challengeContract/validation.ts`, 'export function acquire(value: unknown, index: number) {return Object.getOwnPropertyDescriptor(value, String(index));}');
    put(root, `${ARENA}/src/observations.ts`, 'export {acquire} from "./challengeContract/validation";');
    await expect(check(root)).rejects.toThrow("Code constructor acquisition in public closure");
  });
  it.each([
    'import "./helper.mjs"; export default class SHA {};',
    'export {default} from "./helper.mjs";',
    'const compile = (()=>{}).constructor; export default compile;',
    'const compile = Reflect.get; export default compile;',
    'const key = ["con", "structor"].join(""); const receiver = unknownFactory(); receiver[key]("return process")();',
    'const timer = setTimeout; export default timer;',
    'export default window.Function;',
    'export default process;',
  ])("audits every external SHA runtime site without bypasses: %s", async (code) => {
    const root = fixture();
    const base = shaFixture(root, code);
    put(root, `${base}/dist/helper.mjs`, "export default 0;");
    await expect(check(root)).rejects.toThrow(/Runtime import in SHA dependency|Code constructor acquisition in public closure|Host timer evaluation in public closure|Host acquisition in public closure|Host global in public closure/);
  });
  it.each(["^3.3.2", "~3.3.2", "3.3.1", "latest"])("requires an exact declared SHA pin instead of %s", async (pin) => {
    const root = fixture();
    shaFixture(root);
    const path = `${TRAINING}/package.json`;
    const manifest = JSON.parse(readFileSync(join(root, path), "utf8"));
    manifest.dependencies.jssha = pin;
    put(root, path, JSON.stringify(manifest));
    await expect(check(root)).rejects.toThrow("SHA dependency must declare exact 3.3.2");
  });
  it("rejects a mismatched installed SHA version and alternative runtime target", async () => {
    const root = fixture();
    const base = shaFixture(root);
    const path = `${base}/package.json`;
    const manifest = JSON.parse(readFileSync(join(root, path), "utf8"));
    manifest.version = "3.3.1";
    put(root, path, JSON.stringify(manifest));
    await expect(check(root)).rejects.toThrow("Unexpected dependency package");
    manifest.version = "3.3.2";
    manifest.exports["./sha256"].import = "./dist/sha256.js";
    put(root, path, JSON.stringify(manifest));
    await expect(check(root)).rejects.toThrow("Unreviewed SHA target");
  });
  it("permits ordinary external data intrinsics and numeric loop indexing", async () => {
    const root = fixture();
    shaFixture(root, 'const data = new Uint32Array(4); const words = []; let index; for (index = 0; index < data.length; index += 1) {words[index] = data[index];} export default words;');
    expect((await check(root)).dependencyFiles).toHaveLength(2);
  });
  it.each([`${TRAINING}/src/candidates.ts`, `${ARENA}/src/observations.ts`])("rejects runtime and erased core root edges from %s", async (path) => {
    const root = fixture();
    for (const code of [
      'import "@chess-coach/starchess-core";',
      'import type {Hidden} from "@chess-coach/starchess-core";',
      'export * from "@chess-coach/starchess-core";',
      'export type {Hidden} from "@chess-coach/starchess-core";',
      'type Hidden = import("@chess-coach/starchess-core").Hidden;',
    ]) {
      put(root, path, code);
      await expect(check(root)).rejects.toThrow("Native core in public closure");
    }
  });
  it.each(["index", "scfen/native", "replay/native", "commands/native", "resolve/native"])("rejects planning reconnection to native core %s", async (target) => {
    const root = fixture();
    put(root, `${CORE}/src/${target}.ts`, "export type Hidden = number;");
    for (const code of [`export * from "./${target}";`, `export type {Hidden} from "./${target}";`, `type Hidden = import("./${target}").Hidden;`]) {
      put(root, `${CORE}/src/planning-v1.ts`, code);
      await expect(check(root)).rejects.toThrow("Native core in public closure");
    }
  });
  it.each([
    [`${ARENA}/src/authorized/v1/observationCodec.ts`, "board/mines"],
    [`${ARENA}/src/challengeContract/candidateWire.ts`, "rules/constants"],
  ])("rejects formerly reviewed deep core links from %s", async (path, target) => {
    const root = fixture();
    put(root, `${CORE}/src/${target}.ts`, "export {};");
    put(root, path!, `import "${path!.includes("/authorized/") ? "../../../.." : "../../.."}/starchess-core/src/${target}";`);
    put(root, `${ARENA}/src/observations.ts`, `import "./${path!.slice(`${ARENA}/src/`.length)}";`);
    await expect(check(root)).rejects.toThrow("Deep private cross-package import");
  });
  it.each(["fflate", "@noble/hashes/sha2.js"])("rejects unreviewed public external %s", async (specifier) => {
    const root = fixture();
    const path = `${TRAINING}/package.json`;
    const manifest = JSON.parse(readFileSync(join(root, path), "utf8"));
    manifest.dependencies[specifier.startsWith("@noble/") ? "@noble/hashes" : specifier] = "1.0.0";
    put(root, path, JSON.stringify(manifest));
    put(root, `${TRAINING}/src/candidates.ts`, `import "${specifier}";`);
    await expect(check(root)).rejects.toThrow("Unreviewed public dependency");
  });

  it("preserves public host-global rejection after data-type inference", async () => {
    const root = fixture();
    put(root, `${CORE}/src/planning-v1.ts`, 'function access(array: any, index: number) {void array[index];} Function("return process")();');
    await expect(check(root)).rejects.toThrow("Host global in public closure");
  });

  it.each(unprovenComputedReceivers)("rejects public unproven call-derived or mutated receivers: %s", async (code) => {
    const root = fixture();
    put(root, `${CORE}/src/planning-v1.ts`, code);
    await expect(check(root)).rejects.toThrow(/Code constructor acquisition in public closure|Host acquisition in public closure|Host timer evaluation in public closure|Host global in public closure/);
  });
  it.each(ordinaryComputedData)("allows ordinary public call-derived and mutated data indexing: %s", async (code) => {
    const root = fixture();
    put(root, `${CORE}/src/planning-v1.ts`, code);
    expect((await check(root)).passed).toBe(true);
  });

  it.each(arrayMemberConstructors)("rejects public numeric array function constructor acquisition: %s", async (code) => {
    const root = fixture();
    put(root, `${CORE}/src/planning-v1.ts`, code);
    await expect(check(root)).rejects.toThrow("Code constructor acquisition in public closure");
  });
  it.each(dataArrayAccesses)("allows ordinary public data array indexing: %s", async (code) => {
    const root = fixture();
    put(root, `${CORE}/src/planning-v1.ts`, code);
    expect((await check(root)).passed).toBe(true);
  });

  it.each(ownMemberConstructors)("rejects computed constructors on own public function members: %s", async (code) => {
    const root = fixture();
    put(root, `${CORE}/src/planning-v1.ts`, code);
    await expect(check(root)).rejects.toThrow("Code constructor acquisition in public closure");
  });
  it("allows computed public data indexing and the reviewed DTO descriptors", async () => {
    const root = fixture();
    put(root, `${CORE}/src/planning-v1.ts`, 'const box: any = {f: () => {}, data: {w: 1, b: 2}}; const alias = box.data; void alias[key];');
    const path = `${ARENA}/src/challengeContract/validation.ts`;
    put(root, path, readFileSync(join(repository, path), "utf8"));
    put(root, `${ARENA}/src/observations.ts`, 'export {inspectDto} from "./challengeContract/validation";');
    expect((await check(root)).verifiedPaths).toContain(path);
  });

  it.each([
    ['depth > 16 || ++state.visits > 8192', 'depth > 26 || ++state.visits > 81920'],
    ['throw new ContractError(path, code);', 'return value as never;'],
  ])("rejects a changed public DTO seam: %s", async (before, after) => {
    const root = fixture();
    const path = `${ARENA}/src/challengeContract/validation.ts`;
    const original = readFileSync(join(repository, path), "utf8");
    expect(original).toContain(before);
    put(root, path, original.replace(before, after));
    put(root, `${ARENA}/src/observations.ts`, 'export {inspectDto} from "./challengeContract/validation";');
    await expect(check(root)).rejects.toThrow("Code constructor acquisition in public closure");
  });

  it("traverses actual conditional exports and pins source and manifest bytes", async () => {
    const root = fixture();
    put(root, `${TRAINING}/src/candidates.ts`, 'import "@chess-coach/starchess-arena/observations";');
    put(root, `${ARENA}/src/observations.ts`, 'export * from "./authorized/v1/types";');
    put(root, `${ARENA}/src/authorized/v1/types.ts`, "export type Observation = number;");
    const first = await check(root);
    expect(first.passed).toBe(true);
    expect(first.version).toBe("public-closure-v2");
    expect(first.entries).toHaveLength(5);
    expect(first.verifiedPaths).toContain(`${ARENA}/src/authorized/v1/types.ts`);
    expect(await check(root)).toEqual(first);
    put(root, `${ARENA}/src/authorized/v1/types.ts`, "export type Observation = string;");
    expect((await check(root)).sourceSha256).not.toBe(first.sourceSha256);
    put(root, `${CORE}/package.json`, JSON.stringify({ name: "@chess-coach/starchess-core", exports: { ".": {
      node: "./src/index.ts", browser: { import: "./src/index.ts" }, default: "./src/index.ts",
    }, "./planning-v1": { types: "./src/planning-v1.ts", node: "./src/planning-v1.ts", browser: { import: "./src/planning-v1.ts" }, default: "./src/planning-v1.ts" } } }));
    expect((await check(root)).entries[0]).toEqual({ package: "@chess-coach/starchess-core", subpath: "./planning-v1", path: `${CORE}/src/planning-v1.ts` });
  });

  it.each([
    [CORE, ".", "./src/index.ts"],
    [CORE, "./planning-v1", "./src/planning-v1.ts"],
    [ARENA, ".", "./src/index.ts"],
    [ARENA, "./observations", "./src/observations.ts"],
    [ARENA, "./events", "./src/events.ts"],
    [ARENA, "./intent-codec-v1", "./src/intent-codec-v1.ts"],
    [TRAINING, "./candidates", "./src/candidates.ts"],
  ])("rejects node and default alternatives for every canonical workspace export: %s %s", async (owner, subpath, target) => {
    const root = fixture();
    const path = `${owner}/package.json`;
    const manifest = JSON.parse(readFileSync(join(root, path), "utf8"));
    put(root, `${owner}/outside.mjs`, 'import "node:fs";');
    put(root, `${owner}/src/host.ts`, 'import "node:fs";');
    for (const condition of ["node", "default", "types"]) {
      for (const alternative of ["./outside.mjs", "./src/host.ts"]) {
        manifest.exports[subpath!] = { browser: { import: target }, [condition]: alternative };
        put(root, path, JSON.stringify(manifest));
        await expect(check(root)).rejects.toThrow(`Unapproved public export map: ${owner}`);
      }
    }
  });

  it.each([
    "./src/*.ts", "./src/../outside.mjs", "../outside.mjs", "/outside.mjs", "./src\\index.ts", "./src//index.ts",
    null, ["./src/index.ts"], {}, { browser: "./src/index.ts", node: { default: "./outside.mjs" } },
  ])("rejects wildcard, unsafe and unsupported workspace targets in unselected branches: %j", async (target) => {
    const root = fixture();
    put(root, `${CORE}/package.json`, JSON.stringify({ name: "@chess-coach/starchess-core", exports: {
      ".": "./src/index.ts", "./planning-v1": { browser: "./src/planning-v1.ts", default: target },
    } }));
    await expect(check(root)).rejects.toThrow(`Unapproved public export map: ${CORE}`);
  });

  it.each([
    ['import "@chess-coach/starchess-arena";', /Host\/baseline/],
    ['import "@chess-coach/starchess-arena/src/challenge/baseline";', /Unexported private/],
    ['import "../../starchess-core/src/seeds";', /Deep private/],
    ['import "node:fs";', /Node builtin/],
    ['import "node:crypto";', /Node builtin/],
    ['void process.getBuiltinModule("crypto").randomBytes(4);', /Host global|Host acquisition/],
    ['import(variable);', /Dynamic import/],
    ['import("./composition");', /Dynamic import/],
    ['export type { Hidden } from "./coordinator/run";', /Coordinator/],
  ])("rejects an actual public graph edge without tree-shaking: %s", async (code, message) => {
    const root = fixture();
    put(root, `${TRAINING}/src/composition.ts`, "export {};\n");
    put(root, `${TRAINING}/src/coordinator/run.ts`, "export type Hidden = string;");
    put(root, `${TRAINING}/src/candidates.ts`, code);
    await expect(check(root)).rejects.toThrow(message);
  });

  it.each([
    [TRAINING, "."],
    [TRAINING, "./composition"],
    [TRAINING, "./*"],
    [ARENA, "./challenge"],
    [CORE, "./private"],
  ])("rejects an unapproved export even when public entries do not import it: %s %s", async (owner, subpath) => {
    const root = fixture();
    const path = `${owner}/package.json`;
    const manifest = JSON.parse(readFileSync(join(root, path), "utf8"));
    manifest.exports[subpath!] = "./src/index.ts";
    put(root, path, JSON.stringify(manifest));
    await expect(check(root)).rejects.toThrow(`Unapproved public export map: ${owner}`);
  });

  it("pins the exact standalone SHA-256 ESM runtime without constructor exceptions", async () => {
    const root = fixture();
    put(root, `${CORE}/src/index.ts`, 'import "fflate";');
    put(root, `${TRAINING}/src/candidates.ts`, 'import "jssha/sha256";');
    for (const [owner, name] of [[TRAINING, "jssha"]]) {
      const source = join(repository, owner!, "node_modules", name!);
      const target = join(root, owner!, "node_modules", name!);
      mkdirSync(dirname(target), { recursive: true });
      symlinkSync(source, target);
    }
    const report = await check(root);
    expect(report.dependencyFiles.map((file: {path: string}) => file.path)).toEqual([
      "jssha@3.3.2/dist/sha256.mjs", "jssha@3.3.2/package.json",
    ]);
    expect(report.dependencyFiles.every((file: {sha256: string}) => /^[0-9a-f]{64}$/.test(file.sha256))).toBe(true);
    expect(report.edges.some((edge: {specifier: string}) => edge.specifier.startsWith("node:"))).toBe(false);
    expect(report.edges.some((edge: {importer: string}) => edge.importer.startsWith("jssha@"))).toBe(false);
    expect(report.verifiedPaths).not.toContain(`${CORE}/src/index.ts`);
  });
});
