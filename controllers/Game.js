export default class Game {
  state = {
    inventory: [],
  	chest: 'media/closest_chest.png',
    table: 'media/key_table.png',
    char: { x: 0, y: 0 },
  };

  actions = {
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
