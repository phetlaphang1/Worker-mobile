import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import { fileURLToPath } from 'url';
import { nanoid } from "nanoid";
import { URL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const viteConfigPath = new URL('file://' + path.join(process.cwd(), 'vite.config.ts'));
  const viteConfig = await import(viteConfigPath.toString());

  const vite = await createViteServer({
    ...viteConfig.default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      info(msg) {
        log(msg, "vite");
      },
      warn(msg) {
        log(msg, "vite");
      },
      error(msg) {
        log(msg, "vite");
      },
    },
    server: {
      middlewareMode: true,
      hmr: {
        server,
        port: 24678,
      },
    },
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        __dirname,
        "..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const staticPath = path.join(process.cwd(), 'dist', 'public');
  if (!fs.existsSync(staticPath)) {
    throw new Error(
      `Could not find the build directory: ${staticPath}, make sure to build the client first`
    );
  }

  app.use(express.static(staticPath));
  app.use('*', (_, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });
}
