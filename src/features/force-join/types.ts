export interface ParsedAddCommand {
  buttonName: string;
  link: string;
  explicitTarget?: string;
}

export interface ResolvedTargetChat {
  targetChat: string;
  isPrivateLink: boolean;
}
