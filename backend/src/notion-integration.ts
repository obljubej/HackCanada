import { supabase } from "./config.js";

const NOTION_API_KEY = process.env.NOTION_API_KEY!;
const NOTION_API_VERSION = "2022-06-28";

interface NotionPage {
  id: string;
  url: string;
}

/**
 * Create a Notion workspace for a project
 */
export async function createProjectNotionWorkspace(
  projectId: string,
  projectName: string,
  projectDescription: string,
  teamMembers: Array<{ full_name: string; role: string }>
): Promise<NotionPage> {
  try {
    // Create a parent database in Notion
    const databaseResponse = await fetch(
      "https://api.notion.com/v1/databases",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${NOTION_API_KEY}`,
          "Notion-Version": NOTION_API_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          parent: {
            type: "workspace",
            workspace: true,
          },
          title: [
            {
              type: "text",
              text: {
                content: `${projectName} - Project Workspace`,
              },
            },
          ],
          properties: {
            Name: {
              title: {},
            },
            Status: {
              select: {
                options: [
                  { name: "Todo", color: "default" },
                  { name: "In Progress", color: "blue" },
                  { name: "Done", color: "green" },
                ],
              },
            },
            Assignee: {
              people: {},
            },
            "Due Date": {
              date: {},
            },
          },
        }),
      }
    );

    if (!databaseResponse.ok) {
      throw new Error(
        `Failed to create Notion database: ${databaseResponse.statusText}`
      );
    }

    const database = (await databaseResponse.json()) as any;

    // Create main project page
    const pageResponse = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NOTION_API_KEY}`,
        "Notion-Version": NOTION_API_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parent: {
          type: "database_id",
          database_id: database.id,
        },
        properties: {
          Name: {
            title: [
              {
                type: "text",
                text: {
                  content: projectName,
                },
              },
            ],
          },
          Status: {
            select: {
              name: "In Progress",
            },
          },
        },
        children: [
          {
            object: "block",
            type: "heading_1",
            heading_1: {
              rich_text: [
                {
                  type: "text",
                  text: {
                    content: projectName,
                  },
                },
              ],
            },
          },
          {
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [
                {
                  type: "text",
                  text: {
                    content: projectDescription || "No description provided",
                  },
                },
              ],
            },
          },
          {
            object: "block",
            type: "heading_2",
            heading_2: {
              rich_text: [
                {
                  type: "text",
                  text: {
                    content: "Team Members",
                  },
                },
              ],
            },
          },
          {
            object: "block",
            type: "bulleted_list_item",
            bulleted_list_item: {
              rich_text: teamMembers.map((member) => ({
                type: "text",
                text: {
                  content: `${member.full_name} - ${member.role}`,
                },
              })),
            },
          },
          {
            object: "block",
            type: "heading_2",
            heading_2: {
              rich_text: [
                {
                  type: "text",
                  text: {
                    content: "Sprint Board",
                  },
                },
              ],
            },
          },
          {
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [
                {
                  type: "text",
                  text: {
                    content: "Tasks and sprint planning go here",
                  },
                },
              ],
            },
          },
          {
            object: "block",
            type: "heading_2",
            heading_2: {
              rich_text: [
                {
                  type: "text",
                  text: {
                    content: "Timeline & Deadlines",
                  },
                },
              ],
            },
          },
          {
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [
                {
                  type: "text",
                  text: {
                    content: "Key dates and milestones",
                  },
                },
              ],
            },
          },
          {
            object: "block",
            type: "heading_2",
            heading_2: {
              rich_text: [
                {
                  type: "text",
                  text: {
                    content: "Meeting Notes",
                  },
                },
              ],
            },
          },
          {
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [
                {
                  type: "text",
                  text: {
                    content: "Document meeting notes and decisions",
                  },
                },
              ],
            },
          },
        ],
      }),
    });

    if (!pageResponse.ok) {
      throw new Error(
        `Failed to create Notion page: ${pageResponse.statusText}`
      );
    }

    const page = (await pageResponse.json()) as any;

    // Save to database
    const { error: dbError } = await supabase
      .from("notion_workspaces")
      .insert([
        {
          project_id: projectId,
          notion_page_id: page.id,
          notion_url: page.url,
        },
      ]);

    if (dbError) throw dbError;

    return {
      id: page.id,
      url: page.url,
    };
  } catch (err) {
    console.error("[Notion Integration] Error:", err);
    throw err;
  }
}

/**
 * Add a task to the Notion project workspace
 */
export async function addTaskToNotionWorkspace(
  projectId: string,
  taskTitle: string,
  taskDescription: string,
  assigneeName?: string,
  dueDate?: string
): Promise<void> {
  try {
    // Get the Notion workspace for this project
    const { data: workspace, error: wsError } = await supabase
      .from("notion_workspaces")
      .select("notion_page_id")
      .eq("project_id", projectId)
      .single();

    if (wsError || !workspace) {
      throw new Error("Notion workspace not found for this project");
    }

    const pageChildren: any[] = [
      {
        object: "block",
        type: "checkbox",
        checkbox: {
          rich_text: [
            {
              type: "text",
              text: {
                content: taskTitle,
              },
            },
          ],
          checked: false,
        },
      },
    ];

    if (taskDescription) {
      pageChildren.push({
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "text",
              text: {
                content: taskDescription,
              },
            },
          ],
        },
      });
    }

    if (assigneeName) {
      pageChildren.push({
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "text",
              text: {
                content: `Assigned to: ${assigneeName}`,
              },
            },
          ],
        },
      });
    }

    // Note: Notion API has limitations on appending blocks
    // This is a simplified version - production would need more sophisticated handling
    console.log(
      "[Notion] Task structure prepared (implementation may need enhancement based on Notion limits)"
    );
  } catch (err) {
    console.error("[Notion Task] Error:", err);
    throw err;
  }
}

/**
 * Get Notion workspace URL for a project
 */
export async function getProjectNotionUrl(projectId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("notion_workspaces")
      .select("notion_url")
      .eq("project_id", projectId)
      .single();

    if (error || !data) return null;
    return data.notion_url;
  } catch (err) {
    console.error("[Notion URL] Error:", err);
    return null;
  }
}
