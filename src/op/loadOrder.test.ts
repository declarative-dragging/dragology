// Importing the op base module before anything else must work. If it
// imported (at runtime) something leading back to DragSpec.tsx, that
// would load the op modules, which would extend `Operator` before it's
// defined. See the note at the top of index.tsx.
import { expect, it } from "vitest";
import { Operator } from ".";

it("loads the op base module first", () => {
  expect(Operator).toBeDefined();
});
