import autoassist from 'https://esm.sh/@camilaprav/kittygpt/autoassist.js'

export default class Game {
  state = {
    inventory: [],
  	chest: 'media/closest_chest.png',
    table: 'media/key_table.png',
    char: { x: 0, y: 0 },
    gridSize: { columns: 11, rows: 11 },
    interactionRange: 1,
    clickCoords: {
      '3x3': 'clickChest',
      '5x3': 'clickCarpet',
      '7x3': 'clickTable',
    },
  };

  moveCharacter = (xDelta, yDelta) => {
    let targetX = this.state.char.x + xDelta;
    let targetY = this.state.char.y + yDelta;
    if (targetX < 0 || targetX >= this.state.gridSize.columns) return;
    if (targetY < 0 || targetY >= this.state.gridSize.rows) return;
    this.state.char.x = targetX;
    this.state.char.y = targetY;
  };

  parseCoordKey = coordKey => {
    if (!coordKey) return null;
    let [xCoord, yCoord] = `${coordKey}`.split('x');
    let parsedX = Number(xCoord);
    let parsedY = Number(yCoord);
    if (Number.isNaN(parsedX) || Number.isNaN(parsedY)) return null;
    return { x: parsedX, y: parsedY };
  };

  canInteractWith = coordKey => {
    let coords = this.parseCoordKey(coordKey);
    if (!coords) return false;
    let deltaX = Math.abs(this.state.char.x - coords.x);
    let deltaY = Math.abs(this.state.char.y - coords.y);
    return (
      deltaX <= this.state.interactionRange &&
      deltaY <= this.state.interactionRange
    );
  };

  actions = {
    init: async () => {
      let s = await autoassist({
        endpoint: 'https://kittygpt.netlify.app/.netlify/functions/voicechat',
        navdisable: true,
        idtrack: true,
        llm: true,
      });

      s.sysupdate({
        main: `You're a puzzle solver. Have at it!`,
      });
    },

    moveUp: () => {
      this.moveCharacter(0, -1);
    },

    moveDown: () => {
      this.moveCharacter(0, 1);
    },

    moveLeft: () => {
      this.moveCharacter(-1, 0);
    },

    moveRight: () => {
      this.moveCharacter(1, 0);
    },

    attemptClick: coordKey => {
      if (!this.canInteractWith(coordKey)) return;
      let actionName = this.state.clickCoords[coordKey];
      if (!actionName) return;
      let handler = this.actions[actionName];
      if (typeof handler === 'function') {
        handler();
      }
    },

    clickChest: () => {
      if (this.state.chest === 'media/open_chest.png') return;
      this.state.inventory.push('grease_can');
      this.state.chest = 'media/open_chest.png';
    },

  	clickTable: () => {
      if (this.state.table === 'media/empty_table.png') return;
      this.state.inventory.push('chest_key');
      this.state.table = 'media/empty_table.png';
    },
  };
}
