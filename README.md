# status-slacker
A single company, multiple team status bot for Slack.

![Workflow](https://dl.dropboxusercontent.com/u/452959/hosted/status-slacker/workflow.gif)

## Features
* This bot direct messages each team member on a configurable schedule (can be disabled per user)
* Conversation questions are fully customizable
* Pull request, code review, and ticket urls are automatically parsed and linkified with cleaner text
* Schedule timezone is configurable per team configuration
* Admin users can view team configurations without leaving Slack
* Supports multi-team users
* Supports multiple channel summary posting per team
* Supports both global and team level ["Do Not Disturb" dates](#do-not-disturb-dates)
* Status summaries can be set to a unique color per user
* It's free

## How it works

1. Using a Slack bot, it will send out a direct message to each member of the team on a set schedule.
2. The user will then converse with the bot to collect answers to the configured questions.
3. Upon completion, a status summary for said user will be posted on the configured channels.

## Slack commands
![Help](https://dl.dropboxusercontent.com/u/452959/hosted/status-slacker/usage.png)

## Do Not Disturb dates
Do Not Disturb dates are dates that you **don't want** the bot to automatically send status requests.

The table below answers "Is today a..."

|Team DND date?|Global DND date?|Team DND Override?|Should bot send status messages?|
|:---:|:---:|:---:|:---:|
|X|X|X|Yes|
|X||X|Yes|
||X|X|Yes|
|||X|Yes|
||||Yes|
|X|||No|
|X|X||No|
||X||No|

## Requirements
* A new Slack Bot and token [more info here](https://api.slack.com/bot-users)
* A server to host
* NodeJs v6+

## Getting started
1. Copy example files:
  1. `cat .env.sample > .env`
  1. `cat data/configs.sample.json > data/configs.json`
  1. `cat data/holidays.sample.json > data/holidays.json`
1. Fill out the appropriate values in `.env`
1. Fill out the appropriate values in `data/configs.json`
1. Add/remove dates in `data/holidays.json` to prevent scheduled status requests from being sent on certain dates
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
  1. ~~Add in global holiday calendar~~
  1. Add in user holiday calendar
    1. Allow users to declare themselves on holiday via `:-holiday` command
    1. Allow users to undeclare themselves on holiday via `:-unholiday` command
1. Create a public docker image
1. ~~Implement custom team name per configuration~~
1. Implement custom icon url per configuration
1. TESTS
