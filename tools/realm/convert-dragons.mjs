/** Rebuild browser dragons from the user's read-only Four Evil Dragons Pack PBR.
 * Node 18+, official three@0.160.0 package, sharp.
 * node tools/realm/convert-dragons.mjs --source "D:/Unity/My project/Assets/FourEvilDragonsPBR" --three "../western-convert/package" --sharp "C:/path/to/node_modules/sharp"
 * The exporter repairs duplicate source bone names by their parent hierarchy,
 * preserves four material variants/species, and strips horizontal locomotion.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const args=Object.fromEntries(process.argv.slice(2).reduce((a,x,i,all)=>x.startsWith('--')?[...a,[x.slice(2),all[i+1]]]:a,[]));
if(!args.source||!args.three)throw Error('Required --source and --three; --sharp may point to the sharp package.');
const source=path.resolve(args.source),three=path.resolve(args.three),project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=path.join(project,'models/realm/dragons-v1'),cache=path.join(project,'output/dragon-convert');
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(cache,{recursive:true});fs.mkdirSync(path.join(out,'textures'),{recursive:true});
const sharp=createRequire(import.meta.url)(args.sharp||'sharp'),moduleAt=file=>import(pathToFileURL(path.join(three,file)).href);
const T=await moduleAt('build/three.module.js'),{GLTFExporter}=await moduleAt('examples/jsm/exporters/GLTFExporter.js'),{mergeVertices}=await moduleAt('examples/jsm/utils/BufferGeometryUtils.js');
if(T.REVISION!=='160')throw Error('Requires three@0.160.0.');
// Repair ambiguous Maya joint names before either skeleton or animation parsing.
// Stable hierarchy-derived names match across mesh FBXs and separate clip FBXs.
const uniqueNames=`
    const models=fbxTree.Objects.Model||{}, original=new Map(Object.entries(models).map(([id,n])=>[+id,n.attrName||'Node']));
    const counts=new Map(); for(const name of original.values())counts.set(name,(counts.get(name)||0)+1);
    const lineage=id=>{const n=models[id],p=connections.get(+id)?.parents.find(p=>models[p.ID]&&models[p.ID].attrType==='LimbNode');return (p?lineage(p.ID)+'__':'')+original.get(+id);};
    for(const [id,n] of Object.entries(models))if(counts.get(original.get(+id))>1){let h=2166136261;for(const c of lineage(+id)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}n.attrName=original.get(+id)+'__'+(h>>>0).toString(16);}
`;
let loaderSource=fs.readFileSync(path.join(three,'examples/jsm/loaders/FBXLoader.js'),'utf8');
loaderSource=loaderSource.replace("from 'three'",`from '${pathToFileURL(path.join(three,'build/three.module.js')).href}'`)
 .replace(/from '(\.\.[^']+)'/g,(_,p)=>`from '${pathToFileURL(path.resolve(three,'examples/jsm/loaders',p)).href}'`)
 .replace('connections = this.parseConnections();','connections = this.parseConnections();'+uniqueNames);
const loaderFile=path.join(cache,'FBXLoader-unique.mjs');fs.writeFileSync(loaderFile,loaderSource);
const {FBXLoader}=await import(pathToFileURL(loaderFile).href);
T.TextureLoader.prototype.load=function(){return new T.Texture()};globalThis.window={URL:globalThis.URL};
globalThis.FileReader=class{readAsArrayBuffer(b){b.arrayBuffer().then(v=>{this.result=v;this.onloadend?.()})}readAsDataURL(b){b.arrayBuffer().then(v=>{this.result=`data:${b.type};base64,${Buffer.from(v).toString('base64')}`;this.onloadend?.()})}};
const sha=file=>createHash('sha256').update(fs.readFileSync(path.join(source,file))).digest('hex');
function fbx(file){const b=fs.readFileSync(path.join(source,file));return new FBXLoader().parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),source+path.sep)}
const pad=(b,n=0)=>Buffer.concat([b,Buffer.alloc((4-b.length%4)%4,n)]);
function embedMaps(glb,maps){const b=Buffer.from(glb),jl=b.readUInt32LE(12),j=JSON.parse(b.toString('utf8',20,20+jl)),old=b.subarray(28+jl,28+jl+b.readUInt32LE(20+jl));let bin=pad(old);j.images=[];j.textures=[];j.samplers=[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}];
 for(const [type,{data,mimeType}]of Object.entries(maps)){const view=j.bufferViews.length,texture=j.textures.length;j.bufferViews.push({buffer:0,byteOffset:bin.length,byteLength:data.length});bin=Buffer.concat([bin,pad(data)]);j.images.push({name:type,mimeType,bufferView:view});j.textures.push({sampler:0,source:texture});for(const mat of j.materials){if(type==='albedo')mat.pbrMetallicRoughness.baseColorTexture={index:texture};if(type==='normal')mat.normalTexture={index:texture,scale:.7};if(type==='emission'){mat.emissiveTexture={index:texture};mat.emissiveFactor=[.6,.6,.6]}}}
 j.buffers[0].byteLength=bin.length;const text=pad(Buffer.from(JSON.stringify(j)),32),h=Buffer.alloc(20),bh=Buffer.alloc(8);h.writeUInt32LE(0x46546c67);h.writeUInt32LE(2,4);h.writeUInt32LE(28+text.length+bin.length,8);h.writeUInt32LE(text.length,12);h.writeUInt32LE(0x4e4f534a,16);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);return Buffer.concat([h,text,bh,bin]);}
const definitions={
 nightmare:{name:'Nightmare',model:'DragonTheNightmareMesh',animation:'DragonNightMare',texture:'DragonNightmare',colors:{red:'Red',green:'Green',blue:'Blue',albino:'Albino'},root:'Root',mouth:'UpperHead02',clips:{idle:'idle01',walk:'walk',run:'run',attack:'Basic Attack',hit:'getHit',death:'die',roar:'scream'}},
 'soul-eater':{name:'Soul Eater',model:'DragonSoulEaterMesh',animation:'DragonSoulEater',texture:'DragonSoulEater',colors:{red:'Red',blue:'Blue',green:'green',purple:'purple'},root:'Root_Pelvis',mouth:'UpperMouth',clips:{idle:'Idle',walk:'Walk',run:'Run',attack:'Fireball Shoot',hit:'Get Hit',death:'Die',fly:'Fly Forward','fly-idle':'Fly Float','fly-attack':'Fly Fireball Shoot',takeoff:'Take Off',land:'Land',roar:'Scream'}},
 'terror-bringer':{name:'Terror Bringer',model:'DragonTerrorBringerMesh',animation:'DragonTerrorBringer',texture:'DragonTerrorBringer',colors:{red:'Red',green:'Green',grey:'Grey',albino:'Albino'},root:'Root',mouth:'UpperHead2',clips:{idle:'idle01',walk:'walk',run:'Run',attack:'Flame Attack',hit:'GetHit',death:'die',fly:'FlyForward','fly-idle':'FlyIdle','fly-attack':'FlyAttack',takeoff:'TakeOff',land:'Landing',roar:'scream'}},
 usurper:{name:'Usurper',model:'DragonUsurperMesh',animation:'DragonUsurper',texture:'DragonUsurper',colors:{red:'Red',blue:'Blue',black:'Dark',albino:'Albino'},root:'Root',mouth:'UpperMouth02',clips:{idle:'idle01',walk:'Walk',run:'Run',attack:'attackFlame',hit:'getHit',death:'Die',fly:'FlyForward','fly-idle':'FlyIdle','fly-attack':'FlyFlame',takeoff:'takeOff',land:'Land',roar:'Scream'}}
};
function reduceTrack(track){const n=track.times.length,size=track.getValueSize(),quaternion=track.ValueTypeName==='quaternion';if(n<3)return track;
 const keep=new Set([0,n-1]),v=track.values,t=track.times,qa=new T.Quaternion(),qb=new T.Quaternion(),qm=new T.Quaternion();
 function split(a,b){let worst=1,index=-1;for(let i=a+1;i<b;i++){const alpha=(t[i]-t[a])/(t[b]-t[a]);let error=0;if(quaternion){qa.fromArray(v,a*4);qb.fromArray(v,b*4);qm.slerpQuaternions(qa,qb,alpha);error=(1-Math.abs(qm.dot(qa.fromArray(v,i*4))))/1e-5;}else{for(let k=0;k<size;k++)error=Math.max(error,Math.abs(v[i*size+k]-(v[a*size+k]*(1-alpha)+v[b*size+k]*alpha))/.001);}if(error>worst){worst=error;index=i;}}if(index>=0){keep.add(index);split(a,index);split(index,b)}}split(0,n-1);
 const indices=[...keep].sort((a,b)=>a-b);track.times=new Float32Array(indices.map(i=>t[i]));track.values=new Float32Array(indices.flatMap(i=>Array.from(v.subarray(i*size,(i+1)*size))));return track;}
const manifest={version:1,generator:'convert-dragons.mjs / three@0.160.0',sourcePackage:'Four Evil Dragons Pack PBR',axes:{up:'+Y',forward:'+Z'},normalizedHeight:1,textureOrientation:'glTF: flipY=false; albedo/emission sRGB, normal linear',species:{}};
for(const [id,d]of Object.entries(definitions)){
 const mapsByColor={},textureSources={};let embedded;
 for(const [color,folder]of Object.entries(d.colors)){
  const dir=`Texture/${d.texture}/${folder}`,names=fs.readdirSync(path.join(source,dir));
  const files={albedo:names.find(n=>/albedo/i.test(n)&&/\.png$/i.test(n)),normal:names.find(n=>/normal/i.test(n)&&/\.png$/i.test(n)),emission:names.find(n=>/emission/i.test(n)&&/\.png$/i.test(n))};
  const external={},records={},embed={};
  for(const [type,name]of Object.entries(files))if(name){const file=`${dir}/${name}`,size=type==='albedo'?1024:type==='normal'?512:256,stem=`${id}-${color}${type==='albedo'?'':'-'+type}`,relative=`textures/${stem}.webp`;
   const pipeline=sharp(path.join(source,file)).resize(size,size,{fit:'fill'}).flip().removeAlpha();
   await pipeline.clone().webp({quality:type==='normal'?94:86,effort:6}).toFile(path.join(out,relative));external[type]=relative;records[type]={source:file,sha256:sha(file),size,bytes:fs.statSync(path.join(out,relative)).size};
   if(color==='red')embed[type]={data:await(type==='albedo'?pipeline.clone().jpeg({quality:86,chromaSubsampling:'4:4:4'}):pipeline.clone().png({compressionLevel:9})).toBuffer(),mimeType:type==='albedo'?'image/jpeg':'image/png'};
  }
  mapsByColor[color]=external;textureSources[color]=records;if(color==='red')embedded=embed;
 }
 const modelFile=`Mesh/${d.model}.fbx`,model=fbx(modelFile);model.name=id+'_rig';model.animations=[];
 let vertices=0,triangles=0,meshes=0,boneCount=0;const mat=new T.MeshStandardMaterial({name:d.name,color:0xffffff,roughness:.67,metalness:0});
 model.traverse(n=>{if(n.isMesh){n.material=mat;n.normalizeSkinWeights?.();n.geometry=mergeVertices(n.geometry,1e-5);vertices+=n.geometry.attributes.position.count;triangles+=(n.geometry.index?.count||n.geometry.attributes.position.count)/3;meshes++;boneCount=Math.max(boneCount,n.skeleton?.bones.length||0)}});
 const rest=new Map();model.traverse(n=>{if(rest.has(n.name)&&n.isBone)throw Error(`Duplicate final joint ${id}/${n.name}`);rest.set(n.name,{position:n.position.toArray(),quaternion:n.quaternion.toArray(),scale:n.scale.toArray()})});
 const clips=[],clipMetadata=[];
 for(const [name,fileBase]of Object.entries(d.clips)){
  const file=`Animations/${d.animation}/${fileBase}.fbx`,clip=fbx(file).animations[0]?.clone();if(!clip)throw Error(`Missing clip ${file}`);clip.name=name;
  const loops=['idle','walk','run','fly','fly-idle'].includes(name);
  clip.tracks=clip.tracks.filter(track=>{const dot=track.name.lastIndexOf('.'),joint=track.name.slice(0,dot),property=track.name.slice(dot+1),target=rest.get(joint);if(!target){console.warn(`Skipping unused joint ${id}/${name}: ${joint}`);return false}
   if(joint===d.root&&property==='position'&&(loops||name==='fly-attack')){const flight=name.startsWith('fly'),firstY=track.values[1];for(let i=0;i<track.values.length;i+=3){track.values[i]=target.position[0];track.values[i+2]=target.position[2];if(flight)track.values[i+1]+=target.position[1]-firstY;}}
   const size=track.getValueSize();return !Array.from(track.values).every((v,i)=>Math.abs(v-target[property][i%size])<(property==='quaternion'?1e-6:1e-4));
  }).map(reduceTrack);clip.optimize();clips.push(clip);clipMetadata.push({name,duration:clip.duration,loop:loops,tracks:clip.tracks.length,keys:clip.tracks.reduce((n,t)=>n+t.times.length,0),source:file,sha256:sha(file)});
 }
 const mixer=new T.AnimationMixer(model);mixer.clipAction(clips[0]).play();mixer.setTime(0);model.updateMatrixWorld(true);model.traverse(n=>{if(n.isSkinnedMesh)n.computeBoundingBox()});const bounds=new T.Box3().setFromObject(model),height=bounds.max.y-bounds.min.y;if(!(height>0&&Number.isFinite(height)))throw Error(`Invalid bounds ${id}`);
 mixer.stopAllAction();mixer.uncacheRoot(model);model.scale.multiplyScalar(1/height);model.position.y-=bounds.min.y/height;
 const root=new T.Scene();root.name=id;root.add(model);root.updateMatrixWorld(true);
 const dimensions={height:1,length:(bounds.max.z-bounds.min.z)/height,width:(bounds.max.x-bounds.min.x)/height};
 if(id!=='nightmare'){
  const flightBox=new T.Box3(),flightMixer=new T.AnimationMixer(root);
  for(const clip of clips.filter(c=>['fly','fly-idle','fly-attack'].includes(c.name))){flightMixer.stopAllAction();const action=flightMixer.clipAction(clip).play();action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;for(let i=0;i<=8;i++){flightMixer.setTime(clip.duration*i/8);root.updateMatrixWorld(true);root.traverse(n=>{if(n.isSkinnedMesh)n.computeBoundingBox()});flightBox.union(new T.Box3().setFromObject(root));}}
  flightMixer.stopAllAction();flightMixer.uncacheRoot(root);root.updateMatrixWorld(true);
  dimensions.flightWidth=flightBox.max.x-flightBox.min.x;dimensions.flightMinY=flightBox.min.y;dimensions.flightHeight=flightBox.max.y-flightBox.min.y;
 }
 root.userData={species:id,fly:id!=='nightmare',dimensions,mouthBone:d.mouth,mouthOffset:[0,0,0],forward:'+Z',rootMotion:'Ground locomotion and fly/fly-idle/fly-attack are in-place; flight baseline uses ground root height. Takeoff/land retain authored vertical motion.'};
 if(!root.getObjectByName(d.mouth))throw Error(`Mouth joint missing: ${id}/${d.mouth}`);
 const result=await new GLTFExporter().parseAsync(root,{binary:true,animations:clips,trs:true,onlyVisible:true}),glb=embedMaps(result,embedded);fs.writeFileSync(path.join(out,`${id}.glb`),glb);
 manifest.species[id]={name:d.name,file:`${id}.glb`,source:modelFile,sha256:sha(modelFile),bytes:glb.length,meshes,triangles,vertices,bones:boneCount,height:1,standingLength:(bounds.max.z-bounds.min.z)/height,standingWidth:(bounds.max.x-bounds.min.x)/height,dimensions,sourceHeight:height,sourceGround:bounds.min.y,forward:'+Z',mouthBone:d.mouth,mouthOffset:[0,0,0],flight:id!=='nightmare',defaultColor:'red',colors:mapsByColor,textureSources,thumbnails:Object.fromEntries(Object.keys(d.colors).map(color=>[color,`thumbs/${id}-${color}.webp`])),animations:clipMetadata};
 console.log(`${id}: ${glb.length} bytes, ${vertices} vertices / ${triangles} triangles / ${boneCount} bones; clips ${clips.map(c=>c.name).join(', ')}`);
}
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
