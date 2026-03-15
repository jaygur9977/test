require("dotenv").config()

const express = require("express")
const puppeteer = require("puppeteer-core")
const puppeteerExtra = require("puppeteer-extra")
const Stealth = require("puppeteer-extra-plugin-stealth")

puppeteerExtra.use(Stealth())

const app = express()

app.use(express.json())
app.use(express.static("public"))

/* ---------- GLOBAL ERROR LOGGING ---------- */

process.on("uncaughtException",err=>{
 console.error("UNCAUGHT:",err)
})

process.on("unhandledRejection",err=>{
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
 lastActivity=Date.now()
}

/* ---------- START BROWSER ---------- */

async function startBrowser(){

 if(browser) return

 sendStep(3,"Opening ChatGPT")

 browser = await puppeteerExtra.launch({
  headless:true,
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium-browser",
  args:[
   "--no-sandbox",
   "--disable-setuid-sandbox",
   "--disable-dev-shm-usage",
   "--disable-gpu",
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
  waitUntil:"networkidle2"
 })

 console.log("PAGE TITLE:",await page.title())

}

/* ---------- WAIT FOR CHAT INPUT ---------- */

async function waitForChatInput(){

 for(let i=0;i<8;i++){

  try{

   await page.waitForSelector('div[contenteditable="true"]',{
    visible:true,
    timeout:5000
   })

   return true

  }catch(e){

   console.log("Chat input not ready, retrying...")

   try{
    console.log("Current page:",await page.title())
   }catch(err){
    console.log("Frame refreshed")
   }

   await new Promise(r=>setTimeout(r,2000))

  }

 }

 throw new Error("Chat input never appeared")

}

/* ---------- SCRAPE RESPONSE ---------- */

async function getReply(){

 let previous=""
 let stable=0

 while(stable<6){

  const text = await page.evaluate(()=>{

   const msgs=[...document.querySelectorAll("article")]

   const assistant=msgs.filter(el=>{
    return el.innerText && el.innerText.length>20
   })

   if(!assistant.length) return ""

   return assistant[assistant.length-1].innerText

  })

  if(text===previous){
   stable++
  }else{
   stable=0
  }

  previous=text

  await new Promise(r=>setTimeout(r,900))

 }

 return previous
}

/* ---------- CHAT ENDPOINT ---------- */

app.post("/chat",async(req,res)=>{

 if(busy){
  return res.json({reply:"AI busy"})
 }

 const {message}=req.body

 try{

  busy=true
  touch()

  sendStep(2,"Prompt sent")

  await startBrowser()

  await waitForChatInput()

  await page.focus('div[contenteditable="true"]')

  await page.keyboard.type(message,{
   delay:40+Math.random()*50
  })

  sendStep(4,"Prompt injected")

  await page.keyboard.press("Enter")

  sendStep(5,"Fetching result")

  const reply = await getReply()

  sendStep(6,"Output generated")

  busy=false

  res.json({reply})

 }catch(e){

  busy=false

  console.error("AUTOMATION ERROR:",e)

  sendStep("error",e.message,true)

  res.json({reply:"automation error"})
 }

})

/* ---------- DESTROY SESSION ---------- */

app.post("/destroy",async(req,res)=>{

 try{

  if(browser){

   console.log("Destroying session")

   await browser.close()

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

 if(browser && Date.now()-lastActivity>600000){

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