// const express = require("express")
// const puppeteer = require("puppeteer-extra")
// const Stealth = require("puppeteer-extra-plugin-stealth")

// puppeteer.use(Stealth())

// const app = express()

// app.use(express.json())
// app.use(express.static("public"))

// /* ---------- GLOBAL ERROR LOGGING ---------- */

// process.on("uncaughtException", (err) => {
//  console.error("UNCAUGHT EXCEPTION:", err)
// })

// process.on("unhandledRejection", (err) => {
//  console.error("UNHANDLED REJECTION:", err)
// })

// app.use((req,res,next)=>{
//  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`)
//  next()
// })

// /* ---------- BROWSER STATE ---------- */

// let browser = null
// let page = null
// let busy = false
// let lastActivity = Date.now()

// function touch(){
//  lastActivity = Date.now()
// }

// /* ---------- START BROWSER ---------- */

// async function startBrowser(){

//  if(browser) return

//  console.log("Launching browser...")

//  browser = await puppeteer.launch({
//   headless:true,
//   args:[
//    "--no-sandbox",
//    "--disable-setuid-sandbox",
//    "--disable-dev-shm-usage",
//    "--single-process",
//    "--no-zygote"
//   ]
//  })

//  page = await browser.newPage()

//  await page.setViewport({
//   width:1280,
//   height:800
//  })

//  await page.setUserAgent(
//   "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36"
//  )

//  await page.goto("https://chatgpt.com/",{
//   waitUntil:"domcontentloaded"
//  })

//  await page.screenshot({path:"debug.png"})

//  console.log("Browser ready")
// }

// /* ---------- SCRAPE RESPONSE ---------- */

// async function getReply(){

//  let previous=""
//  let stable=0

//  while(stable<5){

//   const text = await page.evaluate(()=>{

//    const blocks=document.querySelectorAll(
//     '[data-message-author-role="assistant"]'
//    )

//    if(!blocks.length) return ""

//    return blocks[blocks.length-1].innerText

//   })

//   if(text===previous){
//    stable++
//   }else{
//    stable=0
//   }

//   previous=text

//   await new Promise(r=>setTimeout(r,800))
//  }

//  return previous
// }

// /* ---------- CHAT ENDPOINT ---------- */

// app.post("/chat", async(req,res)=>{

//  if(busy){
//   return res.json({reply:"AI busy"})
//  }

//  const {message} = req.body

//  try{

//   busy=true
//   touch()

//   await startBrowser()

//   await page.waitForSelector("textarea",{timeout:60000})

//   await page.click("textarea")

//   await page.type("textarea",message,{
//    delay:40+Math.random()*60
//   })

//   await page.keyboard.press("Enter")

//   const reply = await getReply()

//   busy=false

//   res.json({reply})

//  }catch(e){

//   busy=false

//   console.error("AUTOMATION ERROR:",e)

//   res.json({reply:"automation error"})
//  }
// })

// /* ---------- DESTROY SESSION ---------- */

// app.post("/destroy", async(req,res)=>{

//  try{

//   if(browser){

//    console.log("Destroying browser session")

//    await browser.close()

//    browser=null
//    page=null
//   }

//   res.json({status:"destroyed"})

//  }catch(e){

//   console.log("Destroy error",e)

//   res.json({status:"error"})
//  }

// })

// /* ---------- HEALTH CHECK ---------- */

// app.get("/ping",(req,res)=>{
//  res.send("alive")
// })

// /* ---------- AUTO CLEANUP ---------- */

// setInterval(async()=>{

//  if(browser && Date.now()-lastActivity > 600000){

//   console.log("Closing inactive browser")

//   await browser.close()

//   browser=null
//   page=null

//  }

// },60000)

// /* ---------- START SERVER ---------- */

// app.listen(3000,()=>{
//  console.log("Server running on port 3000")
// })





const express = require("express")
const puppeteer = require("puppeteer-extra")
const Stealth = require("puppeteer-extra-plugin-stealth")
require('dotenv').config();

puppeteer.use(Stealth())

const app = express()

app.use(express.json())
app.use(express.static("public"))

/* ---------- GLOBAL ERROR LOGGING ---------- */

process.on("uncaughtException", (err)=>{
 console.error("UNCAUGHT:",err)
})

process.on("unhandledRejection",(err)=>{
 console.error("UNHANDLED:",err)
})

app.use((req,res,next)=>{
 console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`)
 next()
})

/* ---------- SSE CLIENTS ---------- */

let clients=[]

function sendStep(step,message,error=false){

 const payload = JSON.stringify({
  step,
  message,
  error
 })

 clients.forEach(c=>{
  c.write(`data: ${payload}\n\n`)
 })

}

/* ---------- EVENT STREAM ---------- */

app.get("/events",(req,res)=>{

 res.setHeader("Content-Type","text/event-stream")
 res.setHeader("Cache-Control","no-cache")
 res.setHeader("Connection","keep-alive")

 clients.push(res)

 req.on("close",()=>{
  clients = clients.filter(c=>c!==res)
 })

})

/* ---------- BROWSER STATE ---------- */

let browser=null
let page=null
let busy=false
let lastActivity=Date.now()

function touch(){
 lastActivity = Date.now()
}

/* ---------- START BROWSER ---------- */

async function startBrowser() {
  if (browser && page) return; // Agar pehle se connect hai toh wapas mat karo

  sendStep(3, "Connecting to Browserless");
  
  try {
    const token = process.env.BROWSERLESS_TOKEN;
    if (!token) throw new Error("BROWSERLESS_TOKEN is missing in Render environment variables");

    browser = await puppeteer.connect({
      browserWSEndpoint: `wss://chrome.browserless.io?token=${token}`,
    });

    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");

    console.log("Navigating to ChatGPT...");
    await page.goto("https://chatgpt.com/", {
      waitUntil: "networkidle2",
      timeout: 60000 
    });
     await page.screenshot({path:"debug.png"})

    console.log("Browserless connection ready");
  } catch (err) {
    console.error("Browserless Connection Error:", err.message);
    
    // Zaroori: Reset variables on failure
    browser = null;
    page = null;
    
    sendStep("error", `Cloud Connection Failed: ${err.message}`, true);
    
    // Sabse zaroori: Error ko throw karein taaki /chat endpoint ruk jaye
    throw err; 
  }
}

/* ---------- CHAT ENDPOINT ---------- */
app.post("/chat", async (req, res) => {
  if (busy) return res.json({ reply: "AI busy" });

  const { message } = req.body;

  try {
    busy = true;
    touch();

    sendStep(2, "Prompt sent");

    await startBrowser();

  // ... startBrowser() ke baad ...

    const promptSelector = 'textarea';
    await page.waitForSelector(promptSelector, { timeout: 60000 });
    await new Promise(r => setTimeout(r, 1000)); // Thoda extra wait

    // Injection aur Click ek saath
    await page.evaluate((sel, msg) => {
      const el = document.querySelector(sel);
      if (el) {
        el.focus();
        el.value = msg;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        
        // Enter maarne ke bajaye 'Send' button dhoond kar click karo (Zyada safe hai)
        setTimeout(() => {
          const buttons = document.querySelectorAll('button');
          const sendBtn = Array.from(buttons).find(b => b.querySelector('svg') || b.getAttribute('data-testid') === 'send-button');
          if (sendBtn) sendBtn.click();
        }, 500);
      }
    }, promptSelector, message);

    // Enter press ko backup ki tarah rakhein agar button na mile
    await new Promise(r => setTimeout(r, 1000));
    try {
        await page.keyboard.press("Enter");
    } catch (e) {
        console.log("Keyboard failed, but evaluate might have worked");
    }
     await page.screenshot({path:"debug3.png"})

    sendStep(5, "Fetching result");
    const reply = await getReply();

    sendStep(6, "Output generated");
    busy = false;
    console.log("Sending to UI:", reply);
    res.json({ reply });
     await page.screenshot({path:"debug4.png"})

  } catch (e) {
    busy = false;
    console.error("AUTOMATION ERROR:", e.message);

    // Agar session crash hua hai toh objects reset karein
    if (e.message.includes("Protocol error") || e.message.includes("Target closed")) {
      browser = null;
      page = null;
    }

    sendStep("error", e.message, true);
    res.json({ reply: `Error: ${e.message}` });
  }
});
/* ---------- SCRAPE RESPONSE ---------- */

async function getReply() {
    let previous = "";
    let stable = 0;
    let attempts = 0;

    while (stable < 5 && attempts < 30) {
        // ZAROORI: Check karein ki page crash toh nahi hua
        if (!page || page.isClosed()) {
            console.log("LOG: Page closed during scraping!");
            return previous || "Error: Session Closed";
        }

        try {
            const text = await page.evaluate(() => {
                // ChatGPT ke multiple selectors check karein
                const selectors = ['[data-message-author-role="assistant"]', '.markdown', '.prose'];
                for (let s of selectors) {
                    const el = document.querySelectorAll(s);
                    if (el.length) return el[el.length - 1].innerText.trim();
                }
                return "";
            });

            if (text !== "" && text === previous) {
                stable++;
            } else if (text !== "") {
                stable = 0;
                console.log("ChatGPT typing... length:", text.length);
            }
            previous = text;
        } catch (err) {
            console.log("Evaluate failed in getReply:", err.message);
            break; 
        }

        attempts++;
        await new Promise(r => setTimeout(r, 1000));
    }
    return previous;
}

/* ---------- DESTROY SESSION ---------- */

app.post("/destroy",async(req,res)=>{

 try{

  if(browser){

   console.log("Destroying session")

   await browser.close()
    await page.screenshot({path:"debug6.png"})

   browser=null
   page=null

  }

  res.json({status:"destroyed"})

 }catch(e){

  console.log(e)

  res.json({status:"error"})
 }

})

/* ---------- HEALTH CHECK ---------- */

app.get("/ping",(req,res)=>{
 res.send("alive")
})

/* ---------- AUTO CLEANUP ---------- */

setInterval(async()=>{

 if(browser && Date.now()-lastActivity > 600000){

  console.log("Auto closing browser")

  await browser.close()

  browser=null
  page=null

 }

},60000)

/* ---------- SERVER START ---------- */

app.listen(3000,()=>{

 console.log("Server started")

 sendStep(1,"Server started")

})