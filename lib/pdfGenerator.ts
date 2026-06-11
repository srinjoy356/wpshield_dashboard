import { spawn } from "child_process";
import path from "path";

export async function generatePdfBuffer(reportData: any): Promise<Buffer> {
  const scriptPath = path.join(process.cwd(), "scripts", "generate_report.py");

  return new Promise<Buffer>((resolve, reject) => {
    try {
      const chunks: Buffer[] = [];
      const errorChunks: Buffer[] = [];
      const pythonCmd = process.platform === "win32" ? "python" : "python3";
      const python = spawn(pythonCmd, [scriptPath], {
        env: { ...process.env, PYTHONUNBUFFERED: "1" },
      });

      const killTimer = setTimeout(() => {
        python.kill("SIGKILL");
        reject(new Error("PDF generation timed out after 30 seconds"));
      }, 30000);
      
      python.stdout.on("data", (chunk) => {
        chunks.push(chunk);
      });
      
      python.stderr.on("data", (chunk) => {
        errorChunks.push(chunk);
      });
      
      python.on("close", (code) => {
        clearTimeout(killTimer);
        if (code !== 0) {
          const errorMsg = Buffer.concat(errorChunks).toString();
          reject(new Error(`PDF generation failed: ${errorMsg}`));
          return;
        }
        resolve(Buffer.concat(chunks));
      });

      python.on("error", (err) => {
        reject(new Error(`PDF generation failed to spawn: ${err.message}`));
      });
      
      python.stdin.write(JSON.stringify(reportData));
      python.stdin.end();
    } catch (err: any) {
      reject(new Error(`PDF generation failed during setup: ${err.message}`));
    }
  });
}
