export interface RomanticQuote {
  id: number;
  text: string;
  author: string;
  mood: string;
}

export const DAILY_ROMANTIC_MESSAGES: RomanticQuote[] = [
  {
    id: 0,
    text: "In a room full of art, I would still stare at you — every single lifetime.",
    author: "Daily Love Note",
    mood: "Devotion",
  },
  {
    id: 1,
    text: "Home was never a place on a map for me; it began the moment you held my hand.",
    author: "Forever Us",
    mood: "Sanctuary",
  },
  {
    id: 2,
    text: "Whatever our souls are made of, yours and mine are stitched from the same starlight.",
    author: "Evening Whisper",
    mood: "Soulmates",
  },
  {
    id: 3,
    text: "My favorite sound in the entire world is still your laugh echoing across our kitchen.",
    author: "Morning Coffee Note",
    mood: "Everyday Magic",
  },
  {
    id: 4,
    text: "If I had a single rose for every time you crossed my mind today, I would be walking through an endless garden.",
    author: "Rose Garden",
    mood: "Adoration",
  },
  {
    id: 5,
    text: "You are my quiet harbor on stormy nights and my favorite adventure at sunrise.",
    author: "Vows Revisited",
    mood: "Promise",
  },
  {
    id: 6,
    text: "Growing old with you is the sweetest dream I ever got to wake up inside.",
    author: "Timeless",
    mood: "Forever",
  },
  {
    id: 7,
    text: "Even a thousand ordinary Tuesdays become extraordinary just because I spend them beside you.",
    author: "Little Joys",
    mood: "Gratitude",
  },
  {
    id: 8,
    text: "Every love story is beautiful, yet ours feels like a private universe built only for two.",
    author: "Two Hearts",
    mood: "Intimacy",
  },
  {
    id: 9,
    text: "I loved you yesterday, I adore you more this morning, and I choose you in every tomorrow.",
    author: "Sacred Promise",
    mood: "Always",
  },
];

export interface StickerItem {
  id: string;
  label: string;
  emoji: string;
  subtitle: string;
  gradient: string;
}

export const COUPLE_STICKERS: StickerItem[] = [
  {
    id: "forever-yours",
    label: "Forever Yours",
    emoji: "💖",
    subtitle: "Always & only you",
    gradient: "from-rose-500 to-purple-700",
  },
  {
    id: "million-kisses",
    label: "Sending Kisses",
    emoji: "💋",
    subtitle: "Right to your cheeks",
    gradient: "from-pink-500 to-rose-600",
  },
  {
    id: "warm-embrace",
    label: "Tight Hug",
    emoji: "🫂",
    subtitle: "Hold me close",
    gradient: "from-fuchsia-500 to-purple-800",
  },
  {
    id: "red-roses",
    label: "Bouquet For You",
    emoji: "🌹",
    subtitle: "Freshly picked love",
    gradient: "from-red-500 to-pink-600",
  },
  {
    id: "miss-you",
    label: "Missing You",
    emoji: "🥺",
    subtitle: "Come home soon",
    gradient: "from-violet-500 to-indigo-700",
  },
  {
    id: "coffee-date",
    label: "Coffee Together?",
    emoji: "☕",
    subtitle: "Two lattes, one table",
    gradient: "from-amber-500 to-rose-600",
  },
  {
    id: "date-night",
    label: "Date Night!",
    emoji: "🥂",
    subtitle: "Dress up tonight",
    gradient: "from-purple-600 to-pink-600",
  },
  {
    id: "love-letter",
    label: "My Soulmate",
    emoji: "💌",
    subtitle: "Sealed with love",
    gradient: "from-rose-400 to-fuchsia-600",
  },
  {
    id: "good-morning",
    label: "Good Morning Love",
    emoji: "🌅",
    subtitle: "Shine bright today",
    gradient: "from-orange-400 to-pink-600",
  },
  {
    id: "goodnight-moon",
    label: "Sweet Dreams",
    emoji: "🌙",
    subtitle: "Meet me in my dreams",
    gradient: "from-indigo-700 to-purple-900",
  },
  {
    id: "butterflies",
    label: "Still Give Me Butterflies",
    emoji: "🦋",
    subtitle: "Like our first date",
    gradient: "from-pink-500 to-violet-600",
  },
  {
    id: "my-crown",
    label: "My Everything",
    emoji: "👑",
    subtitle: "Ruler of my heart",
    gradient: "from-rose-500 to-amber-500",
  },
];

export const ROMANTIC_QUESTION_DECK: Array<{ prompt: string; category: string }> = [
  {
    prompt: "What was the exact moment you knew beyond a shadow of a doubt that you wanted to marry me?",
    category: "Deep Love",
  },
  {
    prompt: "If we could teleport anywhere tomorrow for a private 48-hour second honeymoon, where would we wake up?",
    category: "Future Dreams",
  },
  {
    prompt: "Which small everyday habit of mine secretly makes your heart melt every time?",
    category: "Little Joys",
  },
  {
    prompt: "What memory from our first year together do you replay most often when you miss me?",
    category: "Sweet Memories",
  },
  {
    prompt: "What song instantly reminds you of us, and what scene plays in your head when you hear it?",
    category: "Sweet Memories",
  },
  {
    prompt: "When we are eighty years old sitting on our porch together, what do you think we will still be laughing about?",
    category: "Future Dreams",
  },
  {
    prompt: "How do I make you feel most loved on days when the world feels overwhelming?",
    category: "Deep Love",
  },
  {
    prompt: "What is one dream adventure on your bucket list that you want us to cross off this year?",
    category: "Future Dreams",
  },
  {
    prompt: "What was going through your head during our very first photo together?",
    category: "Sweet Memories",
  },
  {
    prompt: "Describe your ideal unplugged Sunday with me from sunrise to midnight.",
    category: "Little Joys",
  },
  {
    prompt: "What is a compliment I once gave you that you still carry in your heart today?",
    category: "Deep Love",
  },
  {
    prompt: "If our love story were turned into a film, which scene would be the audience's favorite?",
    category: "Sweet Memories",
  },
];

export interface TruthOrDareCard {
  type: "truth" | "dare";
  tier: "Sweet" | "Romantic" | "Deep";
  prompt: string;
}

export const TRUTH_OR_DARE_DECK: TruthOrDareCard[] = [
  {
    type: "truth",
    tier: "Sweet",
    prompt: "What was your very first unspoken impression of me within ten seconds of meeting?",
  },
  {
    type: "truth",
    tier: "Sweet",
    prompt: "Which outfit of mine is your absolute favorite to see me wear on date night?",
  },
  {
    type: "truth",
    tier: "Sweet",
    prompt: "When was the last time you caught yourself smiling at your phone because of a message I sent?",
  },
  {
    type: "truth",
    tier: "Romantic",
    prompt: "What is your favorite kiss we have ever shared, and where were we standing?",
  },
  {
    type: "truth",
    tier: "Romantic",
    prompt: "What is a romantic surprise you have secretly daydreamed about planning for me?",
  },
  {
    type: "truth",
    tier: "Romantic",
    prompt: "What detail about my eyes, voice, or smile makes you fall in love all over again?",
  },
  {
    type: "truth",
    tier: "Deep",
    prompt: "In what way has loving me changed you into a braver or gentler person?",
  },
  {
    type: "truth",
    tier: "Deep",
    prompt: "What vow would you add today if we renewed our wedding promises under the stars tonight?",
  },
  {
    type: "truth",
    tier: "Deep",
    prompt: "When did you feel closest and most deeply understood by me this past month?",
  },
  {
    type: "dare",
    tier: "Sweet",
    prompt: "Record a 15-second voice note in our Private Chat telling me three adorable things you noticed about me recently.",
  },
  {
    type: "dare",
    tier: "Sweet",
    prompt: "Upload your favorite candid photo of us to our Shared Memories gallery with a poetic caption.",
  },
  {
    type: "dare",
    tier: "Sweet",
    prompt: "Plan our next dessert or coffee date right now and add it to our Shared Calendar.",
  },
  {
    type: "dare",
    tier: "Romantic",
    prompt: "Put on our favorite slow song and dance with me in the living room for three uninterrupted minutes tonight.",
  },
  {
    type: "dare",
    tier: "Romantic",
    prompt: "Send me a sealed Surprise Message in the Love Zone containing a heartfelt mini love letter.",
  },
  {
    type: "dare",
    tier: "Romantic",
    prompt: "Call me on video right now just to blow me a kiss and tell me what you're looking forward to tonight.",
  },
  {
    type: "dare",
    tier: "Deep",
    prompt: "Look into my eyes for sixty quiet seconds the next time we're together and then tell me one wish for our future.",
  },
  {
    type: "dare",
    tier: "Deep",
    prompt: "Write down five promises for our next anniversary and share them in our private chat.",
  },
];

export const QUICK_EMOJIS = [
  "❤️", "😘", "🥰", "😍", "🌹", "💋", "🫂", "✨",
  "💕", "💖", "🥹", "😊", "😂", "🔥", "🥂", "🌙",
  "💐", "🦋", "💌", "👑", "🍓", "☕", "🎶", "💍",
];

export const REACTION_EMOJIS = ["❤️", "😍", "😘", "🌹", "🥹", "😂", "🔥"];

export const STARTER_CHALLENGES = [
  {
    title: "Candlelit Phone-Free Dinner",
    description: "Cook a favorite meal together at home, light two candles, and keep phones tucked away all evening.",
    category: "Date Night",
    points: 40,
  },
  {
    title: "Golden Hour Walk Hand-in-Hand",
    description: "Take a 30-minute sunset stroll together and capture one new photo for our Memories gallery.",
    category: "Romance",
    points: 25,
  },
  {
    title: "Three Gratitude Voice Notes",
    description: "Leave your spouse a spontaneous voice message sharing three reasons you adore them today.",
    category: "Communication",
    points: 30,
  },
  {
    title: "Recreate Our First Date",
    description: "Revisit the flavor, music, or place from our very first date and toast to how far we've come.",
    category: "Date Night",
    points: 50,
  },
  {
    title: "Breakfast in Bed Surprise",
    description: "Wake up 20 minutes early on the weekend to bring warm coffee and a handwritten sticky note.",
    category: "Romance",
    points: 35,
  },
];
