declare module "aplayer" {
  export default class APlayer {
    constructor(options: {
      container: HTMLElement;
      fixed?: boolean;
      mini?: boolean;
      autoplay?: boolean;
      theme?: string;
      loop?: "all" | "one" | "none";
      order?: "list" | "random";
      preload?: "none" | "metadata" | "auto";
      listFolded?: boolean;
      listMaxHeight?: number | string;
      mutex?: boolean;
      audio: Array<{
        name: string;
        artist: string;
        url: string;
        cover?: string;
        lrc?: string;
      }>;
    });
    destroy(): void;
  }
}
