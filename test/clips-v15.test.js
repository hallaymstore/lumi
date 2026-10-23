const test=require('node:test');
const assert=require('node:assert/strict');
const {detectDuration,enforceVideoDuration,MAX_VIDEO_SECONDS}=require('../services/videoDuration');
const {rankClips,clipScore}=require('../services/clipRank');
function mp4(seconds,version=0){
 const ftyp=Buffer.alloc(20);ftyp.writeUInt32BE(20,0);ftyp.write('ftyp',4);ftyp.write('isom',8);
 const box=Buffer.alloc(version===1?44:32);box.writeUInt32BE(box.length,0);box.write('mvhd',4);box[8]=version;
 if(version===1){box.writeUInt32BE(1000,28);box.writeBigUInt64BE(BigInt(Math.round(seconds*1000)),32)}
 else{box.writeUInt32BE(1000,20);box.writeUInt32BE(Math.round(seconds*1000),24)}
 return Buffer.concat([ftyp,box]);
}
function webm(seconds){
 const head=Buffer.from([0x1a,0x45,0xdf,0xa3,0x80]);
 const info=Buffer.from([0x15,0x49,0xa9,0x66,0x92,0x2a,0xd7,0xb1,0x83,0x0f,0x42,0x40,0x44,0x89,0x88]);
 const dur=Buffer.alloc(8);dur.writeDoubleBE(seconds,0);
 return Buffer.concat([head,info,dur,Buffer.alloc(40)]);
}
test('30 second max enforced for MP4 version 0 and version 1',()=>{
 assert.equal(MAX_VIDEO_SECONDS,30);
 assert.equal(enforceVideoDuration(mp4(30),mp4(30),'video/mp4'),30);
 assert.equal(enforceVideoDuration(mp4(20,1),mp4(20,1),'video/mp4'),20);
 assert.throws(()=>enforceVideoDuration(mp4(30.1),mp4(30.1),'video/mp4'),/30 soniya/);
 assert.throws(()=>enforceVideoDuration(mp4(44),mp4(44),'video/mp4'),/30 soniya/);
});
test('WebM Duration and timecode scale are converted to seconds',()=>{
 assert.equal(Math.round(detectDuration(webm(29.7),null,'video/webm')*10),297);
 assert.throws(()=>enforceVideoDuration(webm(31.1),null,'video/webm'),/30 soniya/);
});
test('Unknown and forged client-only metadata fails closed',()=>{
 assert.throws(()=>enforceVideoDuration(Buffer.alloc(64),null,'video/mp4'),/sarlavhasi/);
 assert.throws(()=>enforceVideoDuration(Buffer.alloc(64),null,'video/webm'),/sarlavhasi/);
 const noDuration=Buffer.alloc(32);noDuration.write('ftyp',4);
 assert.throws(()=>enforceVideoDuration(noDuration,null,'video/mp4'),/tasdiqlab/);
});
function clip(x){return {_id:x.id,author:{_id:x.author,accountOrigin:x.synthetic?'synthetic':'organic',isPrivate:!!x.private},createdAt:new Date('2026-10-23T00:00:00Z'),tags:x.tags||[],likeCount:x.likes||0,commentCount:0,viewCount:100}}
const A='aaaaaaaaaaaaaaaaaaaaaaaa',B='bbbbbbbbbbbbbbbbbbbbbbbb',C='cccccccccccccccccccccccc';
const PA='111111111111111111111111',PB='222222222222222222222222',PC='333333333333333333333333';
test('Followed and liked interests outrank unrelated clips',()=>{
 const clips=[clip({id:PA,author:A,tags:['football']}),clip({id:PB,author:B,tags:['coding']})];
 const signals={following:new Set([A]),authorAffinity:new Map([[A,15]]),tagAffinity:new Map([['football',30]]),seen:new Map(),liked:new Set()};
 const output=rankClips(clips,signals,{limit:2,now:Date.parse('2026-10-23T12:00:00Z')});
 assert.equal(output[0]._id,PA);
 assert.ok(clipScore(clips[0],signals,Date.parse('2026-10-23T12:00:00Z'))>clipScore(clips[1],signals,Date.parse('2026-10-23T12:00:00Z')));
});
test('Skip and seen penalty, block/privacy, exclusions and creator diversity',()=>{
 const rows=[clip({id:PA,author:A}),clip({id:PB,author:B,private:true}),clip({id:PC,author:C})];
 const hidden={following:new Set(),blocked:new Set([C]),seen:new Map(),hiddenPosts:new Set(),hiddenAuthors:new Set()};
 const out=rankClips(rows,hidden,{exclude:[],limit:8,userId:'other',now:Date.parse('2026-10-23T12:00:00Z')});
 assert.deepEqual(out.map(x=>x._id),[PA]);
 assert.deepEqual(rankClips(rows,hidden,{exclude:[PA],limit:8}),[]);
 const recent={following:new Set(),seen:new Map([[PA,{at:new Date('2026-10-23T11:55:00Z')}]]),liked:new Set()};
 assert.ok(clipScore(rows[0],recent,Date.parse('2026-10-23T12:00:00Z'))<clipScore(rows[2],recent,Date.parse('2026-10-23T12:00:00Z')));
});
