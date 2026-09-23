// SPEC: _spec/_plans/chess-ui-primitives.puml
import type { Preview } from "storybook-solidjs-vite";
import { UiProvider } from "../src/UiProvider";
import "./preview.css";

export default {
  globalTypes: {
    product: {
      description: "Product appearance",
      toolbar: { icon: "paintbrush", items: ["chess", "starchess"] },
    },
  },
  initialGlobals: { product: "chess" },
  decorators: [
    (Story, context) => (
      <UiProvider product={context.globals.product === "starchess" ? "starchess" : "chess"}>
        <Story />
      </UiProvider>
    ),
  ],
  parameters: {
    layout: "padded",
    viewport: {
      options: {
        desktop: { name: "Desktop", styles: { width: "1280px", height: "900px" }, type: "desktop" },
        mobile: { name: "Mobile", styles: { width: "390px", height: "844px" }, type: "mobile" },
        dynamic: {
          name: "Short mobile",
          styles: { width: "560px", height: "420px" },
          type: "mobile",
        },
      },
    },
  },
} satisfies Preview;
