# alia-bot

My personal Discord bot.

## Usage

### Prerequisites
- Node.js
- npm
- Docker and Docker Compose (for running the MySQL database)

### Setting Up for Development

1. **Clone the Repository**
    ```shell
    git clone [Your Repository URL]
    cd alia-bot
    ```

2. **Install Dependencies**
    ```shell
    npm install
    ```

3. **Environment Setup**
    - Warning: Read the [Setting Up a Test Guild](#setting-up-a-test-guild) section before dropping your bot token in a local file...
    - Create a `.env` file in the root directory with the following content:
      ```
      BOT_TOKEN=your_discord_bot_token
      NODE_ENV=development
      MYSQLDB_DATABASE=aliadb
      MYSQLDB_USER=aliabot
      MYSQLDB_PASSWORD=your_mysql_password
      MYSQLDB_ROOT_PASSWORD=your_mysql_root_password
      MYSQLDB_LOCAL_PORT=3307
      MYSQLDB_DOCKER_PORT=3306
      NODE_LOCAL_PORT=6868
      NODE_DOCKER_PORT=8080
      ```
    - Replace `your_discord_bot_token`, `your_mysql_password`, and `your_mysql_root_password` with your actual credentials.
    - Do not commit your `.env` file to source control to maintain security.

4. **Start the MySQL Database**
    - Run the following command to start the MySQL database using Docker Compose:
      ```shell
      docker-compose up -d mysqldb
      ```

5. **Run the Application**
    ```shell
    npm run start
    ```
   
### Running Tests
- **Linting**: Run `npm run lint` to start ESLint.
- **Unit Tests**: Run `npm run test` to start the Jest test runner.

### Setting Up a Test Discord Guild

#### Why Set Up a Test Guild?
Developing and testing a Discord bot can be exciting and challenging. However, it's crucial to do so in a safe and controlled environment. Using a test guild allows you to rigorously test and debug your bot without the risk of impacting your main guild or exposing your production bot token. This setup is especially important to keep your production token off your local machine, ensuring higher security and peace of mind.

Another key reason for this setup is to avoid the confusion and frustration of having two bots (development and production) responding to the same commands. If both your development and production bots are active in the same guild, they might both respond to commands, making it difficult to distinguish which bot's changes are being tested. Additionally, you don't want to turn off your production bot while developing, as it may be serving a live community.

By using a test guild, you can freely experiment, make changes, and encounter errors without any real-world consequences for your bot's users and without the confusion of overlapping bot responses.

#### Steps to Set Up a Test Guild

1. **Create a New Discord Guild**:
    - Open Discord and click on the plus icon on the left sidebar to create a new guild (server).
    - Follow the prompts to set up your new guild.

2. **Create a New Discord Application**:
    - Go to the [Discord Developer Portal](https://discord.com/developers/applications).
    - Click on the “New Application” button. Give it a name that indicates it’s for development/testing purposes.
    - Navigate to the “Bot” tab and click on “Add Bot”.

3. **Enable Guild Messages Intent**:
    - In the bot settings, ensure that the "Guild Messages" intent is enabled. This is necessary for your bot to react to live conversations in the guild.

4. **Get the Bot Token**:
    - Under the Bot tab, find and copy the bot token. This is your test bot token.
    - Keep this token private and never share it publicly.

5. **Invite the Bot to Your Test Guild**:
    - In the application settings, go to the “OAuth2” tab.
    - Under “Scopes”, select “bot”. Then, under “Bot Permissions”, select the permissions your bot needs.
    - Use the generated URL to invite your bot to the new Discord guild.

6. **Configure the Development Environment**:
    - Use the new bot token for development in your `.env` file or other environment variable configurations.
    - Ensure your application points to this test guild for all development and testing activities.

7. **Run the Bot in the Test Guild**:
    - After setting up your bot in the new guild and configuring the development environment, run your bot as usual.
    - This ensures that any development or testing activities do not interfere with your production bot or guild.

### Additional Notes
- **Testing Best Practices**: Always test new features or bug fixes in your test guild before deploying changes to your production environment.
- **Environment Separation**: Ensure that your development and production environments are properly separated in your configuration files or environment variables to prevent accidents.

### Database Setup and Onboarding Script

When setting up `alia-bot` for the first time, or after making significant changes to the database structure, it's important to ensure that your database is properly configured. This can involve initializing tables, loading initial data, or applying migrations. To simplify this process, an onboarding script can be used.

#### Onboarding Script

The onboarding script should automate the following tasks:
1. **Create Database Tables**: Run SQL scripts or use an ORM to create the necessary tables.
2. **Load Initial Data**: If your application requires initial data to function (like configuration settings), the script should handle this.
3. **Apply Migrations**: If you have database migrations, the script should apply them to bring the database to the latest schema version.

You can create a script (e.g., `onboarding.js`) in your project's root directory with the necessary logic and then include instructions in the README on how to run it.

#### Running the Onboarding Script 
    TODO: WRITE THE ONBOARDING SCRIPT

After setting up your `.env` file and starting the MySQL database, run the onboarding script to set up your database:

```shell
node onboarding.js
```

#### Handling Docker Volumes
If you encounter issues connecting to the MySQL database, it might be due to stale data in the Docker volume. This can happen if the initial configuration fails or if there are changes in the database setup. To resolve this:

1. **Stop the Containers:**

```shell
docker-compose down
```

2. **Remove the Docker Volume:**

This will delete the existing database data, so make sure you have backups if needed.
Find the volume name using docker volume ls.
Remove the volume using docker volume rm [VOLUME_NAME].

3. **Restart the Services:**

After removing the volume, start the services again to create a fresh database.

```shell
docker-compose up -d
```

4. **Rerun the Onboarding Script:**

Once the services are up, rerun the onboarding script to set up the database.

## Learning Resources

For those new to programming or certain technologies, here's a quick guide to some of the terms used in this project:

###### Must understand to just run it.

A good way to learn these technologies is to read the documentation and follow the installation instructions. Through trial and error, you will learn how to use these technologies.

You could follow my usage guide on this bot and when you dont understand something use this section to learn more about it.

- **[Git](https://git-scm.com/)**: A free and open source distributed version control system designed to handle everything from small to very large projects with speed and efficiency.
    - *Suggestions*:
        - Fork, clone, make a branch and commit. Then Submit a PR to this repo.

- **[NVM (Node Version Manager)](https://nvm.sh)**: A version manager for node.js, designed to be installed per-user, and invoked per-shell.
    - *Suggestions*:
        - I suggest this first because it makes installing Node.js and npm a breeze.
        - Run `nvm install latest` to install the latest version of Node.js.
        - Run `nvm install 20` to install Node.js version 20.
        - Run `nvm use 20` to use Node.js version 20.
        - Run `nvm alias default 20` to set Node.js version 20 as the default version.

- **[Node.js](https://nodejs.org/)**: An open-source, cross-platform, JavaScript runtime environment that executes JavaScript code outside a web browser.
    - *Suggestions*:
        - Install Node.js and run `node -v` to check the version.
        - Run `npm -v` to check the version of npm.
        - Run `npm install` to install the dependencies.
        - Run `npm run start` to start the bot.
        - Toy with the code. Read the error message and try to fix it.

- **[npm (Node Package Manager)](https://www.npmjs.com/)**: A package manager for JavaScript, allowing users to install and manage libraries and tools for their projects.
    - *Suggestions*:
        - Understand `package.json` and `package-lock.json`.

- **[Docker](https://www.docker.com/)**: A set of platform-as-a-service products that use OS-level virtualization to deliver software in packages called containers.

- **[Docker Compose](https://docs.docker.com/compose/)**: A tool for defining and running multi-container Docker applications.
    - *Suggestions*:
        - Understand `docker-compose.yml`.

- **.env File**: A simple text file used in projects to load environment variables for storing configuration settings and secrets, separate from your code.

###### Should understand to read the code.

* **[TypeScript](https://www.typescriptlang.org/)**: An open-source language which builds on JavaScript by adding static type definitions.
    * *Suggestions*:
        - Fix remaining `any` types in the codebase.

- **[Discord.js](https://discord.js.org/)**: A powerful JavaScript library for interacting with the Discord API. It's used to build the bot's core functionality.
    - *Suggestions*:
        - Make a slash command. It's a great way to learn how to use the Discord API.
        - Read the [Discord.js Guide](https://discordjs.guide/) to learn how to use the library. It's what I've used time and time again over the years.

- **[MySQL](https://www.mysql.com/)**: A widely used open-source relational database management system (RDBMS) that uses Structured Query Language (SQL).
    - *Suggestions*:
        - Learn how to use a database management tool like [Data Grip](https://www.jetbrains.com/datagrip/) or [DBeaver](https://dbeaver.io/). It's a great way to visualize your database and write queries.
        - Build sequelize models and examine the resulting database locally.

- **[Sequelize](https://sequelize.org/)**: A promise-based Node.js ORM for Postgres, MySQL, MariaDB, SQLite, and Microsoft SQL Server.
    - *Suggestions*:
        - Add mutli-guild support to all models.
        - Build a slash command that stores data as a learning exercise.

- **[Lodash](https://lodash.com/)**: A modern JavaScript utility library delivering modularity, performance, & extras.
    - *Suggestions*:
        - Less and less of this is being used, but if you come across a lodash function you don'd understand look it up and learn how to use it.
        - It's great at learning declarative programming. Check out `_.map()`, `_.filter()`, `_.reduce()`

###### Verify your contributions work.

If you want a PR merged into this repo you need to make sure it works. I want evidence of this in the form of tests and screenshots.
Because my code is live and actually deploys somewhere, you need to make sure your code works.

- **[Jest](https://jestjs.io/)**: A delightful JavaScript Testing Framework with a focus on simplicity.
    - *Suggestions*:
        = Run `npm run test` to start Jest.
        - Write unit tests for the commands you've built.

- **[ESLint](https://eslint.org/)**: A static code analysis tool for identifying problematic patterns found in JavaScript code.
    - *Suggestions*:
        - Run `npm run lint` to start ESLint.
        - Fix any linting errors that come up.

###### Small opportunities to learn a new skill.

Optional as long as you aren't working with these features. Fuse is used quite frequently in autocomplete functions. Axios is used for gathering data from third-party services to use in commands.

- **[Axios](https://axios-http.com/)**: A promise-based HTTP client for making HTTP requests from Node.js.
    - My very first commands were scripts that use Axios to make HTTP requests to external APIs. They could return jokes or random images.
    - *Suggestions*:
        - Build a command that uses Axios to make an HTTP request to an external API.
- **[Fuse.js](https://fusejs.io/)**: A lightweight fuzzy-search library.
- **[QR Code](https://www.npmjs.com/package/qrcode)**: A library for generating QR codes.
- **[Yup](https://github.com/jquense/yup)**: A JavaScript schema builder for value parsing and validation.

###### Asking for help

Feel free to ask me for help by creating issues. It doesn't matter if it's not a bug, it's a great way to ask for help. I'll try to respond as soon as I can.


