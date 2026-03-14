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

async function startBrowser(){

 if(browser) return

 sendStep(3,"Opening ChatGPT")

 const path = require("path");

browser = await puppeteer.launch({
  executablePath: path.join(
    process.cwd(),
    ".cache/puppeteer/chrome/linux-127.0.6533.88/chrome-linux64/chrome"
  ),
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--single-process",
    "--no-zygote"
  ]
});

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

 console.log("Browser ready")
}

/* ---------- SCRAPE RESPONSE ---------- */

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

/* ---------- CHAT ENDPOINT ---------- */

app.post("/chat",async(req,res)=>{

 if(busy){
  return res.json({reply:"AI busy"})
 }

 const {message} = req.body

 try{

  busy=true
  touch()

  sendStep(2,"Prompt sent")

  await startBrowser()

  await page.waitForSelector("textarea",{timeout:60000})

  await page.click("textarea")

  await page.type("textarea",message,{
   delay:40+Math.random()*60
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