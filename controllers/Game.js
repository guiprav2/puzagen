import agentic from '../other/agentic.js';
import confetti from 'https://esm.sh/canvas-confetti';

let tap = x => (console.log(x), x);

export default class Game {
  state = {
    inventory: [],
    objects: {
      door: {
        coords: '6x2',
        greased: false,
        open: false,
        img: () => 'media/door.png',
        interact: () => {
          let { door } = this.state.objects;
          if (this.state.inventory.includes('grease_can')) { door.greased = true; this.state.inventory.splice(this.state.inventory.indexOf('grease_can'), 1) }
          if (!door.greased) return `The door is rusty and needs some grease to move.`;
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
    },
    char: { x: 6, y: 6 },
    grid: { cols: 11, rows: 7 },
  };

  moveCharacter = (dx, dy) => {
    let tx = this.state.char.x + dx;
    let ty = this.state.char.y + dy;
    console.log(tx, ty, this.state.grid.cols, this.state.grid.rows);
    if (tx < 0 || tx >= this.state.grid.cols) return `You're trying to move offbounds.`;
    if (ty < 0 || ty >= this.state.grid.rows) return `You're trying to move offbounds.`;
    this.state.char.x = tx;
    this.state.char.y = ty;
    return `Your new position is ${this.state.char.x}x${this.state.char.y}.`;
  };

  actions = {
    init: async () => {
      await agentic('gpt-5.1', [{
        role: 'system',
        content: () => [
          `You're a puzzle solver. Your goal is to open the door by finding the right items!`,
          `The Y-axis runs donwards.`,
          `Don't wander aimlessly. Solving the puzle requires interacting with existing objects.`,
          `To solve the possible quickly, interact with objects as soon as new tools become available. Some objects require multiple interactions.`,
          `${this.state.char.x}x${this.state.char.y} is your starting position.`,
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
