# checkmyapp

[![npm version](https://img.shields.io/npm/v/checkmyapp?style=flat-square)](https://www.npmjs.com/package/checkmyapp)
[![npm downloads](https://img.shields.io/npm/dw/checkmyapp?style=flat-square)](https://www.npmjs.com/package/checkmyapp)

> **Tunnel your local dev server to the internet in 0 seconds of config. A free ngrok alternative for npm projects.**

checkmyapp is a zero‑config CLI tool that auto‑detects your dev server port and establishes a secure WebSocket tunnel — so you can share your work-in-progress with anyone, anywhere, instantly.

```bash
npx checkmyapp vite       # tunnel Vite
npx checkmyapp 8080       # tunnel already-running server
npx checkmyapp            # auto-detect npm run dev
```

Your dev server is now publicly accessible at a URL like `https://a3b8k2x1.checkmyapp.online`.

Web dashboard → **[checkmyapp.online](https://checkmyapp.online)**  
Features: live tunnel status, bandwidth usage, subdomain management, [session history](https://checkmyapp.online/dashboard.html).

---

## Quick Start

### Option 1: Zero install (any project)

```bash
npx checkmyapp vite                # wrap any command, auto-detect port
npx checkmyapp python -m http.server 8080
npx checkmyapp mvn spring-boot:run # any framework
```

### Option 2: Already running

```bash
npx checkmyapp 8080                # tunnel existing server on port 8080
```

### Option 3: Permanent install (Node.js)

```bash
npm install --save-dev checkmyapp
npx checkmyapp init                # wraps your dev script
npm run dev                        # tunneled automatically
```

### Option 4: No args (Node.js only)

```bash
npx checkmyapp                     # runs npm run dev, auto-detects port
```

---

## How It Works

checkmyapp follows a straightforward architecture:

```
┌─────────────────────┐          WebSocket           ┌──────────────────────┐
│   Your Machine      │ ◄══════════════════════════► │   checkmyapp Server  │
│                     │     (wss://checkmyapp.online)   │
│  ┌───────────────┐  │                              │  ┌────────────────┐  │
│  │  Dev Server   │  │    HTTP proxy (localhost)     │  │  Public        │  │
│  │  (any stack)  │  │◄────────────────────────────│  │  Internet      │  │
│  └───────┬───────┘  │                              │  │  (any client)  │  │
│          │          │                              │  └────────────────┘  │
│  ┌───────┴───────┐  │                              │  ┌────────────────┐  │
│  │ checkmyapp    │──│──────────────────────────────│─│  Auth + BW     │  │
│  │ CLI client    │  │                              │  │  + Subdomain   │  │
│  └───────────────┘  │                              │  └────────────────┘  │
└─────────────────────┘                              └──────────────────────┘
```

1. **Port Detection** — checkmyapp runs your dev server and watches stdout/stderr for patterns like `http://localhost:5173` or `listening on port 3000`.
2. **WebSocket Tunnel** — The CLI establishes a persistent WebSocket connection to the checkmyapp server, registers your session, and gets assigned a public subdomain.
3. **Request Proxy** — Incoming HTTP requests to `https://<subdomain>.checkmyapp.online` are forwarded through the WebSocket to your local dev server.

---

## Usage

### Auto mode — detect npm run dev

```bash
checkmyapp
```
Runs `npm run dev`, detects the port from output, tunnels it.

### Dev wrap — tunnel any command

```bash
checkmyapp vite                    # runs vite, detects port
checkmyapp mvn spring-boot:run     # runs Maven, detects 8080
checkmyapp node server.js          # runs node, detects port
checkmyapp python -m http.server 8080
```

The `--` separator is optional when there are no checkmyapp flags:
```bash
checkmyapp --subdomain mysite -- vite   # with custom subdomain
```

### Port mode — tunnel an already-running server

```bash
checkmyapp 8080                     # tunnel to localhost:8080
checkmyapp 8080 --subdomain mysite  # with custom subdomain (Pro)
checkmyapp --port 8080              # explicit --port flag
```

### Authentication

```bash
checkmyapp auth github    # GitHub OAuth (default)
checkmyapp auth google    # Google OAuth
```

### Status & logout

```bash
checkmyapp status         # show session, bandwidth, config
checkmyapp logout         # clear stored credentials
```

### Init (opt-in postinstall)

```bash
checkmyapp init           # wraps your dev script with checkmyapp
```

Instead of auto-wrapping on `npm install`, run this once to opt in.

---

## Framework Compatibility

checkmyapp works with any framework that prints its port to stdout. Tested with:

- **Vite** — `http://localhost:5173`
- **Next.js** — `▲ Next.js 14+ on http://localhost:3000`
- **Express** — `Server listening on port 8080`
- **Spring Boot** — `Tomcat started on port(s): 8080`
- **Python** — `Serving HTTP on 0.0.0.0 port 8080`
- **Go** — `Listening on :8080`
- **Create React App** — `Local: http://localhost:3000`
- **SvelteKit** — `Local: http://localhost:5173`
- **Astro** — `▶ Local: http://localhost:4321`

If your framework uses a non‑standard format, use port mode:
```bash
checkmyapp 8080
```

---

## Pricing

| Feature              | Free                               | Pro                          |
|----------------------|------------------------------------|------------------------------|
| **Price**            | $0                                 | $5 / month                   |
| **Session duration** | 60 minutes                         | 24 hours                     |
| **Concurrent tunnels** | 1                                | Unlimited                    |
| **Bandwidth**        | 500 MB / day                       | 10 GB / month                |
| **Subdomain**        | Random (e.g. `a3b8k2x1`)          | 3 permanent custom subdomains|
| **Tunnel history**   | ✅ Dashboard                       | ✅ Dashboard + extended      |
| **Web dashboard**    | ✅ checkmyapp.online               | ✅ checkmyapp.online         |

Upgrade via the [web dashboard](https://checkmyapp.online/pro.html).

---

## Configuration

The CLI persists configuration in `~/.config/checkmyapp/config.json` using the [`conf`](https://github.com/sindresorhus/conf) package.

### Environment Variables

| Variable         | Description                          | Default                  |
|------------------|--------------------------------------|--------------------------|
| `CHECKMYAPP_SERVER_URL` | URL of the checkmyapp tunnel server | `https://checkmyapp.online` |
| `CHECKMYAPP_SKIP_INIT`  | Skip postinstall auto-init           | —                        |

---

## Comparison with Alternatives

| Feature                | checkmyapp                                      | ngrok                     | localtunnel               | bore                      |
|------------------------|-------------------------------------------------|---------------------------|---------------------------|---------------------------|
| **Setup time**         | 0 config — just `npx checkmyapp vite`          | Auth token + config file  | One command               | One command               |
| **Port detection**     | ✅ Auto-detects from stdout                    | ❌ Manual                  | ❌ Manual                  | ❌ Manual                  |
| **Already-running**    | ✅ `checkmyapp 8080`                           | ❌ Must specify port       | ❌ Must specify port       | ❌ Must specify port       |
| **Free bandwidth**     | 500 MB / day                                   | 1 GB / month              | Unlimited (no SLA)        | Unlimited (no SLA)        |
| **Free session TTL**   | 60 minutes                                     | 1 hour                    | Connection‑based          | Connection‑based          |
| **Custom subdomains**  | ✅ Pro plan                                    | ✅ Paid plans             | ❌ Random only             | ❌ Random only             |
| **Pricing**            | $5/mo Pro                                      | From $8/mo                | Free / donations          | Free                      |
| **Web dashboard**      | ✅ checkmyapp.online                           | ✅                        | ❌                         | ❌                         |

---

## FAQ

### Can I use checkmyapp without installing it?

Yes. `npx checkmyapp vite` — no install needed.

### What happens when my free session expires?

After 60 minutes the tunnel closes. Just run `checkmyapp` again — you'll get a new URL.

### Can I use a custom subdomain?

Yes, on the **Pro** plan ($5/mo). Free plan gets random subdomains. Upgrade via the [Pro page](https://checkmyapp.online/pro.html).

### Does checkmyapp work with Spring Boot / Go / Python?

Yes. Use `checkmyapp mvn spring-boot:run` (auto-wrap) or `checkmyapp 8080` (already running).

### How does port detection work?

checkmyapp monitors stdout/stderr for patterns:
- `http://localhost:\d+`
- `http://127.0.0.1:\d+`
- `port\s*:?\s*\d+`
- `listening on \d+`
- `started on \d+`
- `server running at.*:\d+`

### Is the tunnel encrypted?

Yes. WebSocket uses WSS. Data between your local server and the CLI is unencrypted (localhost only).

### Can I run checkmyapp on a headless server?

Yes. If no browser is available, the CLI prints the OAuth URL for manual authentication.

### How do I upgrade to Pro?

Go to [checkmyapp.online/pro.html](https://checkmyapp.online/pro.html) and authenticate. Pay via PayPal or Wise.

---

## Development

```bash
# Clone the repo
git clone https://github.com/mdasea/checkmyapp.git
cd checkmyapp

# Install dependencies
npm install

# Run all tests
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
├── scripts/
│   ├── postinstall.js      # Opt-in dev script wrapper
│   └── preuninstall.js     # Restore original dev script
└── tests/
    ├── cli.test.js          # CLI parsing & routing (52 tests)
    ├── config.test.js
    └── port-detection.test.js
```

---

## License

Proprietary. All rights reserved.

See [LICENSE](LICENSE) for full details.
