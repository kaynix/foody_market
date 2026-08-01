export interface ChannelProviderMetadata {
  provider: string;
  displayName: string;
  supportsActions: boolean;
  supportsDeepLinks: boolean;
}

export interface ChannelMessageAction {
  label: string;
  token: string;
}

export interface ChannelMessage {
  text: string;
  actions?: ChannelMessageAction[];
}

export type DecodedChannelUpdate =
  | {
      kind: 'link_confirmation';
      providerToken: string;
      destination: string;
    }
  | {
      kind: 'action';
      actionToken: string;
      destination: string;
      callbackId?: string;
    };

export interface MessagingChannelAdapter {
  readonly metadata: ChannelProviderMetadata;
  createLinkUrl(providerToken: string): string;
  decodeUpdate(update: unknown): DecodedChannelUpdate | null;
  send(destination: string, message: ChannelMessage, idempotencyKey: string): Promise<void>;
  acknowledgeAction?(callbackId: string, text: string): Promise<void>;
}

export class PermanentChannelError extends Error {
  readonly permanent = true;
}
