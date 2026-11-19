export type ButtonLayout = "full" | "half";

export type ButtonActionType =
  | "submenu"
  | "url"
  | "command"
  | "join"
  | "back"
  | "custom";

export interface SimpleButton {
  text: string;
  type: "url" | "cmd" | "alert";
  value: string;
}

export interface DMUIConfig {
  customText?: string;
  buttonRows?: SimpleButton[][];
  rawButtonsText?: string;
  alerts?: Record<string, string>;
  mediaType?: "photo" | "video" | "animation" | "none";
  mediaFileId?: string;
}

export interface DMButton {
  id: string;
  text: string;
  parentMenuId: string;
  row: number;
  position: number;
  layout: ButtonLayout;
  actionType: ButtonActionType;
  actionValue: string;
}

export interface DMMenu {
  id: string;
  name: string;
  parentId?: string;
}

export interface DMUISession {
  ownerId: number;
  activeMenuId: string;
  step: string;
  tempButton?: Partial<DMButton>;
  editingButtonId?: string;
  targetMenuId?: string;
  draft: DMUIConfig;
}

export const DMUI_CONFIG_KEY = "dmui_live_config";
export const DMUI_STATE_KEY = "dmui_owner_state";
