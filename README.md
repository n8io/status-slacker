![Slackbot exterminate!](https://a.slack-edge.com/2fac/plugins/bot/assets/service_128.png)
# status-slacker
A single company, multiple team status bot for Slack.

## How it works

1. Using a Slack bot, it will send out a direct message to each member of the team on a set schedule.
2. The user will then converse with the bot to collect answers to the configured questions.
3. Upon completion, a status summary for said user will be posted on the configured channels.

![Workflow](https://dl.dropboxusercontent.com/u/452959/hosted/status-slacker/workflow.gif)

## Slack commands
![Help](https://dl.dropboxusercontent.com/u/452959/hosted/status-slacker/usage.png)

## Requirements
* A SlackBot token [more info here](https://api.slack.com/bot-users)
* A server to host
* NodeJs v6+

## Getting started
1. Copy example files:
  1. `cat .env.sample > .env`
  1. `cat data/configs.sample.json > data/configs.json`
  1. `cat data/holidays.sample.json > data/holidays.json`
1. Fill out the appropriate values in `.env`
1. Fill out the appropriate values in `data/configs.json`
1. Add/remove dates in `data/holidays.json` to prevent status messages from being sent on certain days
1. `npm install`
1. `npm start`
1. Open Slack and start a DM with your bot.
1. Type `:-help`
1. Profit!

## Troubleshooting
To view debug messages:
`DEBUG=status-slacker* npm start`

## TODOs
1. ~~Enable the same user to be on multiple teams. Currently a single user can only belong to a single team status configuration.~~
1. ~~Break bot code into a more maintainable project structure~~
1. Flesh out front end for configuration management
  1. Add in global holiday calendar
  1. Add in user holiday calendar
    1. Allow users to declare themselves on holiday via `:-holiday` command
    1. Allow users to undeclare themselves on holiday via `:-unholiday` command
1. Create a public docker image
1. ~~Implement custom team name per configuration~~
1. Implement custom icon url per configuration
