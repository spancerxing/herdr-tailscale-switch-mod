import { View, div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { exec, home, openOverlay, theme } from "herdr";

const POLL = 4000;
const SCRIPT = `${home()}/.config/herdr-app/mods/tailscale/toggle.sh`;

export default class TailscaleSwitch extends View {
  init(_props, cx) {
    this.on = false;
    this.busy = false;
    this.error = "";
    cx.timer.every(POLL, (cx) => this.refresh(cx));
    this.refresh(cx);
  }

  refresh(cx) {
    if (this.busy) return;
    cx.spawn(async (cx) => {
      const svc = await exec("launchctl", ["print", "system/com.tailscale.tailscaled"]);
      const running = svc.code === 0 && /state = running/.test(svc.stdout);
      if (!running) {
        this.on = false;
        cx.notify();
        return;
      }
      const st = await exec("/usr/local/bin/tailscale", ["status", "--json"]);
      if (st.code === 0) {
        const state = JSON.parse(st.stdout).BackendState;
        this.on = state === "Running" || state === "Starting";
      }
      cx.notify();
    });
  }

  toggle(cx) {
    if (this.busy) return;
    const want = !this.on;
    this.busy = true;
    this.error = "";
    this.on = want;
    cx.notify();
    cx.spawn(async (cx) => {
      const source = `do shell script ${JSON.stringify(`${SCRIPT} ${want ? "on" : "off"}`)} with administrator privileges`;
      let failed = false;
      let detail = "";
      try {
        const r = await exec("osascript", ["-e", source], { timeout: 120000 });
        failed = r.code !== 0;
        detail = `${r.stderr || ""}\n${r.stdout || ""}`;
      } catch (e) {
        failed = true;
        detail = String(e);
      }
      this.busy = false;
      if (failed) {
        this.on = !want;
        this.error = detail.includes("User canceled") || detail.includes("-128")
          ? "\u5df2\u53d6\u6d88"
          : "\u542f\u52a8\u5931\u8d25";
      }
      cx.notify();
      this.refresh(cx);
    });
  }

  render() {
    const t = theme();
    const knob = div().size(14).rounded_full().bg(t.background);
    return v_flex()
      .size_full()
      .px(14)
      .justify_center()
      .gap(4)
      .bg(t.chrome)
      .border_t(1)
      .border_color(t.border)
      .child(
        h_flex()
          .items_center()
          .justify_between()
          .child(div().text_size(12).text_color(this.on ? t.foreground : t.dim).child("Tailscale"))
          .child(
            h_flex()
              .id("tailscale-toggle")
              .w(36)
              .h(20)
              .px(3)
              .rounded_full()
              .items_center()
              .bg(this.on ? t.accent : t.border)
              .justify_end()
              .when(!this.on, (el) => el.justify_start())
              .accessibility_label(this.on ? "Tailscale on" : "Tailscale off")
              .on_click((_e, cx) => this.toggle(cx))
              .child(knob),
          ),
      )
      .when(Boolean(this.error), (el) =>
        el.child(div().text_size(10).text_color(t.blocked).child(this.error)),
      );
  }
}
