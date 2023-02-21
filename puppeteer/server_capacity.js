"use strict";

const chalk = require('chalk');
const puppeteer = require('puppeteer');
const Multiprogress = require('multi-progress');
const { AssetVersionContext } = require('twilio/lib/rest/serverless/v1/service/asset/assetVersion');
process.setMaxListeners(0);

const numUsers = 5;
const testDuration = 40000;
const delayToEnterRoom = 3000;
const delayBeforeScreenshot = 5000;
const roomGroupName = 'demo-joss';
const numRooms = 1;

// Simulate gaussian distribution
const intervalRangeInMin = 15;
const guaussianRange = 6;
const base = -3;
const interval = guaussianRange / intervalRangeInMin;
function getPrefixFromIndex(idx) {
  const charCode = 97; // "a"
  const b = [idx];
  let sp = 0;
  while (sp < b.length) {
    if (b[sp] >= 26) {
      const div = Math.floor(b[sp] / 26);
      b[sp + 1] = div - 1;
      b[sp] %= 26;
    }
    sp++;
  }
  let out = "";
  for (let i = 0; i < b.length; ++i) {
    out = String.fromCharCode(charCode + b[i]) + out;
  }
  return out;
}

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min); //The maximum is exclusive and the minimum is inclusive
}

const roomNames = [];
for (let i = 0; i < numRooms; ++i) {
  const roomName = roomGroupName + "-" + getPrefixFromIndex(i);
  roomNames.push(roomName);
}

// We can take x in range [-3, 3]
function _stdNormalDistribution(x) {
  return Math.exp(-Math.pow(x, 2) / 2) / Math.sqrt(2 * Math.PI);
}

function _sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function _newUserLogin(i, bars, screenShot = true) {
  const browser = await puppeteer.launch({
    // Set headless to true to see the console
    // headless: false,
    args: [ '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--no-sandbox',
      '--disable-setuid-sandbox'],
  });
  const context = await browser.createIncognitoBrowserContext();
  const page = await context.newPage();
  let browserOpen = true;
  page.on("pageerror", (error) => {
    console.log(chalk.red("Error in page:", page.url(), " user: ", i, " timestamp: ", new Date(Date.now()).toLocaleString(undefined, {dateStyle: "short", timeStyle: "long"}), "\n:", error));
    browser.close();
    browserOpen = false;
    bars["crashed"].tick();
    //console.log(chalk.red("Error in page:", page.url(), " user: ", i, " timestamp: ", new Date(Date.now()).toLocaleString(undefined, {dateStyle: "short", timeStyle: "long"}), "\n:", error));
  });
  await page.setDefaultNavigationTimeout(0);
  bars["started"].tick();

  // Currently test w/o auto-assignment
  await page.goto(`https://stanforddeliberate.org/${roomNames[i % numRooms]}`);
  // Logs content of the page
  await page.content();
  await page.type('#username', `test_user_ec${i}@gmail.com`);
  await page.type('#fullName', `test_user_ec${i}`);
  await page.type('#screenName', `test_user_ec${i}`);
  console.log(chalk.green("New Page URL:", page.url(), " user: ", i, " timestamp: ", new Date(Date.now()).toLocaleString(undefined, {dateStyle: "short", timeStyle: "long"})));

  console.log("Waiting for login button...");
  const loginButton = await page.$('input[type="submit"]');
  console.log("Got login button");
  // Clicks on the login button
  await loginButton.evaluate( loginButton => loginButton.click() );
  //await Promise.all([page.waitForNavigation(), loginButton.click()]);

  console.log(chalk.cyan("Logged in for user ", i));
  bars["logged"].tick();

  //const goToDiscussionButton = await page.$('#root > div.container-fluid > div.row.justify-content-center > div > div.mt-4 > button');
  //await goToDiscussionButton.click();
  // LOGS CONTENT OF THE PAGE
  console.log("Waiting for get started button...");
  const getStartedButton = await page.$('.getStartedButton');
  console.log("Got get started button");
  await getStartedButton.evaluate( getStartedButton => getStartedButton.click() );
  console.log(chalk.yellow("Entering into the discussion for user ", i));
  bars["entering"].tick();
  //console.log(await page.content());

  await _sleep(delayToEnterRoom);
  if (!browserOpen) return;
  console.log("Waiting for enter discussion button...");
  const enterDiscussionButton = await page.waitForSelector('#root > p:nth-child(4) > button');
  console.log("Got enter discussion button");
  await enterDiscussionButton.evaluate( enterDiscussionButton => enterDiscussionButton.click() );
  // await page.waitForSelector('#root > p:nth-child(4) > button', {timeout: 1200000});
  // await page.click('#root > p:nth-child(4) > button');

  console.log(chalk.blue("New Page URL starting discussion:", page.url(), " user: ", i, " timestamp: ", new Date(Date.now()).toLocaleString(undefined, {dateStyle: "short", timeStyle: "long"})));
  bars["inRoom"].tick();
  await _sleep(delayBeforeScreenshot);
  if (screenShot) {
    await page.screenshot({ path: `../output/browser${i}.png` });
    bars["screenshot"].tick();
  }
  await _sleep(Math.max(testDuration - delayBeforeScreenshot, 1));
  console.log(chalk.blue(`New Page URL opening discussion after ${testDuration / 60000} min:`, page.url(), " user: ", i, " timestamp: ", new Date(Date.now()).toLocaleString(undefined, {dateStyle: "short", timeStyle: "long"})));
  // // Close browser session
  await browser.close();
  bars["finished"].tick();
}

async function runExperiment() {
  const promises = [];
  const startTs = Date.now(); // in ms
  console.log(chalk.blue("Start timestamp: ", new Date(startTs).toLocaleString(undefined, {dateStyle: "short", timeStyle: "long"})));

  // First computes the number of participants at each time step
  const listNumParticipants = [];
  let nbTotalParticipants = 0;
  for (let step = 0; step <= intervalRangeInMin; ++step) {
    const x = base + step * interval;
    const numParticipants = parseInt(_stdNormalDistribution(x) * numUsers);
    listNumParticipants.push(numParticipants);
    nbTotalParticipants += numParticipants;
  }
  console.log(chalk.blue("Total number of participants: ", nbTotalParticipants));

  // Add progress bar
  const mpb = new Multiprogress(process.stderr);
  const barCreated = mpb.newBar("Instances Created  [:bar] :percent", { total: nbTotalParticipants });
  const barStarted = mpb.newBar(chalk.cyan('Instances Started  [:bar] :percent'), { total: nbTotalParticipants });
  const barLogged = mpb.newBar('Instances Logged   [:bar] :percent', { total: nbTotalParticipants });
  const barEntering = mpb.newBar('Instances Entering [:bar] :percent', { total: nbTotalParticipants });
  const barInRoom = mpb.newBar(chalk.green('Instances in room  [:bar] :percent'), { total: nbTotalParticipants });
  const barCrashed = mpb.newBar(chalk.red('Instances Crashed  [:bar] :percent'), { total: nbTotalParticipants });
  const barFinished = mpb.newBar(chalk.blue('Instances Finished [:bar] :percent'), { total: nbTotalParticipants });
  const barScreenShot = mpb.newBar(chalk.greenBright('Screenshots taken [:bar] :percent'), { total: nbTotalParticipants });
  const bars = {"created": barCreated, "started": barStarted, "logged": barLogged, "entering": barEntering, "inRoom": barInRoom, "crashed": barCrashed, "finished": barFinished, "screenshot": barScreenShot};
  for (let i = 0; i < bars.length; ++i) {
    bars[i].tick(0);
  }

  let idx = getRandomInt(0, 99999);
  for (let step = 0; step <= intervalRangeInMin; ++step) {
    const x = base + step * interval;
    const numParticipants = parseInt(_stdNormalDistribution(x) * numUsers);
    const runAtSinceStart = startTs + step * 500;
    console.log(chalk.cyan(`Running ${numParticipants} at ts ${new Date(runAtSinceStart).toLocaleString(undefined, {dateStyle: "short", timeStyle: "long"})}`));
    for (let i = idx; i < idx + numParticipants; ++i) {
      promises.push((async () => {
        await _sleep(runAtSinceStart - Date.now());
        console.log(chalk.green(`Running ${i} at ts ${new Date(Date.now()).toLocaleString(undefined, {dateStyle: "short", timeStyle: "long"})}`));
        await _newUserLogin(i, bars).catch((error) => {
          console.log("await ERROR");
          console.error(error);
          // process.exit(1);
        });
      })());
    }
    barCreated.tick();
    idx += numParticipants;
  }
  await Promise.all(promises);
  console.log('\nDONE!');
  process.exit(1);
}

runExperiment().catch((error) => {
  console.log("ERROR");
  console.error(error);
  process.exit(1);
});
