const users = require('./users.js');
const SenetBoard = require('./senet-board.js');

/**
 * Class for managing socket.io "socket" object
 */
class SocketIO_Socket {
  constructor(socket) {
    this._socket = socket;
    this._sid = socket.id;

    this.currentStatus = undefined;
    this.user = null; // Details of logged in user (from users.users)
    this.activeGame = null; // SenetBoard object of current game

    SocketIO_Socket.connected.push(this);
    console.log(`Socket ${this._sid} CONNECTED`);

    // Initate status communication
    this.sendStatus('unknown');

    this._socket.on('disconnect', () => this._disconnect());
  }

  _disconnect() {
    const i = SocketIO_Socket.connected.indexOf(this);
    SocketIO_Socket.connected.splice(i, 1);

    // Remove from game
    if (this.activeGame != null) {
      let i = this.activeGame._players.indexOf(this);
      this.activeGame._players.splice(i, 1);

      this.activeGame = null;
    }

    // Logout user
    if (this.user) {
      this.user.online = false;
      this.user = null;
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

  /**
   * Send status event
   */
  sendStatus(status, data = undefined) {
    this.currentStatus = status;
    if (data == undefined) data = {};
    this.emit('status', { status, ...data });
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
    if (users.users.hasOwnProperty(username)) {
      // ALready logged in to?
      if (users.users[username].online) {
        return this.error('Error', 'Username already logged in');
      } else {
        // Password correct?
        if (users.users[username].password == password) {
          this.user = users.users[username];
          this.log(`signed in as ${username}`);
          this.sendStatus('logged-in', { username });
        } else {
          return this.error('Error', 'Incorrect password');
        }
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
    if (users.users.hasOwnProperty(username)) {
      return this.error('Error', `Username ${username} already exists`);
    } else {
      // Create account
      users.createUser(username, password);
      this.log(`created account ${username}`);

      // SIgn-In
      this.signin(username, password);
    }
  }

  /** Get list of all current games (if logged in) */
  getGames() {
    if (this.currentStatus != 'logged-in') return this.error('Error', 'Unable to fetch game list at this time');
    if (this.user == null) return this.error('Error', 'Must be logged in to view game list');

    let games = this.user.games;
    this.log(`requested game list: ${games.length} games`);
    this.sendStatus('game-list', { games });
  }

  /** Create a game under logged-in username */
  createGame(name, isSingle = true, password = '') {
    if (this.currentStatus != 'game-list') return this.error('Error', 'Unable to create new game at this time');
    if (this.user == null) return this.error('Error', 'Must be logged in to view game list');
    if (typeof name !== 'string' || name == '') return this.error('Error', 'Game name is required');

    // Does game already exist?
    if (SenetBoard.games.hasOwnProperty(name)) {
      return this.error('Error', `Game '${name}' already exists`);
    } else {
      SenetBoard.games[name] = new SenetBoard(name, isSingle === true, password);
      this.user.games.push(name);
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

    const joinGame = (game) => {
      this.activeGame = game;
      this.activeGame._players.push(this);
      this.log(`joined game ${game._name}`);
      this.sendStatus('joined-game', { game: game._name });
      this.sendStatus('board-setup', this.activeGame.getSetupData());
      this.activeGame.emitInfo();
    };

    // Does game exist?
    if (SenetBoard.games[name]) {
      // If game is password protected...
      if (SenetBoard.games[name]._password.length != 0 && password != SenetBoard.games[name]._password) {
        return this.error('Error', `Cannot join game: password is incorrect`);
      }

      // Is it our game?
      if (this.user.games.indexOf(name) !== -1) {
        // Singleplayer game?
        if (SenetBoard.games[name]._play_mode == SenetBoard.PlayModeEnum.SINGLE) {
          if (SenetBoard.games[name]._players.length == 0) {
            joinGame(SenetBoard.games[name]);
          } else {
            this.error('Error', 'Single player game is full (1/1)');
            this.sendStatus('joined-game', { game: name });
          }
        } else {
          if (SenetBoard.games[name]._players.length == 2) {
            this.error('Error', 'Multi player game is full (2/2)');
          } else {
            joinGame(SenetBoard.games[name]);
          }
        }
      } else {
        // Cannot connect to external singleplayer game
        if (SenetBoard.games[name]._play_mode == SenetBoard.PlayModeEnum.SINGLE) {
          this.error('Error', `Cannot join singleplayer game as it is not ours`);
        } else {
          // Is game full?
          if (SenetBoard.games[name]._players.length == 2) {
            this.error('Error', `Multiplayer game '${name}' is full (2/2)`);
          } else {
            joinGame(SenetBoard.games[name]);
          }
        }
      }
    } else {
      this.error('Error', `Game ${name} does not exist`);
    }
  }
}

/**
 * Array of all logged-in objects
 */
SocketIO_Socket.connected = [];

module.exports = SocketIO_Socket;