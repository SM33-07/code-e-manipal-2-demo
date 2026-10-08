/**
 * CODE-e-MANIPAL 2.0 — Authoritative Event Constants & Reconciled Data
 *
 * Source: Official Unstop Listing (Audited & Reconciled Stage B)
 * https://unstop.com/hackathons/code-e-manipal-20-manipal-university-mu-jaipur-1762000
 */

export const EVENT_IDENTITY = {
  name: "Code-e-Manipal 2.0",
  edition: "2nd Edition",
  organizer: "LearnIT (Official IT Club of MUJ)",
  hostInstitution: "Manipal University Jaipur (MUJ)",
  location: "Manipal University Jaipur Campus, Dehmi Kalan, Jaipur, Rajasthan",
  mode: "Hybrid",
  durationHours: 36,
  finaleDates: "15–16 October 2026",
} as const;

export const TEAM_CONSTRAINTS = {
  minMembers: 1,
  maxMembers: 6,
} as const;

export const OFFICIAL_TRACKS = [
  "AI/ML",
  "HealthTech",
  "FinTech/EdTech",
  "Cybersecurity",
  "Generative AI & LLMs",
  "Multi-Agent Systems",
  "Gaming & Immersive Tech",
  "Smart City and Infrastructure",
  "Open Innovation",
] as const;

export type OfficialTrack = (typeof OFFICIAL_TRACKS)[number];

export interface TrackMetadata {
  id: string;
  tag: string;
  title: OfficialTrack;
  desc: string;
  focus: string;
}

export const DETAILED_TRACKS: TrackMetadata[] = [
  {
    id: "ai-ml",
    tag: "TRACK 01",
    title: "AI/ML",
    desc: "Predictive modeling, neural architectures, computer vision, vernacular intelligence, and edge-native model deployments.",
    focus: "Machine Learning, Deep Learning, Edge Inference, Computer Vision",
  },
  {
    id: "healthtech",
    tag: "TRACK 02",
    title: "HealthTech",
    desc: "Clinical workflow optimization, remote diagnostics, biomedical telemetry, and privacy-preserving patient health records.",
    focus: "Diagnostics, Remote Care, Medical Telemetry, FHIR / Health Records",
  },
  {
    id: "fintech-edtech",
    tag: "TRACK 03",
    title: "FinTech/EdTech",
    desc: "High-throughput financial state machines, algorithmic fraud triage, adaptive pedagogies, and accessible education pipelines.",
    focus: "Payment Rails, Anomaly Detection, Interactive Learning, EdTech Analytics",
  },
  {
    id: "cybersecurity",
    tag: "TRACK 04",
    title: "Cybersecurity",
    desc: "Resilient infrastructure, cryptographic consensus, threat intelligence orchestration, and automated vulnerability remediation.",
    focus: "Threat Intelligence, Network Defense, Cryptography, Security Auditing",
  },
  {
    id: "genai-llms",
    tag: "TRACK 05",
    title: "Generative AI & LLMs",
    desc: "Fine-tuned domain LLMs, retrieval-augmented generation (RAG), multimodal foundation models, and reasoning engines.",
    focus: "LLMs, RAG Architectures, Multimodal Generative Systems, Context Pipelines",
  },
  {
    id: "multi-agent-systems",
    tag: "TRACK 06",
    title: "Multi-Agent Systems",
    desc: "Autonomous agent collaboration, distributed task delegation, negotiation frameworks, and emergent swarm intelligence.",
    focus: "Agentic Workflows, Tool Use, Swarm Intelligence, Autonomous Planners",
  },
  {
    id: "gaming-immersive",
    tag: "TRACK 07",
    title: "Gaming & Immersive Tech",
    desc: "Real-time graphics, physics simulation, procedural generation, spatial compute, AR/VR experiences, and game engines.",
    focus: "Real-Time 3D, Spatial Computing, AR/VR, Procedural Engines",
  },
  {
    id: "smart-city-infra",
    tag: "TRACK 08",
    title: "Smart City and Infrastructure",
    desc: "Sensory grid optimization, urban telemetry pipelines, civic resilience, intelligent transit, and sustainable microgrids.",
    focus: "IoT Telemetry, Grid Optimization, Urban Analytics, Civic Infrastructure",
  },
  {
    id: "open-innovation",
    tag: "TRACK 09",
    title: "Open Innovation",
    desc: "Unbounded problem definition for bold cross-disciplinary breakthroughs, novel engineering systems, and student-driven ideas.",
    focus: "Novel Architectures, Cross-Domain Breakthroughs, Original Problem Briefs",
  },
];

export const PRIZE_STRUCTURE = {
  advertisedTotal: "₹4,00,000+",
  winner: "₹50,000 Cash + Certificate",
  firstRunnerUp: "₹30,000 Cash + Certificate",
  secondRunnerUp: "₹20,000 Cash + Certificate",
  top10: "Certificate + ₹5,000+ worth of In-Kind Rewards + Exclusive Perks",
  additionalPerks: "₹3,00,000 cumulative value in credits, tools, and partner perks",
} as const;

export const REGISTRATION_DETAILS = {
  platform: "Unstop",
  url: "https://unstop.com/hackathons/code-e-manipal-20-manipal-university-mu-jaipur-1762000",
  startDate: "27 September 2026, 12:00 AM IST",
  deadline: "11 October 2026, 11:59 PM IST",
  refundPolicy: "Non-refundable",
  round1Fee: {
    muj: "₹59 / person",
    nonMuj: "₹89 / person",
  },
  round2Fee: {
    muj: "₹219 / person",
    nonMuj: "₹250 / person",
  },
} as const;

export const ROUND_1_QUALIFIER = {
  name: "Round 1: Online Assessment",
  platform: "Unstop",
  questionCount: 10,
  durationMinutes: 10,
  maxMarks: 10,
  negativeMarking: false,
  window: "27 September 2026 – 11 October 2026",
  topics: [
    "Programming Fundamentals",
    "Logical Reasoning",
    "Computer Science Fundamentals",
    "Problem Solving / Output Prediction",
  ],
  shortlistDate: "11 October 2026",
} as const;

export const ROUND_2_FINALE = {
  name: "Round 2: Offline Finale",
  dates: "15–16 October 2026",
  venue: "Manipal University Jaipur Campus",
  durationHours: 36,
  physicalPresenceRequired: true,
  format: "Live project demo, technical pitch, and comprehensive Q&A in front of a jury panel",
} as const;

export const FACILITIES_PROVIDED = [
  "Continuous electricity supply and dedicated power points at all team workstations",
  "High-speed campus Wi-Fi access throughout the 36-hour sprint",
  "Designated classrooms, work desks, and seating allocations",
  "Meals & refreshments: Day 1 Lunch & Dinner for all participants; Day 2 Breakfast for finalists",
  "Basic sleeping arrangements (mattresses/rest areas) for overnight hacking",
  "On-campus emergency medical aid and 24/7 security presence",
  "Mentorship, technical support, and logistical assistance via on-site administration",
] as const;
