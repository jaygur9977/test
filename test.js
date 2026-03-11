const express = require('express');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.static('public'));

let browser = null;
const userSessions = new Map();

// Browser setup
async function getBrowser() {
    if (!browser) {
        browser = await chromium.launch({
            // Cloud servers ke liye headless hamesha true hona chahiye
            headless: true, 
            // 'channel: chrome' hata kar default chromium use karein
            args: [
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage' // Memory crash se bachne ke liye
            ]
        });
    }
    return browser;
}

// Logic to wait for stable text (from your script)
async function waitStable(page) {
    let lastText = '';
    let stable = 0;
    while (stable < 4) {
        const text = await page.evaluate(() => {
            const blocks = document.querySelectorAll('[data-message-author-role="assistant"]');
            if (!blocks.length) return '';
            const lastBlock = blocks[blocks.length - 1];
            const content = lastBlock.querySelector('.markdown') || lastBlock;
            return content.innerText.trim();
        });
        if (text && text === lastText) stable++;
        else stable = 0;
        lastText = text;
        await page.waitForTimeout(600);
    }
    return lastText;
}

app.post('/chat', async (req, res) => {
    const { userId, message } = req.body;
    let session = userSessions.get(userId);

    try {
        if (!session) {
            const b = await getBrowser();
            const context = await b.newContext();
            const page = await context.newPage();
            await page.goto('https://chatgpt.com/');
            session = { page, context };
            userSessions.set(userId, session);
            await page.waitForSelector('#prompt-textarea');
        }

        const { page } = session;
        await page.fill('#prompt-textarea', message);
        await page.keyboard.press('Enter');

        const reply = await waitStable(page);
        res.json({ success: true, reply });
    } catch (err) {
        res.json({ success: false, reply: "Automation Error: " + err.message });
    }
});

app.listen(3000, () => console.log('🚀 Web Interface: http://localhost:3000'));