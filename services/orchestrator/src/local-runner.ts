import { handler } from "./index.js";
const loop = async () => { await handler(); setTimeout(loop, 2000); };
loop();