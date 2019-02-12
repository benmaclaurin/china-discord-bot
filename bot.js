const Discord = require('discord.js');
const client = new Discord.Client();
const snoowrap = require('snoowrap');
var hanzi = require("hanzi");
var keys = require('./keys')
var authList = [];
var memberIDs = [];
var checkIfVerifiedInterval;
var fs = require('fs'),
  request = require('request');

const r = new snoowrap(keys.snoo);

client.on('ready', () => {
  console.log('I am ready!');
  hanzi.start();
});

const events = {
  MESSAGE_REACTION_ADD: 'messageReactionAdd',
  MESSAGE_REACTION_REMOVE: 'messageReactionRemove',
};

client.on('raw', async event => {
  if (!events.hasOwnProperty(event.t)) return;

  const {
    d: data
  } = event;
  const user = client.users.get(data.user_id);
  const channel = client.channels.get(data.channel_id) || await user.createDM();

  if (channel.messages.has(data.message_id)) return;

  const message = await channel.fetchMessage(data.message_id);
  const emojiKey = (data.emoji.id) ? `${data.emoji.name}:${data.emoji.id}` : data.emoji.name;
  let reaction = message.reactions.get(emojiKey);

  if (!reaction) {
    const emoji = new Discord.Emoji(client.guilds.get(data.guild_id), data.emoji);
    reaction = new Discord.MessageReaction(message, emoji, 1, data.user_id === client.user.id);
  }

  client.emit(events[event.t], reaction, user);
});

client.on('message', message => {
  var args = message.toString().toLowerCase().split(' ');
  //console.log(message.id);

  if (args[0] === '.c') {
    switch (args[1]) {
      case 'verify':
        verify(message, args);
        break;
      case 'help':
        message.reply('sending help!');
        message.author.send('`.c verify [Reddit username]` \n Generates a code which can be used to verify your Discord account with Reddit.');
        break;
      case 'pinyin':
        pinyin(message, args);
        break;
      case 'decompose':
        decompose(message, args);
        break;
      case 'order':
        order(message, args);
        break;
      default:
        syntaxError(message);
    }
  }
});

function pinyin(message, args) {
  if (args[2] != null) {
    var pinyinReply = hanzi.getPinyin(args[2]);
    if (pinyinReply != null) {
      var reply = '';
      for (var i = 0; i < pinyinReply.length; i++) {
        reply += pinyinReply[i] + ' ';
      }
      message.reply('\n\nPinyin \n`' + reply + '`');
    } else {
      message.reply('please enter characters only. Example: `.c pinyin 拼音`');
    }
  } else {
    message.reply('incorrect usage. Try: `.c pinyin [character]`');
  }
}

function decompose(message, args) {
  if (args[2] != null) {
    var decomposeReply = hanzi.decompose(args[2], 2);
    if (hanzi.ifComponentExists(args[2])) {
      var reply = '';
      for (var i = 0; i < decomposeReply.components.length; i++) {
        reply += '`' + decomposeReply.components[i] + '` ';
      }
      message.reply('\n\nCharacter \n`' + args[2] + '` \n\nRadical(s) \n' + reply);
    } else {
      message.reply('please enter characters only. Example: `.c decompose 好`');
    }
  } else {
    message.reply('incorrect usage. Try: `.c decompose [character]')
  }
}

function order(message, args) {
  if (args[2] != null) {
    if (hanzi.ifComponentExists(args[2])) {
      var decimal = args[2].charCodeAt(0);
      var utf8String = encodeURI(args[2]).split('%');
      //var decimalString = decimal.toString().charAt(0) + decimal.toString().charAt(1);
      var decimalString = '25';

      var location = '%' + decimalString + utf8String[1] + '%' + decimalString + utf8String[2] + '%' + decimalString + utf8String[3];
      download('https://dictionary.writtenchinese.com/giffile.action?&localfile=true&fileName=' + location + '.gif', 'character.gif', function() {
        message.reply({
          files: ["character.gif"]
        });
      });
    } else {
      message.reply('please enter characters only. Example: `.c order 好`');
    }
  } else {
    message.reply('incorrect usage. Try: `.c order [character]`')
  }
}

function verify(message, args) {
  if (!message.member.roles.has('529390804230209566')) {
    var redditUser = args[2];
    if (redditUser != null) {
      if (!memberIDs.includes(message.author.id)) {
        var code = Math.floor(Math.random() * 9999) + 1000;
        memberIDs.push(message.author.id);
        authList.push(code + '/' + redditUser + '/' + message.author.id);
        message.reply('your code is: `' + code + '`. Post the code as a comment somewhere on Reddit for verification. It will expire after **2 minutes**...');

        checkIfVerified(redditUser, message, code);
      } else {
        var userData = findUser(message.author.id);
        message.reply('you already have a code: `' + userData[0] + '` Post the code as a comment somewhere on Reddit for verification...');
      }
    } else {
      message.reply('Incorrect usage: `.c verify [Reddit username]`');
    }
  } else {
    message.reply('you are already verified...');
  }
}

function checkIfVerified(redditUser, message, code) {
  var checks = 0;
  var verifiedInterval = setInterval(function() {
    if (checks != 40) {
      checks += 1;
      r.getUser(redditUser).getComments({
        limit: 1
      }).then(data => {
        var redditData = data[0].body;
        if (redditData == code.toString() || redditData == '**' + code.toString() + '**' && data[0].author.name.toLowerCase() == redditUser.toLowerCase()) {
          message.member.addRole('529390804230209566');
          message.guild.createRole({
            name: 'Reddit: ' + data[0].author.name,
            color: [255, 69, 0],
            mentionable: true
          }).then(role => {
            message.member.addRole(role.id);
            message.reply('your Discord account has been successfully linked with Reddit (https://www.reddit.com/user/' + data[0].author.name + '). Please wait for a moderator to confirm your verification.');
          }).catch(console.error);
          clearInterval(verifiedInterval);
          var memberIDIndex = memberIDs.indexOf(message.author.id);
          var authListIndex = authList.indexOf(findUser(message.author.id));

          authList.splice(authListIndex, 1);
          memberIDs.splice(memberIDIndex, 1);
        }
      });
    } else {
      clearInterval(verifiedInterval);
      message.reply('your code has expired. Try: `.c verify [Reddit username]` to generate a new one.');
      var memberIDIndex = memberIDs.indexOf(message.author.id);
      var authListIndex = authList.indexOf(findUser(message.author.id));

      authList.splice(authListIndex, 1);
      memberIDs.splice(memberIDIndex, 1);
    }
  }, 3000);
}

client.on('messageReactionAdd', (reaction, user) => {
  if (reaction.message.id == '533770709475000330') { // is to do with country being added...
    reaction.message.channel.guild.fetchMember(user).then(function(member) {
      var roles = member.roles;
      console.log(reaction.emoji.name);
      switch (reaction.emoji.name) {
        case "🍏":
          addRole(roles, member, "Zhejiang", reaction);
          break;
        case "🍎":
          addRole(roles, member, "Jiangsu", reaction);
          break;
        case "🍐":
          addRole(roles, member, "Shanghai", reaction);
          break;
        case "🍊":
          addRole(roles, member, "Fujian", reaction);
          break;
        case "🍋":
          addRole(roles, member, "Anhui", reaction);
          break;
        case "🍌":
          addRole(roles, member, "Jiangxi", reaction);
          break;
        case "🍉":
          addRole(roles, member, "Shandong", reaction);
          break;
        case "🍇":
          addRole(roles, member, "Taiwan", reaction);
          break;
        case "🍓":
          addRole(roles, member, "Hong Kong", reaction);
          break;
        case "🍈":
          addRole(roles, member, "Macau", reaction);
          break;
        case "🍒":
          addRole(roles, member, "Beijing", reaction);
          break;
        case "🍑":
          addRole(roles, member, "Hebei", reaction);
          break;
        case "🍍":
          addRole(roles, member, "Shanxi", reaction);
          break;
        case "🍅":
          addRole(roles, member, "Tianjin", reaction);
          break;
        case "🍆":
          addRole(roles, member, "Liaoning", reaction);
          break;
        case "🌶":
          addRole(roles, member, "Inner Mongolia", reaction);
          break;
        case "🌽":
          addRole(roles, member, "Jilin", reaction);
          break;
        case "🍠":
          addRole(roles, member, "Heilongjiang", reaction);
          break;
        case "🍯":
          addRole(roles, member, "Henan", reaction);
          break;
        case "🍞":
          addRole(roles, member, "Hubei", reaction);
          break;
        case "🧀":
          addRole(roles, member, "Hunan", reaction);
          break;
        case "🍗":
          addRole(roles, member, "Guangdong", reaction);
          break;
        case "🍖":
          addRole(roles, member, "Chongqing", reaction);
          break;
        case "🍤":
          addRole(roles, member, "Hainan", reaction);
          break;
        case "🍳":
          addRole(roles, member, "Guangxi", reaction);
          break;
        case "🍔":
          addRole(roles, member, "Sichuan", reaction);
          break;
        case "🍟":
          addRole(roles, member, "Guizhou", reaction);
          break;
        case "🌭":
          addRole(roles, member, "Yunnan", reaction);
          break;
        case "🍕":
          addRole(roles, member, "Tibet", reaction);
          break;
        case "🍝":
          addRole(roles, member, "Shaanxi", reaction);
          break;
        case "🌮":
          addRole(roles, member, "Gansu", reaction);
          break;
        case "🌯":
          addRole(roles, member, "Ningxia", reaction);
          break;
        case "🍜":
          addRole(roles, member, "Qinghai", reaction);
          break;
        default:
          addRole(roles, member, "Xinjiang", reaction);
          break;
      }
      if (reaction.emoji.name == "🇬🇧") {
        var subjectRole = reaction.message.channel.guild.roles.find(role => role.name === "United Kingdom");
        roles.forEach(function(role) {
          if (role.id == subjectRole.id) {
            hasRole = true;
          }
        });
        if (!hasRole) {
          member.addRole(subjectRole);
        }
      }
    });
  }
});

client.on('messageReactionRemove', (reaction, user) => {
  if (reaction.message.id == '533770709475000330') { // is to do with country being added...
    reaction.message.channel.guild.fetchMember(user).then(function(member) {
      var hasRole = false;
      var roles = member.roles;
      if (reaction.emoji.name == "🇬🇧") {
        var subjectRole = reaction.message.channel.guild.roles.find(role => role.name === "United Kingdom");
        roles.forEach(function(role) {
          if (role.id == subjectRole.id) {
            hasRole = true;
          }
        });
        if (hasRole) {
          member.removeRole(subjectRole);
        }
      }
    });
  }
});

function addRole(roles, member, name, reaction) {
  var hasRole = false;
  var subjectRole = reaction.message.channel.guild.roles.find(role => role.name === name);
  roles.forEach(function(role) {
    if (role.id == subjectRole.id) {
      hasRole = true;
    }
  });
  if (!hasRole) {
    member.addRole(subjectRole);
  }
}

function syntaxError(message) {
  message.reply('incorrect usage. Try: `.c help` for a list of commands...')
}

function findUser(id) {
  var length = authList.length;
  for (var i = 0; i < length; i++) {
    var data = authList[i].split('/');
    if (data[2] == id) {
      return data;
    }
  }
}

var download = function(uri, filename, callback) {
  request.head(uri, function(err, res, body) {
    console.log('content-type:', res.headers['content-type']);
    console.log('content-length:', res.headers['content-length']);

    request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
  });
};

client.login(keys.client);