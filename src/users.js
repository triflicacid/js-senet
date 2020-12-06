/**
 * User information
 * { username: { password, online, games: [ game_name ] } }
 */
const users = {};

function createUser(username, password) {
  users[username] = { username, password, online: false, games: [] };
  return users[username];
}

module.exports = { users, createUser };