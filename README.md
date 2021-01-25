A simple self hosted token giveaway bot for Hive-Engine.com tokens.

By utilizing the initiation command DropBot will begin monitoring any post the deployer has performed the command in. By deploying this application once the installation of dependencies has been completed you'll be able to run it to unlock the ability to morph any simple HIVE blog post into an automated token giveaway event of your design. By specifying different variables including but not limited to the token to be given away and the amount of said token to be given away you'll soon have the power to distribute your Hive-Engine.com tokens without even so much as having to refresh a post.

## Installation

In order to run DropBot you must have basic knowledge of Command Prompt (windows OS) or Bash terminals (linux & mac).

- Install [git](https://git-scm.com/downloads)
- Install [NodeJS](https://nodejs.org/en/download/)(v14.15.1 was used to build this)

After installing the 2 above dependencies we'll go ahead and grab the code using git.

Open a Command Prompt or Bash terminal and enter in the following commands one at a time:

`git clone https://github.com/KLYE-Dev/dropbot.git`

After git is finished downloading the code we'll navigate into the folder just created:

`cd dropbot`

Once inside the DropBot folder we need to install more javascript dependencies by typing:

`npm install`

Installation might come back with some output saying it has found vulnerabilities in some installed modules.
This is fine as long as it doesn't end with an Error in the output at the end.
Now that DropBot is installed the next step is to set up the configuration of the application.

## Configuration



## Commands

The following list of commands can be

NOTE: Remember to replace the `@dropbot` in the examples below with the account name you specify in config!

`@dropbot start TOKENHERE 100:1`

`@dropbot stop`
