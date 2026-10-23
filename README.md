# Serve Visualization Tool

A 3D tennis serve you can tinker with in the browser. Move the toss, add spin and power, and watch whether the ball clears the net, from the server's side, the receiver's side, or right at the net.

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
  - **serve speed**, from 100 to 230 km/h.
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
  - the edge leads the upswing, then the forearm pronates so the strings meet the ball square and keep turning over into the follow-through, which finishes across the body.
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

## how it works

- [src/serve.js](src/serve.js): the serve model. It turns the toss, server height, stance, jump, swing and contact point into a contact point limited by the server's reach and jump, a toss hang time (which stretches the animation between release and contact), a spin axis and rate, and a launch angle. It also builds the server's 3D joints from the pose: the shoulder coil, pinpoint footwork, jump and the arm reaching for the ball.
- [src/physics.js](src/physics.js): ball flight stepped at 1 ms with gravity, air drag and Magnus lift, against real court dimensions and net heights, with a simple friction bounce where heavy topspin kicks up higher.
- [src/outcome.js](src/outcome.js): the returner and risk model. It finds where the ball passes the returner, how long they have and how far they must go, and turns their reaction time, speed, reach and comfort with pace and high or low balls into the chance of an ace, return error, tough return or easy return. The error tolerance flies the serve with each kind of mistake on its own, measures how much each one moves the net clearance, the bounce and the return point, and adds those effects up over 1,024 evenly spread tries. That keeps it smooth and quick.
- [src/pose.js](src/pose.js): the serve motion as keyframed joint angles blended with Catmull-Rom splines, plus curves for the shoulder turn and the racket's roll about its handle (edge first, then pronation).
- [src/three](src/three) and [src/components/Scene3D.jsx](src/components/Scene3D.jsx): the three.js scene, with the court, net, windscreen, trees, the two players, cameras and trails. Sight lines from the camera to the players, the ball and points across the court decide which trees and fence panels to hide.

The physics is meant to be believable, not exact. The drag and lift coefficients are typical textbook values. How the toss, jump, brush and contact point change the serve, and what each returner level can handle, are simple models of what coaches describe, not measured data.

Built with Vite, React and three.js.
