# Serve Visualization Tool

A 3D tennis serve you can tinker with in the browser. Move the toss, add spin and power, and watch whether the ball clears the net, from the server's side, the receiver's side, or right at the net.

## what you can change

- **toss placement**: drag the ball on the toss pad (or use the arrow keys) to toss it further in front, behind, left or right.
  - in front: you hit down more and from a little lower, so the ball heads for the net.
  - behind: you hit up, so the ball sails long.
- **toss height**: a toss below your full reach means you hit it lower, with less room over the net. A higher toss just hangs longer.
- **server**:
  - **height**: from 1.50 to 2.10 m. A taller server reaches higher and meets the ball higher. The racket stays the same size.
  - **stance**: platform (the feet stay apart and you hit where you tossed) or pinpoint (the back foot slides up beside the front foot, then you drive up and into the court, meeting the ball about 15 cm further in and 6 cm higher, and landing inside the baseline).
  - **jump height**: from 0 to 45 cm off the ground. A higher jump meets the ball higher.
- **swing and spin**:
  - **serve speed**, from 100 to 230 km/h.
  - **brush up**: how much the racket swings up the back of the ball, which adds topspin.
  - **brush across**: how much it swings across the ball. To the right adds slice, which curves the ball left.
  - **contact on the ball**: where the strings meet the ball, on a clock face seen from behind.
    - low on the ball (6 to 7 o'clock) adds topspin and sends the ball up.
    - the right side (3 o'clock) adds slice and pushes the ball left.
    - high on the ball flattens it and drives it down.
  - the resulting spin (rpm and type: flat, topspin, kick, topspin-slice, slice) is shown under the controls.
- **aim**: T, body or wide, or drag on the court map.
- **compare**: "keep this serve to compare" pins the current serve's path on the court and the court map. Pick a color for the next serve's line (from the swatches or any custom color), change something, and serve again to see both paths side by side. Each kept serve is listed with its speed, spin, stance, result and net clearance.
- **racket angle**: by default the server angles the racket so a perfect toss lands in the box. That shows what toss mistakes do, while allowing for the height, stance, jump, swing and contact point you picked. Turn auto off to set the angle yourself.

## what you see

- **3D court** with a toon-shaded server and a receiver bouncing on their toes. The server goes through stance, toss, trophy, racket drop, contact and follow-through with proper technique:
  - the shoulders coil side-on and uncoil through contact.
  - the racket drops down the back.
  - the edge leads the upswing, then the forearm pronates so the strings meet the ball square and keep turning over into the follow-through, which finishes across the body.
- **camera views**: server, receiver, net cam (side-on at the net, for reading the clearance), side, and coach (a side-on close-up of the server). Drag to orbit any of them. Trees and fence panels are hidden while they're between the camera and the court.
- the dashed path the ball will take, a trail where it has been, a "clears by … cm" or "into the net" label at the net, and a ring where it bounces.
- **timeline** with every phase plus the net crossing and the bounce. It plays at 1×, ½× or ¼×, and space plays and pauses.
- **readout**: in or fault, net clearance, contact height, launch angle, speed at the net and at the bounce, bounce height, and a tip when it's a fault.

## running it

```bash
npm install
npm run dev
```

`npm run build` makes a static build in `dist/`, and `npm run lint` runs oxlint.

## how it works

- [src/serve.js](src/serve.js): the serve model. It turns the toss, server height, stance, jump, swing and contact point into a contact point limited by the server's reach and jump, a toss hang time (which stretches the animation between release and contact), a spin axis and rate, and a launch angle. It also builds the server's 3D joints from the pose: the shoulder coil, pinpoint footwork, jump and the arm reaching for the ball.
- [src/physics.js](src/physics.js): ball flight stepped at 1 ms with gravity, air drag and Magnus lift, against real court dimensions and net heights, with a simple friction bounce.
- [src/pose.js](src/pose.js): the serve motion as keyframed joint angles blended with Catmull-Rom splines, plus curves for the shoulder turn and the racket's roll about its handle (edge first, then pronation).
- [src/three](src/three) and [src/components/Scene3D.jsx](src/components/Scene3D.jsx): the three.js scene, with the court, net, windscreen, trees, the two players, cameras and trails. Sight lines from the camera to the players, the ball and points across the court decide which trees and fence panels to hide.

The physics is meant to be believable, not exact. The drag and lift coefficients are typical textbook values. How the toss, jump, brush and contact point change the serve is a simple model of what coaches describe, not measured data.

Built with Vite, React and three.js.
