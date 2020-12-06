// global const 'socket'

/** Send event */
function __emit(event, data = undefined) {
  if (data === undefined) data = {};
  socket.emit('client-event', { event, sid: socket.id, ...data });
}

socket.on('status', (data) => {
  console.log(data)
  switch (data.status) {
    case "unknown":
      render('instructions', data.sid);
      init_signin(data.sid);
      break;
    case "logged-in":
      document.getElementById('logged-in-user').innerText = data.username;
      __emit('get-games');
      break;
    case "game-list":
      render("message", "Select game to play");
      init_selectGame(data.sid, data.games);
      break;
    case "joined-game":
      document.getElementById('active-game').innerText = data.game;
      container.innerHTML = '';
      render('message', 'Please Wait...');
      break;
    case "board-setup":
      delete data.sid;
      delete data.status;
      boardRenderInfo = data;
      renderBoard = true;
      render('message', 'Please Wait.....');
      break;
    default:
      console.error('StatusError: unknown status: ' + data.status);
      render('error', { message: 'Unknown status ' + data.status });
  }
});

socket.on('board-info', (data) => {
  if (data.sid != socket.id) {
    render('error', { title: 'Connection Error', message: 'SID mismatch' });
  } else {
    data = data.data;
    if (data.players == data.max) {
      console.log(data);
      boardInfo = data;
      renderBoard = true;
      render('board');
    } else {
      renderBoard = false;
      render('message', `Waiting for players... (${data.players}/${data.max})`);
    }
  }
});

socket.on('fatal-error', (data) => {
  renderBoard = false;
  console.error(`[ ERROR ]\n- ${data.title}: "${data.message}"`);
  render('error', data);
});