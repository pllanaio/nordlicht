export type Channel = "Instagram" | "TikTok" | "LinkedIn" | "YouTube";
export type ScheduleStatus = "Entwurf" | "Freigabe" | "Geplant";

export type ScheduleItem = {
  id: string;
  date: string;
  time: string;
  title: string;
  caption: string;
  channel: Channel;
  status: ScheduleStatus;
  image: string;
};

export const calendarAnchorDate = "2026-08-24";

export const scheduleItems: ScheduleItem[] = [
  {
    id: "carousel-alpine",
    date: "2026-08-24",
    time: "09:00",
    title: "Carousel Post",
    caption: "Drei Perspektiven, ein klarer Gedanke: Gute Markeninhalte beginnen mit einer Geschichte, die Menschen wirklich mitnimmt.",
    channel: "Instagram",
    status: "Entwurf",
    image: "/media/alpine-lake.webp",
  },
  {
    id: "behind-scenes",
    date: "2026-08-25",
    time: "15:30",
    title: "Behind-the-Scenes Reel",
    caption: "Ein Blick hinter die Kulissen von Nordlicht Studio – von der ersten Skizze bis zum finalen Schnitt.",
    channel: "TikTok",
    status: "Geplant",
    image: "/media/creator-studio.webp",
  },
  {
    id: "tiktok-video",
    date: "2026-08-26",
    time: "10:30",
    title: "TikTok-Video",
    caption: "So wird aus einer ruhigen Idee ein kurzer Clip mit einem starken Einstieg und einer klaren Botschaft.",
    channel: "TikTok",
    status: "Freigabe",
    image: "/media/team-studio.webp",
  },
  {
    id: "story-series",
    date: "2026-08-27",
    time: "17:00",
    title: "Story-Serie",
    caption: "Heute nehmen wir euch in drei kurzen Stories mit durch unseren kreativen Prozess.",
    channel: "Instagram",
    status: "Geplant",
    image: "/media/alpine-lake.webp",
  },
  {
    id: "team-update",
    date: "2026-08-28",
    time: "12:00",
    title: "Team-Update Post",
    caption: "Diese Woche haben wir neue Workflows getestet, Feedback ausgewertet und unseren Content-Prozess weiter vereinfacht.",
    channel: "LinkedIn",
    status: "Geplant",
    image: "/media/team-studio.webp",
  },
  {
    id: "tips-reel",
    date: "2026-08-29",
    time: "19:30",
    title: "Tipps & Tricks Reel",
    caption: "Drei einfache Handgriffe, mit denen deine nächsten Kurzvideos klarer, schneller und wirkungsvoller werden.",
    channel: "TikTok",
    status: "Geplant",
    image: "/media/design-studio.webp",
  },
];
