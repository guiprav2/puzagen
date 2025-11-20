import { XAI_KEY } from './env.js';

const CONTINUE_PROMPT =
  "If more actions are required, choose the next tool call.";

function ensureApiKey() {
  const key = XAI_KEY;
  if (!key) {
    throw new Error(
      "Missing XAI_KEY environment variable for Grok access."
    );
  }
  return key;
}

function toChatMessages(messages) {
  return messages.map(msg => {
    const role = normalizeRole(msg.role);
    const normalized = { role };

    if (msg.content !== undefined) normalized.content = normalizeContent(msg.content);
    if (msg.tool_calls) normalized.tool_calls = msg.tool_calls;
    if (msg.tool_call_id) normalized.tool_call_id = msg.tool_call_id;
    if (msg.name) normalized.name = msg.name;

    return normalized;
  });
}

function normalizeRole(role) {
  if (role === "developer") return "system";
  if (role === "ipython") return "tool";
  return role || "user";
}

function normalizeContent(content) {
  if (typeof content === "function") content = content();
  if (typeof content === "string") return content;
  if (content == null) return "";

  if (Array.isArray(content)) {
    return content
      .map(part => {
        if (typeof part === "string") return part;
        if (part?.text) return part.text;
        if (part?.input_text) return part.input_text;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  if (typeof content === "object") {
    return content.text || content.input_text || "";
  }

  return String(content);
}

function extractMessageText(content) {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map(p => p.text || "").join("\n").trim();
  }
  return content.text || "";
}

// FIXED: Do not strip required fields
function cleanTools(tools) {
  return tools().filter(Boolean).map(tool => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description || "",
      parameters: tool.parameters || {
        type: "object",
        properties: { reason: { type: 'string' } },
      },
    },
  }));
}

function safeText(result) {
  if (result == null) return "";
  if (Array.isArray(result)) return result.join("\n");
  return String(result);
}

export default async function agenticGrok(model = "grok-beta", messages = [], tools) {
  const apiKey = ensureApiKey();

  // Keep full history including tool calls
  const history = [...messages];

  async function step() {
    const toolPayload = cleanTools(tools);
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: tap(toChatMessages(history)),
        tools: toolPayload.length > 0 ? toolPayload : undefined,
        tool_choice: toolPayload.length > 0 ? "auto" : "none",
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Grok API error ${response.status}: ${text}`);
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message;
    if (!message) {
      console.error("No message in response:", data);
      return;
    }

    // Handle tool calls
    if (message.tool_calls?.length) {
      history.push({
        role: "assistant",
        content: extractMessageText(message.content),
        tool_calls: message.tool_calls,
      });

      for (const call of message.tool_calls) {
        const fn = call.function;
        const name = fn.name;
        const tool = tools().filter(Boolean).find(t => t.name === name);

        if (!tool) {
          history.push({
            role: "tool",
            tool_call_id: call.id,
            name,
            content: `Error: Tool "${name}" not found.`,
          });
          continue;
        }

        let args = {};
        try {
          args = fn.arguments ? JSON.parse(fn.arguments) : {};
        } catch (e) {
          history.push({
            role: "tool",
            tool_call_id: call.id,
            name,
            content: `Error: Invalid arguments JSON: ${fn.arguments}`,
          });
          continue;
        }

        let result;
        try {
          state.game.log = args.reason;
          d.update();
          result = await tool.handler(args);
          console.log('call:', call.function.name, args, 'res:', result);
        } catch (err) {
          result = `Error in tool ${name}: ${err.message}`;
        }

        if (result === "done") return "done";

        history.push({
          role: "tool",
          tool_call_id: call.id,
          name,
          content: safeText(result),
        });
      }

      return await step(); // Continue loop
    }

    // Final assistant message
    const text = extractMessageText(message.content) || "";
    if (text) { state.game.log = text; d.update() }

    history.push({ role: "assistant", content: text });

    // Ask if more tools needed
    history.push({ role: "user", content: CONTINUE_PROMPT });

    return await step();
  }

  return await step();
}
