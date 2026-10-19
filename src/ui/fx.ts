import Phaser from 'phaser';

/** Tween-based particle burst (cheap, no emitter bookkeeping, auto-cleans). */
export function burst(
  scene: Phaser.Scene,
  x: number,
  y: number,
  key: string,
  n: number,
  o: { speed?: number; scale?: number; life?: number; gravity?: number; tint?: number; depth?: number; spin?: boolean } = {},
) {
  const speed = o.speed ?? 220;
  const life = o.life ?? 520;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.6;
    const v = speed * (0.6 + Math.random() * 0.6);
    const img = scene.add.image(x, y, key).setDepth(o.depth ?? 55);
    const s = (o.scale ?? 0.6) * (0.7 + Math.random() * 0.6);
    img.setScale(s);
    if (o.tint !== undefined) img.setTint(o.tint);
    const dx = Math.cos(a) * v * (life / 1000);
    const dy = Math.sin(a) * v * (life / 1000) + (o.gravity ?? 0);
    scene.tweens.add({
      targets: img,
      x: x + dx,
      y: y + dy,
      scale: s * 0.2,
      alpha: 0,
      angle: o.spin ? Phaser.Math.Between(-180, 180) : 0,
      duration: life,
      ease: 'Quad.Out',
      onComplete: () => img.destroy(),
    });
  }
}

/** Tiny spinning sparks that fly out, shrink and fade — used when a progress star lights up. */
export function starBurst(scene: Phaser.Scene, x: number, y: number, n = 12) {
  burst(scene, x, y, 'spark', n, { speed: 170, scale: 0.26, life: 640, depth: 80, spin: true, gravity: 40 });
  burst(scene, x, y, 'spark_white', Math.max(5, Math.ceil(n / 2)), {
    speed: 130,
    scale: 0.16,
    life: 500,
    depth: 81,
    spin: true,
  });
}

export function hearts(scene: Phaser.Scene, x: number, y: number) {
  for (let i = 0; i < 4; i++) {
    const h = scene.add.image(x + Phaser.Math.Between(-30, 30), y, 'heart').setDepth(55).setScale(0.3);
    scene.tweens.add({
      targets: h,
      y: y - 90 - i * 20,
      x: h.x + Phaser.Math.Between(-30, 30),
      scale: 0.8,
      alpha: 0,
      delay: i * 90,
      duration: 800,
      ease: 'Sine.Out',
      onComplete: () => h.destroy(),
    });
  }
}

export function confetti(scene: Phaser.Scene, n = 40) {
  const colors = [0xff5f8f, 0xffc93c, 0x7fd34e, 0x5fb8ff, 0xb98cff];
  for (let i = 0; i < n; i++) {
    const x = Phaser.Math.Between(20, scene.scale.width - 20);
    const r = scene.add
      .rectangle(x, -20 - Math.random() * 200, 14, 22, colors[i % colors.length])
      .setStrokeStyle(3, 0x2b1d16)
      .setDepth(90);
    scene.tweens.add({
      targets: r,
      y: scene.scale.height + 40,
      x: x + Phaser.Math.Between(-120, 120),
      angle: Phaser.Math.Between(-720, 720),
      duration: Phaser.Math.Between(1600, 2600),
      ease: 'Sine.In',
      onComplete: () => r.destroy(),
    });
  }
}

export function shake(scene: Phaser.Scene, intensity = 0.006, ms = 120) {
  scene.cameras.main.shake(ms, intensity);
}
