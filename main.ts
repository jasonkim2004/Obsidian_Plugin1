import { Plugin } from "obsidian";

export default class ObsidianChiikawaPlugin extends Plugin {
  private boxEl: HTMLDivElement | null = null;
  private isDragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;

  async onload() {
    this.showFloatingBox();
  }

  onunload() {
    this.stopDragging();
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

    this.registerDomEvent(boxEl, "mousedown", (event) => {
      this.startDragging(event);
    });
    this.registerDomEvent(document, "mousemove", (moveEvent) => {
      this.dragBox(moveEvent);
    });
    this.registerDomEvent(document, "mouseup", () => {
      this.stopDragging();
    });
  }

  private startDragging(event: MouseEvent) {
    if (!this.boxEl || event.button !== 0) {
      return;
    }

    const boxRect = this.boxEl.getBoundingClientRect();

    this.isDragging = true;
    this.dragOffsetX = event.clientX - boxRect.left;
    this.dragOffsetY = event.clientY - boxRect.top;
    this.boxEl.addClass("is-dragging");

    event.preventDefault();
  }

  private dragBox(event: MouseEvent) {
    if (!this.boxEl || !this.isDragging) {
      return;
    }

    const nextX = event.clientX - this.dragOffsetX;
    const nextY = event.clientY - this.dragOffsetY;

    this.boxEl.style.left = `${nextX}px`;
    this.boxEl.style.top = `${nextY}px`;
  }

  private stopDragging() {
    this.isDragging = false;
    this.boxEl?.removeClass("is-dragging");
  }
}
