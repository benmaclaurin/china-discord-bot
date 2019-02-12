function verify(message, args) {
  if (!message.member.roles.has('529340149373468703')) {
    if (memberIDs.includes(message.author.id)) {
      var userData = findUser(message.author.id);
      var redditUser = userData[1];
      var code = userData[0];
    } else {
      message.reply('you do not have a code to verify. Please generate one using: **.c auth [Reddit username]**');
    }
  } else {
    message.reply('you are already verified...');
  }
}
