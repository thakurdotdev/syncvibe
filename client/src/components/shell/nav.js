import { Disc3, Library, MessageCircle, RadioTower } from 'lucide-react';
import { paths } from '@/lib/paths';

/**
 * Primary destinations, shared by the desktop sidebar and the mobile tab bar.
 * `match` decides which item is highlighted for nested routes.
 */
export const NAV_ITEMS = [
  {
    key: 'home',
    label: 'Listen',
    icon: Disc3,
    path: paths.home,
    match: (p) =>
      p === paths.home ||
      p.startsWith('/album/') ||
      p.startsWith('/artist/') ||
      p.startsWith('/playlist/'),
  },
  {
    key: 'rooms',
    label: 'Rooms',
    icon: RadioTower,
    path: paths.rooms,
    match: (p) => p.startsWith(paths.rooms),
  },
  {
    key: 'messages',
    label: 'Messages',
    icon: MessageCircle,
    path: paths.messages,
    match: (p) => p.startsWith(paths.messages),
  },
  {
    key: 'library',
    label: 'Library',
    icon: Library,
    path: paths.library,
    match: (p) => p.startsWith(paths.library),
  },
];

export const LOGO_URL =
  'https://res.cloudinary.com/dr7lkelwl/image/upload/v1793889692/profiles/profiles_6_1793889690_21ee9015425b6812.jpg';

export const FALLBACK_ART =
  'https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_200,w_200/f_auto/v1731395454/j6r5zemodfexdxid4gcx.png';
