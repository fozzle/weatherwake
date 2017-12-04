require('dotenv').config();
const Player = require('player');
const LifxClient = require('node-lifx').Client;
const DarkSkyApi = require('dark-sky-api');
const googleTTS = require('google-tts-api');
const client = new LifxClient();

DarkSkyApi.apiKey = process.env.DARKSKY_KEY;
DarkSkyApi.proxy = true;

const position = {
  latitude: process.env.LAT,
  longitude: process.env.LON,
};

const FADE_TIME_S = 60;
const FADE_STEPS = 100;
const FADE_STEP_MS = (FADE_TIME_S * 1000) / FADE_STEPS;
const FADE_STEP_INCR = 1 / FADE_STEPS;

const promisePlay = (player) => {
  player.play();
  return new Promise((resolve, reject) => {
    player.on('playend', () => {
      console.log('got a playend');
      resolve();
    });

    player.on('error', (err) => {
      console.log('errored in playback', err);
      if (err === 'No next song was found') {
        // this sucks but lets timeout to resolve here
        setTimeout(resolve, 3000);
        return;
      }

      reject(err);
    });
  });
};

const linearMap = (oMax, oMin, nMax, nMin, oValue) => {
  return ( (oValue - oMin) / (oMax - oMin) ) * (nMax - nMin) + nMin;
}

const fadeRecursive = (player, lastVolume) => {
  const newVol = lastVolume + FADE_STEP_INCR;
  player.setVolume(newVol);
  if (newVol >= 1) return console.log('done');
  setTimeout(() => fadeRecursive(player, newVol), FADE_STEP_MS);
}

const colorForWeather = (report) => {
  console.log(report);
  // R determined by the high temperature (F). 120 -> 255,  30 -> 0 scaled linearly)
  const r = linearMap(100, 30, 255, 0, report.temperatureHigh);

  // G determined by precipitation. 1 -> 255, 0 -> 0 scaled linearly
  const g = linearMap(1, 0, 255, 0, report.precipProbability);

  // B determined by inverse of r
  const b = 255 - r;
  return [r, g, b];
}



client.init();
client.on('light-new', async function(light) {
  console.log('found light');
  light.off();
  await new Promise((resolve, reject) => setTimeout(resolve, 4000));
  light.on(FADE_TIME_S * 1000);
  DarkSkyApi.loadForecast(position)
    .then(results => {
      const today = results.daily.data[0];
      const [r, g, b] = colorForWeather(today);
      console.log('rgb', r, g, b);
      light.colorRgb(r, g, b, 10 * 1000);

      const sayString = `Good morning ${process.env.NAME || ''}.
        Today, it will be ${today.summary},
        with a high of ${Math.round(today.temperatureHigh)}
        and a low of ${Math.round(today.temperatureLow)}.
      `;

      // googleTTS(sayString, 'en', 1)
      //   .then((url) => {
      //     const player = new Player(url);
      //     return promisePlay(player);
      //   })
      //   .then(() => {
      //     if (today.precipProbability) {
      //       return googleTTS(`There's a ${today.precipProbability * 100} percent chance of ${today.precipType}.`)
      //         .then((url) => {
      //           const player = new Player(url);
      //           return promisePlay(player);
      //         });
      //     }
      //
      //     return Promise.resolve();
      //   })
      Promise.resolve()
        .then(() => {
          // Play ambient track, fading in
          const player = new Player('http://ice1.somafm.com/deepspaceone-128-mp3').enable('stream');
          player.setVolume(0);

          setTimeout(() => fadeRecursive(player, 0), FADE_STEP_MS);
          return promisePlay(player);
        })
        .then(() => process.exit(0))
        .catch(err => {
          console.error(err);
          process.exit(1);
        });;
    })
})
