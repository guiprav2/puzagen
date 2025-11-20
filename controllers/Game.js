import agentic from '../other/agentic_grok.js';
import confetti from 'https://esm.sh/canvas-confetti';

let tap = x => (console.log(x), x);

export default class Game {
  state = {
    inventory: [],
    objects: {
      door: {
        coords: '6x2',
        greased: false,
        powered: false,
        open: false,
        img: () => 'media/door.png',
        interact: () => {
          let { door } = this.state.objects;
          if (this.state.inventory.includes('grease_can')) { door.greased = true; this.state.inventory.splice(this.state.inventory.indexOf('grease_can'), 1) }
          if (door.open) return `The door is already open, sunshine pours through the gap.`;
          if (!door.greased) return `The door is rusty and needs some grease to move.`;
          if (!door.powered) return `A dormant mechanism keeps the door sealed. Maybe powering the nearby panel will wake it up.`;
          if (!this.state.inventory.includes('door_key')) return `You've greased the door so it can now move freely, but you lack the proper key to open it.`;
          door.open = true;
          return `You've open the door and solved the puzzle!`;
        },
      },
      chest: {
        coords: '4x4',
        open: false,
        img: () => this.state.objects.chest.open ? 'media/chest_open.png' : 'media/chest.png',
        interact: () => {
          let { chest } = this.state.objects;
          if (chest.open) return `There's nothing inside the chest anymore.`;
          if (!this.state.inventory.includes('chest_key')) return `You don't have the right key to open the chest.`;
          chest.open = true;
          this.state.inventory.splice(this.state.inventory.indexOf('chest_key'), 1);
          this.state.inventory.push('grease_can');
          return `You've opened the chest and found a Grease Can!`;
        },
      },
      rug: {
        coords: '6x4',
        lifted: false,
        keyTaken: false,
        img: () => {
          let { rug } = this.state.objects;
          if (rug.keyTaken) return 'media/rug_lifted.png';
          if (rug.lifted) return 'media/rug_key.png';
          return 'media/rug.png';
        },
        interact: () => {
          let { rug } = this.state.objects;
          if (rug.keyTaken) return `There's nothing under the rug anymore.`;
          if (!rug.lifted) { rug.lifted = true; return `You lift the rug and find the Door Key! You haven't touched it yet, it's just laying there.` }
          rug.keyTaken = true;
          this.state.inventory.push('door_key');
          return `You take the Door Key.`;
        },
      },
      table: {
        coords: '8x4',
        keyTaken: false,
        img: () => this.state.objects.table.keyTaken ? 'media/table.png' : 'media/table_key.png',
        interact: () => {
          let { table } = this.state.objects;
          if (table.keyTaken) return `There's nothing on the table anymore.`;
          table.keyTaken = true;
          this.state.inventory.push('chest_key');
          return `You take the Chest Key from the table.`;
        },
      },
      bookshelf: {
        coords: '2x3',
        dusterTaken: false,
        img: () => this.state.objects.bookshelf.dusterTaken ? 'media/bookshelf_empty.png' : 'media/bookshelf.png',
        interact: () => {
          let { bookshelf } = this.state.objects;
          if (bookshelf.dusterTaken) return `Only dusty spines remain on the shelf.`;
          bookshelf.dusterTaken = true;
          this.state.inventory.push('feather_duster');
          return `You rummage through the shelf and find a Feather Duster hidden between two tomes.`;
        },
      },
      painting: {
        coords: '9x2',
        cleaned: false,
        codeTaken: false,
        img: () => {
          let { painting } = this.state.objects;
          if (!painting.cleaned) return 'media/painting_dirty.png';
          return 'media/painting_revealed.png';
        },
        interact: () => {
          let { painting } = this.state.objects;
          if (!painting.cleaned) {
            if (!this.state.inventory.includes('feather_duster')) return `The canvas is buried under grime. You can barely make out any details.`;
            painting.cleaned = true;
            return `You clean the painting, revealing faint glowing numerals beneath the dust.`;
          }
          if (painting.codeTaken) return `You've already memorized the shining sequence etched into the paint.`;
          painting.codeTaken = true;
          this.state.inventory.push('panel_code');
          return `The digits 4-2-6 shimmer. You jot the code down to use elsewhere.`;
        },
      },
      panel: {
        coords: '10x4',
        active: false,
        img: () => this.state.objects.panel.active ? 'media/panel_on.png' : 'media/panel_off.png',
        interact: () => {
          let { panel, door } = this.state.objects;
          if (panel.active) return `The panel already hums with steady energy.`;
          if (!this.state.inventory.includes('panel_code')) return `A keypad awaits the right code. Maybe look around for a hint.`;
          panel.active = true;
          door.powered = true;
          this.state.inventory.splice(this.state.inventory.indexOf('panel_code'), 1);
          return `You key in the code. Lights flare as the door's locking mechanism powers up.`;
        },
      },
    },
    char: { x: 6, y: 6 },
    grid: { cols: 11, rows: 7 },
  };

  moveCharacter = (dx, dy) => {
    let tx = this.state.char.x + dx;
    let ty = this.state.char.y + dy;
    console.log(tx, ty, this.state.grid.cols, this.state.grid.rows);
    if (tx < 1 || tx >= this.state.grid.cols) return `You're trying to move offbounds.`;
    if (ty < 1 || ty >= this.state.grid.rows) return `You're trying to move offbounds.`;
    if ([...Object.values(this.state.objects)].find(x => x.coords === `${tx}x${ty}`)) return `An object is in your way.`;
    this.state.char.x = tx;
    this.state.char.y = ty;
    return `Your new position is ${this.state.char.x}x${this.state.char.y}.`;
  };

  actions = {
    init: async () => {
      await agentic('grok-3', [{
        role: 'system',
        content: () => [
          `You're a puzzle solver. Your goal is to open the door by finding the right items!`,
          `The Y-axis runs donwards.`,
          `Don't wander aimlessly. Solving the puzle requires interacting with existing objects.`,
          `To solve the possible quickly, interact with objects as soon as new tools become available. Some objects require multiple interactions.`,
          `The exit is clogged by rust and a powerless mechanism—restore both movement and energy before presenting the key.`,
          `${this.state.char.x}x${this.state.char.y} is your starting position.`,
          `Your inventory: ${JSON.stringify(this.state.inventory)}`,
          ...[...Object.entries(this.state.objects)].map(([id, obj]) => {
            let s =`There's a ${id} at ${obj.coords}.`;
            if (id === 'rug' && obj.lifted && !obj.keyTaken) s += ` A key is hiding underneath.`;
            return s;
          }),
         ].join('\n'),
      }], () => [{
        type: 'function',
        name: 'moveLeft',
        handler: async () => await post('game.moveLeft'),
      }, {
        type: 'function',
        name: 'moveRight',
        handler: async () => await post('game.moveRight'),
      }, {
        type: 'function',
        name: 'moveUp',
        handler: async () => await post('game.moveUp'),
      }, {
        type: 'function',
        name: 'moveDown',
        handler: async () => await post('game.moveDown'),
      }, {
      	type: 'function',
        name: 'puzzleSolved',
        handler: () => {
          if (!this.state.objects.door.open) return `The door is not open yet.`;
          confetti();
          this.state.log = `Door unlocked, puzzle solved!`;
          return 'done';
        },
      }, ...[...Object.entries(this.state.objects)].map(([id, obj]) => {
        let [x, y] = obj.coords.split('x').map(Number);
        let dx = Math.abs(this.state.char.x - x);
        let dy = Math.abs(this.state.char.y - y);
        if (dx > 1 || dy > 1) return;
        console.log(id, 'available!');
        return {
          type: 'function',
          name: `interact${id[0].toUpperCase() + id.slice(1)}`,
          handler: () => {
            let ret = obj.interact();
            this.state.log = ret;
            d.update();
            return ret;
          },
        };
      })]);
    },

    moveUp: () => {
      this.moveCharacter(0, -1);
      return `You're now at ${this.state.char.x}x${this.state.char.y}`;
    },

    moveDown: () => {
      this.moveCharacter(0, 1);
      return `You're now at ${this.state.char.x}x${this.state.char.y}`;
    },

    moveLeft: () => {
      this.moveCharacter(-1, 0);
      return `You're now at ${this.state.char.x}x${this.state.char.y}`;
    },

    moveRight: () => {
      this.moveCharacter(1, 0);
      return `You're now at ${this.state.char.x}x${this.state.char.y}`;
    },
  };
}
