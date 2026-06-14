import Anthropic from "@anthropic-ai/sdk";

// ---------------------------------------------------------------------------
// Types — kept identical to the original OpenAI-compatible interface so that
// all existing call sites (frequency.synthesize, extractLyricPhrases, etc.)
// continue to work without modification.
// ---------------------------------------------------------------------------

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4";
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

// ---------------------------------------------------------------------------
// Model — Claude Sonnet 4 for all tasks
// ---------------------------------------------------------------------------
const CLAUDE_MODEL = "claude-sonnet-4-5";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getAnthropicClient = (): Anthropic => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to Railway environment variables."
    );
  }
  return new Anthropic({ apiKey });
};

/** Extract the plain text from a content part */
const contentPartToText = (part: MessageContent): string => {
  if (typeof part === "string") return part;
  if (part.type === "text") return part.text;
  // image_url and file_url are not supported in text extraction
  return "";
};

/** Flatten MessageContent | MessageContent[] to a single string */
const flattenContent = (content: MessageContent | MessageContent[]): string => {
  if (Array.isArray(content)) {
    return content.map(contentPartToText).join("\n").trim();
  }
  return contentPartToText(content);
};

/**
 * Convert our generic Message[] to Anthropic's format.
 * - system messages are extracted separately
 * - tool/function roles are mapped to "user" with a text block
 */
const splitMessages = (
  messages: Message[]
): { system: string; anthropicMessages: Anthropic.MessageParam[] } => {
  const systemParts: string[] = [];
  const anthropicMessages: Anthropic.MessageParam[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemParts.push(flattenContent(msg.content));
      continue;
    }

    if (msg.role === "tool" || msg.role === "function") {
      // Represent tool results as a user message
      anthropicMessages.push({
        role: "user",
        content: flattenContent(msg.content),
      });
      continue;
    }

    const role = msg.role === "assistant" ? "assistant" : "user";
    anthropicMessages.push({
      role,
      content: flattenContent(msg.content),
    });
  }

  return { system: systemParts.join("\n\n"), anthropicMessages };
};

/**
 * When response_format / outputSchema requests JSON, we append an instruction
 * to the system prompt so Claude returns valid JSON matching the schema.
 */
const buildJsonInstruction = (
  params: Pick<
    InvokeParams,
    "responseFormat" | "response_format" | "outputSchema" | "output_schema"
  >
): string => {
  const fmt = params.responseFormat || params.response_format;
  const schema = params.outputSchema || params.output_schema;

  if (fmt?.type === "json_schema" && fmt.json_schema?.schema) {
    return `\n\nRespond with valid JSON only — no markdown fences, no explanation. The JSON must match this schema:\n${JSON.stringify(fmt.json_schema.schema, null, 2)}`;
  }

  if (fmt?.type === "json_object") {
    return "\n\nRespond with valid JSON only — no markdown fences, no explanation.";
  }

  if (schema?.schema) {
    return `\n\nRespond with valid JSON only — no markdown fences, no explanation. The JSON must match this schema:\n${JSON.stringify(schema.schema, null, 2)}`;
  }

  return "";
};

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const client = getAnthropicClient();

  const maxTokens =
    params.maxTokens || params.max_tokens || 4096;

  const { system, anthropicMessages } = splitMessages(params.messages);

  const jsonInstruction = buildJsonInstruction(params);
  const fullSystem = (system + jsonInstruction).trim();

  const requestParams: Anthropic.MessageCreateParamsNonStreaming = {
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    messages: anthropicMessages,
    ...(fullSystem ? { system: fullSystem } : {}),
  };

  // Tool support — convert our Tool[] to Anthropic's tool format
  if (params.tools && params.tools.length > 0) {
    requestParams.tools = params.tools.map((t) => ({
      name: t.function.name,
      description: t.function.description || "",
      input_schema: (t.function.parameters || {
        type: "object",
        properties: {},
      }) as Anthropic.Tool["input_schema"],
    }));

    const tc = params.toolChoice || params.tool_choice;
    if (tc) {
      if (tc === "none") {
        requestParams.tool_choice = { type: "auto" }; // Anthropic has no "none"; use auto
      } else if (tc === "auto") {
        requestParams.tool_choice = { type: "auto" };
      } else if (tc === "required") {
        requestParams.tool_choice = { type: "any" };
      } else if ("name" in tc) {
        requestParams.tool_choice = { type: "tool", name: tc.name };
      } else if ("function" in tc) {
        requestParams.tool_choice = { type: "tool", name: tc.function.name };
      }
    }
  }

  const response = await client.messages.create(requestParams);

  // ---------------------------------------------------------------------------
  // Map Anthropic response → InvokeResult (OpenAI-compatible shape)
  // ---------------------------------------------------------------------------
  const textContent = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const toolUseBlocks = response.content.filter(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
  );

  const toolCalls: ToolCall[] | undefined =
    toolUseBlocks.length > 0
      ? toolUseBlocks.map((b) => ({
          id: b.id,
          type: "function" as const,
          function: {
            name: b.name,
            arguments: JSON.stringify(b.input),
          },
        }))
      : undefined;

  const finishReasonMap: Record<string, string> = {
    end_turn: "stop",
    max_tokens: "length",
    tool_use: "tool_calls",
    stop_sequence: "stop",
  };

  return {
    id: response.id,
    created: Math.floor(Date.now() / 1000),
    model: response.model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: textContent,
          ...(toolCalls ? { tool_calls: toolCalls } : {}),
        },
        finish_reason: finishReasonMap[response.stop_reason ?? "end_turn"] ?? "stop",
      },
    ],
    usage: {
      prompt_tokens: response.usage.input_tokens,
      completion_tokens: response.usage.output_tokens,
      total_tokens: response.usage.input_tokens + response.usage.output_tokens,
    },
  };
}
