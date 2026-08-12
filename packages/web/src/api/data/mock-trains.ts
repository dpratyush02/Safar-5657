/**
 * Mock Indian Railways data — used whenever no real train-status provider is configured.
 * Shape mirrors what `services/trainApi.ts` returns, so swapping in a real API changes nothing
 * downstream.
 */

export type MockStation = {
  /** Station name as shown in the UI. */
  name: string;
  /** Station code (e.g. BBS). */
  code: string;
  /** Distance from origin in km — drives progress + position maths. */
  km: number;
  /** Scheduled arrival, 24h "HH:MM". */
  scheduled: string;
};

export type MockTrain = {
  number: string;
  name: string;
  from: string;
  fromCode: string;
  to: string;
  toCode: string;
  /** Minutes the train is running late (0 = on time). */
  delayMinutes: number;
  /** Average running speed in km/h, used for expected-arrival maths. */
  avgSpeed: number;
  /** How long a full demo journey takes in real time (ms) before it loops. */
  demoCycleMs: number;
  /** Where the demo journey starts, as a fraction of the route (0–1). */
  demoSeed: number;
  stations: MockStation[];
};

export const MOCK_TRAINS: MockTrain[] = [
  {
    number: "18402",
    name: "Puri – New Jalpaiguri Express",
    from: "Bhubaneswar",
    fromCode: "BBS",
    to: "New Jalpaiguri",
    toCode: "NJP",
    delayMinutes: 8,
    avgSpeed: 78,
    demoCycleMs: 16 * 60 * 1000,
    demoSeed: 0.47,
    stations: [
      { name: "Bhubaneswar", code: "BBS", km: 0, scheduled: "20:10" },
      { name: "Cuttack", code: "CTC", km: 28, scheduled: "20:45" },
      { name: "Jajpur Keonjhar Road", code: "JJKR", km: 96, scheduled: "21:52" },
      { name: "Balasore", code: "BLS", km: 202, scheduled: "23:20" },
      { name: "Kharagpur", code: "KGP", km: 320, scheduled: "01:05" },
      { name: "Howrah", code: "HWH", km: 436, scheduled: "03:00" },
      { name: "Bandel", code: "BDC", km: 476, scheduled: "03:55" },
      { name: "Malda Town", code: "MLDT", km: 764, scheduled: "08:10" },
      { name: "New Jalpaiguri", code: "NJP", km: 1000, scheduled: "12:30" },
    ],
  },
  {
    number: "12841",
    name: "Coromandel Express",
    from: "Shalimar",
    fromCode: "SHM",
    to: "MGR Chennai Central",
    toCode: "MAS",
    delayMinutes: 0,
    avgSpeed: 84,
    demoCycleMs: 18 * 60 * 1000,
    demoSeed: 0.22,
    stations: [
      { name: "Shalimar", code: "SHM", km: 0, scheduled: "14:30" },
      { name: "Kharagpur", code: "KGP", km: 116, scheduled: "16:05" },
      { name: "Balasore", code: "BLS", km: 234, scheduled: "17:38" },
      { name: "Bhadrak", code: "BHC", km: 296, scheduled: "18:30" },
      { name: "Cuttack", code: "CTC", km: 406, scheduled: "20:05" },
      { name: "Bhubaneswar", code: "BBS", km: 434, scheduled: "20:35" },
      { name: "Visakhapatnam", code: "VSKP", km: 878, scheduled: "02:40" },
      { name: "Vijayawada", code: "BZA", km: 1228, scheduled: "07:25" },
      { name: "MGR Chennai Central", code: "MAS", km: 1660, scheduled: "12:50" },
    ],
  },
  {
    number: "12951",
    name: "Mumbai Rajdhani Express",
    from: "Mumbai Central",
    fromCode: "MMCT",
    to: "New Delhi",
    toCode: "NDLS",
    delayMinutes: 3,
    avgSpeed: 96,
    demoCycleMs: 14 * 60 * 1000,
    demoSeed: 0.66,
    stations: [
      { name: "Mumbai Central", code: "MMCT", km: 0, scheduled: "17:00" },
      { name: "Borivali", code: "BVI", km: 30, scheduled: "17:24" },
      { name: "Surat", code: "ST", km: 263, scheduled: "19:43" },
      { name: "Vadodara", code: "BRC", km: 392, scheduled: "21:03" },
      { name: "Ratlam", code: "RTM", km: 653, scheduled: "00:20" },
      { name: "Kota", code: "KOTA", km: 918, scheduled: "03:35" },
      { name: "Mathura", code: "MTJ", km: 1250, scheduled: "07:03" },
      { name: "New Delhi", code: "NDLS", km: 1385, scheduled: "08:35" },
    ],
  },
  {
    number: "12626",
    name: "Kerala Express",
    from: "Thiruvananthapuram Central",
    fromCode: "TVC",
    to: "New Delhi",
    toCode: "NDLS",
    delayMinutes: 22,
    avgSpeed: 62,
    demoCycleMs: 20 * 60 * 1000,
    demoSeed: 0.34,
    stations: [
      { name: "Thiruvananthapuram Central", code: "TVC", km: 0, scheduled: "11:15" },
      { name: "Kollam", code: "QLN", km: 65, scheduled: "12:12" },
      { name: "Ernakulam Town", code: "ERN", km: 221, scheduled: "14:35" },
      { name: "Thrissur", code: "TCR", km: 296, scheduled: "15:42" },
      { name: "Coimbatore", code: "CBE", km: 421, scheduled: "17:50" },
      { name: "Salem", code: "SA", km: 574, scheduled: "20:05" },
      { name: "Bengaluru Cantt", code: "BNC", km: 762, scheduled: "23:35" },
      { name: "Nagpur", code: "NGP", km: 1848, scheduled: "16:40" },
      { name: "Bhopal", code: "BPL", km: 2238, scheduled: "22:35" },
      { name: "New Delhi", code: "NDLS", km: 3054, scheduled: "10:45" },
    ],
  },
];

/** Filler names used to synthesize a plausible route for an unknown train number. */
const FILLER_STATIONS: Array<[string, string]> = [
  ["Junction Road", "JNR"],
  ["Rampur", "RMP"],
  ["Chandanpur", "CDP"],
  ["Nayagarh", "NYG"],
  ["Sitapur", "STP"],
  ["Bhatpara", "BTP"],
  ["Devgarh", "DVG"],
];

/** Deterministic 0–1 hash so the same train number always produces the same demo journey. */
function seededRandom(seed: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/**
 * Any train number should "work" in the demo — unknown numbers get a stable synthesized route
 * instead of an error, so the experience never dead-ends.
 */
export function synthesizeTrain(trainNumber: string): MockTrain {
  const base = MOCK_TRAINS[Math.floor(seededRandom(trainNumber, 1) * MOCK_TRAINS.length)]!;
  const stopCount = 5 + Math.floor(seededRandom(trainNumber, 2) * 3);
  const totalKm = 420 + Math.floor(seededRandom(trainNumber, 3) * 900);

  // Sample filler stations without replacement so a synthesized route never repeats a name.
  const pool = FILLER_STATIONS.slice();
  const middle = Array.from({ length: stopCount - 2 }, (_, i) => {
    const pick = Math.floor(seededRandom(trainNumber, 10 + i) * pool.length);
    const [name, code] = pool.length > 0 ? pool.splice(pick, 1)[0]! : FILLER_STATIONS[i % FILLER_STATIONS.length]!;
    const fraction = (i + 1) / (stopCount - 1);
    const hour = (6 + Math.round(fraction * 14)) % 24;
    return {
      name,
      code: `${code}${i + 1}`,
      km: Math.round(totalKm * fraction),
      scheduled: `${String(hour).padStart(2, "0")}:${i % 2 === 0 ? "25" : "50"}`,
    };
  });

  return {
    ...base,
    number: trainNumber,
    name: `${base.from} – ${base.to} Express`,
    delayMinutes: Math.floor(seededRandom(trainNumber, 4) * 30),
    avgSpeed: 55 + Math.floor(seededRandom(trainNumber, 5) * 45),
    demoSeed: seededRandom(trainNumber, 6),
    stations: [
      { ...base.stations[0]!, km: 0 },
      ...middle,
      { ...base.stations[base.stations.length - 1]!, km: totalKm },
    ],
  };
}

export function findMockTrain(trainNumber: string): MockTrain {
  return MOCK_TRAINS.find((t) => t.number === trainNumber) ?? synthesizeTrain(trainNumber);
}
