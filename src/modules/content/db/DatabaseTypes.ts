import type {
  Arrangement, ArrangementKey, BibleBook, BibleChapter, BibleLookup,
  BibleTranslation, BibleVerse, BibleVerseText, Block, CalendarBlockout,
  CuratedCalendar, CuratedEvent, Element, Event, EventBooking, EventException,
  File, GlobalStyle, Link, Page, PageHistory, Playlist, Registration,
  RegistrationMember, Resource, Room, Section, Sermon, Setting, Song,
  SongDetail, SongDetailLink, StreamingService
} from "../models/index.js";

export interface ContentDatabase {
  arrangements: Arrangement;
  arrangementKeys: ArrangementKey;
  bibleBooks: BibleBook;
  bibleChapters: BibleChapter;
  bibleLookups: BibleLookup;
  bibleTranslations: Omit<BibleTranslation, "countryList">;
  bibleVerses: BibleVerse;
  bibleVerseTexts: BibleVerseText;
  blocks: Omit<Block, "sections">;
  calendarBlockouts: CalendarBlockout;
  curatedCalendars: CuratedCalendar;
  curatedEvents: CuratedEvent;
  elements: Omit<Element, "answers" | "styles" | "animations" | "elements">;
  events: Omit<Event, "exceptionDates">;
  eventBookings: EventBooking;
  eventExceptions: EventException;
  files: Omit<File, "fileContents">;
  globalStyles: GlobalStyle;
  links: Link;
  pages: Omit<Page, "sections">;
  pageHistory: PageHistory;
  playlists: Playlist;
  registrations: Omit<Registration, "members">;
  registrationMembers: RegistrationMember;
  resources: Resource;
  rooms: Room;
  sections: Omit<Section, "answers" | "styles" | "animations" | "elements" | "sections">;
  sermons: Sermon;
  settings: Setting;
  songs: Song;
  songDetails: SongDetail;
  songDetailLinks: SongDetailLink;
  streamingServices: StreamingService;
}
