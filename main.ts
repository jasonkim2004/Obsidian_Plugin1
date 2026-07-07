import { Plugin } from "obsidian";

export default class ObsidianChiikawaPlugin extends Plugin {
  private boxEl: HTMLDivElement | null = null;

  async onload() {
    this.showFloatingBox();
  }

  onunload() {
    this.boxEl?.remove();
    this.boxEl = null;
  }

  private showFloatingBox() {
    this.boxEl?.remove();

    const boxEl = document.body.createDiv({
      cls: "chiikawa-floating-box",
      attr: {
        "aria-label": "Chiikawa floating box",
      },
    });

    this.boxEl = boxEl;
  }
}
