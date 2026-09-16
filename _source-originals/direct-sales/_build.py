# -*- coding: utf-8 -*-
"""Generates the ten recruiting pages. Content lives in assets/content.js and is
   mirrored here for server-side render; edit content.js for runtime values."""
import pathlib, json

SITE = "https://www.genysisiq.com/opportunity"

ICONS = {
 "chart":'<path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/>',
 "layout":'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
 "chat":'<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.9-.9L3 21l1.9-5A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5z"/>',
 "shield":'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
 "compass":'<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
 "flow":'<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/><path d="M9 6h6a3 3 0 0 1 3 3v6"/>',
 "steps":'<path d="M3 21h4v-5h5v-5h5V6h4"/>',
}
def icon(k):
    return ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" '
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">%s</svg>' % ICONS[k])

ARROW = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
         'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
         '<path d="M5 12h14M13 6l6 6-6 6"/></svg>')

def head(title, desc, canon):
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<!-- Public indexing is disabled until Genysis IQ approves it.
     See README-OPPORTUNITY.md ("Enabling public indexing"). -->
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#0c2743">
<link rel="canonical" href="{SITE}/{canon}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Genysis IQ AI Services Network">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<link rel="icon" href="../assets/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="../assets/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap">
<link rel="stylesheet" href="assets/opportunity.css">
</head>
<body>

<a class="skip-link" href="#main">Skip to content</a>
<div id="giqHeader"></div>

<main id="main">
'''

FOOT = '''</main>

<div id="giqFooter"></div>

<script src="assets/content.js"></script>
<script src="assets/opportunity.js" defer></script>
</body>
</html>
'''

def page_hero(crumb, eyebrow, h1, lede, badge=None):
    b = f'\n      <span class="badge badge--{badge[1]}">{badge[0]}</span>' if badge else ""
    return f'''  <section class="page-hero">
    <div class="shell">
      <nav class="crumb" aria-label="Breadcrumb">
        <a href="index.html">Opportunity</a><span>/</span><span>{crumb}</span>
      </nav>
      <p class="eyebrow">{eyebrow}</p>
      <h1 class="display">{h1}</h1>
      <p class="lede">{lede}</p>{b}
    </div>
  </section>

'''

def cta_panel(title, lede, buttons):
    btns = "".join(buttons)
    return f'''  <section class="section">
    <div class="shell">
      <div class="cta-panel" data-reveal>
        <h2 class="display">{title}</h2>
        <p class="lede">{lede}</p>
        <div class="btn-row">{btns}</div>
      </div>
    </div>
  </section>

'''

def btn(label, href, kind="btn-primary", arrow=False):
    return f'<a class="btn {kind} btn-lg" href="{href}">{label}{ARROW if arrow else ""}</a>'

# ---------------------------------------------------------------- content ----
STEPS = [("1","Share","Introduce business owners through your personalized Genysis IQ website, referral link, or QR code."),
         ("2","AI Evaluates","The AI platform learns about the business, identifies needs, and evaluates potential opportunities."),
         ("3","AI Recommends","The platform explains and recommends appropriate Genysis IQ or approved partner services."),
         ("4","We Deliver","Genysis IQ or an approved provider delivers the service, and eligible commissions are released.")]

SERVICES = [
 ("website-intelligence","chart","Website Intelligence","Understand how a website actually performs — and where it quietly loses customers.",
  ["Website performance analysis","Customer-engagement analysis","Lead-conversion analysis","AI-search discoverability","Website competitive comparison","Mobile and usability review"],None),
 ("website-creation","layout","Website Creation","Websites built to convert, not just to exist.",
  ["New business websites","Website redesign","Landing pages","Conversion-focused websites","AI-enabled websites","Website management and maintenance"],None),
 ("conversational-ai","chat","Conversational AI","Assistants that answer customers at 2am, qualify leads, and book appointments.",
  ["Website AI assistants","Lead qualification","Frequently asked questions","Appointment support","After-hours inquiry handling","Customer-service assistance","Internal knowledge assistants","Multilingual conversational support"],None),
 ("security","shield","Cybersecurity &amp; Penetration Testing","Authorized testing that finds exposure before somebody else does.",
  ["External vulnerability assessment","Website penetration testing","Web-application testing","Exposure and risk reporting","Retesting after remediation","Recurring security monitoring"],
  "Security testing is performed under written authorization and reports on findings identified during a defined testing window. Automated scanning alone does not constitute penetration testing, and no assessment can guarantee that a system is free of vulnerabilities."),
 ("market-intelligence","compass","Competitive &amp; Market Intelligence","What competitors charge, promise, and get reviewed for — in one place.",
  ["Competitor website analysis","Pricing and offer comparison","Customer-review analysis","Positioning and messaging comparison","Digital-presence comparison","Market opportunity research","Competitive SWOT analysis"],None),
 ("automation","flow","AI &amp; Business Automation","Removing the manual work that quietly consumes a team's week.",
  ["Lead follow-up","CRM automation","Customer onboarding","Internal knowledge systems","Proposal and document workflows","Operational reporting","Sales-support systems"],None),
 ("business-scaling","steps","Business Scaling","The CASPER work Genysis IQ has been doing for businesses since day one.",
  ["AI-led business assessments","CASPER-guided scaling programs","Systems and process evaluation","Delegation and decentralization","Operational architecture","Customized advisor-assisted engagements"],None),
]

LEVELS = [(1,6),(2,2),(3,2),(4,2),(5,4),(6,4),(7,6)]

FAQ = [
 ("Do I need AI experience?","No. The representative's primary role is generating qualified traffic, making introductions, developing relationships, and building an organization. The platform and the Genysis IQ team handle technical selling and delivery."),
 ("Will representatives deliver the services?","Generally, no. Services will be delivered by Genysis IQ, internal advisors, automated systems, or approved external providers."),
 ("What does the AI website do?","It is intended to learn about the customer's business, identify needs, recommend appropriate services, answer questions, facilitate purchases, and collect onboarding information."),
 ("How do representatives find customers?","Through professional relationships, networking, referrals, personalized links, QR codes, and approved marketing."),
 ("What services will be available?","The developing catalog includes website analytics, website creation, conversational AI, penetration testing, competitive analysis, AI-search visibility, automation, and business-scaling services."),
 ("Is the compensation plan final?","No. The structure is being modeled and evaluated. Final percentages, qualifications, ranks, bonuses, and terms may change before launch."),
 ("What is Commissionable Revenue?","It is the dollar amount assigned to each service from which representative commissions are calculated."),
 ("What is the proposed $395 package?","It is a proposed representative launch package expected to include training, a personalized AI website, back-office access, tracking, and AI support. Final price and contents are subject to change."),
 ("Are representatives paid for recruiting?","The plan is intended to pay commissions and bonuses from delivered customer services. Representative enrollment fees are not intended to create commissionable sales volume."),
 ("Can representatives purchase services?","Yes. Representatives who legitimately need services for their own businesses may purchase them as customers. Purchases should not replace external customer acquisition."),
 ("What is the Founding Leader Program?","It is a proposed, limited program for experienced leaders who may receive provisional top-rank treatment while completing customer and leadership milestones."),
 ("When will the program launch?","The launch date has not yet been finalized. Prospective representatives may join the interest list for updates."),
 ("Does expressing interest enroll me?","No. Expressing interest does not create a representative agreement, guarantee acceptance, or guarantee a Founding Leader position."),
 ("Is income guaranteed?","No. No earnings or business results are guaranteed."),
]

DISC_COMP = ("The Genysis IQ compensation plan is under development. Percentages, Commissionable "
 "Revenue assignments, rank qualifications, bonus triggers, leadership-pool funding, maintenance "
 "requirements, and all other terms may be revised before launch. No income is guaranteed. Earnings, "
 "if any, will depend on customer activity, organizational performance, individual effort, market "
 "conditions, and compliance with the final plan and policies.")

def li(items, cls=""):
    c = f' class="{cls}"' if cls else ""
    return f'<ul{c}>' + "".join(f"<li>{i}</li>" for i in items) + "</ul>"

pathlib.Path(".").mkdir(exist_ok=True)

# ============================================================ 1. HOME =========
steps_html = "".join(
 f'<div class="step" data-reveal><div class="step-n">{n}</div><h3>{t}</h3><p>{b}</p></div>'
 for n,t,b in STEPS)

svc_preview = "".join(
 f'''<a class="svc-card" href="services.html#{sid}" data-reveal>
        <div class="svc-icon">{icon(ic)}</div>
        <h3>{name}</h3>
        <p>{blurb}</p>
        <div class="svc-foot"><span class="badge badge--teal">Initial Service Category</span></div>
      </a>''' for sid,ic,name,blurb,items,note in SERVICES)

home = head("Genysis IQ AI Services Opportunity | Founding-Stage Information",
  "Explore the developing Genysis IQ AI services direct-sales opportunity, personalized AI sales platform, proposed compensation structure, service portfolio, and Founding Leader Program.",
  "index.html")

home += f'''  <section class="hero">
    <div class="shell hero-grid">
      <div>
        <span class="badge badge--navy">Founding Stage</span>
        <h1 class="display">Build an AI Services Business Without Becoming an <em>AI Technician</em></h1>
        <p class="lede">
          Introduce business owners to a personalized AI platform that identifies their needs,
          recommends appropriate services, and facilitates the sale. Genysis IQ and approved
          providers handle service delivery while you focus on relationships, referrals, and
          building your organization.
        </p>
        <div class="btn-row">
          {btn("Explore the Opportunity","representative.html","btn-primary",True)}
          {btn("Join the Founding Interest List","express-interest.html","btn-ghost")}
        </div>
        <p class="hero-note">
          This is a founding-stage program. Results require consistent introductions,
          referrals, customer acquisition, relationship development, and leadership.
          No income is guaranteed.
        </p>
      </div>

      <div class="model-card" data-reveal>
        <h2>How the model works</h2>
        <div class="model-line">
          <div><b>1</b><span><strong>Representatives</strong>Create traffic through relationships, referrals and introductions.</span></div>
          <div><b>2</b><span><strong>AI</strong>Creates sales — evaluating needs, recommending services, answering questions.</span></div>
          <div><b>3</b><span><strong>Genysis IQ</strong>And approved providers deliver the services.</span></div>
        </div>
      </div>
    </div>
  </section>

  <section class="section section--wash">
    <div class="shell">
      <div class="sec-head sec-head--center">
        <p class="eyebrow">The model</p>
        <h2 class="display">Four steps, start to finish</h2>
        <p class="lede">You are responsible for one of them. The platform and the company handle the rest.</p>
      </div>
      <div class="steps">{steps_html}</div>
    </div>
  </section>

  <section class="section">
    <div class="shell">
      <div class="sec-head">
        <p class="eyebrow">What customers can buy</p>
        <h2 class="display">A service catalog you never have to <em>personally deliver</em></h2>
        <p class="lede">
          Seven initial categories, delivered by Genysis IQ or an approved provider.
          The catalog is expected to expand as customer needs and AI capabilities evolve.
        </p>
      </div>
      <div class="svc-grid">{svc_preview}</div>
      <div class="btn-row" style="margin-top:26px">{btn("View the Services","services.html","btn-ghost")}</div>
    </div>
  </section>

  <section class="section section--navy">
    <div class="shell">
      <div class="sec-head">
        <p class="eyebrow">The platform</p>
        <h2 class="display">An AI-powered representative platform</h2>
        <p class="lede">Each representative is expected to receive a personalized platform built to do the technical selling.</p>
      </div>
      <div class="two-col">
        <div>{li(["Personalized AI website carrying your identity and attribution",
                 "AI-driven customer conversations that adapt to each business",
                 "Service matching against the current catalog"],"check-list")}</div>
        <div>{li(["A representative AI business partner working for you",
                 "Customer attribution tied to your introductions",
                 "Commission and organization tracking"],"check-list")}</div>
      </div>
      <div class="btn-row" style="margin-top:28px">{btn("Learn About the AI Platform","ai-advantage.html","btn-on-dark")}</div>
    </div>
  </section>

  <section class="section">
    <div class="shell two-col">
      <div>
        <p class="eyebrow">Your role</p>
        <h2 class="display">You focus on what technology cannot replace</h2>
        <p class="lede" style="margin-bottom:22px">
          The platform carries the product knowledge and conducts the customer conversation.
          Representatives concentrate on:
        </p>
        {li(["Professional relationships","Referrals","Introductions","Generating qualified traffic",
             "Customer acquisition","Organization development"],"check-list")}
        <div class="btn-row" style="margin-top:26px">{btn("See How It Works","how-it-works.html","btn-ghost")}</div>
      </div>
      <div class="panel" data-reveal>
        <div class="panel-head">
          <h3>Compensation preview</h3>
          <span class="badge badge--amber">Proposed</span>
        </div>
        <p style="font-size:14.5px">The developing plan is intended to reward customer acquisition and leadership, not enrollment:</p>
        {li(["Personal customer commissions","Seven levels of organizational commissions",
             "Fast Start incentives","Rank advancement","Leadership-development bonuses",
             "Leadership pool","Recurring-service opportunities"],"check-list")}
        <div class="disclaimer disclaimer--tight" style="margin-top:20px">
          <strong>Proposed structure — not final.</strong>
          Percentages, qualifications and terms may be revised before launch. No income is guaranteed.
        </div>
        <div class="btn-row" style="margin-top:20px">{btn("Review the Compensation Preview","compensation.html","btn-ghost")}</div>
      </div>
    </div>
  </section>

  <section class="section section--wash2">
    <div class="shell">
      <div class="two-col" style="align-items:center">
        <div>
          <p class="eyebrow">For experienced leaders</p>
          <h2 class="display">A proposed Founding Leader Program</h2>
          <p class="lede">
            Genysis IQ is considering a limited program for experienced direct-sales and
            network-marketing leaders who can help establish the initial field organization,
            develop customer-producing teams, and contribute practical insight during launch.
          </p>
          <div class="btn-row" style="margin-top:24px">
            {btn("Request Founding Leader Information","express-interest.html?interest=founding","btn-navy",True)}
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><h3>Under consideration</h3><span class="badge badge--amber">Proposed</span></div>
          {li(["Provisional access to the full seven-level pay structure","Founding Executive Director recognition",
               "Early access to the AI platform","Input into representative systems and training",
               "Accelerated leadership-pool eligibility"],"check-list")}
          <p class="field-hint" style="margin-top:16px">
            Participation will be limited and subject to company approval. Founding status
            does not guarantee income and does not imply company ownership.
          </p>
        </div>
      </div>
    </div>
  </section>

'''
home += cta_panel("The AI services market is expanding rapidly.",
 "Genysis IQ is building the distribution channel designed to connect practical solutions with the businesses that need them.",
 [btn("Explore the Opportunity","representative.html","btn-primary",True),
  btn("Request Founding Leader Information","express-interest.html?interest=founding","btn-on-dark")])
home += FOOT
pathlib.Path("index.html").write_text(home)
print("index.html")

# ==================================================== 2. HOW IT WORKS =========
journey = ["A representative provides an introduction.",
 "The customer visits the personalized Genysis IQ AI website.",
 "The AI learns about the customer's business.",
 "The platform identifies needs and opportunities.",
 "The AI recommends relevant services.",
 "The customer reviews the recommendation and asks questions.",
 "The customer purchases or schedules a consultation.",
 "Genysis IQ or an approved provider completes the service.",
 "The platform identifies future opportunities and recurring needs."]

p = head("How It Works | Genysis IQ AI Services Opportunity",
 "How the Genysis IQ representative model works: the representative's role, the customer journey, centralized fulfillment, and why the model is designed to be duplicatable.",
 "how-it-works.html")
p += page_hero("How It Works","The model",
 "Representatives create traffic. AI creates sales. <em>Genysis IQ delivers.</em>",
 "One sentence describes the whole model. This page explains what sits behind it — for the representative and for the customer.")
p += f'''  <section class="section">
    <div class="shell two-col">
      <div>
        <p class="eyebrow">Your role</p>
        <h2 class="display">What representatives will do</h2>
        <p class="lede" style="margin:14px 0 22px">
          The work is relationship work. It is not technical work.
        </p>
        {li(["Build professional relationships","Identify potential customers",
             "Share their personalized AI website","Generate qualified traffic",
             "Follow up appropriately","Develop other representatives",
             "Help new representatives begin generating customer activity",
             "Build and support an organization"],"check-list")}
      </div>
      <div>
        <p class="eyebrow">Not your role</p>
        <h2 class="display">What representatives will <em>not</em> normally do</h2>
        <p class="lede" style="margin:14px 0 22px">
          These stay with Genysis IQ, its advisors, and approved providers.
        </p>
        {li(["Conduct technical analyses","Build customer websites","Program conversational AI",
             "Conduct penetration testing","Scope complicated technology projects",
             "Personally deliver CASPER consulting","Manage external service providers",
             "Collect customer payments independently"],"cross-list")}
      </div>
    </div>
  </section>

  <section class="section section--wash">
    <div class="shell">
      <div class="sec-head">
        <p class="eyebrow">The customer journey</p>
        <h2 class="display">What the customer actually experiences</h2>
        <p class="lede">From your introduction to a delivered service, and then to what comes next.</p>
      </div>
      <ol class="timeline" data-reveal>{"".join(f"<li>{s}</li>" for s in journey)}</ol>
    </div>
  </section>

  <section class="section">
    <div class="shell">
      <div class="sec-head">
        <p class="eyebrow">Centralized fulfillment</p>
        <h2 class="display">Genysis IQ controls the parts that must be controlled</h2>
        <p class="lede">
          Representatives are not asked to price work, hold agreements, chase payments, or manage
          providers. The company does that, so the field can concentrate on customers.
        </p>
      </div>
      <div class="two-col">
        <div>{li(["Service presentation","Customer agreements","Pricing","Payments","Technical delivery"],"check-list")}</div>
        <div>{li(["Quality review","Provider coordination","Customer support","Commission calculation"],"check-list")}</div>
      </div>
    </div>
  </section>

  <section class="section section--navy">
    <div class="shell">
      <div class="sec-head" style="max-width:none">
        <p class="eyebrow">Why the model is duplicatable</p>
        <h2 class="display" style="max-width:24ch">The representative does not have to master every technical service.</h2>
        <p class="lede" style="max-width:76ch">
          The platform carries the product knowledge, conducts the customer conversation, and
          recommends appropriate solutions. Representatives focus on the activities that
          technology cannot replace: relationships, trust, introductions, and leadership.
        </p>
      </div>
      <div class="btn-row">
        {btn("Learn About the AI Platform","ai-advantage.html","btn-on-dark",True)}
        {btn("View the Services","services.html","btn-on-dark")}
      </div>
    </div>
  </section>

'''
p += cta_panel("Ready to look closer?",
 "See who the opportunity is designed for, and what would be expected of you.",
 [btn("Explore the Opportunity","representative.html","btn-primary",True),
  btn("Express Interest","express-interest.html","btn-on-dark")])
p += FOOT
pathlib.Path("how-it-works.html").write_text(p); print("how-it-works.html")

# ======================================================== 3. SERVICES =========
cards = ""
for sid,ic,name,blurb,items,note in SERVICES:
    n = f'<div class="disclaimer disclaimer--tight" style="margin-top:16px">{note}</div>' if note else ""
    cards += f'''      <article class="svc-card" id="{sid}" data-reveal>
        <div class="svc-icon">{icon(ic)}</div>
        <h3>{name}</h3>
        <p>{blurb}</p>
        {li(items,"svc-list")}
        <div class="svc-foot"><span class="badge badge--teal">Initial Service Category</span></div>
        {n}
      </article>
'''

p = head("Services | Genysis IQ AI Services Opportunity",
 "The developing Genysis IQ service catalog: website intelligence, website creation, conversational AI, cybersecurity and penetration testing, competitive intelligence, AI automation, and CASPER business scaling.",
 "services.html")
p += page_hero("Services","The catalog",
 "What customers can <em>actually buy</em>",
 "Seven initial categories, delivered by Genysis IQ or an approved provider. Representatives introduce them; they do not deliver them.",
 ("Initial Service Categories — Subject to Change","teal"))
p += f'''  <section class="section">
    <div class="shell">
      <div class="svc-grid">{cards}      </div>
    </div>
  </section>

  <section class="section section--wash">
    <div class="shell">
      <div class="two-col" style="align-items:center">
        <div>
          <p class="eyebrow">What comes next</p>
          <h2 class="display">A service marketplace designed to grow</h2>
          <p class="lede" style="margin-top:14px">
            Genysis IQ intends to continuously evaluate additional AI services developed
            internally and by approved outside AI companies. This will allow the service
            portfolio to expand as customer needs and AI capabilities evolve.
          </p>
        </div>
        <div class="notice-strip">
          <strong>A note on pricing.</strong> Service pricing has not been finalised and is not
          published here. Pricing, packaging and the commissionable amount assigned to each
          service will be established before launch.
        </div>
      </div>
    </div>
  </section>

'''
p += cta_panel("You introduce. The platform explains.",
 "You are never expected to scope a penetration test or quote a website build. See how the AI carries the technical conversation.",
 [btn("Learn About the AI Platform","ai-advantage.html","btn-primary",True),
  btn("See How It Works","how-it-works.html","btn-on-dark")])
p += FOOT
pathlib.Path("services.html").write_text(p); print("services.html")

# =================================================== 4. THE AI ADVANTAGE ======
CUST = [("Representative identity and attribution","Your customers are tied to you, automatically."),
 ("Adaptive business conversation","The AI asks about the business rather than reciting a brochure."),
 ("Business-needs analysis","It works out what the business is actually missing."),
 ("Service recommendations","It matches those needs to appropriate Genysis IQ or partner services."),
 ("Customer education","It explains why a service matters, in business terms."),
 ("Questions and objections","It answers the technical questions you would rather not field."),
 ("Purchasing and onboarding","Standardized purchases and onboarding information, handled on the page."),
 ("Human scheduling when necessary","Complex situations route to a Genysis IQ advisor.")]

REP = [("Learns your goals and preferred markets","It adapts to who you actually sell to."),
 ("Helps identify likely prospects","Where to look, and who to start with."),
 ("Writes invitations and outreach messages","Drafts you edit, not scripts you recite."),
 ("Creates approved social and marketing content","Material that stays inside company guidelines."),
 ("Explains services","So you never have to memorize a technical catalog."),
 ("Provides training","On demand, at the point you need it."),
 ("Tracks Fast Start progress","What is done, what is left, what is next."),
 ("Monitors customer activity","Which customers are active and what they may need next."),
 ("Explains commissions","In plain language, tied to your actual activity."),
 ("Supports organization development","Helping you help the people you sponsor."),
 ("Coaches you on activity and performance","Guidance shaped by what you are actually doing.")]

def feat_grid(rows):
    return '<div class="svc-grid">' + "".join(
      f'<div class="svc-card" data-reveal><h3 style="font-size:15.5px">{t}</h3>'
      f'<p style="margin:0">{d}</p></div>' for t,d in rows) + "</div>"

p = head("The AI Advantage | Genysis IQ AI Services Opportunity",
 "Each Genysis IQ representative is expected to receive a personalized AI customer website and an AI business partner — the platform that carries the technical selling.",
 "ai-advantage.html")
p += page_hero("The AI Advantage","The platform",
 "Two AIs. One works for your <em>customer</em>. One works for <em>you</em>.",
 "Each representative is expected to receive a personalized AI-powered business platform. This is the part of the model that makes it possible to sell technical services without being technical.",
 ("In Development","amber"))
p += f'''  <section class="section">
    <div class="shell">
      <div class="sec-head">
        <p class="eyebrow">Your customer-facing site</p>
        <h2 class="display">Your personalized customer website</h2>
        <p class="lede">
          The place you send every introduction. It carries your identity, holds the
          conversation, and does the explaining.
        </p>
      </div>
      {feat_grid(CUST)}
    </div>
  </section>

  <section class="section section--wash">
    <div class="shell">
      <div class="sec-head">
        <p class="eyebrow">Your side of the platform</p>
        <h2 class="display">Your AI business partner</h2>
        <p class="lede">
          A second AI, working for you rather than your customer. Persistent memory and
          account data are intended to make it more useful the longer you work with it.
        </p>
      </div>
      {feat_grid(REP)}
    </div>
  </section>

  <section class="section section--navy">
    <div class="shell">
      <div class="sec-head sec-head--center" style="max-width:60ch">
        <p class="eyebrow">The part that matters</p>
        <h2 class="display">AI does not replace relationships</h2>
        <p class="lede" style="font-size:clamp(17px,2.2vw,21px)">
          AI can evaluate, educate, recommend, and automate. Representatives create trust,
          relationships, introductions, and leadership.
        </p>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="shell">
      <div class="disclaimer">
        <strong>Platform features are in development.</strong>
        The capabilities described on this page represent the intended design of the Genysis IQ
        representative platform. Functionality, availability and timing may change before launch.
      </div>
    </div>
  </section>

'''
p += cta_panel("The platform does the selling. You do the introducing.",
 "See what would be expected of you as a representative — and what would not.",
 [btn("Explore the Opportunity","representative.html","btn-primary",True),
  btn("Review the Compensation Preview","compensation.html","btn-on-dark")])
p += FOOT
pathlib.Path("ai-advantage.html").write_text(p); print("ai-advantage.html")

# ============================================ 5. REPRESENTATIVE OPPORTUNITY ===
PKG = ["Initial onboarding","Representative training","Personalized AI website","Back-office access",
       "Customer attribution","Commission tracking","Representative AI business partner",
       "Approved marketing resources"]

p = head("Representative Opportunity | Genysis IQ AI Services",
 "Who fits the Genysis IQ representative opportunity, who does not, and what the proposed representative launch package is expected to include.",
 "representative.html")
p += page_hero("Representative Opportunity","The opportunity",
 "This will suit some people <em>and not others</em>",
 "We would rather you decide that here than three conversations from now. Below is an honest description of who tends to do well in a model like this — and who does not.")
p += f'''  <section class="section">
    <div class="shell two-col">
      <div class="panel" data-reveal>
        <div class="panel-head"><h3>Likely a good fit</h3><span class="badge badge--teal">Good fit</span></div>
        {li(["Comfortable building relationships","Has an existing professional or personal network",
             "Willing to introduce business owners to the platform","Interested in AI and business services",
             "Coachable","Consistent","Interested in customer acquisition",
             "Interested in developing other people","Understands that results require effort"],"check-list")}
      </div>
      <div class="panel" data-reveal>
        <div class="panel-head"><h3>Likely not a good fit</h3><span class="badge badge--grey">Not a fit</span></div>
        {li(["Expects guaranteed income","Wants to earn primarily from enrollment",
             "Is unwilling to acquire customers","Makes exaggerated product or income claims",
             "Does not want to learn or follow approved systems",
             "Expects the AI to replace all personal activity",
             "Wants immediate results without sustained effort"],"cross-list")}
      </div>
    </div>
  </section>

  <section class="section section--wash">
    <div class="shell">
      <div class="sec-head">
        <p class="eyebrow">Who this is built for</p>
        <h2 class="display">Professionals with a network and a reason to use it</h2>
        <p class="lede">
          The model tends to suit people who already talk to business owners for a living, and
          who want a way to bring them something useful.
        </p>
      </div>
      <div class="two-col">
        <div>{li(["Experienced direct-sales and network-marketing leaders","Business consultants",
                 "Professional networkers and referral partners","Sales professionals",
                 "Insurance and financial-services professionals","Real-estate and mortgage professionals"],"check-list")}</div>
        <div>{li(["Home-services professionals","Marketing professionals","Solopreneurs and business owners",
                 "People with strong professional networks",
                 "People interested in recurring income from legitimate customer services",
                 "People interested in AI who do not want to become technical implementers"],"check-list")}</div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="shell">
      <div class="two-col" style="align-items:start">
        <div>
          <p class="eyebrow">Getting started</p>
          <h2 class="display">The proposed launch package</h2>
          <p class="lede" style="margin:14px 0 20px">
            Genysis IQ is considering a representative launch package covering the systems
            and training a new representative would need to begin.
          </p>
          <div class="disclaimer">
            <strong>Proposed launch-package price and contents are subject to change before official launch.</strong>
            The launch package covers onboarding, training, systems access and support. It is not an
            investment, it does not purchase equity in Genysis IQ, and it does not guarantee earnings.
          </div>
        </div>
        <div class="panel" data-reveal>
          <div class="panel-head">
            <h3 style="font-family:var(--serif);font-weight:400;font-size:2.4rem;color:var(--teal-700)">$395</h3>
            <span class="badge badge--amber">Proposed</span>
          </div>
          <p style="font-size:14px;color:var(--muted);margin-top:-8px">Representative launch package — expected to include:</p>
          {li(PKG,"check-list")}
        </div>
      </div>
    </div>
  </section>

  <section class="section section--navy">
    <div class="shell">
      <div class="sec-head" style="max-width:70ch">
        <p class="eyebrow">Being straight with you</p>
        <h2 class="display">Sharing a website is not a business</h2>
        <p class="lede">
          The platform removes the technical barrier. It does not remove the work. Results in this
          model require consistent introductions, referrals, customer acquisition, relationship
          development, and leadership. Representatives who do not consistently introduce the
          platform to real business owners should not expect results.
        </p>
      </div>
    </div>
  </section>

'''
p += cta_panel("Still interested?",
 "Expressing interest does not enroll you, guarantee acceptance, or promise earnings. It puts you on the list for updates as the program develops.",
 [btn("Express Interest","express-interest.html","btn-primary",True),
  btn("Review the Compensation Preview","compensation.html","btn-on-dark")])
p += FOOT
pathlib.Path("representative.html").write_text(p); print("representative.html")

# ================================================ 6. COMPENSATION PREVIEW =====
maxpct = max(v for _,v in LEVELS)
lv = "".join(
 f'''<div class="level"><span>Level {n}</span>
      <div class="level-bar"><i style="height:{int(v/maxpct*100)}%"></i></div>
      <b>{v}%</b></div>''' for n,v in LEVELS)

p = head("Compensation Preview | Genysis IQ AI Services Opportunity",
 "The proposed Genysis IQ compensation structure: personal customer commissions, seven levels of organizational commissions, Fast Start, rank advancement, and a leadership pool. Under development.",
 "compensation.html")
p += page_hero("Compensation Preview","Compensation",
 "A Compensation Plan Designed Around <em>Customer Services</em> and Leadership",
 "The plan is being modeled and evaluated. Everything on this page is proposed, and the numbers below may change before launch.",
 ("Proposed Structure — Not Final","amber"))
p += f'''  <section class="section">
    <div class="shell">
      <div class="comp-hero">
        <div class="comp-stat" data-reveal>
          <b>20%</b>
          <span>Personal customer commission</span>
          <p>Proposed. Paid on the Commissionable Revenue assigned to services personally referred by the representative.</p>
        </div>
        <div class="comp-stat" data-reveal>
          <b>7</b>
          <span>Levels of organizational commissions</span>
          <p>Proposed. Structured to reward both personal leadership at Level 1 and organizational depth at Levels 5 to 7.</p>
        </div>
      </div>

      <div class="sec-head">
        <p class="eyebrow">First, one piece of vocabulary</p>
        <h2 class="display">What is Commissionable Revenue?</h2>
      </div>
      <div class="notice-strip" style="max-width:76ch">
        Because services have different prices and delivery costs, each service will be assigned a
        commissionable dollar amount. Commissions will be calculated from that figure rather than
        automatically from the full retail price.
      </div>
    </div>
  </section>

  <section class="section section--wash">
    <div class="shell">
      <div class="sec-head">
        <p class="eyebrow">Proposed</p>
        <h2 class="display">Seven-level organizational commissions</h2>
        <p class="lede">{
          "The proposed structure places strong percentages at Level 1 and at the deepest levels "
          "to reward both personal leadership and organizational depth."}</p>
      </div>
      <div class="levels" role="list" aria-label="Proposed commission percentage by level">{lv}</div>
      <p class="field-hint" style="margin-top:16px">
        All percentages apply to Commissionable Revenue, not retail price. Proposed and subject to change.
      </p>
    </div>
  </section>

  <section class="section">
    <div class="shell">
      <div class="sec-head">
        <p class="eyebrow">What the plan is designed to reward</p>
        <h2 class="display">Customers and leadership — not enrollment</h2>
      </div>
      <div class="two-col">
        <div>{li(["Customer acquisition","Delivered customer services",
                 "Helping newly sponsored representatives acquire customers","Organizational depth"],"check-list")}</div>
        <div>{li(["Leadership development","Recurring customer relationships",
                 "Development of independently productive teams"],"check-list")}</div>
      </div>
    </div>
  </section>

  <section class="section section--wash2">
    <div class="shell">
      <div class="svc-grid">
        <div class="svc-card" data-reveal>
          <div class="panel-head"><h3>Fast Start</h3><span class="badge badge--amber">In Development</span></div>
          <p>The developing Fast Start program is intended to reward new representatives for
             acquiring genuine customers, and to reward sponsors for helping those representatives
             begin successfully. Sponsor Fast Start bonuses may increase by rank.</p>
        </div>
        <div class="svc-card" data-reveal>
          <div class="panel-head"><h3>Rank advancement</h3><span class="badge badge--amber">In Development</span></div>
          <p>The developing rank system is expected to unlock additional paid levels, increase Fast
             Start leadership compensation, provide recognition, create leadership-pool eligibility,
             and shift qualification emphasis from personal customer acquisition toward team and
             leader development as representatives advance.</p>
        </div>
        <div class="svc-card" data-reveal>
          <div class="panel-head"><h3>Leadership pool</h3><span class="badge badge--amber">Proposed</span></div>
          <p>Senior field leaders may qualify to share in a company-funded leadership pool based on
             organizational customer revenue, leadership development, customer retention, and
             continued qualification.</p>
        </div>
        <div class="svc-card" data-reveal>
          <div class="panel-head"><h3>Recurring revenue</h3><span class="badge badge--amber">Proposed</span></div>
          <p>Eligible recurring services may generate continuing personal and organizational
             commissions while customers remain active and services continue to be delivered.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="shell">
      <div class="disclaimer" role="note">
        <strong>Compensation notice</strong>
        {DISC_COMP}
      </div>
    </div>
  </section>

'''
p += cta_panel("Questions about the plan?",
 "The structure is still being modeled. If you are an experienced leader, your input during this stage is genuinely useful.",
 [btn("Request Founding Leader Information","express-interest.html?interest=founding","btn-primary",True),
  btn("Express Interest","express-interest.html","btn-on-dark")])
p += FOOT
pathlib.Path("compensation.html").write_text(p); print("compensation.html")

# ==================================================== 7. FOUNDING LEADERS =====
BEN = ["Provisional access to the full seven-level pay structure","Defined performance milestones",
 "Founding Executive Director recognition","Early access to the AI platform",
 "Participation in field testing","Input into representative systems and training",
 "Accelerated leadership-pool eligibility","Priority communication and support",
 "Permanent recognition after completing required milestones"]
EXP = ["Customer acquisition","Development of customer-producing representatives",
 "Multiple independently productive frontline organizations","Active leadership and coaching",
 "Compliance with company standards","Participation in launch training and testing",
 "Completion of milestone requirements within the provisional period"]
LIMITS = ["Founding status will not guarantee income.",
 "Provisional top-rank treatment must be earned and maintained.",
 "Missing milestones may result in the leader being paid at the rank actually qualified for.",
 "Founding Leader status does not imply company ownership.",
 "Participation will be limited and subject to company approval.",
 "Final requirements have not been established."]

p = head("Founding Leaders | Genysis IQ AI Services Opportunity",
 "A proposed, limited Founding Leader Program for experienced direct-sales and network-marketing leaders who can help establish the initial Genysis IQ field organization.",
 "founding-leaders.html")
p += page_hero("Founding Leaders","For experienced leaders",
 "Help Build the <em>Foundation</em>",
 "Genysis IQ is considering a limited Founding Leader Program for experienced leaders who can help establish the initial field organization, develop customer-producing teams, and contribute practical insight during launch.",
 ("Proposed Program — In Development","amber"))
p += f'''  <section class="section">
    <div class="shell two-col">
      <div class="panel" data-reveal>
        <div class="panel-head"><h3>Proposed benefits</h3><span class="badge badge--amber">Proposed</span></div>
        {li(BEN,"check-list")}
      </div>
      <div class="panel" data-reveal>
        <div class="panel-head"><h3>Proposed expectations</h3><span class="badge badge--amber">Proposed</span></div>
        {li(EXP,"check-list")}
      </div>
    </div>
  </section>

  <section class="section section--wash">
    <div class="shell">
      <div class="sec-head">
        <p class="eyebrow">Read this part carefully</p>
        <h2 class="display">What Founding Leader status is <em>not</em></h2>
        <p class="lede">
          Experienced leaders have seen founding programs used as a recruiting device. We would
          rather set the limits out plainly than have you discover them later.
        </p>
      </div>
      {li(LIMITS,"cross-list")}
      <div class="disclaimer" style="margin-top:28px">
        <strong>Founding Leader Program notice</strong>
        Founding status will not guarantee income. Provisional top-rank treatment must be earned and
        maintained. Missing milestones may result in the leader being paid at the rank actually
        qualified for. Founding Leader status does not imply company ownership. Participation will be
        limited and subject to company approval. Final requirements have not been established.
      </div>
    </div>
  </section>

  <section class="section section--navy">
    <div class="shell">
      <div class="sec-head" style="max-width:70ch">
        <p class="eyebrow">Why now</p>
        <h2 class="display">Input while the plan is still being written</h2>
        <p class="lede">
          The compensation structure, representative systems and training are being modeled right
          now. Leaders who join at this stage are being asked to help shape them — and to tell us
          where the plan would not survive contact with a real field organization.
        </p>
      </div>
    </div>
  </section>

'''
p += cta_panel("Request Founding Leader Information",
 "Submitting the form does not enroll you, guarantee acceptance, or guarantee a Founding Leader position. It starts a conversation.",
 [btn("Request Founding Leader Information","express-interest.html?interest=founding","btn-primary",True),
  btn("Review the Compensation Preview","compensation.html","btn-on-dark")])
p += FOOT
pathlib.Path("founding-leaders.html").write_text(p); print("founding-leaders.html")

# ========================================================== 8. ABOUT ==========
CASPER = [("Clarity","Find the real constraint before spending money on symptoms."),
 ("Architecture","Design roles, structure and decision flow deliberately."),
 ("Systems","Build the tools and management systems execution needs."),
 ("Processes","Make execution repeatable and documented."),
 ("Evaluation","Measure performance with practical KPIs."),
 ("Replication","Make success transferable and scalable.")]

casper_html = "".join(
 f'<div class="svc-card" data-reveal><div class="svc-icon" style="background:var(--teal-100);color:var(--teal-700);'
 f'font-family:var(--serif);font-size:22px">{n[0]}</div><h3>{n}</h3><p style="margin:0">{d}</p></div>'
 for n,d in CASPER)

p = head("About Genysis IQ | AI Services Opportunity",
 "Genysis IQ is a business scaling and practical AI consultancy. The CASPER framework, the company's capabilities, and the experience behind the AI services distribution channel.",
 "about.html")
p += page_hero("About Genysis IQ","The company behind it",
 "Where Intelligent Business <em>Scaling Begins</em>",
 "Genysis IQ helps businesses identify obstacles, create scalable architecture, implement systems and processes, evaluate results, and replicate success — combining business experience with practical AI implementation.")
p += f'''  <section class="section">
    <div class="shell">
      <div class="sec-head">
        <p class="eyebrow">The methodology</p>
        <h2 class="display">CASPER</h2>
        <p class="lede">
          Six stages that take a business from owner-dependent to scalable. It is the framework
          behind the consulting practice — and the basis of the business-scaling services the
          distribution channel will offer.
        </p>
      </div>
      <div class="svc-grid">{casper_html}</div>
      <p style="margin-top:24px">
        <a href="../casper.html">Read the full CASPER framework on the main Genysis IQ site</a>.
      </p>
    </div>
  </section>

  <section class="section section--wash">
    <div class="shell two-col" style="align-items:start">
      <div>
        <p class="eyebrow">Leadership</p>
        <h2 class="display">Ronald J. Clark</h2>
        <p style="color:var(--teal-700);font-weight:600;margin:8px 0 18px">Founder &amp; Chief Executive Officer</p>
        {li(["Approximately 39 years of business experience",
             "Experience building multiple companies, including international businesses",
             "Author of <em>Dynamic ChatGPT: AI Strategies for Small Business</em>",
             "AI and machine-learning executive education from MIT, the Wharton School of the "
             "University of Pennsylvania, and the London School of Economics"],"check-list")}
      </div>
      <div class="panel">
        <h3>What Genysis IQ does today</h3>
        <p style="font-size:14.5px;margin-top:10px">
          The consultancy already delivers the categories the distribution channel is being built
          around — which is why the service catalog is not theoretical:
        </p>
        {li(["Business scaling and organizational architecture","Systems, processes and SOP development",
             "Practical AI strategy and implementation","Website strategy and AI-search discoverability",
             "Competitive and market intelligence","Cybersecurity and penetration testing",
             "Workflow and business automation"],"check-list")}
      </div>
    </div>
  </section>

  <section class="section section--navy">
    <div class="shell">
      <div class="sec-head sec-head--center" style="max-width:62ch">
        <p class="eyebrow">The positioning</p>
        <h2 class="display">We turn business chaos into scalable assets.</h2>
        <p class="lede">
          The direct-sales division extends that work: an AI-powered distribution ecosystem for
          practical business services, connecting businesses with the AI and professional services
          they need.
        </p>
      </div>
    </div>
  </section>

'''
p += cta_panel("Learn how the opportunity works",
 "The company is established. The distribution channel is being built now.",
 [btn("Explore the Opportunity","representative.html","btn-primary",True),
  btn("See How It Works","how-it-works.html","btn-on-dark")])
p += FOOT
pathlib.Path("about.html").write_text(p); print("about.html")

# ============================================================ 9. FAQ =========
items = ""
for i,(q,a) in enumerate(FAQ):
    items += f'''        <div class="faq-item">
          <h2 style="margin:0">
            <button class="faq-q" id="fq{i}" aria-expanded="false" aria-controls="fa{i}">
              <span>{q}</span><span class="faq-mark" aria-hidden="true"></span>
            </button>
          </h2>
          <div class="faq-a" id="fa{i}" role="region" aria-labelledby="fq{i}" hidden><p>{a}</p></div>
        </div>
'''

p = head("FAQ | Genysis IQ AI Services Opportunity",
 "Straight answers about the developing Genysis IQ AI services direct-sales opportunity: the representative role, the AI platform, the proposed compensation plan, the $395 launch package, and the Founding Leader Program.",
 "faq.html")
p += page_hero("FAQ","Common questions",
 "Answers, <em>including the awkward ones</em>",
 "If the answer is no, or not yet, this page says so.")
p += f'''  <section class="section">
    <div class="shell">
      <div class="faq-list">
{items}      </div>
    </div>
  </section>

'''
p += cta_panel("Ask us something that is not on this list",
 "Expressing interest does not enroll you or guarantee acceptance. It starts a conversation and puts you on the list for updates.",
 [btn("Express Interest","express-interest.html","btn-primary",True),
  btn("See How It Works","how-it-works.html","btn-on-dark")])
p += FOOT
pathlib.Path("faq.html").write_text(p); print("faq.html")

# ================================================= 10. EXPRESS INTEREST =======
STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA",
 "ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA",
 "RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC","Outside the US"]

def field(fid, label, kind="text", req=False, hint=None, auto=None, options=None, err=None):
    r = ' data-required' if req else ''
    star = ' <span class="req" aria-hidden="true">*</span>' if req else ' <span class="field-hint" style="display:inline">(optional)</span>'
    a = f' autocomplete="{auto}"' if auto else ''
    if kind == "select":
        opts = "".join(f'<option value="{o}">{o}</option>' for o in options)
        inner = f'<select id="{fid}" name="{fid}"{" required" if req else ""}><option value="">Please choose…</option>{opts}</select>'
    elif kind == "textarea":
        inner = f'<textarea id="{fid}" name="{fid}"></textarea>'
    else:
        inner = f'<input type="{kind}" id="{fid}" name="{fid}"{a}{" required" if req else ""}>'
    h = f'<span class="field-hint">{hint}</span>' if hint else ""
    e = f'<span class="field-error" role="alert">{err or "This field is required."}</span>'
    return f'<div class="field"{r}><label for="{fid}">{label}{star}</label>{inner}{h}{e}</div>'

form_fields = "".join([
 field("first_name","First name",req=True,auto="given-name"),
 field("last_name","Last name",req=True,auto="family-name"),
 field("email","Email address","email",req=True,auto="email",err="Please enter a valid email address."),
 field("phone","Phone number","tel",req=True,auto="tel"),
 field("city","City",req=True,auto="address-level2"),
 field("state","State","select",req=True,options=STATES),
 field("profession","Current profession or business",req=True,
       hint="What you do today — this helps us understand your network."),
 field("ds_experience","Direct-sales or network-marketing experience","select",req=True,
       options=["No experience","Some experience","Several years","Extensive experience"]),
 field("years","Approximate years of experience","select",
       options=["Not applicable","Less than 1 year","1–3 years","4–7 years","8–15 years","More than 15 years"]),
 field("built_org","Experience building a sales organization","select",
       options=["No","Yes — a small team","Yes — a mid-sized organization","Yes — a large organization"]),
 field("largest_org","Approximate largest organization built",
       hint="Optional. A number or a range is fine."),
 field("market","Primary professional market or industry"),
 field("interestType","What are you interested in?","select",req=True,
       options=["Prospective representative","Experienced leader","Founding Leader consideration",
                "AI-service provider","General information"]),
 field("best_time","Best time to contact","select",
       options=["Morning","Midday","Afternoon","Evening","Any time"]),
])

CONSENT = ("I understand that the Genysis IQ direct-sales program is under development. "
 "Submitting this form does not enroll me as a representative, guarantee acceptance, "
 "guarantee a Founding Leader position, or promise earnings.")

p = head("Express Interest | Genysis IQ AI Services Opportunity",
 "Join the Genysis IQ founding interest list. Expressing interest does not enroll you as a representative, guarantee acceptance, or promise earnings.",
 "express-interest.html")
p += page_hero("Express Interest","Get on the list",
 "Tell us <em>who you are</em>",
 "We are building the initial field organization deliberately rather than quickly. This form starts a conversation — it does not enroll you.")
p += f'''  <section class="section">
    <div class="shell form-wrap">

      <div>
        <form id="interestForm" method="POST"
              action="https://formsubmit.co/{{{{FORM_ENDPOINT}}}}" novalidate>
          <!-- Delivery configuration for the form service; hidden from the visitor.
               See README-OPPORTUNITY.md to change where submissions are delivered. -->
          <input type="hidden" name="_subject" value="Genysis IQ opportunity — interest form">
          <input type="hidden" name="_template" value="table">
          <input type="hidden" name="_captcha" value="false">
          <input type="hidden" name="_next" value="{SITE}/thank-you.html">
          <input type="hidden" name="consent_language" value="{CONSENT}">
          <!-- Honeypot: real people never see this; bots fill it in. -->
          <input type="text" name="_honey" tabindex="-1" autocomplete="off" aria-hidden="true" class="honey">

          <div class="form-grid">
            {form_fields}
            <div class="field field--full">
              <label for="comments">Questions or comments <span class="field-hint" style="display:inline">(optional)</span></label>
              <textarea id="comments" name="comments"></textarea>
            </div>

            <div class="consent" id="consentField">
              <input type="checkbox" id="consent" name="consent" value="Acknowledged">
              <label for="consent">{CONSENT} <span class="req" aria-hidden="true">*</span></label>
            </div>
          </div>

          <p class="form-status" id="formStatus" role="status" aria-live="polite"></p>

          <div class="btn-row" style="margin-top:22px">
            <button class="btn btn-primary btn-lg" type="submit">Express Interest{ARROW}</button>
          </div>
        </form>
      </div>

      <aside>
        <div class="panel" style="margin-bottom:18px">
          <h3>What happens next</h3>
          <ol class="timeline" style="margin-top:16px">
            <li>We read your submission personally. There is no autoresponder sequence.</li>
            <li>If there is a potential fit, someone from Genysis IQ contacts you.</li>
            <li>You receive updates as the program, platform and plan are finalised.</li>
          </ol>
        </div>
        <div class="disclaimer">
          <strong>This is not an enrollment.</strong>
          Expressing interest does not create a representative agreement, guarantee acceptance,
          guarantee a Founding Leader position, or promise earnings. No income is guaranteed.
        </div>
        <div class="notice-strip" style="margin-top:18px">
          Prefer to talk? Call <a href="tel:+16893887353">689.388.7353</a> or email
          <a href="mailto:info@genysisiq.com">info@genysisiq.com</a>.
        </div>
      </aside>

    </div>
  </section>

'''
p += FOOT
pathlib.Path("express-interest.html").write_text(p); print("express-interest.html")

# ================================================== 11. THANK YOU ============
p = head("Thank You | Genysis IQ AI Services Opportunity",
 "Your interest in the Genysis IQ AI services opportunity has been received.",
 "thank-you.html")
p += f'''  <section class="section" style="padding-top:clamp(60px,9vw,120px)">
    <div class="shell" style="max-width:720px">
      <div class="form-ok">
        <h3 style="font-family:var(--serif);font-weight:400;font-size:2rem">Thank you — we have it.</h3>
        <p style="margin:10px 0 0">
          Your information has been received. A member of the Genysis IQ team reads every
          submission personally, and will be in touch if there is a potential fit.
        </p>
      </div>

      <div class="disclaimer" style="margin-top:26px">
        <strong>A reminder of what this was.</strong>
        Expressing interest does not enroll you as a representative, guarantee acceptance,
        guarantee a Founding Leader position, or promise earnings. The program, service catalog,
        compensation plan and Founding Leader Program remain under development.
      </div>

      <div class="btn-row" style="margin-top:30px">
        {btn("See How It Works","how-it-works.html","btn-primary")}
        {btn("Review the Compensation Preview","compensation.html","btn-ghost")}
      </div>
    </div>
  </section>

'''
p += FOOT
pathlib.Path("thank-you.html").write_text(p); print("thank-you.html")
