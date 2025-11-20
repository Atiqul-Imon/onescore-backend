import 'dotenv/config';
import { connectDatabase, disconnectDatabase } from '../utils/database';
import { CricketTeam } from '../models/CricketTeam';

const teamSeeds = [
  {
    slug: 'india',
    name: 'India',
    shortName: 'IND',
    matchKey: 'IND',
    flag: 'https://flagcdn.com/w40/in.png',
    heroImage: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1600&q=80',
    summary: 'India combine a prolific batting core with relentless white-ball depth and one of the sharpest fast-bowling units in Test cricket.',
    board: 'Board of Control for Cricket in India (BCCI)',
    coach: 'Gautam Gambhir',
    captains: { test: 'Rohit Sharma', odi: 'Rohit Sharma', t20: 'Suryakumar Yadav' },
    ranking: { test: 1, odi: 2, t20: 1 },
    firstTestYear: 1932,
    colors: { primary: '#004ba0', secondary: '#f5b700', accent: '#f5b700' },
    fanPulse: { rating: 4.7, votes: 18234 },
    iccTitles: [
      { name: 'ICC Cricket World Cup', year: 1983 },
      { name: 'ICC Cricket World Cup', year: 2011 },
      { name: 'ICC Champions Trophy', year: 2013 },
      { name: 'ICC T20 World Cup', year: 2007 },
      { name: 'ICC T20 World Cup', year: 2024 },
    ],
    keyPlayers: [
      { name: 'Virat Kohli', role: 'Batter', spotlight: 'Chase anchor & middle-order fulcrum', stats: { matches: 522, runs: 26600, average: 54.2, strikeRate: 90.3 } },
      { name: 'Jasprit Bumrah', role: 'Bowler', spotlight: 'New-ball and death-overs specialist', stats: { matches: 202, wickets: 521, average: 22.1 } },
    ],
    statLeaders: {
      batting: [
        { name: 'Virat Kohli', runs: 13848, innings: 275, average: 58.6, strikeRate: 93.7, description: 'ODI run machine' },
        { name: 'Rohit Sharma', runs: 10709, innings: 241, average: 49.1, strikeRate: 91.0, description: 'Hitman at the top' },
      ],
      bowling: [
        { name: 'Jasprit Bumrah', wickets: 159, innings: 106, average: 23.6, economy: 4.6, description: 'White-ball spearhead' },
        { name: 'Ravindra Jadeja', wickets: 529, innings: 320, average: 28.1, economy: 4.9, description: 'All-format control' },
      ],
    },
    recordLinks: [
      { label: 'Most runs (Tests)', format: 'tests', url: '/records/india/tests/most-runs' },
      { label: 'Most wickets (ODIs)', format: 'odis', url: '/records/india/odis/most-wickets' },
    ],
    timeline: [
      { year: 1932, title: 'Test debut at Lord’s', description: 'CK Nayudu led India in the inaugural Test.' },
      { year: 2007, title: 'T20 World Cup champions', description: 'A young side under MS Dhoni ushered in a new era.' },
    ],
    newsTags: ['india', 'bcci', 'ind-vs-aus', 'ipl'],
  },
  {
    slug: 'australia',
    name: 'Australia',
    shortName: 'AUS',
    matchKey: 'AUS',
    flag: 'https://flagcdn.com/w40/au.png',
    heroImage: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1600&q=80',
    summary: 'Five-time world champions built on aggressive batting, relentless pace stocks, and uncompromising fielding standards.',
    board: 'Cricket Australia',
    coach: 'Andrew McDonald',
    captains: { test: 'Pat Cummins', odi: 'Pat Cummins', t20: 'Mitchell Marsh' },
    ranking: { test: 2, odi: 1, t20: 4 },
    firstTestYear: 1877,
    colors: { primary: '#036b37', secondary: '#ffd700', accent: '#ffd700' },
    fanPulse: { rating: 4.5, votes: 12780 },
    iccTitles: [
      { name: 'ICC Cricket World Cup', year: 1987 },
      { name: 'ICC Cricket World Cup', year: 1999 },
      { name: 'ICC Cricket World Cup', year: 2003 },
      { name: 'ICC Cricket World Cup', year: 2007 },
      { name: 'ICC Cricket World Cup', year: 2015 },
      { name: 'ICC Cricket World Cup', year: 2023 },
      { name: 'ICC World Test Championship', year: 2023 },
    ],
    keyPlayers: [
      { name: 'Pat Cummins', role: 'Bowler', spotlight: 'Leader of the pace cartel', stats: { matches: 168, wickets: 430, average: 23.4 } },
      { name: 'Travis Head', role: 'Batter', spotlight: 'Aggressive left-handed middle-order presence', stats: { matches: 164, runs: 7820, strikeRate: 97.6 } },
    ],
    statLeaders: {
      batting: [
        { name: 'Steve Smith', runs: 16400, innings: 312, average: 55.1, strikeRate: 86.2, description: 'Modern Test great' },
        { name: 'David Warner', runs: 15800, innings: 350, average: 44.8, strikeRate: 95.3, description: 'Powerplay trailblazer' },
      ],
      bowling: [
        { name: 'Pat Cummins', wickets: 430, innings: 248, average: 23.4, economy: 3.1, description: 'Captain fantastic' },
        { name: 'Adam Zampa', wickets: 203, innings: 150, average: 28.7, economy: 5.6, description: 'Middle-overs control' },
      ],
    },
    recordLinks: [
      { label: 'Ashes honour board', format: 'tests', url: '/records/australia/ashes' },
      { label: 'World Cup batting charts', format: 'odis', url: '/records/australia/world-cup/batting' },
    ],
    timeline: [
      { year: 1877, title: 'First-ever Test match', description: 'Beat England by 45 runs at the MCG.' },
      { year: 1999, title: 'World Cup dominance begins', description: 'Start of three consecutive World Cup wins.' },
    ],
    newsTags: ['australia', 'ashes', 'aus-vs-eng'],
  },
  {
    slug: 'england',
    name: 'England',
    shortName: 'ENG',
    matchKey: 'ENG',
    flag: 'https://flagcdn.com/w40/gb.png',
    heroImage: 'https://images.unsplash.com/photo-1469478715127-7d5d0b1d9583?auto=format&fit=crop&w=1600&q=80',
    summary: 'Pioneers of “Bazball” in Tests and reigning innovators in limited overs with a deep white-ball talent pool.',
    board: 'England and Wales Cricket Board (ECB)',
    coach: 'Brendon McCullum (Tests) / Matthew Mott (white-ball)',
    captains: { test: 'Ben Stokes', odi: 'Jos Buttler', t20: 'Jos Buttler' },
    ranking: { test: 3, odi: 5, t20: 2 },
    firstTestYear: 1877,
    colors: { primary: '#0a1f44', secondary: '#e41f26', accent: '#c1dff0' },
    fanPulse: { rating: 4.3, votes: 9804 },
    iccTitles: [
      { name: 'ICC Cricket World Cup', year: 2019 },
      { name: 'ICC T20 World Cup', year: 2010 },
      { name: 'ICC T20 World Cup', year: 2022 },
    ],
    keyPlayers: [
      { name: 'Joe Root', role: 'Batter', spotlight: 'Silk in the middle order', stats: { matches: 327, runs: 19000, average: 50.1 } },
      { name: 'Jofra Archer', role: 'Bowler', spotlight: 'Explosive pace weapon', stats: { matches: 49, wickets: 107, economy: 6.1 } },
    ],
    statLeaders: {
      batting: [
        { name: 'Joe Root', runs: 12000, innings: 230, average: 50.1, strikeRate: 83.4, description: 'All-time England run leader' },
        { name: 'Ben Stokes', runs: 9500, innings: 200, average: 38.5, strikeRate: 88.7, description: 'Clutch finisher' },
      ],
      bowling: [
        { name: 'James Anderson', wickets: 987, innings: 390, average: 26.5, economy: 2.9, description: 'Swing legend' },
        { name: 'Adil Rashid', wickets: 228, innings: 180, average: 30.4, economy: 5.7, description: 'White-ball leggie' },
      ],
    },
    recordLinks: [
      { label: 'Most Test wickets', format: 'tests', url: '/records/england/tests/most-wickets' },
      { label: 'Fastest T20I centuries', format: 't20is', url: '/records/england/t20i/fastest-centuries' },
    ],
    timeline: [
      { year: 2019, title: 'First ODI World Cup win', description: 'Super Over drama at Lord’s.' },
      { year: 2022, title: 'Dual white-ball crowns', description: 'Became concurrent ODI + T20 world champs.' },
    ],
    newsTags: ['england', 'eng-vs-aus', 'bazball'],
  },
  {
    slug: 'pakistan',
    name: 'Pakistan',
    shortName: 'PAK',
    matchKey: 'PAK',
    flag: 'https://flagcdn.com/w40/pk.png',
    heroImage: 'https://images.unsplash.com/photo-1469478715127-7d5d0b1d9583?auto=format&fit=crop&w=1600&q=80',
    summary: 'Mercurial match-winners with express pace, elite wrist spin, and a proud ICC event pedigree.',
    board: 'Pakistan Cricket Board (PCB)',
    coach: 'Gary Kirsten (white-ball) / Jason Gillespie (red-ball)',
    captains: { test: 'Shan Masood', odi: 'Babar Azam', t20: 'Babar Azam' },
    ranking: { test: 6, odi: 3, t20: 3 },
    firstTestYear: 1952,
    colors: { primary: '#0c5738', secondary: '#ffd700', accent: '#f5f3ce' },
    fanPulse: { rating: 4.4, votes: 11011 },
    iccTitles: [
      { name: 'ICC Cricket World Cup', year: 1992 },
      { name: 'ICC T20 World Cup', year: 2009 },
      { name: 'ICC Champions Trophy', year: 2017 },
    ],
    keyPlayers: [
      { name: 'Babar Azam', role: 'Batter', spotlight: 'Classy top-order anchor', stats: { matches: 265, runs: 12800, average: 51.3 } },
      { name: 'Shaheen Afridi', role: 'Bowler', spotlight: 'Left-arm swing at high pace', stats: { matches: 133, wickets: 307, average: 24.5 } },
    ],
    statLeaders: {
      batting: [
        { name: 'Babar Azam', runs: 5400, innings: 108, average: 57.3, strikeRate: 89.4, description: 'ODI giant' },
        { name: 'Mohammad Rizwan', runs: 2797, innings: 82, average: 49.1, strikeRate: 128.9, description: 'T20I machine' },
      ],
      bowling: [
        { name: 'Shaheen Afridi', wickets: 170, innings: 112, average: 24.5, economy: 5.2, description: 'New-ball menace' },
        { name: 'Shadab Khan', wickets: 214, innings: 180, average: 27.8, economy: 6.2, description: 'All-phase leggie' },
      ],
    },
    recordLinks: [
      { label: 'Wasim & Waqar legacy', format: 'tests', url: '/records/pakistan/fast-bowling' },
      { label: 'Champions Trophy 2017 rewind', url: '/features/pakistan-ct17' },
    ],
    timeline: [
      { year: 1992, title: 'First World Cup crown', description: 'Imran Khan’s “cornered tigers”.' },
      { year: 2017, title: 'Champions Trophy win', description: 'Blew away India in the final at The Oval.' },
    ],
    newsTags: ['pakistan', 'pcb', 'pak-vs-ind'],
  },
  {
    slug: 'new-zealand',
    name: 'New Zealand',
    shortName: 'NZ',
    matchKey: 'NZ',
    flag: 'https://flagcdn.com/w40/nz.png',
    heroImage: 'https://images.unsplash.com/photo-1504609773096-104ff2c73ba4?auto=format&fit=crop&w=1600&q=80',
    summary: 'The Black Caps pair tactical clarity with versatile all-format players and elite fielding standards.',
    board: 'New Zealand Cricket',
    coach: 'Gary Stead',
    captains: { test: 'Tim Southee', odi: 'Kane Williamson', t20: 'Kane Williamson' },
    ranking: { test: 5, odi: 4, t20: 6 },
    firstTestYear: 1930,
    colors: { primary: '#0c0c0c', secondary: '#00a2c7', accent: '#ffffff' },
    fanPulse: { rating: 4.6, votes: 7421 },
    iccTitles: [
      { name: 'ICC World Test Championship', year: 2021 },
    ],
    keyPlayers: [
      { name: 'Kane Williamson', role: 'Batter', spotlight: 'Tempo setter & calming influence', stats: { matches: 328, runs: 17200, average: 47.9 } },
      { name: 'Trent Boult', role: 'Bowler', spotlight: 'Left-arm swing control', stats: { matches: 208, wickets: 503, average: 25.3 } },
    ],
    statLeaders: {
      batting: [
        { name: 'Kane Williamson', runs: 8124, innings: 158, average: 54.9, strikeRate: 51.5, description: 'Test stalwart' },
        { name: 'Devon Conway', runs: 1604, innings: 34, average: 50.1, strikeRate: 88.0, description: 'Multi-format anchor' },
      ],
      bowling: [
        { name: 'Trent Boult', wickets: 317, innings: 188, average: 27.4, economy: 3.0, description: 'New-ball artist' },
        { name: 'Matt Henry', wickets: 227, innings: 140, average: 28.1, economy: 4.9, description: 'Middle-overs strike power' },
      ],
    },
    recordLinks: [
      { label: 'WTC 2021 story', url: '/features/nz-wtc' },
      { label: 'Greatest NZ chases', url: '/records/new-zealand/chases' },
    ],
    timeline: [
      { year: 2015, title: 'First World Cup final', description: 'Led by Brendon McCullum.' },
      { year: 2021, title: 'World Test Champions', description: 'Defeated India in Southampton.' },
    ],
    newsTags: ['new-zealand', 'blackcaps', 'nz-vs-aus'],
  },
  {
    slug: 'south-africa',
    name: 'South Africa',
    shortName: 'SA',
    matchKey: 'SA',
    flag: 'https://flagcdn.com/w40/za.png',
    heroImage: 'https://images.unsplash.com/photo-1499028344343-cd173ffc68a9?auto=format&fit=crop&w=1600&q=80',
    summary: 'The Proteas thrive on fast-bowling depth, dynamic all-rounders, and an athletic fielding identity.',
    board: 'Cricket South Africa',
    coach: 'Rob Walter / Shukri Conrad',
    captains: { test: 'Temba Bavuma', odi: 'Temba Bavuma', t20: 'Aiden Markram' },
    ranking: { test: 4, odi: 6, t20: 5 },
    firstTestYear: 1889,
    colors: { primary: '#006341', secondary: '#ffcc29', accent: '#ffffff' },
    fanPulse: { rating: 4.2, votes: 6890 },
    iccTitles: [
      { name: 'ICC Champions Trophy', year: 1998 },
    ],
    keyPlayers: [
      { name: 'Kagiso Rabada', role: 'Bowler', spotlight: 'Strike bowler across formats', stats: { matches: 192, wickets: 460, average: 24.7 } },
      { name: 'Aiden Markram', role: 'Batter', spotlight: 'Aggressive opener & T20 captain', stats: { matches: 164, runs: 7200, strikeRate: 92.1 } },
    ],
    statLeaders: {
      batting: [
        { name: 'Quinton de Kock', runs: 10950, innings: 255, average: 44.7, strikeRate: 96.1, description: 'Explosive wicketkeeper' },
        { name: 'Aiden Markram', runs: 4200, innings: 118, average: 38.0, strikeRate: 90.4, description: 'Modern aggressor' },
      ],
      bowling: [
        { name: 'Kagiso Rabada', wickets: 460, innings: 250, average: 24.7, economy: 3.6, description: 'Pace spearhead' },
        { name: 'Tabraiz Shamsi', wickets: 162, innings: 120, average: 25.4, economy: 6.3, description: 'Left-arm wrist spin' },
      ],
    },
    recordLinks: [
      { label: 'Fastest ODI chases', url: '/records/south-africa/chases' },
      { label: 'All-time wicket charts', url: '/records/south-africa/wickets' },
    ],
    timeline: [
      { year: 1992, title: 'Return from isolation', description: 'Re-entered international cricket.' },
      { year: 2023, title: 'Reached ODI WC semi-finals', description: 'Dynamic campaign in India.' },
    ],
    newsTags: ['south-africa', 'proteas', 'sa-vs-aus'],
  },
  {
    slug: 'bangladesh',
    name: 'Bangladesh',
    shortName: 'BAN',
    matchKey: 'BAN',
    flag: 'https://flagcdn.com/w40/bd.png',
    heroImage: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80',
    summary: 'A fearless white-ball outfit built on spin depth, clever batting anchors, and raucous home support.',
    board: 'Bangladesh Cricket Board (BCB)',
    coach: 'Chandika Hathurusingha',
    captains: { test: 'Najmul Hossain Shanto', odi: 'Najmul Hossain Shanto', t20: 'Najmul Hossain Shanto' },
    ranking: { test: 9, odi: 7, t20: 9 },
    firstTestYear: 2000,
    colors: { primary: '#006a4e', secondary: '#f42a41', accent: '#ffd700' },
    fanPulse: { rating: 4.1, votes: 8123 },
    iccTitles: [],
    keyPlayers: [
      { name: 'Shakib Al Hasan', role: 'All-rounder', spotlight: 'Global benchmark all-rounder', stats: { matches: 427, runs: 14000, wickets: 680 } },
      { name: 'Taskin Ahmed', role: 'Bowler', spotlight: 'Hit-the-deck enforcer', stats: { matches: 120, wickets: 190 } },
    ],
    statLeaders: {
      batting: [
        { name: 'Shakib Al Hasan', runs: 7384, innings: 250, average: 37.7, strikeRate: 86.4, description: 'All-round excellence' },
        { name: 'Najmul Hossain Shanto', runs: 2103, innings: 80, average: 35.7, strikeRate: 82.1, description: 'Emerging leader' },
      ],
      bowling: [
        { name: 'Mustafizur Rahman', wickets: 269, innings: 190, average: 27.3, economy: 5.2, description: 'Cutter specialist' },
        { name: 'Mehidy Hasan Miraz', wickets: 245, innings: 150, average: 28.1, economy: 4.4, description: 'Powerplay off-spin' },
      ],
    },
    recordLinks: [
      { label: 'Historic ODI wins', url: '/records/bangladesh/odi-upsets' },
      { label: 'Bangladesh spin archive', url: '/features/bangladesh/spin' },
    ],
    timeline: [
      { year: 1997, title: 'ICC Trophy champions', description: 'Earned World Cup qualification.' },
      { year: 2015, title: 'Quarter-finalists in WC', description: 'Breakthrough global run.' },
    ],
    newsTags: ['bangladesh', 'bcb', 'ban-vs-ind'],
  },
  {
    slug: 'sri-lanka',
    name: 'Sri Lanka',
    shortName: 'SL',
    matchKey: 'SL',
    flag: 'https://flagcdn.com/w40/lk.png',
    heroImage: 'https://images.unsplash.com/photo-1457084882212-4a6bb2240588?auto=format&fit=crop&w=1600&q=80',
    summary: 'Crafty spinners, wristy batters, and a history of tournament upsets keep Sri Lanka dangerous in every format.',
    board: 'Sri Lanka Cricket (SLC)',
    coach: 'Chris Silverwood',
    captains: { test: 'Dhananjaya de Silva', odi: 'Kusal Mendis', t20: 'Wanindu Hasaranga' },
    ranking: { test: 8, odi: 8, t20: 8 },
    firstTestYear: 1982,
    colors: { primary: '#001f5b', secondary: '#f4b40f', accent: '#f25c19' },
    fanPulse: { rating: 4.0, votes: 6900 },
    iccTitles: [
      { name: 'ICC Cricket World Cup', year: 1996 },
      { name: 'ICC Champions Trophy', year: 2002 },
      { name: 'ICC T20 World Cup', year: 2014 },
    ],
    keyPlayers: [
      { name: 'Wanindu Hasaranga', role: 'All-rounder', spotlight: 'World-class leg-spin & finisher', stats: { matches: 120, runs: 1840, wickets: 220 } },
      { name: 'Pathum Nissanka', role: 'Batter', spotlight: 'Reliable top-order presence', stats: { matches: 85, runs: 3200, average: 41.2 } },
    ],
    statLeaders: {
      batting: [
        { name: 'Kusal Mendis', runs: 7560, innings: 220, average: 37.5, strikeRate: 85.3, description: 'Middle-order glue' },
        { name: 'Charith Asalanka', runs: 3080, innings: 110, average: 34.2, strikeRate: 90.4, description: 'Left-handed aggression' },
      ],
      bowling: [
        { name: 'Wanindu Hasaranga', wickets: 220, innings: 150, average: 21.9, economy: 6.3, description: 'World-leading wrist spin' },
        { name: 'Dilshan Madushanka', wickets: 74, innings: 46, average: 25.8, economy: 5.3, description: 'Emerging quick' },
      ],
    },
    recordLinks: [
      { label: 'Murali’s 800 test wickets', url: '/records/sri-lanka/muralitharan' },
      { label: 'Mastery in Asia Cups', url: '/records/sri-lanka/asia-cup' },
    ],
    timeline: [
      { year: 1996, title: 'World Cup win', description: 'Sanath & Aravinda redefined ODI batting.' },
      { year: 2014, title: 'T20 World Champions', description: 'Sangakkara signed off in style.' },
    ],
    newsTags: ['sri-lanka', 'slc', 'sl-vs-pak'],
  },
  {
    slug: 'west-indies',
    name: 'West Indies',
    shortName: 'WI',
    matchKey: 'WI',
    flag: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/Flag_of_the_West_Indies_Cricket_Board.svg/200px-Flag_of_the_West_Indies_Cricket_Board.svg.png',
    heroImage: 'https://images.unsplash.com/photo-1471295253337-3ceaaedca402?auto=format&fit=crop&w=1600&q=80',
    summary: 'Two-time world champions with unmatched T20 swagger and a proud legacy of fast bowling greats.',
    board: 'Cricket West Indies (CWI)',
    coach: 'Daren Sammy',
    captains: { test: 'Kraigg Brathwaite', odi: 'Shai Hope', t20: 'Rovman Powell' },
    ranking: { test: 7, odi: 9, t20: 7 },
    firstTestYear: 1928,
    colors: { primary: '#7f0f3a', secondary: '#00a0c6', accent: '#fdd33c' },
    fanPulse: { rating: 4.2, votes: 7201 },
    iccTitles: [
      { name: 'ICC Cricket World Cup', year: 1975 },
      { name: 'ICC Cricket World Cup', year: 1979 },
      { name: 'ICC T20 World Cup', year: 2012 },
      { name: 'ICC T20 World Cup', year: 2016 },
    ],
    keyPlayers: [
      { name: 'Nicholas Pooran', role: 'Batter', spotlight: 'Six-hitting middle order', stats: { matches: 150, runs: 4400, strikeRate: 136.0 } },
      { name: 'Alzarri Joseph', role: 'Bowler', spotlight: 'High-pace strike weapon', stats: { matches: 120, wickets: 210 } },
    ],
    statLeaders: {
      batting: [
        { name: 'Shai Hope', runs: 5200, innings: 135, average: 49.3, strikeRate: 81.2, description: 'ODI consistency' },
        { name: 'Nicholas Pooran', runs: 4400, innings: 150, average: 34.0, strikeRate: 136.0, description: 'T20 finisher' },
      ],
      bowling: [
        { name: 'Alzarri Joseph', wickets: 210, innings: 150, average: 26.0, economy: 6.1, description: 'Hit-the-deck pace' },
        { name: 'Gudakesh Motie', wickets: 78, innings: 40, average: 20.1, economy: 4.3, description: 'Left-arm spin resurgence' },
      ],
    },
    recordLinks: [
      { label: 'Calypso greats', url: '/features/west-indies/greats' },
      { label: 'T20 World Cup 2016', url: '/features/west-indies/t20-2016' },
    ],
    timeline: [
      { year: 1975, title: 'First World Cup champions', description: 'Clive Lloyd’s men set the standard.' },
      { year: 2016, title: 'T20 World Cup double', description: 'Second title sealed in Kolkata.' },
    ],
    newsTags: ['west-indies', 'cwi', 'wi-vs-eng'],
  },
  {
    slug: 'afghanistan',
    name: 'Afghanistan',
    shortName: 'AFG',
    matchKey: 'AFG',
    flag: 'https://flagcdn.com/w40/af.png',
    heroImage: 'https://images.unsplash.com/photo-1476231682828-37e571bc172f?auto=format&fit=crop&w=1600&q=80',
    summary: 'A whirlwind rise powered by Rashid Khan’s spin, fearless batters, and disciplined seam bowlers.',
    board: 'Afghanistan Cricket Board',
    coach: 'Jonathan Trott',
    captains: { test: 'Hashmatullah Shahidi', odi: 'Hashmatullah Shahidi', t20: 'Rashid Khan' },
    ranking: { test: 10, odi: 8, t20: 10 },
    firstTestYear: 2018,
    colors: { primary: '#0b4da2', secondary: '#d71920', accent: '#1a9f29' },
    fanPulse: { rating: 4.5, votes: 9340 },
    iccTitles: [],
    keyPlayers: [
      { name: 'Rashid Khan', role: 'All-rounder', spotlight: 'Global T20 superstar', stats: { matches: 180, runs: 1700, wickets: 312 } },
      { name: 'Rahmanullah Gurbaz', role: 'Batter', spotlight: 'Explosive opener', stats: { matches: 78, runs: 2300, strikeRate: 132.5 } },
    ],
    statLeaders: {
      batting: [
        { name: 'Ibrahim Zadran', runs: 2320, innings: 62, average: 44.7, strikeRate: 85.0, description: 'ODI stabiliser' },
        { name: 'Rahmanullah Gurbaz', runs: 2300, innings: 78, average: 34.8, strikeRate: 132.5, description: 'Powerplay damage' },
      ],
      bowling: [
        { name: 'Rashid Khan', wickets: 312, innings: 196, average: 18.4, economy: 4.7, description: 'Gold-standard leg-spin' },
        { name: 'Fazalhaq Farooqi', wickets: 136, innings: 88, average: 23.1, economy: 5.3, description: 'Left-arm swing' },
      ],
    },
    recordLinks: [
      { label: 'World Cup 2023 heroics', url: '/features/afghanistan/wc2023' },
      { label: 'Rise of Rashid', url: '/features/rashid-khan' },
    ],
    timeline: [
      { year: 2015, title: 'First ODI World Cup win', description: 'Beat Scotland in Dunedin.' },
      { year: 2023, title: 'Giant-killing World Cup run', description: 'Wins over ENG, PAK, SL.' },
    ],
    newsTags: ['afghanistan', 'rashid-khan', 'afg-vs-pak'],
  },
  {
    slug: 'ireland',
    name: 'Ireland',
    shortName: 'IRE',
    matchKey: 'IRE',
    flag: 'https://flagcdn.com/w40/ie.png',
    heroImage: 'https://images.unsplash.com/photo-1507537297725-24a1c029d3ca?auto=format&fit=crop&w=1600&q=80',
    summary: 'Bold batting and skilful seam bowling keep Ireland competitive, especially in ICC tournaments.',
    board: 'Cricket Ireland',
    coach: 'Heinrich Malan',
    captains: { test: 'Andrew Balbirnie', odi: 'Andrew Balbirnie', t20: 'Paul Stirling' },
    ranking: { test: 12, odi: 11, t20: 12 },
    firstTestYear: 2018,
    colors: { primary: '#1b6f50', secondary: '#f7941d', accent: '#ffffff' },
    fanPulse: { rating: 3.9, votes: 3120 },
    iccTitles: [],
    keyPlayers: [
      { name: 'Paul Stirling', role: 'Batter', spotlight: 'Powerplay six-hitter', stats: { matches: 330, runs: 9300, strikeRate: 95.0 } },
      { name: 'Josh Little', role: 'Bowler', spotlight: 'Left-arm pace', stats: { matches: 120, wickets: 180 } },
    ],
    statLeaders: {
      batting: [
        { name: 'Paul Stirling', runs: 9300, innings: 310, average: 33.0, strikeRate: 95.0, description: 'Leading run-scorer' },
        { name: 'Harry Tector', runs: 2300, innings: 70, average: 48.0, strikeRate: 86.1, description: 'Middle-order rock' },
      ],
      bowling: [
        { name: 'Josh Little', wickets: 180, innings: 140, average: 25.8, economy: 6.5, description: 'IPL-proven seamer' },
        { name: 'Mark Adair', wickets: 142, innings: 120, average: 27.0, economy: 7.2, description: 'New-ball/ death option' },
      ],
    },
    recordLinks: [
      { label: 'Historic upsets', url: '/records/ireland/upsets' },
      { label: 'Stirling assault reels', url: '/features/paul-stirling' },
    ],
    timeline: [
      { year: 2007, title: 'WC group-stage shock', description: 'Famous win over Pakistan.' },
      { year: 2011, title: 'Kevin O’Brien blitz', description: 'Beat England with fastest WC hundred.' },
    ],
    newsTags: ['ireland', 'ire-vs-eng', 'paul-stirling'],
  },
  {
    slug: 'zimbabwe',
    name: 'Zimbabwe',
    shortName: 'ZIM',
    matchKey: 'ZIM',
    flag: 'https://flagcdn.com/w40/zw.png',
    heroImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80',
    summary: 'Resilient cricket culture built on technically correct batters and wily seam-bowling units.',
    board: 'Zimbabwe Cricket',
    coach: 'Dave Houghton',
    captains: { test: 'Sean Williams', odi: 'Sikandar Raza', t20: 'Sikandar Raza' },
    ranking: { test: 11, odi: 13, t20: 11 },
    firstTestYear: 1992,
    colors: { primary: '#006600', secondary: '#ffcc00', accent: '#d90000' },
    fanPulse: { rating: 3.8, votes: 2980 },
    iccTitles: [],
    keyPlayers: [
      { name: 'Sikandar Raza', role: 'All-rounder', spotlight: 'Heartbeat of the side', stats: { matches: 250, runs: 6400, wickets: 195 } },
      { name: 'Blessing Muzarabani', role: 'Bowler', spotlight: 'Bounce and seam', stats: { matches: 90, wickets: 140 } },
    ],
    statLeaders: {
      batting: [
        { name: 'Sikandar Raza', runs: 6400, innings: 210, average: 36.0, strikeRate: 88.8, description: 'Carrying the batting' },
        { name: 'Craig Ervine', runs: 5600, innings: 180, average: 34.5, strikeRate: 83.0, description: 'Experienced left-hander' },
      ],
      bowling: [
        { name: 'Blessing Muzarabani', wickets: 140, innings: 110, average: 29.5, economy: 5.4, description: 'Tall quick' },
        { name: 'Richard Ngarava', wickets: 96, innings: 80, average: 30.1, economy: 5.7, description: 'Left-arm variation' },
      ],
    },
    recordLinks: [
      { label: '1999 WC memories', url: '/records/zimbabwe/wc1999' },
      { label: 'Flower brothers archive', url: '/features/zimbabwe/flower' },
    ],
    timeline: [
      { year: 1999, title: 'Super Six finish', description: 'Golden generation peaked.' },
      { year: 2022, title: 'T20 World Cup main draw', description: 'Upset Pakistan in Perth.' },
    ],
    newsTags: ['zimbabwe', 'zim-vs-ire', 'sikandar-raza'],
  },
];

async function seedTeams() {
  await connectDatabase();

  for (const team of teamSeeds) {
    await CricketTeam.findOneAndUpdate(
      { slug: team.slug },
      team,
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    // eslint-disable-next-line no-console
    console.log(`Seeded team hub: ${team.name}`);
  }

  await disconnectDatabase();
}

seedTeams().catch(async (error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  await disconnectDatabase();
  process.exit(1);
});

