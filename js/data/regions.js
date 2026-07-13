/* ============================================================
 * Westeros — geography data
 * All coordinates live in "map units" (world space ~1000 x 1340).
 * Region polygons are assembled from shared border SEGMENTS so
 * neighbouring realms always share the exact same border line.
 * ============================================================ */
(function () {
  'use strict';

  // ---- Shared border / coast segments -----------------------------------
  const S = {
    // The Wall, west → east
    wall:       [[215,212],[300,207],[390,200],[480,192],[570,187],[690,182]],
    // Beyond-the-Wall coasts
    btwWest:    [[178,0],[150,55],[190,115],[158,168],[215,212]],
    btwEast:    [[690,182],[738,148],[706,96],[752,44],[728,0]],
    // The North
    northEast:  [[690,182],[722,228],[678,262],[716,304],[662,342],[688,372],
                 [768,394],[714,426],[643,448],[602,481],[630,511],[562,532],
                 [502,546],[470,560]],
    neck:       [[280,552],[350,568],[420,572],[470,560]],           // N/Riverlands border, W→E
    northWest:  [[215,212],[187,256],[214,298],[190,338],[236,374],[204,414],
                 [246,430],[230,468],[254,518],[280,552]],
    // Riverlands
    bite:       [[470,560],[506,584],[520,610]],                     // coast on the Bite
    riverVale:  [[520,610],[498,656],[514,700],[536,742],[540,762]], // Riverlands/Vale border
    riverBay:   [[540,762],[578,776],[620,785]],                     // coast on Bay of Crabs
    riverCrown: [[620,785],[560,800],[520,830]],                     // Riverlands/Crownlands
    riverReach: [[520,830],[452,846],[382,838],[330,850]],           // Riverlands/Reach
    riverWest:  [[330,850],[308,798],[332,748],[302,698],[315,650]], // Riverlands/Westerlands
    riverCoast: [[315,650],[282,622],[300,588],[280,552]],           // coast on Ironman's Bay
    // The Vale
    valeCoast:  [[540,762],[598,748],[650,760],[676,732],[658,692],[728,662],
                 [688,642],[758,616],[700,596],[744,572],[652,586],[566,600],
                 [520,610]],
    // Crownlands
    crownCoast: [[620,785],[668,778],[718,764],[752,790],[698,812],[658,800],
                 [628,826],[598,846],[572,866],[598,894],[648,906],[700,888],
                 [742,908],[702,944],[664,934],[640,955]],
    crownStorm: [[640,955],[580,948],[530,940]],                     // Crownlands/Stormlands
    crownReach: [[520,830],[526,888],[530,940]],                     // Crownlands/Reach
    // Stormlands
    stormCoast: [[640,955],[678,984],[656,1014],[700,1042],[722,1078],[678,1102],
                 [638,1086],[598,1096],[560,1080]],
    stormDorne: [[560,1080],[520,1090],[478,1074],[440,1085]],       // Stormlands/Dorne
    stormReach: [[530,940],[470,958],[446,996],[456,1040],[440,1085]], // Stormlands/Reach
    // Dorne
    dorneCoast: [[560,1080],[586,1112],[642,1124],[700,1114],[724,1136],[772,1148],
                 [808,1168],[766,1198],[698,1222],[618,1244],[538,1236],[458,1260],
                 [378,1240],[328,1208],[308,1168],[338,1138],[330,1110]],
    dorneReach: [[440,1085],[400,1106],[356,1094],[330,1110]],       // Dorne/Reach
    // The Reach
    reachCoast: [[330,1110],[298,1120],[268,1088],[286,1058],[248,1040],[268,1002],
                 [230,962],[252,920],[240,880]],
    westReach:  [[330,850],[288,868],[240,880]],                     // Westerlands/Reach
    // Westerlands
    westCoast:  [[240,880],[198,858],[214,820],[186,778],[212,740],[178,700],
                 [222,668],[252,654],[286,634],[315,650]],
  };

  const rev = (pts) => pts.slice().reverse();
  // join segments, dropping duplicated junction points
  function join() {
    const out = [];
    for (const seg of arguments) {
      for (const p of seg) {
        const last = out[out.length - 1];
        if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
      }
    }
    return out;
  }

  // ---- Regions -----------------------------------------------------------
  const REGIONS = [
    {
      id: 'beyond', name: 'Beyond the Wall', color: '#e4edf2',
      house: 'The Free Folk (no house rules here)', seat: '—',
      words: '“We do not kneel.”',
      blurb: 'The vast frozen wilderness north of the Wall — haunted forests, the Frostfangs, and the Lands of Always Winter. Home to the free folk, the giants, and older, colder things.',
      polys: [
        join(S.btwWest, S.wall, S.btwEast),
        [[756,214],[788,206],[802,228],[776,244],[750,232]],          // Skagos
      ],
    },
    {
      id: 'north', name: 'The North', color: '#ccd5d9',
      house: 'House Stark of Winterfell', seat: 'Winterfell',
      words: '“Winter Is Coming”',
      blurb: 'The largest of the Seven Kingdoms, nearly as big as the other six combined. Sparse, hard and cold, ruled for eight thousand years by the Kings of Winter and then the Wardens of the North.',
      polys: [
        join(S.wall, S.northEast, rev(S.neck), rev(S.northWest)),
        [[142,236],[164,228],[176,244],[158,258],[138,252]],          // Bear Island
      ],
    },
    {
      id: 'iron-islands', name: 'The Iron Islands', color: '#c8ccd3',
      house: 'House Greyjoy of Pyke', seat: 'Pyke',
      words: '“We Do Not Sow”',
      blurb: 'Seven bleak, stony islands in Ironman’s Bay. The ironborn keep the Old Way — reaving, raiding, and paying the iron price — and worship the Drowned God.',
      polys: [
        [[112,598],[158,586],[186,606],[168,636],[126,644],[104,620]], // Great Wyk
        [[204,634],[240,628],[252,648],[224,662],[198,652]],           // Pyke
        [[216,594],[248,588],[258,608],[232,616]],                     // Harlaw
        [[176,652],[200,648],[196,668],[172,664]],                     // Old Wyk
        [[178,570],[198,566],[194,580]],                               // Saltcliffe
      ],
    },
    {
      id: 'vale', name: 'The Vale of Arryn', color: '#cfdde8',
      house: 'House Arryn of the Eyrie', seat: 'The Eyrie',
      words: '“As High as Honor”',
      blurb: 'A fertile vale ringed by the Mountains of the Moon, all but impregnable behind the Bloody Gate. The Arryns are the oldest line of Andal nobility in Westeros.',
      polys: [
        join(S.riverVale, S.valeCoast),
        [[584,536],[600,532],[596,548]],                               // The Three Sisters
        [[616,542],[632,538],[628,554]],
        [[646,530],[660,528],[656,542]],
      ],
    },
    {
      id: 'riverlands', name: 'The Riverlands', color: '#c9dabf',
      house: 'House Tully of Riverrun', seat: 'Riverrun',
      words: '“Family, Duty, Honor”',
      blurb: 'The fertile heart of Westeros, watered by the forks of the Trident — and the battleground of nearly every war ever fought on the continent. The riverlords answer to Riverrun.',
      polys: [
        join(S.neck, S.bite, S.riverVale, S.riverBay, S.riverCrown,
             S.riverReach, S.riverWest, S.riverCoast),
      ],
    },
    {
      id: 'westerlands', name: 'The Westerlands', color: '#dcc2b3',
      house: 'House Lannister of Casterly Rock', seat: 'Casterly Rock',
      words: '“Hear Me Roar!”',
      blurb: 'Hilly western country riddled with gold and silver mines — the richest of the Seven Kingdoms. A Lannister always pays his debts.',
      polys: [
        join(rev(S.riverWest), S.westReach, S.westCoast),
      ],
    },
    {
      id: 'crownlands', name: 'The Crownlands', color: '#e0d4a8',
      house: 'House Baratheon of King’s Landing (formerly Targaryen)', seat: 'King’s Landing',
      words: '“Ours Is the Fury” (Targaryen: “Fire and Blood”)',
      blurb: 'The lands around Blackwater Bay, ruled directly by the Iron Throne since Aegon’s Conquest. Here stand King’s Landing, Dragonstone, and the pine-clad wilds of Crackclaw Point.',
      polys: [
        join(rev(S.riverCrown), S.crownCoast, S.crownStorm, rev(S.crownReach)),
        [[774,834],[800,828],[810,848],[788,858],[770,850]],           // Dragonstone
        [[742,862],[764,858],[768,874],[746,876]],                     // Driftmark
        [[764,752],[780,748],[782,762],[766,764]],                     // Claw Isle
      ],
    },
    {
      id: 'stormlands', name: 'The Stormlands', color: '#bcc6b6',
      house: 'House Baratheon of Storm’s End', seat: 'Storm’s End',
      words: '“Ours Is the Fury”',
      blurb: 'Wild, storm-lashed country between the Dornish Marches and Shipbreaker Bay, thick with the rainwood and the kingswood. Its lords have ever been proud and warlike.',
      polys: [
        join(rev(S.crownStorm), S.stormCoast, S.stormDorne, rev(S.stormReach)),
        [[746,972],[768,962],[780,988],[762,1010],[744,996]],          // Tarth
        [[724,1052],[744,1046],[750,1064],[730,1070]],                 // Estermont
      ],
    },
    {
      id: 'reach', name: 'The Reach', color: '#d3dca6',
      house: 'House Tyrell of Highgarden', seat: 'Highgarden',
      words: '“Growing Strong”',
      blurb: 'The most fertile and populous of the Seven Kingdoms, breadbasket of Westeros, cradle of chivalry — and home to Oldtown, the oldest city on the continent.',
      polys: [
        join(rev(S.westReach), rev(S.riverReach), S.crownReach,
             S.stormReach, S.dorneReach, S.reachCoast),
        [[210,1136],[244,1128],[256,1150],[228,1164],[204,1154]],      // The Arbor
        [[220,968],[236,964],[232,978]],                               // Shield Islands
        [[204,984],[218,980],[214,994]],
      ],
    },
    {
      id: 'dorne', name: 'Dorne', color: '#e4cda0',
      house: 'House Nymeros Martell of Sunspear', seat: 'Sunspear',
      words: '“Unbowed, Unbent, Unbroken”',
      blurb: 'The sun-scorched south — deserts, red mountains and the green Greenblood. Never conquered by dragons, Dorne joined the realm by marriage and keeps its own princes and its own laws.',
      polys: [
        join(rev(S.stormDorne), S.dorneCoast, rev(S.dorneReach)),
      ],
    },
    {
      id: 'essos', name: 'Essos — The Free Cities', color: '#d8cdb2',
      house: 'The Nine Free Cities, quarrelsome daughters of old Valyria', seat: '—',
      words: '“Valar Morghulis — All Men Must Die”',
      blurb: 'Across the narrow sea sprawls another continent entire. Along its western shore stand the Free Cities: Braavos of the Titan, merchant Pentos, Myr of the lens-grinders, gaudy Tyrosh, perfumed Lys, and proud old Volantis. The map ends here; the world does not.',
      polys: [
        // western coast of Essos, running off the map's eastern edge
        [[1180,235],[1080,238],[1005,262],[1032,300],[978,332],[1000,352],
         [970,378],[1006,412],[978,452],[1012,505],[982,548],[1018,600],
         [988,652],[1020,704],[992,748],[972,790],[1005,822],[982,862],
         [1014,905],[988,948],[1022,992],[996,1035],[1028,1078],[1000,1120],
         [1035,1165],[1010,1205],[1042,1248],[1080,1290],[1120,1322],[1180,1345]],
        [[958,342],[974,338],[980,350],[966,358],[954,352]],              // Braavos
        [[976,1000],[994,994],[1000,1008],[986,1018],[972,1010]],         // Tyrosh
        [[1002,1148],[1020,1142],[1026,1156],[1012,1166],[998,1158]],     // Lys
        [[878,1052],[894,1046],[900,1058],[886,1066],[874,1060]],         // The Stepstones
        [[908,1084],[922,1078],[928,1090],[914,1098]],
        [[884,1112],[898,1106],[904,1118],[890,1126]],
      ],
    },
  ];

  // Political borders drawn as dashed overlays (internal land borders only)
  const BORDERS = [
    S.neck, S.riverVale, S.riverCrown, S.riverReach, S.riverWest,
    S.crownStorm, S.crownReach, S.stormReach, S.stormDorne, S.dorneReach,
    S.westReach,
  ];

  // ---- Water features ----------------------------------------------------
  const RIVERS = [
    { name: 'Milkwater',      pts: [[420,45],[435,100],[428,150],[440,182]] },
    { name: 'White Knife',    pts: [[556,360],[576,400],[598,430],[615,452]] },
    { name: 'Green Fork',     pts: [[452,572],[440,610],[452,648],[470,680]] },
    { name: 'Blue Fork',      pts: [[344,592],[390,616],[432,652],[470,680]] },
    { name: 'Red Fork',       pts: [[318,668],[352,684],[388,690],[430,686],[470,680]] },
    { name: 'The Trident',    pts: [[470,680],[505,706],[528,736],[540,760]], major: true },
    { name: 'Blackwater Rush',pts: [[430,806],[470,822],[510,844],[548,858],[576,864]], major: true },
    { name: 'The Mander',     pts: [[470,890],[430,910],[386,924],[352,930],[322,948],[290,964],[252,974]], major: true },
    { name: 'Honeywine',      pts: [[300,1010],[288,1032],[280,1050]] },
    { name: 'Greenblood',     pts: [[560,1168],[608,1184],[656,1178],[700,1150],[722,1138]], major: true },
    { name: 'Torrentine',     pts: [[382,1122],[358,1140],[336,1150]] },
  ];

  const LAKES = [
    { name: 'The Gods Eye', pts: [[440,722],[478,716],[496,738],[484,764],[448,768],[430,746]] },
    { name: 'Long Lake',    pts: [[545,330],[560,326],[566,356],[552,362]] },
  ];
  // drawn on top of the Gods Eye
  const LAKE_ISLES = [
    { name: 'Isle of Faces', pts: [[458,736],[474,734],[472,750],[456,750]] },
  ];

  // ---- Roads (dashed) ----------------------------------------------------
  const ROADS = [
    { name: 'Kingsroad (north)', pts: [[576,864],[556,824],[540,788],[520,748],[500,712],
        [480,690],[470,680],[452,648],[440,610],[452,572],[448,540],[440,500],
        [436,440],[430,362],[436,300],[446,250],[452,212],[455,196]] },
    { name: 'Kingsroad (south)', pts: [[576,864],[596,900],[618,930],[640,958],[655,985]] },
    { name: 'Roseroad', pts: [[576,864],[536,884],[492,898],[448,912],[400,922],
        [352,928],[330,958],[312,996],[296,1028],[282,1046]] },
    { name: 'Goldroad', pts: [[576,864],[520,852],[460,842],[400,834],[344,824],
        [300,802],[260,792],[216,790]] },
    { name: 'High Road', pts: [[470,680],[500,690],[524,690],[544,678],[556,662]] },
  ];

  // ---- Terrain decorations ----------------------------------------------
  const DECOR = [
    { type: 'mtn',  pts: [[250,55],[280,80],[245,105],[290,120],[260,145],[305,155],[235,150]] },  // Frostfangs
    { type: 'mtn',  pts: [[300,265],[335,290],[295,315],[345,330],[310,345]] },                    // northern mountains
    { type: 'mtn',  pts: [[540,620],[555,650],[535,678],[560,700],[542,725],[565,738]] },          // Mountains of the Moon
    { type: 'mtn',  pts: [[290,725],[268,755],[295,782]] },                                        // western hills
    { type: 'mtn',  pts: [[425,1095],[460,1082],[495,1082],[390,1108],[358,1100],[430,1125],[470,1115]] }, // Red Mountains
    { type: 'tree', pts: [[270,300],[295,318],[255,322],[285,340],[310,332]] },                    // wolfswood
    { type: 'tree', pts: [[600,915],[625,925],[585,930],[640,940],[610,948]] },                    // kingswood
    { type: 'tree', pts: [[655,1055],[680,1065],[645,1075],[695,1082],[665,1090]] },               // rainwood
    { type: 'tree', pts: [[380,120],[420,95],[460,130],[500,110],[540,140],[580,120],[620,150]] }, // haunted forest
    { type: 'mtn',  pts: [[1042,470],[1062,535],[1046,595]] },                                     // Velvet Hills (Essos)
    { type: 'tree', pts: [[1046,878],[1066,842],[1052,910]] },                                     // Flatlands groves
  ];

  // ---- Cartographic labels ----------------------------------------------
  // Region names (scale with the map, fade when zoomed far in)
  const REGION_LABELS = [
    { text: 'BEYOND THE WALL', x: 450, y: 112,  size: 24, rot: 0 },
    { text: 'THE NORTH',       x: 430, y: 432,  size: 40, rot: 0 },
    { text: 'THE VALE',        x: 598, y: 690,  size: 17, rot: 0 },
    { text: 'THE RIVERLANDS',  x: 415, y: 706,  size: 15, rot: 0 },
    { text: 'THE WESTERLANDS', x: 254, y: 752,  size: 12, rot: -72 },
    { text: 'IRON ISLANDS',    x: 168, y: 555,  size: 12, rot: 0 },
    { text: 'THE CROWNLANDS',  x: 612, y: 822,  size: 12, rot: 0 },
    { text: 'THE REACH',       x: 368, y: 992,  size: 30, rot: 0 },
    { text: 'THE STORMLANDS',  x: 588, y: 1032, size: 15, rot: 0 },
    { text: 'DORNE',           x: 560, y: 1192, size: 34, rot: 0 },
    { text: 'THE WALL',        x: 452, y: 176,  size: 11, rot: -1 },
    { text: 'ESSOS',           x: 1082, y: 660, size: 28, rot: 90 },
    { text: 'THE FREE CITIES', x: 1046, y: 940, size: 11, rot: 90 },
  ];

  // Sea names. tier: 1 always, 2 mid zoom, 3 close zoom.
  const SEA_LABELS = [
    { text: 'The  Sunset  Sea',   x: 95,  y: 860,  size: 26, rot: -90, tier: 1 },
    { text: 'The  Narrow  Sea',   x: 906, y: 640,  size: 26, rot: 90,  tier: 1 },
    { text: 'The  Shivering  Sea',x: 866, y: 120,  size: 18, rot: 8,   tier: 1 },
    { text: 'The  Summer  Sea',   x: 600, y: 1315, size: 20, rot: 0,   tier: 1 },
    { text: 'Bay of Ice',         x: 148, y: 205,  size: 12, rot: -18, tier: 2 },
    { text: 'Bay of Seals',       x: 782, y: 158,  size: 12, rot: 10,  tier: 2 },
    { text: 'The Bite',           x: 566, y: 566,  size: 11, rot: 0,   tier: 2 },
    { text: 'Ironman’s Bay', x: 252, y: 566,  size: 11, rot: -12, tier: 2 },
    { text: 'Bay of Crabs',       x: 596, y: 770,  size: 9,  rot: 6,   tier: 3 },
    { text: 'Blackwater Bay',     x: 686, y: 862,  size: 11, rot: -8,  tier: 2 },
    { text: 'Shipbreaker Bay',    x: 736, y: 942,  size: 9,  rot: -55, tier: 3 },
    { text: 'Sea of Dorne',       x: 648, y: 1104, size: 11, rot: 4,   tier: 2 },
    { text: 'Whispering Sound',   x: 258, y: 1066, size: 8,  rot: -35, tier: 3 },
    { text: 'Redwyne Straits',    x: 262, y: 1122, size: 8,  rot: -15, tier: 3 },
    { text: 'The Stepstones',     x: 906, y: 1140, size: 10, rot: -12, tier: 2 },
  ];

  window.WesterosGeo = {
    REGIONS, BORDERS, RIVERS, LAKES, LAKE_ISLES, ROADS, DECOR,
    REGION_LABELS, SEA_LABELS,
    WALL: S.wall,
    // The chart's neatline: the world ends at this rectangle. Essos and the
    // far north deliberately run off its edges.
    FRAME: { x: -40, y: 0, w: 1190, h: 1360 },
  };
})();
