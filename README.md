# checkmyapp

[![npm version](https://img.shields.io/npm/v/checkmyapp?style=flat-square)](https://www.npmjs.com/package/checkmyapp)
[![npm downloads](https://img.shields.io/npm/dw/checkmyapp?style=flat-square)](https://www.npmjs.com/package/checkmyapp)
[![MIT license](https://img.shields.io/npm/l/checkmyapp?style=flat-square)](LICENSE)

> **Tunnel your local dev server to the internet in 0 seconds of config.**

checkmyapp is a zero‑config CLI tool that auto‑detects your dev server port, authenticates you via GitHub or Discord OAuth, and establishes a secure WebSocket tunnel — so you can share your work-in-progress with anyone, anywhere, instantly.

```bash
npm install --save-dev checkmyapp
npx checkmyapp
```

---

## Quick Start

1. **Install the package**

   ```bash
   npm install --save-dev checkmyapp
   ```

2. **Run it**

   ```bash
   npx checkmyapp
   ```

   That's it. checkmyapp spawns `npm run dev`, watches the output for a port number, opens your browser for OAuth, and prints a public URL you can share.

3. **Share the URL**

   ```
   🌍 Tunnel established!
      Public URL: https://a3b8k2x1.checkmyapp.dev
   ```

---

## How It Works

checkmyapp follows a straightforward architecture:

```
┌─────────────────────┐          WebSocket           ┌──────────────────────┐
│   Your Machine      │ ◄══════════════════════════► │   checkmyapp Server  │
│                     │     (wss://checkmyapp.dev)   │                      │
│  ┌───────────────┐  │                              │  ┌────────────────┐  │
│  │  Dev Server   │  │    HTTP proxy (localhost)     │  │  Public        │  │
│  │  (Vite, CRA,  │  │◄────────────────────────────│  │  Internet      │  │
│  │   Express…)   │  │                              │  │  (any client)  │  │
│  └───────┬───────┘  │                              │  └────────────────┘  │
│          │          │                              │                      │
│  ┌───────┴───────┐  │                              │  ┌────────────────┐  │
│  │ checkmyapp    │──│──────────────────────────────│─│  Auth + BW     │  │
│  │ CLI client    │  │                              │  │  + Subdomain   │  │
│  └───────────────┘  │                              │  └────────────────┘  │
└─────────────────────┘                              └──────────────────────┘
```

1. **Port Detection** — checkmyapp runs your dev server (`npm run dev` by default) and watches stdout / stderr for patterns like `http://localhost:5173` or `listening on port 3000`.

2. **Authentication** — Your browser opens to the checkmyapp OAuth flow (GitHub or Discord). After authorizing, a session token is stored locally in `~/.config/checkmyapp/config.json`.

3. **WebSocket Tunnel** — The CLI establishes a persistent WebSocket connection to the checkmyapp server, registers your session, and gets assigned a public subdomain.

4. **Request Proxy** — Incoming HTTP requests to `https://<subdomain>.checkmyapp.dev` are forwarded through the WebSocket to your local dev server. Responses stream back the same way.

---

## Authentication

checkmyapp uses OAuth 2.0 to verify your identity. No passwords are handled client-side.

### Supported Providers

| Provider | Command |
|----------|---------|
| GitHub   | `checkmyapp auth github` (default) |
| Discord  | `checkmyapp auth discord` |

### Flow

1. You run `checkmyapp auth` (or `checkmyapp dev` without a stored token).
2. Your browser opens to the checkmyapp server's OAuth entry point.
3. You authorize on GitHub / Discord.
4. The server redirects back to a local callback server (port 9876) with a session token.
5. The token is saved to disk. Subsequent runs reuse it until it expires.

- **Free tier sessions** expire after **60 minutes**.
- **Pro tier sessions** have **no expiry** (stay authenticated indefinitely).

---

## Pricing

| Feature              | Free                               | Pro                          |
|----------------------|------------------------------------|------------------------------|
| **Price**            | $0                                 | $5 / month                   |
| **Session duration** | 60 minutes                         | Unlimited (no expiry)        |
| **Bandwidth**        | 500 MB / day                       | 10 GB / day                  |
| **Subdomain**        | Random (e.g. `a3b8k2x1`)          | Custom subdomain             |
| **Uptime**           | Tunnel closes when CLI exits       | 24/7 persistent tunnels*     |

*Pro tunnels can run as a background service for continuous availability.

---

## Framework Compatibility

checkmyapp works with any framework that prints its port to stdout. Tested with:

- [x] **Vite** — `http://localhost:5173`
- [x] **Next.js** — `▲ Next.js 14+ on http://localhost:3000`
- [x] **Create React App (CRA)** — `Local: http://localhost:3000`
- [x] **Express** — `Server listening on port 8080`
- [x] **SvelteKit** — `Local: http://localhost:5173`
- [x] **Astro** — `▶ Local: http://localhost:4321`

If your framework uses a non‑standard port announcement format, you can pass the port explicitly via the `--` flag:

```bash
checkmyapp dev -- node my-custom-server.js
```

---

## CLI Commands

### `checkmyapp dev [-- <command> <args...>]`

Run a dev server and tunnel it. This is the **default** command.

- If no command is given, it runs `npm run dev`.
- Use `--` to pass a custom command: `checkmyapp dev -- npx vite`
- Automatically detects the port from output logs.

```bash
checkmyapp dev                           # npm run dev → tunnel
checkmyapp dev -- npx vite               # vite → tunnel
checkmyapp dev -- node server.mjs        # custom server → tunnel
```

### `checkmyapp auth [provider]`

Authenticate with an OAuth provider.

```bash
checkmyapp auth          # GitHub (default)
checkmyapp auth github   # GitHub explicitly
checkmyapp auth discord  # Discord
```

### `checkmyapp status`

Show current session information, authentication status, and configuration path.

```
📋 checkmyapp Status
  Server URL:      https://checkmyapp.dev
  Authenticated:   ✅ Yes
  Last subdomain:  a3b8k2x1
  Config file:     /home/user/.config/checkmyapp/config.json
  Node.js:         v22.0.0
  Platform:        linux
```

### `checkmyapp logout`

Clear stored credentials and configuration.

```bash
checkmyapp logout
# 🧹 Credentials cleared.
```

### `--help`, `-h`

Show usage information.

### `--version`, `-v`

Show the installed version.

---

## Configuration

The CLI persists configuration in `~/.config/checkmyapp/config.json` using the [`conf`](https://github.com/sindresorhus/conf) package.

### Environment Variables

| Variable         | Description                          | Default                  |
|------------------|--------------------------------------|--------------------------|
| `CHECKMYAPP_SERVER_URL` | URL of the checkmyapp tunnel server | `http://localhost:3000` |

When running against a production server, set it before invoking the CLI:

```bash
export CHECKMYAPP_SERVER_URL=https://checkmyapp.dev
npx checkmyapp
```

You can also change the server URL in the config file directly, though the env var takes precedence.

---

## Comparison with Alternatives

| Feature                | checkmyapp                                      | ngrok                     | localtunnel              | bore                      |
|------------------------|-------------------------------------------------|---------------------------|--------------------------|---------------------------|
| **Setup time**         | 0 config — just `npx checkmyapp`               | Auth token + config file | One command              | One command               |
| **Port detection**     | ✅ Auto-detects from stdout                    | ❌ Manual                  | ❌ Manual                 | ❌ Manual                  |
| **Auth**               | GitHub / Discord OAuth                         | Built-in (email/password) | None                     | None (public)             |
| **Free bandwidth**     | 500 MB / day                                   | 1 GB / month              | Unlimited (no SLA)       | Unlimited (no SLA)        |
| **Free session TTL**   | 60 minutes                                     | 1 hour                    | Connection‑based         | Connection‑based          |
| **Custom subdomains**  | ✅ Pro plan                                    | ✅ Paid plans             | ❌ Random only            | ❌ Random only             |
| **Pricing**            | $5/mo Pro                                      | From $8/mo                | Free / donations         | Free                      |
| **Built for devs**     | ✅ Student‑developer focused, zero‑config      | General purpose           | Simple sharing           | Minimal tunnel            |
| **Open source**        | ✅ MIT                                          | ❌ Proprietary             | ✅ MIT                    | ✅ MIT                     |

### When to choose checkmyapp

- You want **zero configuration** — just install and run.
- You value **OAuth‑based authentication** over API tokens.
- You need **generous free bandwidth** (500 MB/day vs typical 1 GB/month).
- You're a student or indie developer building and sharing prototypes.

### When to consider alternatives

- **ngrok** — if you need enterprise features (TCP tunnels, SOCKS proxy, IP restrictions, dedicated domains).
- **localtunnel** — for quick, anonymous sharing without authentication.
- **bore** — for a minimal, bare‑bones tunnel (no auth, no bandwidth limits).

---

## FAQ

### Can I use checkmyapp without installing it globally?

Yes. Install as a dev dependency and run via `npx`:

```bash
npm install --save-dev checkmyapp
npx checkmyapp
```

### What happens when my free session expires?

After 60 minutes the tunnel closes. Just run `checkmyapp dev` again to start a new session — you'll be re‑authenticated automatically if your token is still valid.

### Can I use a custom domain or subdomain?

Custom subdomains are available on the **Pro** plan ($5/mo). On the free plan you get a random subdomain like `a3b8k2x1.checkmyapp.dev`.

### How does port detection work?

checkmyapp spawns your dev server as a child process and monitors both stdout and stderr for port patterns:

- `http://localhost:\d+`
- `http://127.0.0.1:\d+`
- `port\s*:?\s*\d+`
- `listening on \d+`
- `started on \d+`
- `server running at.*:\d+`

If your framework announces its port differently, open an issue or use the `--` passthrough with an explicit command.

### Is the tunnel encrypted?

Yes. The WebSocket connection uses WSS (WebSocket Secure) when connecting to the production server. Data between your local dev server and the tunnel client is unencrypted (localhost only).

### Can I run checkmyapp on a headless server (no browser)?

Yes. When a browser can't be opened automatically, the CLI prints the OAuth URL. Copy and paste it into a browser on any machine to authenticate.

### Does checkmyapp work behind a corporate proxy?

The CLI uses standard HTTP/WebSocket libraries that respect `HTTP_PROXY`, `HTTPS_PROXY`, and `NO_PROXY` environment variables. Set them as needed for your network.

### How do I upgrade to Pro?

Authentication is handled via the server dashboard (coming soon). Pro unlocks unlimited session duration, 10 GB/day bandwidth, and custom subdomains.

### What data does checkmyapp collect?

Only the data necessary for tunnel operation: your GitHub/Discord public profile (name, email, avatar), bandwidth usage counters, and subdomain reservations. No code or request payloads are stored on the server beyond what's needed to relay them.

---

## Development

```bash
# Clone the repo
git clone https://github.com/your-org/checkmyapp.git
cd checkmyapp

# Install dependencies
npm install

# Run tests
npm test
```

### Project Structure

```
checkmyapp/
├── bin/
│   └── checkmyapp.js      # CLI entry point
├── src/
│   ├── auth.js             # OAuth client flow
│   ├── config.js           # Persistent config (conf)
│   ├── port-detection.js   # Dev server port detection
│   └── tunnel.js           # WebSocket tunnel client
└── tests/
    ├── config.test.js
    └── port-detection.test.js
```

---

## License

MIT © 2026 CheckMyApp Contributors

See [LICENSE](LICENSE) for full details.
