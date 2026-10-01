import Phaser from 'phaser';
import { dropPackAssets, loadPackAssets } from '../../game/underrealm/assets';
import { STATS } from '../../game/underrealm/config';
import { armorOf, maxHp, prepareForAdventure, saveHero, weaponOf, type Hero } from '../../game/underrealm/hero';
import { validatePack } from '../../game/underrealm/pack';
import { allAdventures, deletePack, savePack, type AdventureEntry } from '../../game/underrealm/packStore';
import { textureSet } from '../../game/underrealm/textures';
import { SoundManager, loadMuted } from '../../game/shared/Sound';

export interface UnderrealmHallInitData {
  hero: Hero;
}

const SOURCE_LABEL: Record<AdventureEntry['source'], string> = { builtin: 'Built-in', bundled: 'Bundled', uploaded: 'Uploaded' };

/** A colour for an adventure's banner, derived from its id. */
function bannerColor(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return Phaser.Display.Color.HSVToRGB((h % 360) / 360, 0.55, 0.6).color;
}

/**
 * The Hall of Adventurers: where a hero between adventures picks the next
 * one. Lists the built-in Underrealm, bundled adventures and any the player
 * has uploaded (kept in IndexedDB); new ones can be uploaded right here.
 */
export class UnderrealmHallScene extends Phaser.Scene {
  private hero!: Hero;
  private sfx!: SoundManager;
  private entries: AdventureEntry[] = [];
  private selected = 0;
  private scroll = 0;
  private listLayer!: Phaser.GameObjects.Container;
  private status!: Phaser.GameObjects.Text;
  private confirmDelete = false;
  private busy = false;
  private torches: Phaser.GameObjects.Arc[] = [];

  constructor() {
    super('UnderrealmHall');
  }

  init(data: UnderrealmHallInitData): void {
    this.hero = data.hero;
    this.selected = 0;
    this.scroll = 0;
    this.confirmDelete = false;
    this.busy = false;
    this.torches = [];
  }

  create(): void {
    this.sfx = new SoundManager(this);
    this.sound.mute = loadMuted();
    this.sfx.playMusic('realmTitle');
    // Being in the hall is a save point: the hero is between adventures.
    this.hero.packId = '';
    this.hero.pos = { level: 0, x: 0, y: 0, dir: 2 };
    saveHero(this.hero);

    this.drawHall();
    const { width: W, height: H } = this.scale;
    this.add
      .text(W / 2, 30, 'THE HALL OF ADVENTURERS', {
        fontFamily: 'monospace',
        fontSize: `${Math.round(Math.min(40, W / 26))}px`,
        color: '#f8d870',
        fontStyle: 'bold',
        stroke: '#1c0c04',
        strokeThickness: 7,
      })
      .setOrigin(0.5, 0);
    this.add
      .text(W / 2, 30 + Math.min(40, W / 26) + 12, 'Choose the adventure your hero will undertake', { fontFamily: 'monospace', fontSize: '13px', color: '#e8d8b8', stroke: '#000', strokeThickness: 3 })
      .setOrigin(0.5, 0);
    this.status = this.add.text(W / 2, H - 22, '', { fontFamily: 'monospace', fontSize: '13px', color: '#c8c8c8', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5);
    this.drawHeroCard();
    this.listLayer = this.add.container(0, 0);

    const kb = this.input.keyboard!;
    const move = (d: number) => {
      if (!this.entries.length) return;
      this.selected = (this.selected + d + this.entries.length) % this.entries.length;
      this.confirmDelete = false;
      this.sfx.play('realmBlip');
      this.renderList();
    };
    kb.on('keydown-UP', () => move(-1));
    kb.on('keydown-W', () => move(-1));
    kb.on('keydown-DOWN', () => move(1));
    kb.on('keydown-S', () => move(1));
    kb.on('keydown-ENTER', () => this.begin());
    kb.on('keydown-SPACE', () => this.begin());
    kb.on('keydown-U', () => this.upload());
    kb.on('keydown-DELETE', () => this.remove());
    kb.on('keydown-BACKSPACE', () => this.remove());
    kb.on('keydown-ESC', () => this.scene.start('UnderrealmTitle'));

    void this.refresh();
  }

  update(time: number): void {
    this.torches.forEach((t, i) => t.setScale(0.85 + Math.sin(time / 90 + i * 1.7) * 0.1 + Math.sin(time / 37 + i) * 0.05));
  }

  private async refresh(selectId?: string): Promise<void> {
    this.status.setText('Gathering adventures...');
    this.entries = await allAdventures();
    if (selectId) this.selected = Math.max(0, this.entries.findIndex((e) => e.pack.id === selectId));
    this.selected = Math.min(this.selected, this.entries.length - 1);
    this.status.setText('');
    this.renderList();
  }

  // --- The hall itself ----------------------------------------------------------

  private drawHall(): void {
    const { width: W, height: H } = this.scale;
    const key = 'urHallWall';
    if (!this.textures.exists(key)) {
      const tex = textureSet({ palette: 'stone' }).walls.wall;
      const tile = document.createElement('canvas');
      tile.width = tile.height = 64;
      tile.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(tex.buffer.slice(0) as ArrayBuffer), 64, 64), 0, 0);
      this.textures.addCanvas(key, tile);
    }
    this.add.tileSprite(0, 0, W, H, key).setOrigin(0).setTileScale(2).setTint(0x8c7c6c);
    const g = this.add.graphics();
    // Vignette + floor.
    g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.1, 0.1, 0.75, 0.75).fillRect(0, 0, W, H);
    g.fillStyle(0x1c1410, 1).fillRect(0, H * 0.86, W, H * 0.14);
    g.fillStyle(0x3c2c20, 1).fillRect(0, H * 0.86, W, 4);
    // Pillars with torches.
    const pillars = [W * 0.04, W * 0.96];
    for (const x of pillars) {
      g.fillStyle(0x4c4448, 1).fillRect(x - 18, 0, 36, H * 0.86);
      g.fillStyle(0x6c6468, 1).fillRect(x - 18, 0, 6, H * 0.86);
      g.fillStyle(0x2c2428, 1).fillRect(x + 12, 0, 6, H * 0.86);
      g.fillStyle(0x3c2c1c, 1).fillRect(x - 6, H * 0.3, 12, 26);
      this.add.circle(x, H * 0.3 - 6, 60, 0xffa040, 0.08);
      this.torches.push(this.add.circle(x, H * 0.3 - 8, 10, 0xff8c20, 1));
      this.torches.push(this.add.circle(x, H * 0.3 - 10, 5, 0xffe080, 1));
    }
    // A long red carpet toward the viewer.
    g.fillStyle(0x6c1818, 1).fillTriangle(W * 0.42, H * 0.86, W * 0.58, H * 0.86, W * 0.7, H);
    g.fillTriangle(W * 0.42, H * 0.86, W * 0.3, H, W * 0.7, H);
  }

  private drawHeroCard(): void {
    const { height: H } = this.scale;
    const h = this.hero;
    const x = Math.max(70, this.scale.width * 0.08);
    const y = H * 0.2;
    const w = Math.min(300, this.scale.width * 0.26);
    const panel = this.add.graphics();
    panel.fillStyle(0x100c08, 0.85).fillRoundedRect(x, y, w, H * 0.6, 8);
    panel.lineStyle(3, 0x9c7c4c, 1).strokeRoundedRect(x, y, w, H * 0.6, 8);
    const lines = [
      'YOUR HERO',
      '',
      `Level ${h.level}   ${h.xp} XP`,
      `Hit points ${maxHp(h)}`,
      `Gold ${h.gold}`,
      '',
      ...STATS.map((s) => `${s}  ${String(h.stats[s]).padStart(2)}`),
      '',
      `Weapon  ${weaponOf(h).name}`,
      `Armour  ${armorOf(h).name}`,
      `Foes slain  ${h.kills}`,
      `Adventures completed  ${(h.completed ?? []).length}`,
    ];
    this.add.text(x + 16, y + 14, lines, { fontFamily: 'monospace', fontSize: '13px', color: '#e8e0d0', lineSpacing: 3 }).setWordWrapWidth(w - 24);
  }

  // --- The list of adventures ------------------------------------------------------

  private renderList(): void {
    this.listLayer.removeAll(true);
    const { width: W, height: H } = this.scale;
    const x0 = Math.max(70, W * 0.08) + Math.min(300, W * 0.26) + 30;
    const x1 = W * 0.93;
    const w = x1 - x0;
    const top = H * 0.2;
    const cardH = 96;
    const gap = 12;
    const visible = Math.max(1, Math.floor((H * 0.6 + gap) / (cardH + gap)));
    if (this.selected < this.scroll) this.scroll = this.selected;
    if (this.selected >= this.scroll + visible) this.scroll = this.selected - visible + 1;
    const completed = new Set(this.hero.completed ?? []);

    this.entries.slice(this.scroll, this.scroll + visible).forEach((e, i) => {
      const idx = this.scroll + i;
      const y = top + i * (cardH + gap);
      const sel = idx === this.selected;
      const p = e.pack;
      const g = this.add.graphics();
      g.fillStyle(0x140e0a, sel ? 0.95 : 0.8).fillRoundedRect(x0, y, w, cardH, 6);
      g.lineStyle(sel ? 3 : 1, sel ? 0xf8d870 : 0x6c5c4c, 1).strokeRoundedRect(x0, y, w, cardH, 6);
      // Hanging banner with the adventure's colour.
      const bc = bannerColor(p.id);
      g.fillStyle(bc, 1).fillRect(x0 + 12, y + 8, 40, cardH - 26);
      g.fillTriangle(x0 + 12, y + cardH - 18, x0 + 52, y + cardH - 18, x0 + 32, y + cardH - 6);
      g.fillStyle(0xf8d870, 1).fillCircle(x0 + 32, y + 30, 8);
      g.fillStyle(bc, 1).fillCircle(x0 + 32, y + 30, 4);
      const badges = [SOURCE_LABEL[e.source], `${p.levels.length} level${p.levels.length === 1 ? '' : 's'}`];
      if (p.music && Object.keys(p.music).length) badges.push('own soundtrack');
      if (completed.has(p.id)) badges.push('COMPLETED');
      const card = this.add.container(0, 0, [
        g,
        this.add.text(x0 + 66, y + 10, p.name, { fontFamily: 'monospace', fontSize: '17px', color: sel ? '#f8d870' : '#e8d8b8', fontStyle: 'bold' }),
        this.add.text(x0 + 66, y + 32, p.author ? `by ${p.author}` : '', { fontFamily: 'monospace', fontSize: '11px', color: '#a89878' }),
        this.add.text(x0 + 66, y + 48, p.description ?? '', { fontFamily: 'monospace', fontSize: '12px', color: '#d8d0c0', wordWrap: { width: w - 80 } }).setMaxLines(2),
        this.add.text(x0 + w - 12, y + 10, badges.join('  -  '), { fontFamily: 'monospace', fontSize: '11px', color: completed.has(p.id) ? '#88e888' : '#88c8e8' }).setOrigin(1, 0),
      ]);
      const hit = this.add.rectangle(x0, y, w, cardH, 0xffffff, 0).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        if (this.selected === idx) this.begin();
        else {
          this.selected = idx;
          this.confirmDelete = false;
          this.sfx.play('realmBlip');
          this.renderList();
        }
      });
      this.listLayer.add([card, hit]);
    });

    // Scroll hints + actions.
    const more = this.entries.length - (this.scroll + visible);
    if (this.scroll > 0) this.listLayer.add(this.add.text(x1, top - 18, '^ more', { fontFamily: 'monospace', fontSize: '11px', color: '#a89878' }).setOrigin(1, 0));
    if (more > 0) this.listLayer.add(this.add.text(x1, top + visible * (cardH + gap) - 6, `v ${more} more`, { fontFamily: 'monospace', fontSize: '11px', color: '#a89878' }).setOrigin(1, 0));
    const sel = this.entries[this.selected];
    const ay = H * 0.83;
    const button = (label: string, x: number, onClick: () => void, color = '#88d8ff') => {
      const t = this.add
        .text(x, ay, label, { fontFamily: 'monospace', fontSize: '15px', color, stroke: '#000', strokeThickness: 4, backgroundColor: '#1c140cdd', padding: { x: 10, y: 6 } })
        .setInteractive({ useHandCursor: true });
      t.on('pointerover', () => t.setColor('#ffffff'));
      t.on('pointerout', () => t.setColor(color));
      t.on('pointerdown', onClick);
      this.listLayer.add(t);
      return t.width + 14;
    };
    let bx = x0;
    bx += button('Enter) Begin adventure', bx, () => this.begin(), '#f8d870');
    bx += button('U) Upload an adventure', bx, () => this.upload());
    if (sel?.source === 'uploaded') bx += button(this.confirmDelete ? 'Del) Really remove?' : 'Del) Remove', bx, () => this.remove(), '#f88888');
    button('Esc) Leave the hall', bx, () => this.scene.start('UnderrealmTitle'), '#c8c8c8');
  }

  // --- Actions ---------------------------------------------------------------------

  private async begin(): Promise<void> {
    const e = this.entries[this.selected];
    if (!e || this.busy) return;
    this.busy = true;
    this.sfx.play('stairsDescend');
    this.status.setColor('#c8c8c8').setText(`Setting out for ${e.pack.name}...`);
    try {
      const assets = await loadPackAssets(e.pack, this.sound);
      prepareForAdventure(this.hero, e.pack);
      saveHero(this.hero);
      this.scene.start('Underrealm', { hero: this.hero, pack: e.pack, assets });
    } catch (err) {
      this.busy = false;
      this.status.setColor('#f88888').setText(`Couldn't prepare ${e.pack.name}: ${(err as Error).message}`);
    }
  }

  private upload(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      file
        .text()
        .then(async (text) => {
          const pack = validatePack(JSON.parse(text));
          await savePack(pack);
          dropPackAssets(pack.id);
          this.sfx.play('realmLevelUp');
          await this.refresh(pack.id);
          this.status.setColor('#a8e8a8').setText(`"${pack.name}" has been added to the hall.`);
        })
        .catch((err: Error) => this.status.setColor('#f88888').setText(`That isn't an adventure pack: ${err.message}`));
    };
    input.click();
  }

  private async remove(): Promise<void> {
    const e = this.entries[this.selected];
    if (!e || e.source !== 'uploaded') return;
    if (!this.confirmDelete) {
      this.confirmDelete = true;
      this.status.setColor('#f8c888').setText(`Press Del again to remove "${e.pack.name}" from the hall.`);
      this.renderList();
      return;
    }
    this.confirmDelete = false;
    await deletePack(e.pack.id);
    dropPackAssets(e.pack.id);
    await this.refresh();
    this.status.setColor('#c8c8c8').setText(`"${e.pack.name}" was removed.`);
  }
}
