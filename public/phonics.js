// Explicit grapheme-to-sound examples for the English reading demo.
// Never guess a context-dependent pronunciation for an unknown word.
(function (root) {
  const sounds = {
    a:['AE1','ă'],e:['EH1','ĕ'],i:['IH1','ĭ'],o:['AA1','ŏ'],u:['AH1','ŭ'],
    b:['B','b'],d:['D','d'],f:['F','f'],g:['G','g'],h:['HH','h'],j:['JH','j'],
    k:['K','k'],l:['L','l'],m:['M','m'],n:['N','n'],p:['P','p'],r:['R','r'],
    s:['S','s'],t:['T','t'],v:['V','v'],w:['W','w'],y:['Y','y'],z:['Z','z'],
    sh:['SH','sh'],ch:['CH','ch'],th:['TH','th'],dh:['DH','th'],ng:['NG','ng'],
    ee:['IY1','ē'],ay:['EY1','ā'],eye:['AY1','ī'],oh:['OW1','ō'],oo:['UW1','oo'],
    book:['UH1','oo'],er:['ER1','er'],ar:['AA1 R','ar'],or:['AO1 R','or'],
    aw:['AO1','aw'],ow:['AW1','ow'],oy:['OY1','oy'],x:['K S','ks'],qu:['K W','kw'],
    schwa:['AH0','uh'],ul:['AH0 L','ul'],silent:['','silent']
  };
  const words = {};
  const add = (word, groups) => { words[word] = groups.split(' ').map(item=>{const [letters,sound]=item.split(':');return {letters,sound};}); };
  // These short words use the regular short-vowel pattern shown here.
  for(const word of 'cat bat mat sat hat pat rat fat bag rag tag wag can fan man pan ran tan cap map nap tap gap lap bad dad mad sad had ham jam ram bed fed led red beg leg peg hen men pen ten net pet set wet jet vet web yes bib rib big dig fig pig wig dim him rim dip hip lip rip sip tip bit fit hit kit lit pit sit win fin pin tin bin dog fog log bog hog dot hot lot not pot cot got cop hop mop pop top box fox ox sun bun fun gun nun run but cut hut nut rut cup pup bus bug dug hug jug mug rug gum hum mud bud'.split(' ')) {
    add(word, [...word].map(letter=>letter+':'+({c:'k'}[letter]||letter)).join(' '));
  }
  const examples = {
    bird:'b:b ir:er d:d', garden:'g:g ar:ar d:d e:schwa n:n', grow:'g:g r:r ow:oh',
    butterfly:'b:b u:u tt:t er:er f:f l:l y:eye', rabbit:'r:r a:a bb:b i:i t:t',
    fish:'f:f i:i sh:sh', ship:'sh:sh i:i p:p', shop:'sh:sh o:o p:p',
    chin:'ch:ch i:i n:n', chip:'ch:ch i:i p:p', chat:'ch:ch a:a t:t',
    thin:'th:th i:i n:n', this:'th:dh i:i s:s', that:'th:dh a:a t:t',
    ring:'r:r i:i ng:ng', sing:'s:s i:i ng:ng', king:'k:k i:i ng:ng',
    duck:'d:d u:u ck:k', back:'b:b a:a ck:k', sock:'s:s o:o ck:k',
    moon:'m:m oo:oo n:n', book:'b:b oo:book k:k', tree:'t:t r:r ee:ee',
    green:'g:g r:r ee:ee n:n', seed:'s:s ee:ee d:d', see:'s:s ee:ee',
    rain:'r:r ai:ay n:n', day:'d:d ay:ay', play:'p:p l:l ay:ay',
    snow:'s:s n:n ow:oh', boat:'b:b oa:oh t:t', goat:'g:g oa:oh t:t',
    cake:'c:k a:ay k:k e:silent', bike:'b:b i:eye k:k e:silent',
    kite:'k:k i:eye t:t e:silent', home:'h:h o:oh m:m e:silent',
    blue:'b:b l:l ue:oo', yellow:'y:y e:e ll:l ow:oh',
    apple:'a:a pp:p le:ul', little:'l:l i:i tt:t le:ul',
    I:'I:eye', a:'a:schwa', the:'th:dh e:schwa', is:'i:i s:z',
    was:'w:w a:u s:z', of:'o:u f:v', to:'t:t o:oo', you:'y:y ou:oo',
    he:'h:h e:ee', she:'sh:sh e:ee', we:'w:w e:ee', me:'m:m e:ee',
    my:'m:m y:eye', go:'g:g o:oh', no:'n:n o:oh', so:'s:s o:oh',
    do:'d:d o:oo', put:'p:p u:book t:t', son:'s:s o:u n:n',
    her:'h:h er:er', car:'c:k ar:ar', star:'s:s t:t ar:ar',
    cow:'c:k ow:ow', toy:'t:t oy:oy',
    // Explicit exceptions, vowel teams, silent consonants, and inflections.
    have:'h:h a:a v:v e:silent', give:'g:g i:i v:v e:silent',
    love:'l:l o:u v:v e:silent', come:'c:k o:u m:m e:silent',
    some:'s:s o:u m:m e:silent', done:'d:d o:u n:n e:silent',
    said:'s:s ai:e d:d', says:'s:s ay:e s:z', friend:'f:f r:r ie:e n:n d:d',
    head:'h:h ea:e d:d', bread:'b:b r:r ea:e d:d',
    eat:'ea:ee t:t', beach:'b:b ea:ee ch:ch', feet:'f:f ee:ee t:t',
    look:'l:l oo:book k:k', good:'g:g oo:book d:d', food:'f:f oo:oo d:d',
    out:'ou:ow t:t', house:'h:h ou:ow s:s e:silent', coin:'c:k oi:oy n:n',
    night:'n:n igh:eye t:t', light:'l:l igh:eye t:t', high:'h:h igh:eye',
    phone:'ph:f o:oh n:n e:silent', white:'wh:w i:eye t:t e:silent',
    knee:'k:silent n:n ee:ee', know:'k:silent n:n ow:oh',
    write:'w:silent r:r i:eye t:t e:silent', lamb:'l:l a:a m:m b:silent',
    city:'c:s i:i t:t y:ee', gem:'g:j e:e m:m', giant:'g:j i:eye a:schwa n:n t:t',
    turn:'t:t ur:er n:n', fork:'f:f or:or k:k', corn:'c:k or:or n:n',
    saw:'s:s aw:aw', draw:'d:d r:r aw:aw',
    teeth:'t:t ee:ee th:th', with:'w:w i:i th:dh',
    cats:'c:k a:a t:t s:s', dogs:'d:d o:o g:g s:z',
    jumped:'j:j u:u m:m p:p ed:t', played:'p:p l:l ay:ay ed:d',
    wanted:'w:w a:o n:n t:t e:i d:d',
    about:'a:schwa b:b ou:ow t:t', away:'a:schwa w:w ay:ay'
  };
  for (const [word, groups] of Object.entries(examples)) add(word.toLowerCase(),groups);
  function segments(word) {
    const result=words[String(word).toLowerCase()];
    return result ? result.map(group=>({...group})) : null;
  }
  function letters(word) {
    const groups=segments(word), result=[];
    if(!groups)return [...String(word)].map((letter,index)=>({letter,index,group:index,letters:letter,sound:null}));
    let index=0;
    groups.forEach((group,groupIndex)=>{
      for(const letter of group.letters)result.push({letter:String(word)[index]||letter,index:index++,group:groupIndex,...group});
    });
    return result;
  }
  const examplesForSound = {
    a:'apple',e:'egg',i:'itch',o:'otter',u:'up',b:'bat',d:'dog',f:'fish',g:'go',
    h:'hat',j:'jam',k:'cat',l:'leg',m:'moon',n:'net',p:'pig',r:'red',s:'sun',
    t:'top',v:'vet',w:'wet',y:'yes',z:'zip',sh:'ship',ch:'chip',th:'thin',
    dh:'this',ng:'ring',ee:'see',ay:'day',eye:'bike',oh:'go',oo:'moon',
    book:'book',er:'bird',ar:'car',or:'fork',aw:'saw',ow:'cow',oy:'toy',
    x:'box',qu:'quick',schwa:'about',ul:'apple'
  };
  function hint(part, word) {
    if (!part.sound) return `Letter name: ${part.letter}`;
    if (part.sound === 'silent') return `The ${part.letters} is silent in ${word}.`;
    const example = examplesForSound[part.sound];
    return `${part.letters}: /${sounds[part.sound][1]}/ as in ${example}.`;
  }
  const api={sounds,words,segments,letters,hint};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.WordRingPhonics=api;
})(typeof window!=='undefined'?window:globalThis);
