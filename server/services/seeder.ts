/**
 * seeder — populates the system with realistic mock intelligence items on first run.
 *
 * Checks whether items already exist before inserting, so it is safe to call
 * on every startup (idempotent).
 */

import { db } from "../config/db.js";
import { collectedItems, itemAnalysis } from "../../shared/schema.js";
import { count } from "drizzle-orm";
import { logger } from "../middleware/logger.js";

// ── Mock items ────────────────────────────────────────────────────────────────

const MOCK_ITEMS = [
  {
    title: "AI-powered mental health apps: are they truly HIPAA compliant?",
    content:
      "I've been researching mental health apps that claim to use AI for therapy support. After digging into their privacy policies, I'm concerned that many of them aren't actually HIPAA compliant despite their marketing claims. The data handling practices seem questionable at best — sharing aggregated user data with third-party advertisers while claiming patient confidentiality. Has anyone done a deep dive on this? I'm particularly looking at platforms that offer CBT-based chatbots. Would love to hear from healthcare IT professionals.",
    source: "reddit",
    url: "https://reddit.com/r/HealthTech/comments/example1",
    author: "healthtech_researcher",
    tags: ["HIPAA", "mental health", "AI", "compliance", "privacy"],
    status: "reviewed" as const,
    collectedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    title: "Digital therapeutics startup raises $45M Series B for chronic disease management",
    content:
      "Luminary Health, a San Francisco-based digital therapeutics company, announced a $45 million Series B funding round led by Andreessen Horowitz, with participation from Mayo Clinic Ventures. The company's AI platform delivers personalized chronic disease management programs for diabetes, hypertension, and cardiovascular conditions. The platform has demonstrated a 34% reduction in hospital readmissions across its 50,000-patient clinical network. The new funding will be used to expand into mental health applications and international markets.",
    source: "rss",
    url: "https://techcrunch.com/example-article",
    author: "TechCrunch Staff",
    tags: ["funding", "digital therapeutics", "AI", "chronic disease", "Series B"],
    status: "reviewed" as const,
    collectedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
  },
  {
    title: "Partnership Inquiry: AI-Assisted Telehealth Platform Integration",
    content:
      "Hello iHeal AI team, I'm the Chief Digital Officer at MedConnect Health, a telehealth platform serving over 200,000 patients across 14 states. We've been evaluating AI solutions to enhance our clinical workflows and improve patient engagement. After reviewing your platform capabilities, I believe there's a compelling opportunity to integrate iHeal AI's intelligence layer with our existing telehealth infrastructure. We're particularly interested in your real-time clinical decision support features and patient sentiment analysis capabilities. Would it be possible to schedule a discovery call this week? We're looking to move quickly on a Q1 partnership decision.",
    source: "email",
    url: null,
    author: "Dr. James Whitfield, CDO MedConnect Health",
    tags: ["partnership", "telehealth", "integration", "enterprise"],
    status: "reviewed" as const,
    collectedAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
  },
  {
    title: "My 6-month experience using an AI therapy companion app",
    content:
      "I want to share my experience after using an AI mental health app for the past 6 months. Going in, I was skeptical — could an AI really help with anxiety and mild depression? The results surprised me. The daily check-ins kept me accountable, the CBT exercises were actually helpful, and having 24/7 access meant I could use it during late-night anxiety spikes when my therapist wasn't available. That said, it absolutely doesn't replace real therapy. There were moments when I needed human connection that the AI couldn't provide. My recommendation: use it as a supplement, not a replacement. The progress tracking features are excellent.",
    source: "reddit",
    url: "https://reddit.com/r/mentalhealth/comments/example4",
    author: "anxious_but_okay",
    tags: ["mental health", "user experience", "AI therapy", "CBT", "review"],
    status: "reviewed" as const,
    collectedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
  },
  {
    title: "FDA clears AI algorithm for early sepsis detection in ICU patients",
    content:
      "The FDA has granted 510(k) clearance to SepsisSense AI, an artificial intelligence system designed to detect early signs of sepsis in intensive care unit patients up to 6 hours before traditional clinical recognition. The algorithm analyzes continuous vital sign streams, lab values, and nursing documentation to generate risk scores updated every 15 minutes. In a multicenter trial across 12 academic medical centers, the system demonstrated 91% sensitivity and 87% specificity for sepsis onset, potentially saving thousands of lives annually. The tool is now available through Epic and Cerner EHR integrations.",
    source: "rss",
    url: "https://healthit.com/example-fda-clearance",
    author: "HealthIT News Desk",
    tags: ["FDA", "sepsis", "ICU", "AI", "clearance", "patient safety"],
    status: "reviewed" as const,
    collectedAt: new Date(Date.now() - 18 * 60 * 60 * 1000),
  },
  {
    title: "Request for Demo: AI Platform for Behavioral Health Clinics",
    content:
      "Hi, I'm reaching out on behalf of Clarity Behavioral Health, a group of 12 outpatient mental health clinics across the Pacific Northwest. We serve approximately 8,500 active patients and are looking to implement an AI-powered intake and triage system to reduce our current 4-week wait times. We're specifically interested in: automated intake forms with NLP analysis, risk stratification for appointment prioritization, care gap identification, and therapist-patient matching algorithms. Could you provide a product demo tailored to behavioral health workflows? We have budget allocated for Q1 implementation.",
    source: "email",
    url: null,
    author: "Operations Director, Clarity Behavioral Health",
    tags: ["demo request", "behavioral health", "triage", "NLP", "enterprise"],
    status: "reviewed" as const,
    collectedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
  },
  {
    title: "AI documentation tools are burning out nurses — constant corrections needed",
    content:
      "I'm a floor nurse with 8 years of experience and I need to vent about the AI documentation tool our hospital deployed 3 months ago. The time savings they promised are completely negated by the time we spend correcting errors. Yesterday I spent 20 minutes fixing a clinical note where the AI misclassified a patient's allergic reaction. The false confidence of the generated text is the most dangerous part — junior nurses might not catch subtle clinical errors. Our unit's satisfaction scores have dropped 40% since implementation. Has anyone found workflows that actually work? Our administration refuses to acknowledge the problems.",
    source: "reddit",
    url: "https://reddit.com/r/nursing/comments/example10",
    author: "RN_frustrated",
    tags: ["clinical documentation", "AI critique", "nursing", "workflow", "patient safety"],
    status: "reviewed" as const,
    collectedAt: new Date(Date.now() - 30 * 60 * 60 * 1000),
  },
  {
    title: "Comparing the top 5 AI clinical decision support tools in 2024",
    content:
      "After 3 months of evaluation across our health system, here's our clinical informatics team's assessment of the leading AI clinical decision support platforms. We evaluated each on: evidence base quality, EHR integration depth, alert fatigue burden, customization options, and total cost of ownership. The clear leaders in our evaluation were tools that prioritized reducing alert fatigue through intelligent prioritization — our previous system generated 400+ alerts per physician per day with a 96% override rate. The best performers used contextual AI to reduce this to under 50 high-confidence alerts. Full breakdown of each platform available upon request.",
    source: "reddit",
    url: "https://reddit.com/r/HealthcareAI/comments/example14",
    author: "clinical_informatics_md",
    tags: ["clinical decision support", "comparison", "evaluation", "EHR", "alert fatigue"],
    status: "reviewed" as const,
    collectedAt: new Date(Date.now() - 36 * 60 * 60 * 1000),
  },
  {
    title: "Researchers find AI outperforms radiologists in early lung cancer detection",
    content:
      "A landmark study published in Nature Medicine demonstrates that a deep learning AI system outperforms experienced radiologists in detecting early-stage lung cancers from low-dose CT scans. The AI achieved a 94.4% AUC compared to 91.3% for the radiologist panel, while also reducing false positives by 11.2%. The study analyzed 42,290 high-risk screening scans from 6 academic medical centers. Researchers emphasize the system is designed to augment rather than replace radiologist judgment, flagging suspicious regions for expert review. Commercial deployment is expected within 18 months pending FDA clearance.",
    source: "rss",
    url: "https://statnews.com/example-lung-cancer",
    author: "STAT News",
    tags: ["radiology", "lung cancer", "deep learning", "clinical study", "FDA"],
    status: "reviewed" as const,
    collectedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
  },
  {
    title: "New enterprise inquiry: Regional Health System requesting platform evaluation",
    content:
      "Inbound enterprise lead from Summit Regional Health System (SRHS), a 6-hospital network with 1,800 licensed beds across three states. Contact: VP of Innovation, Dr. Patricia Okafor. Organization is currently in vendor evaluation phase for an AI intelligence and analytics platform to support their population health management program. Budget range indicated: $500K–$1.2M annual contract. Timeline: decision expected within 60 days. SRHS serves 340,000 covered lives and is looking to reduce preventable readmissions and improve care coordination across their ACO. Request: detailed RFP response and executive briefing.",
    source: "webhook",
    url: null,
    author: "CRM Integration",
    tags: ["enterprise", "CRM", "RFP", "population health", "high value"],
    status: "new" as const,
    collectedAt: new Date(Date.now() - 20 * 60 * 1000),
  },
  {
    title: "Mental health tech market to reach $22B by 2028, new report finds",
    content:
      "A comprehensive market analysis from Grand View Research projects the global mental health technology market will reach $22.1 billion by 2028, growing at a CAGR of 16.5% from 2023. Key growth drivers include increased awareness of mental health conditions post-pandemic, smartphone penetration in emerging markets, and growing acceptance of digital-first mental healthcare delivery. North America currently holds the largest market share at 38%, followed by Europe at 29%. AI-powered applications, including mood tracking, CBT delivery, and crisis intervention tools, represent the fastest-growing segment at 24% CAGR.",
    source: "rss",
    url: "https://forbes.com/health/example-market-report",
    author: "Forbes Health",
    tags: ["market research", "mental health tech", "market size", "growth", "AI"],
    status: "new" as const,
    collectedAt: new Date(Date.now() - 45 * 60 * 1000),
  },
  {
    title: "New platform signup: Stanford Medical Center research team",
    content:
      "New user registration: Dr. Sarah Chen, Principal Investigator, Stanford Medicine AI Lab. Affiliation: Stanford Medical Center, Department of Biomedical Informatics. Research focus: Large language model applications in clinical NLP and patient-reported outcomes. Dr. Chen's lab has published 34 peer-reviewed articles on AI in healthcare and has active NIH R01 funding. Account type: Research. Indicated interest in: API access for research integration, clinical NLP benchmarking tools, and academic partnership program.",
    source: "webhook",
    url: null,
    author: "Platform Signup System",
    tags: ["new user", "research", "Stanford", "academic", "API"],
    status: "archived" as const,
    collectedAt: new Date(Date.now() - 72 * 60 * 60 * 1000),
  },
  {
    title: "Telehealth platform reports 340% increase in AI-assisted diagnoses",
    content:
      "HealthFirst Telehealth announced Q3 results showing a 340% year-over-year increase in AI-assisted diagnostic consultations on their platform. The company's proprietary AI triage system now handles initial symptom assessment for 78% of new patient consultations, reducing average time-to-physician from 47 minutes to 12 minutes. Patient satisfaction scores for AI-first consultations averaged 4.2/5.0, compared to 4.4/5.0 for traditional physician-first encounters. The company expects AI-assisted consultations to represent 65% of all consultations by Q2 next year.",
    source: "rss",
    url: "https://medcitynews.com/example-telehealth",
    author: "MedCity News",
    tags: ["telehealth", "AI diagnosis", "Q3 results", "triage", "growth"],
    status: "archived" as const,
    collectedAt: new Date(Date.now() - 96 * 60 * 60 * 1000),
  },
  {
    title: "Media inquiry: Interview request about AI ethics in healthcare",
    content:
      "Hello, I'm a senior technology correspondent at Healthcare IT Today covering the intersection of AI ethics and clinical practice. I'm working on a long-form piece examining how healthcare AI companies approach algorithmic bias, transparency, and patient consent. Given iHeal AI's position in the market, I'd love to include your perspective. Specifically, I'm interested in: your approach to bias testing in clinical AI, how you handle patient data consent for model training, your stance on AI explainability requirements in high-stakes clinical decisions, and what regulatory frameworks you'd like to see developed. Could we schedule a 30-minute call this week?",
    source: "email",
    url: null,
    author: "Senior Correspondent, Healthcare IT Today",
    tags: ["media", "ethics", "AI bias", "transparency", "PR"],
    status: "archived" as const,
    collectedAt: new Date(Date.now() - 120 * 60 * 60 * 1000),
  },
  {
    title: "Why aren't hospitals adopting AI faster? A physician's perspective",
    content:
      "After 15 years as an emergency medicine physician and the past 3 years as our hospital's AI implementation lead, I can tell you exactly why adoption is slow: trust, workflow disruption, and liability. Trust is the hardest. Clinicians need to understand why an AI is making a recommendation, not just what it recommends. Black-box models that produce a score without explanation get ignored or overridden reflexively. Workflow integration matters enormously — if the AI lives in a separate dashboard that requires extra clicks, it won't be used. The most successful implementations I've seen are deeply embedded in existing EHR workflows with near-zero additional friction. On liability: until there are clearer legal frameworks for AI-assisted medical decisions, many hospitals will remain cautious.",
    source: "reddit",
    url: "https://reddit.com/r/AITechnology/comments/example7",
    author: "ed_physician_ai_lead",
    tags: ["AI adoption", "hospital", "physician perspective", "EHR", "liability"],
    status: "new" as const,
    collectedAt: new Date(Date.now() - 90 * 60 * 1000),
  },
];

// Analysis for pre-reviewed items
const MOCK_ANALYSIS: Record<string, {
  summary: string;
  intent: string;
  industry: string;
  category: string;
  sentiment: string;
  priorityScore: number;
  confidenceScore: number;
  suggestedReply: string;
}> = {
  "AI-powered mental health apps: are they truly HIPAA compliant?": {
    summary: "Healthcare IT community discussion questioning HIPAA compliance of AI mental health apps and data sharing practices with third-party advertisers.",
    intent: "Research & Inquiry",
    industry: "Healthcare",
    category: "Compliance & Regulation",
    sentiment: "Negative",
    priorityScore: 82,
    confidenceScore: 91,
    suggestedReply: "Thank you for raising these important compliance concerns. HIPAA compliance in AI mental health applications is a critical topic that iHeal AI takes seriously. Our platform is built with HIPAA-compliant infrastructure and we never share patient data with advertisers. We'd be happy to provide our detailed compliance documentation and security whitepaper. Would you be interested in a technical briefing with our compliance team?",
  },
  "Digital therapeutics startup raises $45M Series B for chronic disease management": {
    summary: "Luminary Health closes $45M Series B led by a16z to scale AI-powered chronic disease management platform showing 34% reduction in hospital readmissions.",
    intent: "Market Intelligence",
    industry: "Healthcare",
    category: "Funding & Investment",
    sentiment: "Positive",
    priorityScore: 74,
    confidenceScore: 96,
    suggestedReply: "This funding announcement signals continued investor confidence in AI-driven chronic disease management. iHeal AI's comparable capabilities in this space, combined with our broader mental health and intelligence platform, position us well. No direct engagement needed — flagged for competitive intelligence tracking.",
  },
  "Partnership Inquiry: AI-Assisted Telehealth Platform Integration": {
    summary: "CDO of MedConnect Health (200K+ patients, 14 states) requesting partnership discussion for integrating iHeal AI intelligence layer into their telehealth infrastructure.",
    intent: "Partnership Inquiry",
    industry: "Healthcare",
    category: "Business Development",
    sentiment: "Positive",
    priorityScore: 97,
    confidenceScore: 99,
    suggestedReply: "Dear Dr. Whitfield, thank you for reaching out. MedConnect Health's scale and your focus on AI-enhanced clinical workflows align closely with iHeal AI's enterprise capabilities. I'd love to schedule a discovery call at your earliest convenience. I'm available Monday–Wednesday this week and can arrange a technical demo tailored to telehealth workflows. Would 30 minutes on Tuesday at 2pm ET work? I'll also send over our enterprise integration overview ahead of the call.",
  },
  "My 6-month experience using an AI therapy companion app": {
    summary: "User reports positive 6-month experience with AI mental health app for anxiety and depression as a supplement to traditional therapy, citing 24/7 availability and CBT effectiveness.",
    intent: "User Feedback",
    industry: "Healthcare",
    category: "Patient Experience",
    sentiment: "Positive",
    priorityScore: 68,
    confidenceScore: 88,
    suggestedReply: "Thank you for sharing your thoughtful experience. Your observation that AI mental health tools work best as a supplement to traditional therapy is exactly how we design our platform. We'd love to share how iHeal AI's approach addresses the 'human connection' gap you mentioned through our care coordination features. Would you be interested in participating in our user research panel?",
  },
  "FDA clears AI algorithm for early sepsis detection in ICU patients": {
    summary: "FDA clears SepsisSense AI for ICU sepsis detection up to 6 hours early, achieving 91% sensitivity in multicenter trial. Now integrates with Epic and Cerner.",
    intent: "Regulatory News",
    industry: "Healthcare",
    category: "Regulatory & Clinical",
    sentiment: "Positive",
    priorityScore: 79,
    confidenceScore: 97,
    suggestedReply: "This FDA clearance represents a significant milestone for clinical AI adoption and validates the market opportunity iHeal AI is addressing. The Epic/Cerner integration path is noteworthy — flagged for our product team to evaluate similar EHR integration partnerships.",
  },
  "Request for Demo: AI Platform for Behavioral Health Clinics": {
    summary: "Operations director of 12-clinic behavioral health group (8,500 patients) requesting tailored demo for AI intake, triage, and care gap identification to reduce 4-week wait times.",
    intent: "Demo Request",
    industry: "Healthcare",
    category: "Sales Opportunity",
    sentiment: "Positive",
    priorityScore: 95,
    confidenceScore: 98,
    suggestedReply: "Dear Clarity Behavioral Health team, thank you for your interest in iHeal AI. Reducing wait times from 4 weeks is exactly the kind of challenge our platform addresses through intelligent intake and risk stratification. I'd like to schedule a 60-minute tailored demo for your clinical and operations teams. I'll prepare a workflow walkthrough specific to behavioral health triage. Could we meet Thursday or Friday this week? I'll also send our behavioral health case study in advance.",
  },
  "AI documentation tools are burning out nurses — constant corrections needed": {
    summary: "Experienced floor nurse describes clinical AI documentation tool causing burnout through high error rates, requiring 20+ min corrections, and creating patient safety risks.",
    intent: "Negative Feedback",
    industry: "Healthcare",
    category: "Clinical Workflow",
    sentiment: "Negative",
    priorityScore: 88,
    confidenceScore: 93,
    suggestedReply: "We hear your frustration and take patient safety concerns very seriously. The issues you've described — clinical misclassification and alert fatigue — are real challenges in clinical AI implementation. iHeal AI's approach prioritizes accuracy validation and includes nurse feedback loops to continuously improve documentation accuracy. We'd welcome a conversation with your clinical informatics team to understand your specific workflow and explore whether our approach could address these concerns.",
  },
  "Comparing the top 5 AI clinical decision support tools in 2024": {
    summary: "Clinical informatics team evaluation of 5 AI clinical decision support tools, finding alert fatigue reduction (from 400+ to <50 high-confidence alerts) as the primary differentiator.",
    intent: "Market Research",
    industry: "Healthcare",
    category: "Competitive Intelligence",
    sentiment: "Neutral",
    priorityScore: 77,
    confidenceScore: 89,
    suggestedReply: "This is an excellent evaluation framework. iHeal AI's intelligent prioritization engine is specifically designed to address alert fatigue — our contextual AI reduces noise by 87% while maintaining high sensitivity for critical alerts. We'd be interested in being included in your evaluation. Could we schedule a 45-minute technical session with your clinical informatics team?",
  },
  "Researchers find AI outperforms radiologists in early lung cancer detection": {
    summary: "Nature Medicine study: deep learning AI achieves 94.4% AUC vs 91.3% for radiologists in lung cancer CT screening, reducing false positives by 11.2% across 42K+ scans.",
    intent: "Research Publication",
    industry: "Healthcare",
    category: "Clinical Research",
    sentiment: "Positive",
    priorityScore: 71,
    confidenceScore: 95,
    suggestedReply: "This landmark study reinforces the evidence base for AI in medical imaging — a key reference for our clinical validation materials. Flagged for marketing team to include in our thought leadership content. The augmentation-not-replacement framing aligns with our positioning.",
  },
  "Why aren't hospitals adopting AI faster? A physician's perspective": {
    summary: "Emergency medicine physician and hospital AI lead identifies trust, EHR workflow friction, and liability uncertainty as top barriers to AI adoption in hospitals.",
    intent: "Expert Opinion",
    industry: "Healthcare",
    category: "Industry Insight",
    sentiment: "Mixed",
    priorityScore: 85,
    confidenceScore: 90,
    suggestedReply: "Dr., your analysis of AI adoption barriers is exactly what drives our product strategy at iHeal AI. We've built explainability dashboards that show clinicians why the AI reached a conclusion, not just what it concluded, and our EHR integration approach prioritizes zero-friction workflows. I'd welcome a conversation — your perspective would be valuable for our product roadmap. Would you be open to a 30-minute call?",
  },
};

// ── Seed function ─────────────────────────────────────────────────────────────

export async function seedMockData(userId: number): Promise<void> {
  // Check if already seeded
  const existing = await db.select({ total: count() }).from(collectedItems);
  if ((existing[0]?.total ?? 0) > 0) {
    logger.info("Seeder: data already exists, skipping");
    return;
  }

  logger.info("Seeder: inserting mock intelligence items…");

  for (const mockItem of MOCK_ITEMS) {
    const [inserted] = await db
      .insert(collectedItems)
      .values({
        userId,
        title: mockItem.title,
        content: mockItem.content,
        source: mockItem.source,
        url: mockItem.url ?? undefined,
        author: mockItem.author ?? undefined,
        collectedAt: mockItem.collectedAt,
        tags: mockItem.tags,
        status: mockItem.status,
      })
      .returning({ id: collectedItems.id });

    // Seed pre-computed analysis for reviewed items
    if (mockItem.status === "reviewed" && MOCK_ANALYSIS[mockItem.title]) {
      const a = MOCK_ANALYSIS[mockItem.title];
      await db.insert(itemAnalysis).values({
        itemId: inserted.id,
        summary: a.summary,
        intent: a.intent,
        industry: a.industry,
        category: a.category,
        sentiment: a.sentiment,
        priorityScore: a.priorityScore,
        confidenceScore: a.confidenceScore,
        suggestedReply: a.suggestedReply,
        processedAt: new Date(Date.now() - 30 * 60 * 1000),
      });
    }
  }

  logger.info(`Seeder: inserted ${MOCK_ITEMS.length} items`);
}
