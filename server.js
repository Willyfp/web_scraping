const express = require("express");
const puppeteer = require("puppeteer");
const EventEmitter = require("events");
const nodeGeocoder = require("node-geocoder");

const {
  initializeApp,
  applicationDefault,
  cert,
} = require("firebase-admin/app");

const { getFirestore } = require("firebase-admin/firestore");

const serviceAccount = require("C:\\Users\\willy\\Downloads\\buscape-90a48-firebase-adminsdk-nmmin-173ced83df.json");

initializeApp({
  credential: cert(serviceAccount),
  databaseURL: "https://buscape-90a48-default-rtdb.firebaseio.com",
});

const db = getFirestore();

const server = express();

server.get("/", async (request, response) => {
  const browser = await puppeteer.launch();

  let continuar = true;
  let pagina = 1;

  while (continuar) {
    const page = await browser.newPage();
    await page.goto(
      `https://www.imobiliarialal.com.br/imoveis/para-alugar?pagina=${pagina}`
    );

    page.on("console", async (msg) => {
      const msgArgs = msg.args();
      for (let i = 0; i < msgArgs.length; ++i) {
        console.log(await msgArgs[i].jsonValue());
      }
    });

    const pageContent = await page.evaluate(async () => {
      const list = document.querySelectorAll(
        '.card [rel="follow"] .btn-details'
      );

      var content = [];

      await list.forEach((item) => {
        content.push(item.href);
      });

      return content;
    });

    var newAppartments = [];

    for (item of pageContent) {
      const newPage = await browser.newPage();
      await newPage.goto(String(item));

      const apartment = await newPage.evaluate(async () => {
        const description = document.querySelectorAll("h1 span");
        const info = document.querySelectorAll(".item-info");
        const arrayImages = document.querySelectorAll(".slide-image img");
        const prices = document.querySelectorAll(".knl_panels-list .price");
        const link = window.location.href;

        const price = {};

        prices.forEach((item) => {
          const itemSplited = item.textContent.split("R$ ");

          price[itemSplited[0]] = itemSplited[itemSplited.length - 1];
        });

        const comodities = [];

        info.forEach((item) => {
          if (item?.textContent) {
            comodities.push(item.textContent);
          }
        });

        const images = [];

        arrayImages.forEach((item) => {
          if (item.src) {
            images.push({ uri: item.src });
          }
        });

        return {
          description: description[0].textContent,
          address: description[1]?.textContent,
          link: link,
          comodities,
          images,
          price,
        };
      });

      if (apartment.address !== "") newAppartments.push(apartment);
    }

    const appartmentsFormated = [];

    for (item of newAppartments) {
      const res = await nodeGeocoder({
        apiKey: "AIzaSyAJ9TKIMyEFz0YzZPCWwdTZxm6GaFIhipM",
      }).geocode(item.address);

      appartmentsFormated.push({
        ...item,
        coords: {
          latitude: res[0].latitude,
          longitude: res[0].longitude,
        },
      });
    }

    for (ap of appartmentsFormated) {
      await db
        .collection("appartments")
        .add(ap)
        .then((res) =>
          db.collection("appartments").doc(res.id).update({ id: res.id })
        );
    }

    await page.goto(
      `https://www.imobiliarialal.com.br/imoveis/para-alugar?pagina=${pagina}`,
      { waitUntil: "load", timeout: 0 }
    );

    const nextButton = await page.evaluate(async () => {
      const hasButton = document.querySelector(".hidden-sm-down");

      if (hasButton) {
        return true;
      } else {
        return false;
      }
    });

    if (nextButton) {
      pagina++;
    } else {
      continuar = false;
    }
  }

  await browser.close();

  response.send("deu bom");
});

server.listen(3000);
