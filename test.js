// const express = require("express");
// const { chromium } = require("playwright");
// const path = require("path");

// const app = express();
// app.use(express.json());
// app.use(express.static("public"));

// let browser = null;
// let context = null;
// let page = null;
// let working = false;

// async function launchBrowser() {

//   if (browser) return;

//   browser = await chromium.launch({
//     headless: true,
//     args: [
//       "--no-sandbox",
//       "--disable-setuid-sandbox",
//       "--disable-dev-shm-usage",
//       "--disable-blink-features=AutomationControlled"
//     ]
//   });

//   context = await browser.newContext({
//     viewport: null,
//     locale: "en-US",
//     timezoneId: "Asia/Kolkata",
//     userAgent:
//       "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36"
//   });

//   await context.addInitScript(() => {
//     Object.defineProperty(navigator, "webdriver", {
//       get: () => undefined
//     });
//   });

//   page = await context.newPage();

//   await page.goto("https://chatgpt.com/", {
//     waitUntil: "domcontentloaded"
//   });

//   await page.waitForSelector("textarea", { timeout: 60000 });

//   console.log("AI browser ready");
// }

// async function getLastMessage() {
//   return await page.evaluate(() => {
//     const msgs = document.querySelectorAll(
//       '[data-message-author-role="assistant"]'
//     );

//     if (!msgs.length) return "";

//     return msgs[msgs.length - 1].innerText.trim();
//   });
// }

// async function waitForStable() {

//   let prev = "";
//   let stable = 0;

//   while (stable < 5) {

//     const txt = await getLastMessage();

//     if (txt === prev) stable++;
//     else stable = 0;

//     prev = txt;

//     await page.waitForTimeout(800);
//   }

//   return prev;
// }

// async function sendPrompt(prompt) {

//   await page.waitForSelector("textarea");

//   await page.click("textarea");

//   await page.keyboard.type(prompt, {
//     delay: 30 + Math.random() * 60
//   });

//   await page.keyboard.press("Enter");

//   const reply = await waitForStable();

//   return reply;
// }

// app.post("/chat", async (req, res) => {

//   if (working)
//     return res.json({
//       success: false,
//       message: "AI busy"
//     });

//   const { message } = req.body;

//   try {

//     working = true;

//     await launchBrowser();

//     const reply = await sendPrompt(message);

//     working = false;

//     res.json({
//       success: true,
//       reply
//     });

//   } catch (err) {

//     working = false;

//     console.log(err);

//     browser = null;

//     res.json({
//       success: false,
//       reply: "automation error"
//     });
//   }
// });

// app.get("/ping", (req, res) => {
//   res.send("alive");
// });

// app.listen(3000, () => {
//   console.log("server running http://localhost:3000");
// });






const express = require("express")
const puppeteer = require("puppeteer-extra")
const Stealth = require("puppeteer-extra-plugin-stealth")

puppeteer.use(Stealth())

const app = express()

app.use(express.json())
app.use(express.static("public"))

let browser
let page
let busy=false

async function startBrowser(){

 if(browser) return

 browser = await puppeteer.launch({
  headless:true,
  args:[
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--single-process",
  "--no-zygote"
  ]
 })

 page = await browser.newPage()

 await page.setViewport({
  width:1280,
  height:800
 })

 await page.setUserAgent(
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36"
 )

 await page.goto("https://chatgpt.com/",{
  waitUntil:"domcontentloaded"
 })

 console.log("browser ready")

}

async function getReply(){

 let previous=""
 let stable=0

 while(stable<5){

  const text = await page.evaluate(()=>{

   const blocks=document.querySelectorAll('[data-message-author-role="assistant"]')

   if(!blocks.length) return ""

   return blocks[blocks.length-1].innerText

  })

  if(text===previous){
   stable++
  }else{
   stable=0
  }

  previous=text

  await new Promise(r=>setTimeout(r,800))

 }

 return previous
}

app.post("/chat", async(req,res)=>{

 if(busy){
  return res.json({reply:"AI busy"})
 }

 const {message}=req.body

 try{

  busy=true

  await startBrowser()

  await page.waitForSelector("textarea")

  await page.type("textarea",message,{
   delay:40+Math.random()*50
  })

  await page.keyboard.press("Enter")

  const reply = await getReply()

  busy=false

  res.json({reply})

 }catch(e){

 console.log("AUTOMATION ERROR:", e)

 res.json({
  reply:"automation error"
 })

 }

})

app.get("/ping",(req,res)=>{
 res.send("alive")
})

app.listen(3000,()=>{
 console.log("server running")
})