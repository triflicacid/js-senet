const User = require('./user.js');
const SenetBoard = require('./senet-board.js');

/**
 * Class for managing socket.io "socket" object
 */
class SocketIO_Socket {
  constructor(socket) {
    this._socket = socket;
    this._sid = socket.id;
    this._block = false; // Block status/emit 's

    this.currentStatus = undefined;
    this.user = null; // User object, or null
    this.activeGame = null; // SenetBoard object of current game

    SocketIO_Socket.connected.push(this);
    console.log(`Socket ${this._sid} CONNECTED`);

    // Initate status communication
    this.sendStatus('unknown');

    this._socket.on('disconnect', () => this.disconnect());

    SocketIO_Socket.updateOnline();
  }

  disconnect() {
    const i = SocketIO_Socket.connected.indexOf(this);
    SocketIO_Socket.connected.splice(i, 1);
    SocketIO_Socket.updateOnline();

    // Remove from game
    if (this.activeGame != null) {
      if (this.activeGame.player1 == this) this.activeGame.player1 = null;
      else if (this.activeGame.player2 == this) this.activeGame.player2 = null;
      this.activeGame.emitInfo();

      this.activeGame = null;
    }

    // Logout user
    if (this.user) {
      this.user.logout();
    }

    console.log(`Socket ${this._sid} DISCONNECTED`);
  }

  /**
   * Emit event through socket
   */
  emit(eventType, data = undefined) {
    if (data == undefined) data = {};
    this._socket.emit(eventType, { sid: this._sid, ...data });
  }

  /**
   * Emit error through socket
   */
  error(title, message) {
    this.emit('fatal-error', { title, message });
    console.error(`Socket ${this._sid}: error: ${title}: ${message}`);
  }

  /**
   * Log message to console 
   */
  log(message) {
    console.log(`Socket ${this._sid}: ${message}`);
  }

  message(message) {
    this.emit('message', { message });
  }

  /**
   * Send status event
   */
  sendStatus(status, data = undefined) {
    if (this._block) {
      this.message(`Status ${status} blocked from sending`);
    } else {
      this.currentStatus = status;
      if (data == undefined) data = {};
      this.emit('status', { status, ...data });
    }
  }

  /**
   * Enter sign-in process
   */
  signin(username, password) {
    // Are we calling this at a correct status?
    if (this.currentStatus != 'unknown' && this.currentStatus != 'createdAccount')
      return this.error('Error', `Unauthorised: cannot sign in at this time`);
    if (this.user != null) return this.error('Error', `Already logged in. To log out, refresh page.`);

    // Sign-In is an initial option to login to an existing account
    if (typeof username !== 'string' || username == '') return this.error('Error', 'Username is required');
    if (typeof password !== 'string' || password == '') return this.error('Error', 'Password is required');

    // Username exists?
    if (User.users.hasOwnProperty(username)) {
      const user = User.users[username];
      const obj = user.signin(username, password, this);
      if (obj.error) {
        this.error('Error', obj.msg);
      } else {
        this.log(`signed in as ${username}`);
        this.sendStatus('logged-in', { username });
      }
    } else {
      return this.error('Error', 'Unrecognised username');
    }
  }

  createAccount(username, password) {
    // Are we calling this at a correct status?
    if (this.currentStatus != 'unknown')
      return this.error('Error', `Unauthorised: unable to create account at this time`);

    // Sign-In is an initial option to login to an existing account
    if (typeof username !== 'string' || username == '') return this.error('Error', 'Username is required');
    if (typeof password !== 'string' || password == '') return this.error('Error', 'Password is required');

    // Username exists?
    let user = User.create(username, password);
    if (user == null) {
      this.error('Error', `Username ${username} already exists`);
    } else {
      // Created account
      this.log(`created account ${username}`);

      // Sign-In
      this.signin(username, password);
    }
  }

  /** Get list of all current games (if logged in) */
  getGames() {
    if (this.currentStatus != 'logged-in') return this.error('Error', 'Unable to fetch game list at this time');
    if (this.user == null) return this.error('Error', 'Must be logged in to view game list');

    let games = [];
    for (let gameName in SenetBoard.games) {
      if (SenetBoard.games.hasOwnProperty(gameName)) {
        let game = SenetBoard.games[gameName];
        if (game._owner == this.user._name || game._play_mode == SenetBoard.PlayModeEnum.DOUBLE) games.push({
          name: gameName,
          mode: game._play_mode,
          owner: game._owner,
        });
      }
    }
    this.log(`requested game list: ${games.length} games`);
    this.sendStatus('game-list', { games });
  }

  /** Create a game under logged-in username */
  createGame(name, isSingle = true, password = '') {
    if (this.currentStatus != 'game-list') return this.error('Error', 'Unable to create new game at this time');
    if (this.user == null) return this.error('Error', 'Must be logged in to view game list');
    if (typeof name !== 'string' || name == '') return this.error('Error', 'Game name is required');

    const obj = SenetBoard.newGame(name, this.user._name, isSingle, password);
    if (obj.error) {
      this.error('Error', obj.msg);
    } else {
      this.log(`create new game '${name}' (password: ${password == '' ? 'No' : 'Yes'})`);
      this.selectGame(name, password);
    }
  }

  throwSticks() {
    if (this.currentStatus != 'board-setup') return this.error('Error', 'Unable to throw sticks at this time');
    this.activeGame.throwSticks();
    this.activeGame.emitInfo();
  }

  /**
   * Select a game
   * @param {String} name     Name of game to select
   * @param {String} password DOUBLE games require a password to join, if not ours
   */
  selectGame(name, password = undefined) {
    if (this.currentStatus != 'game-list') return this.error('Error', 'Unable to join game at this time');
    if (typeof password != 'string') password = '';
    if (this.user == null) return this.error('Error', 'Must be logged in to select a game');

    // Does game exist?
    if (SenetBoard.games[name]) {
      const game = SenetBoard.games[name];

      game.addPlayer(this, password);

      // Is game already over?
      this.checkGameWon();
    } else {
      return this.error('Error', `Game ${name} does not exist`);
    }
  }

  /**
   * Move a piece in this.activeGame
   */
  moveGamePiece(pindex, hfrom, hto) {
    this.message(`Move piece index ${pindex} from ${hfrom} to ${hto}`);
    if (this.activeGame) {
      let code = this.activeGame.move(pindex, hfrom, hto);
      this.activeGame.normalisePiecePositions();
      this.sendStatus('moved-piece', { code });

      if (this.checkGameWon() == null) {
        if (code != -1) {
          this.activeGame._white_go = !this.activeGame._white_go;
          this.activeGame.throwSticks();
        }
        this.activeGame.emitInfo();
      }
    } else {
      this.error('Error', 'Must be in a game to move a piece');
    }
  }

  /**
   * Check game to see if won
   * @return {null | boolean} Winner of game
   * */
  checkGameWon() {
    let winner = this.activeGame.getWinner();
    if (typeof winner === 'boolean') {
      this._block = false;
      this.sendStatus('winner', { w: winner });
      this._block = true;
    }
    return winner;
  }

  /** Alert all users of who is connected */
  static updateOnline() {
    for (let conn of SocketIO_Socket.connected) {
      conn.emit('online-count', { online: SocketIO_Socket.connected.length });
    }
  }
}

/**
 * Array of all logged-in objects
 */
SocketIO_Socket.connected = [];

module.exports = SocketIO_Socket;