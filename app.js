var data = require('./data');


var builder = require('botbuilder');
var restify = require('restify');
var request = require('request');
var cheerio = require('cheerio');
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
  console.log('%s listening to %s', server.name, server.url);
});
// Serve a static web page
server.get(/.*/, restify.serveStatic({
  'directory': '.',
  'default': 'index.html'
}));
var connector = new builder.ChatConnector({
  appId: process.env.MICROSOFT_APP_ID,
  appPassword: process.env.MICROSOFT_APP_PASSWORD
});
var bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());

var model = 'https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/01f14fbd-d409-4951-b638-080f5867ec65?subscription-key=93971faefdc84030b897dbdca188cde2&verbose=true&timezoneOffset=0.0&q=';
const YOUTUBE_API = `https://www.youtube.com/results?search_query=`;

var recognizer = new builder.LuisRecognizer(model);
var intents = new builder.IntentDialog({ recognizers: [recognizer] });
bot.dialog('/', function (session) {
  session.send("分享好音樂，想點什麼歌呢？ 或者說說現在的心情，推薦幾首好歌給您。");
  session.beginDialog('/moodMusic');
});

bot.dialog('/moodMusic', intents);

intents.matches('點歌', [
  function (session, args, next) {
    var task = builder.EntityRecognizer.findEntity(args.entities, '歌曲');
    var singer = builder.EntityRecognizer.findEntity(args.entities, '歌手');
    if (!task) {
      if (!singer) {
        builder.Prompts.text(session, "什麼歌名呢?");
      } else {
        builder.Prompts.text(session, '想聽' + singer.entity.toString() + '的什麼歌呢?');
      }  
    } else {
      if (!singer) {
        next({ response: task.entity });
      } else {
        next({ response: task.entity, response2: singer.entity });
      }
    }
  },
  function (session, results) {
    if (results.response) {
      const youtubeUrl = `${YOUTUBE_API}${encodeURIComponent(results.response)}`;
      request({ uri: youtubeUrl }, function (error, response, body) {
        const $ = cheerio.load(body);
        const href = $('.yt-lockup-title > a').attr('href');
        const youtube_title = $('.yt-lockup-title > a').attr('title');
        const img_href = $('.yt-thumb-simple > img').attr('src');
        const videoHref = `https://www.youtube.com${href}`;
        msg = new builder.Message(session);
        msg.attachments([{
          contentType: "image/jpeg",
          contentUrl: img_href
        }]);
        session.send(msg);
        session.send(`[${youtube_title}](${videoHref})`);
      });
      session.send('好喔~ "%s"的連結跟預覽圖來囉！', results.response);
    } else {
      session.send("oops!");//error handling
    }
  }
]);
let matchProp = '';

intents.matches('心情', [
  function (session) {
    if (session.message.text) {
      let isMatch = false;
      Object.keys(data.DATA).forEach((prop) => {
        if (isMatch) {
          return;
        }
        isMatch = session.message.text.indexOf(prop) >= 0;
        if (isMatch) {
          matchProp = prop;
        } else {
          matchProp = '恩典';
        }
      })
      const randSet = data.DATA[matchProp];
      const randItems = {};
      const randKeys = Object.keys(randSet);
      const itemKeys = [];
      
      /*while (Object.keys(randItems).length < 3) {
        const randKey = parseInt(randKeys.length * Math.random());
        const itemKey = randKeys[randKey]; 
        if (itemKeys.indexOf(itemKey) < 0) {
          const title = randSet[itemKey].title;
          randItems[title] = (randSet[itemKey]);
          itemKeys.push(itemKey);
        }
      }
      debugger;*/
      const randStart =  parseInt((Math.random() * randKeys.length - 3 ));
      for (let i=randStart;i<=randStart+2;i++) {
        const itemKey = randKeys[i];
        const title = randSet[itemKey].title;
        randItems[title] = randSet[itemKey];
      }
      

      builder.Prompts.choice(session, "我能理解你的心情，推薦三首好歌給您選擇唷！", randItems, {
        retryPrompt: '我聽不懂...您只能選其中一首...'
      });
    } else {
      session.send("Ok");
    }
  },
  function (session, results) {

    if (results.response) {
      var mood = data.DATA[matchProp][results.response.entity];
      msg = new builder.Message(session);
      msg.sourceEvent({
        facebook: {
          attachment: {
            type: "template",
            payload: {
              template_type: "generic",
              elements: [{
                title: mood.title,
                subtitle: mood.subtitle,
                image_url: mood.image_url,
                item_url: mood.item_url,
                buttons: [{
                  type: "element_share"
                }]
              }]
            }
          }
        }
      });
      if (session.message.source == 'facebook') {
        session.send(msg);
      } else {
        msg.attachments([{
          contentType: "image/jpeg",
          contentUrl: mood.image_url
        }]);
        session.send(msg);
        session.send("%(item_url)s", mood);
        session.send('你的心情現在適合這首歌');
      }

    } else {
      session.send("ok");
    }
  }

]);

intents.onDefault(builder.DialogAction.send("對不起，我不太能理解您的意思，您可以再說說現在心情或者點歌唷！"));