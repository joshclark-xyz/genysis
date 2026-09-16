/* =============================================================================
   Genysis IQ - AI Services Direct Sales Division
   CENTRALISED CONTENT

   Every number, disclaimer, service and FAQ on the recruiting site lives here.
   Edit this file to change the site; you should not need to touch page layout.

   NOTHING in this file may contain internal economics: fulfilment costs,
   provider payment formulas, margins, or payout ceilings. Those stay in the
   internal planning documents. See README-OPPORTUNITY.md.
   ============================================================================= */

window.GIQ = (function () {
  "use strict";

  /* ------------------------------------------------------------- indexing --
     Public search indexing is OFF until Genysis IQ approves it. Every page also
     ships a hardcoded noindex meta tag - this flag is the second lock, not the
     only one. See the README for how to enable indexing. */
  var SITE_INDEXING_ENABLED = false;

  /* -------------------------------------------------------------- contact -- */
  var contact = {
    company: "Genysis IQ",
    tagline: "Where Intelligent Business Scaling Begins.",
    email: "info@genysisiq.com",
    phone: "689.388.7353",
    phoneHref: "tel:+16893887353",
    location: "Orlando, Florida",
    mainSite: "../index.html"
  };

  /* ----------------------------------------------------------- navigation -- */
  var nav = [
    { label: "Home",                     href: "index.html" },
    { label: "How It Works",             href: "how-it-works.html" },
    { label: "Services",                 href: "services.html" },
    { label: "The AI Advantage",         href: "ai-advantage.html", short: "AI Advantage" },
    { label: "Representative Opportunity", href: "representative.html", short: "Opportunity" },
    { label: "Compensation Preview",     href: "compensation.html",  short: "Compensation" },
    { label: "Founding Leaders",         href: "founding-leaders.html" },
    { label: "About Genysis IQ",         href: "about.html",         short: "About" },
    { label: "FAQ",                      href: "faq.html" }
  ];
  var navCta = { label: "Express Interest", href: "express-interest.html" };

  /* -------------------------------------------------------- status labels -- */
  var status = {
    development: { label: "In Development",         tone: "amber" },
    proposed:    { label: "Proposed",               tone: "amber" },
    initial:     { label: "Initial Service Category", tone: "teal" },
    change:      { label: "Subject to Change",      tone: "grey" },
    founding:    { label: "Founding Stage",         tone: "navy" }
  };

  /* ---------------------------------------------------------- disclaimers -- */
  var disclaimers = {
    foundingBanner:
      "FOUNDING-STAGE OPPORTUNITY — PROGRAM IN DEVELOPMENT",

    foundingNotice:
      "Genysis IQ is currently developing this opportunity, its service portfolio, " +
      "compensation plan, representative systems, and Founding Leader Program. " +
      "Information presented on this website is preliminary and subject to revision " +
      "before official launch.",

    compensation:
      "The Genysis IQ compensation plan is under development. Percentages, " +
      "Commissionable Revenue assignments, rank qualifications, bonus triggers, " +
      "leadership-pool funding, maintenance requirements, and all other terms may be " +
      "revised before launch. No income is guaranteed. Earnings, if any, will depend " +
      "on customer activity, organizational performance, individual effort, market " +
      "conditions, and compliance with the final plan and policies.",

    footer:
      "The Genysis IQ AI Services Direct Sales Program is currently under development. " +
      "Services, pricing, compensation, qualifications, technology, launch timing, and " +
      "program terms are preliminary and subject to change. No income or business " +
      "results are guaranteed.",

    launchPackage:
      "Proposed launch-package price and contents are subject to change before " +
      "official launch.",

    foundingLeader:
      "Founding status will not guarantee income. Provisional top-rank treatment must " +
      "be earned and maintained. Missing milestones may result in the leader being paid " +
      "at the rank actually qualified for. Founding Leader status does not imply company " +
      "ownership. Participation will be limited and subject to company approval. Final " +
      "requirements have not been established.",

    security:
      "Security testing is performed under written authorization and reports on findings " +
      "identified during a defined testing window. No security assessment can guarantee " +
      "that a system is free of vulnerabilities.",

    consent:
      "I understand that the Genysis IQ direct-sales program is under development. " +
      "Submitting this form does not enroll me as a representative, guarantee acceptance, " +
      "guarantee a Founding Leader position, or promise earnings."
  };

  /* ----------------------------------------------------- the core message -- */
  var messages = {
    model: "Representatives create traffic. AI creates sales. Genysis IQ and approved providers deliver the services.",
    promise: "Build an AI services business without becoming an AI technician.",
    support: "Introduce business owners to your personalized Genysis IQ AI platform. " +
             "The AI identifies their needs, recommends appropriate services, and " +
             "facilitates the sale. Genysis IQ and approved providers handle fulfillment.",
    positioning: "An AI-powered distribution ecosystem for practical business services.",
    connect: "Connect businesses with the AI and professional services they need — " +
             "and build an organization around the customers you introduce.",
    aiNotReplace: "AI can evaluate, educate, recommend, and automate. Representatives " +
                  "create trust, relationships, introductions, and leadership."
  };

  /* ------------------------------------------------------ calls to action -- */
  var cta = {
    explore:   { label: "Explore the Opportunity",           href: "representative.html" },
    interest:  { label: "Express Interest",                  href: "express-interest.html" },
    founding:  { label: "Request Founding Leader Information", href: "express-interest.html?interest=founding" },
    services:  { label: "View the Services",                 href: "services.html" },
    how:       { label: "See How It Works",                  href: "how-it-works.html" },
    comp:      { label: "Review the Compensation Preview",   href: "compensation.html" },
    ai:        { label: "Learn About the AI Platform",       href: "ai-advantage.html" },
    joinList:  { label: "Join the Founding Interest List",   href: "express-interest.html" }
  };

  /* ------------------------------------------------------ the four steps -- */
  var steps = [
    { n: "1", title: "Share",
      body: "Introduce business owners through your personalized Genysis IQ website, referral link, or QR code." },
    { n: "2", title: "AI Evaluates",
      body: "The AI platform learns about the business, identifies needs, and evaluates potential opportunities." },
    { n: "3", title: "AI Recommends",
      body: "The platform explains and recommends appropriate Genysis IQ or approved partner services." },
    { n: "4", title: "We Deliver",
      body: "Genysis IQ or an approved provider delivers the service, and eligible commissions are released." }
  ];

  /* --------------------------------------------------------- the services -- */
  var services = [
    { id: "website-intelligence", tag: "initial", icon: "chart",
      name: "Website Intelligence",
      blurb: "Understand how a website actually performs — and where it quietly loses customers.",
      items: ["Website performance analysis","Customer-engagement analysis","Lead-conversion analysis",
              "AI-search discoverability","Website competitive comparison","Mobile and usability review"] },

    { id: "website-creation", tag: "initial", icon: "layout",
      name: "Website Creation",
      blurb: "Websites built to convert, not just to exist.",
      items: ["New business websites","Website redesign","Landing pages","Conversion-focused websites",
              "AI-enabled websites","Website management and maintenance"] },

    { id: "conversational-ai", tag: "initial", icon: "chat",
      name: "Conversational AI",
      blurb: "Assistants that answer customers at 2am, qualify leads, and book appointments.",
      items: ["Website AI assistants","Lead qualification","Frequently asked questions","Appointment support",
              "After-hours inquiry handling","Customer-service assistance","Internal knowledge assistants",
              "Multilingual conversational support"] },

    { id: "security", tag: "initial", icon: "shield",
      name: "Cybersecurity & Penetration Testing",
      blurb: "Authorized testing that finds exposure before somebody else does.",
      items: ["External vulnerability assessment","Website penetration testing","Web-application testing",
              "Exposure and risk reporting","Retesting after remediation","Recurring security monitoring"],
      note: "security" },

    { id: "market-intelligence", tag: "initial", icon: "compass",
      name: "Competitive & Market Intelligence",
      blurb: "What competitors charge, promise, and get reviewed for — in one place.",
      items: ["Competitor website analysis","Pricing and offer comparison","Customer-review analysis",
              "Positioning and messaging comparison","Digital-presence comparison","Market opportunity research",
              "Competitive SWOT analysis"] },

    { id: "automation", tag: "initial", icon: "flow",
      name: "AI & Business Automation",
      blurb: "Removing the manual work that quietly consumes a team's week.",
      items: ["Lead follow-up","CRM automation","Customer onboarding","Internal knowledge systems",
              "Proposal and document workflows","Operational reporting","Sales-support systems"] },

    { id: "business-scaling", tag: "initial", icon: "steps",
      name: "Business Scaling",
      blurb: "The CASPER work Genysis IQ has been doing for businesses since day one.",
      items: ["AI-led business assessments","CASPER-guided scaling programs","Systems and process evaluation",
              "Delegation and decentralization","Operational architecture","Customized advisor-assisted engagements"] }
  ];

  var futureMarketplace =
    "Genysis IQ intends to continuously evaluate additional AI services developed " +
    "internally and by approved outside AI companies. This will allow the service " +
    "portfolio to expand as customer needs and AI capabilities evolve.";

  /* ------------------------------------------------------- the AI platform -- */
  var platformCustomer = {
    title: "Your personalized customer website",
    lead: "Each representative is expected to receive their own Genysis IQ AI website — " +
          "the place you send every introduction.",
    items: [
      ["Representative identity and attribution","Your customers are tied to you, automatically."],
      ["Adaptive business conversation","The AI asks about the business rather than reciting a brochure."],
      ["Business-needs analysis","It works out what the business is actually missing."],
      ["Service recommendations","It matches those needs to appropriate Genysis IQ or partner services."],
      ["Customer education","It explains why a service matters, in business terms."],
      ["Questions and objections","It answers the technical questions you would rather not field."],
      ["Purchasing and onboarding","Standardized purchases and onboarding information, handled on the page."],
      ["Human scheduling when necessary","Complex situations route to a Genysis IQ advisor."]
    ]
  };

  var platformRep = {
    title: "Your AI business partner",
    lead: "A second AI, working for you rather than your customer — intended to become " +
          "more useful the longer you work with it.",
    items: [
      ["Learns your goals and markets","It adapts to who you actually sell to."],
      ["Helps identify likely prospects","Where to look, and who to start with."],
      ["Writes invitations and outreach","Drafts you edit, not scripts you recite."],
      ["Creates approved marketing content","Social and marketing material inside company guidelines."],
      ["Explains services","So you never have to memorize a technical catalog."],
      ["Provides training","On demand, at the point you need it."],
      ["Tracks Fast Start progress","What is done, what is left, what is next."],
      ["Monitors customer activity","Which customers are active and what they may need next."],
      ["Explains commissions","In plain language, tied to your actual activity."],
      ["Supports organization development","Helping you help the people you sponsor."],
      ["Coaches based on your performance","Guidance shaped by what you are actually doing."]
    ]
  };

  /* --------------------------------------------------------- the rep role -- */
  var repWill = [
    "Build professional relationships","Identify potential customers",
    "Share their personalized AI website","Generate qualified traffic",
    "Follow up appropriately","Develop other representatives",
    "Help new representatives begin generating customer activity",
    "Build and support an organization"
  ];
  var repWillNot = [
    "Conduct technical analyses","Build customer websites","Program conversational AI",
    "Conduct penetration testing","Scope complicated technology projects",
    "Personally deliver CASPER consulting","Manage external service providers",
    "Collect customer payments independently"
  ];

  var customerJourney = [
    "A representative provides an introduction.",
    "The customer visits the personalized Genysis IQ AI website.",
    "The AI learns about the customer's business.",
    "The platform identifies needs and opportunities.",
    "The AI recommends relevant services.",
    "The customer reviews the recommendation and asks questions.",
    "The customer purchases or schedules a consultation.",
    "Genysis IQ or an approved provider completes the service.",
    "The platform identifies future opportunities and recurring needs."
  ];

  var centralised = [
    "Service presentation","Customer agreements","Pricing","Payments","Technical delivery",
    "Quality review","Provider coordination","Customer support","Commission calculation"
  ];

  var goodFit = [
    "Comfortable building relationships","Has an existing professional or personal network",
    "Willing to introduce business owners to the platform","Interested in AI and business services",
    "Coachable","Consistent","Interested in customer acquisition",
    "Interested in developing other people","Understands that results require effort"
  ];
  var notFit = [
    "Expects guaranteed income","Wants to earn primarily from enrollment",
    "Is unwilling to acquire customers","Makes exaggerated product or income claims",
    "Does not want to learn or follow approved systems",
    "Expects the AI to replace all personal activity",
    "Wants immediate results without sustained effort"
  ];

  var launchPackage = {
    price: "$395",
    label: "Proposed representative launch package",
    items: ["Initial onboarding","Representative training","Personalized AI website","Back-office access",
            "Customer attribution","Commission tracking","Representative AI business partner",
            "Approved marketing resources"]
  };

  /* ------------------------------------------------------- compensation ---- */
  var comp = {
    personal: { pct: "20%", label: "Proposed personal customer commission",
                of: "of Commissionable Revenue" },
    levels: [
      { level: 1, pct: 6 }, { level: 2, pct: 2 }, { level: 3, pct: 2 }, { level: 4, pct: 2 },
      { level: 5, pct: 4 }, { level: 6, pct: 4 }, { level: 7, pct: 6 }
    ],
    levelsNote:
      "The proposed structure places strong percentages at Level 1 and at the deepest " +
      "levels to reward both personal leadership and organizational depth.",
    crSimple:
      "Because services have different prices and delivery costs, each service will be " +
      "assigned a commissionable dollar amount. Commissions will be calculated from that " +
      "figure rather than automatically from the full retail price.",
    rewards: [
      "Customer acquisition","Delivered customer services",
      "Helping newly sponsored representatives acquire customers","Organizational depth",
      "Leadership development","Recurring customer relationships",
      "Development of independently productive teams"
    ],
    fastStart:
      "The developing Fast Start program is intended to reward new representatives for " +
      "acquiring genuine customers, and to reward sponsors for helping those representatives " +
      "begin successfully. Sponsor Fast Start bonuses may increase by rank.",
    rank: [
      "Unlock additional paid levels","Increase Fast Start leadership compensation",
      "Provide recognition","Create leadership-pool eligibility",
      "Shift qualification emphasis from personal customer acquisition toward team and leader development as representatives advance"
    ],
    pool:
      "Senior field leaders may qualify to share in a company-funded leadership pool based " +
      "on organizational customer revenue, leadership development, customer retention, and " +
      "continued qualification.",
    recurring:
      "Eligible recurring services may generate continuing personal and organizational " +
      "commissions while customers remain active and services continue to be delivered."
  };

  /* --------------------------------------------------- founding leaders ---- */
  var foundingBenefits = [
    "Provisional access to the full seven-level pay structure","Defined performance milestones",
    "Founding Executive Director recognition","Early access to the AI platform",
    "Participation in field testing","Input into representative systems and training",
    "Accelerated leadership-pool eligibility","Priority communication and support",
    "Permanent recognition after completing required milestones"
  ];
  var foundingExpectations = [
    "Customer acquisition","Development of customer-producing representatives",
    "Multiple independently productive frontline organizations","Active leadership and coaching",
    "Compliance with company standards","Participation in launch training and testing",
    "Completion of milestone requirements within the provisional period"
  ];

  /* ------------------------------------------------------------- the FAQ --- */
  var faq = [
    ["Do I need AI experience?",
     "No. The representative's primary role is generating qualified traffic, making introductions, developing relationships, and building an organization. The platform and the Genysis IQ team handle technical selling and delivery."],
    ["Will representatives deliver the services?",
     "Generally, no. Services will be delivered by Genysis IQ, internal advisors, automated systems, or approved external providers."],
    ["What does the AI website do?",
     "It is intended to learn about the customer's business, identify needs, recommend appropriate services, answer questions, facilitate purchases, and collect onboarding information."],
    ["How do representatives find customers?",
     "Through professional relationships, networking, referrals, personalized links, QR codes, and approved marketing."],
    ["What services will be available?",
     "The developing catalog includes website analytics, website creation, conversational AI, penetration testing, competitive analysis, AI-search visibility, automation, and business-scaling services."],
    ["Is the compensation plan final?",
     "No. The structure is being modeled and evaluated. Final percentages, qualifications, ranks, bonuses, and terms may change before launch."],
    ["What is Commissionable Revenue?",
     "It is the dollar amount assigned to each service from which representative commissions are calculated."],
    ["What is the proposed $395 package?",
     "It is a proposed representative launch package expected to include training, a personalized AI website, back-office access, tracking, and AI support. Final price and contents are subject to change."],
    ["Are representatives paid for recruiting?",
     "The plan is intended to pay commissions and bonuses from delivered customer services. Representative enrollment fees are not intended to create commissionable sales volume."],
    ["Can representatives purchase services?",
     "Yes. Representatives who legitimately need services for their own businesses may purchase them as customers. Purchases should not replace external customer acquisition."],
    ["What is the Founding Leader Program?",
     "It is a proposed, limited program for experienced leaders who may receive provisional top-rank treatment while completing customer and leadership milestones."],
    ["When will the program launch?",
     "The launch date has not yet been finalized. Prospective representatives may join the interest list for updates."],
    ["Does expressing interest enroll me?",
     "No. Expressing interest does not create a representative agreement, guarantee acceptance, or guarantee a Founding Leader position."],
    ["Is income guaranteed?",
     "No. No earnings or business results are guaranteed."]
  ];

  /* --------------------------------------------------------------- about --- */
  var about = {
    casper: [
      ["Clarity","Find the real constraint before spending money on symptoms."],
      ["Architecture","Design roles, structure and decision flow deliberately."],
      ["Systems","Build the tools and management systems execution needs."],
      ["Processes","Make execution repeatable and documented."],
      ["Evaluation","Measure performance with practical KPIs."],
      ["Replication","Make success transferable and scalable."]
    ],
    ron: {
      name: "Ronald J. Clark",
      role: "Founder & Chief Executive Officer",
      points: [
        "Approximately 39 years of business experience",
        "Experience building multiple companies, including international businesses",
        "Author of <em>Dynamic ChatGPT: AI Strategies for Small Business</em>",
        "AI and machine-learning executive education from MIT, the Wharton School of the University of Pennsylvania, and the London School of Economics"
      ]
    }
  };

  /* ------------------------------------------------------ interest form ---- */
  var interestOptions = [
    "Prospective representative","Experienced leader","Founding Leader consideration",
    "AI-service provider","General information"
  ];

  return {
    SITE_INDEXING_ENABLED: SITE_INDEXING_ENABLED,
    contact: contact, nav: nav, navCta: navCta, status: status,
    disclaimers: disclaimers, messages: messages, cta: cta, steps: steps,
    services: services, futureMarketplace: futureMarketplace,
    platformCustomer: platformCustomer, platformRep: platformRep,
    repWill: repWill, repWillNot: repWillNot, customerJourney: customerJourney,
    centralised: centralised, goodFit: goodFit, notFit: notFit,
    launchPackage: launchPackage, comp: comp,
    foundingBenefits: foundingBenefits, foundingExpectations: foundingExpectations,
    faq: faq, about: about, interestOptions: interestOptions
  };
})();
