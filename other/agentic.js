import { OPENAI_API_KEY } from './env.js';

let tap = x => (console.log(x), x);

export default async function agentic(model, messages, tools) {
  async function step() {
    let ctools = buildCleanTools(tools);
    await new Promise(pres => setTimeout(pres, 200));
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(tap({
        model,
        input: messages.map(x => {
          if (typeof x.content === 'function') return { ...x, content: x.content() };
          return x;
        }),
        tools: ctools,
        tool_choice: "auto",
      })),
    });

    const data = await response.json();
    if (!data.output) {
      console.error("Invalid API response:", data);
      return;
    }

    for (const item of data.output) {
      // -----------------------------------------
      // 🔧 TOOL CALL
      // -----------------------------------------
      if (item.type === "tool_call" || item.type === "function_call") {
        const calls = item.tool_calls ?? [item];

        for (const call of calls) {
          const args = typeof call.arguments === "string"
            ? JSON.parse(call.arguments)
            : call.arguments;

            const tool = tools().filter(Boolean).find(t => t.name === call.name);

          if (!tool) {
            messages.push({
              role: "developer",
              content: [{ type: "input_text", text: `Unknown tool: ${call.name}` }],
            });
            return await step();
          }

          // 🧠 EXECUTE TOOL HANDLER
          let result = await tool.handler(args);
          console.log('call:', call.name, args, 'res:', result);

          // -----------------------------------------
          // 🛑 SPECIAL EXIT SIGNAL
          // -----------------------------------------
          if (result === "done") {
            return "done";
          }

          // -----------------------------------------
          // ➕ Inject results into messages array
          // -----------------------------------------
          messages.push({
            role: "developer",
            content: [
              {
                type: "input_text",
                text: Array.isArray(result) ? result.join('\n') : result,
              },
            ],
          });
        }

        return await step();
      }

      // -----------------------------------------
      // 🗣️ MODEL-NARRATION
      // -----------------------------------------
      if (item.type === "output_text" || item.type === "message") {
        const text = item.content?.[0]?.text ?? "";
        //console.log(text);
        messages.push({
          role: "user",
          content: [
            {
              type: "input_text",
              text: "If more actions are required, choose the next tool call.",
            },
          ],
        });
        return await step();
      }
    }
  }

  return await step();
}

function buildCleanTools(toolsWithHandlers) {
  return toolsWithHandlers().filter(Boolean).map(t => {
    return JSON.parse(
      JSON.stringify(
        {
          type: t.type,
          name: t.name,
          description: t.description,
          parameters: t.parameters,
          required: t.required,
        },
        (key, value) => {
          if (key === "handler") return undefined;
          if (key === "enum" && typeof value === "function") return value();
          if (typeof value === "function") return undefined;
          return value;
        }
      )
    );
  });
}
