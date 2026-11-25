// ==================== COMPLETE 100-SKIN COSMETIC DATABASE ====================
// Includes all 100 requested character skins, verified matching pickaxes & back blings
// (with clearly labeled [Original Cosmetic] items where official counterparts do not exist),
// styles, colors, rarities, sets, gliders, emotes, and weapon wraps.

const RARITY_META = {
  common:    { label: 'Common',    color: '#9ca3af', price: 500,  rank: 1 },
  uncommon:  { label: 'Uncommon',  color: '#4ade80', price: 800,  rank: 2 },
  rare:      { label: 'Rare',      color: '#38bdf8', price: 1200, rank: 3 },
  epic:      { label: 'Epic',      color: '#c084fc', price: 1500, rank: 4 },
  legendary: { label: 'Legendary', color: '#fbbf24', price: 2000, rank: 5 },
  special:   { label: 'Special',   color: '#f472b6', price: 1800, rank: 6 }
};

// Raw 100-skin master definitions:
// [id, name, rarity, set, season, pickaxe, bling, styles, palette(skin, hair, top, pants, accent), archetype]
const RAW_100_SKINS = [
  [1,  "Backlash", "legendary", "Boundless", "Ch2 S4", "Phantasmic Pulse", "Holo-Back", ["Standard", "Crimson Pulse", "Shadow Volt"], ["#f1c27d","#222222","#1e293b","#0f172a","#38bdf8"], "hero_suit"],
  [2,  "Joltara", "legendary", "Boundless", "Ch2 S4", "Phantasmic Pulse", "Emoticape", ["Electric Blue", "Solar Gold", "Midnight"], ["#e0ac69","#facc15","#1d4ed8","#0f172a","#fde047"], "hero_suit"],
  [3,  "Surf Witch", "rare", "Haze Brigade", "Ch2 S3", "Starstruck Axe", "Starlet", ["Beach Haze", "Coral Sunset"], ["#f3c69f","#f472b6","#ec4899","#1e293b","#38bdf8"], "casual"],
  [4,  "Par Patroller", "uncommon", "Green Clover", "Ch2 S3", "Hook Slicer", "Golf Bag [Original Cosmetic]", ["Fairway Green", "Tournament White"], ["#f1c27d","#4a2c18","#16a34a","#f8fafc","#facc15"], "visor"],
  [5,  "Focus", "rare", "Cobra Crew", "Ch1 S9", "Quickstrike", "Chuck Pack", ["Tactical Teal", "Shadow Ops"], ["#e6b88a","#1f2937","#0f766e","#1e293b","#38bdf8"], "ninja"],
  [6,  "Chani", "special", "Dune", "Ch2 S8", "Twinblades", "Fremkit", ["Stillsuit", "Desert Cloak"], ["#d4a373","#2b1d14","#4b5563","#374151","#60a5fa"], "tactical"],
  [7,  "Echo", "rare", "Twin Echo", "Ch2 S2", "Inversion Blades", "Echo Jet", ["Light Inversion", "Dark Inversion"], ["#f1c27d","#ffffff","#f8fafc","#111827","#38bdf8"], "hood"],
  [8,  "Lara Croft", "special", "Tomb Raider", "Ch2 S6", "Pry Axes", "Survivor's Pack", ["25th Anniversary", "Classic", "Gold Anniversary"], ["#e0ac69","#3b2314","#0d9488","#78350f","#fbbf24"], "tactical"],
  [9,  "Catwoman Comic Book Outfit", "special", "Gotham City", "Ch1 SX", "Cat's Claws", "Jeweled Cat", ["Classic Noir", "Midnight Cowl"], ["#f5cba7","#111827","#111827","#090d16","#a855f7"], "cat_cowl"],
  [10, "Aura", "uncommon", "Guild", "Ch1 S8", "Gold Crow", "Gold Dagger Pack", ["Default", "Winter Hunter"], ["#f1c27d","#78350f","#f8fafc","#991b1b","#fbbf24"], "cap"],
  [11, "Kor", "epic", "Silent Assassin", "Ch2 S8", "Flint Striker", "Tactical Quiver", ["Trench Coat", "Arctic Trench"], ["#d4a373","#1e293b","#475569","#0f172a","#38bdf8"], "trench"],
  [12, "Serenade", "rare", "Siren's Song", "Ch4 S2", "Siren's Call [Original Cosmetic]", "Tidal Pearl [Original Cosmetic]", ["Deep Sea", "Abyssal Glow"], ["#93c5fd","#1e3a8a","#1d4ed8","#0f172a","#22d3ee"], "casual"],
  [13, "Caper", "rare", "Spray & Pray", "Ch4 S4", "Street Shine", "Alias Pack", ["Urban Spray", "Neon Night"], ["#e0ac69","#111827","#334155","#0f172a","#f43f5e"], "hood"],
  [14, "Holly Jammer", "uncommon", "Cozy Holidays", "Ch2 S1", "Candy Cleavers", "Holiday Ham", ["Festive Pajama", "Snowflake"], ["#f1c27d","#5c3a21","#dc2626","#15803d","#ffffff"], "hood"],
  [15, "Siren", "rare", "Hit Squad", "Ch2 S2", "XO Axes", "Last Kiss", ["Hitwoman", "Noir"], ["#f5cba7","#111827","#111827","#1f2937","#ef4444"], "tactical"],
  [16, "Polarity", "legendary", "Boundless", "Ch2 S4", "Phantasmic Pulse", "Holo-Back", ["Magnetic Teal", "Crimson"], ["#8d5524","#111827","#0284c7","#0f172a","#f43f5e"], "hero_suit"],
  [17, "Scarlet Commander", "uncommon", "Crimson Scout [Original Set]", "Ch1 S9", "Scarlet Scythe", "Crimson Crest [Original Cosmetic]", ["Scarlet", "Obsidian"], ["#f1c27d","#2b1d14","#dc2626","#1f2937","#f8fafc"], "cap"],
  [18, "Lyric", "rare", "Soundwave", "Ch3 S3", "Mic Dropper [Original Cosmetic]", "Amp Pack [Original Cosmetic]", ["Festival", "Encore"], ["#c68642","#111827","#7e22ce","#1e1b4b","#f472b6"], "casual"],
  [19, "Mogul Master", "epic", "Winter Ski", "Ch1 S2", "Ski Boot", "Alpine Accessories", ["USA", "CAN", "GBR", "GER"], ["#f1c27d","#3b2314","#1d4ed8","#dc2626","#ffffff"], "helmet"],
  [20, "Windwalker Echo", "rare", "Twin Echo", "Ch2 S8", "Inversion Blades", "Echo Jet", ["Windwalker", "Storm"], ["#f1c27d","#e2e8f0","#0ea5e9","#1e293b","#fde047"], "hood"],
  [21, "Poised Playmaker", "rare", "Goalbound", "Ch1 S4", "Vuvuzela", "Top Trophy [Original Cosmetic]", ["Striker", "Champion Gold"], ["#e0ac69","#2b1d14","#2563eb","#f8fafc","#facc15"], "casual"],
  [22, "Jolly Jammer", "uncommon", "Cozy Holidays", "Ch2 S1", "Candy Cleavers", "Holiday Ham", ["Red Plaid", "Evergreen"], ["#e0ac69","#1f2937","#b91c1c","#14532d","#fde047"], "hood"],
  [23, "Desert Dawn Lyric", "rare", "Sunburst", "Ch4 S3", "Dune Striker [Original Cosmetic]", "Sunburst Satchel [Original Cosmetic]", ["Dawn", "Oasis"], ["#c68642","#2b1d14","#d97706","#78350f","#38bdf8"], "casual"],
  [24, "Iconic Kim Kardashian", "special", "Icon Series", "Ch5 S2", "Glam Scepter [Original Cosmetic]", "Velvet Clutch [Original Cosmetic]", ["Runway", "Gala"], ["#d4a373","#111827","#18181b","#09090b","#f59e0b"], "casual"],
  [25, "Modena Icon", "rare", "Racer Royale", "Ch3 S2", "Apex Wrench [Original Cosmetic]", "Turbo Spoiler [Original Cosmetic]", ["Rosso Corsa", "Track White"], ["#f1c27d","#3b2314","#dc2626","#111827","#facc15"], "helmet"],
  [26, "Recon Expert", "rare", "Storm Scavenger", "Ch1 S1", "Pick Squeak", "Recon Satchel [Original Cosmetic]", ["Default", "No Hat"], ["#8d5524","#111827","#4d7c0f","#3f6212","#d97706"], "cap"],
  [27, "Zadie", "rare", "Metal Masq", "Ch2 S1", "Spikeclone", "Spiked Satchel", ["Arctic", "Jungle", "Urban"], ["#e0ac69","#1f2937","#f8fafc","#334155","#38bdf8"], "mask"],
  [28, "Pincera", "epic", "Crustacean Crew [Original Set]", "Ch4 S2", "Claw Cleaver [Original Cosmetic]", "Shell Shield [Original Cosmetic]", ["Coral Red", "Abyssal Blue"], ["#f87171","#991b1b","#dc2626","#7f1d1d","#fde047"], "helmet"],
  [29, "Chaos Director", "epic", "Chaos", "Ch5 S4", "Chaos Scythe", "Ooze Chamber", ["Director", "Inked"], ["#111827","#111827","#18181b","#09090b","#a855f7"], "mask"],
  [30, "Sandshark Driver", "rare", "Dune Raiders", "Ch2 S3", "Shark Tooth Pick [Original Cosmetic]", "Fin Pack [Original Cosmetic]", ["Desert", "Ocean"], ["#e0ac69","#3b2314","#d97706","#1e3a8a","#38bdf8"], "visor"],
  [31, "Vix", "epic", "Lynx", "Ch2 S2", "Purr Axes", "Purr Pack", ["Feline", "Neon Lynx"], ["#f1c27d","#f472b6","#1e293b","#0f172a","#ec4899"], "cat_cowl"],
  [32, "Iso", "rare", "Cyber Operative [Original Set]", "Ch3 S1", "Prism Blade [Original Cosmetic]", "Iso Core [Original Cosmetic]", ["Cyber", "Overdrive"], ["#f1c27d","#60a5fa","#1e1b4b","#0f172a","#22d3ee"], "visor"],
  [33, "Sparkplug", "rare", "Garage Band", "Ch1 S7", "Socket Smasher", "Scrappy", ["Mechanic", "Midnight"], ["#f1c27d","#78350f","#f8fafc","#1e3a8a","#ef4444"], "cap"],
  [34, "Scuba Crystal", "rare", "Paleontologist", "Ch2 S3", "Dive Knife [Original Cosmetic]", "O2 Tank [Original Cosmetic]", ["Reef", "Deep Dive"], ["#f1c27d","#1e3a8a","#0284c7","#0f172a","#facc15"], "visor"],
  [35, "Spycatcher Siren", "rare", "Hit Squad", "Ch4 S4", "XO Axes", "Spy Case [Original Cosmetic]", ["Undercover", "Crimson"], ["#f5cba7","#111827","#7f1d1d","#111827","#facc15"], "tactical"],
  [36, "Unchained Ramirez", "uncommon", "Street Fashion", "Ch2 S8", "Street Blade [Original Cosmetic]", "Urban Pack [Original Cosmetic]", ["Streetwear", "Classic"], ["#e0ac69","#3b2314","#f8fafc","#2563eb","#f43f5e"], "casual"],
  [37, "Crystal", "uncommon", "Paleontologist", "Ch1 SX", "Bronto Basher [Original Cosmetic]", "Dino Fossil [Original Cosmetic]", ["Classic Teal", "Midnight"], ["#f1c27d","#1d4ed8","#0ea5e9","#1e293b","#38bdf8"], "casual"],
  [38, "Pitstop", "rare", "Racer Royale", "Ch2 S4", "Lug Axe", "Llamalaxy", ["Grid", "Turbo"], ["#e0ac69","#2b1d14","#dc2626","#f8fafc","#111827"], "helmet"],
  [39, "Chaos Agent", "epic", "The Final Reckoning", "Ch1 SX", "Chaos Scythe", "Ooze Chamber", ["Default", "Goop"], ["#09090b","#09090b","#18181b","#09090b","#ef4444"], "mask"],
  [40, "Nog Ops", "uncommon", "Yuletide", "Ch1 S1", "Yuletide Slicer", "Holiday Present [Original Cosmetic]", ["Festive", "Cozy"], ["#f1c27d","#3b2314","#dc2626","#15803d","#ffffff"], "santa_hat"],
  [41, "Dummy", "rare", "Crash Test", "Ch2 S3", "Noggin", "Crash Bag", ["Yellow Test", "Carbon Fiber"], ["#facc15","#facc15","#facc15","#1f2937","#ef4444"], "helmet"],
  [42, "Sparx", "rare", "Neon Pulse [Original Set]", "Ch3 S4", "Volt Striker [Original Cosmetic]", "Arc Capacitor [Original Cosmetic]", ["Electric", "Plasma"], ["#e0ac69","#facc15","#2563eb","#0f172a","#fde047"], "visor"],
  [43, "Frozen Nog Ops", "special", "Frozen Legends", "Ch1 S7", "Frozen Axe", "Frozen Shield [Original Cosmetic]", ["Ice", "Frostbite"], ["#bae6fd","#e0f2fe","#0284c7","#1e3a8a","#ffffff"], "santa_hat"],
  [44, "Tigeress", "rare", "Lunar New Year", "Ch2 S1", "Tiger Claws [Original Cosmetic]", "Jade Lantern [Original Cosmetic]", ["Crimson Tiger", "Gold"], ["#e0ac69","#111827","#dc2626","#111827","#f59e0b"], "mask"],
  [45, "Cozy Commander", "uncommon", "Cozy Holidays", "Ch2 S1", "Candy Cleavers", "Holiday Ham", ["Santa Cozy", "Reindeer"], ["#8d5524","#111827","#b91c1c","#f8fafc","#22c55e"], "hood"],
  [46, "Manic", "uncommon", "Cobra Crew", "Ch1 SX", "Scarlet Sai", "Cobra Pack [Original Cosmetic]", ["Default", "No Helmet"], ["#f1c27d","#2b1d14","#991b1b","#111827","#ef4444"], "helmet"],
  [47, "Runway Racer", "rare", "Street Couture", "Ch4 OG", "Haute Hammer [Original Cosmetic]", "Couture Clutch [Original Cosmetic]", ["Champion", "Checkered"], ["#e0ac69","#111827","#111827","#f8fafc","#ef4444"], "cap"],
  [48, "B.R.U.T.E. Gunner", "uncommon", "B.R.U.T.E. Squad", "Ch1 SX", "B.R.U.T.E. Cleaver [Original Cosmetic]", "Mech Core [Original Cosmetic]", ["Standard", "Obsidian"], ["#e0ac69","#2b1d14","#334155","#0f172a","#f97316"], "helmet"],
  [49, "Travis Scott", "special", "Travis Scott", "Ch2 S2", "Diamond Jack", "Cactus Jack", ["Default", "T-3500 Cyborg"], ["#6f4e37","#111827","#6f4e37","#4b3621","#ef4444"], "tactical"],
  [50, "Felina", "epic", "Ranked Vanguard", "Ch5 S4", "Felina's Claw", "Vanguard Crest [Original Cosmetic]", ["Bronze", "Gold", "Unreal"], ["#d4a373","#111827","#1e293b","#0f172a","#fbbf24"], "cat_cowl"],
  [51, "Renegade Raider", "rare", "Storm Scavenger", "Ch1 S1", "Raider's Revenge", "Rust Bucket", ["Default", "Checkered"], ["#e0ac69","#3b2314","#78350f","#3f3f46","#f97316"], "helmet"],
  [52, "Clix", "special", "Icon Series", "Ch6 S2", "2x Hammer [Original Cosmetic]", "Boxfight Trophy [Original Cosmetic]", ["Pro Jersey", "Championship"], ["#f1c27d","#4a2c18","#1e3a8a","#0f172a","#38bdf8"], "casual"],
  [53, "Slayer Juice WRLD", "special", "Icon Series", "Ch5 Remix", "999 Blade [Original Cosmetic]", "999 Wings [Original Cosmetic]", ["Anime Cel", "Legends"], ["#6f4e37","#111827","#111827","#1e293b","#38bdf8"], "hood"],
  [54, "Emma Frost", "special", "X-Men", "Ch5 S4", "Diamond Scepter", "Frost Cape", ["White Queen", "Diamond Form"], ["#f8fafc","#fde047","#ffffff","#e2e8f0","#38bdf8"], "crown"],
  [55, "Ice Spice", "special", "Icon Series", "Ch5 Remix", "Ice Mic", "Munchkin", ["Bronx", "Princess"], ["#d4a373","#f97316","#f472b6","#1e3a8a","#38bdf8"], "casual"],
  [56, "Kuno", "epic", "Falcon Clan", "Ch1 S8", "Talons", "Dual Kama", ["Default", "Indigo"], ["#f1c27d","#ffffff","#1e3a8a","#0f172a","#38bdf8"], "ninja"],
  [57, "Eleven", "special", "Stranger Things", "Ch4 OG", "Steve's Bat", "Hopper's Cabin Diorama", ["Hawkins", "Mall Outfit"], ["#f1c27d","#4a2c18","#1e3a8a","#334155","#f472b6"], "casual"],
  [58, "PJ Patroller", "uncommon", "Cozy Holidays", "Ch2 S1", "Candy Cleavers", "Holiday Ham", ["Reindeer", "Snowman"], ["#f1c27d","#4a2c18","#15803d","#dc2626","#ffffff"], "hood"],
  [59, "Onyx Winter", "epic", "Winter Hunters", "Ch5 S1", "Onyx Edge [Original Cosmetic]", "Frost Quiver [Original Cosmetic]", ["Onyx", "Blizzard"], ["#e0ac69","#111827","#18181b","#09090b","#38bdf8"], "hood"],
  [60, "Ghoul Trooper", "epic", "Skull Squad", "Ch1 S1", "Reaper", "Brainiac Jar [Original Cosmetic]", ["Zombie Green", "Pink Ghoul"], ["#4ade80","#4a2c18","#18181b","#27272a","#22c55e"], "tactical"],
  [61, "Dominator", "uncommon", "Storm Scavenger", "Ch1 S1", "Dominator Pick [Original Cosmetic]", "Scrap Pack [Original Cosmetic]", ["Default"], ["#e0ac69","#111827","#7c2d12","#3f6212","#f97316"], "tactical"],
  [62, "Hope", "epic", "The Underground", "Ch5 S1", "Hope's Blade", "Underground Banner", ["Rebel", "Shadow"], ["#f1c27d","#2563eb","#1e3a8a","#0f172a","#f43f5e"], "cat_cowl"],
  [63, "Dynamo", "rare", "Lucha", "Ch1 S5", "Piledriver", "Masked Fury [Original Cosmetic]", ["Luchadora", "Gold"], ["#e0ac69","#111827","#ec4899","#facc15","#22c55e"], "mask"],
  [64, "Doom Dancer", "rare", "Latveria Beats [Original Set]", "Ch5 S4", "Doom Staff [Original Cosmetic]", "Latverian Cape [Original Cosmetic]", ["Doom", "Arcane"], ["#d4a373","#111827","#15803d","#1e293b","#4ade80"], "hood"],
  [65, "Arctic Adeline", "rare", "Winter Wonder", "Ch2 S1", "Frosty Globe", "Snowflake Cape [Original Cosmetic]", ["Arctic", "Festive"], ["#f1c27d","#3b2314","#dc2626","#f8fafc","#38bdf8"], "santa_hat"],
  [66, "Cat Holloway", "rare", "Feline Sleuth [Original Set]", "Ch4 S2", "Paw Pick [Original Cosmetic]", "Whisker Pack [Original Cosmetic]", ["Noir", "Daylight"], ["#f1c27d","#f59e0b","#1e293b","#0f172a","#f472b6"], "cat_cowl"],
  [67, "Champion Siren", "rare", "FNCS", "Ch4 S2", "Champion's Blade", "FNCS Crest", ["FNCS Gold", "Blue"], ["#f5cba7","#111827","#1d4ed8","#0f172a","#fbbf24"], "tactical"],
  [68, "Camille", "rare", "Rat Pack", "Ch3 S4", "Heartbeater", "Lil' Split", ["Human", "Rat Form"], ["#f1c27d","#f472b6","#f472b6","#1e293b","#38bdf8"], "cat_cowl"],
  [69, "Astra", "epic", "Shooting Star", "Ch2 S1", "Starry Flight", "Starfield", ["Constellation", "Nebula"], ["#e0ac69","#38bdf8","#1e1b4b","#090d16","#fde047"], "casual"],
  [70, "Birdie", "uncommon", "Green Clover", "Ch1 S8", "Driver", "Golf Bag [Original Cosmetic]", ["Fairway", "Pink"], ["#f1c27d","#3b2314","#ec4899","#f8fafc","#22c55e"], "visor"],
  [71, "Shady Zadie", "rare", "Metal Masq", "Ch3 S1", "Spikeclone", "Spiked Satchel", ["Shadow", "Neon"], ["#e0ac69","#111827","#09090b","#18181b","#a855f7"], "mask"],
  [72, "Dynamo Dancer", "legendary", "Boundless", "Ch2 S4", "Phantasmic Pulse", "Emoticape", ["Crimson", "Cyber"], ["#8d5524","#111827","#dc2626","#0f172a","#fde047"], "hero_suit"],
  [73, "Glitch", "rare", "Machine Learning", "Ch3 S4", "Code Cutter", "Data Pack", ["Wrap Reactive", "Corrupt"], ["#e0ac69","#22d3ee","#1e293b","#0f172a","#ec4899"], "visor"],
  [74, "Aniyah", "rare", "Urban Pulse [Original Set]", "Ch4 S1", "Neon Baton [Original Cosmetic]", "Pulse Pack [Original Cosmetic]", ["Street", "Midnight"], ["#6f4e37","#111827","#7c3aed","#0f172a","#38bdf8"], "casual"],
  [75, "Sunny", "epic", "Cosmic Summer", "Ch2 S7", "Choppa Blade", "Lil' Kev", ["Ska Punk", "Voyager"], ["#f1c27d","#111827","#facc15","#111827","#ef4444"], "cap"],
  [76, "Mariana", "epic", "Fathom", "Ch2 S3", "Coral Cruiser", "Luminous Lamp", ["Abyss", "Bioluminescent"], ["#38bdf8","#0284c7","#1e3a8a","#090d16","#22d3ee"], "crown"],
  [77, "Catwoman Zero", "special", "Batman: Zero Point", "Ch2 S6", "Catwoman's Grappling Claw", "Cat's Paw", ["Zero Point", "Stealth"], ["#f5cba7","#111827","#18181b","#09090b","#a855f7"], "cat_cowl"],
  [78, "Psycho Bandit", "special", "Mayhem", "Ch1 SX", "Psycho Buzz Axes", "Claptrap", ["Pandora", "Vault"], ["#e0ac69","#111827","#f97316","#1e3a8a","#facc15"], "mask"],
  [79, "Nisha", "epic", "The Society", "Ch5 S1", "Society's Edge", "Duelist's Grace", ["Fencer", "Champagne"], ["#d4a373","#111827","#f8fafc","#7f1d1d","#fbbf24"], "mask"],
  [80, "Fashion Banshee", "rare", "Haute Couture [Original Set]", "Ch4 S3", "Runway Scythe [Original Cosmetic]", "Banshee Veil [Original Cosmetic]", ["Runway", "Phantom"], ["#f1c27d","#ffffff","#7e22ce","#0f172a","#f472b6"], "casual"],
  [81, "Elite Jules", "epic", "Golden Touch", "Ch3 S3", "Wrenchers", "Ohm", ["Gold Engineer", "Shadow"], ["#e0ac69","#111827","#fbbf24","#18181b","#f59e0b"], "cap"],
  [82, "Festival Phaedra", "rare", "Gothic Beats", "Ch4 S3", "Parasol Pick [Original Cosmetic]", "Octo Plush [Original Cosmetic]", ["Goth Summer", "Eclipse"], ["#f5cba7","#111827","#18181b","#312e81","#a855f7"], "cap"],
  [83, "Arcane Jinx", "special", "Arcane: League of Legends", "Ch2 S8", "Pow-Pow Crusher", "Jinx's Dream Monkey", ["Zaun", "Shimmer"], ["#f5cba7","#38bdf8","#1e1b4b","#4c1d95","#ec4899"], "casual"],
  [84, "Tony Stark", "special", "Iron Man", "Ch2 S4", "Mark 85 Energy Blade", "Iron Man Backplate", ["Tony Stark", "Mark 85 Suit"], ["#e0ac69","#111827","#dc2626","#b91c1c","#facc15"], "helmet"],
  [85, "Piper Pace", "epic", "Pizza Pit", "Ch4 S4", "Pizza Cutter", "Delivery Bag", ["Driver", "Turbo"], ["#e0ac69","#3b2314","#dc2626","#1e293b","#facc15"], "cap"],
  [86, "Polo Prodigy", "epic", "Polo Stadium", "Ch3 S4", "Stadium Collector", "P-Wing Pack", ["Stadium", "Classic"], ["#8d5524","#111827","#1d4ed8","#dc2626","#facc15"], "cap"],
  [87, "Hana", "epic", "K-Pop Rush", "Ch4 S1", "Nunchucks", "Hana's Hoverboard", ["Street", "Neon"], ["#f1c27d","#f472b6","#f8fafc","#1e293b","#38bdf8"], "helmet"],
  [88, "Undercover Kor", "epic", "Silent Assassin", "Ch3 S3", "Flint Striker", "Covert Case [Original Cosmetic]", ["Summer Ops", "Noir"], ["#d4a373","#111827","#0f172a","#334155","#38bdf8"], "tactical"],
  [89, "PJ", "rare", "Retro Beats", "Ch5 S2", "Cassette Crusher", "Boombox Pack", ["90s Neon", "Midnight"], ["#f1c27d","#facc15","#ec4899","#2563eb","#22d3ee"], "casual"],
  [90, "Explorer Emilie", "rare", "LEGO Expeditions", "Ch5 S1", "Expedition Pick [Original Cosmetic]", "Explorer Satchel [Original Cosmetic]", ["Safari", "Arctic"], ["#f1c27d","#78350f","#d97706","#3f6212","#38bdf8"], "cap"],
  [91, "Krisabelle", "rare", "Oakwitch Academy", "Ch2 S8", "Gingersledge", "Holiday Sack", ["Festive Witch", "Winter"], ["#f1c27d","#78350f","#dc2626","#15803d","#facc15"], "santa_hat"],
  [92, "Safari", "rare", "Wilderness", "Ch2 S2", "Machete", "Wild Pack", ["Default", "No Hat"], ["#e0ac69","#3b2314","#a16207","#3f6212","#facc15"], "cap"],
  [93, "Slim Shady", "special", "Icon Series", "Ch4 OG", "Shady Double Saw", "Mom's Spaghetti", ["Rap Boy", "Suit"], ["#f1c27d","#fde047","#f8fafc","#1e3a8a","#ef4444"], "casual"],
  [94, "Grace Crowne", "rare", "Royal Vanguard [Original Set]", "Ch5 S2", "Sovereign Blade [Original Cosmetic]", "Crown Crest [Original Cosmetic]", ["Regal", "Midnight"], ["#f1c27d","#facc15","#7e22ce","#0f172a","#fbbf24"], "crown"],
  [95, "Renegade", "uncommon", "Storm Scavenger", "Ch1 S1", "Lucky", "Vintage Pack [Original Cosmetic]", ["Classic"], ["#8d5524","#111827","#991b1b","#3f6212","#d97706"], "tactical"],
  [96, "Fishstick", "rare", "Fish Food", "Ch1 S7", "Bootstraps", "Saltwater Satchel", ["Pirate", "VR", "World Cup"], ["#f97316","#f97316","#0284c7","#78350f","#facc15"], "fish"],
  [97, "Yulejacket", "rare", "Winter Strike", "Ch2 S5", "Snowy Cleaver [Original Cosmetic]", "Blizzard Pack [Original Cosmetic]", ["Frost", "Camo"], ["#f1c27d","#3b2314","#f8fafc","#0284c7","#ef4444"], "hood"],
  [98, "Chill Count", "rare", "Frostbite", "Ch2 S5", "Icicle", "Frost Cape [Original Cosmetic]", ["Vampire Frost", "Noir"], ["#bae6fd","#111827","#1e3a8a","#090d16","#38bdf8"], "hood"],
  [99, "Tricksy", "rare", "Spooky Treats", "Ch2 S8", "Treat Axe", "Candy Bucket", ["Pumpkin", "Ghost"], ["#f97316","#111827","#7e22ce","#09090b","#22c55e"], "mask"],
  [100,"Padmé Amidala", "special", "Star Wars", "Ch4 S2", "Royal Naboo Staff", "Japor Snippet", ["Geonosis", "Senatorial"], ["#f1c27d","#3b2314","#f8fafc","#e2e8f0","#fbbf24"], "casual"]
];

// Original Gasnite skins (#101+). Their full 3D looks (creature heads, tails, hats, outfits) are in js/skin_looks.js.
const RAW_ORIGINAL_SKINS = [
  [101, "Chompion", "legendary", "Heavyweights [Original Set]", "Gasnite S3", "Bone Crusher [Original Cosmetic]", "Chew Toy [Original Cosmetic]", ["Title Run", "Heel Turn"], ["#c98d55","#3b2a1a","#f3dfc4","#dc2626","#facc15"], "mask"],
  [102, "Komodo Kai", "epic", "Wild Bunch [Original Set]", "Gasnite S3", "Fang Pick [Original Cosmetic]", "Explorer Pack [Original Cosmetic]", ["Ember Scale", "Jungle Scale"], ["#e0602b","#7c4a1e","#c8a86a","#556b2f","#14b8a6"], "tactical"],
  [103, "Sunset Spurs", "rare", "Dust Devils [Original Set]", "Gasnite S3", "Spur Splitter [Original Cosmetic]", "Saddle Bag [Original Cosmetic]", ["High Noon", "Moonlit"], ["#b9774c","#2b1a12","#c2410c","#3b5b8c","#0f766e"], "casual"],
  [104, "Ironhorn", "legendary", "Oni Clan [Original Set]", "Gasnite S3", "Oni Cleaver [Original Cosmetic]", "War Banner [Original Cosmetic]", ["Crimson Oath", "Jade Oath"], ["#d9a77f","#16131c","#9b1c1c","#27232f","#e0b04a"], "crown"],
  [105, "Riot Riff", "epic", "Amped Up [Original Set]", "Gasnite S3", "Axe Guitar [Original Cosmetic]", "Amp Stack [Original Cosmetic]", ["Encore", "Unplugged"], ["#f0c7a5","#84cc16","#17171b","#1f2937","#dc2626"], "casual"],
  [106, "Logjam", "rare", "Heavyweights [Original Set]", "Gasnite S3", "Lumber Axe [Original Cosmetic]", "Log Pack [Original Cosmetic]", ["Lumber Red", "Frost Lodge"], ["#7a4a2a","#d9b48a","#b91c1c","#2f4a73","#f97316"], "cap"],
  [107, "Ember Tail", "epic", "Wild Bunch [Original Set]", "Gasnite S3", "Foxfire Kama [Original Cosmetic]", "Lantern Charm [Original Cosmetic]", ["Foxfire", "Snowfox"], ["#e8772a","#fff3e6","#23202b","#15131a","#e11d48"], "ninja"],
  [108, "Bubblegum Beat", "legendary", "Amped Up [Original Set]", "Gasnite S3", "Mic Wand [Original Cosmetic]", "Heart Speaker [Original Cosmetic]", ["Pop Star", "Midnight Encore"], ["#f6d3bf","#f472b6","#fbf8ff","#a78bfa","#facc15"], "casual"],
  [109, "Kickflip Kiki", "uncommon", "Board Crew [Original Set]", "Gasnite S3", "Grind Rail [Original Cosmetic]", "Deck Pack [Original Cosmetic]", ["Grip Tape", "Sunset Session"], ["#8d5a3b","#121212","#eab308","#111827","#ef4444"], "hood"],
  [110, "Slopestyle Sam", "rare", "Board Crew [Original Set]", "Gasnite S3", "Ice Pick [Original Cosmetic]", "Snowboard [Original Cosmetic]", ["Fresh Pow", "Night Park"], ["#f2c9a8","#facc15","#f1f5f9","#6d28d9","#2dd4bf"], "cap"],
  [111, "Bassline Blaze", "epic", "Amped Up [Original Set]", "Gasnite S3", "Crossfader [Original Cosmetic]", "Boombox [Original Cosmetic]", ["Drop Zone", "Neon Rave"], ["#5a3a26","#1a1210","#6d28d9","#15151a","#facc15"], "casual"],
  [112, "Tinker-9", "rare", "Scrap Lab [Original Set]", "Gasnite S3", "Wrench-o-Matic [Original Cosmetic]", "Battery Pack [Original Cosmetic]", ["Factory Fresh", "Rust Bucket"], ["#cbd5e1","#334155","#f97316","#e2e8f0","#22d3ee"], "helmet"]
];

// Build structured DB for Outfits, Pickaxes, Back Blings, Gliders, Emotes, Wraps
const COSMETIC_DB = {
  outfit: [],
  pickaxe: [],
  bling: [],
  glider: [
    { id: 'glider_1', name: 'Victory Umbrella', rarity: 'common', set: 'Battle Royale', season: 'Ch1 S1', color: '#94a3b8', accent: '#38bdf8' },
    { id: 'glider_2', name: 'Mako', rarity: 'uncommon', set: 'Storm Scavenger', season: 'Ch1 S1', color: '#475569', accent: '#ef4444' },
    { id: 'glider_3', name: 'Astroworld Cyclone', rarity: 'special', set: 'Travis Scott', season: 'Ch2 S2', color: '#f97316', accent: '#a855f7' },
    { id: 'glider_4', name: 'Mark 90 Flight Pack', rarity: 'special', set: 'Iron Man', season: 'Ch2 S4', color: '#dc2626', accent: '#facc15' },
    { id: 'glider_5', name: 'Millennium Falcon', rarity: 'special', set: 'Star Wars', season: 'Ch2 S1', color: '#cbd5e1', accent: '#38bdf8' },
    { id: 'glider_6', name: 'Petunia', rarity: 'uncommon', set: 'Flower Power', season: 'Ch1 S1', color: '#ec4899', accent: '#4ade80' }
  ],
  emote: [
    { id: 'emote_1', name: 'Dance Moves (Default)', rarity: 'common', set: 'Battle Royale', season: 'Ch1 S1', anim: 'dance' },
    { id: 'emote_2', name: 'Floss', rarity: 'rare', set: 'Season 2', season: 'Ch1 S2', anim: 'floss' },
    { id: 'emote_3', name: 'Take The L', rarity: 'rare', set: 'Season 3', season: 'Ch1 S3', anim: 'bounce' },
    { id: 'emote_4', name: 'Orange Justice', rarity: 'epic', set: 'Season 4', season: 'Ch1 S4', anim: 'hype' },
    { id: 'emote_5', name: 'Victory Spin', rarity: 'legendary', set: 'Champions', season: 'Ch2 S1', anim: 'spin' }
  ],
  wrap: [
    { id: 'wrap_1', name: 'Midas Memory', rarity: 'rare', set: 'Golden Touch', season: 'Ch2 S2', color: '#fbbf24' },
    { id: 'wrap_2', name: 'Slurp!', rarity: 'epic', set: 'Slurp Squad', season: 'Ch2 S1', color: '#38bdf8' },
    { id: 'wrap_3', name: 'Boogeyman', rarity: 'uncommon', set: 'Wick', season: 'Ch1 S9', color: '#111827' },
    { id: 'wrap_4', name: 'Prismatic Edge', rarity: 'special', set: 'Boundless', season: 'Ch2 S4', color: '#ec4899' }
  ]
};

// Populate every Outfit + its Matching Pickaxe + Matching Back Bling (100 classic + the original Gasnite skins)
[...RAW_100_SKINS, ...RAW_ORIGINAL_SKINS].forEach(row => {
  const [num, name, rarity, set, season, pickName, blingName, styles, palette, archetype] = row;
  const outfitId = `outfit_${num}`;
  const pickId   = `pickaxe_${num}`;
  const blingId  = `bling_${num}`;

  COSMETIC_DB.outfit.push({
    id: outfitId,
    num,
    name,
    category: 'outfit',
    rarity,
    set,
    season,
    matchingPickaxeId: pickId,
    matchingBlingId: blingId,
    styles,
    palette,     // [skinTone, hairColor, torsoColor, pantsColor, accentColor]
    archetype,   // 'hero_suit' | 'casual' | 'visor' | 'ninja' | 'tactical' | 'hood' | 'cat_cowl' | 'cap' | 'trench' | 'helmet' | 'mask' | 'santa_hat' | 'crown' | 'fish'
    original: num > 100,
    price: RARITY_META[rarity].price
  });

  COSMETIC_DB.pickaxe.push({
    id: pickId,
    num,
    name: pickName,
    category: 'pickaxe',
    rarity,
    set,
    season,
    ownerOutfitId: outfitId,
    color: palette[2],
    accent: palette[4],
    price: Math.max(500, RARITY_META[rarity].price - 400)
  });

  COSMETIC_DB.bling.push({
    id: blingId,
    num,
    name: blingName,
    category: 'bling',
    rarity,
    set,
    season,
    ownerOutfitId: outfitId,
    color: palette[3],
    accent: palette[4],
    price: Math.max(400, RARITY_META[rarity].price - 600)
  });
});

function getCosmeticById(cat, id) {
  const list = COSMETIC_DB[cat] || [];
  return list.find(item => item.id === id) || list[0];
}
