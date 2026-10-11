import net from "node:net";
import tls from "node:tls";
import { config } from "../config.js";

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

// Minimal SMTP client (implicit TLS on 465, plain otherwise) — no dependency.
function smtpSend(mail: Mail): Promise<void> {
  const { host, port, user, pass, from } = config.smtp;
  return new Promise((resolve, reject) => {
    const socket =
      port === 465 ? tls.connect({ host, port, servername: host }) : net.connect({ host, port });
    socket.setTimeout(15000, () => socket.destroy(new Error("SMTP timeout")));
    socket.setEncoding("utf8");

    let buffer = "";
    let waiter: ((code: number, text: string) => void) | null = null;
    socket.on("data", (chunk: string) => {
      buffer += chunk;
      // A reply is complete when its last line is "NNN text" (no dash).
      const lines = buffer.split("\r\n");
      const last = lines.filter(Boolean).at(-1);
      if (buffer.endsWith("\r\n") && last && /^\d{3} /.test(last) && waiter) {
        const w = waiter;
        waiter = null;
        const text = buffer;
        buffer = "";
        w(Number(last.slice(0, 3)), text);
      }
    });
    socket.on("error", reject);

    const reply = () =>
      new Promise<{ code: number; text: string }>((res) => {
        waiter = (code, text) => res({ code, text });
      });
    const cmd = async (line: string | null, expect: number[]) => {
      const p = reply();
      if (line !== null) socket.write(`${line}\r\n`);
      const { code, text } = await p;
      if (!expect.includes(code)) throw new Error(`SMTP unexpected reply: ${text.trim()}`);
    };
    const b64 = (v: string) => Buffer.from(v).toString("base64");
    const fromAddr = /<([^>]+)>/.exec(from)?.[1] ?? from;
    const safe = (v: string) => v.replace(/[\r\n]+/g, " ");

    (async () => {
      await cmd(null, [220]);
      await cmd("EHLO complianceos", [250]);
      if (user) {
        await cmd("AUTH LOGIN", [334]);
        await cmd(b64(user), [334]);
        await cmd(b64(pass), [235]);
      }
      await cmd(`MAIL FROM:<${fromAddr}>`, [250]);
      await cmd(`RCPT TO:<${safe(mail.to)}>`, [250, 251]);
      await cmd("DATA", [354]);
      const body = mail.text.replace(/^\./gm, "..").replace(/\r?\n/g, "\r\n");
      await cmd(
        `From: ${from}\r\nTo: ${safe(mail.to)}\r\nSubject: ${safe(mail.subject)}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}\r\n.`,
        [250]
      );
      await cmd("QUIT", [221]);
    })()
      .then(resolve, reject)
      .finally(() => socket.destroy());
  });
}

// Sends an email. With no SMTP configured, logs it to the console so local
// development works without a mail server. Never throws: callers must not
// leak delivery failures (user enumeration) or fail a request over email.
export async function sendMail(mail: Mail): Promise<void> {
  if (!config.smtp.host) {
    console.log(`[mailer] (no SMTP configured) to=${mail.to} subject="${mail.subject}"\n${mail.text}`);
    return;
  }
  try {
    await smtpSend(mail);
  } catch (err) {
    console.error("mail delivery failed:", err);
  }
}
