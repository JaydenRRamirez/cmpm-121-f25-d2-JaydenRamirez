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
let current: "marker" | "sticker" = "marker";
let stickerSelect: string = "\u{1F603}";

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
    if (!cursor.active && current === "marker") {
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

class stickerPreview {
  private x: number;
  private y: number;
  private sticker: string;
  private fontSize: number = 24;

  constructor(x: number, y: number, sticker: string) {
    this.x = x;
    this.y = y;
    this.sticker = sticker;
  }

  public display(ctx: CanvasRenderingContext2D): void {
    if (!cursor.active && current === "sticker") {
      ctx.font = `${this.fontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.globalAlpha = 0.6;
      ctx.fillText(this.sticker, this.x, this.y);
      ctx.globalAlpha = 1.0;
    }
  }

  public updatePosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  public updateSticker(sticker: string): void {
    this.sticker = sticker;
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

class stickerPlacement {
  private x: number;
  private y: number;
  private sticker: string;
  private fontSize: number = 32;

  constructor(x: number, y: number, sticker: string) {
    this.x = x;
    this.y = y;
    this.sticker = sticker;
  }

  public drag(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  public display(ctx: CanvasRenderingContext2D): void {
    ctx.font = `${this.fontSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.sticker, this.x, this.y);
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

function updateToolPreview() {
  if (current === "marker") {
    if (!(toolPreview instanceof markerPreview)) {
      toolPreview = new markerPreview(0, 0, desiredThickness);
    }

    if (toolPreview instanceof markerPreview) {
      toolPreview.updateThickness(desiredThickness);
    }
  } else if (current === "sticker") {
    if (!(toolPreview instanceof stickerPreview)) {
      toolPreview = new stickerPreview(0, 0, stickerSelect);
    }

    if (toolPreview instanceof stickerPreview) {
      toolPreview.updateSticker(stickerSelect);
    }
  }
}

updateToolPreview();

toolPreview = new markerPreview(0, 0, desiredThickness);

canvas.addEventListener("tool-moved", redraw);
canvas.addEventListener("drawing-changed", redraw);

canvas.addEventListener("mousedown", (e) => {
  redoStack.length = 0;
  cursor.active = true;
  const initialPoint = { x: e.offsetX, y: e.offsetY };

  let newCommand: drawingCommand;

  if (current === "marker") {
    newCommand = new markerLine(initialPoint, desiredThickness);
  } else {
    newCommand = new stickerPlacement(
      initialPoint.x,
      initialPoint.y,
      stickerSelect,
    );
  }

  lines.push(newCommand);

  if (current === "sticker") {
    canvas.dispatchEvent(new CustomEvent("drawing-changed"));
  } else {
    canvas.dispatchEvent(new CustomEvent("tool-moved"));
  }
});

canvas.addEventListener("mousemove", (e) => {
  if (toolPreview instanceof markerPreview && current === "marker") {
    toolPreview.updatePosition(e.offsetX, e.offsetY);
    canvas.dispatchEvent(new CustomEvent("tool-moved"));
  } else if (toolPreview instanceof stickerPreview && current === "sticker") {
    toolPreview.updatePosition(e.offsetX, e.offsetY);
    canvas.dispatchEvent(new CustomEvent("tool-moved"));
  }

  if (cursor.active && lines.length > 0) {
    const currentCommand = lines[lines.length - 1];

    if (currentCommand instanceof markerLine) {
      currentCommand.drag(e.offsetX, e.offsetY);
      canvas.dispatchEvent(new CustomEvent("drawing-changed"));
    } else if (currentCommand instanceof stickerPlacement) {
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

const markerGroup = document.createElement("div");
markerGroup.textContent = "Marker: ";
toolSelect.append(markerGroup);

const thinMarker = document.createElement("button");
thinMarker.textContent = "thin";
thinMarker.classList.add("tool-button", "selectedTool");
markerGroup.append(thinMarker);

const thickMarker = document.createElement("button");
thickMarker.textContent = "thick";
thickMarker.classList.add("tool-button");
markerGroup.append(thickMarker);

function tool(thickness: number, selectedButton: HTMLButtonElement) {
  desiredThickness = thickness;
  current = "marker";
  updateToolPreview();

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

const stickerGroup = document.createElement("div");
stickerGroup.textContent = "Stickers: ";
toolSelect.append(stickerGroup);

interface stickerData {
  emoji: string;
  name: string;
  element?: HTMLButtonElement;
}

const stickerChoices: stickerData[] = [
  { emoji: "\u{1F603}", name: "Smile" },
  { emoji: "\u{1F47E}", name: "Alien Monster" },
  { emoji: "\u{1F49C}", name: "Purple Heart" },
];

const utilityButtonContainer = document.createElement("div");
utilityButtonContainer.classList.add("utility-buttons");
document.body.append(utilityButtonContainer);

function selectStickerTool(emoji: string, selectedButton: HTMLButtonElement) {
  stickerSelect = emoji;
  current = "sticker";
  updateToolPreview();

  if (toolPreview instanceof stickerPreview) {
    toolPreview.updateSticker(emoji);
  }

  document.querySelectorAll(".tool-button").forEach((btn) => {
    btn.classList.remove("selectedTool");
  });

  selectedButton.classList.add("selectedTool");
  canvas.dispatchEvent(new CustomEvent("tool-moved"));
}

function renderStickerButton() {
  const existingButtons = stickerGroup.querySelectorAll(".sticker-button");
  existingButtons.forEach((btn) => btn.remove());

  stickerChoices.forEach((stickerData) => {
    const stickerButton = document.createElement("button");
    stickerButton.textContent = stickerData.emoji;
    stickerButton.title = stickerData.name;
    stickerButton.classList.add("tool-button", "sticker-button");
    stickerData.element = stickerButton;
    stickerGroup.append(stickerButton);

    stickerButton.addEventListener("click", () => {
      selectStickerTool(stickerData.emoji, stickerButton);
    });
  });
}

renderStickerButton();

const customStickerButton = document.createElement("button");
customStickerButton.textContent = "📝 Custom";
customStickerButton.classList.add("tool-button");
stickerGroup.append(customStickerButton);

customStickerButton.addEventListener("click", () => {
  const newStickerText = prompt(
    "Enter custom sticker (either text or emoji):",
  );

  if (newStickerText && newStickerText.trim().length > 0) {
    const newSticker: stickerData = {
      emoji: newStickerText.trim(),
      name: `Custom Sticker: ${newStickerText.trim().length > 0}`,
    };

    stickerChoices.push(newSticker);

    renderStickerButton();

    const newButton = newSticker.element;

    if (newButton) {
      selectStickerTool(newSticker.emoji, newButton);
    }
  }
});

const clearButton = document.createElement("button");
clearButton.textContent = "clear";
utilityButtonContainer.append(clearButton);

clearButton.addEventListener("click", () => {
  redoStack.length = 0;
  lines.length = 0;
  canvas.dispatchEvent(new CustomEvent("drawing-changed"));
});

const undoButton = document.createElement("button");
undoButton.textContent = "undo";
utilityButtonContainer.append(undoButton);

const redoButton = document.createElement("button");
redoButton.textContent = "redo";
utilityButtonContainer.append(redoButton);

undoButton.addEventListener("click", undo);
redoButton.addEventListener("click", redo);

tool(0.5, thinMarker);
redraw();
