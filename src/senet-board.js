const User = require('./user.js');
const ReturnStruct = require('./return-struct');

class SenetBoard {
  constructor(name, owner, isSingle, password = '') {
    this._name = name;
    this._owner = owner;
    this._password = password;
    this._play_mode = isSingle ? PlayModeEnum.SINGLE : PlayModeEnum.DOUBLE;

    this.player1 = null;
    this.player2 = null;

    this.player1Colour = Math.random() <= 0.5;

    this.setupData = undefined; // Populated by this.getSetupData()
    this.data = []; // Board data. true -> white, false -> black, null -> empty
    this.pos = []; // Array of coordinates for each piece
    this.sticks = new Array(5); // Array os booleans. true -> white, false -> black
    this.score = NaN; // Score from throwing sticks - NEVER TRUST CLIENT!
    this.at_anubis = [0, 0]; // Pieces on end (at anubis). [white, black]

    this._white_go = false; // Whos go is it? true -> white, false -> black

    this.stick_score = NaN; // Score for sticks

    // SETUP
    this.data = new Array(3 * 10);
    for (let x = 0, f = true; x < 10; x++, f = !f) this.data[x] = f;

    this.throwSticks();
  }

  /**
   * Add player to game
   * - Expected SocketIO_Socket instance
   */
  addPlayer(socket, password) {
    // If game is password protected...
    if (this._password.length != 0 && password != this._password) {
      return socket.error('Error', `Incorrect password for game`);
    }

    const join = () => {
      socket.activeGame = this;
      if (this.player1 == null) this.player1 = socket;
      else this.player2 = socket;

      socket.log(`joined game ${this._name}`);
      socket.sendStatus('joined-game', { game: this._name });
      socket.sendStatus('board-setup', this.getSetupData(socket));
      this.emitInfo();
    };

    // Is it the socket's game?
    if (socket.user.games.indexOf(this._name) !== -1) {
      // Singleplayer game?
      if (this._play_mode == PlayModeEnum.SINGLE) {
        if (this.player1 == null) {
          join();
        } else {
          socket.error('Error', 'Single player game is full (1/1)');
        }
      } else {
        if (this.player2 != null) {
          socket.error('Error', 'Multiplayer game is full (2/2)');
        } else {
          join();
        }
      }
    } else {
      // Cannot connect to external singleplayer game
      if (this._play_mode == PlayModeEnum.SINGLE) {
        socket.error('Error', `Cannot join singleplayer game as it is not ours`);
      } else {
        // Is game full?
        if (this.player2 != null) {
          socket.error('Error', `Multiplayer game '${this._name}' is full (2/2)`);
        } else {
          if (this.player1 == null && this._owner != socket.user._name) {
            socket.error('Error', `Multiplayer game is not open (owner ${this._owner} must be in game)`);
          } else {
            join();
          }
        }
      }
    }
  }

  /** Send info to connected players */
  emitInfo() {
    let players = 0;
    if (this.player1 != null) players++;
    if (this.player2 != null) players++;
    if (players == 0) {
      console.error(`[!] Game ${this._name}: Attempting to emit info with 0 players`);
      return;
    }

    let data = {
      players,
      max: (this._play_mode == PlayModeEnum.SINGLE ? 1 : 2),
      board: this.data,
      pos: this.pos,
      whiteGo: this._white_go,
      sticks: this.sticks,
      score: this.score,
      atAnubis: this.at_anubis,
      mov: this._white_go, // Which colour pieces may we move?
    };

    // Send data to player1
    if (this.player1 != null) {
      data.mov = this.player1Colour == this._white_go ? this._white_go : null; // Colours match?
      this.player1.emit('board-info', { data, });
    }

    // Send data to player2
    if (this.player2 != null) {
      data.mov = this.player1Colour == this._white_go ? null : this._white_go; // Colours match
      this.player2.emit('board-info', { data, });
    }
  }

  /**
   * Data to be sent in 'setup' event upon connection
   * - Param: socket object initiating request
   */
  getSetupData(socket) {
    let data = {
      mode: this._play_mode,
      home: [], // Base (home) positions
      labels: [], // Labels (numbers) for each house
      name: this._name,
      whoami: null,
    };
    this.setupData = data;

    if (this._play_mode == PlayModeEnum.DOUBLE) {
      data.whoami = this.player1 == socket ? this.player1Colour : !this.player1Colour;
    }

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

  /**
   * Normalise piece positions (set this.pos equiv to this.home)
   */
  normalisePiecePositions() {
    for (let i = 0; i < this.data.length; i++) {
      this.pos[i][0] = this.setupData.home[i][0];
      this.pos[i][1] = this.setupData.home[i][1];
    }
  }

  /**
   * Broadcast message to both players
   */
  message(msg) {
    if (this.player1 != null) this.player1.message(msg);
    if (this.player2 != null) this.player2.message(msg);
  }

  /**
   * Move piece {index} from {from} to {to}
   * @param  {Number} hfrom      Index of house moving from
   * @param  {Number | String} hto      Index of house moving to ('a' for anubis)
   * @param  {Boolean} flag             Flag value
   * @return {Number} Status code (see help file)
   */
  move(hfrom, hto, flag) {
    // Actually moving a piece?
    if (this.data[hfrom] == undefined) return -1;

    // Colour of piece that is moving
    const colour = this.data[hfrom];

    // Correct piece moving?
    if (colour != this._white_go) return -1;

    // Cannot pass 25... must land directly on it
    if (hfrom < 25 && hto > 25) return -11;

    // NB piece on square index 25 is protected no matter what
    if (hto == 25 && this.data[hto] != undefined && this.data[hto] != colour) return -5;

    // On House of Waters?
    if (hfrom == 26) {
      this.throwSticks();
      if (flag || this.score != 4) {
        // Go to House of Second Life
        this._move(26, 15);
        return -7;
      } else {
        // Reach end
        hto = 'a';
      }
    }

    if (hto == 'a') {
      this.data[hfrom] = undefined;
      this.at_anubis[colour ? 0 : 1]++;
      return 2;
    } else {
      // Special squares require certain moves
      if (hfrom == 27) return -8;
      if (hfrom == 28) return -9;
      if (hfrom == 29) return -10;
    }

    // General Moves
    const labels = this.setupData.labels;

    // Get labels from house indexes
    const lbl_from = labels[hfrom];
    const lbl_to = labels[hto];

    // If distance == score ?
    if (Math.abs(lbl_to - lbl_from) != this.score) return -2;

    if (this.isValidMove(hfrom, hto)) {
      // Coolio
    } else if (this.isValidMove(hfrom, labels.indexOf(lbl_from - this.score))) {
      // Can move backward if cannot move forward
      if (lbl_from - this.score != lbl_to) {
        // If we can move backward, but are not, error...
        return -4;
      }
    } else {
      // FORFEIT
      return -6;
    }

    if (this.data[hto] != undefined) {
      // Swap pieces
      if (hto == 27 || hto == 28 || hto == 29) {
        // Enemy goes into water
        this._move(hto, 15);
        return 1;
      } else {
        this.data[hfrom] = this.data[hto];
      }
      this.data[hto] = colour;
    } else {
      // Move (if moving backward from special house, go into water)
      if (hto < hfrom && (hfrom == 27 || hfrom == 28 || hfrom == 29)) {
        // Into water
        this._move(hfrom, 15);
        return 1;
      } else {
        this.data[hfrom] = undefined;
        this.data[hto] = colour;
      }
    }
    return 0;
  }

  /**
   * Check: is valid move. Assume distance is OK and no conflict in whose go it is
   * @param {Number} from     Index moving from
   * @param {Number} to       Index moving to
   * @return {Boolean} Is valid move?
   */
  isValidMove(from, to) {
    if (to < 0 || to > this.data.length - 1) return false;
    if (this.data[to] == undefined) return true;
    if (this.data[from] == this.data[to]) return false;

    const labels = this.setupData.labels;
    let lbl_to = labels[to];

    // If on 27, 28, 29 pieces are not protected
    if (to == 27 || to == 28 || to == 29) return true;

    // Check: enemy before?
    let col = this.data[labels.indexOf(lbl_to - 1)];
    if (col != undefined && col != this.data[from]) return false;

    // Check: enemy after?
    col = this.data[labels.indexOf(lbl_to + 1)];
    if (col != undefined && col != this.data[from]) return false;

    return true;
  }

  /**
   * Force move piece from <from> to <to>
   * @return {Boolean} Success
   */
  _move(from, to) {
    const labels = this.setupData.labels;
    let dst = to; // Index of destination house

    while (typeof this.data[dst] === 'boolean') {
      dst = labels.indexOf(labels[dst] - 1);
    }

    if (dst > -1) {
      this.data[dst] = this.data[from];
      this.data[from] = undefined;
      return true;
    } else {
      return false;
    }
  }

  /**
   * Attempt to move piece unto Anubis
   * @param {Number} reqScore   Required this.score value to move 
   * @param {Number} index      Index of piece moving
   * @return {Boolean}
   */
  _moveToEnd(reqScore, index) {
    if (typeof this.data[index] == 'boolean' && this.score == reqScore) {
      this.at_anubis[this.data[index] ? 0 : 1]++;
      this.data[index] = undefined;
      return true;
    } else {
      this.message(`Moving to end requires certain score of ${reqScore}, got ${this.score}`);
      return false;
    }
  }

  /**
   * Get winner of game
   * @return {null | boolean} Winner
   */
  getWinner() {
    let falseCount = 0, trueCount = 0;
    for (let piece of this.data) {
      if (piece === true) trueCount++;
      else if (piece === false) falseCount++;
    }

    if (trueCount === 0) return true;
    if (falseCount === 0) return false;
    return null;
  }

  /**
   * Create a game for a person
   * @param {String} owner    Username of owner User object
   * @return {ReturnStruct}
   * */
  static newGame(name, owner, isSingle, password = '') {
    if (SenetBoard.games.hasOwnProperty(name)) {
      return new ReturnStruct(true, `Game ${name} already exists`);
    } else if (!User.users.hasOwnProperty(owner)) {
      return new ReturnStruct(true, `User ${owner} does not exist`);
    } else {
      const game = new SenetBoard(name, owner, isSingle == true, password);
      SenetBoard.games[name] = game;
      User.users[owner].games.push(name);
      return new ReturnStruct(false, 'Created game ' + name);
    }
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