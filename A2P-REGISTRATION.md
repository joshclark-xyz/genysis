# A2P 10DLC resubmission — exact values to paste

Campaign SID `CMb62cdf15c238d217bfa6f1096bf07604` · Brand `BN9bba0fc73baa2afc5b56340a92bef1cb`

**Not legal advice, and no one can guarantee approval.** What this does is make the
site satisfy the documented CTA requirements the reviewer is checking against.

---

## Why you were rejected

**Error 30909 — the reviewer could not verify your Call to Action.**

Your two opt-in methods were *verbal, on a phone call* and *inbound text*. Neither
leaves anything on your website for a reviewer to look at. They opened
genysisiq.com, found no opt-in anywhere, and had no way to confirm anyone had ever
agreed to be texted. The description alone is not enough — they need to see it.

The sub-codes listed in your rejection point at the same thing:

| Code | Meaning | Status |
|---|---|---|
| 30909 | CTA / message flow unverifiable | **Fixed** — public opt-in + full workflow page |
| 30924 | Non-compliant consent language in opt-in flow | **Fixed** — full disclosures in the checkbox label |
| 30925 | Opt-in must be unchecked by default | **Fixed** — verified unchecked and not required |
| 30917 | All opt-in methods need complete workflows | **Fixed** — all three documented, verbal script included |
| 30919 | Website lacks business / use case info | **Fixed** — `/messaging.html` |
| 30933 / 30934 | Privacy + Terms URLs required | Already had both; now with the mobile clause |

## What changed on the site

1. **`contact.html` now has a real opt-in checkbox.** Unchecked by default, not
   required, sitting directly under the phone field with every disclosure in the
   label. *This is the thing that was missing.*
2. **New page: `https://www.genysisiq.com/messaging.html`** — the whole programme
   in public: what you send, all three opt-in paths, the verbatim verbal script,
   confirmation/STOP/HELP messages, frequency and rates. Point the reviewer here.
3. **`privacy.html`** — added the carrier-required mobile clause, verbatim, in two
   places (§6 sharing and §8 messaging).
4. **`terms.html`** — new §6 covering messaging and call recording.

**Deploy the site before you resubmit.** The reviewer fetches these URLs live; if
they 404 you get rejected again for the same reason.

---

## Paste these into the campaign

### Campaign description

```
Genysis IQ sends customer care text messages to people who have asked us to.
Messages include summaries and transcripts of calls with our AI phone assistant,
appointment confirmations and reminders, and replies to inquiries submitted on our
website or by phone. Consent is collected on our website contact form, verbally
during an inbound call, or when the customer texts us first. This campaign sends
no marketing or promotional content. Full programme details, including every
opt-in workflow, are public at https://www.genysisiq.com/messaging.html
```

### How do end-users consent to receive messages? *(the field that got you rejected)*

```
End users opt in three ways. All three are documented publicly at
https://www.genysisiq.com/messaging.html

1) WEB FORM - https://www.genysisiq.com/contact.html
The user enters their name, email, mobile number and message. Directly beneath the
message field is a consent checkbox that is UNCHECKED by default and is NOT required
to submit the form. Its label reads, verbatim: "Text me about my inquiry. I agree to
receive text messages from Genysis IQ at the mobile number I provided above,
including appointment reminders, call summaries and replies to my questions. Message
frequency varies. Message and data rates may apply. Reply STOP to unsubscribe or HELP
for help. Consent is not a condition of purchase. See our Privacy Policy and Terms of
Service." The label links to both policies. We store the mobile number, the date, and
the exact wording agreed to.

2) VERBAL - inbound calls to 689-388-7353
Our automated assistant answers, identifies itself as automated, and asks, verbatim:
"Would you like me to text you a summary of this call at this number? Message
frequency varies, and message and data rates may apply. You can reply STOP at any
time to opt out. Is that okay?" A message is sent only on an affirmative answer. The
call recording and timestamp are retained as the record of consent.

3) INBOUND TEXT - the user texts 689-388-7353 first, or texts START, YES, JOIN or
OPTIN to that number. Initiating the conversation is the consent.

Every path receives the confirmation message before any other message. Numbers are
never purchased, rented, sold or shared.
```

### Opt-in message

```
Genysis IQ: You are now opted in to receive call summaries and support updates. Msg frequency varies. Msg & data rates may apply. Reply HELP for help, reply STOP to cancel.
```

### Opt-in keywords

```
START,YES,JOIN,OPTIN,UNSTOP
```

### Opt-out keywords

```
STOP,STOPALL,END,QUIT,CANCEL,UNSUBSCRIBE,OPTOUT,REVOKE
```

### Opt-out message — **yours was missing the brand name**

```
Genysis IQ: You have been unsubscribed and will receive no further messages from this number. Reply START to resubscribe.
```

### Help keywords

```
HELP,INFO
```

### Help message — **this one was non-compliant and is worth fixing regardless**

Yours read `Reply STOP to unsubscribe. Msg&Data Rates May Apply.` A HELP reply must
identify the brand and give a way to reach a human. Use:

```
Genysis IQ: For help, email info@genysisiq.com or call 689.388.7353. Msg frequency varies. Msg & data rates may apply. Reply STOP to unsubscribe.
```

### Sample messages

```
Genysis IQ: Thanks for speaking with our assistant. Your call summary is here: genysisiq.com/s/abc123 Reply STOP to opt out, HELP for help. Msg & data rates may apply.
```
```
Genysis IQ: We received your inquiry about business scaling. Our team is reviewing it and will follow up shortly. Reply STOP to opt out, HELP for help.
```
```
Genysis IQ: Reminder - your consultation is tomorrow at 2:00 PM ET. Reply STOP to opt out, HELP for help.
```

### URLs

| Field | Value |
|---|---|
| Privacy policy | `https://www.genysisiq.com/privacy.html` |
| Terms of service | `https://www.genysisiq.com/terms.html` |

Both must be reachable **without logging in**. They are.

### Content flags

Tick **Embedded links** (sample 1 has one). Leave direct lending and age-gated
unticked. Only tick **Phone numbers** if a message body will contain one — the HELP
reply does, so tick it to be safe.

---

## Two things that will get you rejected again if you skip them

**1. Never use a public link shortener.** `bit.ly`, `tinyurl`, `t.co` and friends are
an automatic rejection and a carrier filtering problem. Send links on your own
domain — `genysisiq.com/s/abc123` — which is what the sample above uses. You will
need a short-link route on your site that maps a code to the call summary.

**2. Make the verbal script match this document word for word.** If a reviewer calls
689.388.7353 to check, and the assistant does not disclose frequency, rates and STOP
before asking permission, the campaign fails on the spot. Update the assistant's
prompt before resubmitting. The script is on `/messaging.html` so the two cannot
drift apart.

## Keep your proof of consent

Contact-form submissions now carry two hidden fields — `consent_language` and
`consent_source` — so every email records exactly what the person agreed to and
where. Keep those emails. If a carrier ever challenges a complaint, that record is
your defence, and "we know they ticked a box" is not.
