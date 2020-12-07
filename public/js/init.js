/**
 * Create "sign in" form in #container 
 */
function init_signin(sid) {
  if (sid !== socket.id) return render('error', { title: 'Connection Error' });

  container.innerHTML = "";
  container.insertAdjacentHTML('beforeend', `<h2>Identifiy Yourself</h2>Username: `);

  let username = document.createElement('input');
  username.placeholder = 'Username';
  username.type = 'text';
  container.insertAdjacentElement('beforeend', username);

  container.insertAdjacentHTML('beforeend', `<br>Password: `);

  let password = document.createElement('input');
  password.placeholder = 'Password';
  password.type = 'password';
  container.insertAdjacentElement('beforeend', password);

  container.insertAdjacentHTML('beforeend', `<br>`);

  let button = document.createElement('button');
  button.innerText = "Sign In";
  button.addEventListener('click', () => __emit('sign-in', { username: username.value, password: password.value }));
  container.insertAdjacentElement('beforeend', button);

  container.insertAdjacentHTML('beforeend', `<hr>`);

  let link = document.createElement('a');
  link.innerText = "New Account";
  link.href = "javascript:void(0)";
  link.addEventListener('click', () => init_create(sid));
  container.insertAdjacentElement('beforeend', link);
}

/**
 * Create "create account" form in #container
 */
function init_create(sid) {
  if (sid !== socket.id) return render('error', { title: 'Connection Error' });

  container.innerHTML = "";
  container.insertAdjacentHTML('beforeend', `<h2>Create Account</h2>Username: `);

  let username = document.createElement('input');
  username.placeholder = 'Username';
  username.type = 'text';
  container.insertAdjacentElement('beforeend', username);

  container.insertAdjacentHTML('beforeend', `<br>Password: `);

  let password = document.createElement('input');
  password.placeholder = 'Password';
  password.type = 'password';
  container.insertAdjacentElement('beforeend', password);

  container.insertAdjacentHTML('beforeend', `<br>`);

  let button = document.createElement('button');
  button.innerText = "Create";
  button.addEventListener('click', () => __emit('create-account', { username: username.value, password: password.value }));
  container.insertAdjacentElement('beforeend', button);
}

/** From a given array, select or create a new game. */
function init_selectGame(sid, games) {
  if (sid !== socket.id) return render('error', { title: 'Connection Error' });

  container.innerHTML = '<b>Password for joining/creating game: </b>';
  let passwordBox = document.createElement('input');
  passwordBox.type = 'password';
  passwordBox.placeholder = 'Passsword (optional)';
  container.insertAdjacentElement('beforeend', passwordBox);

  container.insertAdjacentHTML('beforeend', '<br><br><b>Select Game: </b>');

  let menu = document.createElement('select');
  for (let game of games) {
    let optn = document.createElement('option');
    if (game.mode == 1) {
      optn.innerText = `${game.name} (type: Single)`;
    } else {
      optn.innerText = `${game.name} (type: Double, owner: ${game.owner})`;
    }
    optn.value = game.name;
    menu.appendChild(optn);
  }
  container.insertAdjacentElement('beforeend', menu);

  let join = document.createElement('button');
  join.innerText = 'Join';
  join.addEventListener('click', () => __emit('join-game', { game: menu.value, password: passwordBox.value }));
  container.insertAdjacentElement('beforeend', join);

  container.insertAdjacentHTML('beforeend', '<br><b>Create New: </b>');

  let newGame = document.createElement('input');
  newGame.placeholder = 'Game Name';
  newGame.type = 'text';
  container.insertAdjacentElement('beforeend', newGame);

  let create = document.createElement('button');
  create.innerText = 'Create';
  create.addEventListener('click', () => {
    if (newGame.value.length > 0) {
      __emit('create-game', { game: newGame.value, single: true, password: passwordBox.value });
    } else {
      render('error', { message: 'Game name is required' });
    }
  });
  container.insertAdjacentElement('beforeend', create);
}

