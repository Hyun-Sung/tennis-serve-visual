# Serve Visualization Tool

A 3D tennis serve you can tinker with in the browser. Move the toss, add spin and power, and watch whether the ball clears the net, from the server's side, the receiver's side, or right at the net.

## what you can change

- **toss placement**: drag the ball on the toss pad (or use the arrow keys) to toss it further in front, behind, left or right.
  - in front: you hit down more and from a little lower, so the ball heads for the net.
  - behind: you hit up, so the ball sails long.
  - over your head (left, for a right-hander): the spin tilts toward kick, which dips and jumps up and right.
  - out to the right: the spin tilts toward slice, which curves left and stays low.
- **toss height**: a toss below your full reach means you hit it lower, with less room over the net. A higher toss just hangs longer.
- **spin**, from 0 to 4000 rpm, and **power**, from 100 to 230 km/h.
- **aim**: T, body or wide, or drag on the court map.
- **swing**: by default the server picks a swing angle that would land a perfect toss in the box, so you see what toss mistakes do. Turn auto swing off to set the angle yourself.

## what you see

- **3D court** with a toon-shaded server going through stance, toss, trophy, racket drop, contact and follow-through, plus a receiver bouncing on their toes.
- **camera views**: server, receiver, net cam (side-on at the net, for reading the clearance) and side. Drag to orbit any of them.
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

- [src/serve.js](src/serve.js): the toss model. It turns toss height and placement into a contact point (limited by the server's reach), a toss hang time (which stretches the animation between release and contact), a spin axis and a launch angle.
- [src/physics.js](src/physics.js): ball flight stepped at 1 ms with gravity, air drag and Magnus lift, against real court dimensions and net heights, with a simple friction bounce.
- [src/pose.js](src/pose.js): the serve motion as keyframed joint angles blended with Catmull-Rom splines. The hitting arm bends toward wherever the toss put the ball.
- [src/three](src/three) and [src/components/Scene3D.jsx](src/components/Scene3D.jsx): the three.js scene, with the court, net, windscreen, trees, the two players, cameras and trails.

The physics is meant to be believable, not exact. The drag and lift coefficients are typical textbook values, and how the toss changes the swing is a simple model of what coaches describe, not measured data.

Built with Vite, React and three.js.
