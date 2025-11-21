/**
 * Local dev runner for the orchestrator handler.
 * This is NOT used in Lambda packaging; it's just a simple loop that
 * calls the main handler with a dummy event so you can exercise logic
 * while developing locally.
 */

import { handler } from "./index";

// Simple loop that invokes the handler every 2 seconds with a dummy event.
const loop = async () => {
  try {
    await handler({} as any);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in local orchestrator runner:", err);
  } finally {
    setTimeout(loop, 2000);
  }
};

// Start the loop if this module is executed directly.
void loop();
