import { configureAxe } from "vitest-axe";

// jsdom has no CSS engine — disable rules that require visual rendering
configureAxe({
  globalOptions: {
    rules: [
      { id: "color-contrast", enabled: false },
      { id: "landmark-one-main", enabled: false },
      { id: "region", enabled: false },
    ],
  },
});
