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