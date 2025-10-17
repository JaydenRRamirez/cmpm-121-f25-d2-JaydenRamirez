import "./style.css";

const h1 = document.createElement("h1");
h1.textContent = "Sticker Sketchpad";
document.body.append(h1);

const canvas = document.createElement("canvas");
canvas.width = 256;
canvas.height = 256;
document.body.append(canvas);

const ctx = canvas.getContext("2d")!;
ctx.lineWidth = 2;
type Point = { x: number; y: number };
const lines: Point[][] = [];
const cursor = { active: false, x: 0, y: 0 };
const redoStack: Point[][] = [];

function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  lines.forEach((line) => {
    if (line.length === 0) return;
    const first = line[0]!;
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);

    for (let i = 1; i < line.length; i++) {
      const point = line[i]!;
      ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
  });
}

canvas.addEventListener("drawing-changed", redraw);

canvas.addEventListener("mousedown", (e) => {
  redoStack.length = 0;
  cursor.active = true;
  const newPoint = { x: e.offsetX, y: e.offsetY };
  lines.push([newPoint]);
  canvas.dispatchEvent(new CustomEvent("drawing-changed"));
});

canvas.addEventListener("mousemove", (e) => {
  if (cursor.active && lines.length > 0) {
    const newPoint = { x: e.offsetX, y: e.offsetY };
    lines[lines.length - 1]!.push(newPoint);
    canvas.dispatchEvent(new CustomEvent("drawing-changed"));
  }
});

canvas.addEventListener("mouseup", () => {
  cursor.active = false;
});

const clearButton = document.createElement("button");
clearButton.textContent = "clear";
document.body.append(clearButton);

clearButton.addEventListener("click", () => {
  redoStack.length = 0;
  lines.length = 0;
  canvas.dispatchEvent(new CustomEvent("drawing-changed"));
});

function undo() {
  if (lines.length > 0) {
    const lastAction = lines.pop();

    if (lastAction) {
      redoStack.push(lastAction);
      canvas.dispatchEvent(new CustomEvent("drawing-changed"));
    }
  }
}

function redo() {
  if (redoStack.length > 0) {
    const undone = redoStack.pop();

    if (undone) {
      lines.push(undone);
      canvas.dispatchEvent(new CustomEvent("drawing-changed"));
    }
  }
}

const undoButton = document.createElement("button");
undoButton.textContent = "undo";
document.body.append(undoButton);

const redoButton = document.createElement("button");
redoButton.textContent = "redo";
document.body.append(redoButton);

undoButton.addEventListener("click", undo);
redoButton.addEventListener("click", redo);
