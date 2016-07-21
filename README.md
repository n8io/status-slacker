![Slackbot exterminate!](https://a.slack-edge.com/2fac/plugins/bot/assets/service_128.png)
# status-slacker
A single company, multiple team status bot for Slack.

## How it works

1. Using a Slack bot, it will send out a direct message to each member of the team on a set schedule.
2. The user will then converse with the bot to collect answers to the configured questions.
3. Upon completion, a status summary for said user will be posted on the configured channel.

![Usage](https://i.imgsafe.org/0f5dd594d4.gif)

## Slack commands
![Sample](https://i.imgsafe.org/0ee4ae3f41.png)

## Requirements
* A SlackBot token [more info here](https://api.slack.com/bot-users)
* A server to host
* NodeJs v6+

## Getting started
1. `cat .env.sample > .env && cat data/configs.sample.json > data/configs.json`
2. Fill out the appropriate values in `.env`
3. Fill out the appropriate values in `data/configs.json`
4. `npm install`
5. `npm start`
6. Open Slack and start a DM with your bot.
7. Type `:-help`
8. Profit!

## Troubleshooting
To view debug messages:
`DEBUG=botkit* npm start`

## TODOs
1. Enable the same user to be on multiple teams. Currently a single user can only belong to a single configuration.
