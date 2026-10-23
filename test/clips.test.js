const test=require('node:test'),assert=require('node:assert/strict');
const {toVtt,clampVideoMeta,MAX_CAPTIONS_BYTES}=require('../services/clipAssets');
test('SRT converts into sanitized WebVTT',()=>{
 const vtt=toVtt('1\n00:00:00,000 --> 00:00:01,500\nSalom <b>dunyo</b>\n\n2\n00:00:02,000 --> 00:00:03,000\nXush kelibsiz');
 assert.ok(vtt.startsWith('WEBVTT\n\n'));assert.match(vtt,/00:00:00.000 --> 00:00:01.500/);assert.ok(!vtt.includes('<b>'));assert.match(vtt,/Xush kelibsiz/);
});
test('WebVTT input preserved in sanitized output',()=>assert.match(toVtt('WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nHi'),/Hi/));
test('Invalid and unsafe subtitles rejected',()=>{
 for(const s of ['', 'WEBVTT\n\nSTYLE\n::cue { color: red }','WEBVTT\n\nNo time','WEBVTT\n\n00:00:03.000 --> 00:00:02.000\nWrong'])
  assert.throws(()=>toVtt(s));
 assert.throws(()=>toVtt('x'.repeat(MAX_CAPTIONS_BYTES+1)),/32 KB/);
});
test('Metadata bounds protect Mongo schema',()=>{
 assert.deepEqual(clampVideoMeta({width:'1920',height:1080,duration:52.128}),{width:1920,height:1080,duration:52.13});
 assert.deepEqual(clampVideoMeta({width:-1,height:Infinity,duration:-2}),{width:0,height:0,duration:0});
});
