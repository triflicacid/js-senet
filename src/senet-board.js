class SenetBoard {
  constructor(name, isSingle, password = '') {
    this._name = name;
    this._password = password;
    this._play_mode = isSingle ? PlayModeEnum.SINGLE : PlayModeEnum.DOUBLE;
    this._players = []; // Only ever one item if single. Contains Socket object.

    this.data = []; // Board data. true -> white, false -> black, null -> empty
    this.pos = []; // Array of coordinates for each piece
    this.sticks = new Array(5); // Array os booleans. true -> white, false -> black
    this.score = NaN; // Score from throwing sticks - NEVER TRUST CLIENT!
    this.at_anubis = [0, 0]; // Pieces on end (at anubis). [white, black]

    this._white_go = false; // Whos go is it? true -> white, false -> black
    if (!isSingle) this._colours = []; // [true, false] or [false, true] (mapping to this._players)

    this.stick_score = NaN; // Score for sticks

    // SETUP
    this.data = new Array(3 * 10);
    for (let x = 0, f = true; x < 10; x++, f = !f) this.data[x] = f;

    this.throwSticks();
  }

  /** Send info to connected players */
  emitInfo() {
    let data = {
      players: this._players.length,
      max: (this._play_mode == PlayModeEnum.SINGLE ? 1 : 2),
      board: this.data,
      pos: this.pos,
      whiteGo: this._white_go,
      sticks: this.sticks,
      score: this.score,
      atAnubis: this.at_anubis,
    };

    for (let player of this._players) player.emit('board-info', { data, });
  }

  /** Data to be sent in 'setup' event upon connection */
  getSetupData() {
    let data = {
      home: [], // Base (home) positions
      labels: [], // Labels (numbers) for each house
    };

    data.padding = 14;
    data.w = 54;
    data.border = 12;
    let dim = data.w + data.border;
    let half = data.w / 2;

    // Coordinates for position of each cell (going accross; ltr)
    for (let y = 1; y <= 3; y++) {
      for (let x = 1; x <= 10; x++) {
        let coords = [
          data.padding + x * dim - half,
          data.padding + y * dim - half
        ];
        data.home.push([...coords]);
        this.pos.push(coords);
      }
    }

    // Generate "labels" for each square
    for (let y = 0; y < 3; y++) {
      let max = 10;
      if (y % 2 == 0) {
        for (let x = 0; x < max; x++) data.labels.push(y * max + x + 1);
      } else {
        for (let x = max; x > 0; x--) data.labels.push(y * max + x);
      }
    }

    return data;
  }

  /**
   * Randomise stick results
   * @return {Number} Score
   */
  throwSticks() {
    let whites = 0;
    for (let i = 0; i < this.sticks.length; i++) {
      this.sticks[i] = Math.random() <= 0.5;
      if (this.sticks[i]) ++whites;
    }
    this.score = whites == 0 ? 5 : whites;
    return this.score;
  }
}

const PlayModeEnum = { SINGLE: 1, DOUBLE: 2 };
SenetBoard.PlayModeEnum = PlayModeEnum;

SenetBoard.playAgainValues = [1, 4, 5];

/**
 * All games
 * { name: object }
 */
SenetBoard.games = {};

module.exports = SenetBoard;