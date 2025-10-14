import "./style.css";

const h1 = document.createElement("h1");
h1.textContent = "Sticker Sketchpad";

const canvas = document.createElement("canvas");
canvas.width = 256;
canvas.height = 256;

document.body.append(h1, canvas);
