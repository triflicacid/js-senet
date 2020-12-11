// global const 'socket'

/** Send event */
function __emit(event, data = undefined) {
  if (data === undefined) data = {};
  socket.emit('client-event', { event, sid: socket.id, ...data });
}

socket.on('status', (data) => {
  switch (data.status) {
    case "unknown":
      render('instructions', data.sid);
      init_signin(data.sid);
      break;
    case "logged-in":
      document.getElementById('extra-info').innerHTML = `User <b>${data.username}</b>`;
      __emit('get-games');
      break;
    case "game-list":
      render("message", "Select game to play");
      init_selectGame(data.sid, data.games);
      break;
    case "joined-game":
      container.innerHTML = '';
      render('message', 'Please Wait...');
      break;
    case "board-setup":
      delete data.sid;
      delete data.status;
      boardRenderInfo = data;
      renderBoard = true;
      let mode = data.mode == 1 ? 'single' : 'double';
      document.getElementById('extra-info').innerHTML += `, playing <i>${mode}</i> game <b> ${data.name}</b>`;
      if (typeof data.whoami == 'boolean') document.getElementById('extra-info').innerHTML += ` (<b>${data.whoami ? "white" : "black"}</b>)`;
      render('message', 'Please Wait.....');
      break;
    default:
      console.error('StatusError: unknown status: ' + data.status);
      render('error', { message: 'Unknown status ' + data.status });
  }
});

socket.on('board-info', (data) => {
  console.log("BOARD UPDATE");
  if (data.sid != socket.id) {
    render('error', { title: 'Connection Error', message: 'SID mismatch' });
  } else {
    data = data.data;
    boardInfo = data;
    if (data.players == data.max) {
      renderBoard = true;
      render('board');
    } else {
      renderBoard = false;
      render('message', `${boardRenderInfo.name}: waiting for players... (${data.players}/${data.max})`);
    }
  }
});

socket.on('online-count', (data) => {
  document.getElementById('online').innerText = data.online;
});

socket.on('fatal-error', (data) => {
  renderBoard = false;
  console.error(`[ERROR]\n - ${data.title}: "${data.message}"`);
  render('error', data);
});

socket.on('message', (data) => {
  console.log(`[!MESSAGE] ${data.message}`);
});