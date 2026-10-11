// A binary the model should look at (page image, screenshot, PDF).
export interface Attachment {
  kind: "image" | "document";
  /** e.g. image/png, image/jpeg, application/pdf */
  mediaType: string;
  data: Buffer;
  name?: string;
}

export interface CompletionRequest {
  system?: string;
  prompt: string;
  maxTokens?: number;
  /** 0 for extraction / verification calls that must be repeatable. */
  temperature?: number;
  /** Images / documents sent alongside the prompt (vision-capable providers only). */
  attachments?: Attachment[];
}

export interface AIProvider {
  complete(req: CompletionRequest): Promise<string>;
  embed(text: string): Promise<number[]>;
  /** Model id reported in audit trails / IngestedFile.passAModel. */
  readonly modelId?: string;
}
