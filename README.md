# Serve Visualization Tool

A 3D tennis serve you can tinker with in the browser. Move the toss, add spin and power, and watch whether the ball clears the net, from the server's side, the receiver's side, or right at the net.

It's a free tool I made for me and my friends. Keeping it online costs money every year for the domain name and the cloud hosting, so if you can and like the tool, [chipping in on PayPal](https://paypal.me/hyuns89) helps cover those costs. The About page (`/about/` on the site) explains the math behind it in plain words.

## simple mode

The simple mode (`/simple/` on the site) skips the controls. Tap where you want the serve to land in the service box (or drag the ball, or use the arrow keys), pick the serve you want to hit there (flat, slice, topspin-slice or kick; one for the first serve and one for the second, flat and kick to start with) and it shows:

- **the recommended speed and spin** for that serve. It tries the serve with a lighter and a heavier brush (flat has just the one) at a few speeds up to the fastest it can be hit, finds the racket angle and aim that land each one on your spot, flies each with the same small mistakes as the full tool, and recommends the one that scores best of those that land in often enough (half the time on a first serve, 9 times in 10 on a second), or the one that lands in most if none do. The card gives its speed, rpm, racket angle, aim and net clearance, and a one-line reason (lands in most, hardest to return, both, or the best mix).
- **margin**: the share that still lands in, with a shaded oval on the court where 9 in 10 of them land, so you can see how close it runs to the lines.
- **return**: how hard it is to return (easy, medium, hard, very hard), with the bar of aces, return errors, tough and easy returns, and faults.
- **score**: the points you'd win out of 100 serves like it. On a first serve a miss goes to your second serve (the recommended one for your second-serve pick, to the same spot), so it can take more risk.
- **the best ways to hit it**: the top speeds and amounts of spin for the same serve, with their margin, return difficulty and score. Pick one to see its path, and "Watch it in 3D" loads it into the full tool.

Tapping the other box serves from the other side. The server's hand, height, stance and jump, their fastest serve and the returner level are shared with the full tool.

## languages

English, Spanish, French, German, Portuguese, Japanese, Korean and Chinese (Simplified). Each language has its own address (English at `/`, the others at `/es/`, `/fr/`, `/de/`, `/pt/`, `/ja/`, `/ko/`, `/zh/`, with the simple mode at `simple/` and the About page at `about/` under each). The menu in the header switches language. On a first visit to the plain address, a browser that prefers one of these languages is sent to it once; after that the visitor's choice sticks.

All text lives in [src/locales](src/locales), one file per language, with English as the source. `npm run check:locales` makes sure every translation has the same keys and placeholders as English.

## what you can change

- **units**: metric (cm, m, km/h) or US (inches, feet and inches, mph), switched from the top of the page. Every measurement follows it, including kept serves and the labels in the 3D view. The app starts in US units in a US-English browser and metric elsewhere, and remembers your choice.

- **toss placement**: drag the ball on the toss pad (or use the arrow keys) to toss it further in front, behind, left or right.
  - in front: you hit down more and from a little lower, so the ball heads for the net.
  - behind: you hit up, so the ball sails long.
- **toss height**: how far above your full reach the toss peaks, the way coaches describe it. Your reach includes your height and jump, so a taller server or a bigger jump tosses higher automatically. A toss that peaks below your reach means you hit it lower, with less room over the net. A higher toss just hangs longer.
- **server**:
  - **hand**: right- or left-handed. A left-hander is the right-hander mirrored: hitting and toss arms, feet, shoulder coil and follow-through all swap sides, and their slice curves right instead of left. Switching mirrors your toss, brush and contact point, so it's the same serve played the other way. The coach camera films from the hitting-arm side.
  - **height**: from 1.50 to 2.10 m (4′11″ to 6′11″). Drag the slider or type it in centimetres or feet and inches, following the units switch. A taller server reaches higher and meets the ball higher. The racket stays the same size.
  - **stance**: platform (the feet stay apart and you hit where you tossed) or pinpoint (the back foot slides up beside the front foot, then you drive up and into the court, meeting the ball about 15 cm further in and 6 cm higher, and landing inside the baseline).
  - **jump height**: from 0 to 45 cm off the ground. A higher jump meets the ball higher.
- **swing and spin**:
  - **serve speed**, from 45 to 230 km/h (28 to 143 mph). Slower than that, the ball can't reach the service box at any angle.
  - **brush up**: how much the racket swings up the back of the ball, which adds topspin.
  - **brush across**: how much it swings across the ball. Toward the outside (right for a right-hander, left for a left-hander) adds slice, which curves the ball away from the hitting arm.
  - **contact on the ball**: where the strings meet the ball, on a clock face seen from behind.
    - low on the ball (6 to 7 o'clock) adds topspin and sends the ball up.
    - the outside of the ball (3 o'clock for a right-hander, 9 for a left-hander) adds slice and pushes the ball the other way.
    - high on the ball flattens it and drives it down.
  - the resulting spin is shown under the controls, split into topspin (which makes the ball dip, then kick up) and side spin (which curves it, and which way), with the total rpm and the spin type: flat, topspin, kick, topspin-slice or slice.
- **aim**: T, body or wide, or drag on the court map.
- **returner level**: NTRP 2.0 to 5.0. Better returners react sooner, move faster, reach further and handle more pace, kick and slice. Against a 2.0 most serves win the point. Against a 5.0 you need pace and placement, or a kick or slice that pulls them off the court.
- **compare**: "keep this serve to compare" pins the current serve's path on the court and the court map. Pick a color for the next serve's line (from the swatches or any custom color), change something, and serve again to see both paths side by side. Each kept serve is listed with its speed, spin, stance, result and net clearance.
- **racket angle**: how open or closed the racket face is at contact. In the animation the racket tilts to this angle (after the toss's effect) and turns toward your aim as it meets the ball. By default the server angles the racket so a perfect toss lands in the box. That shows what toss mistakes do, while allowing for the height, stance, jump, swing and contact point you picked. Turn auto off to set the angle yourself.

## what you see

- **3D court** with a toon-shaded server and a receiver bouncing on their toes. The server goes through stance, toss, trophy, racket drop, contact and follow-through with proper technique:
  - the shoulders coil side-on and uncoil through contact.
  - the racket drops down the back.
  - the edge leads the upswing, then the forearm pronates so the strings meet the ball square and keep turning over into the follow-through.
  - the finish depends on the serve's spin. A flat serve carries across the body to finish low by the opposite hip. A slice swings around the outside of the ball and comes even further across. A kick brushes up and out, so it finishes higher on the hitting side with the shoulders more side-on. Mixed serves blend between them.
- **camera views**: server, receiver, net cam (side-on at the net, for reading the clearance), side, and coach (a side-on close-up of the server). Drag to orbit any of them. Trees and fence panels are hidden while they're between the camera and the court.
- the dashed path the ball will take, a trail where it has been, a "clears by … cm" or "into the net" label at the net, and a ring where it bounces.
- **timeline** with every phase plus the net crossing and the bounce. It plays at 1×, ½× or ¼×, and space plays and pauses.
- **readout**: the call for this serve (fault, or once it reaches the returner: ace, return error, tough return or easy return, with the main reason; a return error means the returner likely hits it, but into the net or out), net clearance, contact height, launch angle, speeds, bounce height, the time the returner has and how far they must move, and a tip when it's a fault. The returner sets off toward the ball once they've reacted, and the outcome pops up over them.
- **risk and reward**: the error tolerance, the share of these serves that still land in when hit with the small mistakes any server makes (about ±0.6° racket angle, ±1° aim, ±3% speed, ±10% spin and ±8° in brush direction, over 1,024 tries). The brush direction is why slice is riskier: with the spin tipped sideways, a slightly different brush changes how much the ball dips, so adding side spin lowers the tolerance. It also shows how far the racket angle can be off before the ball goes into the net or long, and a bar of ace, return error, tough return, easy return and fault chances against the chosen returner.

## running it

```bash
npm install
npm run dev
```

`npm run build` makes a static build in `dist/`, and `npm run lint` runs oxlint.

## hosting

The site is meant to live at [visualservetool.com](https://visualservetool.com), on Azure Static Web Apps (free plan), with the domain's DNS at Cloudflare.

Every push to `main` runs [.github/workflows/deploy.yml](.github/workflows/deploy.yml). It checks the translations, builds with `SITE_URL=https://visualservetool.com`, and uploads `dist/` to Azure. The upload needs the app's deployment token in the repo secret `AZURE_STATIC_WEB_APPS_API_TOKEN`; without it the workflow still builds and skips the upload. It can also be run by hand from the Actions tab.

[public/staticwebapp.config.json](public/staticwebapp.config.json) sends `/es/about` to `/es/about/` (one address per page, for search engines) and lets browsers keep the hashed files in `assets/` for a year.

The Cloudflare DNS records, all set to "DNS only" (grey cloud) so Azure can issue and renew the HTTPS certificate:

- `TXT` `@`: the code Azure gives when you add `visualservetool.com` under Custom domains.
- `CNAME` `@`: the app's `….azurestaticapps.net` address. Cloudflare flattens a CNAME on the root domain, which Azure accepts.
- `CNAME` `www`: the same address.

`visualservetool.com` is set as the default domain in Azure, so `www.visualservetool.com` and the `azurestaticapps.net` address redirect to it.

## search engines

`npm run build` writes a real HTML page for every page in every language (24 in all, via [scripts/build-pages.mjs](scripts/build-pages.mjs)). Each has its own `<html lang>`, title, description, social-sharing tags and structured data (`WebApplication` for the tool and the simple mode, `AboutPage` for the About page), plus the page's text as plain HTML. Search engines can read and index it without running the 3D app, and the app replaces it once it starts. A `robots.txt` is written too. Every page is a plain file, so any static host serves it with no rewrite rules.

Links that need the site's full address (canonical, hreflang between the languages, `og:url`, the share image and `sitemap.xml`) are only written when you tell the build where the site lives:

```bash
SITE_URL=https://visualservetool.com npm run build
```

The deploy workflow does this for you. Then, in Google Search Console: add the domain as a property, verify it, and submit `https://visualservetool.com/sitemap.xml`.

The share image that link previews show is [public/og-image.png](public/og-image.png), a 1200×630 card drawn by [scripts/make-og-image.mjs](scripts/make-og-image.mjs). Run `npm run og-image` to redraw it after changing the design.

To keep the first view quick, the page loads only its own code, the model and the visitor's language up front (about 120 kB compressed). The 3D view (mostly three.js) loads right after behind a placeholder, and any other language is fetched only when someone switches to it.


## how it works

- [src/serve.js](src/serve.js): the serve model. It turns the toss, server height, stance, jump, swing and contact point into a contact point limited by the server's reach and jump, a toss hang time (which stretches the animation between release and contact), a spin axis and rate, and a launch angle. It also builds the server's 3D joints from the pose: the shoulder coil, pinpoint footwork, jump and the arm reaching for the ball.
- [src/physics.js](src/physics.js): ball flight stepped at 1 ms with gravity, air drag and Magnus lift, against real court dimensions and net heights, with a simple friction bounce where a low, fast ball skids through and heavy topspin grips and kicks up higher.
- [src/outcome.js](src/outcome.js): the returner and risk model. It finds where the ball passes the returner, how long they have and how far they must go, and turns their reaction time, speed, reach and comfort with pace, high balls (mostly on the backhand) and low balls into the chance of an ace, return error, tough return or easy return. The error tolerance flies the serve with each kind of mistake on its own, measures how much each one moves the net clearance, the bounce and the return point, and adds those effects up over 1,024 evenly spread tries. That keeps it smooth and quick.
- [src/pose.js](src/pose.js): the serve motion as keyframed joint angles blended with Catmull-Rom splines, plus curves for the shoulder turn and the racket's roll about its handle (edge first, then pronation).
- [src/i18n.js](src/i18n.js), [src/languages.js](src/languages.js) and [src/locales](src/locales): translations, and the address of each page in each language.
- [src/three](src/three) and [src/components/Scene3D.jsx](src/components/Scene3D.jsx): the three.js scene, with the court, net, windscreen, trees, the two players, cameras and trails. Sight lines from the camera to the players, the ball and points across the court decide which trees and fence panels to hide.

The physics is meant to be believable, not exact. The drag and lift coefficients are typical textbook values. How the toss, jump, brush and contact point change the serve, and what each returner level can handle, are simple models of what coaches describe, not measured data.

Built with Vite, React, three.js and i18next.
