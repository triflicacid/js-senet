const randint = (min, max) => {
  if (max == undefined) { max = min; min = 0; }
  return Math.floor(Math.random() * (max - min)) + min;
};

const randfloat = (min, max) => {
  if (max == undefined) { max = min; min = 0; }
  return (Math.random() * (max - min)) + min;
};

/** Render piece */
function renderPiece(isWhite, x, y, l) {
  if (isWhite) {
    // WHITE (circle)
    stroke(black);
    fill(white);
    circle(x, y, l * 2);
  } else {
    // BLACK (triangle)
    stroke(white);
    fill(black);

    beginShape();
    vertex(x, y - l);
    vertex(x - l, y + l);
    vertex(x + l, y + l);
    vertex(x, y - l);
    endShape();
  }
}

/** Reset piece at index ot origin position */
const resetPiecePos = pos => {
  if (boardInfo.pos[pos]) {
    boardInfo.pos[pos][0] = boardRenderInfo.home[pos][0];
    boardInfo.pos[pos][1] = boardRenderInfo.home[pos][1];
    render("board");
  }
};

const movPiece = (pos, x, y) => {
  if (boardInfo.pos[pos]) {
    boardInfo.pos[pos][0] = x;
    boardInfo.pos[pos][1] = y;
    render("board");
  }
};

/** Get house coords are over (-1 if 404) */
const getHouseOver = (x, y) => {
  const hd = boardRenderInfo.w / 2;
  for (let i = 0; i < boardRenderInfo.home.length; i++) {
    let pos = boardRenderInfo.home[i];
    let isOver = (x > pos[0] - hd && x < pos[0] + hd && y > pos[1] - hd && y < pos[1] + hd);
    if (isOver) return i;
  }
  return -1;
};

/** Are the given coords over Anubis ? */
const overAnubis = (x, y) => (x > senetBoardWidth && x < senetBoardWidth + anubisWidth && y > anubisPadding && y < anubisPadding + anubisHeight);

/**
 * Get movement message depending on code
 * @return {String} Message
*/
const getMovementMessage = code => {
  console.log("Movment Code:", code);

  // Error...
  if (code < 0) {
    if (code != -7 && code != -6) Sounds.play('error');
    switch (code) {
      case -2:
        return "Must move according to thrown score";
      case -3:
        return "A forward move is possible";
      case -4:
        return "A backward move is possible";
      case -5:
        return "The Good House is protected; cannot swap piece";
      case -6:
        Sounds.play("roll");
        return "No legal moves; go forfeited";
      case -7:
        Sounds.play("water-splash");
        return "House of Waters has claimed you...";
      case -8:
        return "Must throw a 3 to exit";
      case -9:
        return "Must throw a 2 to exit";
      case -10:
        return "Must throw a 1 to exit";
      case -11:
        return "Must visit House of Good before proceeding";
      default:
        return "Unable to move piece";
    }
  } else {
    Sounds.play("roll");
    switch (code) {
      case 2:
        Sounds.play("anubis-" + Math.floor(Math.random() * 3));
        return "A piece reached Anubis";
      default:
        return "Moved piece";
    }
  }
};