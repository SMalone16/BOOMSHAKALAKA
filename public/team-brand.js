'use strict';
/** Original SVG team crests; no external images or dependencies. */
const TeamBrand=(()=>{
  const details=Object.freeze({
    pallet:{symbol:'leaf',motto:'SMALL TOWN. BIG PLAYS.',style:'FAST BREAKERS'},
    pewter:{symbol:'gem',motto:'ROCK SOLID. NO MERCY.',style:'BRUTE FORCE'},
    cerulean:{symbol:'wave',motto:'RIDE THE WAVE.',style:'SPLASH CITY'},
    vermillion:{symbol:'bolt',motto:'BRING THE THUNDER.',style:'HIGH VOLTAGE'},
    lavender:{symbol:'moon',motto:'PLAY IN THE SHADOWS.',style:'GHOST DEFENSE'},
    saffron:{symbol:'star',motto:'OUTTHINK. OUTPLAY.',style:'COURT VISION'},
    cinnabar:{symbol:'fire',motto:'TURN UP THE HEAT.',style:'HOT HANDS'}
  });
  const symbols={
    leaf:'<path d="M50 76 Q18 50 50 16 Q82 50 50 76Z" fill="currentColor"/><path d="M50 72V29 M50 51L34 41 M50 62L66 46" stroke="#072530" stroke-width="4" fill="none"/>',
    gem:'<path d="M50 15 76 34 67 67 50 82 26 64 23 35Z" fill="currentColor"/><path d="M23 35H76M26 64L50 35 67 67 M50 15V35L50 82" fill="none" stroke="#0f1933" stroke-width="3"/>',
    wave:'<path d="M15 55Q25 30 38 55T65 55T86 55 M15 67Q25 42 38 67T65 67T86 67" stroke="currentColor" stroke-width="9" fill="none"/>',
    bolt:'<path d="M59 10 26 53H48L40 89 79 42H56Z" fill="currentColor" stroke="#171a30" stroke-width="3"/>',
    moon:'<path d="M63 16A33 33 0 1 0 76 75 29 29 0 0 1 63 16Z" fill="currentColor"/><circle cx="73" cy="26" r="5" fill="#fff1b1"/>',
    star:'<path d="M50 10 60 38 91 41 67 60 75 89 50 73 24 89 33 60 9 41 40 38Z" fill="currentColor"/>',
    fire:'<path d="M50 10Q78 42 68 56 Q90 44 74 78 Q52 102 29 78 Q15 57 39 37 Q35 59 50 62 Q63 45 50 10Z" fill="currentColor"/>'
  };
  function crest(team,dimension=118){
    const id=typeof team==='string'?team:team?.id;
    const t=details[id]||details.pallet;
    const primary=typeof team==='object'&&/^#[0-9a-f]{6}$/i.test(team.primary)?team.primary:'#9cffa5';
    const secondary=typeof team==='object'&&/^#[0-9a-f]{6}$/i.test(team.secondary)?team.secondary:'#203753';
    const size=Math.max(32,Math.min(240,Number(dimension)||118));
    return '<svg class="teamCrest" role="img" aria-label="'+id+' team crest" width="'+size+'" height="'+size+'" viewBox="0 0 100 110" xmlns="http://www.w3.org/2000/svg">'+
      '<path d="M50 4 93 19 90 75 50 106 10 75 7 19Z" fill="#050c26" stroke="'+primary+'" stroke-width="5"/>'+
      '<path d="M50 12 84 24 81 70 50 96 19 70 16 24Z" fill="'+secondary+'" stroke="#f5f1dd" stroke-width="2"/>'+
      '<path d="M20 75 50 94 80 75" stroke="'+primary+'" stroke-width="4" fill="none"/>'+
      '<g style="color:'+primary+'" transform="translate(0 4)">'+symbols[t.symbol]+'</g></svg>';
  }
  function motto(id){return (details[id]||details.pallet).motto}
  function style(id){return (details[id]||details.pallet).style}
  return {crest,motto,style,details};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=TeamBrand;
