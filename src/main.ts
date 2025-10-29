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
let desiredRotation: number = 0;
let canvasRotation: number = 0;

let toolPreview: drawingCommand | null = null;

interface drawingCommand {
  display(ctx: CanvasRenderingContext2D): void;
}

class markerPreview {
  private x: number;
  private y: number;
  private thickness: number;
  private colorHue: number = 0;

  constructor(x: number, y: number, thickness: number, colorHue: number) {
    this.x = x;
    this.y = y;
    this.thickness = thickness;
    this.colorHue = colorHue;
  }

  public display(ctx: CanvasRenderingContext2D): void {
    if (!cursor.active && current === "marker") {
      ctx.fillStyle = `hsl(${this.colorHue}, 70%, 50%)`;
      ctx.strokeStyle = "rgba(128, 128, 128, 0.8)";
      ctx.lineWidth = 1;
      const radius = this.thickness / 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, radius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    }
  }

  public updatePosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  public updateThickness(thickness: number): void {
    this.thickness = thickness;
  }

  public updateColorHue(hue: number): void {
    this.colorHue = hue;
  }
}

class stickerPreview {
  private x: number;
  private y: number;
  private sticker: string;
  private fontSize: number = 24;
  private rotation: number;

  constructor(x: number, y: number, sticker: string, rotation: number = 0) {
    this.x = x;
    this.y = y;
    this.sticker = sticker;
    this.rotation = rotation;
  }

  public display(ctx: CanvasRenderingContext2D): void {
    if (!cursor.active && current === "sticker") {
      ctx.save();
      ctx.font = `${this.fontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.globalAlpha = 0.6;
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation * (Math.PI / 180));

      ctx.fillText(this.sticker, 0, 0);

      ctx.globalAlpha = 1.0;
      ctx.restore();
    }
  }

  public updatePosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  public updateSticker(sticker: string): void {
    this.sticker = sticker;
  }

  public updateRotation(rotation: number): void {
    this.rotation = rotation;
  }
}

class markerLine {
  private points: Point[] = [];
  private thickness: number;
  private colorHue: number;

  constructor(initialPoint: Point, thickness: number, colorHue: number) {
    this.points.push(initialPoint);
    this.thickness = thickness;
    this.colorHue = colorHue;
  }

  public drag(x: number, y: number): void {
    this.points.push({ x, y });
  }

  public display(ctx: CanvasRenderingContext2D): void {
    if (this.points.length === 0) return;

    const scale = ctx.canvas.width / 256;

    ctx.lineWidth = this.thickness * scale;
    ctx.strokeStyle = `hsl(${this.colorHue}, 80%, 40%)`;

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
  private baseFontSize: number = 32;
  private rotation: number;

  constructor(x: number, y: number, sticker: string, rotation: number) {
    this.x = x;
    this.y = y;
    this.sticker = sticker;
    this.rotation = rotation;
  }

  public drag(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  public display(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const scale = ctx.canvas.width / 256;
    const fontSize = this.baseFontSize * scale;

    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation * (Math.PI / 180));

    ctx.fillText(this.sticker, 0, 0);
    ctx.restore();
  }
}

function getUnrotatedPoint(x: number, y: number): Point {
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;

  const tx = x - cx;
  const ty = y - cy;

  const angleRad = -canvasRotation * (Math.PI / 180);
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  const rx = tx * cos - ty * sin;
  const ry = tx * sin + ty * cos;

  const newX = rx + cx;
  const newY = ry + cy;

  return { x: newX, y: newY };
}

function redraw() {
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;

  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(canvasRotation * (Math.PI / 180));
  ctx.translate(-cx, -cy);

  lines.forEach((command) => {
    command.display(ctx);
  });

  if (toolPreview) {
    toolPreview.display(ctx);
  }

  ctx.restore();
}

function updateToolPreview() {
  if (current === "marker") {
    if (!(toolPreview instanceof markerPreview)) {
      toolPreview = new markerPreview(0, 0, desiredThickness, desiredRotation);
    }

    if (toolPreview instanceof markerPreview) {
      toolPreview.updateThickness(desiredThickness);
      toolPreview.updateColorHue(desiredRotation);
    }
  } else if (current === "sticker") {
    if (!(toolPreview instanceof stickerPreview)) {
      toolPreview = new stickerPreview(0, 0, stickerSelect, desiredRotation);
    }

    if (toolPreview instanceof stickerPreview) {
      toolPreview.updateSticker(stickerSelect);
      toolPreview.updateRotation(desiredRotation);
    }
  }
}

updateToolPreview();

canvas.addEventListener("tool-moved", redraw);
canvas.addEventListener("drawing-changed", redraw);

canvas.addEventListener("mousedown", (e) => {
  redoStack.length = 0;
  cursor.active = true;

  const initialPoint = getUnrotatedPoint(e.offsetX, e.offsetY);

  let newCommand: drawingCommand;

  if (current === "marker") {
    newCommand = new markerLine(
      initialPoint,
      desiredThickness,
      desiredRotation,
    );
  } else {
    newCommand = new stickerPlacement(
      initialPoint.x,
      initialPoint.y,
      stickerSelect,
      desiredRotation,
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
  const transformedPoint = getUnrotatedPoint(e.offsetX, e.offsetY);

  if (toolPreview instanceof markerPreview && current === "marker") {
    toolPreview.updatePosition(transformedPoint.x, transformedPoint.y);
    canvas.dispatchEvent(new CustomEvent("tool-moved"));
  } else if (toolPreview instanceof stickerPreview && current === "sticker") {
    toolPreview.updatePosition(transformedPoint.x, transformedPoint.y);
    canvas.dispatchEvent(new CustomEvent("tool-moved"));
  }

  if (cursor.active && lines.length > 0) {
    const currentCommand = lines[lines.length - 1];

    if (currentCommand instanceof markerLine) {
      currentCommand.drag(transformedPoint.x, transformedPoint.y);
      canvas.dispatchEvent(new CustomEvent("drawing-changed"));
    } else if (currentCommand instanceof stickerPlacement) {
      currentCommand.drag(transformedPoint.x, transformedPoint.y);
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

const sliderContainer = document.createElement("div");
sliderContainer.textContent = "Canvas Rotation (°): ";
document.body.append(sliderContainer);

const propertySlider = document.createElement("input");
propertySlider.type = "range";
propertySlider.min = "0";
propertySlider.max = "360";
propertySlider.value = canvasRotation.toString();
sliderContainer.append(propertySlider);

const sliderValueDisplay = document.createElement("span");
sliderValueDisplay.textContent = `${canvasRotation}°`;
sliderContainer.append(sliderValueDisplay);

propertySlider.addEventListener("input", (e) => {
  const value = parseInt((e.target as HTMLInputElement).value);

  canvasRotation = value;
  sliderValueDisplay.textContent = `${canvasRotation}°`;

  canvas.dispatchEvent(new CustomEvent("drawing-changed"));
});

const toolPropertyContainer = document.createElement("div");
toolPropertyContainer.textContent = "Tool Property: ";
document.body.append(toolPropertyContainer);

const toolPropertySlider = document.createElement("input");
toolPropertySlider.type = "range";
toolPropertySlider.min = "0";
toolPropertySlider.max = "360";
toolPropertySlider.value = desiredRotation.toString();
toolPropertyContainer.append(toolPropertySlider);

const toolPropertyValueDisplay = document.createElement("span");
toolPropertyValueDisplay.textContent = `Hue: ${desiredRotation}`;
toolPropertyContainer.append(toolPropertyValueDisplay);

toolPropertySlider.addEventListener("input", (e) => {
  const value = parseInt((e.target as HTMLInputElement).value);

  desiredRotation = value;

  if (current === "sticker") {
    if (toolPreview instanceof stickerPreview) {
      toolPreview.updateRotation(desiredRotation);
    }
    toolPropertyValueDisplay.textContent = `${desiredRotation}°`;
  } else if (current === "marker") {
    if (toolPreview instanceof markerPreview) {
      toolPreview.updateColorHue(desiredRotation);
    }
    toolPropertyValueDisplay.textContent = `Hue: ${desiredRotation}`;
  }

  canvas.dispatchEvent(new CustomEvent("tool-moved"));
});

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

  toolPropertyValueDisplay.textContent = `Hue: ${desiredRotation}`;

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

  toolPropertyValueDisplay.textContent = `${desiredRotation}°`;

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

const exportButton = document.createElement("button");
exportButton.textContent = "Export 🖼️";
utilityButtonContainer.append(exportButton);

exportButton.addEventListener("click", () => {
  const exportSize = 1024;
  const scaleFactor = exportSize / canvas.width;

  const highResCanvas = document.createElement("canvas");
  highResCanvas.width = exportSize;
  highResCanvas.height = exportSize;
  const highResCtx = highResCanvas.getContext("2d")!;
  const cx = highResCanvas.width / 2;
  const cy = highResCanvas.height / 2;
  highResCtx.save();
  highResCtx.translate(cx, cy);
  highResCtx.rotate(canvasRotation * (Math.PI / 180));
  highResCtx.translate(-cx, -cy);

  highResCtx.scale(scaleFactor, scaleFactor);
  highResCtx.clearRect(0, 0, exportSize, exportSize);

  lines.forEach((command) => {
    command.display(highResCtx);
  });

  highResCtx.restore();

  const anchor = document.createElement("a");
  anchor.href = highResCanvas.toDataURL("image/png");
  anchor.download = "sticker-sketchpad-highres.png";
  anchor.click();
});

tool(0.5, thinMarker);
redraw();
