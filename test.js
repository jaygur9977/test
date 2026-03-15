const express = require("express");
const puppeteer = require("puppeteer-extra");
const Stealth = require("puppeteer-extra-plugin-stealth");

puppeteer.use(Stealth());

const app = express();
app.use(express.json());
app.use(express.static("public"));

/* ---------- STATE MANAGEMENT ---------- */
let clients = [];
let browser = null;
let page = null;
let busy = false;

function sendStep(step, message, error = false) {
    const payload = JSON.stringify({ step, message, error });
    clients.forEach(c => c.write(`data: ${payload}\n\n`));
}

/* ---------- SSE ENDPOINT ---------- */
app.get("/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    clients.push(res);
    req.on("close", () => {
        clients = clients.filter(c => c !== res);
    });
});

/* ---------- BROWSER LOGIC ---------- */
async function startBrowser() {
    if (browser) return;

    sendStep(3, "Opening Gemini");
    const path = require('path');

browser = await puppeteer.launch({
    headless: "new",
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null, // Render ke liye zaroori
    args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--single-process"
    ]
});

    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    // Set a realistic User Agent
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");

    await page.goto("https://gemini.google.com/", { waitUntil: "networkidle2" });
    console.log("Gemini is ready");
}

async function getReply() {
    let previous = "";
    let stable = 0;
    
    // Gemini specific response selector
    const selector = ".model-response-text";

    for (let i = 0; i < 30; i++) { // Max 30 seconds wait
        const text = await page.evaluate((sel) => {
            const elements = document.querySelectorAll(sel);
            return elements.length ? elements[elements.length - 1].innerText : "";
        }, selector);

        if (text && text === previous && text.length > 0) {
            stable++;
        } else {
            stable = 0;
        }

        if (stable >= 5) break; // Response is stable
        previous = text;
        await new Promise(r => setTimeout(r, 1000));
    }
    return previous;
}

/* ---------- CHAT ENDPOINT ---------- */
app.post("/chat", async (req, res) => {
    if (busy) return res.json({ reply: "AI is busy processing..." });
    const { message } = req.body;

    try {
        busy = true;
        sendStep(2, "Prompt sent to server");

        await startBrowser();

        // 1. Wait for the Prompt Box (Quill Editor)
        const promptSelector = 'div[role="textbox"][aria-label*="Gemini"]';
        await page.waitForSelector(promptSelector, { timeout: 60000 });

        // 2. Click and Type (Bypassing TrustedHTML by using Keyboard API)
        await page.click(promptSelector);
        
        // Clear box first (just in case)
        await page.keyboard.down('Control');
        await page.keyboard.press('A');
        await page.keyboard.up('Control');
        await page.keyboard.press('Backspace');

        // Type the message
        await page.keyboard.type(message, { delay: 20 });
        sendStep(4, "Prompt injected successfully");

        // 3. Click Send Button
        const sendButton = 'button[aria-label*="Send"]';
        await page.waitForSelector(sendButton + ':not([disabled])');
        await page.click(sendButton);

        sendStep(5, "Gemini is thinking...");
        const reply = await getReply();

        sendStep(6, "Response captured");
        busy = false;
        res.json({ reply });

    } catch (e) {
        busy = false;
        console.error("ERROR:", e);
        sendStep("error", e.message, true);
        res.json({ reply: "Error: " + e.message });
    }
});

/* ---------- CLEANUP ---------- */
app.post("/destroy", async (req, res) => {
    if (browser) {
        await browser.close();
        browser = null;
        page = null;
    }
    res.json({ status: "destroyed" });
});

app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});
