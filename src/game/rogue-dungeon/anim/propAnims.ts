export function createPropAnimations(scene: Phaser.Scene): void {
  const once = (key: string, frameRate: number) => {
    if (scene.anims.exists(key + '-open')) return;
    scene.anims.create({
      key: key + '-open',
      frames: scene.anims.generateFrameNumbers(key, {}),
      frameRate,
      repeat: 0,
    });
  };
  const loop = (key: string, frameRate: number) => {
    if (scene.anims.exists(key + '-loop')) return;
    scene.anims.create({
      key: key + '-loop',
      frames: scene.anims.generateFrameNumbers(key, {}),
      frameRate,
      repeat: -1,
    });
  };

  once('obj_Chest1_D', 8);
  once('obj_Chest2_D', 8);
  once('obj_Door_D', 10);
  once('obj_BigDoor_D', 10);
  loop('obj_Fire1', 9);
  loop('obj_Spikes', 6);
}
