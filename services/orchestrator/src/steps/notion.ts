export async function exportToNotion(args: { title: string; markdown: string; pageId?: string }): Promise<string | undefined> {
  const token = process.env.LFLBK_NOTION_TOKEN;
  const parent = process.env.LFLBK_NOTION_PARENT;
  if (!token || !parent) {
    console.warn("[notion] token or parent not set; skipping.");
    return;
  }
  const headers = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28"
  };
  if (!args.pageId) {
    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers,
      body: JSON.stringify({
        parent: { type: "page_id", page_id: parent },
        properties: { title: { title: [{ type: "text", text: { content: args.title } }] } },
        children: [
          { object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: args.markdown } }] } }
        ]
      })
    });
    const j = await res.json();
    if (!res.ok) throw new Error("Notion create failed: " + JSON.stringify(j));
    return j.id;
  } else {
    // Append a paragraph to existing page
    const res = await fetch(`https://api.notion.com/v1/blocks/${args.pageId}/children", {
      method: "PATCH", headers, body: JSON.stringify({ children: [{ object:"block", type:"paragraph", paragraph:{ rich_text:[{ type:"text", text:{ content: args.markdown } }] } }] }) });
    if (!res.ok) console.warn("[notion] update response", await res.text());
    return args.pageId;
  }
}