'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const TeamBrand=require('../public/team-brand');
const {teams}=require('../server/roster');
const read=name=>fs.readFileSync(path.resolve(__dirname,'../public',name),'utf8');
test('all menu button bindings point to existing HTML elements',()=>{
 const markup=read('index.html'),code=read('ui.js');
 for(const [,name] of code.matchAll(/bind\('([^']+)'/g)){
   assert.ok(markup.includes('id="'+name+'"'),'missing menu element #'+name);
 }
 for(const screen of ['home','multiplayer','soloSelect','lobby','draft','play'])
   assert.ok(markup.includes('id="'+screen+'"'),'missing screen '+screen);
});
test('seven unique accessible team crests are generated with distinct original shapes',()=>{
 const svg=teams.map(team=>TeamBrand.crest(team,120));
 assert.equal(svg.length,7);
 assert.equal(new Set(svg).size,7);
 for(const [i,markup] of svg.entries()){
   assert.match(markup,/<svg/);
   assert.ok(markup.includes(teams[i].primary));
   assert.match(markup,/aria-label=".* team crest"/);
   assert.ok(TeamBrand.motto(teams[i].id).length>8);
 }
});
test('artwork and player entry screens remain functional static game resources',()=>{
 const html=read('index.html'),css=read('style.css');
 assert.match(html,/\/team-brand\.js/);
 assert.match(html,/\/sprites\.js/);
 assert.match(html,/id="gameCanvas"/);
 assert.match(html,/id="inviteUrl"/);
 assert.match(html,/id="soloOppRoster"/);
 assert.match(css,/\/assets\/ui\/arena\.svg/);
 assert.ok(fs.existsSync(path.resolve(__dirname,'../public/assets/ui/arena.svg')));
});
