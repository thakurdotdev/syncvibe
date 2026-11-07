// Artwork for the landing page. The demo room is silent, so nothing here points at audio.
const cover = (path) => `https://c.saavncdn.com/${path}-500x500.jpg`;

const KHILADI = cover('485/Khiladi-786-Hindi-2012-20221213035019');

// The same room as the screenshots on the page, so the demo and the real app agree.
export const DEMO_PLAYLIST = [
  {
    id: 'hookah-bar',
    name: 'Hookah Bar',
    artists: 'Himesh Reshammiya',
    addedBy: 'Pankaj Thakur',
    cover: KHILADI,
    duration: 254,
  },
  {
    id: 'khiladi-title-track',
    name: 'Khiladi Title Track',
    artists: 'Vineet Singh',
    addedBy: 'Autoplay',
    cover: KHILADI,
    duration: 254,
  },
  {
    id: 'main-woh-chaand',
    name: 'Main Woh Chaand',
    artists: 'Darshan Raval',
    addedBy: 'Autoplay',
    cover: cover('042/Teraa-Surroor-Hindi-2016'),
    duration: 322,
  },
  {
    id: 'lonely',
    name: 'Lonely',
    artists: 'Himesh Reshammiya',
    addedBy: 'Autoplay',
    cover: KHILADI,
    duration: 248,
  },
  {
    id: 'jumme-ki-raat',
    name: 'Jumme Ki Raat, Pt. 1',
    artists: 'Himesh Reshammiya',
    addedBy: 'Autoplay',
    cover: cover('801/Kick-Hindi-2014'),
    duration: 275,
  },
  {
    id: 'balma',
    name: 'Balma',
    artists: 'Shreya Ghoshal',
    addedBy: 'Autoplay',
    cover: KHILADI,
    duration: 227,
  },
  {
    id: 'tirat-meri-tu',
    name: 'Tirat Meri Tu',
    artists: 'Vineet Singh',
    addedBy: 'Autoplay',
    cover: cover('234/Policegiri-2013'),
    duration: 298,
  },
];

export const ART_STRIP = [
  '820/Awarapan-2-Hindi-2026-20260929184517',
  '738/Mirzapur-The-Movie-Hindi-2026-20260830233548',
  '978/Musafir-Cafe-Songs-from-the-Netflix-Series-Hindi-2026-20260727151003',
  '689/Cocktail-2-Hindi-2026-20260629161048',
  '257/Ae-Dil-Hai-Mushkil-Hindi-2016',
  '475/Dhurandhar-Hindi-2025-20260203083204',
  '179/Om-Shanti-Om-Hindi-2007-20241205141724',
  '786/Casa-Tupka-Anthemo-Hindi-2026-20260917173352',
  '307/Boom-Shaka-Hindi-2026-20260428064906',
  '732/Emraan-Hashmi-Sad-Love-Hits-Hindi-2026-20260604155755',
  '743/Desi-Boyz-Hindi-2011-20241223142123',
  '058/Hanuman-Ansh-Original-Motion-Picture-Soundtrack-Hindi-2026-20260710211303',
].map(cover);
