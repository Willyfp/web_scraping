const express = require("express");
const puppeteer = require("puppeteer");
const EventEmitter = require("events");

const server = express();

server.get("/", async (request, response) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto("https://www.imobiliarialal.com.br/imoveis/para-alugar");

  page.on("console", async (msg) => {
    const msgArgs = msg.args();
    for (let i = 0; i < msgArgs.length; ++i) {
      console.log(await msgArgs[i].jsonValue());
    }
  });

  const pageContent = await page.evaluate(async () => {
    const list = document.querySelectorAll(".card");

    var content = [];

    await list.forEach((item) => {
      var itemHtml = item.innerHTML;
      var d = document.createElement("DIV");
      d.innerHTML = itemHtml;
      var link = d.querySelector("a").href;

      content.push(link);
    });

    return content;
  });

  var newAppartments = [];

  for (item of pageContent) {
    const newPage = await browser.newPage();
    await newPage.goto(String(item));

    var title = await newPage.evaluate(() => {
      return document.querySelector("div.header-title span").textContent;
    });

    newAppartments.push({ title });
  }

  await browser.close();
  response.send(newAppartments);
});

server.listen(3000, () => {
  console.log("success");
});
