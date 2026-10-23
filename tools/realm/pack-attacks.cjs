// Packs generated transparent artwork into anchored, uniformly padded animation cells.
// node tools/realm/pack-attacks.cjs <generated image folder> [preview folder]
// Image creation/background extraction is done by image_gen; this step only slices, scales and stitches.
const fs = require('node:fs'), path = require('node:path');
let sharp;
try { sharp = require('sharp'); } catch (_) { sharp = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp')); }
const source = process.argv[2], preview = process.argv[3];
if (!source) throw Error('Pass the folder containing the generated PNG sources.');
const root = path.resolve(__dirname, '../..'), out = path.join(root, 'img/realm/army/attacks-v1');
const specs = {
  "footman": {
    "source": "exec-4eaa6477-4bf9-4378-a229-b0d64156ec14.png",
    "bodyHeight": 365,
    "bodyFraction": 0.56,
    "ax": 0.4,
    "ay": 0.94,
    "boxes": [
      [
        82,
        30,
        402,
        477
      ],
      [
        593,
        37,
        914,
        475
      ],
      [
        1049,
        114,
        1511,
        478
      ],
      [
        55,
        585,
        613,
        959
      ],
      [
        614,
        597,
        1001,
        959
      ],
      [
        1103,
        587,
        1452,
        959
      ]
    ],
    "anchors": [
      [
        256,
        475
      ],
      [
        768,
        473
      ],
      [
        1240,
        476
      ],
      [
        256,
        957
      ],
      [
        800,
        957
      ],
      [
        1300,
        957
      ]
    ]
  },
  "knight": {
    "source": "exec-2d2a7f72-e49c-416c-b4ff-dc34ae43d016.png",
    "bodyHeight": 370,
    "bodyFraction": 0.56,
    "ax": 0.4,
    "ay": 0.94,
    "boxes": [
      [
        82,
        106,
        424,
        499
      ],
      [
        550,
        40,
        907,
        499
      ],
      [
        1012,
        126,
        1503,
        500
      ],
      [
        56,
        584,
        604,
        953
      ],
      [
        590,
        582,
        1016,
        953
      ],
      [
        1072,
        582,
        1469,
        955
      ]
    ],
    "anchors": [
      [
        275,
        497
      ],
      [
        770,
        497
      ],
      [
        1265,
        498
      ],
      [
        270,
        951
      ],
      [
        785,
        951
      ],
      [
        1300,
        953
      ]
    ]
  },
  "archer": {
    "source": "exec-ea97ed0d-8517-45fd-af8d-86a677a4edf9.png",
    "bodyHeight": 402,
    "bodyFraction": 0.56,
    "ax": 0.4,
    "ay": 0.94,
    "boxes": [
      [
        130,
        78,
        430,
        484
      ],
      [
        618,
        29,
        957,
        484
      ],
      [
        1136,
        28,
        1473,
        485
      ],
      [
        87,
        518,
        581,
        973
      ],
      [
        637,
        556,
        962,
        972
      ],
      [
        1157,
        556,
        1476,
        972
      ]
    ],
    "anchors": [
      [
        245,
        482
      ],
      [
        757,
        482
      ],
      [
        1275,
        483
      ],
      [
        230,
        971
      ],
      [
        765,
        970
      ],
      [
        1280,
        970
      ]
    ]
  },
  "dragon": {
    "source": "exec-2ac8304c-9e0a-4183-8682-bc51f40f4307.png",
    "bodyHeight": 426,
    "bodyFraction": 0.72,
    "ax": 0.45,
    "ay": 0.5,
    "boxes": [
      [
        46,
        42,
        474,
        485
      ],
      [
        561,
        40,
        1002,
        483
      ],
      [
        1082,
        44,
        1536,
        485
      ],
      [
        47,
        546,
        475,
        990
      ],
      [
        556,
        547,
        1075,
        991
      ],
      [
        1082,
        548,
        1502,
        990
      ]
    ],
    "anchors": [
      [
        260,
        270
      ],
      [
        775,
        268
      ],
      [
        1293,
        270
      ],
      [
        260,
        774
      ],
      [
        775,
        776
      ],
      [
        1293,
        776
      ]
    ]
  }
};
const cell = 384, sheets = {};
async function packTroop(kind, spec) {
  if (kind === 'dragon') { [spec.boxes[3], spec.boxes[4]] = [spec.boxes[4], spec.boxes[3]]; [spec.anchors[3], spec.anchors[4]] = [spec.anchors[4], spec.anchors[3]]; }
  const layers = [];
  for (let i = 0; i < 6; i++) {
    const [x0,y0,x1,y1] = spec.boxes[i], [ax,ay] = spec.anchors[i], scale = spec.bodyFraction * cell / spec.bodyHeight;
    const width = Math.round((x1-x0)*scale), height = Math.round((y1-y0)*scale);
    const left = Math.round(spec.ax*cell+(x0-ax)*scale), top = Math.round(spec.ay*cell+(y0-ay)*scale);
    if (left<0 || top<0 || left+width>cell || top+height>cell) throw Error(kind+' frame '+i+' exceeds cell bounds');
    const input = await sharp(path.join(source,spec.source)).extract({left:x0,top:y0,width:x1-x0,height:y1-y0}).resize(width,height).png().toBuffer();
    layers.push({input,left:(i%3)*cell+left,top:Math.floor(i/3)*cell+top});
  }
  await sharp({create:{width:cell*3,height:cell*2,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(layers).webp({quality:88,alphaQuality:100,effort:6}).toFile(path.join(out,kind+'.webp'));
  sheets[kind]={file:kind+'.webp',cols:3,rows:2,frames:6,right:true,ax:spec.ax,ay:spec.ay,bodyFraction:spec.bodyFraction,cellAspect:1,width:cell*3,height:cell*2,releaseFrame:kind==='archer'?3:2};
}
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  for(const [kind,spec] of Object.entries(specs)) await packTroop(kind,spec);
  const fxPath=path.join(source,'exec-0a578154-07c1-4e4d-98dc-f30dd4b938da.png'), meta=await sharp(fxPath).metadata(), layers=[];
  for(let y=0;y<4;y++)for(let x=0;x<4;x++){
    const left=Math.round(x*meta.width/4), top=Math.round(y*meta.height/4), right=Math.round((x+1)*meta.width/4), bottom=Math.round((y+1)*meta.height/4);
    const input=await sharp(fxPath).extract({left,top,width:right-left,height:bottom-top}).resize(224,224).png().toBuffer();
    layers.push({input,left:x*256+16,top:y*256+16});
  }
  await sharp({create:{width:1024,height:1024,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(layers).webp({quality:90,alphaQuality:100,effort:6}).toFile(path.join(out,'effects.webp'));
  sheets.effects={file:'effects.webp',cols:4,rows:4,frames:4,width:1024,height:1024,rowsByKind:{sword:0,arrow:1,dragon:2,fireball:3}};
  fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({version:1,layout:'Frames run left to right, then top to bottom. Anchors are normalized from top left.',sheets},null,2)+'\n');
  if(preview){
    fs.mkdirSync(preview,{recursive:true});
    for(const kind of Object.keys(sheets)) await sharp(path.join(out,kind+'.webp')).flatten({background:'#263c37'}).png().toFile(path.join(preview,kind+'-sheet.png'));
  }
  console.log(JSON.stringify(sheets,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
