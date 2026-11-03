export interface EmojiCategory {
  id: string;
  label: string;
  icon: string;
  /** [emoji, search keywords] */
  emojis: ReadonlyArray<readonly [string, string]>;
}

export const EMOJI_CATEGORIES: ReadonlyArray<EmojiCategory> = [
  {
    id: "smileys",
    label: "Smileys",
    icon: "😀",
    emojis: [
      ["😀", "grin happy smile"], ["😃", "smile happy joy"], ["😄", "smile laugh happy"], ["😁", "beam grin"],
      ["😆", "laugh squint"], ["😅", "sweat laugh nervous"], ["😂", "joy tears laugh lol"], ["🤣", "rofl rolling laugh"],
      ["🙂", "slight smile"], ["🙃", "upside down"], ["😉", "wink"], ["😊", "blush smile"],
      ["😇", "angel halo innocent"], ["🥰", "love hearts adore"], ["😍", "heart eyes love"], ["🤩", "star struck wow"],
      ["😘", "kiss blow"], ["😋", "yum tasty"], ["😛", "tongue"], ["😜", "wink tongue silly"],
      ["🤪", "zany crazy"], ["🤗", "hug"], ["🤔", "think hmm"], ["🤨", "raised eyebrow suspicious"],
      ["😐", "neutral"], ["😑", "expressionless"], ["😶", "no mouth silent"], ["🙄", "eye roll"],
      ["😏", "smirk"], ["😒", "unamused"], ["😬", "grimace awkward"], ["😮‍💨", "exhale relief sigh"],
      ["😌", "relieved calm"], ["😔", "pensive sad"], ["😪", "sleepy"], ["😴", "sleep zzz"],
      ["🤒", "sick thermometer"], ["🤕", "hurt bandage"], ["🤢", "nauseated sick"], ["🥵", "hot"],
      ["🥶", "cold freezing"], ["😵", "dizzy"], ["🤯", "mind blown exploding"], ["🥳", "party celebrate"],
      ["😎", "cool sunglasses"], ["🤓", "nerd glasses"], ["😕", "confused"], ["😟", "worried"],
      ["😮", "surprised open mouth"], ["😲", "astonished"], ["😳", "flushed embarrassed"], ["🥺", "pleading puppy eyes"],
      ["😢", "cry sad tear"], ["😭", "sob crying"], ["😱", "scream fear"], ["😖", "confounded"],
      ["😞", "disappointed"], ["😤", "triumph huff"], ["😡", "angry mad"], ["😠", "angry"],
      ["🤬", "swearing cursing"], ["💀", "skull dead"], ["💩", "poop"], ["🤡", "clown"],
      ["👻", "ghost"], ["👽", "alien"], ["🤖", "robot bot"],
    ],
  },
  {
    id: "gestures",
    label: "People",
    icon: "👋",
    emojis: [
      ["👋", "wave hello hi"], ["🤚", "raised back hand"], ["✋", "hand stop high five"], ["🖖", "vulcan spock"],
      ["👌", "ok perfect"], ["🤌", "pinched fingers"], ["✌️", "peace victory"], ["🤞", "fingers crossed luck"],
      ["🤟", "love you gesture"], ["🤘", "rock on"], ["🤙", "call me shaka"], ["👈", "point left"],
      ["👉", "point right"], ["👆", "point up"], ["👇", "point down"], ["☝️", "index up"],
      ["👍", "thumbs up like yes"], ["👎", "thumbs down dislike no"], ["✊", "fist"], ["👊", "punch fist bump"],
      ["👏", "clap applause"], ["🙌", "raised hands celebrate"], ["👐", "open hands"], ["🤝", "handshake deal"],
      ["🙏", "pray thanks please"], ["💪", "muscle strong flex"], ["🧠", "brain"], ["👀", "eyes look"],
      ["👁️", "eye"], ["👅", "tongue"], ["👄", "mouth lips"], ["🫶", "heart hands"],
      ["🧑‍💻", "developer coder programmer"], ["👨‍💻", "man technologist"], ["👩‍💻", "woman technologist"], ["🕵️", "detective"],
      ["🤷", "shrug"], ["🤦", "facepalm"], ["🙋", "raising hand"], ["💁", "tipping hand"],
    ],
  },
  {
    id: "hearts",
    label: "Hearts",
    icon: "❤️",
    emojis: [
      ["❤️", "red heart love"], ["🧡", "orange heart"], ["💛", "yellow heart"], ["💚", "green heart"],
      ["💙", "blue heart"], ["💜", "purple heart"], ["🖤", "black heart"], ["🤍", "white heart"],
      ["🤎", "brown heart"], ["💔", "broken heart"], ["❣️", "heart exclamation"], ["💕", "two hearts"],
      ["💞", "revolving hearts"], ["💓", "beating heart"], ["💗", "growing heart"], ["💖", "sparkling heart"],
      ["💘", "heart arrow"], ["💝", "heart ribbon gift"], ["💯", "hundred perfect"], ["💢", "anger"],
      ["💥", "boom collision"], ["💫", "dizzy star"], ["✨", "sparkles shine"], ["🔥", "fire hot lit"],
    ],
  },
  {
    id: "nature",
    label: "Nature",
    icon: "🌿",
    emojis: [
      ["🐶", "dog puppy"], ["🐱", "cat kitten"], ["🐭", "mouse"], ["🐹", "hamster"],
      ["🐰", "rabbit bunny"], ["🦊", "fox"], ["🐻", "bear"], ["🐼", "panda"],
      ["🐨", "koala"], ["🐯", "tiger"], ["🦁", "lion"], ["🐮", "cow"],
      ["🐷", "pig"], ["🐸", "frog"], ["🐵", "monkey"], ["🐔", "chicken"],
      ["🐧", "penguin"], ["🐦", "bird"], ["🦉", "owl"], ["🦄", "unicorn"],
      ["🐝", "bee"], ["🐛", "bug caterpillar"], ["🦋", "butterfly"], ["🐢", "turtle"],
      ["🐍", "snake python"], ["🐙", "octopus"], ["🐬", "dolphin"], ["🐳", "whale"],
      ["🌵", "cactus"], ["🌲", "tree evergreen"], ["🌴", "palm tree"], ["🌱", "seedling sprout"],
      ["🌸", "blossom flower"], ["🌹", "rose"], ["🌻", "sunflower"], ["🍀", "clover luck"],
      ["🌍", "earth globe africa"], ["🌙", "moon"], ["⭐", "star"], ["☀️", "sun"],
      ["⛅", "cloud sun"], ["🌧️", "rain"], ["⚡", "lightning zap"], ["❄️", "snow"],
      ["🌈", "rainbow"], ["🌊", "wave ocean"],
    ],
  },
  {
    id: "food",
    label: "Food",
    icon: "🍕",
    emojis: [
      ["🍎", "apple red"], ["🍌", "banana"], ["🍇", "grapes"], ["🍓", "strawberry"],
      ["🍉", "watermelon"], ["🍍", "pineapple"], ["🥭", "mango"], ["🥑", "avocado"],
      ["🌽", "corn maize"], ["🥕", "carrot"], ["🍞", "bread"], ["🧀", "cheese"],
      ["🍳", "egg cooking"], ["🥞", "pancakes"], ["🍔", "burger hamburger"], ["🍟", "fries"],
      ["🍕", "pizza"], ["🌭", "hot dog"], ["🌮", "taco"], ["🌯", "burrito"],
      ["🍝", "pasta spaghetti"], ["🍜", "noodles ramen"], ["🍲", "stew pot"], ["🍛", "curry"],
      ["🍣", "sushi"], ["🍚", "rice"], ["🍗", "chicken drumstick"], ["🍖", "meat"],
      ["🍦", "ice cream"], ["🍩", "donut"], ["🍪", "cookie"], ["🎂", "birthday cake"],
      ["🍫", "chocolate"], ["🍿", "popcorn"], ["☕", "coffee tea"], ["🍵", "tea"],
      ["🥤", "soda drink"], ["🍺", "beer"], ["🍷", "wine"], ["🥂", "cheers toast"],
    ],
  },
  {
    id: "activities",
    label: "Activity",
    icon: "⚽",
    emojis: [
      ["⚽", "soccer football"], ["🏀", "basketball"], ["🏈", "american football"], ["⚾", "baseball"],
      ["🎾", "tennis"], ["🏐", "volleyball"], ["🏉", "rugby"], ["🎱", "pool billiards"],
      ["🏓", "ping pong"], ["🥊", "boxing glove"], ["🏆", "trophy win"], ["🥇", "gold medal first"],
      ["🥈", "silver medal"], ["🥉", "bronze medal"], ["🎮", "video game controller"], ["🕹️", "joystick"],
      ["🎲", "dice game"], ["🧩", "puzzle"], ["🎯", "target bullseye"], ["🎳", "bowling"],
      ["🎵", "music note"], ["🎶", "music notes"], ["🎧", "headphones"], ["🎤", "microphone sing"],
      ["🎸", "guitar"], ["🎹", "piano keyboard"], ["🥁", "drum"], ["🎬", "clapper movie"],
      ["🎨", "art palette paint"], ["🎉", "party popper tada"], ["🎊", "confetti"], ["🎈", "balloon"],
      ["🎁", "gift present"], ["🚴", "cycling bike"], ["🏃", "running"], ["🏊", "swimming"],
    ],
  },
  {
    id: "travel",
    label: "Travel",
    icon: "🚀",
    emojis: [
      ["🚗", "car"], ["🚕", "taxi"], ["🚌", "bus"], ["🏎️", "race car"],
      ["🚓", "police car"], ["🚑", "ambulance"], ["🚒", "fire truck"], ["🚲", "bicycle"],
      ["🛵", "scooter"], ["🏍️", "motorcycle"], ["✈️", "airplane flight"], ["🚀", "rocket launch"],
      ["🛸", "ufo"], ["🚁", "helicopter"], ["⛵", "sailboat"], ["🚢", "ship"],
      ["🚂", "train"], ["🏠", "house home"], ["🏢", "office building"], ["🏫", "school"],
      ["🏥", "hospital"], ["🏖️", "beach"], ["🏔️", "mountain"], ["🗺️", "map"],
      ["🧭", "compass"], ["⏰", "alarm clock time"], ["⌛", "hourglass"], ["📍", "pin location"],
    ],
  },
  {
    id: "objects",
    label: "Objects",
    icon: "💡",
    emojis: [
      ["💻", "laptop computer"], ["🖥️", "desktop computer"], ["⌨️", "keyboard"], ["🖱️", "mouse computer"],
      ["📱", "phone mobile"], ["📞", "telephone"], ["🔋", "battery"], ["🔌", "plug"],
      ["💾", "floppy save disk"], ["💿", "cd disc"], ["📷", "camera"], ["📹", "video camera"],
      ["📺", "tv television"], ["📡", "satellite antenna"], ["💡", "idea light bulb"], ["🔦", "flashlight"],
      ["📚", "books"], ["📖", "open book"], ["📝", "memo note write"], ["✏️", "pencil"],
      ["📎", "paperclip attach"], ["📌", "pushpin"], ["📅", "calendar date"], ["📊", "bar chart stats"],
      ["📈", "chart increasing growth"], ["📉", "chart decreasing"], ["📁", "folder"], ["🗑️", "trash bin delete"],
      ["🔒", "lock locked"], ["🔓", "unlocked"], ["🔑", "key"], ["🔧", "wrench tool"],
      ["🔨", "hammer"], ["⚙️", "gear settings"], ["🧪", "test tube experiment"], ["🔬", "microscope"],
      ["💰", "money bag"], ["💵", "dollar cash"], ["💳", "credit card"], ["🛒", "shopping cart"],
      ["📦", "package box"], ["📧", "email"], ["📢", "loudspeaker announce"], ["🔔", "bell notification"],
    ],
  },
  {
    id: "symbols",
    label: "Symbols",
    icon: "✅",
    emojis: [
      ["✅", "check done yes"], ["❌", "cross no wrong"], ["❓", "question"], ["❗", "exclamation"],
      ["‼️", "double exclamation"], ["⚠️", "warning"], ["🚫", "prohibited no"], ["⛔", "no entry"],
      ["➕", "plus add"], ["➖", "minus"], ["✔️", "check mark"], ["☑️", "ballot check"],
      ["🔴", "red circle"], ["🟠", "orange circle"], ["🟡", "yellow circle"], ["🟢", "green circle"],
      ["🔵", "blue circle"], ["🟣", "purple circle"], ["⚫", "black circle"], ["⚪", "white circle"],
      ["➡️", "right arrow"], ["⬅️", "left arrow"], ["⬆️", "up arrow"], ["⬇️", "down arrow"],
      ["🔄", "refresh sync"], ["🔁", "repeat loop"], ["🆗", "ok"], ["🆕", "new"],
      ["🆘", "sos help"], ["💬", "speech bubble chat"], ["💭", "thought bubble"], ["🏁", "finish flag"],
    ],
  },
];

export const ALL_EMOJIS = EMOJI_CATEGORIES.flatMap((c) => c.emojis);

export function searchEmojis(query: string) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  return ALL_EMOJIS.filter(([, keywords]) =>
    terms.every((t) => keywords.includes(t)),
  ).map(([emoji]) => emoji);
}
