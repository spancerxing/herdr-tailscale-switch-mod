# herdr-tailscale

![Tailscale 开关](preview.png)

一个 [Herdr](https://herdr.dev) 面板，用来开关本机的 Tailscale。点一下上线，再点一下退出，退出后重启也不会自己起来。

只支持 macOS。本仓库以 [MIT](LICENSE) 协议发布。

## 作用

Tailscale 安装后默认随系统开机起来，并一直挂在尾网上。这个开关把它改成按需使用：需要连自己的设备时才上线，用完就退出，不在后台保持登录。

## 功能

- 一个开关。关态是灰字、圆点在左；开态是字体高亮、圆点在右、底色用当前主题的 accent。
- 每 4 秒读一次真实状态。只有 `tailscaled` 在跑、并且 `BackendState` 是 `Running` 或 `Starting` 时，开关才显示为开。
- 点开：拉起系统里的 `tailscaled`，然后执行 `tailscale up --ssh --accept-dns=false`。本机加入尾网，并打开 Tailscale SSH。
- 点关：执行 `tailscale down`，从 launchd 卸掉守护进程，并把开机自启关掉。
- 每次切换都会弹出 macOS 密码框。取消密码框显示「已取消」，其他失败显示「启动失败」，开关回到点击前的状态。

## 实现原理

面板是 gpui-kit 写的 `View`（`mods/tailscale/main.js`）。它不直接改系统状态，点击时用 `osascript` 跑：

```sh
do shell script "<mod>/toggle.sh on|off" with administrator privileges
```

`toggle.sh` 以 root 执行，管的是 launchd 任务 `system/com.tailscale.tailscaled`，对应的 plist 是 `/Library/LaunchDaemons/com.tailscale.tailscaled.plist`。

开：

1. `RunAtLoad` 和 `KeepAlive` 已经是 `false` 就不再改 plist。改 plist 会唤醒系统重新加载这个任务，把刚拉起的进程顶掉。
2. 任务没加载就 `launchctl bootstrap`。
3. `launchctl kickstart`。只加载不够：`RunAtLoad` 为 `false` 时，任务会停在未初始化，`tailscale up` 没有守护进程可连。
4. 等待 `/var/run/tailscaled.socket` 出现，最多 10 秒。
5. `tailscale up --ssh --accept-dns=false --timeout=25s`。

关：

1. `tailscale down`
2. `launchctl bootout` 卸掉任务
3. 把 `RunAtLoad` 和 `KeepAlive` 设成 `false`，重启后不会自动起来

`--accept-dns=false` 是因为这台机器的 DNS 交给 Clash，不能让 Tailscale 接管 DNS。`tailscale up` 要求把已经改过的非默认项再写一遍，漏掉会直接拒绝。换一台要 MagicDNS 的机器，先改 `toggle.sh` 里这个参数。

`mod.json` 的 `place` 是 `none`。面板不会自己出现，要在布局里加一块，`content.mod` 填 `"tailscale"`。

## 配置环境

- macOS，已安装 Tailscale 命令行版本，二进制在 `/usr/local/bin/tailscale` 和 `/usr/local/bin/tailscaled`。本仓库不负责安装 Tailscale。
- 已经用 `tailscale up` 登录过一次。开关只拉起已有的登录状态，不做首次授权。
- 已安装并在运行 Herdr。

安装：

1. 把 `mods/tailscale` 拷贝到 `~/.config/herdr-app/mods/tailscale`。同名目录已存在就先改名，不要覆盖。
2. 在布局里加一块：`"content": { "mod": "tailscale" }`。
3. 跑 `herdr-app check ~/.config/herdr-app/mods/tailscale`。

## 许可证

[MIT License](LICENSE)

Copyright (c) 2026 spancerxing

可以自由使用、复制、修改和分发。保留仓库里的版权声明和许可证文本即可。软件按「原样」提供，不付任何保证。
