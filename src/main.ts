import "./style.css";

const h1 = document.createElement("h1");
h1.textContent = "Sticker Sketchpad";
document.body.append(h1);

const canvas = document.createElement("canvas");
canvas.width = 256;
canvas.height = 256;
document.body.append(canvas);

const ctx = canvas.getContext("2d")!;
type Point = { x: number; y: number };
const lines: drawingCommand[] = [];
const cursor = { active: false, x: 0, y: 0 };
const redoStack: drawingCommand[] = [];
let desiredThickness: number = 2;

let toolPreview: drawingCommand | null = null;

interface drawingCommand {
  display(ctx: CanvasRenderingContext2D): void;
}

class markerPreview {
  private x: number;
  private y: number;
  private thickness: number;

  constructor(x: number, y: number, thickness: number) {
    this.x = x;
    this.y = y;
    this.thickness = thickness;
  }

  public display(ctx: CanvasRenderingContext2D): void {
    if (!cursor.active) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.thickness / 2, 0, 2 * Math.PI);
      ctx.fillStyle = "rgba(128, 128, 128, 0.6)";
      ctx.fill();
    }
  }

  public updatePosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  public updateThickness(thickness: number): void {
    this.thickness = thickness;
  }
}

class markerLine {
  private points: Point[] = [];
  private thickness: number;

  constructor(initialPoint: Point, thickness: number) {
    this.points.push(initialPoint);
    this.thickness = thickness;
  }

  public drag(x: number, y: number): void {
    this.points.push({ x, y });
  }

  public display(ctx: CanvasRenderingContext2D): void {
    if (this.points.length === 0) return;

    ctx.lineWidth = this.thickness;
    ctx.strokeStyle = "black";

    const first = this.points[0]!;
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);

    for (let i = 1; i < this.points.length; i++) {
      const point = this.points[i];
      ctx.lineTo(point!.x, point!.y);
    }
    ctx.stroke();
  }
}

function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  lines.forEach((command) => {
    command.display(ctx);
  });

  if (toolPreview) {
    toolPreview.display(ctx);
  }
}

toolPreview = new markerPreview(0, 0, desiredThickness);

canvas.addEventListener("tool-moved", redraw);
canvas.addEventListener("drawing-changed", redraw);

canvas.addEventListener("mousedown", (e) => {
  redoStack.length = 0;
  cursor.active = true;
  const initialPoint = { x: e.offsetX, y: e.offsetY };

  const newLine = new markerLine(initialPoint, desiredThickness);
  lines.push(newLine);

  canvas.dispatchEvent(new CustomEvent("tool-moved"));
});

canvas.addEventListener("mousemove", (e) => {
  if (toolPreview instanceof markerPreview) {
    toolPreview.updatePosition(e.offsetX, e.offsetY);
    canvas.dispatchEvent(new CustomEvent("tool-moved"));
  }
  if (cursor.active && lines.length > 0) {
    const currentCommand = lines[lines.length - 1];

    if (currentCommand instanceof markerLine) {
      currentCommand.drag(e.offsetX, e.offsetY);
      canvas.dispatchEvent(new CustomEvent("drawing-changed"));
    }
  }
});

canvas.addEventListener("mouseup", () => {
  cursor.active = false;
  canvas.dispatchEvent(new CustomEvent("tool-moved"));
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

const toolSelect = document.createElement("div");
toolSelect.classList.add("tool-select");
document.body.append(toolSelect);

const thinMarker = document.createElement("button");
thinMarker.textContent = "thin";
thinMarker.classList.add("tool-button", "selectedTool");
toolSelect.append(thinMarker);

const thickMarker = document.createElement("button");
thickMarker.textContent = "thick";
thickMarker.classList.add("tool-button");
toolSelect.append(thickMarker);

function tool(thickness: number, selectedButton: HTMLButtonElement) {
  desiredThickness = thickness;

  if (toolPreview instanceof markerPreview) {
    toolPreview.updateThickness(thickness);
  }

  document.querySelectorAll(".tool-button").forEach((btn) => {
    btn.classList.remove("selectedTool");
  });

  selectedButton.classList.add("selectedTool");

  canvas.dispatchEvent(new CustomEvent("tool-moved"));
}

thinMarker.addEventListener("click", () => {
  tool(0.5, thinMarker);
});

thickMarker.addEventListener("click", () => {
  tool(5, thickMarker);
});

const clearButton = document.createElement("button");
clearButton.textContent = "clear";
document.body.append(clearButton);

clearButton.addEventListener("click", () => {
  redoStack.length = 0;
  lines.length = 0;
  canvas.dispatchEvent(new CustomEvent("drawing-changed"));
});

const undoButton = document.createElement("button");
undoButton.textContent = "undo";
document.body.append(undoButton);

const redoButton = document.createElement("button");
redoButton.textContent = "redo";
document.body.append(redoButton);

undoButton.addEventListener("click", undo);
redoButton.addEventListener("click", redo);
