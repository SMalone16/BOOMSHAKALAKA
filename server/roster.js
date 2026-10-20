'use strict';
// Entire roster and pixel-portrait attributes are original artwork/data.
// Six public attributes rated on a 0–100 scale; REB derives from BLOCK + DUNK.
const data = [
  ['pallet','PALLET PALADINS','#69e98a','#123f35','rookie',[
    ['Ash','M','All-Round Ace',[88,79,78,70,72,83],'#30251e','#e3ae85','cap'],
    ['Gary','M','Sharpshooting Rival',[79,96,65,63,74,75],'#6b4634','#f0c19c','spikes'],
    ['Professor','M','Court Vision',[57,81,51,77,64,98],'#d8d5c7','#d8b89a','side'],
    ['Leaf','F','Lightning Cutter',[96,72,68,65,92,76],'#5a392a','#bd825d','ponytail']]],
  ['pewter','PEWTER POWER','#b9b6a8','#46454d','stone',[
    ['Brock','M','Paint Protector',[56,51,94,98,53,67],'#29211b','#be8e69','spikes'],
    ['Flint','M','Power Forward',[66,57,95,89,54,61],'#4f3026','#d29f71','short'],
    ['Opal','F','Rebound Queen',[70,68,78,97,69,71],'#71605e','#a66c4e','bob'],
    ['Boulder','M','Post Maestro',[54,73,90,92,53,78],'#242a37','#a77050','buzz']]],
  ['cerulean','CERULEAN SURFERS','#49d9f0','#205885','wave',[
    ['Misty','F','Fast-Break Flyer',[97,73,75,66,92,80],'#ec963a','#f2c39e','ponytail'],
    ['Marina','F','Deep-Splash Sniper',[81,98,49,57,69,87],'#1b588e','#bd876b','waves'],
    ['Finn','M','Sky Surfer',[90,65,93,73,62,65],'#253644','#d4a47a','spikes'],
    ['Coral','F','Pickpocket Playmaker',[88,76,59,68,96,94],'#f57d8f','#b67a55','bob']]],
  ['vermillion','VERMILLION VOLTAGE','#ffb84d','#7a3248','thunder',[
    ['Lieutenant','M','Thunder Dunker',[86,67,97,84,62,65],'#ded25f','#d9a56f','buzz'],
    ['Volt','M','Quick-Trigger Guard',[94,92,61,54,78,71],'#202629','#9c6f50','spikes'],
    ['Sparks','F','Full-Court Thief',[99,71,65,62,98,77],'#e38a32','#e4b384','ponytail'],
    ['Amp','M','Electric Distributor',[79,75,70,73,71,99],'#704fba','#b57957','curly']]],
  ['lavender','LAVENDER LASSES','#da95f7','#55357a','ghost',[
    ['Lass Dana','F','Midrange Mirage',[87,88,54,68,84,76],'#513a86','#e6b99e','bob'],
    ['Violet','F','Shadow Blocker',[74,67,74,96,90,70],'#bcd1e0','#9c6c61','long'],
    ['Wisp','F','Silent Sniper',[78,97,50,62,79,82],'#3d274f','#c48a73','waves'],
    ['Iris','F','Feint Specialist',[95,72,61,72,89,93],'#efb2d1','#d4a17e','ponytail']]],
  ['saffron','SAFFRON SALAD','#9cf47b','#467e48','mind',[
    ['Sabrina','F','Telepathic Passer',[72,92,59,74,70,99],'#342a49','#e5b697','long'],
    ['Basil','M','Glass Cleaner',[64,61,85,98,59,72],'#527336','#b7805f','short'],
    ['Saffron','F','Perimeter Wizard',[83,98,52,62,80,88],'#f1aa55','#eac3a6','waves'],
    ['Crunch','M','Hustle Defender',[83,61,78,92,94,64],'#48361e','#ad7854','curly']]],
  ['cinnabar','CINNABAR CINNABONS','#ff986e','#903c32','flame',[
    ['Blake','M','Volcanic Finisher',[84,74,99,75,65,64],'#3e2925','#bb8061','spikes'],
    ['Ember','F','Scorching Shooter',[88,96,65,55,79,81],'#e9653c','#dda986','ponytail'],
    ['Cinder','M','Rim Guardian',[66,64,88,97,58,73],'#54423c','#b7815a','buzz'],
    ['Cinnamon','F','Hot-Hand Hustler',[94,85,71,66,88,82],'#ad6132','#edbe92','bob']]]
];
const STAT_KEYS=['speed','three','dunk','block','steal','pass'];
const teams=data.map((row)=>({id:row[0],name:row[1],primary:row[2],secondary:row[3],theme:row[4],
  players:row[5].map((p,i)=>({id:row[0]+'-'+i,name:p[0],gender:p[1],archetype:p[2],
    stats:Object.fromEntries(STAT_KEYS.map((k,j)=>[k,p[3][j]])),hair:p[4],skin:p[5],hairStyle:p[6]}))}));
function findTeam(id){return teams.find(t=>t.id===id)}
function findPlayer(teamId,playerId){return findTeam(teamId)?.players.find(p=>p.id===playerId)}
module.exports={teams,findTeam,findPlayer,STAT_KEYS};
