const [major, minor] = process.versions.node.split(".").map(Number);

const isSupported =
  Number.isInteger(major) &&
  Number.isInteger(minor) &&
  (major > 20 || (major === 20 && minor >= 9)) &&
  major < 25;

if (isSupported) {
  process.exit(0);
}

console.error(
  [
    `Node ${process.versions.node} no es una version soportada para este proyecto.`,
    "Usa Node 22 LTS antes de ejecutar `npm run dev`.",
    "",
    "Opciones comunes:",
    "- Con nvm: `nvm install 22 && nvm use 22`",
    "- Con Homebrew: `brew install node@22`",
  ].join("\n")
);

process.exit(1);
