GENYSIS IQ WEBSITE
Scale Smarter. Grow Faster.


PAGES
  index.html      Home
  services.html   Services
  about.html      About Us
  contact.html    Contact Us

  styles.css      All styling (one file, organised by section)
  script.js       All interaction (one file, no dependencies)


DEPLOYMENT
  1. Upload the four HTML files, styles.css, script.js and the assets folder
     to the public web root for genysisiq.com. (_source-originals/ is working
     material only - it does not need to be uploaded.)
  2. Keep the assets folder beside the four HTML files.
  3. Make sure index.html is the site's default document.
  4. No database, WordPress, Node or build step is required.

  The only external request the site makes is to Google Fonts, for the two
  typefaces (Instrument Serif for headlines, Inter for everything else).
  If the site ever needs to run fully offline, download those two families
  into assets/fonts and swap the <link> in each page's <head> for an
  @font-face block.


BRAND ASSETS
  assets/genysis-logo-h.png          Horizontal lockup, light — used in the header
  assets/genysis-logo-h@2x.png       Retina version of the above
  assets/genysis-logo-h-dark.png     Horizontal lockup for light backgrounds
  assets/genysis-logo-light.png      Stacked lockup, light — used in the footer
  assets/genysis-logo-light@2x.png   Retina version of the above
  assets/genysis-logo.png            Stacked lockup, original colours, transparent
                                     (for white/light backgrounds, print, email)
  assets/mark.png                    The globe mark on its own
  assets/favicon-32.png              Browser tab icon
  assets/favicon-512.png             High-resolution icon
  assets/apple-touch-icon.png        iOS home-screen icon

  All of these were built from the supplied logo artwork with the white
  background removed. The light versions invert the navy wordmark to near-white
  so it reads on the site's black background; the globe keeps its own colour.


ORGANIZATION LOGOS
  assets/logos/  holds the marks shown in "Organizations Supported by Genysis
  IQ" at the bottom of the home page.

    crema-west.jpg           Crema West - Business Networking & Coffee
    lake-nona-chamber.jpg    Lake Nona Regional Chamber
    east-orlando-chamber.jpg East Orlando Chamber of Commerce
    nabln.jpg                North American Business Leaders Network
    pr-red-network.jpg       PR R.E.D. Network
    crema-at-nona.jpg        Crema at Nona
    clg-groups.jpg           Connections Leads Groups
    rotary.jpg               Rotary Club of Lake Nona
    village-connect.jpg      Village Connect

  Each one was cleaned up so its background is pure white, which lets it sit
  invisibly on the white tile behind it. They are deliberately NOT recoloured -
  each organisation keeps its own brand colours.

  Each logo carries its own --logo-h value in index.html. That is the displayed
  height, and it is set per logo rather than globally so a square mark and a
  wide mark end up looking the same size to the eye. To add an organisation,
  copy one of the .org blocks, drop the file in assets/logos, and pick a height
  that looks balanced next to its neighbours - roughly 60px for a wide mark and
  85px for a square one.


PHOTOGRAPHY AND VIDEO
  assets/img/  holds everything the site actually loads. Each photograph is
  colour-graded to the same cool navy palette so the pages read as one set.

    ron-clark.jpg              Ron Clark portrait (About)
    josh-clark.jpg             Josh Clark portrait (About)
    boardroom.jpg              Ron and Josh with a client team (Home)
    server-room.jpg            Josh with an infrastructure team (About)
    band.jpg                   Wide, darkened band behind the closing CTA
    office-chaos.jpg           "Office #1 - owner dependent" (Home)
    office-structured.jpg      "Office #2 - systems driven" (Home)
    transformation.mp4         Cluttered office to organised office (Home)
    transformation-poster.jpg  First frame, shown while the video loads
    hero.mp4                   Hero background loop
    hero-poster.jpg            First frame of the hero loop

  The original, ungraded source files live in _source-originals/ so the grade
  can be redone at any time. No page loads them, so that folder does not need
  to be uploaded - skipping it keeps the deployed site under 4 MB.

  office-chaos.jpg and office-structured.jpg are the two endpoints of
  transformation.mp4 - the room the owner walks out of and the room he walks
  into. If dedicated photographs of a cluttered office and an organised office
  turn up later, drop them in under the same two filenames and nothing else
  needs to change.

  To replace a photograph, drop the new file in and match the aspect ratio:
  portraits are 900x780, feature images 1400x1050, the two office images
  1200x900, the CTA band 1800x700.


CONTACT FORM
  Submissions are emailed to info@genysisiq.com through FormSubmit
  (formsubmit.co), a free relay that needs no account and no server code. The
  visitor fills in the form, sees a confirmation on the page, and the message
  arrives in the inbox.

  ONE-TIME SETUP - the form will not deliver anything until this is done:
    1. Put the site live.
    2. Submit the form once yourself from the live site.
    3. FormSubmit emails info@genysisiq.com asking to confirm the address.
       Open it and click the activation link.
    4. Submit once more to check it arrives. From then on it just works.

  Optional, once activated: FormSubmit will give you a random endpoint such as
  https://formsubmit.co/a1b2c3d4e5... that works the same way without putting
  the address in the page source, which keeps it away from scrapers. To use it,
  replace the address in two places - the form's action in contact.html and
  ENDPOINT near the bottom of script.js.

  Fallbacks, so a message is never simply lost:
    - If the request fails, the page opens the visitor's email client with the
      details already filled in.
    - If JavaScript is off entirely, the form posts normally and FormSubmit
      returns the visitor to contact.html?sent=1, which shows the same
      confirmation.

  To move to a different provider (Formspree, Web3Forms, Netlify Forms, a PHP
  script on the host), change those same two lines. Everything else stays.

  The form also carries a hidden honeypot field that silently discards bot
  submissions.


ACCESSIBILITY AND MOTION
  Every page has a skip link, visible keyboard focus rings, labelled form
  fields and a properly announced mobile menu. All animation is disabled
  automatically for visitors who have "reduce motion" turned on, and every
  scroll-triggered element still renders if JavaScript is unavailable.


CONTACT
  Phone:   689.444.6327
  Email:   info@genysisiq.com
  Website: www.genysisiq.com

CREDITS
  Built by Josh Clark, a 15-year-old certified Software Engineer, and the
  Director of IT and Technology at Genysis IQ. Authorized by Ron Clark,
  the CEO of Genysis IQ
