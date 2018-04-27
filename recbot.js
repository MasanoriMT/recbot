const Botkit = require('botkit');
const Rx = require('rxjs/Rx');
const operators = require('rxjs/operators');
const moment = require('moment');
const fs = require('fs');

const ANONYMOUS_USER_NAME = 'anonymous';
const AREA_NAMES = ['e1', 'e2', 'e3', 'e4'];

if (!process.env.token) {
  console.error('Error: Specify token in environment');
  process.exit(1);
}

const controller = Botkit.slackbot({
  debug: false
});

controller
  .spawn({
    token: process.env.token
  })
  .startRTM(err => {
    if (err) {
      throw new Error(err);
    }
  });

function handleError(operation = 'operation', result) {
  return error => {
    console.error(`${operation}:${error}`);
    if (!result) {
      result = error.toString();
    }
    return Rx.Observable.of(result);
  };
}

function getUserName(bot, user) {
  const promise = new Promise((resolve, reject) => {
    bot.api.users.info({ user: user }, (error, response) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(response.user.name);
    });
  });

  return Rx.Observable.fromPromise(promise);
}

function processMessage(username, areaname, date) {
  if (username === ANONYMOUS_USER_NAME) {
    throw new Error(':interrobang: *who are you???*');
  }
  if (AREA_NAMES.indexOf(areaname) < 0) {
    throw new Error(':scream: *wrong area name!!!*');
  }

  const filename = `./data/${moment().format('YYYYMMDD')}-${areaname}.txt`;
  const message = `[${date.format('YYYY-MM-DD HH:mm:ss')}] ${username}`;

  return { filename: filename, message: message };
}

function recode(res) {
  //if (res !== SUCCESS) return Promise.resolve(res);

  return new Promise((resolve, reject) => {
    fs.writeFile(res.filename, res.message, error => {
      if (error) {
        reject(':scream: *error occurred!!!*');
        return;
      }

      resolve('OK!');
    });
  });
}

controller.hears('.*', ['direct_message'], (bot, message) => {
  // console.log(message);

  getUserName(bot, message.user)
    .pipe(
      // operators.tap(username => console.log(`${username}`)),
      operators.catchError(handleError('getUserName', ANONYMOUS_USER_NAME))
    )
    .map(username =>
      processMessage(username, message.text, moment.unix(message.ts))
    )
    .mergeMap(res => recode(res))
    .pipe(operators.catchError(handleError('recode')))
    .subscribe(
      res => {
        bot.reply(message, res);
      },
      err => {
        bot.reply(message, err);
      }
    );
});
