import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const { hashSync } = bcrypt;

const prisma = new PrismaClient();

/* ------------------------------------------------------------------ */
/*  Helper: upsert a content area by (page, key)                      */
/* ------------------------------------------------------------------ */
async function ca(page: string, key: string, value: string) {
  await prisma.contentArea.upsert({
    where: { page_key: { page, key } },
    update: { value },
    create: { page, key, value },
  });
}

async function main() {
  console.log("Seeding GRP CMS database...\n");

  /* ================================================================ */
  /*  1. Admin user                                                    */
  /* ================================================================ */
  const admin = await prisma.user.upsert({
    where: { email: "admin@greenroompartners.com" },
    update: {},
    create: {
      email: "admin@greenroompartners.com",
      passwordHash: hashSync("change-me-now", 12),
      role: "ADMIN",
      mustChangePassword: true,
    },
  });
  console.log(`  Admin user: ${admin.email}`);

  /* ================================================================ */
  /*  2. Content Areas                                                 */
  /* ================================================================ */

  /* ------ HOME PAGE ---------------------------------------------- */
  await ca("home", "hero_heading", "Invest with Conviction in Leading Trends");
  await ca(
    "home",
    "hero_body",
    "In surfing, the green room is the inside of a barrel produced by a wave and the ultimate zen of enlightenment. Our philosophy is to combine conviction, discipline, and long-term focus to navigate change and compound capital over time.",
  );
  await ca(
    "home",
    "hero_supporting",
    "Green Room Partners follows a global growth equity strategy with an emphasis on quality businesses positioned to thrive in the new norm.",
  );

  await ca("home", "mission_heading", "Our mission");
  await ca(
    "home",
    "mission_body",
    "Generate long-term capital gains while pursuing above-average returns through the cycle via concentrated, research-driven portfolio construction.",
  );
  await ca(
    "home",
    "mission_image",
    "./assets/optimized/inline-financial-dashboard-3d98c37b-800.jpg",
  );

  await ca("home", "conviction_heading", "Conviction-led investing");
  await ca(
    "home",
    "conviction_body",
    "We concentrate capital on high-quality businesses with resilient models, durable leadership, and strategic relevance.",
  );

  await ca("home", "partnership_heading", "Long-term partnership");
  await ca(
    "home",
    "partnership_body",
    "We are investors with a long-term horizon and align with clients who share the same mindset.",
  );

  await ca(
    "home",
    "sector_image_1",
    "./assets/optimized/inline-container-shipping-96ee96e2-800.jpg",
  );
  await ca(
    "home",
    "sector_image_2",
    "./assets/optimized/inline-laboratory-11dd7aaa-800.jpg",
  );

  await ca("home", "core_themes_heading", "Core themes");
  await ca(
    "home",
    "core_themes_items",
    "Technology\nEnergy Transition\nAdvanced Industrials\nHealthcare Innovation",
  );

  await ca("home", "portfolio_discipline_heading", "Portfolio discipline");
  await ca(
    "home",
    "portfolio_discipline_items",
    "Generally up to 20 core positions\nLong-only orientation with selective derivatives income\nCash held tactically to preserve capital in turmoil",
  );

  /* ------ STRUCTURE PAGE ----------------------------------------- */
  await ca(
    "structure",
    "hero_heading",
    "Transparency and alignment by design.",
  );
  await ca(
    "structure",
    "hero_body",
    "Green Room Partners is a California registered investment advisor (RIA) managing capital via separately managed accounts (SMAs). All investment accounts are held in clients\u2019 names, allowing full transparency and individual tax optimization.",
  );

  await ca(
    "structure",
    "alignment_image",
    "./assets/optimized/inline-forest-perspective-7306b8de-800.jpg",
  );
  await ca("structure", "investors_heading", "We are investors");
  await ca(
    "structure",
    "investors_body",
    "We recommend investing assets with at least a three-year timeframe and offer two long-term opportunity sets: a traditional investment account and a self-directed Individual Retirement Account (IRA).",
  );

  await ca("structure", "long_term_heading", "Long-term first");
  await ca(
    "structure",
    "long_term_body",
    "We are investors, not traders, and we target clients who share a long-duration mindset.",
  );
  await ca("structure", "tactical_heading", "Tactical flexibility");
  await ca(
    "structure",
    "tactical_body",
    "We can use shorter-term trends selectively when they support our broader long-term themes.",
  );

  await ca("structure", "partners_heading", "We are partners");
  await ca(
    "structure",
    "partners_body",
    "Green Room Partners has a partnership mentality. A meaningful portion of the portfolio manager\u2019s net worth is invested in the strategy alongside clients, reinforcing alignment and risk-adjusted return discipline.",
  );

  /* ------ INVESTMENT PAGE ---------------------------------------- */
  await ca(
    "investment",
    "hero_heading",
    "Global growth equity with concentrated conviction.",
  );
  await ca(
    "investment",
    "hero_body",
    "Our primary goal is long-term capital appreciation with above-average returns through the cycle. We prioritize companies thriving in the new norm and incorporating Environmental, Social, and Governance (ESG) principles.",
  );

  await ca(
    "investment",
    "execution_image",
    "./assets/optimized/inline-rock-climber-fa216a94-800.jpg",
  );
  await ca("investment", "market_focus_heading", "Market and sector focus");
  await ca(
    "investment",
    "market_focus_body",
    "We invest globally with attention on developed markets across market capitalizations, including global leaders and select earlier-stage franchises.",
  );

  await ca("investment", "sector_focus_heading", "Sector focus");
  await ca(
    "investment",
    "sector_focus_items",
    "Technology\nEnergy Transition\nAdvanced Industrials\nHealthcare Innovation",
  );
  await ca("investment", "key_beliefs_heading", "Our key beliefs");
  await ca(
    "investment",
    "key_beliefs_items",
    "Buy quality businesses that will thrive in the new norm\nFocus on sectors that matter within ESG\nConcentrate capital on the best ideas\nStay disciplined in competence and execution\nKeep an open mind while staying flexible",
  );

  await ca("investment", "portfolio_heading", "Portfolio construction");
  await ca(
    "investment",
    "portfolio_body",
    "We run a research-driven strategy that generally consists of up to 20 core positions. The strategy is long-only, may use derivatives for additional income on core holdings, and can hold cash tactically to preserve capital during volatility.",
  );

  /* ------ SECTORS PAGE ------------------------------------------- */
  await ca("sectors", "hero_heading", "Our Focus");
  await ca(
    "sectors",
    "hero_body",
    "We invest in four sectors undergoing structural transformation driven by innovation, electrification, demographic change, and strategic reindustrialization. These are multi-year capital cycles reshaping the global economy. We focus on companies positioned at the center of these durable shifts with an emphasis on leading corporate governance.",
  );

  await ca("sectors", "tech_heading", "The Infrastructure of Intelligence");
  await ca(
    "sectors",
    "tech_body",
    "Artificial intelligence is moving from experimentation to infrastructure. Compute, semiconductor design, cybersecurity, and enterprise platforms form the backbone of the AI economy. We invest in mission-critical systems enabling productivity on a global scale.",
  );

  await ca("sectors", "energy_heading", "Power for a Digital World");
  await ca(
    "sectors",
    "energy_body",
    "Electrification and energy security define the next decade. Grid expansion, nuclear, advanced generation, storage, and power management represent a structural buildout \u2014 not a trade. Reliable power is the foundation of modern growth.",
  );

  await ca(
    "sectors",
    "industrials_heading",
    "Automation of the Physical Economy",
  );
  await ca(
    "sectors",
    "industrials_body",
    "Manufacturing, aerospace, and defense are entering a new investment cycle. Automation, robotics, simulation software, and electrical systems increase productivity and resilience. We seek businesses with structural backlog visibility and enduring competitive advantages.",
  );

  await ca("sectors", "healthcare_heading", "Precision & Platform Biology");
  await ca(
    "sectors",
    "healthcare_body",
    "Medical innovation is accelerating across oncology, metabolic disease, and advanced devices. Targeted therapies, robotics, and data-driven diagnostics improve outcomes and expand longevity. We prioritize scalable platforms with sustainable innovation engines.",
  );

  await ca("sectors", "convergence_heading", "Convergence");
  await ca(
    "sectors",
    "convergence_body",
    "Artificial intelligence drives power demand. Energy infrastructure supports digital expansion. Industrial automation enhances resilience. Data accelerates biological discovery. Structural growth compounds where systems connect.",
  );

  /* ------ TEAM PAGE ---------------------------------------------- */
  await ca(
    "team",
    "hero_heading",
    "Global perspective. Sector expertise. Disciplined execution.",
  );
  await ca(
    "team",
    "hero_body",
    "Green Room Partners is a founder-led investment firm with deep experience across global equity markets and transformative industries. We combine long-term vision with rigorous risk oversight and disciplined capital allocation, supported by a global network of sector advisors that enhances our industry insight and reinforces our commitment to stewardship and independent thinking.",
  );

  await ca("team", "founder_section_heading", "Meet our founder");

  await ca("team", "advisory_heading", "Advisory board");
  await ca(
    "team",
    "advisory_body",
    "Our advisors bring strategic and operating expertise across growth sectors and global markets.",
  );

  await ca("team", "stewardship_heading", "Stewardship advisors");
  await ca(
    "team",
    "stewardship_body",
    "Selected advisors supporting governance, ethics, and investment principles.",
  );

  /* ------ CONTACT PAGE ------------------------------------------- */
  await ca(
    "contact",
    "hero_heading",
    "Let\u2019s connect on long-term investment partnerships.",
  );
  await ca(
    "contact",
    "hero_body",
    "We welcome inquiries from investors, company leaders, and strategic partners. Our team aims to respond within two business days.",
  );

  await ca("contact", "reach_heading", "Reach Green Room Partners");
  await ca(
    "contact",
    "reach_body",
    "Our office is located in San Francisco. Use the channels below based on your inquiry type.",
  );

  await ca("contact", "inquiries_heading", "General Inquiries");
  await ca("contact", "address_heading", "Address");
  await ca("contact", "hours_heading", "Office Hours");

  await ca(
    "contact",
    "map_embed_url",
    "https://www.google.com/maps?q=415+Mission+Street,+San+Francisco,+CA+94105&output=embed",
  );

  await ca("contact", "message_heading", "Send us a message");
  await ca(
    "contact",
    "message_body",
    "Share your details and context. This form opens your email client with a prefilled message for quick submission.",
  );

  /* ------ NEWS PAGE ---------------------------------------------- */
  await ca("news", "hero_heading", "Insights and Market Perspective");
  await ca(
    "news",
    "hero_body",
    "Green Room Partners shares selective commentary and thematic research aligned with our global equity framework. Our perspectives reflect an independent, sector-focused view across technology, energy transition, advanced industrials, and healthcare innovation \u2014 informed by rigorous analysis of global capital markets, economic developments, and industry research.",
  );

  await ca("news", "latest_heading", "Latest posts");
  await ca(
    "news",
    "latest_body",
    "Six featured links are listed below, including the February 2026 performance update.",
  );

  await ca("news", "blog_heading", "Partner blog module");
  await ca(
    "news",
    "blog_body",
    "Create, edit, save drafts, publish, and delete posts. Custom posts are stored locally in this browser.",
  );

  console.log("  Content areas seeded.");

  /* ================================================================ */
  /*  3. Team Members                                                  */
  /* ================================================================ */

  // Founder
  await prisma.teamMember.upsert({
    where: { id: "founder-christian-schmuck" },
    update: {},
    create: {
      id: "founder-christian-schmuck",
      firstName: "Christian",
      lastName: "Schmuck",
      role: "Founder and Portfolio Manager",
      type: "founder",
      order: 1,
      bio: "Christian founded Green Room Partners in San Francisco in 2018. He has over 20 years of global investment and management experience, including prior leadership at Blackstone, The Gores Group, and Montagu Private Equity. Christian previously worked in M&A and Capital Markets at Deutsche Bank in London and held investment banking and portfolio management roles in New York, San Francisco, and Frankfurt. He holds degrees from Royal Holloway, University of London and the Frankfurt School of Finance and Management.",
      imageUrl: "",
      linkedinUrl: "",
    },
  });

  // Fund Advisors (advisory board)
  await prisma.teamMember.upsert({
    where: { id: "advisor-pascal-zuta" },
    update: {},
    create: {
      id: "advisor-pascal-zuta",
      firstName: "Pascal",
      lastName: "Zuta",
      role: "Brand Advisor",
      type: "fund_advisor",
      order: 2,
      bio: "Pascal is a serial entrepreneur and investor based in the San Francisco Bay Area. He co-founded GYANT, an AI-based patient engagement platform, and has built and scaled companies across media, consumer brands, and healthcare technology. He also leads Lion\u2019s Den Ventures and serves as an investor and board member at GRENION Brands and Les Lunes. He earned his Dr. in Media Science from the HFF Potsdam-Babelsberg and studied at European Business School.",
      imageUrl:
        "./assets/optimized/advisor-pascal-zuta-7141b484-full.jpg",
      linkedinUrl: "",
    },
  });

  await prisma.teamMember.upsert({
    where: { id: "advisor-hanno-fichtner" },
    update: {},
    create: {
      id: "advisor-hanno-fichtner",
      firstName: "Hanno",
      lastName: "Fichtner",
      role: "Strategic Advisor",
      type: "fund_advisor",
      order: 3,
      bio: "Hanno is an entrepreneur and investor based in San Francisco. He founded Gabi Insurance, the leading U.S. insurance marketplace, raising $39M in venture capital before selling the company to Experian in 2021. Previously, he co-founded HitFox Group, an incubator that launched over 15 companies with 700 employees, and served as Chief Digital Strategy Officer at ProSiebenSat.1 Media. He earned his Dr. rer. pol. from the University of Bremen and his MBA from the University of Cologne.",
      imageUrl:
        "./assets/optimized/advisor-hanno-fichtner-8b8f5514-full.jpg",
      linkedinUrl: "",
    },
  });

  // Stewardship Advisors
  await prisma.teamMember.upsert({
    where: { id: "advisor-jeff-heely" },
    update: {},
    create: {
      id: "advisor-jeff-heely",
      firstName: "Jeff",
      lastName: "Heely",
      role: "Ethics Advisor",
      type: "stewardship_advisor",
      order: 4,
      bio: "Jeff is an investment executive and governance advocate based in the San Francisco Bay Area. He has served as CEO of Baystar Investment Management, COO of Eastbourne Capital (a $3B+ equity long/short fund), and Head of Alternative Investments at Robertson Stephens. A graduate of the United States Naval Academy, he brings a disciplined approach to ethics and stakeholder alignment in investment management.",
      imageUrl:
        "./assets/optimized/advisor-jeff-heely-39e8002b-full.jpg",
      linkedinUrl: "",
    },
  });

  await prisma.teamMember.upsert({
    where: { id: "advisor-rene-gamboa" },
    update: {},
    create: {
      id: "advisor-rene-gamboa",
      firstName: "Ren\u00e9",
      lastName: "Gamboa",
      role: "Legal Advisor",
      type: "stewardship_advisor",
      order: 5,
      bio: "Ren\u00e9 is a real estate and corporate partner in the San Francisco office of Gordon Rees Scully Mansukhani. A LEED Accredited Professional (LEED AP), he has worked on environmentally sensitive energy and technology projects, including leading the U.S. launch strategy for a multinational European car company\u2019s first all-electric car-sharing business. He earned his J.D. from the University of San Francisco and lives in the San Francisco Bay Area with his wife and two children.",
      imageUrl:
        "./assets/optimized/advisor-rene-gamboa-9051a6fa-full.jpg",
      linkedinUrl: "",
    },
  });

  console.log("  Team members seeded.");

  /* ================================================================ */
  /*  4. Sample NewsPost                                               */
  /* ================================================================ */
  const samplePost = await prisma.newsPost.upsert({
    where: { slug: "february-2026-market-update" },
    update: {},
    create: {
      slug: "february-2026-market-update",
      title: "February 2026 Market Update",
      author: "Green Room Partners",
      publishedAt: new Date("2026-02-28T12:00:00Z"),
      monthKey: "2026-02",
      summary:
        "Monthly commentary on portfolio positioning, sector developments, and market outlook across our four priority themes.",
      tags: JSON.stringify(["Macro", "Equities", "Monthly Update"]),
      status: "published",
    },
  });

  // Seed pages for the sample post (idempotent)
  await prisma.newsPostPage.upsert({
    where: {
      postId_pageNum: { postId: samplePost.id, pageNum: 1 },
    },
    update: {},
    create: {
      postId: samplePost.id,
      pageNum: 1,
      heading: "Market Overview",
      body: "Global equity markets exhibited mixed signals in February as investors weighed the impact of persistent inflation concerns against resilient corporate earnings. Technology stocks continued to benefit from robust AI infrastructure spending, while energy transition names saw renewed interest following updated regulatory frameworks.\n\nOur portfolio maintained its overweight positioning in technology and advanced industrials, where structural demand drivers remain intact. We trimmed select healthcare positions following strong year-to-date performance and redeployed into energy transition opportunities trading at attractive entry points.",
    },
  });

  await prisma.newsPostPage.upsert({
    where: {
      postId_pageNum: { postId: samplePost.id, pageNum: 2 },
    },
    update: {},
    create: {
      postId: samplePost.id,
      pageNum: 2,
      heading: "Sector Developments",
      body: "Technology: AI infrastructure buildout continues at pace with hyperscaler capex guidance exceeding consensus. Semiconductor equipment and cloud platform companies remain core positions.\n\nEnergy Transition: Nuclear restart narratives gained momentum with additional utility commitments. Grid infrastructure spending is accelerating with multi-year visibility.\n\nAdvanced Industrials: Defense and automation spending reflects a structural shift in government procurement priorities. Backlog-to-revenue ratios remain elevated.\n\nHealthcare Innovation: GLP-1 market expansion and oncology pipeline catalysts supported our conviction in platform biology positions.",
    },
  });

  await prisma.newsPostPage.upsert({
    where: {
      postId_pageNum: { postId: samplePost.id, pageNum: 3 },
    },
    update: {},
    create: {
      postId: samplePost.id,
      pageNum: 3,
      heading: "Outlook",
      body: "We remain constructive on risk assets in the medium term while maintaining tactical discipline around position sizing. The convergence of AI-driven power demand, industrial reshoring, and healthcare platform scaling creates a multi-year investment opportunity set that aligns with our core themes.\n\nWe continue to favor quality franchises with pricing power, recurring revenue, and secular tailwinds. Cash levels remain moderate, providing optionality to add on volatility without sacrificing exposure to structural growth.",
    },
  });

  console.log("  Sample news post seeded.");
  console.log("\nSeed complete.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
