export type Channel = "Instagram" | "TikTok" | "LinkedIn" | "YouTube";

export type ScheduleItem = {
  id: string;
  day: number;
  weekday: string;
  time: string;
  title: string;
  channel: Channel;
  status: "Entwurf" | "Freigabe" | "Geplant";
  image: string;
};

export const scheduleItems: ScheduleItem[] = [
  {
    id: "carousel-alpine",
    day: 24,
    weekday: "Mo",
    time: "09:00",
    title: "Carousel Post",
    channel: "Instagram",
    status: "Entwurf",
    image: "/media/alpine-lake.webp",
  },
  {
    id: "behind-scenes",
    day: 25,
    weekday: "Di",
    time: "15:30",
    title: "Behind-the-Scenes Reel",
    channel: "TikTok",
    status: "Geplant",
    image: "/media/creator-studio.webp",
  },
  {
    id: "tiktok-reel",
    day: 26,
    weekday: "Mi",
    time: "10:30",
    title: "TikTok-Reel",
    channel: "TikTok",
    status: "Freigabe",
    image: "/media/team-studio.webp",
  },
  {
    id: "story-series",
    day: 27,
    weekday: "Do",
    time: "17:00",
    title: "Story-Serie",
    channel: "Instagram",
    status: "Geplant",
    image: "/media/alpine-lake.webp",
  },
  {
    id: "team-update",
    day: 28,
    weekday: "Fr",
    time: "12:00",
    title: "Team-Update Post",
    channel: "LinkedIn",
    status: "Geplant",
    image: "/media/team-studio.webp",
  },
  {
    id: "tips-reel",
    day: 29,
    weekday: "Sa",
    time: "19:30",
    title: "Tipps & Tricks Reel",
    channel: "TikTok",
    status: "Geplant",
    image: "/media/design-studio.webp",
  },
];

export const weekdays = [
  { short: "Mo", day: 24 },
  { short: "Di", day: 25 },
  { short: "Mi", day: 26 },
  { short: "Do", day: 27 },
  { short: "Fr", day: 28 },
  { short: "Sa", day: 29 },
  { short: "So", day: 30 },
];
