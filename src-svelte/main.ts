import "@app/app.css";
import App from "@app/App.svelte";
import { mount } from "svelte";

const target = document.getElementById("root") as HTMLElement | null;
if (!target) {
  throw new Error("App root element not found");
}

// Clear boot placeholder injected by index.html before mounting Svelte app.
target.innerHTML = "";

mount(App, { target });
