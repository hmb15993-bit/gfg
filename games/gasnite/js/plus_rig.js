// ===== GASNITE HERO ANIMATION: blended procedural locomotion + two-bone arm IK =====
// Replaces CharacterRigBuilder.applyHeroStance(hero, time, mode). Callers can put a motion description on
// hero.userData.motion = { speed, fwd, side, air, vy, sprint, crouch, slide, land, mantle, swim, fall, glide, knocked,
//                          aim, reload, using, emote, stepOff } — everything is optional; without it the old modes work
// ('idle' | 'run' | 'emote'). Poses blend smoothly: idle ↔ walk ↔ run ↔ sprint, strafe / backpedal, jump / fall / land,
// crouch / slide, mantle, swim, skydive, glide, knocked crawl, 5 emote dances, two-handed gun hold with aim pitch,
// recoil and reload, heal use, and the pickaxe carry + swing.
(() => {
  const R = CharacterRigBuilder, PI = Math.PI;
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z), DOWN = V3(0, -1, 0), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3();
  // ---- two-bone IK: upper arm .30 + forearm .30, target in torso space; the pole keeps elbows out and down
  function ik(arm, T, side, poleY = -.7, poleX = .9) {
    const S = arm.shoulder.position, L1 = .30, L2 = .30, v = T.clone().sub(S), d = clamp(v.length(), .05, L1 + L2 - .01); v.normalize();
    const A = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1)), pole = V3(side * poleX, poleY, -.4), perp = pole.sub(v.clone().multiplyScalar(pole.dot(v))).normalize();
    const E = S.clone().addScaledVector(v, L1 * Math.cos(A)).addScaledVector(perp, L1 * Math.sin(A)), P = S.clone().addScaledVector(v, d), q1 = new THREE.Quaternion().setFromUnitVectors(DOWN, E.clone().sub(S).normalize());
    arm.shoulder.quaternion.copy(q1); arm.elbow.quaternion.setFromUnitVectors(DOWN, P.clone().sub(E).normalize().applyQuaternion(q1.clone().invert()));
  }
  const gunIn = arm => arm.glove.children.find(c => c.userData && c.userData.gun && c.visible);
  // ---- pickaxe carried diagonally across the chest; a swing (userData.pkSwing) animates arms + pickaxe together
  function carry(g, pk, j) {
    const sw = g.userData.pkSwing || 0, u = 1 - sw / .4, s = sw > 0 ? Math.sin(u * PI * 2) : 0, l = sw > 0 ? Math.sin(u * PI) : 0;
    pk.position.set(.02, .1 + .1 * l, .3); pk.rotation.set(.3 - .95 * s, 0, .88); pk.updateMatrix();   // held low across the body: the face and outfit stay visible
    const low = V3(0, -.34, 0).applyMatrix4(pk.matrix), high = V3(0, .06, 0).applyMatrix4(pk.matrix), lowSide = Math.sign(V3(0, -.55, 0).applyMatrix4(pk.matrix).x);
    [j.leftArm, j.rightArm].forEach(a => { const side = Math.sign(a.shoulder.position.x); ik(a, side === lowSide ? low : high, side); });
  }
  // ---- weapon hold: the gun is posed in the body's frame — long guns tucked into the trigger-side shoulder, pistols
  //      pushed out in both hands, launchers on the shoulder, heavy guns at the hip — and both hands are IK'd onto it:
  //      the trigger hand on the grip, the support hand on that gun's own handguard (hold data from the model).
  //      The barrel follows the aim pitch (independent of the torso lean / gait sway), dips on sprint, kicks on recoil,
  //      rolls over while reloading and is put away while healing.
  const HT = R.holdTune = { x: .24, y: .34, z: .18, px: .14, py: .35, pz: .37, hx: .22, hy: .15, hz: .24 };
  const _bq = new THREE.Quaternion(), _gq = new THREE.Quaternion(), _ti = new THREE.Quaternion(), _lq = new THREE.Quaternion(), _hq = new THREE.Quaternion();
  function holdGun(j, trig, sup, st, M, gun) {
    const sT = Math.sign(trig.shoulder.position.x) || -1, H = gun.userData.hold || {}, kind = H.k || 'long';
    const k = st.gunDown, rs = Math.sin(PI * clamp(st.reload, 0, 1)), us = st.using, ads = st.ads, kick = st.recoil * (H.kick || 1);
    // body frame (root orientation, torso origin) → torso space
    _bq.setFromEuler(j.hips.rotation).multiply(_hq.setFromEuler(j.torso.rotation)); _ti.copy(_bq).invert();
    const pitch = clamp(M.aim || 0, -1.1, 1.2) * (1 - k) + k * (kind === 'pistol' ? .95 : .72) - .2 * kick + rs * .35 + us * .9;
    _gq.setFromEuler(_e.set(pitch, sT * .025 * (1 - ads), rs * .6 * -sT));
    // anchor = centre of the trigger fist on the grip
    const A = kind === 'pistol' ? V3(sT * (HT.px - .03 * ads), HT.py + .05 * ads - .12 * k - .05 * us, HT.pz + .04 * ads - .14 * k)
      : kind === 'hip' ? V3(sT * HT.hx, HT.hy - .05 * k, HT.hz)
      : kind === 'launcher' ? V3(sT * .2, .32 - .05 * k, .2)
      : V3(sT * (HT.x - .03 * ads), HT.y + .07 * ads - .08 * k - .05 * us, HT.z + .03 * ads - .03 * k);
    A.addScaledVector(_v.set(0, 0, 1).applyQuaternion(_gq), -.05 * kick);
    // support wrist on the handguard (gun space → body frame); slides back and down while reloading
    const S = V3(-sT * (H.x || 0), (H.y != null ? H.y : .03) - .08 * rs, (H.f != null ? H.f : .27) * (1 - .45 * rs)).applyQuaternion(_gq).add(A);
    A.applyQuaternion(_ti); S.applyQuaternion(_ti); _lq.copy(_ti).multiply(_gq);                     // → torso space
    const wrist = A.sub(_v.copy(gun.position).applyQuaternion(_lq));                                  // the gun sits on the fist
    ik(trig, wrist, sT, -1, kind === 'pistol' ? .7 : .5);                                             // trigger elbow tucked down, not winged out
    _q2.copy(trig.shoulder.quaternion).multiply(trig.elbow.quaternion).invert(); trig.glove.quaternion.copy(_q2.multiply(_lq));
    ik(sup, S, -sT, -.85);
  }
  // ---- emote dances (generic moves): dance, floss, bounce, hype, spin
  function emotePose(j, rig, kind, t) {
    const b = Math.sin(t * 6), b2 = Math.sin(t * 3), L = j.leftArm, Rr = j.rightArm;
    if (kind === 'floss') {
      const s = Math.sin(t * 7.5), w = Math.sin(t * 15);
      j.hips.rotation.z = -s * .12; j.hips.position.x = s * .06; j.torso.rotation.z = s * .1;
      [L, Rr].forEach(a => { a.shoulder.rotation.set(.15 * w, 0, s * .9); a.elbow.rotation.x = -.05; });
      j.leftLeg.hipJoint.rotation.z = -.08 + s * .06; j.rightLeg.hipJoint.rotation.z = .08 + s * .06;
    } else if (kind === 'bounce') {
      const h = Math.abs(Math.sin(t * 5)); j.hips.position.y += h * .22 - .05; j.leftLeg.knee.rotation.x = j.rightLeg.knee.rotation.x = .5 - h * .4; j.leftLeg.hipJoint.rotation.x = j.rightLeg.hipJoint.rotation.x = -.25 + h * .2;
      const up = Math.sin(t * 5) > 0; L.shoulder.rotation.set(up ? -2.7 : -.3, 0, -.3); Rr.shoulder.rotation.set(up ? -.3 : -2.7, 0, .3); L.elbow.rotation.x = Rr.elbow.rotation.x = -.25;
      j.head.rotation.x = -.15 * h;
    } else if (kind === 'hype') {
      const p = Math.sin(t * 8), k = Math.max(0, p); j.hips.position.y -= .06 + .06 * Math.abs(p); j.leftLeg.knee.rotation.x = j.rightLeg.knee.rotation.x = .35 + .2 * Math.abs(p); j.leftLeg.hipJoint.rotation.x = j.rightLeg.hipJoint.rotation.x = -.18;
      L.shoulder.rotation.set(-2.2 - .6 * k, 0, -.25); L.elbow.rotation.x = -.6 + .5 * k; Rr.shoulder.rotation.set(-2.2 - .6 * Math.max(0, -p), 0, .25); Rr.elbow.rotation.x = -.6 + .5 * Math.max(0, -p);
      j.torso.rotation.x = -.1; j.head.rotation.x = -.25;
    } else if (kind === 'spin') {
      j.hips.rotation.y = (t * 7) % (PI * 2); j.torso.rotation.z = .08; L.shoulder.rotation.set(-.1, 0, -1.45); Rr.shoulder.rotation.set(-.1, 0, 1.45);
      j.rightLeg.hipJoint.rotation.x = -.5; j.rightLeg.knee.rotation.x = 1.1; j.leftLeg.hipJoint.rotation.z = -.05;
    } else { // groovy two-step
      j.hips.position.y += Math.abs(b) * .07 - .04; j.hips.rotation.y = b * .3; j.hips.position.x = b2 * .05; j.torso.rotation.z = b * .14; j.head.rotation.z = -b * .12; j.head.rotation.y = b2 * .2;
      L.shoulder.rotation.set(-.3 * b2 - .4, 0, -1.1 + b * .4); Rr.shoulder.rotation.set(.3 * b2 - .4, 0, 1.1 - b * .4); L.elbow.rotation.x = Rr.elbow.rotation.x = -1.2;
      j.leftLeg.hipJoint.rotation.set(-Math.max(0, b) * .3, 0, -.14); j.rightLeg.hipJoint.rotation.set(-Math.max(0, -b) * .3, 0, .14);
      j.leftLeg.knee.rotation.x = .15 + Math.max(0, b) * .35; j.rightLeg.knee.rotation.x = .15 + Math.max(0, -b) * .35;
    }
  }
  const DEF = { run: { speed: 7, fwd: 7 }, idle: { speed: 0 }, emote: { speed: 0 } };
  R.applyHeroStance = function (g, time, mode = 'idle') {
    const ud = g && g.userData, j = ud && ud.joints; if (!j) return;
    const rig = ud.rig, M = ud.motion || DEF[mode] || DEF.idle;
    const st = ud.anim || (ud.anim = { t: time, ph: 0, blend: 0, back: 0, lat: 0, latS: 1, air: 0, land: 0, crouch: 0, slide: 0, lean: 0, recoil: 0, reload: 0, using: 0, gunDown: 0, swim: 0, fall: 0, glide: 0, knock: 0, mantle: 0, emote: 0, cph: 0, ads: 0, hold: 0 });
    let dt = time - st.t; st.t = time; if (!(dt > 0) || dt > .25) dt = 1 / 60;
    const ease = (cur, tgt, rate) => cur + (tgt - cur) * (1 - Math.exp(-dt * rate));
    const emoting = mode === 'emote' || M.emote;
    // ---------- smoothed state
    const spd = Math.max(0, M.speed || 0), fx = spd > .3 ? (M.fwd != null ? M.fwd : spd) / spd : 1, sx = spd > .3 ? (M.side || 0) / spd : 0;
    st.blend = ease(st.blend, clamp(spd / 7, 0, 1.75), 9);
    st.back = ease(st.back, spd > .5 && fx < -.35 ? 1 : 0, 8);
    st.lat = ease(st.lat, spd > .5 ? clamp(Math.abs(sx) * 1.3 - .2, 0, 1) : 0, 8); if (Math.abs(sx) > .2) st.latS = Math.sign(sx);
    st.air = ease(st.air, M.air && !M.swim ? 1 : 0, 14);
    if (M.land) st.land = Math.max(st.land, M.land); st.land = ease(st.land, 0, 6.5);
    st.crouch = ease(st.crouch, M.crouch ? 1 : 0, 12); st.slide = ease(st.slide, M.slide ? 1 : 0, 14);
    st.swim = ease(st.swim, M.swim ? 1 : 0, 8); st.fall = ease(st.fall, M.fall ? 1 : 0, 8); st.glide = ease(st.glide, M.glide ? 1 : 0, 8);
    st.knock = ease(st.knock, M.knocked ? 1 : 0, 10); st.mantle = M.mantle || 0; st.emote = ease(st.emote, emoting ? 1 : 0, 10);
    st.recoil = Math.max(ud.recoil || 0, st.recoil * Math.exp(-dt * 13)); ud.recoil = 0;
    st.reload = M.reload || 0; st.using = ease(st.using, M.using ? 1 : 0, 10); st.gunDown = ease(st.gunDown, M.sprint && spd > 9 && !M.reload ? 1 : 0, 8);
    st.ads = ease(st.ads || 0, M.ads ? 1 : 0, 12);
    // ---------- gait phase: driven by distance so the feet don't skate
    const a = Math.min(1, st.blend), spr = Math.max(0, st.blend - 1) / .75, stride = 1.7 + 1.9 * Math.min(1.5, st.blend) + (M.crouch ? -.6 : 0);
    st.ph += (spd * dt / Math.max(.8, stride)) * PI * 2 * (st.back > .5 ? -1 : 1);
    if (spd < .3) st.ph += Math.sin(-st.ph % PI) * dt * 3; // settle the legs together when stopping
    // ---------- reset
    j.hips.rotation.set(0, 0, 0); j.hips.position.set(0, 1.02, 0); j.torso.rotation.set(0, 0, 0); j.head.rotation.set(0, 0, 0);
    [j.leftArm, j.rightArm].forEach(A => { A.shoulder.rotation.set(0, 0, 0); A.elbow.rotation.set(0, 0, 0); if (A.glove) A.glove.rotation.set(0, 0, 0); });
    [j.leftLeg, j.rightLeg].forEach(Lg => { Lg.hipJoint.rotation.set(0, 0, 0); Lg.knee.rotation.set(0, 0, 0); });
    if (rig) rig.legs.forEach(Lg => Lg.foot.rotation.set(0, 0, 0));
    const breath = Math.sin(time * 2.4), idle = 1 - a, legs = [j.leftLeg, j.rightLeg];
    // ---------- legs: idle stance ↔ walk/run/sprint cycle, strafe + backpedal blends
    const A = (.32 + .42 * a + .2 * spr) * (1 - .55 * st.lat) * (1 - .4 * st.crouch), kneeA = (.75 + .55 * spr) * (st.back > .5 ? .55 : 1);
    legs.forEach((Lg, i) => {
      const s = i ? 1 : -1, ph = st.ph + (i ? PI : 0), sn = Math.sin(ph), cs = Math.cos(ph) * (st.back > .5 ? -1 : 1);
      let hx = -A * sn * a, kn = a * (.16 + kneeA * Math.pow(Math.max(0, cs), 1.3)), hz = 0;
      hz += st.lat * .3 * a * sn * st.latS * s * -1;                                   // side-step
      kn += st.lat * .35 * a * Math.max(0, cs);
      hx += idle * (i ? .07 : -.05); hz += idle * s * .08; kn += idle * (i ? .1 : .07);   // contrapposto stance
      // crouch / slide / air / landing
      hx += st.crouch * -.75; kn += st.crouch * 1.35;
      if (st.slide > .01) { hx = hx * (1 - st.slide) + st.slide * (i ? -1.35 : -.25); kn = kn * (1 - st.slide) + st.slide * (i ? .12 : 1.7); }
      if (st.air > .01) { const up = (M.vy || 0) > 0; hx = hx * (1 - st.air) + st.air * (up ? (i ? -.85 : -.2) : (i ? -.45 : .15)); kn = kn * (1 - st.air) + st.air * (up ? (i ? 1.45 : .5) : (i ? .55 : .35)); }
      hx -= st.land * .45; kn += st.land * .95;
      Lg.hipJoint.rotation.set(hx, 0, hz); Lg.knee.rotation.x = Math.max(0, kn);
      if (rig) rig.legs[i].foot.rotation.x = clamp(-(hx + kn) * .45 + Math.max(0, -cs) * .25 * a, -.5, .7);   // keep soles flatter
    });
    // ---------- hips + torso
    const bob = a * (.035 + .03 * spr) * (.5 - .5 * Math.cos(2 * st.ph));
    j.hips.position.y = 1.02 + bob + breath * .008 * idle - st.crouch * .4 - st.slide * .5 - st.land * .24 + clamp(M.stepOff || 0, -.6, .3);
    j.hips.rotation.y = .12 * a * Math.sin(st.ph) * (1 - st.lat) + idle * .08; j.hips.rotation.z = .035 * a * Math.sin(st.ph) + idle * .025;
    st.lean = ease(st.lean, a * (.09 + .12 * spr) * (1 - 2.2 * st.back) + st.crouch * .32 - st.slide * .55 + st.land * .25, 7);
    j.torso.rotation.x = st.lean + clamp(M.aim || 0, -1, 1.2) * .25 * (1 - st.gunDown) - st.recoil * .05 + idle * .03;
    j.torso.rotation.y = -.18 * a * Math.sin(st.ph) * (1 - st.lat) - idle * .07; j.torso.rotation.z = -idle * .02;
    j.head.rotation.x = clamp(M.aim || 0, -1, 1.2) * .3 - st.lean * .5 + Math.sin(time * .7) * .02 * idle;
    j.head.rotation.y = -j.torso.rotation.y * .7 + (.05 + Math.sin(time * 1.1) * .06) * idle;
    // ---------- arms (free swing; IK layers below override when holding something)
    const armA = (.45 * a + .35 * spr) * (1 - .6 * st.lat), elb = -(.3 + .85 * a + .35 * spr);
    j.leftArm.shoulder.rotation.set(armA * Math.sin(st.ph) + idle * .1, 0, -(.16 + .06 * a) - idle * (.06 + breath * .02));
    j.rightArm.shoulder.rotation.set(-armA * Math.sin(st.ph) - idle * .14, 0, (.16 + .06 * a) + idle * (.08 + breath * .02));
    j.leftArm.elbow.rotation.x = elb - idle * .02; j.rightArm.elbow.rotation.x = elb - idle * .12;
    if (st.air > .01) [j.leftArm, j.rightArm].forEach((A2, i) => { const s = i ? 1 : -1; A2.shoulder.rotation.x = A2.shoulder.rotation.x * (1 - st.air) - st.air * .55; A2.shoulder.rotation.z = A2.shoulder.rotation.z * (1 - st.air) + st.air * s * .75; });
    if (st.slide > .01) [j.leftArm, j.rightArm].forEach((A2, i) => { A2.shoulder.rotation.z += st.slide * (i ? .9 : -.9); A2.shoulder.rotation.x -= st.slide * .3; });
    // ---------- whole-body states that replace locomotion
    const c = time * 6;
    if (st.swim > .5) { j.leftArm.shoulder.rotation.set(-2.4 + Math.sin(c) * .9, 0, -.15); j.rightArm.shoulder.rotation.set(-2.4 + Math.sin(c + PI) * .9, 0, .15); j.leftArm.elbow.rotation.x = j.rightArm.elbow.rotation.x = -.3; legs[0].hipJoint.rotation.set(Math.sin(c * 1.6) * .4, 0, 0); legs[1].hipJoint.rotation.set(-Math.sin(c * 1.6) * .4, 0, 0); legs[0].knee.rotation.x = legs[1].knee.rotation.x = .2; j.head.rotation.x = -.7; }
    else if (st.fall > .5) { j.leftArm.shoulder.rotation.set(-.4, 0, 1.4 + Math.sin(c) * .05); j.rightArm.shoulder.rotation.set(-.4, 0, -1.4 - Math.sin(c) * .05); j.leftArm.elbow.rotation.x = j.rightArm.elbow.rotation.x = -.2; legs[0].hipJoint.rotation.set(-.15, 0, -.4); legs[1].hipJoint.rotation.set(-.15, 0, .4); legs[0].knee.rotation.x = legs[1].knee.rotation.x = .5; j.head.rotation.x = -.9; }
    else if (st.glide > .5) { j.leftArm.shoulder.rotation.set(-2.9, 0, .25); j.rightArm.shoulder.rotation.set(-2.9, 0, -.25); j.leftArm.elbow.rotation.x = j.rightArm.elbow.rotation.x = -.15; legs[0].hipJoint.rotation.set(Math.sin(c * .5) * .15, 0, 0); legs[1].hipJoint.rotation.set(-Math.sin(c * .5) * .15, 0, 0); legs[0].knee.rotation.x = legs[1].knee.rotation.x = .25; }
    else if (st.knock > .5) { // face-down crawl (the root is tilted by the game)
      st.cph += spd * dt * 2.6 + dt * .4; const k = Math.sin(st.cph);
      j.leftArm.shoulder.rotation.set(-2.5 + k * .45, 0, -.25); j.rightArm.shoulder.rotation.set(-2.5 - k * .45, 0, .25); j.leftArm.elbow.rotation.x = -.5 - Math.max(0, k) * .6; j.rightArm.elbow.rotation.x = -.5 - Math.max(0, -k) * .6;
      legs[0].hipJoint.rotation.set(.12 + k * .18, 0, -.12); legs[1].hipJoint.rotation.set(.12 - k * .18, 0, .12); legs[0].knee.rotation.x = .3 + Math.max(0, -k) * .5; legs[1].knee.rotation.x = .3 + Math.max(0, k) * .5;
      j.head.rotation.x = -.75; j.hips.position.y = 1.02;
    }
    else if (st.mantle > 0) { const m = st.mantle; [j.leftArm, j.rightArm].forEach((A2, i) => { A2.shoulder.rotation.set(m < .5 ? -2.3 : -2.3 + (m - .5) * 3.8, 0, (i ? 1 : -1) * .3); A2.elbow.rotation.x = m < .5 ? -.2 : -.9; }); legs[0].hipJoint.rotation.x = -1.1 * Math.sin(m * PI); legs[0].knee.rotation.x = 1.4 * Math.sin(m * PI); legs[1].knee.rotation.x = .4; }
    else if (st.emote > .5) emotePose(j, rig, M.emote && M.emote !== true ? M.emote : (typeof state !== 'undefined' && typeof getCosmeticById === 'function' && state.equipped ? (getCosmeticById('emote', state.equipped.emote) || {}).anim : 'dance'), time);
    // ---------- hands: pickaxe carry / two-handed gun / heal use (skipped while swimming, skydiving, knocked, mantling, emoting)
    const pk = ud.pk, busy = st.swim > .5 || st.fall > .5 || st.glide > .5 || st.knock > .5 || st.mantle > 0;
    if (pk) { if (emoting) { if (pk.visible) { pk.visible = false; ud.pkEmoteHid = true; } } else if (ud.pkEmoteHid) { ud.pkEmoteHid = false; if (!gunIn(j.leftArm) && !gunIn(j.rightArm)) pk.visible = true; } }
    const gL = gunIn(j.leftArm), gR = gunIn(j.rightArm), gun = gL || gR, armed = !!gun && !busy && st.emote < .5;
    st.hold = ease(st.hold || 0, armed ? 1 : 0, 10);
    if (!busy && st.emote < .5) {
      if (gun) {
        const trig = gL ? j.leftArm : j.rightArm, sT = Math.sign(trig.shoulder.position.x) || -1, kind = (gun.userData.hold || {}).k;
        // bladed stance: the chest stops swinging with the gait and turns the support shoulder toward the gun; head looks ahead
        const tw = (kind === 'pistol' ? .14 : kind === 'hip' ? .24 : .34) * st.hold * (1 - .45 * st.gunDown), hy = j.hips.rotation.y;
        j.torso.rotation.y += (-hy + sT * tw - j.torso.rotation.y) * st.hold;
        j.head.rotation.y += (-(hy + j.torso.rotation.y) * .85 - j.head.rotation.y) * st.hold;
        holdGun(j, trig, gL ? j.rightArm : j.leftArm, st, M, gun);
      }
      else if (pk && pk.visible) carry(g, pk, j);
      if (st.using > .05 && !gun) { const u = st.using; ik(j.leftArm, V3(-.06, .34 + .06 * u, .24), -1); ik(j.rightArm, V3(.08, .3 + .04 * u, .25), 1); j.head.rotation.x += .25 * u; }
    }
    // muzzle flash for a few frames after each shot (recoil decays from 1)
    if (gun && gun.userData.flash) { const f = gun.userData.flash, on = armed && st.recoil > .6; if (on && !f.visible) f.rotation.z = Math.random() * PI; f.visible = on; }
    // ---------- secondary motion: hair, tails, capes, scarves (faster when running)
    const sw = ud.sway;
    if (sw) { const k = .45 + .55 * a + spr * .5 + st.emote; for (let i = 0; i < sw.length; i++) { const s = sw[i]; s.o.rotation[s.ax] = s.base + Math.sin(time * s.f * (1 + a * (s.run - 1)) + i) * s.amp * k + (s.ax === 'x' ? -s.amp * 1.6 * a - st.air * .3 : 0); } }
  };
})();
