"use strict";

const yargs = require('yargs');
const chalk = require('chalk');
const puppeteer = require('puppeteer');
const Multiprogress = require('multi-progress');
const { AssetVersionContext } = require('twilio/lib/rest/serverless/v1/service/asset/assetVersion');
process.setMaxListeners(0);


const argv = yargs
  .option('use_logs', {
    default: false,
    describe: 'Rather to use logs or progress bars'
  })
  .option('num_users', {
    default: 10,
    describe: 'Average number of users to simulate'
  })
  .option('test_duration', {
    default: 120000,
    describe: 'Test duration in milliseconds'
  })
  .option('delay_to_enter_room', {
    default: 3000,
    describe: 'Delay to enter room in milliseconds'
  })
  .option('delay_before_screenshot', {
    default: 5000,
    describe: 'Delay before screenshot in milliseconds'
  })
  .option('room_group_name', {
    default: 'demo-joss',
    describe: 'Room group name'
  })
  .option('num_rooms', {
    default: 1,
    describe: 'Number of rooms in room group'
  })
  .option('take_screenshot', {
    default: false,
    describe: 'Whether to take screenshots or not'
  }).argv;

const useLogs = argv.use_logs;
const numUsers = argv.num_users;
const testDuration = argv.test_duration;
const delayToEnterRoom = argv.delay_to_enter_room;
const delayBeforeScreenshot = argv.delay_before_screenshot;
const roomGroupName = argv.room_group_name;
const numRooms = argv.num_rooms;
const takeScreenshot = argv.take_screenshot;

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

async function _newUserLogin(i, bars) {
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
    if (useLogs) console.log(chalk.red("Error in page:", page.url(), " user: ", i, " timestamp: ", new Date(Date.now()).toLocaleString(undefined, {dateStyle: "short", timeStyle: "long"}), "\n:", error));
    browser.close();
    browserOpen = false;
    if (!useLogs) bars["crashed"].tick();
  });
  await page.setDefaultNavigationTimeout(0);
  if (!useLogs) bars["started"].tick();

  // Currently test w/o auto-assignment
  await page.goto(`https://stanforddeliberate.org/${roomNames[i % numRooms]}`);
  // Logs content of the page
  await page.content();
  await page.type('#username', `test_user_ec2_${i}@gmail.com`);
  await page.type('#fullName', `test_user_ec2_${i}`);
  await page.type('#screenName', `user-ec2-${i}`);
  if (useLogs) console.log(chalk.green("New Page URL:", page.url(), " user: ", i, " timestamp: ", new Date(Date.now()).toLocaleString(undefined, {dateStyle: "short", timeStyle: "long"})));

  // Finds the login button and clicks it
  await page.content();
  const loginButton = await page.$('input[type="submit"]');
  await loginButton.click();
  await _sleep(3000);

  // Makes sure there was no error
  await page.content();
  let error = await page.evaluate(() => {
    let el = document.querySelector(".text-danger")
    return el ? el.innerText : ""
  })
  if (error !== "") {
    if (useLogs) console.log(chalk.red("Log in error:", error, " user: ", i, " timestamp: ", new Date(Date.now()).toLocaleString(undefined, {dateStyle: "short", timeStyle: "long"})));
    browser.close();
    browserOpen = false;
    if (!useLogs) bars["crashed"].tick();
    return;
  }

  // If we are here, we are logged in
  if (useLogs) console.log(chalk.cyan("Logged in for user ", i));
  if (!useLogs) bars["logged"].tick();

  // Finds the get started button and clicks it
  await page.content();
  const getStartedButton = await page.$('.getStartedButton');
  await getStartedButton.evaluate( getStartedButton => getStartedButton.click() );

  // Waits for the discussion to load
  if (useLogs) console.log(chalk.yellow("Entering into the discussion for user ", i));
  if (!useLogs) bars["entering"].tick();
  await _sleep(delayToEnterRoom);
  if (!browserOpen) return; // The browser crashed

  // Makes sure there was no error
  await page.content();
  error = await page.evaluate(() => {
    let el = document.querySelector(".text-danger")
    return el ? el.innerText : ""
  })
  if (error !== "") {
    if (useLogs) console.log(chalk.red("Log in error:", error, " user: ", i, " timestamp: ", new Date(Date.now()).toLocaleString(undefined, {dateStyle: "short", timeStyle: "long"})));
    browser.close();
    browserOpen = false;
    if (!useLogs) bars["crashed"].tick();
    return;
  }

  // If we are here, we can enter the discussion
  const enterDiscussionButton = await page.waitForSelector('#root > p:nth-child(4) > button');
  await enterDiscussionButton.evaluate( enterDiscussionButton => enterDiscussionButton.click() );

  if (useLogs) console.log(chalk.blue("New Page URL starting discussion:", page.url(), " user: ", i, " timestamp: ", new Date(Date.now()).toLocaleString(undefined, {dateStyle: "short", timeStyle: "long"})));
  if (!useLogs) bars["inRoom"].tick();
  await _sleep(delayBeforeScreenshot);
  if (takeScreenshot) {
    await page.screenshot({ path: `../output/browser${i}.png` });
    if (!useLogs) bars["screenshot"].tick();
  }
  await _sleep(Math.max(testDuration - delayBeforeScreenshot, 1));
  if (useLogs) console.log(chalk.blue(`New Page URL opening discussion after ${testDuration / 60000} min:`, page.url(), " user: ", i, " timestamp: ", new Date(Date.now()).toLocaleString(undefined, {dateStyle: "short", timeStyle: "long"})));
  // // Close browser session
  await browser.close();
  if (!useLogs) bars["finished"].tick();
}

async function runExperiment() {
  // First, logs the parameters
  console.log(chalk.cyanBright("Room Group name: ", roomGroupName));
  console.log(chalk.cyanBright("Number of rooms: ", numRooms));
  console.log(chalk.cyanBright("Average number of users: ", numUsers));
  console.log("");
  console.log(chalk.cyanBright("Test Duration: ", (testDuration / 60000).toFixed(2), "min"));
  console.log(chalk.cyanBright("Delay to enter room: ", (delayToEnterRoom / 1000).toFixed(2), "s"));
  console.log(chalk.cyanBright("Delay before screenshot: ", (delayBeforeScreenshot / 1000).toFixed(2), "s"));
  console.log(chalk.cyanBright("Screen shot: ", takeScreenshot));
  console.log(chalk.cyanBright("Use logs: ", useLogs));
  console.log("");


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
  console.log("");

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
    if (!useLogs) bars[i].tick(0);
  }

  let idx = getRandomInt(0, 99999);
  for (let step = 0; step <= intervalRangeInMin; ++step) {
    const x = base + step * interval;
    const numParticipants = parseInt(_stdNormalDistribution(x) * numUsers);
    const runAtSinceStart = startTs + step * 500;
    if (useLogs) console.log(chalk.cyan(`Running ${numParticipants} at ts ${new Date(runAtSinceStart).toLocaleString(undefined, {dateStyle: "short", timeStyle: "long"})}`));
    for (let i = idx; i < idx + numParticipants; ++i) {
      promises.push((async () => {
        await _sleep(runAtSinceStart - Date.now());
        if (useLogs) console.log(chalk.green(`Running ${i} at ts ${new Date(Date.now()).toLocaleString(undefined, {dateStyle: "short", timeStyle: "long"})}`));
        await _newUserLogin(i, bars).catch((error) => {
          console.log("await ERROR");
          console.error(error);
        });
      })());
      barCreated.tick();
    }
    idx += numParticipants;
  }
  await Promise.all(promises);
  console.log('\n\nDONE!');
  process.exit(1);
}

runExperiment().catch((error) => {
  console.log("ERROR");
  console.error(error);
  process.exit(1);
});
