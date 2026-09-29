const fs=require('fs');
const path=require('path');

const firstNames=[
'Aziza','Madina','Mohira','Nilufar','Shahnoza','Sevara','Dilnoza','Malika','Rayona','Zarina',
'Jasur','Bekzod','Sardor','Asilbek','Shahzod','Diyor','Kamron','Temur','Akmal','Sanjar',
'Anastasia','Sofia','Alina','Daria','Elena','Mila','Polina','Viktoria','Arina','Ksenia',
'Alexander','Maksim','Nikita','Roman','Daniil','Kirill','Artem','Ilya','Mikhail','Denis',
'Amelia','Emma','Olivia','Mia','Ava','Luna','Chloe','Nora','Maya','Layla',
'Noah','Liam','Ethan','Leo','Lucas','Adam','Owen','Ryan','Mason','Aiden'
];
const lastNames=[
'Karimova','Rahimova','Ismoilova','Yusupova','Saidova','Nazarova','Tursunova','Abdullaeva','Rasulova','Qodirova',
'Karimov','Rahimov','Ismoilov','Yusupov','Saidov','Nazarov','Tursunov','Abdullaev','Rasulov','Qodirov',
'Petrova','Ivanova','Smirnova','Volkova','Sokolova','Kuznetsova','Morozova','Popova','Orlova','Lebedeva',
'Petrov','Ivanov','Smirnov','Volkov','Sokolov','Kuznetsov','Morozov','Popov','Orlov','Lebedev',
'Anderson','Miller','Taylor','Wilson','Moore','Martin','Clark','Lewis','Walker','Hall',
'Young','King','Wright','Scott','Green','Baker','Adams','Nelson','Carter','Mitchell'
];
const bios=[
'Yangi g\'oyalar, chiroyli lahzalar va yaxshi kayfiyat ✦',
'Kundalik hayot, ijod va foydali topilmalar.',
'Tech, music va creative life.',
'Coffee, books, travel va kichik quvonchlar.',
'Photography, design va yangi joylar.',
'Har kuni ozgina yaxshiroq bo\'lish uchun.',
'Music lover · visual stories · good vibes.',
'Learning, creating, sharing.',
'Life in frames ✦',
'Food, travel va samimiy postlar.',
'Gaming, gadgets va internet madaniyati.',
'Moda, beauty va lifestyle.',
'Art, cinema va ilhom.',
'Fitness, routine va motivatsiya.',
'Simple moments, real stories.'
];
const interests=['lifestyle','music','tech','gaming','travel','food','fashion','beauty','education','art','fitness','cars','humor'];

const requested=Number(process.argv[2]||10000);
const count=Math.max(1,Math.min(10000,Number.isFinite(requested)?Math.floor(requested):10000));
const outDir=path.join(process.cwd(),'tmp');
const outFile=path.join(outDir,`synthetic-users-${count}.ndjson`);
fs.mkdirSync(outDir,{recursive:true});

function slug(v){return String(v).toLowerCase().replace(/[^a-z0-9]+/g,'').slice(0,7)||'user'}
function pad(n){return String(n).padStart(5,'0')}
function createdAtFor(i){
  const span=180*864e5;
  return new Date(Date.now()-span+(span*((i+1)/(count+1)))).toISOString();
}
function profileFor(i){
  const combo=firstNames.length*lastNames.length;
  const group=Math.floor(i/combo);
  const first=firstNames[i%firstNames.length];
  const last=lastNames[Math.floor(i/firstNames.length)%lastNames.length];
  const second=group>0?firstNames[(i+group*19)%firstNames.length]:'';
  const name=second&&second!==first?first+' '+second+' '+last:first+' '+last;
  const creator=i%7===0;
  return {
    syntheticId:'syn_'+pad(i+1),
    name,
    username:('lumi'+pad(i+1)+'.'+slug(first)).slice(0,24),
    bio:bios[i%bios.length],
    role:creator?'creator':'user',
    creatorMode:creator,
    creatorCategory:creator?['lifestyle','tech','gaming','music','travel','art'][i%6]:'',
    interests:[interests[i%interests.length],interests[(i+5)%interests.length]],
    accountOrigin:'synthetic',
    managedByPlatform:true,
    publicLabel:'Virtual profile',
    createdAt:createdAtFor(i)
  };
}
const fd=fs.openSync(outFile,'w');
try{
  for(let i=0;i<count;i++)fs.writeSync(fd,JSON.stringify(profileFor(i))+'\n');
}finally{
  fs.closeSync(fd);
}
console.log(`Generated ${count} synthetic profiles → ${outFile}`);
