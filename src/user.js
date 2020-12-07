const ReturnStruct = require('./return-struct.js');

class User {
  constructor(name, password) {
    this._name = name;
    this._passwd = password;

    this.games = []; // Games which are belonging to this user

    /** SocketIO_Socket class (SocketIO_Socket or null) */
    this.socket = null;
  }

  /**
   * Sign in with an socket connetcion
   * @param {String} username     Username of user
   * @param {String} password     Password of user
   * @param {SocketIO_Socket} socket  Socket of connetion
   * @return {ReturnStruct} Return Value
   */
  signin(username, password, socket) {
    if (socket === this.socket) {
      return new ReturnStruct(false, 'Logged In');
    }

    if (username == this._name && password == this._passwd) {
      if (this.socket == null) {
        this.socket = socket;
        socket.user = this;
        return new ReturnStruct(false, 'Logged In');
      } else {
        return new ReturnStruct(true, `Account is in use`);
      }
    } else {
      return new ReturnStruct(true, `Incorrect credentials`);
    }
  }

  /**
   * Log user out
   */
  logout() {
    this.socket.user = null;
    this.socket = null;
  }

  /**
   * Delete user
   * @return {Number} Return code (0/1)
   */
  delete() {
    if (this.socket != null) this.socket.disconnect();
    delete User.users[this._name];
    return 0;
  }

  /**
   * Create new user
   * @static
   * @param {String} name     Name of user 
   * @param {String} password Password of user
   * @return {User | null} User, if creared, or null
   */
  static create(name, password) {
    if (User.users.hasOwnProperty(name)) return null;

    const user = new User(name, password);
    User.users[name] = user;
    return user;
  }
}

/** { username: User } */
User.users = {};

module.exports = User;