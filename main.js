const express = require('express');
const socketio = require('socket.io');

const SenetBoard = require('./src/senet-board.js');
const User = require('./src/user.js');
const SocketIO_Socket = require('./src/socket-class.js');

const PORT = 3000;

const app = express();
const server = app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
const io = socketio(server);

// Routes
app.use(express.static('./public/'));

io.on('connection', (socket) => {
  const Socket = new SocketIO_Socket(socket);

  socket.on('client-event', data => {
    if (data.sid != socket.id) return Socket.error('Connection Error', 'Connection unrecognised');

    switch (data.event) {
      case 'sign-in': {
        // Sign-In is an initial option to login to an existing account
        Socket.signin(data.username, data.password);
        break;
      }
      case 'create-account': {
        // Create-Account is an initial option to create a new account
        Socket.createAccount(data.username, data.password);
        break;
      }
      case "get-games": {
        // Get list of all users' games
        Socket.getGames();
        break;
      }
      case "join-game": {
        Socket.selectGame(data.game, data.password);
        break;
      }
      case "create-game": {
        // Create a new game
        Socket.createGame(data.game, data.single, data.password);
        break;
      }
      case "throw-sticks": {
        Socket.throwSticks();
        break;
      }
      case "piece-move": {
        Socket.error('Error', 'Piece validation not implemented');
        break;
      }
      default:
        Socket.error('Unknown Event', `Unknown client event '${data.event}'`);
    }
  });

  Socket.signin('dev1', '123');

  setTimeout(() => {
    Socket.selectGame('test', '123');
  }, 500);
});

User.create('dev1', '123');
User.create('dev2', '123');
SenetBoard.newGame('test', 'dev1', true, '123');