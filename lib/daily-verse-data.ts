/** Curated featured verses — bundled offline pool (Room DB equivalent). */

export type DailyVerseTheme =
  | "love"
  | "faith"
  | "strength"
  | "hope"
  | "peace"
  | "wisdom"
  | "comfort"
  | "grace"
  | "trust"
  | "joy";

export type DailyVerse = {
  id: number;
  reference: string;
  text: string;
  book: string;
  theme: DailyVerseTheme;
  isFeatured: true;
};

/** Pre-populated featured pool (isFeatured = true). KJV text. */
export const FEATURED_DAILY_VERSES: readonly DailyVerse[] = [
  {
    id: 1,
    reference: "John 3:16",
    text: "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.",
    book: "John",
    theme: "love",
    isFeatured: true,
  },
  {
    id: 2,
    reference: "Romans 8:28",
    text: "And we know that all things work together for good to them that love God, to them who are the called according to his purpose.",
    book: "Romans",
    theme: "hope",
    isFeatured: true,
  },
  {
    id: 3,
    reference: "Philippians 4:13",
    text: "I can do all things through Christ which strengtheneth me.",
    book: "Philippians",
    theme: "strength",
    isFeatured: true,
  },
  {
    id: 4,
    reference: "Jeremiah 29:11",
    text: "For I know the thoughts that I think toward you, saith the Lord, thoughts of peace, and not of evil, to give you an expected end.",
    book: "Jeremiah",
    theme: "hope",
    isFeatured: true,
  },
  {
    id: 5,
    reference: "Proverbs 3:5–6",
    text: "Trust in the Lord with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.",
    book: "Proverbs",
    theme: "trust",
    isFeatured: true,
  },
  {
    id: 6,
    reference: "Isaiah 41:10",
    text: "Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness.",
    book: "Isaiah",
    theme: "strength",
    isFeatured: true,
  },
  {
    id: 7,
    reference: "Psalm 23:1",
    text: "The Lord is my shepherd; I shall not want.",
    book: "Psalm",
    theme: "peace",
    isFeatured: true,
  },
  {
    id: 8,
    reference: "Joshua 1:9",
    text: "Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the Lord thy God is with thee whithersoever thou goest.",
    book: "Joshua",
    theme: "strength",
    isFeatured: true,
  },
  {
    id: 9,
    reference: "Matthew 11:28",
    text: "Come unto me, all ye that labour and are heavy laden, and I will give you rest.",
    book: "Matthew",
    theme: "peace",
    isFeatured: true,
  },
  {
    id: 10,
    reference: "Psalm 119:105",
    text: "Thy word is a lamp unto my feet, and a light unto my path.",
    book: "Psalm",
    theme: "wisdom",
    isFeatured: true,
  },
  {
    id: 11,
    reference: "Philippians 4:6–7",
    text: "Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God. And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus.",
    book: "Philippians",
    theme: "peace",
    isFeatured: true,
  },
  {
    id: 12,
    reference: "Ephesians 2:8–9",
    text: "For by grace are ye saved through faith; and that not of yourselves: it is the gift of God: Not of works, lest any man should boast.",
    book: "Ephesians",
    theme: "grace",
    isFeatured: true,
  },
  {
    id: 13,
    reference: "2 Timothy 1:7",
    text: "For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind.",
    book: "2 Timothy",
    theme: "strength",
    isFeatured: true,
  },
  {
    id: 14,
    reference: "Isaiah 40:31",
    text: "But they that wait upon the Lord shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.",
    book: "Isaiah",
    theme: "hope",
    isFeatured: true,
  },
  {
    id: 15,
    reference: "Matthew 6:33",
    text: "But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you.",
    book: "Matthew",
    theme: "faith",
    isFeatured: true,
  },
  {
    id: 16,
    reference: "Psalm 46:1",
    text: "God is our refuge and strength, a very present help in trouble.",
    book: "Psalm",
    theme: "comfort",
    isFeatured: true,
  },
  {
    id: 17,
    reference: "Romans 5:8",
    text: "But God commendeth his love toward us, in that, while we were yet sinners, Christ died for us.",
    book: "Romans",
    theme: "love",
    isFeatured: true,
  },
  {
    id: 18,
    reference: "Hebrews 11:1",
    text: "Now faith is the substance of things hoped for, the evidence of things not seen.",
    book: "Hebrews",
    theme: "faith",
    isFeatured: true,
  },
  {
    id: 19,
    reference: "Psalm 27:1",
    text: "The Lord is my light and my salvation; whom shall I fear? the Lord is the strength of my life; of whom shall I be afraid?",
    book: "Psalm",
    theme: "strength",
    isFeatured: true,
  },
  {
    id: 20,
    reference: "Proverbs 18:10",
    text: "The name of the Lord is a strong tower: the righteous runneth into it, and is safe.",
    book: "Proverbs",
    theme: "strength",
    isFeatured: true,
  },
  {
    id: 21,
    reference: "Micah 6:8",
    text: "He hath shewed thee, O man, what is good; and what doth the Lord require of thee, but to do justly, and to love mercy, and to walk humbly with thy God?",
    book: "Micah",
    theme: "faith",
    isFeatured: true,
  },
  {
    id: 22,
    reference: "1 Peter 5:7",
    text: "Casting all your care upon him; for he careth for you.",
    book: "1 Peter",
    theme: "peace",
    isFeatured: true,
  },
  {
    id: 23,
    reference: "Deuteronomy 31:6",
    text: "Be strong and of a good courage, fear not, nor be afraid of them: for the Lord thy God, he it is that doth go with thee; he will not fail thee, nor forsake thee.",
    book: "Deuteronomy",
    theme: "strength",
    isFeatured: true,
  },
  {
    id: 24,
    reference: "Lamentations 3:22–23",
    text: "It is of the Lord's mercies that we are not consumed, because his compassions fail not. They are new every morning: great is thy faithfulness.",
    book: "Lamentations",
    theme: "hope",
    isFeatured: true,
  },
  {
    id: 25,
    reference: "John 14:27",
    text: "Peace I leave with you, my peace I give unto you: not as the world giveth, give I unto you. Let not your heart be troubled, neither let it be afraid.",
    book: "John",
    theme: "peace",
    isFeatured: true,
  },
  {
    id: 26,
    reference: "Psalm 37:4",
    text: "Delight thyself also in the Lord; and he shall give thee the desires of thine heart.",
    book: "Psalm",
    theme: "joy",
    isFeatured: true,
  },
  {
    id: 27,
    reference: "Colossians 3:23",
    text: "And whatsoever ye do, do it heartily, as to the Lord, and not unto men.",
    book: "Colossians",
    theme: "faith",
    isFeatured: true,
  },
  {
    id: 28,
    reference: "2 Corinthians 12:9",
    text: "And he said unto me, My grace is sufficient for thee: for my strength is made perfect in weakness.",
    book: "2 Corinthians",
    theme: "grace",
    isFeatured: true,
  },
  {
    id: 29,
    reference: "Nahum 1:7",
    text: "The Lord is good, a strong hold in the day of trouble; and he knoweth them that trust in him.",
    book: "Nahum",
    theme: "comfort",
    isFeatured: true,
  },
  {
    id: 30,
    reference: "Romans 15:13",
    text: "Now the God of hope fill you with all joy and peace in believing, that ye may abound in hope, through the power of the Holy Ghost.",
    book: "Romans",
    theme: "hope",
    isFeatured: true,
  },
  {
    id: 31,
    reference: "James 1:5",
    text: "If any of you lack wisdom, let him ask of God, that giveth to all men liberally, and upbraideth not; and it shall be given him.",
    book: "James",
    theme: "wisdom",
    isFeatured: true,
  },
  {
    id: 32,
    reference: "Psalm 55:22",
    text: "Cast thy burden upon the Lord, and he shall sustain thee: he shall never suffer the righteous to be moved.",
    book: "Psalm",
    theme: "trust",
    isFeatured: true,
  },
  {
    id: 33,
    reference: "1 John 4:19",
    text: "We love him, because he first loved us.",
    book: "1 John",
    theme: "love",
    isFeatured: true,
  },
  {
    id: 34,
    reference: "Galatians 2:20",
    text: "I am crucified with Christ: nevertheless I live; yet not I, but Christ liveth in me: and the life which I now live in the flesh I live by the faith of the Son of God, who loved me, and gave himself for me.",
    book: "Galatians",
    theme: "faith",
    isFeatured: true,
  },
  {
    id: 35,
    reference: "Psalm 34:18",
    text: "The Lord is nigh unto them that are of a broken heart; and saveth such as be of a contrite spirit.",
    book: "Psalm",
    theme: "comfort",
    isFeatured: true,
  },
];
