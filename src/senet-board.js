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