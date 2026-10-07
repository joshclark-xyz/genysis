/* =============================================================================
   Genysis IQ - scaling readiness assessment

   Ten questions, one at a time. Each maps to a stage of CASPER, so the result
   is not just a score but a named constraint and the stage that addresses it.

   Deliberately no email gate. Gating the result behind a form is the standard
   move and it costs more leads than it captures - somebody who sees an honest
   diagnosis is far likelier to book than somebody who traded an address for a
   PDF. The booking CTA is the conversion, not the email.
   ============================================================================= */

(function () {
  "use strict";

  var form = document.getElementById("assessForm");
  if (!form) return;

  var $ = function (id) { return document.getElementById(id); };

  /* Each option carries a score out of 10. Stage is the CASPER stage the
     question measures, which is what turns a score into a recommendation. */
  var QUESTIONS = [
    { stage: "Architecture",
      q: "If you were completely unreachable for two weeks, what would happen?",
      a: [["The business would stall within days", 0],
          ["It would run, but decisions would pile up for my return", 3],
          ["It would run; a few things would wait for me", 7],
          ["It would run normally without me", 10]] },

    { stage: "Architecture",
      q: "Roughly what share of decisions still need your sign-off?",
      a: [["Almost everything", 0],
          ["Most things of any consequence", 3],
          ["Only the significant ones", 7],
          ["Very few - people own their areas", 10]] },

    { stage: "Processes",
      q: "Are the workflows your business depends on written down?",
      a: [["No - they live in people's heads", 0],
          ["A few things are, informally", 3],
          ["Most of the important ones are documented", 7],
          ["Yes, documented and actually followed", 10]] },

    { stage: "Replication",
      q: "How long before a new hire is genuinely productive?",
      a: [["Months, and it depends who trains them", 0],
          ["A couple of months, inconsistently", 3],
          ["Weeks, with a reasonably repeatable onboarding", 7],
          ["Quickly - we have a training system that works", 10]] },

    { stage: "Processes",
      q: "Does every new lead get followed up the same way?",
      a: [["No - it depends entirely who picks it up", 0],
          ["There is a rough habit, not a process", 3],
          ["Mostly, with a defined process", 7],
          ["Yes - defined, tracked and consistent", 10]] },

    { stage: "Evaluation",
      q: "Do you review a defined set of numbers on a fixed rhythm?",
      a: [["No - I go on feel and the bank balance", 0],
          ["I look at revenue, not much else", 3],
          ["We track several KPIs, reviewed irregularly", 7],
          ["Yes - a scorecard the team reviews on schedule", 10]] },

    { stage: "Clarity",
      q: "Do you know what is actually limiting your growth right now?",
      a: [["Honestly, no - that is why I am here", 0],
          ["I have a theory I am not confident in", 3],
          ["I think so, but I have not tested it", 7],
          ["Yes, and I can point to the evidence", 10]] },

    { stage: "Architecture",
      q: "When you delegate something important, what usually happens?",
      a: [["It comes back wrong or I end up doing it", 0],
          ["It needs significant rework", 3],
          ["It is usually fine with some review", 7],
          ["It gets done to standard without me", 10]] },

    { stage: "Systems",
      q: "How much manual re-entry happens between your tools?",
      a: [["Constantly - spreadsheets everywhere", 0],
          ["Quite a lot, and it causes errors", 3],
          ["Some, in a few places", 7],
          ["Very little - our systems talk to each other", 10]] },

    { stage: "Replication",
      q: "Could you open a second location or team using what is documented today?",
      a: [["Not a chance", 0],
          ["We would be rebuilding it from scratch", 3],
          ["Partly - the core is there", 7],
          ["Yes - it is designed to be repeatable", 10]] }
  ];

  var BANDS = [
    { min: 0,  max: 39,  name: "Owner-dependent",
      line: "The business currently depends on you personally to function.",
      body: "This is the most common place for a business of this size, and it is not a" +
            " judgement - it is what happens when a company grows faster than the structure" +
            " underneath it. The risk is that adding more revenue right now makes daily life" +
            " worse rather than better." },
    { min: 40, max: 64, name: "Transitioning",
      line: "You have started building structure, but it is not yet load-bearing.",
      body: "Some things run without you and some things do not, which usually means the" +
            " documented parts and the delegated parts are not the same parts. Closing that" +
            " gap is normally the highest-return work available to you." },
    { min: 65, max: 84, name: "Systemising",
      line: "The foundations are real. The gaps are specific rather than structural.",
      body: "At this level the constraint is rarely the whole operating model - it is one or" +
            " two areas that never got the same treatment as the rest. Those are worth finding" +
            " precisely rather than rebuilding broadly." },
    { min: 85, max: 100, name: "Scalable",
      line: "This business is built to grow without you at the centre of it.",
      body: "You are in the minority. At this point the useful conversation is usually about" +
            " replication, acquisition, or preparing the business as a sellable asset rather" +
            " than about fixing operations." }
  ];

  var STAGE_HELP = {
    Clarity: "You are not yet certain what is actually limiting growth - and the businesses" +
             " that are certain are often wrong. Clarity is the diagnostic stage: find the real" +
             " constraint before spending money on symptoms.",
    Architecture: "Decisions and authority still concentrate on you. Architecture is where roles," +
             " ownership and decision rights get designed deliberately, so the business stops" +
             " routing everything through one person.",
    Systems: "Your people are doing work your tools should be doing. Systems is where the tool" +
             " stack and management mechanisms get built to fit the process, rather than the" +
             " process bending around whatever software you bought.",
    Processes: "Execution depends on who happens to be doing it. Processes is where the critical" +
             " workflows get mapped, improved and documented, so the standard holds regardless" +
             " of who is on shift.",
    Evaluation: "You cannot delegate what you cannot measure, which is usually why owners stay" +
             " involved in everything. Evaluation puts a small number of honest metrics in place" +
             " so performance is visible without you inspecting it.",
    Replication: "What works is not yet transferable. Replication is what turns a good business" +
             " into a scalable asset - and it is what makes the business sellable."
  };

  /* --------------------------------------------------------------- state -- */

  var answers = new Array(QUESTIONS.length).fill(null);
  var current = 0;

  var wrap = $("assessQuestions");
  var nextBtn = $("assessNext");
  var backBtn = $("assessBack");

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function render() {
    var q = QUESTIONS[current];
    wrap.innerHTML =
      '<fieldset class="assess-q">' +
        "<legend>" + esc(q.q) + "</legend>" +
        q.a.map(function (opt, i) {
          var id = "q" + current + "o" + i;
          return '<label class="assess-opt' +
            (answers[current] === i ? " is-on" : "") + '" for="' + id + '">' +
            '<input type="radio" id="' + id + '" name="q' + current + '" value="' + i + '"' +
            (answers[current] === i ? " checked" : "") + ">" +
            "<span>" + esc(opt[0]) + "</span></label>";
        }).join("") +
      "</fieldset>";

    $("assessCount").textContent = "Question " + (current + 1) + " of " + QUESTIONS.length;
    $("assessBar").style.width = ((current) / QUESTIONS.length * 100) + "%";
    backBtn.hidden = current === 0;
    nextBtn.disabled = answers[current] === null;
    nextBtn.textContent = current === QUESTIONS.length - 1 ? "See my result" : "Next";

    // Keyboard users land on the first option rather than hunting for it.
    var first = wrap.querySelector("input");
    if (first) first.focus({ preventScroll: true });
  }

  wrap.addEventListener("change", function (e) {
    if (e.target.name !== "q" + current) return;
    answers[current] = Number(e.target.value);
    [].forEach.call(wrap.querySelectorAll(".assess-opt"), function (l) {
      l.classList.toggle("is-on", l.querySelector("input").checked);
    });
    nextBtn.disabled = false;
  });

  nextBtn.addEventListener("click", function () {
    if (answers[current] === null) return;
    if (current === QUESTIONS.length - 1) return finish();
    current++;
    render();
  });

  backBtn.addEventListener("click", function () {
    if (current === 0) return;
    current--;
    render();
  });

  /* -------------------------------------------------------------- result -- */

  function finish() {
    var total = 0;
    var byStage = {};

    answers.forEach(function (choice, i) {
      var q = QUESTIONS[i];
      var pts = q.a[choice][1];
      total += pts;
      if (!byStage[q.stage]) byStage[q.stage] = { sum: 0, n: 0 };
      byStage[q.stage].sum += pts;
      byStage[q.stage].n += 1;
    });

    // The constraint is the weakest stage on average, not the lowest raw total -
    // otherwise a stage that happens to own three questions always "wins".
    var worst = null, worstAvg = 11;
    Object.keys(byStage).forEach(function (stage) {
      var avg = byStage[stage].sum / byStage[stage].n;
      if (avg < worstAvg) { worstAvg = avg; worst = stage; }
    });

    var band = BANDS.filter(function (b) { return total >= b.min && total <= b.max; })[0];

    $("assess").classList.add("is-done");
    form.hidden = true;
    document.querySelector(".assess-progress").hidden = true;
    $("assessCount").hidden = true;

    var bars = Object.keys(STAGE_HELP).map(function (stage) {
      var d = byStage[stage];
      if (!d) return "";
      var pct = Math.round((d.sum / (d.n * 10)) * 100);
      return '<div class="assess-stage' + (stage === worst ? " is-weak" : "") + '">' +
        "<b>" + stage + "</b>" +
        '<span class="assess-meter"><i style="width:' + pct + '%"></i></span>' +
        "<span>" + pct + "%</span></div>";
    }).join("");

    var out = $("assessResult");
    out.hidden = false;
    out.innerHTML =
      '<div class="assess-score">' +
        '<div class="assess-dial" style="--pct:' + total + '">' +
          "<span>" + total + '<small>/100</small></span>' +
        "</div>" +
        "<div>" +
          '<p class="label">Your scaling readiness</p>' +
          "<h2>" + esc(band.name) + "</h2>" +
          '<p class="assess-line">' + esc(band.line) + "</p>" +
          "<p>" + esc(band.body) + "</p>" +
        "</div>" +
      "</div>" +

      '<div class="assess-breakdown"><h3>Where you stand by stage</h3>' + bars + "</div>" +

      '<div class="assess-constraint">' +
        '<p class="label">Your primary constraint</p>' +
        "<h3>" + esc(worst) + "</h3>" +
        "<p>" + esc(STAGE_HELP[worst]) + "</p>" +
        '<p class="assess-note">This is a starting hypothesis from ten questions, not a ' +
          "diagnosis. Confirming it properly is what the first conversation is for.</p>" +
      "</div>" +

      '<div class="assess-cta">' +
        '<a class="btn btn-primary btn-lg" href="schedule.html" ' +
           'data-track="Assessment result - book a call">Book a 30-minute scaling conversation</a> ' +
        '<a class="btn btn-ghost btn-lg" href="casper.html" ' +
           'data-track="Assessment result - see CASPER">See how CASPER addresses ' + esc(worst) + "</a>" +
        '<button type="button" class="linklike" id="assessRestart">Start over</button>' +
      "</div>";

    out.scrollIntoView({ behavior: "smooth", block: "start" });

    // Feed the result into our own analytics so the score distribution is
    // visible in the admin console alongside everything else.
    if (window.GenysisAnalytics) {
      var ev = document.createElement("a");
      ev.setAttribute("data-track", "Assessment completed - " + band.name + " - " + worst);
      ev.style.display = "none";
      document.body.appendChild(ev);
      ev.click();
      ev.remove();
    }

    $("assessRestart").addEventListener("click", function () {
      answers = new Array(QUESTIONS.length).fill(null);
      current = 0;
      out.hidden = true;
      out.innerHTML = "";
      form.hidden = false;
      document.querySelector(".assess-progress").hidden = false;
      $("assessCount").hidden = false;
      $("assess").classList.remove("is-done");
      render();
      document.getElementById("assess").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  render();
})();
