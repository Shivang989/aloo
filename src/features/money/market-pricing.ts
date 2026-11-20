export type ShopCategoryKey = "cars" | "flowers" | "bikes" | "food";

export type PriceType =
  | "India Ex-Showroom Price"
  | "India Ex-Showroom Starting Price"
  | "Introductory India Ex-Showroom Price"
  | "Estimated India Import Price"
  | "Discontinued — Historical Price"
  | "Standard Market Price";

export type AvailabilityStatus =
  | "Available"
  | "Private Import Only"
  | "Introductory Offer (Valid until 30 Nov 2026)"
  | "Discontinued";

export interface ProductTechnicalSpecs {
  vehicle_type?: string;
  engine?: string;
  fuel_type?: string;
  transmission?: string;
  drivetrain?: string;
  power?: string;
  torque?: string;
  origin_or_note?: string;
}

export interface MarketProduct {
  id: string;
  category: ShopCategoryKey;
  name: string;
  brand: string;
  model: string;
  variant: string;
  emoji: string;
  aliases: string[];
  price_amount: number;
  currency: "INR";
  price_type: PriceType;
  price_source: string;
  price_verified_at: string;
  availability_status: AvailabilityStatus;
  description: string;
  technical_specs: ProductTechnicalSpecs;
  image_reference?: string;
}

export interface ShopCategoryMeta {
  key: ShopCategoryKey;
  label: string;
  pluralNoun: string;
  emoji: string;
  buttonText: string;
  subtitle: string;
}

export const SHOP_CATEGORIES: Record<ShopCategoryKey, ShopCategoryMeta> = {
  cars: {
    key: "cars",
    label: "Cars",
    pluralNoun: "vehicles",
    emoji: "🚗",
    buttonText: "🚗 Cars",
    subtitle: "Explore premium automobiles.",
  },
  flowers: {
    key: "flowers",
    label: "Flowers",
    pluralNoun: "flowers",
    emoji: "🌸",
    buttonText: "🌸 Flowers",
    subtitle: "Explore fresh & rare blooms.",
  },
  bikes: {
    key: "bikes",
    label: "Bikes",
    pluralNoun: "motorcycles",
    emoji: "🏍️",
    buttonText: "🏍️ Bikes",
    subtitle: "Explore commuter & performance bikes.",
  },
  food: {
    key: "food",
    label: "Food",
    pluralNoun: "items",
    emoji: "🍔",
    buttonText: "🍔 Food",
    subtitle: "Explore freshly prepared snacks & meals.",
  },
};

export const MARKET_CATALOG: readonly MarketProduct[] = [
  // ==========================================
  // 🚗 CARS (Researched India-Market Prices — Verified 20 November 2026)
  // ==========================================
  {
    id: "bugatti_tourbillon",
    category: "cars",
    name: "Bugatti Tourbillon",
    brand: "Bugatti",
    model: "Tourbillon",
    variant: "V16 Hybrid Coupé",
    emoji: "🏎️",
    aliases: ["tourbillon", "bugatti tourbillon"],
    price_amount: 1220000000, // ₹122 Crore
    currency: "INR",
    price_type: "Estimated India Import Price",
    price_source: "Bugatti Automobiles S.A.S. (€3.8M global base + Indian CBU import duty estimate)",
    price_verified_at: "20 November 2026",
    availability_status: "Private Import Only",
    description:
      "Bugatti's flagship V16 plug-in hybrid hypercar. Not officially sold via an Indian dealership; priced as an estimated landed CBU import.",
    technical_specs: {
      vehicle_type: "Hypercar Coupé",
      engine: "8.3L Naturally Aspirated V16 + 3 Electric Motors",
      fuel_type: "Petrol Plug-in Hybrid",
      transmission: "8-Speed Dual-Clutch Automatic",
      drivetrain: "All-Wheel Drive (AWD)",
      power: "1,800 hp (Combined)",
      torque: "900 Nm (ICE) + Electric Assist",
      origin_or_note: "Global base price €3.8M; estimated India landed import cost",
    },
    image_reference:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Bugatti_Tourbillon_at_Chantilly_Arts_%26_Elegance_2024_%282%29.jpg/800px-Bugatti_Tourbillon_at_Chantilly_Arts_%26_Elegance_2024_%282%29.jpg",
  },
  {
    id: "mercedes_maybach_s_class",
    category: "cars",
    name: "Mercedes-Maybach S-Class",
    brand: "Mercedes-Maybach",
    model: "S-Class",
    variant: "S 580 / S 680 Range",
    emoji: "🚘",
    aliases: ["maybach s class", "maybach s-class", "mercedes maybach s class"],
    price_amount: 32000000, // ₹3.20 Crore
    currency: "INR",
    price_type: "India Ex-Showroom Starting Price",
    price_source: "Mercedes-Benz India Official Price List",
    price_verified_at: "20 November 2026",
    availability_status: "Available",
    description:
      "Ultra-luxury extended-wheelbase limousine engineered for chauffeured rear-cabin comfort.",
    technical_specs: {
      vehicle_type: "Ultra-Luxury Limousine",
      engine: "4.0L V8 Biturbo Mild-Hybrid / 6.0L V12",
      fuel_type: "Petrol",
      transmission: "9G-TRONIC 9-Speed Automatic",
      drivetrain: "4MATIC All-Wheel Drive",
      power: "503 hp – 612 hp",
      torque: "700 Nm – 900 Nm",
    },
    image_reference:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Mercedes-Maybach_S_580_4MATIC_%28Z223%29_IMG_6693.jpg/800px-Mercedes-Maybach_S_580_4MATIC_%28Z223%29_IMG_6693.jpg",
  },
  {
    id: "bmw_m8_competition_coupe",
    category: "cars",
    name: "BMW M8 Competition Coupé",
    brand: "BMW",
    model: "M8",
    variant: "Competition Coupé",
    emoji: "🏁",
    aliases: ["bmw m8", "m8 competition", "bmw m8 competition"],
    price_amount: 23840000, // ₹2.384 Crore
    currency: "INR",
    price_type: "India Ex-Showroom Price",
    price_source: "BMW India Official Price List",
    price_verified_at: "20 November 2026",
    availability_status: "Available",
    description:
      "BMW M's flagship twin-turbo V8 grand touring coupé with track-calibrated M xDrive.",
    technical_specs: {
      vehicle_type: "Grand Tourer Sports Coupé",
      engine: "4.4L M TwinPower Turbo V8",
      fuel_type: "Petrol",
      transmission: "8-Speed M Steptronic Automatic",
      drivetrain: "M xDrive All-Wheel Drive",
      power: "625 hp",
      torque: "750 Nm",
    },
    image_reference:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/BMW_F92_IMG_5035.jpg/800px-BMW_F92_IMG_5035.jpg",
  },
  {
    id: "mercedes_benz_s_class",
    category: "cars",
    name: "Mercedes-Benz S-Class",
    brand: "Mercedes-Benz",
    model: "S-Class",
    variant: "S 350d / S 450 Range",
    emoji: "🚘",
    aliases: ["mercedes s class", "mercedes s-class", "s-class", "s class"],
    price_amount: 22000000, // ₹2.20 Crore
    currency: "INR",
    price_type: "India Ex-Showroom Starting Price",
    price_source: "Mercedes-Benz India Official Price List",
    price_verified_at: "20 November 2026",
    availability_status: "Available",
    description:
      "Flagship full-size executive sedan with air suspension, MBUX rear-seat suite, and active noise cancellation.",
    technical_specs: {
      vehicle_type: "Flagship Luxury Sedan",
      engine: "3.0L Inline-6 Turbo (Diesel / Petrol Mild-Hybrid)",
      fuel_type: "Diesel / Petrol",
      transmission: "9G-TRONIC 9-Speed Automatic",
      drivetrain: "RWD / 4MATIC AWD",
      power: "286 hp – 367 hp",
      torque: "500 Nm – 600 Nm",
    },
    image_reference:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Mercedes-Benz_W223_IMG_6663.jpg/800px-Mercedes-Benz_W223_IMG_6663.jpg",
  },
  {
    id: "bmw_m5",
    category: "cars",
    name: "BMW M5",
    brand: "BMW",
    model: "M5",
    variant: "M Hybrid Sedan",
    emoji: "🏎️",
    aliases: ["m5", "bmw m5"],
    price_amount: 21150000, // ₹2.115 Crore
    currency: "INR",
    price_type: "India Ex-Showroom Price",
    price_source: "BMW India Official Price List",
    price_verified_at: "20 November 2026",
    availability_status: "Available",
    description:
      "High-performance M5 super-sedan combining a twin-turbo V8 with an integrated M Hybrid electric drive.",
    technical_specs: {
      vehicle_type: "High-Performance Luxury Sedan",
      engine: "4.4L M TwinPower Turbo V8 + Electric Motor",
      fuel_type: "Petrol Plug-in Hybrid",
      transmission: "8-Speed M Steptronic Automatic",
      drivetrain: "M xDrive All-Wheel Drive",
      power: "727 hp (Combined)",
      torque: "1,000 Nm (Combined)",
    },
    image_reference:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/2018_BMW_M5_Automatic_4.4.jpg/800px-2018_BMW_M5_Automatic_4.4.jpg",
  },
  {
    id: "porsche_911_carrera",
    category: "cars",
    name: "Porsche 911 Carrera",
    brand: "Porsche",
    model: "911",
    variant: "Carrera",
    emoji: "🏁",
    aliases: ["911", "porsche 911", "911 carrera"],
    price_amount: 21129000, // ₹2.1129 Crore
    currency: "INR",
    price_type: "India Ex-Showroom Price",
    price_source: "Porsche India Official Price List",
    price_verified_at: "20 November 2026",
    availability_status: "Available",
    description:
      "Iconic rear-engined flat-six sports car delivering everyday usability and razor-sharp chassis balance.",
    technical_specs: {
      vehicle_type: "2+2 Sports Coupé",
      engine: "3.0L Twin-Turbocharged Flat-6",
      fuel_type: "Petrol",
      transmission: "8-Speed Porsche Doppelkupplung (PDK)",
      drivetrain: "Rear-Wheel Drive (RWD)",
      power: "394 hp",
      torque: "450 Nm",
    },
    image_reference:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Porsche_992_Carrera_4S_Genf_2019_1Y7A5560.jpg/800px-Porsche_992_Carrera_4S_Genf_2019_1Y7A5560.jpg",
  },
  {
    id: "bmw_740_m_sport",
    category: "cars",
    name: "BMW 740 M Sport",
    brand: "BMW",
    model: "7 Series",
    variant: "740i M Sport",
    emoji: "🚘",
    aliases: ["bmw 740", "740 m sport", "bmw 7 series"],
    price_amount: 19500000, // ₹1.95 Crore
    currency: "INR",
    price_type: "India Ex-Showroom Price",
    price_source: "BMW India Official Price List",
    price_verified_at: "20 November 2026",
    availability_status: "Available",
    description:
      "BMW's flagship luxury sedan with Interaction Bar, Sky Lounge panoramic roof, and executive lounge seating.",
    technical_specs: {
      vehicle_type: "Flagship Luxury Sedan",
      engine: "3.0L TwinPower Turbo Inline-6 Mild-Hybrid",
      fuel_type: "Petrol",
      transmission: "8-Speed Steptronic Sport Automatic",
      drivetrain: "Rear-Wheel Drive (RWD)",
      power: "381 hp",
      torque: "520 Nm",
    },
    image_reference:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/BMW_G70_IMG_8627.jpg/800px-BMW_G70_IMG_8627.jpg",
  },
  {
    id: "bmw_m4_competition_m_xdrive",
    category: "cars",
    name: "BMW M4 Competition M xDrive",
    brand: "BMW",
    model: "M4",
    variant: "Competition M xDrive",
    emoji: "🏎️",
    aliases: ["bmw m4", "m4 competition", "bmw m4 competition"],
    price_amount: 16290000, // ₹1.629 Crore
    currency: "INR",
    price_type: "India Ex-Showroom Price",
    price_source: "BMW India Official Price List",
    price_verified_at: "20 November 2026",
    availability_status: "Available",
    description:
      "Track-focused M4 coupé powered by the S58 twin-turbo straight-six and switchable M xDrive AWD.",
    technical_specs: {
      vehicle_type: "High-Performance Sports Coupé",
      engine: "3.0L M TwinPower Turbo Inline-6",
      fuel_type: "Petrol",
      transmission: "8-Speed M Steptronic Automatic",
      drivetrain: "M xDrive All-Wheel Drive",
      power: "530 hp",
      torque: "650 Nm",
    },
    image_reference:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/BMW_G82_M4_Competition_IMG_5429.jpg/800px-BMW_G82_M4_Competition_IMG_5429.jpg",
  },
  {
    id: "mercedes_benz_gls",
    category: "cars",
    name: "Mercedes-Benz GLS",
    brand: "Mercedes-Benz",
    model: "GLS",
    variant: "GLS 450 / 450d Range",
    emoji: "🚙",
    aliases: ["gls", "mercedes gls", "mercedes-benz gls"],
    price_amount: 13750000, // ₹1.375 Crore
    currency: "INR",
    price_type: "India Ex-Showroom Starting Price",
    price_source: "Mercedes-Benz India Official Price List",
    price_verified_at: "20 November 2026",
    availability_status: "Available",
    description:
      "Full-size three-row flagship luxury SUV offering seven-seat spaciousness and AIRMATIC suspension.",
    technical_specs: {
      vehicle_type: "Full-Size 7-Seater Luxury SUV",
      engine: "3.0L Inline-6 Turbo Mild-Hybrid",
      fuel_type: "Petrol / Diesel",
      transmission: "9G-TRONIC 9-Speed Automatic",
      drivetrain: "4MATIC All-Wheel Drive",
      power: "367 hp – 381 hp",
      torque: "500 Nm – 750 Nm",
    },
    image_reference:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Mercedes-Benz_X167_IMG_6685.jpg/800px-Mercedes-Benz_X167_IMG_6685.jpg",
  },
  {
    id: "bmw_x7_xdrive40i",
    category: "cars",
    name: "BMW X7 xDrive40i",
    brand: "BMW",
    model: "X7",
    variant: "xDrive40i M Sport",
    emoji: "🚙",
    aliases: ["bmw x7", "x7", "x7 xdrive40i"],
    price_amount: 13490000, // ₹1.349 Crore
    currency: "INR",
    price_type: "India Ex-Showroom Price",
    price_source: "BMW India Official Price List",
    price_verified_at: "20 November 2026",
    availability_status: "Available",
    description:
      "BMW's largest luxury Sports Activity Vehicle with three rows, two-axle air suspension, and split LED headlamps.",
    technical_specs: {
      vehicle_type: "Full-Size Luxury SUV",
      engine: "3.0L TwinPower Turbo Inline-6 Mild-Hybrid",
      fuel_type: "Petrol",
      transmission: "8-Speed Steptronic Sport Automatic",
      drivetrain: "xDrive All-Wheel Drive",
      power: "381 hp",
      torque: "520 Nm",
    },
    image_reference:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/BMW_G07_FL_IMG_8621.jpg/800px-BMW_G07_FL_IMG_8621.jpg",
  },
  {
    id: "mercedes_benz_gle",
    category: "cars",
    name: "Mercedes-Benz GLE",
    brand: "Mercedes-Benz",
    model: "GLE",
    variant: "GLE 300d / 450 Range",
    emoji: "🚙",
    aliases: ["gle", "mercedes gle", "mercedes-benz gle"],
    price_amount: 10000000, // ₹1 Crore
    currency: "INR",
    price_type: "India Ex-Showroom Starting Price",
    price_source: "Mercedes-Benz India Official Price List",
    price_verified_at: "20 November 2026",
    availability_status: "Available",
    description:
      "Mid-to-full-size luxury SUV combining long-wheelbase rear legroom with MBUX dual-screen tech.",
    technical_specs: {
      vehicle_type: "Mid-Size Luxury SUV",
      engine: "2.0L Turbo Diesel / 3.0L Inline-6 Petrol Mild-Hybrid",
      fuel_type: "Diesel / Petrol",
      transmission: "9G-TRONIC 9-Speed Automatic",
      drivetrain: "4MATIC All-Wheel Drive",
      power: "269 hp – 381 hp",
      torque: "500 Nm – 550 Nm",
    },
    image_reference:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Mercedes-Benz_V167_IMG_3676.jpg/800px-Mercedes-Benz_V167_IMG_3676.jpg",
  },
  {
    id: "bmw_x5_xdrive40i",
    category: "cars",
    name: "BMW X5 xDrive40i",
    brand: "BMW",
    model: "X5",
    variant: "xDrive40i",
    emoji: "🚙",
    aliases: ["bmw x5", "x5", "x5 xdrive40i"],
    price_amount: 9690000, // ₹96.90 Lakh
    currency: "INR",
    price_type: "India Ex-Showroom Price",
    price_source: "BMW India Official Price List",
    price_verified_at: "20 November 2026",
    availability_status: "Available",
    description:
      "A premium BMW Sports Activity Vehicle blending inline-six performance with adaptive air suspension and xDrive.",
    technical_specs: {
      vehicle_type: "Luxury SUV",
      engine: "3.0L TwinPower Turbo Inline-6 Mild-Hybrid",
      fuel_type: "Petrol",
      transmission: "8-Speed Steptronic Sport Automatic",
      drivetrain: "xDrive All-Wheel Drive",
      power: "381 hp",
      torque: "520 Nm",
    },
    image_reference:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/BMW_G05_IMG_3161.jpg/800px-BMW_G05_IMG_3161.jpg",
  },
  {
    id: "mercedes_benz_glc",
    category: "cars",
    name: "Mercedes-Benz GLC",
    brand: "Mercedes-Benz",
    model: "GLC",
    variant: "GLC 300 / 220d 4MATIC",
    emoji: "🚙",
    aliases: ["glc", "mercedes glc", "mercedes-benz glc"],
    price_amount: 7700000, // ₹77 Lakh
    currency: "INR",
    price_type: "India Ex-Showroom Starting Price",
    price_source: "Mercedes-Benz India Official Price List",
    price_verified_at: "20 November 2026",
    availability_status: "Available",
    description:
      "Luxury compact-midsize SUV featuring portrait MBUX central display, 48V mild-hybrid tech, and transparent bonnet view.",
    technical_specs: {
      vehicle_type: "Luxury Compact-Midsize SUV",
      engine: "2.0L 4-Cylinder Turbo Mild-Hybrid",
      fuel_type: "Petrol / Diesel",
      transmission: "9G-TRONIC 9-Speed Automatic",
      drivetrain: "4MATIC All-Wheel Drive",
      power: "197 hp – 258 hp",
      torque: "400 Nm – 440 Nm",
    },
    image_reference:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Mercedes-Benz_X254_1X7A6344.jpg/800px-Mercedes-Benz_X254_1X7A6344.jpg",
  },
  {
    id: "bmw_530li_m_sport_lwb",
    category: "cars",
    name: "BMW 530Li M Sport LWB",
    brand: "BMW",
    model: "5 Series",
    variant: "530Li M Sport Long Wheelbase",
    emoji: "🚘",
    aliases: ["bmw 530li", "530li", "bmw 5 series", "530li m sport"],
    price_amount: 7660000, // ₹76.60 Lakh
    currency: "INR",
    price_type: "India Ex-Showroom Price",
    price_source: "BMW India Official Price List",
    price_verified_at: "20 November 2026",
    availability_status: "Available",
    description:
      "India-spec Long Wheelbase 5 Series engineered for superior rear-seat space with M Sport styling.",
    technical_specs: {
      vehicle_type: "Executive Long-Wheelbase Sedan",
      engine: "2.0L TwinPower Turbo Inline-4 Mild-Hybrid",
      fuel_type: "Petrol",
      transmission: "8-Speed Steptronic Automatic",
      drivetrain: "Rear-Wheel Drive (RWD)",
      power: "258 hp",
      torque: "400 Nm",
    },
    image_reference:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/BMW_G60_520d_IMG_9187.jpg/800px-BMW_G60_520d_IMG_9187.jpg",
  },
  {
    id: "bmw_x3_xdrive20_m_sport",
    category: "cars",
    name: "BMW X3 xDrive20 M Sport",
    brand: "BMW",
    model: "X3",
    variant: "xDrive20 M Sport",
    emoji: "🚙",
    aliases: ["bmw x3", "x3", "x3 xdrive20"],
    price_amount: 6990000, // ₹69.90 Lakh
    currency: "INR",
    price_type: "India Ex-Showroom Price",
    price_source: "BMW India Official Price List",
    price_verified_at: "20 November 2026",
    availability_status: "Available",
    description:
      "All-wheel-drive luxury SUV with BMW Curved Display, M Sport suspension, and agile handling.",
    technical_specs: {
      vehicle_type: "Luxury Midsize SUV",
      engine: "2.0L TwinPower Turbo Inline-4 Mild-Hybrid",
      fuel_type: "Petrol",
      transmission: "8-Speed Steptronic Automatic",
      drivetrain: "xDrive All-Wheel Drive",
      power: "190 hp",
      torque: "310 Nm",
    },
    image_reference:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/2024_BMW_X3_xDrive20_M_Sport_%28G45%29.jpg/800px-2024_BMW_X3_xDrive20_M_Sport_%28G45%29.jpg",
  },
  {
    id: "bmw_330li_m_sport",
    category: "cars",
    name: "BMW 330Li M Sport",
    brand: "BMW",
    model: "3 Series Gran Limousine",
    variant: "330Li M Sport",
    emoji: "🚘",
    aliases: ["bmw 330li", "330li", "bmw 3 series", "330li m sport"],
    price_amount: 6270000, // ₹62.70 Lakh
    currency: "INR",
    price_type: "India Ex-Showroom Price",
    price_source: "BMW India Official Price List",
    price_verified_at: "20 November 2026",
    availability_status: "Available",
    description:
      "Long-wheelbase 3 Series Gran Limousine pairing 258 hp turbo-petrol punch with extended rear comfort.",
    technical_specs: {
      vehicle_type: "Luxury Sports Sedan (LWB)",
      engine: "2.0L TwinPower Turbo Inline-4",
      fuel_type: "Petrol",
      transmission: "8-Speed Steptronic Sport Automatic",
      drivetrain: "Rear-Wheel Drive (RWD)",
      power: "258 hp",
      torque: "400 Nm",
    },
    image_reference:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/BMW_G20_FL_IMG_7663.jpg/800px-BMW_G20_FL_IMG_7663.jpg",
  },
  {
    id: "bmw_x1_sdrive18d_m_sport",
    category: "cars",
    name: "BMW X1 sDrive18d M Sport",
    brand: "BMW",
    model: "X1",
    variant: "sDrive18d M Sport",
    emoji: "🚙",
    aliases: ["bmw x1", "x1", "x1 sdrive18d"],
    price_amount: 5290000, // ₹52.90 Lakh
    currency: "INR",
    price_type: "India Ex-Showroom Price",
    price_source: "BMW India Official Price List",
    price_verified_at: "20 November 2026",
    availability_status: "Available",
    description:
      "Compact luxury SUV with M Sport aerodynamics, panoramic glass roof, and efficient TwinPower Turbo diesel.",
    technical_specs: {
      vehicle_type: "Compact Luxury SUV",
      engine: "2.0L TwinPower Turbo Inline-4 Diesel",
      fuel_type: "Diesel",
      transmission: "7-Speed Steptronic Dual-Clutch",
      drivetrain: "Front-Wheel Drive (sDrive)",
      power: "150 hp",
      torque: "360 Nm",
    },
    image_reference:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/BMW_U11_IMG_7770.jpg/800px-BMW_U11_IMG_7770.jpg",
  },
  {
    id: "bmw_218_m_sport",
    category: "cars",
    name: "BMW 218 M Sport",
    brand: "BMW",
    model: "2 Series Gran Coupé",
    variant: "218 M Sport",
    emoji: "🚗",
    aliases: ["bmw 218", "218 m sport", "bmw 2 series"],
    price_amount: 4580000, // ₹45.80 Lakh
    currency: "INR",
    price_type: "India Ex-Showroom Price",
    price_source: "BMW India Official Price List",
    price_verified_at: "20 November 2026",
    availability_status: "Available",
    description:
      "Frameless-door four-door Gran Coupé offering entry into the BMW M Sport lineup.",
    technical_specs: {
      vehicle_type: "Compact Luxury Gran Coupé",
      engine: "1.5L TwinPower Turbo Inline-3",
      fuel_type: "Petrol",
      transmission: "7-Speed Steptronic Dual-Clutch",
      drivetrain: "Front-Wheel Drive",
      power: "156 hp",
      torque: "230 Nm",
    },
    image_reference:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/BMW_F44_IMG_2798.jpg/800px-BMW_F44_IMG_2798.jpg",
  },
  {
    id: "toyota_fortuner_leader_edition",
    category: "cars",
    name: "Toyota Fortuner Leader Edition 4×2 MT",
    brand: "Toyota",
    model: "Fortuner",
    variant: "Leader Edition 4×2 MT",
    emoji: "🛻",
    aliases: ["fortuner", "toyota fortuner", "fortuner leader edition"],
    price_amount: 3651000, // ₹36.51 Lakh
    currency: "INR",
    price_type: "India Ex-Showroom Price",
    price_source: "Toyota Kirloskar Motor India Official Price List",
    price_verified_at: "20 November 2026",
    availability_status: "Available",
    description:
      "Body-on-frame full-size 7-seater SUV equipped with Toyota's high-torque 2.8L GD turbo-diesel engine.",
    technical_specs: {
      vehicle_type: "Full-Size Body-on-Frame SUV",
      engine: "2.8L 4-Cylinder Turbo Diesel",
      fuel_type: "Diesel",
      transmission: "6-Speed Manual",
      drivetrain: "Rear-Wheel Drive (4×2)",
      power: "204 hp",
      torque: "420 Nm",
    },
    image_reference:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/2015_Toyota_Fortuner_%28New_Zealand%29.jpg/800px-2015_Toyota_Fortuner_%28New_Zealand%29.jpg",
  },
  {
    id: "mahindra_thar_og_axt",
    category: "cars",
    name: "Mahindra Thar OG AXT D117 CRDe Diesel RWD MT",
    brand: "Mahindra",
    model: "Thar OG",
    variant: "AXT D117 CRDe Diesel RWD MT",
    emoji: "🚙",
    aliases: ["thar", "mahindra thar", "thar og", "thar axt"],
    price_amount: 1032000, // ₹10.32 Lakh
    currency: "INR",
    price_type: "Introductory India Ex-Showroom Price",
    price_source: "Mahindra Automotive India (Introductory offer valid for deliveries until 30 November 2026)",
    price_verified_at: "20 November 2026",
    availability_status: "Introductory Offer (Valid until 30 Nov 2026)",
    description:
      "Iconic lifestyle off-roader in rear-wheel-drive D117 CRDe diesel manual trim at Mahindra's introductory ex-showroom price.",
    technical_specs: {
      vehicle_type: "Lifestyle Off-Road SUV",
      engine: "1.5L D117 CRDe 4-Cylinder Turbo Diesel",
      fuel_type: "Diesel",
      transmission: "6-Speed Manual",
      drivetrain: "Rear-Wheel Drive (RWD)",
      power: "117 bhp",
      torque: "300 Nm",
      origin_or_note: "Introductory ex-showroom price valid for deliveries until 30 November 2026",
    },
    image_reference:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Mahindra_Thar_Photoshoot_At_Perupalem_Beach_%28West_Godavari_District%2CAP%2CIndia_%29_Djdavid.jpg/800px-Mahindra_Thar_Photoshoot_At_Perupalem_Beach_%28West_Godavari_District%2CAP%2CIndia_%29_Djdavid.jpg",
  },
  {
    id: "tata_nano_xe",
    category: "cars",
    name: "Tata Nano XE",
    brand: "Tata",
    model: "Nano",
    variant: "XE (Base)",
    emoji: "🚕",
    aliases: ["nano", "tata nano", "nano xe"],
    price_amount: 236000, // ₹2.36 Lakh
    currency: "INR",
    price_type: "Discontinued — Historical Price",
    price_source: "Tata Motors India Last Recorded Ex-Showroom Base Price",
    price_verified_at: "20 November 2026",
    availability_status: "Discontinued",
    description:
      "Discontinued city micro-hatchback. ₹2.36 Lakh reflects its last recorded base-model ex-showroom price rather than active new-car production.",
    technical_specs: {
      vehicle_type: "City Micro-Hatchback",
      engine: "624cc Twin-Cylinder MPFI Petrol",
      fuel_type: "Petrol",
      transmission: "4-Speed Manual",
      drivetrain: "Rear-Engine, Rear-Wheel Drive",
      power: "38 PS",
      torque: "51 Nm",
      origin_or_note: "Discontinued model — historical last recorded ex-showroom price",
    },
    image_reference:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Tata_Nano_in_Kolkata.jpg/800px-Tata_Nano_in_Kolkata.jpg",
  },

  // ==========================================
  // 🌸 FLOWERS (Preserved Prices & Complete Collection)
  // ==========================================
  {
    id: "rose",
    category: "flowers",
    name: "Rose",
    brand: "Aloo Florals",
    model: "Classic Red Rose",
    variant: "Single Stem",
    emoji: "🌹",
    aliases: ["red rose"],
    price_amount: 150,
    currency: "INR",
    price_type: "Standard Market Price",
    price_source: "Aloo Market Catalogue",
    price_verified_at: "20 November 2026",
    availability_status: "Available",
    description: "A vibrant velvety red rose symbolising affection and celebration.",
    technical_specs: {
      vehicle_type: "Fresh Cut Flower",
      origin_or_note: "Includes animated floral presentation",
    },
    image_reference:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Rosa_rubiginosa_1.jpg/800px-Rosa_rubiginosa_1.jpg",
  },
  {
    id: "lily",
    category: "flowers",
    name: "Lily",
    brand: "Aloo Florals",
    model: "Oriental White Lily",
    variant: "Fresh Stem",
    emoji: "⚜️",
    aliases: ["white lily"],
    price_amount: 200,
    currency: "INR",
    price_type: "Standard Market Price",
    price_source: "Aloo Market Catalogue",
    price_verified_at: "20 November 2026",
    availability_status: "Available",
    description: "Fragrant trumpet-shaped lily bloom with pristine white petals.",
    technical_specs: {
      vehicle_type: "Fresh Cut Flower",
      origin_or_note: "Includes animated floral presentation",
    },
    image_reference:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Lilium_candidum_1.jpg/800px-Lilium_candidum_1.jpg",
  },
  {
    id: "tulip",
    category: "flowers",
    name: "Tulip",
    brand: "Aloo Florals",
    model: "Garden Tulip",
    variant: "Spring Bloom",
    emoji: "🌷",
    aliases: ["garden tulip"],
    price_amount: 250,
    currency: "INR",
    price_type: "Standard Market Price",
    price_source: "Aloo Market Catalogue",
    price_verified_at: "20 November 2026",
    availability_status: "Available",
    description: "Cup-shaped spring tulip prized for its clean, symmetrical silhouette.",
    technical_specs: {
      vehicle_type: "Fresh Cut Flower",
      origin_or_note: "Includes animated floral presentation",
    },
    image_reference:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Tulip_-_floriade_canberra.jpg/800px-Tulip_-_floriade_canberra.jpg",
  },
  {
    id: "sunflower",
    category: "flowers",
    name: "Sunflower",
    brand: "Aloo Florals",
    model: "Golden Sunflower",
    variant: "Large Head",
    emoji: "🌻",
    aliases: ["sun flower"],
    price_amount: 300,
    currency: "INR",
    price_type: "Standard Market Price",
    price_source: "Aloo Market Catalogue",
    price_verified_at: "20 November 2026",
    availability_status: "Available",
    description: "Bright golden-yellow sunflower radiating warmth and positivity.",
    technical_specs: {
      vehicle_type: "Fresh Cut Flower",
      origin_or_note: "Includes animated floral presentation",
    },
    image_reference:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Sunflower_sky_backdrop.jpg/800px-Sunflower_sky_backdrop.jpg",
  },
  {
    id: "jasmine",
    category: "flowers",
    name: "Jasmine",
    brand: "Aloo Florals",
    model: "Mogra Jasmine",
    variant: "Fragrant Garland",
    emoji: "🌼",
    aliases: ["mogra"],
    price_amount: 350,
    currency: "INR",
    price_type: "Standard Market Price",
    price_source: "Aloo Market Catalogue",
    price_verified_at: "20 November 2026",
    availability_status: "Available",
    description: "Delicate white jasmine blossoms prized for their sweet, calming aroma.",
    technical_specs: {
      vehicle_type: "Fragrant Blossom",
      origin_or_note: "Includes animated floral presentation",
    },
    image_reference:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Jasminum_sambac_002.JPG/800px-Jasminum_sambac_002.JPG",
  },
  {
    id: "lotus",
    category: "flowers",
    name: "Lotus",
    brand: "Aloo Florals",
    model: "Sacred Pink Lotus",
    variant: "Full Bloom",
    emoji: "🪷",
    aliases: ["pink lotus"],
    price_amount: 450,
    currency: "INR",
    price_type: "Standard Market Price",
    price_source: "Aloo Market Catalogue",
    price_verified_at: "20 November 2026",
    availability_status: "Available",
    description: "Serene multi-layered pink lotus flower symbolizing purity and grace.",
    technical_specs: {
      vehicle_type: "Aquatic Blossom",
      origin_or_note: "Includes animated floral presentation",
    },
    image_reference:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ed/Sacred_lotus_Nelumbo_nucifera.jpg/800px-Sacred_lotus_Nelumbo_nucifera.jpg",
  },
  {
    id: "orchid",
    category: "flowers",
    name: "Orchid",
    brand: "Aloo Florals",
    model: "Exotic Phalaenopsis Orchid",
    variant: "Premium Stem",
    emoji: "🌺",
    aliases: ["exotic orchid"],
    price_amount: 600,
    currency: "INR",
    price_type: "Standard Market Price",
    price_source: "Aloo Market Catalogue",
    price_verified_at: "20 November 2026",
    availability_status: "Available",
    description: "Rare tropical orchid stem with long-lasting sculpted petals.",
    technical_specs: {
      vehicle_type: "Exotic Orchid",
      origin_or_note: "Includes animated floral presentation",
    },
    image_reference:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/Orchid_high_resolution.jpg/800px-Orchid_high_resolution.jpg",
  },

  // ==========================================
  // 🏍️ BIKES (Preserved Prices & Model Names)
  // ==========================================
  {
    id: "kawasaki_ninja",
    category: "bikes",
    name: "Kawasaki Ninja",
    brand: "Kawasaki",
    model: "Ninja",
    variant: "Sport",
    emoji: "🏍️",
    aliases: ["ninja", "kawasaki"],
    price_amount: 18000,
    currency: "INR",
    price_type: "Standard Market Price",
    price_source: "Aloo Market Catalogue",
    price_verified_at: "20 November 2026",
    availability_status: "Available",
    description: "Full-faired Kawasaki Ninja sport motorcycle built for sharp cornering and highway speed.",
    technical_specs: {
      vehicle_type: "Supersport Motorcycle",
      fuel_type: "Petrol",
      transmission: "6-Speed Manual",
    },
    image_reference:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Kawasaki_Ninja_400_2018.jpg/800px-Kawasaki_Ninja_400_2018.jpg",
  },
  {
    id: "ktm",
    category: "bikes",
    name: "KTM",
    brand: "KTM",
    model: "Duke / RC",
    variant: "Street Performance",
    emoji: "🧡",
    aliases: ["ktm duke", "ktm bike"],
    price_amount: 8500,
    currency: "INR",
    price_type: "Standard Market Price",
    price_source: "Aloo Market Catalogue",
    price_verified_at: "20 November 2026",
    availability_status: "Available",
    description: "Lightweight trellis-frame streetfighter known for aggressive acceleration.",
    technical_specs: {
      vehicle_type: "Streetfighter Motorcycle",
      fuel_type: "Petrol",
      transmission: "6-Speed Manual",
    },
    image_reference:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/KTM_390_Duke_2017.jpg/800px-KTM_390_Duke_2017.jpg",
  },
  {
    id: "royal_enfield",
    category: "bikes",
    name: "Royal Enfield",
    brand: "Royal Enfield",
    model: "Classic 350",
    variant: "Cruiser",
    emoji: "🛵",
    aliases: ["enfield", "classic 350", "bullet"],
    price_amount: 6000,
    currency: "INR",
    price_type: "Standard Market Price",
    price_source: "Aloo Market Catalogue",
    price_verified_at: "20 November 2026",
    availability_status: "Available",
    description: "Timeless all-metal thumper cruiser built for relaxed highway touring.",
    technical_specs: {
      vehicle_type: "Modern Classic Cruiser",
      fuel_type: "Petrol",
      transmission: "5-Speed Manual",
    },
    image_reference:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Royal_Enfield_Classic_350.jpg/800px-Royal_Enfield_Classic_350.jpg",
  },
  {
    id: "suzuki",
    category: "bikes",
    name: "Suzuki",
    brand: "Suzuki",
    model: "Gixxer SF",
    variant: "Sport Commuter",
    emoji: "🏁",
    aliases: ["suzuki gixxer", "gixxer"],
    price_amount: 4500,
    currency: "INR",
    price_type: "Standard Market Price",
    price_source: "Aloo Market Catalogue",
    price_verified_at: "20 November 2026",
    availability_status: "Available",
    description: "Refined Japanese sport-commuter motorcycle with crisp handling and reliability.",
    technical_specs: {
      vehicle_type: "Sport Commuter Motorcycle",
      fuel_type: "Petrol",
      transmission: "5-Speed Manual",
    },
    image_reference:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Suzuki_Gixxer_SF.jpg/800px-Suzuki_Gixxer_SF.jpg",
  },
  {
    id: "yamaha_r15",
    category: "bikes",
    name: "Yamaha R15",
    brand: "Yamaha",
    model: "YZF-R15",
    variant: "V4",
    emoji: "⚡",
    aliases: ["r15", "yamaha"],
    price_amount: 3800,
    currency: "INR",
    price_type: "Standard Market Price",
    price_source: "Aloo Market Catalogue",
    price_verified_at: "20 November 2026",
    availability_status: "Available",
    description: "Track-inspired Deltabox-frame sport bike with Variable Valve Actuation.",
    technical_specs: {
      vehicle_type: "Entry Supersport Motorcycle",
      fuel_type: "Petrol",
      transmission: "6-Speed Manual",
    },
    image_reference:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Yamaha_YZF-R15.jpg/800px-Yamaha_YZF-R15.jpg",
  },
  {
    id: "splendor",
    category: "bikes",
    name: "Splendor",
    brand: "Hero",
    model: "Splendor Plus",
    variant: "Commuter",
    emoji: "🚲",
    aliases: ["hero splendor", "splendor plus"],
    price_amount: 1500,
    currency: "INR",
    price_type: "Standard Market Price",
    price_source: "Aloo Market Catalogue",
    price_verified_at: "20 November 2026",
    availability_status: "Available",
    description: "India's legendary everyday commuter motorcycle renowned for unmatched mileage and durability.",
    technical_specs: {
      vehicle_type: "Commuter Motorcycle",
      fuel_type: "Petrol",
      transmission: "4-Speed Manual",
    },
    image_reference:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Hero_Honda_Splendor.jpg/800px-Hero_Honda_Splendor.jpg",
  },

  // ==========================================
  // 🍔 FOOD (Preserved Prices & Complete Collection)
  // ==========================================
  {
    id: "pizza",
    category: "food",
    name: "Pizza",
    brand: "Aloo Kitchen",
    model: "Wood-Fired Cheese Pizza",
    variant: "Medium",
    emoji: "🍕",
    aliases: ["cheese pizza"],
    price_amount: 250,
    currency: "INR",
    price_type: "Standard Market Price",
    price_source: "Aloo Market Catalogue",
    price_verified_at: "20 November 2026",
    availability_status: "Available",
    description: "Crispy hand-tossed crust layered with rich tomato sauce, mozzarella, and herbs.",
    technical_specs: {
      vehicle_type: "Hot Meal",
      origin_or_note: "Freshly baked on order",
    },
    image_reference:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Eq_it-na_pizza-margherita_sep2005_sml.jpg/800px-Eq_it-na_pizza-margherita_sep2005_sml.jpg",
  },
  {
    id: "biryani",
    category: "food",
    name: "Biryani",
    brand: "Aloo Kitchen",
    model: "Royal Dum Biryani",
    variant: "Full Handi",
    emoji: "🍛",
    aliases: ["dum biryani"],
    price_amount: 200,
    currency: "INR",
    price_type: "Standard Market Price",
    price_source: "Aloo Market Catalogue",
    price_verified_at: "20 November 2026",
    availability_status: "Available",
    description: "Aromatic long-grain basmati rice slow-cooked with saffron and whole spices.",
    technical_specs: {
      vehicle_type: "Main Course",
      origin_or_note: "Served with raita",
    },
    image_reference:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/%22Hyderabadi_Dum_Biryani%22.jpg/800px-%22Hyderabadi_Dum_Biryani%22.jpg",
  },
  {
    id: "tacos",
    category: "food",
    name: "Tacos",
    brand: "Aloo Kitchen",
    model: "Crispy Street Tacos",
    variant: "Set of 2",
    emoji: "🌮",
    aliases: ["taco"],
    price_amount: 180,
    currency: "INR",
    price_type: "Standard Market Price",
    price_source: "Aloo Market Catalogue",
    price_verified_at: "20 November 2026",
    availability_status: "Available",
    description: "Warm tortillas loaded with seasoned filling, fresh salsa, and zesty lime.",
    technical_specs: {
      vehicle_type: "Street Snack",
    },
    image_reference:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/001_Tacos_de_carnitas%2C_carne_asada_y_al_pastor.jpg/800px-001_Tacos_de_carnitas%2C_carne_asada_y_al_pastor.jpg",
  },
  {
    id: "burger",
    category: "food",
    name: "Burger",
    brand: "Aloo Kitchen",
    model: "Classic Aloo Supreme Burger",
    variant: "Double Cheese",
    emoji: "🍔",
    aliases: ["cheese burger", "aloo burger"],
    price_amount: 150,
    currency: "INR",
    price_type: "Standard Market Price",
    price_source: "Aloo Market Catalogue",
    price_verified_at: "20 November 2026",
    availability_status: "Available",
    description: "Toasted brioche bun stacked with a crisp patty, melted cheddar, and house sauce.",
    technical_specs: {
      vehicle_type: "Fast Food Meal",
    },
    image_reference:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/RedDot_Burger.jpg/800px-RedDot_Burger.jpg",
  },
  {
    id: "momos",
    category: "food",
    name: "Momos",
    brand: "Aloo Kitchen",
    model: "Steamed Himalayan Momos",
    variant: "Plate of 8",
    emoji: "🥟",
    aliases: ["momo", "dumplings"],
    price_amount: 100,
    currency: "INR",
    price_type: "Standard Market Price",
    price_source: "Aloo Market Catalogue",
    price_verified_at: "20 November 2026",
    availability_status: "Available",
    description: "Delicate steamed dumplings served piping hot with spicy red chutney.",
    technical_specs: {
      vehicle_type: "Street Snack",
    },
    image_reference:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Momo_nepal.jpg/800px-Momo_nepal.jpg",
  },
  {
    id: "samosa",
    category: "food",
    name: "Samosa",
    brand: "Aloo Kitchen",
    model: "Crispy Punjabi Aloo Samosa",
    variant: "Pair (2 pcs)",
    emoji: "🥟",
    aliases: ["aloo samosa"],
    price_amount: 50,
    currency: "INR",
    price_type: "Standard Market Price",
    price_source: "Aloo Market Catalogue",
    price_verified_at: "20 November 2026",
    availability_status: "Available",
    description: "Golden flaky pastry stuffed with spiced potatoes and green peas, served with chutney.",
    technical_specs: {
      vehicle_type: "Classic Indian Snack",
    },
    image_reference:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Samosachutney.jpg/800px-Samosachutney.jpg",
  },
] as const;

const CATALOG_BY_ID = new Map<string, MarketProduct>(
  MARKET_CATALOG.map((item) => [item.id, item])
);

export function isValidShopCategory(raw: string): raw is ShopCategoryKey {
  return raw === "cars" || raw === "flowers" || raw === "bikes" || raw === "food";
}

export function getShopItemsByCategory(category: ShopCategoryKey): MarketProduct[] {
  const items = MARKET_CATALOG.filter((item) => item.category === category);
  if (category === "cars") {
    return [...items].sort((a, b) => b.price_amount - a.price_amount);
  }
  return items;
}

export function getShopItemById(itemId: string): MarketProduct | undefined {
  return CATALOG_BY_ID.get(itemId.toLowerCase().trim());
}

export function formatRupees(amount: number): string {
  return `₹${Math.floor(amount).toLocaleString("en-IN")}`;
}

export function formatCompactIndianPrice(amount: number): string {
  const value = Math.floor(amount);
  if (value >= 10_000_000) {
    const crores = value / 10_000_000;
    const formatted = Number.isInteger(crores)
      ? String(crores)
      : crores.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
    // Keep at least 2 decimal places when fractional (e.g. 3.20 Crore)
    const parts = formatted.split(".");
    if (parts.length === 2 && parts[1].length === 1) {
      return `₹${parts[0]}.${parts[1]}0 Crore`;
    }
    return `₹${formatted} Crore`;
  }
  if (value >= 100_000) {
    const lakhs = value / 100_000;
    const formatted = Number.isInteger(lakhs)
      ? String(lakhs)
      : lakhs.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
    const parts = formatted.split(".");
    if (parts.length === 2 && parts[1].length === 1) {
      return `₹${parts[0]}.${parts[1]}0 Lakh`;
    }
    return `₹${formatted} Lakh`;
  }
  return formatRupees(value);
}

function normalizeQueryText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/×/g, "x")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export type MarketItemResolution =
  | { status: "exact"; item: MarketProduct }
  | { status: "ambiguous"; matches: MarketProduct[] }
  | { status: "not_found" };

export function resolveMarketItem(rawQuery: string): MarketItemResolution {
  const qNorm = normalizeQueryText(rawQuery);
  if (!qNorm) return { status: "not_found" };

  // Pass 1: Exact match on normalized ID, full name, or explicit alias
  const exactMatches: MarketProduct[] = [];
  for (const item of MARKET_CATALOG) {
    const idNorm = normalizeQueryText(item.id);
    const nameNorm = normalizeQueryText(item.name);
    const aliasNorms = item.aliases.map((a) => normalizeQueryText(a));

    if (qNorm === idNorm || qNorm === nameNorm || aliasNorms.includes(qNorm)) {
      exactMatches.push(item);
    }
  }

  if (exactMatches.length === 1) {
    return { status: "exact", item: exactMatches[0] };
  }
  if (exactMatches.length > 1) {
    return { status: "ambiguous", matches: exactMatches };
  }

  // Pass 2: Token-level match across name, brand, model, variant, and aliases
  const queryTokens = qNorm.split(" ").filter(Boolean);
  const partialMatches: MarketProduct[] = [];

  for (const item of MARKET_CATALOG) {
    const searchable = normalizeQueryText(
      [item.name, item.brand, item.model, item.variant, ...item.aliases].join(" ")
    );
    const itemTokens = searchable.split(" ").filter(Boolean);

    const allTokensMatch = queryTokens.every((qt) =>
      itemTokens.some((it) => it === qt || (qt.length >= 3 && it.startsWith(qt)))
    );

    if (allTokensMatch) {
      partialMatches.push(item);
    }
  }

  if (partialMatches.length === 1) {
    return { status: "exact", item: partialMatches[0] };
  }
  if (partialMatches.length > 1) {
    return { status: "ambiguous", matches: partialMatches };
  }

  return { status: "not_found" };
}

export function calculateMarketPrice(
  basePrice: number,
  volatility: number,
  currentTimestamp: number
): number {
  const timeFactor = currentTimestamp / 300.0;
  const fluctuation = Math.sin(timeFactor);
  let finalPrice = basePrice + basePrice * volatility * fluctuation;

  if (finalPrice < basePrice * 0.1) {
    finalPrice = basePrice * 0.1;
  }
  return Math.floor(finalPrice);
}
