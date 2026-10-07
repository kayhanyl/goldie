import { createArgentClient } from "@swmansion/argent/client";
const c = createArgentClient();
const f = process.argv[2];
const { data } = await c.callTool<any>("flow-execute", { flow_path: f, project_root: process.cwd(), device: "1C7B0A8F-C531-4CEB-A422-19CA82A88573", prerequisiteAcknowledged: true });
console.log("flow ok:", data?.ok);
