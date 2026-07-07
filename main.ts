import { App, Menu, Plugin, PluginSettingTab, Setting, TFile } from "obsidian";

interface ObsidianChiikawaSettings {
  boxX: number;
  boxY: number;
  imagePath: string;
  imageWidth: number;
}

interface PluginManagerApp extends App {
  plugins: {
    disablePlugin(pluginId: string): Promise<void>;
  };
}

const DEFAULT_SETTINGS: ObsidianChiikawaSettings = {
  boxX: 160,
  boxY: 160,
  imagePath: "",
  imageWidth: 0,
};

export default class ObsidianChiikawaPlugin extends Plugin {
  private boxEl: HTMLDivElement | null = null;
  private imageEl: HTMLImageElement | null = null;
  private resizeHandleEl: HTMLDivElement | null = null;
  private isDragging = false;
  private isResizing = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private resizeStartX = 0;
  private resizeStartWidth = 0;
  private pluginSettings: ObsidianChiikawaSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();
    this.showFloatingBox();
    this.addSettingTab(new ObsidianChiikawaSettingTab(this.app, this));
  }

  onunload() {
    this.stopDragging();
    this.boxEl?.remove();
    this.boxEl = null;
    this.imageEl = null;
    this.resizeHandleEl = null;
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
    this.imageEl = boxEl.createEl("img", {
      cls: "chiikawa-floating-image",
      attr: {
        alt: "Chiikawa floating image",
      },
    });
    this.resizeHandleEl = boxEl.createDiv({
      cls: "chiikawa-resize-handle",
      attr: {
        "aria-label": "Resize floating image",
      },
    });

    this.applyBoxPosition();
    this.applyImageSource();

    this.registerDomEvent(boxEl, "mousedown", (event) => {
      this.startDragging(event);
    });
    this.registerDomEvent(boxEl, "click", (event) => {
      this.selectImage(event);
    });
    this.registerDomEvent(this.resizeHandleEl, "mousedown", (event) => {
      this.startResizing(event);
    });
    this.registerDomEvent(boxEl, "contextmenu", (event) => {
      this.showContextMenu(event);
    });
    this.registerDomEvent(document, "mousemove", (moveEvent) => {
      this.dragBox(moveEvent);
      this.resizeImage(moveEvent);
    });
    this.registerDomEvent(document, "mouseup", () => {
      this.stopDragging();
      this.stopResizing();
    });
    this.registerDomEvent(document, "mousedown", (event) => {
      this.deselectImageWhenClickingOutside(event);
    });
  }

  private startDragging(event: MouseEvent) {
    if (
      !this.boxEl ||
      event.button !== 0 ||
      event.target === this.resizeHandleEl
    ) {
      return;
    }

    const boxRect = this.boxEl.getBoundingClientRect();

    this.isDragging = true;
    this.dragOffsetX = event.clientX - boxRect.left;
    this.dragOffsetY = event.clientY - boxRect.top;
    this.boxEl.addClass("is-dragging");

    event.preventDefault();
  }

  private startResizing(event: MouseEvent) {
    if (!this.boxEl || !this.imageEl || event.button !== 0) {
      return;
    }

    const imageRect = this.imageEl.getBoundingClientRect();

    this.isResizing = true;
    this.resizeStartX = event.clientX;
    this.resizeStartWidth = imageRect.width;
    this.boxEl.addClass("is-resizing");

    event.preventDefault();
    event.stopPropagation();
  }

  private selectImage(event: MouseEvent) {
    if (!this.boxEl?.hasClass("has-image")) {
      return;
    }

    this.boxEl.addClass("is-selected");
    event.stopPropagation();
  }

  private deselectImageWhenClickingOutside(event: MouseEvent) {
    if (!this.boxEl || this.boxEl.contains(event.target as Node)) {
      return;
    }

    this.boxEl.removeClass("is-selected");
  }

  private showContextMenu(event: MouseEvent) {
    if (!this.boxEl?.hasClass("has-image")) {
      return;
    }

    event.preventDefault();

    const menu = new Menu();

    menu.addItem((item) => {
      item
        .setTitle("Rollback to original size")
        .setIcon("reset")
        .onClick(async () => {
          await this.rollbackImageSize();
        });
    });
    menu.addSeparator();
    menu.addItem((item) => {
      item
        .setTitle("Turn off plugin")
        .setIcon("power")
        .onClick(async () => {
          await this.turnOffPlugin();
        });
    });

    const boxRect = this.boxEl.getBoundingClientRect();

    menu.showAtPosition({
      x: boxRect.left,
      y: boxRect.top,
    });
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

  private resizeImage(event: MouseEvent) {
    if (!this.imageEl || !this.isResizing) {
      return;
    }

    const widthDelta = event.clientX - this.resizeStartX;
    const nextWidth = Math.max(24, this.resizeStartWidth + widthDelta);

    this.imageEl.style.width = `${nextWidth}px`;
    this.imageEl.style.height = "auto";
  }

  private async stopDragging() {
    const shouldSavePosition = this.isDragging && this.boxEl;

    this.isDragging = false;
    this.boxEl?.removeClass("is-dragging");

    if (shouldSavePosition) {
      await this.saveBoxPosition();
    }
  }

  private async stopResizing() {
    const shouldSaveSize = this.isResizing && this.imageEl;

    this.isResizing = false;
    this.boxEl?.removeClass("is-resizing");

    if (shouldSaveSize) {
      await this.saveImageSize();
    }
  }

  applyImageSource() {
    if (!this.imageEl) {
      return;
    }

    const imageSource = this.getImageSource();

    this.boxEl?.removeClass("has-image");
    this.boxEl?.removeClass("is-selected");
    this.imageEl.style.display = "none";
    this.imageEl.removeAttribute("src");

    if (!imageSource) {
      return;
    }

    this.imageEl.onload = () => {
      if (this.imageEl) {
        this.boxEl?.addClass("has-image");
        this.applyImageSize();
        this.imageEl.style.display = "block";
      }
    };

    this.imageEl.onerror = () => {
      if (this.imageEl) {
        this.boxEl?.removeClass("has-image");
        this.imageEl.style.display = "none";
      }
    };

    this.imageEl.src = imageSource;
  }

  private applyImageSize() {
    if (!this.imageEl) {
      return;
    }

    if (this.pluginSettings.imageWidth > 0) {
      this.imageEl.style.width = `${this.pluginSettings.imageWidth}px`;
      this.imageEl.style.height = "auto";
      return;
    }

    this.imageEl.style.removeProperty("width");
    this.imageEl.style.removeProperty("height");
  }

  private getImageSource(): string | null {
    const imagePath = this.pluginSettings.imagePath.trim();

    if (!imagePath) {
      return null;
    }

    if (
      imagePath.startsWith("file://") ||
      imagePath.startsWith("http://") ||
      imagePath.startsWith("https://")
    ) {
      return imagePath;
    }

    const imageFile = this.app.vault.getAbstractFileByPath(imagePath);

    if (!(imageFile instanceof TFile)) {
      return null;
    }

    return this.app.vault.getResourcePath(imageFile);
  }

  private applyBoxPosition() {
    if (!this.boxEl) {
      return;
    }

    this.boxEl.style.left = `${this.pluginSettings.boxX}px`;
    this.boxEl.style.top = `${this.pluginSettings.boxY}px`;
  }

  private async saveBoxPosition() {
    if (!this.boxEl) {
      return;
    }

    const boxRect = this.boxEl.getBoundingClientRect();

    this.pluginSettings.boxX = boxRect.left;
    this.pluginSettings.boxY = boxRect.top;

    await this.saveSettings();
  }

  private async saveImageSize() {
    if (!this.imageEl) {
      return;
    }

    const imageRect = this.imageEl.getBoundingClientRect();

    this.pluginSettings.imageWidth = imageRect.width;

    await this.saveSettings();
  }

  private async rollbackImageSize() {
    this.pluginSettings.imageWidth = 0;
    await this.saveSettings();
    this.applyImageSize();
  }

  private async turnOffPlugin() {
    await (this.app as PluginManagerApp).plugins.disablePlugin(this.manifest.id);
  }

  private async loadSettings() {
    this.pluginSettings = {
      ...DEFAULT_SETTINGS,
      ...(await this.loadData()),
    };
  }

  async updateImagePath(imagePath: string) {
    this.pluginSettings.imagePath = imagePath.trim();
    await this.saveSettings();
    this.applyImageSource();
  }

  getImagePath() {
    return this.pluginSettings.imagePath;
  }

  private async saveSettings() {
    await this.saveData(this.pluginSettings);
  }
}

class ObsidianChiikawaSettingTab extends PluginSettingTab {
  plugin: ObsidianChiikawaPlugin;

  constructor(app: App, plugin: ObsidianChiikawaPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;

    containerEl.empty();

    new Setting(containerEl)
      .setName("Image path")
      .setDesc("Vault-relative path, for example: Attachments/chiikawa.png")
      .addText((text) => {
        text
          .setPlaceholder("Attachments/chiikawa.png")
          .setValue(this.plugin.getImagePath())
          .onChange(async (value) => {
            await this.plugin.updateImagePath(value);
          });
      });
  }
}
